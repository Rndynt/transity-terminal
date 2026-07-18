import { db } from "@server/db";
import {
  bookings,
  passengers,
  seatInventory,
  bookingHistory,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";
import { IStorage } from "@server/storage.interface";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import { revertPromoApplicationsForBooking } from "@modules/promos/promoRevert";
import { isEngineEnabled, HoldsAdapter } from "@modules/holds/holdsAdapter";
import { AtomicHoldService } from "./atomicHold.service";
import { enqueueCancelSeats } from "@modules/holds/compensationQueue";
import { createComponentLogger } from "@server/lib/logger";

const log = createComponentLogger("unseat.service");

/**
 * S1-09 (Sprint 2): unseat & re-assign kursi memengaruhi inventory dan
 * status tiket. Service-layer guard memastikan caller internal pun
 * harus memiliki flag yang sesuai.
 *   - unseatPassenger / unseatAllPassengers → `action.passenger.unseat`
 *   - cancelPassengerTicket                 → `action.booking.cancel`
 *   - assignSeatToUnseated                  → `action.passenger.assign_seat`
 */

/**
 * Thrown when the engine seat-release could not complete synchronously
 * and the work was handed off to the compensation queue. The TT-side
 * cancel has already committed — the passenger row is `cancelled` and
 * the booking may have transitioned to `cancelled` as well — but the
 * seat is not yet re-sellable through the engine. The HTTP layer maps
 * this to 502 so the operator knows to retry the seatmap lookup in a
 * moment.
 */
export class EngineCancelDeferredError extends Error {
  readonly passengerId: string;
  readonly bookingId: string;
  constructor(passengerId: string, bookingId: string) {
    super("Booking marked cancelled. Seat release queued for retry — it will become available within a minute.");
    this.name = "EngineCancelDeferredError";
    this.passengerId = passengerId;
    this.bookingId = bookingId;
  }
}

function getLegIndexes(originSeq: number, destinationSeq: number): number[] {
  const legs: number[] = [];
  for (let i = originSeq; i < destinationSeq; i++) legs.push(i);
  return legs;
}

export class UnseatService {
  constructor(private storage: IStorage) {}

  async unseatPassenger(
    passengerId: string,
    performedBy: string,
    reason: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; booking: typeof bookings.$inferSelect | undefined; passenger: typeof passengers.$inferSelect }> {
    requirePermission(ctx, "action.passenger.unseat");
    const passenger = await db.select().from(passengers).where(eq(passengers.id, passengerId)).then(r => r[0]);
    if (!passenger) throw new Error("Penumpang tidak ditemukan");
    if (passenger.ticketStatus === 'unseated' || passenger.ticketStatus === 'cancelled') {
      throw new Error("Penumpang sudah di-unseat atau dibatalkan");
    }

    const booking = await this.storage.getBookingById(passenger.bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updatedP] = await tx.update(passengers)
        .set({ ticketStatus: 'unseated' })
        .where(eq(passengers.id, passengerId))
        .returning();

      // Engine mode: defer the seat release to AFTER tx commit; the engine
      // owns inventory writes and runs its own tx. Flag-off mode keeps the
      // legacy inline SQL inside the outer tx for unchanged behavior.
      if (!isEngineEnabled()) {
        await tx.update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            eq(seatInventory.seatNo, passenger.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));
      }

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId: passengerId,
        action: 'unseated',
        details: {
          seatNo: passenger.seatNo,
          reason: reason || 'Manual unseat',
          previousStatus: passenger.ticketStatus
        },
        performedBy
      });

      const allPassengers = await tx.select().from(passengers).where(eq(passengers.bookingId, booking.id));
      const allUnseatedOrCanceled = allPassengers.every(
        p => p.ticketStatus === 'unseated' || p.ticketStatus === 'cancelled'
      );
      if (allUnseatedOrCanceled) {
        await tx.update(bookings)
          .set({ status: 'unseated' })
          .where(eq(bookings.id, booking.id));
      }

      return updatedP;
    });

    // Engine mode: now that the local booking-state tx is committed, ask
    // the engine to release the seat back to inventory. On failure,
    // enqueue for asynchronous retry — the unseat is already done on TT
    // side and we don't want to roll it back.
    const engineModeUnseat = isEngineEnabled();
    if (engineModeUnseat) {
      const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
      try {
        await adapter.cancelSeats({
          tripId: booking.tripId,
          seatNo: passenger.seatNo,
          legIndexes,
        });
      } catch (e) {
        log.error({ err: e, tripId: booking.tripId, seatNo: passenger.seatNo }, "engine cancelSeats failed, enqueuing");
        await enqueueCancelSeats({
          tripId: booking.tripId,
          seatNo: passenger.seatNo,
          legIndexes,
          context: { source: 'unseatPassenger', passengerId, bookingId: booking.id },
        });
      }
    }

    // Adapter.cancelSeats already emitted per-seat WS in engine mode.
    if (!engineModeUnseat) {
      for (const legIdx of legIndexes) {
        webSocketService.emitInventoryUpdated(booking.tripId, passenger.seatNo, [legIdx]);
      }
    }

    return {
      success: true,
      booking: await this.storage.getBookingById(booking.id),
      passenger: updatedPassenger
    };
  }

  async unseatAllPassengers(
    bookingId: string,
    performedBy: string,
    reason: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; booking: typeof bookings.$inferSelect | null | undefined }> {
    requirePermission(ctx, "action.passenger.unseat");
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const paxList = await this.storage.getPassengers(bookingId);
    const activePax = paxList.filter(p => p.ticketStatus !== 'unseated' && p.ticketStatus !== 'cancelled');
    if (activePax.length === 0) throw new Error("Tidak ada penumpang aktif untuk di-unseat");

    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    const activePaxIds = activePax.map((p) => p.id);
    const activePaxSeats = activePax.map((p) => p.seatNo);

    await db.transaction(async (tx) => {
      // Bulk UPDATE passengers — single round-trip vs N sebelumnya.
      await tx.update(passengers)
        .set({ ticketStatus: 'unseated' })
        .where(inArray(passengers.id, activePaxIds));

      // See comment in unseatPassenger() about engine-mode deferral.
      if (!isEngineEnabled()) {
        // Bulk UPDATE seat_inventory — single round-trip vs N sebelumnya.
        await tx.update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            inArray(seatInventory.seatNo, activePaxSeats),
            inArray(seatInventory.legIndex, legIndexes)
          ));
      }

      // Bulk INSERT booking_history — single round-trip vs N sebelumnya.
      await tx.insert(bookingHistory).values(
        activePax.map((p) => ({
          bookingId: booking.id,
          passengerId: p.id,
          action: 'unseated' as const,
          details: {
            seatNo: p.seatNo,
            reason: reason || 'Unseat all passengers',
            previousStatus: p.ticketStatus,
          },
          performedBy,
        }))
      );

      await tx.update(bookings)
        .set({ status: 'unseated' })
        .where(eq(bookings.id, booking.id));
    });

    // Engine mode: per-seat cancel after tx commit. Engine endpoint is
    // per-seat only, so we iterate. Each failure is enqueued for the
    // scheduler so a transient engine outage cannot leak seats.
    const engineModeBatch = isEngineEnabled();
    if (engineModeBatch) {
      const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
      for (const p of activePax) {
        try {
          await adapter.cancelSeats({
            tripId: booking.tripId,
            seatNo: p.seatNo,
            legIndexes,
          });
        } catch (e) {
          log.error({ err: e, tripId: booking.tripId, seatNo: p.seatNo }, "engine cancelSeats failed, enqueuing");
          await enqueueCancelSeats({
            tripId: booking.tripId,
            seatNo: p.seatNo,
            legIndexes,
            context: { source: 'unseatAllPassengers', passengerId: p.id, bookingId: booking.id },
          });
        }
      }
    }

    // Adapter already emitted per-seat WS in engine mode.
    if (!engineModeBatch) {
      for (const p of activePax) {
        for (const legIdx of legIndexes) {
          webSocketService.emitInventoryUpdated(booking.tripId, p.seatNo, [legIdx]);
        }
      }
    }

    return {
      success: true,
      booking: await this.storage.getBookingById(booking.id)
    };
  }

  /**
   * Cancel a single passenger's ticket.
   *
   * Semantically this is the hard version of `unseatPassenger`:
   *   - ticketStatus transitions to `cancelled` (not `unseated`),
   *   - when every passenger on the booking is in a terminal state,
   *     the booking itself transitions to `cancelled` AND the promo
   *     usage + voucher reservation are reverted (so the same promo
   *     can be re-used and the voucher becomes `active` again),
   *   - engine-mode seat release still runs after tx commit; on
   *     engine-call failure the work is enqueued and this method
   *     throws `EngineCancelDeferredError` so the HTTP layer can
   *     surface a 502.
   *
   * Previously this logic lived inline in the PATCH /api/passengers/:id/cancel
   * route handler (133 lines of tx-mixing-SQL). Moving it here keeps
   * the route thin and lets other entry points (round-trip cancel,
   * refund flows) call the same canonical path instead of copy-pasting.
   */
  async cancelPassengerTicket(
    passengerId: string,
    reason: string,
    performedBy: string,
    ctx: ServiceContext
  ): Promise<{ passenger: typeof passengers.$inferSelect }> {
    requirePermission(ctx, "action.booking.cancel");

    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      throw new Error("Alasan pembatalan wajib diisi");
    }

    const [passengerRow] = await db.select().from(passengers).where(eq(passengers.id, passengerId));
    if (!passengerRow) throw new Error("Penumpang tidak ditemukan");
    if (passengerRow.ticketStatus === 'cancelled') throw new Error("Tiket sudah dibatalkan");

    const booking = await this.storage.getBookingById(passengerRow.bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const previousStatus = passengerRow.ticketStatus || 'active';
    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updated] = await tx.update(passengers)
        .set({ ticketStatus: 'cancelled' })
        .where(eq(passengers.id, passengerId))
        .returning();

      // See comment in unseatPassenger() for why engine-mode defers the
      // seat release until AFTER tx commit. Flag-off mode keeps the
      // legacy inline SQL inside the tx for unchanged behavior.
      if (passengerRow.seatNo && legIndexes.length > 0) {
        if (!isEngineEnabled()) {
          await tx.update(seatInventory)
            .set({ booked: false, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              eq(seatInventory.seatNo, passengerRow.seatNo),
              inArray(seatInventory.legIndex, legIndexes)
            ));
        }
      }

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId,
        action: 'cancelled',
        details: {
          seatNo: passengerRow.seatNo,
          reason: trimmedReason,
          previousStatus,
        },
        performedBy,
      });

      // Transition the booking itself when every passenger is in a
      // terminal state. The set {cancelled, unseated, refunded, no_show}
      // matches the pre-refactor route handler exactly.
      const allPassengers = await tx.select().from(passengers).where(eq(passengers.bookingId, booking.id));
      const allInactive = allPassengers.every(p =>
        p.ticketStatus === 'cancelled' ||
        p.ticketStatus === 'unseated' ||
        p.ticketStatus === 'refunded' ||
        p.ticketStatus === 'no_show'
      );
      if (allInactive) {
        await tx.update(bookings)
          .set({ status: 'cancelled' })
          .where(eq(bookings.id, booking.id));

        // S1-03: when the booking flips to cancelled, decrement every
        // applied promo's usageCount and mark any spent voucher as
        // active again. Shared helper keeps the semantics in sync across
        // bookings.service, refunds.service, and this path (P2 §5).
        await revertPromoApplicationsForBooking(tx, booking.id);
      }

      return updated;
    });

    // Engine-mode: release the seat back to inventory via the engine
    // AFTER the local booking-state tx has committed. On failure,
    // enqueue for the scheduler retry and throw EngineCancelDeferredError
    // so the HTTP layer surfaces a 502. The booking-side cancel is
    // irreversible at this point.
    let engineModeCancel = false;
    if (passengerRow.seatNo && legIndexes.length > 0) {
      engineModeCancel = isEngineEnabled();
      if (engineModeCancel) {
        const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
        try {
          await adapter.cancelSeats({
            tripId: booking.tripId,
            seatNo: passengerRow.seatNo,
            legIndexes,
          });
        } catch (e) {
          log.error({ err: e, tripId: booking.tripId, seatNo: passengerRow.seatNo, op: "postCancelTxCommit" }, "engine cancelSeats failed, enqueuing");
          await enqueueCancelSeats({
            tripId: booking.tripId,
            seatNo: passengerRow.seatNo,
            legIndexes,
            context: { source: 'cancelPassengerTicket', bookingId: booking.id, passengerId: passengerRow.id },
          });
          throw new EngineCancelDeferredError(passengerId, booking.id);
        }
      }
    }

    // Adapter.cancelSeats already emitted per-seat WS in engine mode.
    if (passengerRow.seatNo && !engineModeCancel) {
      for (const legIdx of legIndexes) {
        webSocketService.emitInventoryUpdated(booking.tripId, passengerRow.seatNo, [legIdx]);
      }
    }

    return { passenger: updatedPassenger };
  }


  async assignSeatToUnseated(
    passengerId: string,
    newSeatNo: string,
    performedBy: string,
    ctx: ServiceContext
  ): Promise<{ success: boolean; passenger: typeof passengers.$inferSelect; booking: typeof bookings.$inferSelect | null | undefined }> {
    requirePermission(ctx, "action.passenger.assign_seat");
    const passenger = await db.select().from(passengers).where(eq(passengers.id, passengerId)).then(r => r[0]);
    if (!passenger) throw new Error("Penumpang tidak ditemukan");
    if (passenger.ticketStatus !== 'unseated') {
      throw new Error("Hanya penumpang berstatus unseated yang bisa di-assign ulang");
    }

    const booking = await this.storage.getBookingById(passenger.bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    const newSeatAvailability = await db.select().from(seatInventory)
      .where(and(
        eq(seatInventory.tripId, booking.tripId),
        eq(seatInventory.seatNo, newSeatNo),
        inArray(seatInventory.legIndex, legIndexes)
      ));

    if (newSeatAvailability.length === 0) {
      throw new Error("Inventori kursi belum diinisialisasi untuk kursi ini");
    }

    if (newSeatAvailability.length !== legIndexes.length) {
      throw new Error("Inventori kursi tidak lengkap untuk semua leg rute");
    }

    const isAvailable = newSeatAvailability.every(s => !s.booked && !s.holdRef);
    if (!isAvailable) {
      throw new Error(`Kursi ${newSeatNo} tidak tersedia untuk semua leg rute ini`);
    }

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updatedP] = await tx.update(passengers)
        .set({ seatNo: newSeatNo, ticketStatus: 'active' })
        .where(eq(passengers.id, passengerId))
        .returning();

      await tx.update(seatInventory)
        .set({ booked: true, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, booking.tripId),
          eq(seatInventory.seatNo, newSeatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));

      const allPax = await tx.select().from(passengers).where(eq(passengers.bookingId, booking.id));
      const hasActivePax = allPax.some(p => p.ticketStatus === 'active');
      if (hasActivePax && booking.status === 'unseated') {
        const newStatus = 'paid';
        await tx.update(bookings)
          .set({ status: newStatus })
          .where(eq(bookings.id, booking.id));
      }

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId: passengerId,
        action: 'reassigned',
        details: {
          oldSeatNo: passenger.seatNo,
          newSeatNo,
          fromUnseated: true
        },
        performedBy
      });

      return updatedP;
    });

    for (const legIdx of legIndexes) {
      webSocketService.emitInventoryUpdated(booking.tripId, newSeatNo, [legIdx]);
    }

    return {
      success: true,
      passenger: updatedPassenger,
      booking: await this.storage.getBookingById(booking.id)
    };
  }

  async getBookingHistory(bookingId: string) {
    return await db.select().from(bookingHistory)
      .where(eq(bookingHistory.bookingId, bookingId))
      .orderBy(bookingHistory.createdAt);
  }
}
