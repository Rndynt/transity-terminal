import { db } from "@server/db";
import {
  refunds,
  bookings,
  passengers,
  trips,
  bookingHistory,
  seatInventory,
} from "@shared/schema";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { isEngineEnabled, HoldsAdapter } from "@modules/holds/holdsAdapter";
import { AtomicHoldService } from "@modules/bookings/atomicHold.service";
import { enqueueCancelSeats } from "@modules/holds/compensationQueue";
import { storage } from "@server/storage";
import { webSocketService } from "@server/realtime/ws";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import { revertPromoApplicationsForBooking } from "@modules/promos/promoRevert";
import { LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from "@server/constants/pagination";
import { createComponentLogger } from "@server/lib/logger";

const log = createComponentLogger("refunds.service");

function getRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  return ((result as { rows?: unknown[] })?.rows || []) as Array<Record<string, unknown>>;
}

const INACTIVE_TICKET_STATUSES = ['cancelled', 'refunded', 'no_show', 'unseated'] as const;

/**
 * S1-09: lihat `server/modules/rbac/README.md` untuk pola
 * `requirePermission(ctx, perm)`. Mapping flag:
 *   - getAll/getById  → page.refunds
 *   - create          → action.refund.create
 *   - approve/reject  → action.refund.approve
 *   - process         → action.refund.process
 */
