import { db } from "@server/db";
import { seatHolds, seatInventory } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";

/**
 * HoldsService retains a single responsibility: bulk-release every
 * seat hold owned by a given operator (optionally scoped to one
 * booking). It is used when a CSO logs out or cancels a booking and
 * we want to free every seat they were still holding in one round-trip.
 *
 * Every other hold lifecycle operation (create, single-ref release,
 * query, extend, convert-to-long) now lives on HoldsAdapter — which
 * knows how to route to the Rust engine when the feature flag is on —
 * or on AtomicHoldService (the legacy node-only path). This class is
 * kept narrow on purpose; expanding it again would resurrect the
 * dual-ledger drift that PR #7 was meant to kill.
 */
export class HoldsService {
  async releaseHoldsByOwner(operatorId: string, bookingId?: string): Promise<void> {
    const condition = bookingId
      ? and(eq(seatHolds.operatorId, operatorId), eq(seatHolds.bookingId, bookingId))
      : eq(seatHolds.operatorId, operatorId);

    const holdsToRelease = await db.select().from(seatHolds).where(condition);
    if (holdsToRelease.length === 0) return;

    const holdRefs = holdsToRelease.map(h => h.holdRef);

    await db.transaction(async (tx) => {
      await tx.update(seatInventory)
        .set({ holdRef: null })
        .where(inArray(seatInventory.holdRef, holdRefs));

      await tx.delete(seatHolds)
        .where(inArray(seatHolds.holdRef, holdRefs));
    });

    const tripGroups = new Map<string, string[]>();
    for (const hold of holdsToRelease) {
      const seats = tripGroups.get(hold.tripId) || [];
      seats.push(hold.seatNo);
      tripGroups.set(hold.tripId, seats);
    }
    for (const [tripId, seats] of tripGroups) {
      webSocketService.emitHoldsReleased(tripId, seats);
    }
    for (const hold of holdsToRelease) {
      webSocketService.emitInventoryUpdated(hold.tripId, hold.seatNo, hold.legIndexes as number[]);
    }
  }
}
