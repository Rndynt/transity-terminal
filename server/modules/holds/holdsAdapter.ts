// Feature-flag dispatcher between the legacy Node atomic-hold service and
// the Rust Reservation Engine sidecar.
//
// When RESERVATION_ENGINE_ENABLED=true, hold/release/cancelSeats route
// through the engine. When false (default), the existing Node service is
// used unchanged — guaranteeing zero behavior change for operators who
// don't opt in.
//
// SCOPE OF THIS PR (intentional):
//   ✅ hold        — wired into bookings.service.ts createHold
//   ✅ release     — wired into bookings.service.ts releaseHold
//   ✅ cancelSeats — wired into bookings.routes.ts (ticket cancel) and
//                    unseat.service.ts (unseat passenger / unseat all)
//   ⚠️ confirm     — adapter method exists and is correct, but is NOT yet
//                    wired into booking.helpers.confirmSeatsBooked. Wiring
//                    it requires restructuring createBooking() to call the
//                    engine OUTSIDE the booking transaction (engine has its
//                    own DB tx). Tracked as follow-up; see replit.md.
//   ⚠️ reschedule  — reschedule.service.ts seat-swap (cancel-old + book-new)
//                    is NOT routed. The engine has no "book directly"
//                    primitive; routing requires hold→confirm orchestration.
//                    Tracked as follow-up.
//
// IMPORTANT: do NOT enable the flag in production until the follow-ups
// above are also completed. With the flag on AND the unrouted paths still
// writing directly to seat_inventory, you can race the engine's reaper.

import {
  AtomicHoldService,
  type SeatHoldRequest,
  type AtomicHoldResult,
} from "@modules/bookings/atomicHold.service";
import { engineClient, EngineError } from "./engineClient";
import { db } from "@server/db";
import { seatInventory, seatHolds } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";

export const isEngineEnabled = (): boolean =>
  (process.env.RESERVATION_ENGINE_ENABLED ?? "false").toLowerCase() === "true";

export interface CancelSeatLocalInput {
  tripId: string;
  seatNo: string;
  legIndexes: number[];
}

/**
 * Local fallback for cancelSeats — same SQL the legacy paths inlined,
 * extracted so both adapter branches share one code path.
 *
 * Caller is responsible for emitting WebSocket events; this helper only
 * touches seat_inventory + seat_holds so it can be composed inside any
 * outer transaction OR run standalone.
 */
export async function releaseConfirmedSeatLocal(
  input: CancelSeatLocalInput,
): Promise<void> {
  await db
    .update(seatInventory)
    .set({ booked: false, holdRef: null })
    .where(
      and(
        eq(seatInventory.tripId, input.tripId),
        eq(seatInventory.seatNo, input.seatNo),
        inArray(seatInventory.legIndex, input.legIndexes),
      ),
    );
}

export class HoldsAdapter {
  constructor(private readonly nodeService: AtomicHoldService) {}

  // ────────────────────────────────────────────────────────────
  // HOLD — drop-in replacement for AtomicHoldService.atomicHold()
  // ────────────────────────────────────────────────────────────
  async hold(req: SeatHoldRequest): Promise<AtomicHoldResult> {
    if (!isEngineEnabled()) {
      return this.nodeService.atomicHold(req);
    }

    try {
      const r = await engineClient.hold({
        trip_id: req.tripId,
        seat_no: req.seatNo,
        leg_indexes: req.legIndexes,
        operator_id: req.operatorId,
        ttl_class: req.ttlClass,
      });
      // Engine emits inventory.updated to its own pub/sub; TT clients
      // listening to TT's WebSocket also need the local emit so seatmap
      // updates reach connected outlets immediately.
      webSocketService.emitInventoryUpdated(req.tripId, req.seatNo, req.legIndexes);
      return {
        success: true,
        holdRef: r.hold_ref,
        expiresAt: new Date(r.expires_at),
      };
    } catch (e) {
      if (e instanceof EngineError && e.status === 409) {
        return {
          success: false,
          reason: "SEAT_CONFLICT",
          conflictSeats: e.details?.conflict_seats ?? [req.seatNo],
        };
      }
      if (e instanceof EngineError && e.status === 422) {
        return {
          success: false,
          reason: "INCOMPLETE_INVENTORY",
          conflictSeats: [req.seatNo],
        };
      }
      console.error("[HOLDS_ADAPTER] hold failed:", e);
      return {
        success: false,
        reason: "TRANSACTION_ERROR",
        conflictSeats: [req.seatNo],
      };
    }
  }

