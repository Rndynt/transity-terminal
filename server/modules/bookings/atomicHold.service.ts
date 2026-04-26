import { IStorage } from "@server/storage.interface";
import { db } from "@server/db";
import { seatInventory, seatHolds } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { webSocketService } from "@server/realtime/ws";

/**
 * P2 §10.7 — a leg conflicts on hold creation iff:
 *   (a) it is already booked, OR
 *   (b) its hold_ref points at an *active* seat_holds row.
 *
 * A hold row is active when either:
 *   - h.expires_at > now()                  (TTL window still open), OR
 *   - h.booking_id IS NOT NULL              (already confirmed; the
 *     release path nulls hold_ref on cancel, so a non-null
 *     booking_id always wins regardless of expires_at).
 *
 * An orphan hold_ref (no matching seat_holds row, or one whose
 * expires_at lapsed without a booking_id) is treated as a tombstone
 * the reaper will sweep — atomicHold overwrites it and proceeds.
 *
 * This must stay aligned with the engine implementation in
 * `engine/crates/engine-core/src/hold.rs::run_hold_txn`.
 */
function isHoldActive(
  holdExpiresAt: Date | null,
  holdBookingId: string | null,
  now: Date,
): boolean {
  if (holdBookingId !== null) return true;
  if (holdExpiresAt !== null) return holdExpiresAt > now;
  return false;
}

export interface SeatHoldRequest {
  tripId: string;
  seatNo: string;
  legIndexes: number[];
  operatorId: string;
  ttlClass: 'short' | 'long';
}

export interface AtomicHoldResult {
  success: boolean;
  holdRef?: string;
  conflictSeats?: string[];
  reason?: string;
  expiresAt?: Date;
}

export class AtomicHoldService {
  constructor(private storage: IStorage) {}

  async atomicHold(request: SeatHoldRequest): Promise<AtomicHoldResult> {
    const { tripId, seatNo, legIndexes, operatorId, ttlClass } = request;
    const holdRef = randomUUID();
    const ttlSeconds = ttlClass === 'short' ? 300 : 1800;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    try {
      const result = await db.transaction(async (tx) => {
        // P2 §10.7 — leftJoin seat_holds so we can ignore expired
        // holds whose hold_ref is still pinned on inventory because
        // the reaper hasn't swept yet. `for('update')` locks the
        // result rows; drizzle locks both sides of the join, but
        // seat_holds is read-only here so the extra lock is benign.
        // The matching engine query uses `FOR UPDATE OF i` for the
        // same reason — see hold.rs.
        const inventoryRows = await tx
          .select({
            booked: seatInventory.booked,
            holdRef: seatInventory.holdRef,
            holdExpiresAt: seatHolds.expiresAt,
            holdBookingId: seatHolds.bookingId,
          })
          .from(seatInventory)
          .leftJoin(seatHolds, eq(seatHolds.holdRef, seatInventory.holdRef))
          .where(and(
            eq(seatInventory.tripId, tripId),
            eq(seatInventory.seatNo, seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ))
          .for('update');

        if (inventoryRows.length !== legIndexes.length) {
          return {
            success: false,
            reason: 'INCOMPLETE_INVENTORY',
            conflictSeats: [seatNo]
          };
        }

        const now = new Date();
        const conflicts: string[] = [];
        for (const row of inventoryRows) {
          if (row.booked) {
            conflicts.push(seatNo);
            continue;
          }
          if (row.holdRef && isHoldActive(row.holdExpiresAt, row.holdBookingId, now)) {
            conflicts.push(seatNo);
          }
        }

        if (conflicts.length > 0) {
          return {
            success: false,
            reason: 'SEAT_CONFLICT',
            conflictSeats: conflicts
          };
        }

        await tx
          .update(seatInventory)
          .set({ holdRef })
          .where(and(
            eq(seatInventory.tripId, tripId),
            eq(seatInventory.seatNo, seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        await tx.insert(seatHolds).values({
          holdRef,
          tripId,
          seatNo,
          legIndexes,
          ttlClass,
          operatorId,
          expiresAt
        });

        return {
          success: true,
          holdRef,
          expiresAt
        };
      });

      if (result.success) {
        webSocketService.emitInventoryUpdated(tripId, seatNo, legIndexes);
      }

      return result;
    } catch (error) {
      console.error(`[ATOMIC_HOLD] Hold creation failed:`, error);
      return {
        success: false,
        reason: 'TRANSACTION_ERROR',
        conflictSeats: [seatNo]
      };
    }
  }

  async releaseHoldByRef(holdRef: string): Promise<{ success: boolean }> {
    try {
      const releasedHold = await db.transaction(async (tx) => {
        const [hold] = await tx
          .select()
          .from(seatHolds)
          .where(eq(seatHolds.holdRef, holdRef));

        if (!hold) {
          return null;
        }

        await tx
          .update(seatInventory)
          .set({ holdRef: null })
          .where(eq(seatInventory.holdRef, holdRef));

        await tx
          .delete(seatHolds)
          .where(eq(seatHolds.holdRef, holdRef));

        return hold;
      });

      if (releasedHold) {
        webSocketService.emitInventoryUpdated(
          releasedHold.tripId,
          releasedHold.seatNo,
          releasedHold.legIndexes as number[]
        );
        webSocketService.emitHoldsReleased(releasedHold.tripId, [releasedHold.seatNo]);
        return { success: true };
      }

      return { success: false };
    } catch (error) {
      console.error(`[ATOMIC_HOLD] Hold release failed:`, error);
      return { success: false };
    }
  }
}