export class RefundsService {
  async getAll(ctx: ServiceContext, opts?: { limit?: number; offset?: number }) {
    requirePermission(ctx, "page.refunds");
    // β-2: explicit cap dari shared constant (sebelumnya hardcoded 200).
    const limit = Math.min(Math.max(opts?.limit ?? LIST_DEFAULT_LIMIT, 1), LIST_MAX_LIMIT);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const result = await db.execute(sql`
      SELECT r.*, b.booking_code, p.full_name AS passenger_name
      FROM refunds r
      LEFT JOIN bookings b ON b.id = r.booking_id
      LEFT JOIN passengers p ON p.id = r.passenger_id
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return getRows(result);
  }

  async getById(id: string, ctx: ServiceContext) {
    requirePermission(ctx, "page.refunds");
    const result = await db.execute(sql`
      SELECT r.*, b.booking_code, b.total_amount AS booking_total, b.status AS booking_status,
             p.full_name AS passenger_name, p.ticket_number
      FROM refunds r
      LEFT JOIN bookings b ON b.id = r.booking_id
      LEFT JOIN passengers p ON p.id = r.passenger_id
      WHERE r.id = ${id}
    `);
    const rows = getRows(result);
    return rows[0] || null;
  }

  async create(data: {
    bookingId: string;
    passengerId?: string | null;
    originalAmount: string;
    refundAmount: string;
    adminFee?: string;
    reason?: string;
    refundMethod?: string;
    bankAccount?: string;
    bankName?: string;
    notes?: string;
  }, requestedBy: string, ctx: ServiceContext) {
    requirePermission(ctx, "action.refund.create");
    const [row] = await db.insert(refunds).values({
      bookingId: data.bookingId,
      passengerId: data.passengerId || null,
      originalAmount: String(data.originalAmount),
      refundAmount: String(data.refundAmount),
      adminFee: String(data.adminFee || 0),
      reason: data.reason,
      refundMethod: data.refundMethod,
      requestedBy,
      bankAccount: data.bankAccount,
      bankName: data.bankName,
      notes: data.notes,
    }).returning();
    return row;
  }

  /**
   * Approve refund: bukan sekedar update kolom status, tapi:
   *   1. Idempotent guard (status approved/processed → return early).
   *   2. Tolak kalau trip sudah closed (sudah berangkat).
   *   3. Mark passenger(s) ticket_status='refunded'.
   *   4. Release seat ke inventory (legacy mode inline tx, engine mode post-tx).
   *   5. Kalau semua passenger sudah inactive → booking.status='refunded'.
   *   6. Decrement promo usageCount + revert voucher 'active' (S1-03).
   *   7. WS emit inventory.updated supaya seatmap CSO/WEB refresh otomatis.
   */
  async approve(id: string, approvedBy: string, ctx: ServiceContext) {
    requirePermission(ctx, "action.refund.approve");
    // S1-01 race-safety: pre-flight check untuk error message bagus + early
    // exit kalau sudah approved (idempotent). Tapi keputusan resmi tetap di
    // dalam transaction via compare-and-swap.
    const [preRefund] = await db.select().from(refunds).where(eq(refunds.id, id)).limit(1);
    if (!preRefund) throw new Error('Refund tidak ditemukan');
    if (preRefund.status === 'approved' || preRefund.status === 'processed') {
      return { success: true, idempotent: true };
    }
    if (preRefund.status === 'rejected') {
      throw new Error('Refund sudah ditolak — tidak dapat di-approve.');
    }

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, preRefund.bookingId)).limit(1);
    if (!booking) throw new Error('Booking tidak ditemukan');

    const [trip] = await db.select().from(trips).where(eq(trips.id, booking.tripId)).limit(1);
    if (!trip) throw new Error('Trip tidak ditemukan');
    if (trip.status === 'closed') {
      throw new Error('Trip sudah berangkat (closed) — refund tidak dapat di-approve.');
    }

    // Resolve passenger(s) yang akan di-refund. Kalau passengerId null, refund
    // berlaku untuk seluruh penumpang aktif di booking.
    const targetPassengers = preRefund.passengerId
      ? await db.select().from(passengers).where(eq(passengers.id, preRefund.passengerId))
      : await db.select().from(passengers).where(and(
          eq(passengers.bookingId, preRefund.bookingId),
          notInArray(passengers.ticketStatus, INACTIVE_TICKET_STATUSES as unknown as string[]),
        ));

    if (targetPassengers.length === 0) {
      // Semua passenger sudah inactive — CAS-only update (tetap race-safe).
      const [r] = getRows(await db.execute(sql`
        UPDATE refunds SET status = 'approved', approved_by = ${approvedBy}, approved_at = NOW()
         WHERE id = ${id} AND status = 'pending'
        RETURNING id
      `));
      if (!r) return { success: true, idempotent: true, releasedSeats: 0 };
      return { success: true, releasedSeats: 0 };
    }

    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);

    const engineMode = isEngineEnabled();
    let allInactive = false;
    let claimed = false;

    await db.transaction(async (tx) => {
      // 1. CAS: 'pending' → 'approved'. Kalau ada request paralel yang sudah
      // duluan, rowCount=0 → kita skip semua side-effect dan return idempotent
      // di luar transaction.
      const claimRows = getRows(await tx.execute(sql`
        UPDATE refunds
           SET status = 'approved', approved_by = ${approvedBy}, approved_at = NOW()
         WHERE id = ${id} AND status = 'pending'
        RETURNING id
      `));
      if (claimRows.length === 0) {
        // Race lost — request paralel menang. Bail out tanpa side-effect.
        return;
      }
      claimed = true;

      // 2. Mark passengers refunded + history per passenger
      for (const p of targetPassengers) {
        await tx.update(passengers)
          .set({ ticketStatus: 'refunded' })
          .where(eq(passengers.id, p.id));

        await tx.insert(bookingHistory).values({
          bookingId: booking.id,
          passengerId: p.id,
          action: 'cancelled',
          details: {
            seatNo: p.seatNo,
            reason: 'refund_approved',
            refundId: id,
            previousStatus: p.ticketStatus,
          },
          performedBy: approvedBy,
        });

        // Legacy mode: release seat inline. Engine mode: skip — handled post-tx
        // (engine API runs its own tx, can't compose).
        if (!engineMode && p.seatNo && legIndexes.length > 0) {
          await tx.update(seatInventory)
            .set({ booked: false, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              eq(seatInventory.seatNo, p.seatNo),
              inArray(seatInventory.legIndex, legIndexes),
            ));
        }
      }

      // 3. Re-check semua passenger di booking. Kalau semua inactive, booking refunded.
      const allPassengers = await tx.select().from(passengers).where(eq(passengers.bookingId, booking.id));
      allInactive = allPassengers.every(p =>
        (INACTIVE_TICKET_STATUSES as readonly string[]).includes(p.ticketStatus ?? 'active')
      );

      if (allInactive) {
        await tx.update(bookings)
          .set({ status: 'refunded' })
          .where(eq(bookings.id, booking.id));

        // 4. Decrement promo usage + revert voucher (S1-03 piggyback).
        // Shared helper keeps GREATEST-guarded decrement + voucher revert
        // identical across bookings.service, unseat.service, and this path
        // (P2 §5 unification).
        await revertPromoApplicationsForBooking(tx, booking.id);
      }
    });

    // Race lost di dalam transaction → request paralel sudah finalize.
    // Jangan lepas seat lagi (sudah dilepas oleh winner). Return idempotent.
    if (!claimed) {
      return { success: true, idempotent: true, releasedSeats: 0 };
    }

    // 5. Engine-mode seat release post-tx + compensation queue on failure.
    if (engineMode && legIndexes.length > 0) {
      const adapter = new HoldsAdapter(new AtomicHoldService(storage));
      for (const p of targetPassengers) {
        if (!p.seatNo) continue;
        try {
          await adapter.cancelSeats({
            tripId: booking.tripId,
            seatNo: p.seatNo,
            legIndexes,
          });
        } catch (e) {
          log.error({ err: e, tripId: booking.tripId, seatNo: p.seatNo, refundId: id }, "engine cancelSeats failed, enqueuing for retry");
          await enqueueCancelSeats({
            tripId: booking.tripId,
            seatNo: p.seatNo,
            legIndexes,
            context: { source: 'refunds.approve', refundId: id, passengerId: p.id, bookingId: booking.id },
          });
        }
      }
    } else if (legIndexes.length > 0) {
      // Legacy mode: adapter sudah skip WS, jadi emit manual di sini supaya
      // seatmap client refresh setelah seat dilepas.
      for (const p of targetPassengers) {
        if (!p.seatNo) continue;
        webSocketService.emitInventoryUpdated(booking.tripId, p.seatNo, legIndexes);
      }
    }

    return {
      success: true,
      releasedSeats: targetPassengers.filter(p => !!p.seatNo).length,
      bookingRefunded: allInactive,
    };
  }

  async process(id: string, processedBy: string, ctx: ServiceContext) {
    requirePermission(ctx, "action.refund.process");
    await db.update(refunds)
      .set({ status: 'processed', processedBy, processedAt: new Date() })
      .where(eq(refunds.id, id));
    return { success: true };
  }

  async reject(id: string, notes: string | undefined, ctx: ServiceContext) {
    requirePermission(ctx, "action.refund.approve");
    await db.update(refunds)
      .set({ status: 'rejected', notes })
      .where(eq(refunds.id, id));
    return { success: true };
  }
}