  // ────────────────────────────────────────────────────────────
  // RELEASE — drop-in replacement for AtomicHoldService.releaseHoldByRef()
  // ────────────────────────────────────────────────────────────
  async release(holdRef: string): Promise<{ success: boolean }> {
    if (!isEngineEnabled()) {
      return this.nodeService.releaseHoldByRef(holdRef);
    }

    // Look up the hold's trip/seat BEFORE telling the engine to delete it,
    // so we can emit the WS event afterwards. The engine has its own
    // pub/sub but TT's local Socket.io subscribers need this signal too.
    const [hold] = await db
      .select()
      .from(seatHolds)
      .where(eq(seatHolds.holdRef, holdRef))
      .limit(1);

    try {
      await engineClient.release(holdRef);
    } catch (e) {
      if (e instanceof EngineError && e.status === 404) {
        // Already gone — treat as success.
        return { success: true };
      }
      console.error("[HOLDS_ADAPTER] release failed:", e);
      return { success: false };
    }

    if (hold) {
      webSocketService.emitInventoryUpdated(
        hold.tripId,
        hold.seatNo,
        hold.legIndexes as number[],
      );
      webSocketService.emitHoldsReleased(hold.tripId, [hold.seatNo]);
    }
    return { success: true };
  }

  // ────────────────────────────────────────────────────────────
  // CONFIRM — exposed but NOT YET wired into booking.helpers.
  //   Caller resolves seat_no → hold_ref before invoking. Engine confirms
  //   one hold_ref at a time. Idempotent for 24h via Idempotency-Key.
  // ────────────────────────────────────────────────────────────
  async confirm(holdRef: string, bookingId: string, idemKey?: string): Promise<void> {
    if (!isEngineEnabled()) {
      throw new Error(
        "HoldsAdapter.confirm called while RESERVATION_ENGINE_ENABLED=false. " +
          "Use confirmSeatsBooked() helper directly instead.",
      );
    }
    await engineClient.confirm(holdRef, { booking_id: bookingId }, idemKey);
  }

  // ────────────────────────────────────────────────────────────
  // CANCEL SEATS — release CONFIRMED seats back to inventory.
  //   Engine endpoint is PER SEAT. Caller iterates over passengers.
  //   When flag is off, falls back to the local SQL (releaseConfirmedSeatLocal).
  // ────────────────────────────────────────────────────────────
  async cancelSeats(input: CancelSeatLocalInput): Promise<void> {
    if (!isEngineEnabled()) {
      await releaseConfirmedSeatLocal(input);
      return;
    }
    await engineClient.cancelSeats({
      trip_id: input.tripId,
      seat_no: input.seatNo,
      leg_indexes: input.legIndexes,
    });
    // Mirror to local WS for connected seatmap clients.
    webSocketService.emitInventoryUpdated(
      input.tripId,
      input.seatNo,
      input.legIndexes,
    );
  }
}

// Module-level singleton used by routes/services that don't construct it
// themselves. For unit tests, prefer instantiating HoldsAdapter directly
// with a mocked AtomicHoldService.
let _default: HoldsAdapter | null = null;
export function getHoldsAdapter(nodeService: AtomicHoldService): HoldsAdapter {
  if (!_default) _default = new HoldsAdapter(nodeService);
  return _default;
}
