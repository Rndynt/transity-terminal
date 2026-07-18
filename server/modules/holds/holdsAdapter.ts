// Feature-flag dispatcher between the legacy Node atomic-hold service and
// the Rust Reservation Engine sidecar.
//
// When RESERVATION_ENGINE_ENABLED=true, hold/release/cancelSeats route
// through the engine. When false (default), the existing Node service is
// used unchanged — guaranteeing zero behavior change for operators who
// don't opt in.
//
// SCOPE:
//   ✅ hold        — wired into bookings.service.ts createHold
//   ✅ release     — wired into bookings.service.ts releaseHold
//   ✅ cancelSeats — wired into bookings.routes.ts (ticket cancel) and
//                    unseat.service.ts (unseat passenger / unseat all)
//   ✅ confirm     — exposed as confirmForBooking() and called from
//                    bookings.service.ts createPaidBooking / createPendingBooking
//                    BEFORE opening the booking DB tx, with compensating
//                    cancel-seats on tx failure.
//   ✅ reschedule  — reschedule.service.ts uses holdAndConfirmShort() to
//                    book the new seat (hold→confirm) and cancelSeats() to
//                    free the old seat, with compensation.

import {
  AtomicHoldService,
  type SeatHoldRequest,
  type AtomicHoldResult,
} from "@modules/bookings/atomicHold.service";
import { assertTripBookable } from "@modules/bookings/booking.helpers";
import { engineClient, EngineError } from "./engineClient";
import { db } from "@server/db";
import { seatInventory, seatHolds } from "@shared/schema";
import { and, eq, gt, inArray } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";
import { randomUUID } from "node:crypto";
import { createComponentLogger } from "@server/lib/logger";

const log = createComponentLogger("holdsAdapter");

export const isEngineEnabled = (): boolean =>
  (process.env.RESERVATION_ENGINE_ENABLED ?? "false").toLowerCase() === "true";

interface CancelSeatLocalInput {
  tripId: string;
  seatNo: string;
  legIndexes: number[];
}

/**
 * Local fallback for cancelSeats — same SQL the legacy paths inlined,
 * extracted so both adapter branches share one code path. Module-private
 * by design: callers must always go through HoldsAdapter.cancelSeats so
 * the engine-flag routing decision is made in exactly one place.
 *
 * Caller is responsible for emitting WebSocket events; this helper only
 * touches seat_inventory + seat_holds so it can be composed inside any
 * outer transaction OR run standalone.
 */
async function releaseConfirmedSeatLocal(
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
    // Guard applies to BOTH branches. The Node branch's own atomicHold()
    // re-checks this too (defense-in-depth for direct callers), but the
    // engine branch has no other Node-side gate before dispatching to the
    // Rust sidecar, so this is the only place that can stop it.
    try {
      await assertTripBookable(this.nodeService.storage, req.tripId);
    } catch (e) {
      return {
        success: false,
        reason: e instanceof Error && (e as { code?: string }).code === 'trip-closed' ? 'TRIP_CLOSED' : 'TRIP_NOT_BOOKABLE',
        conflictSeats: [req.seatNo],
      };
    }

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
      if (e instanceof EngineError) {
        // Engine v1.1 maps INCOMPLETE_INVENTORY → 422, SEAT_CONFLICT → 409.
        // Engine v1.0 returned 409 for both, distinguishing only via
        // body.reason (which `call()` hoists into `e.code`). Route off
        // `e.code` first so this adapter is forward- and backward-compat.
        if (e.code === "INCOMPLETE_INVENTORY" || e.status === 422) {
          return {
            success: false,
            reason: "INCOMPLETE_INVENTORY",
            conflictSeats: e.details?.conflict_seats ?? [req.seatNo],
          };
        }
        if (e.code === "SEAT_CONFLICT" || e.status === 409) {
          return {
            success: false,
            reason: "SEAT_CONFLICT",
            conflictSeats: e.details?.conflict_seats ?? [req.seatNo],
          };
        }
      }
      log.error({ err: e, tripId: req.tripId, seatNo: req.seatNo }, "hold failed");
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
      log.error({ err: e, holdRef }, "release failed");
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
  // CONFIRM (single hold) — used internally by confirmForBooking and
  // by reschedule. Idempotent for 24h on the engine via Idempotency-Key.
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
  // CONFIRM-FOR-BOOKING — multi-seat confirm with compensation.
  //
  // Replaces booking.helpers.confirmSeatsBooked() under engine mode.
  // Must be called BEFORE opening the booking DB tx — the engine runs its
  // own tx and we cannot compose them. The caller pre-generates the
  // booking UUID so the engine confirm can carry it forward; the same UUID
  // is then used for the bookings INSERT.
  //
  // Steps:
  //   1. Look up live hold_refs for (tripId, seatNos, operatorId).
  //   2. For each seat: engine.confirm(holdRef, {booking_id}). Idempotency
  //      key is derived deterministically from bookingId+seatNo so a
  //      retry within 24h returns the cached response (engine §3.3).
  //   3. On any failure mid-loop: cancel-seats every confirm we already did,
  //      then throw. The caller's pre-tx exit means no TT state changed.
  //
  // Returns the list of confirmed (seatNo, holdRef) so the caller can run
  // compensation if its OWN downstream tx fails.
  // ────────────────────────────────────────────────────────────
  async confirmForBooking(opts: {
    bookingId: string;
    tripId: string;
    seatNos: string[];
    legIndexes: number[];
    operatorId: string;
  }): Promise<Array<{ seatNo: string; holdRef: string }>> {
    if (!isEngineEnabled()) {
      throw new Error(
        "HoldsAdapter.confirmForBooking called while RESERVATION_ENGINE_ENABLED=false",
      );
    }

    // Resolve seat → live hold_ref owned by this operator.
    const liveHolds = await db
      .select()
      .from(seatHolds)
      .where(
        and(
          eq(seatHolds.tripId, opts.tripId),
          inArray(seatHolds.seatNo, opts.seatNos),
          eq(seatHolds.operatorId, opts.operatorId),
          gt(seatHolds.expiresAt, new Date()),
        ),
      );

    const refBySeat = new Map<string, string>();
    for (const h of liveHolds) refBySeat.set(h.seatNo, h.holdRef);
    for (const seatNo of opts.seatNos) {
      if (!refBySeat.has(seatNo)) {
        throw new Error(
          `Seat ${seatNo} hold ownership lost (expired or grabbed by another operator) — cannot confirm via engine`,
        );
      }
    }

    const confirmed: Array<{ seatNo: string; holdRef: string }> = [];
    try {
      for (const seatNo of opts.seatNos) {
        const ref = refBySeat.get(seatNo)!;
        // Deterministic idem-key: same booking + same seat = same key,
        // so a retry inside the 24h window returns the cached engine response.
        const idemKey = `${opts.bookingId}:${seatNo}`;
        await engineClient.confirm(ref, { booking_id: opts.bookingId }, idemKey);
        confirmed.push({ seatNo, holdRef: ref });
      }
    } catch (e) {
      // Compensate: cancel every seat we already confirmed in this loop.
      for (const c of confirmed) {
        try {
          await engineClient.cancelSeats({
            trip_id: opts.tripId,
            seat_no: c.seatNo,
            leg_indexes: opts.legIndexes,
          });
        } catch (cancelErr) {
          log.error(
            { err: cancelErr, seatNo: c.seatNo, op: "compensationCancelSeats" },
            "compensation cancelSeats failed"
          );
        }
      }
      throw e;
    }
    return confirmed;
  }

  /**
   * Compensation helper for the caller: free a previously-confirmed set of
   * seats in the engine when the caller's downstream DB tx fails. Best-effort;
   * never throws (so it does not mask the original error). On failure the
   * row is enqueued in engine_compensation_queue so the scheduler retries
   * it asynchronously — without that the seat would leak.
   */
  async compensateConfirms(
    tripId: string,
    confirmed: Array<{ seatNo: string; holdRef: string }>,
    legIndexes: number[],
    context?: Record<string, unknown>,
  ): Promise<void> {
    const { enqueueCancelSeats } = await import("./compensationQueue");
    for (const c of confirmed) {
      try {
        await engineClient.cancelSeats({
          trip_id: tripId,
          seat_no: c.seatNo,
          leg_indexes: legIndexes,
        });
      } catch (e) {
        log.error(
          { err: e, seatNo: c.seatNo, op: "postTxCompensationCancelSeats" },
          "post-tx compensation cancelSeats failed, enqueuing for retry"
        );
        await enqueueCancelSeats({
          tripId,
          seatNo: c.seatNo,
          legIndexes,
          context: { source: "compensateConfirms", ...(context ?? {}) },
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // HOLD-AND-CONFIRM (short TTL) — used by reschedule to book a seat
  // directly when the operator never explicitly created a hold first.
  //
  // The engine has no "book directly" primitive: the only way to mark a
  // seat as booked=true is hold → confirm. We do both atomically here
  // (with compensation) so reschedule callers get a single async helper.
  // ────────────────────────────────────────────────────────────
  async holdAndConfirmShort(opts: {
    bookingId: string;
    tripId: string;
    seatNo: string;
    legIndexes: number[];
    operatorId: string;
  }): Promise<{ holdRef: string }> {
    if (!isEngineEnabled()) {
      throw new Error(
        "HoldsAdapter.holdAndConfirmShort called while RESERVATION_ENGINE_ENABLED=false",
      );
    }

    await assertTripBookable(this.nodeService.storage, opts.tripId);

    const holdRes = await engineClient.hold(
      {
        trip_id: opts.tripId,
        seat_no: opts.seatNo,
        leg_indexes: opts.legIndexes,
        operator_id: opts.operatorId,
        ttl_class: "short",
      },
      randomUUID(),
    );

    try {
      await engineClient.confirm(
        holdRes.hold_ref,
        { booking_id: opts.bookingId },
        `${opts.bookingId}:${opts.seatNo}`,
      );
    } catch (e) {
      // Roll back the hold so it doesn't linger to expiry.
      try {
        await engineClient.release(holdRes.hold_ref);
      } catch (relErr) {
        log.error(
          { err: relErr, seatNo: opts.seatNo, op: "holdAndConfirmShort" },
          "release after confirm failure failed"
        );
      }
      throw e;
    }

    webSocketService.emitInventoryUpdated(opts.tripId, opts.seatNo, opts.legIndexes);
    return { holdRef: holdRes.hold_ref };
  }

  // ────────────────────────────────────────────────────────────
  // HOLD-FOR-BOOKING — multi-seat initial hold tied to a booking.
  //
  // Used by B2C / OTA / WEB flows (app.service.ts) that create a
  // "pending" booking with seats held under booking_id so the pay/confirm
  // path can later query `seat_holds WHERE booking_id = ? AND expires_at > now()`.
  //
  // Engine mode:
  //   1. engine.hold(seat) per seat — atomic under FOR UPDATE + engine tx.
  //   2. UPDATE seat_holds SET booking_id = ? WHERE hold_ref IN (...)
  //      to backfill TT's link. The engine writes the hold row but does
  //      not know about TT's booking_id, so this UPDATE stitches the two.
  //   3. Expire timestamp is whatever the engine returned. The caller
  //      should align its own `bookings.pendingExpiresAt` to the min
  //      of returned expires_at values.
  //   4. On mid-loop failure, release every hold we already created so
  //      the operator sees a clean cancel.
  //
  // Legacy mode: caller is expected to use the legacy
  // `createSeatHoldsForBooking` helper directly; this method throws to
  // make the routing explicit.
  // ────────────────────────────────────────────────────────────
  async holdForBooking(opts: {
    bookingId: string;
    tripId: string;
    seatNos: string[];
    legIndexes: number[];
    operatorId: string;
    ttlClass: "short" | "long";
  }): Promise<Array<{ seatNo: string; holdRef: string; expiresAt: Date }>> {
    if (!isEngineEnabled()) {
      throw new Error(
        "HoldsAdapter.holdForBooking called while RESERVATION_ENGINE_ENABLED=false. " +
          "Use createSeatHoldsForBooking() directly instead.",
      );
    }

    await assertTripBookable(this.nodeService.storage, opts.tripId);

    const created: Array<{ seatNo: string; holdRef: string; expiresAt: Date }> = [];
    try {
      for (const seatNo of opts.seatNos) {
        // Deterministic idem-key: same booking + seat = same key, so a
        // retry within 24h returns the engine's cached response.
        const idemKey = `hold:${opts.bookingId}:${seatNo}`;
        const r = await engineClient.hold(
          {
            trip_id: opts.tripId,
            seat_no: seatNo,
            leg_indexes: opts.legIndexes,
            operator_id: opts.operatorId,
            ttl_class: opts.ttlClass,
          },
          idemKey,
        );
        created.push({
          seatNo,
          holdRef: r.hold_ref,
          expiresAt: new Date(r.expires_at),
        });
      }
    } catch (e) {
      // Compensate: release every hold we already placed in this loop.
      for (const c of created) {
        try {
          await engineClient.release(c.holdRef);
        } catch (relErr) {
          log.error(
            { err: relErr, seatNo: c.seatNo, op: "holdForBooking" },
            "compensation release failed"
          );
        }
      }
      throw e;
    }

    // Stitch TT's booking_id onto the engine-written hold rows. Failure
    // here leaves engine holds alive with booking_id=NULL — the pay flow
    // will see zero "active holds for bookingId" and fail cleanly. We
    // treat the link-up as best-effort-but-throw so the caller can
    // abort if the link fails and not leak orphaned holds.
    const holdRefs = created.map((c) => c.holdRef);
    try {
      await db
        .update(seatHolds)
        .set({ bookingId: opts.bookingId })
        .where(inArray(seatHolds.holdRef, holdRefs));
    } catch (linkErr) {
      for (const c of created) {
        try {
          await engineClient.release(c.holdRef);
        } catch {
          /* swallow; hold will expire at TTL */
        }
      }
      throw linkErr;
    }

    for (const c of created) {
      webSocketService.emitInventoryUpdated(opts.tripId, c.seatNo, opts.legIndexes);
    }
    return created;
  }

  // ────────────────────────────────────────────────────────────
  // RELEASE-FOR-BOOKING — release every live hold linked to a booking.
  //
  // Used when a pending booking is cancelled / its payment fails /
  // its hold window expires. Best-effort; on individual release
  // failure the hold will expire at its TTL anyway.
  // ────────────────────────────────────────────────────────────
  async releaseForBooking(bookingId: string, tripId?: string): Promise<void> {
    if (!isEngineEnabled()) return;

    const rows = await db
      .select({
        holdRef: seatHolds.holdRef,
        tripId: seatHolds.tripId,
        seatNo: seatHolds.seatNo,
        legIndexes: seatHolds.legIndexes,
      })
      .from(seatHolds)
      .where(eq(seatHolds.bookingId, bookingId));

    for (const row of rows) {
      try {
        await engineClient.release(row.holdRef);
      } catch (e) {
        if (e instanceof EngineError && e.status === 404) continue;
        log.error(
          { err: e, holdRef: row.holdRef, op: "releaseForBooking" },
          "release failed; will expire at TTL"
        );
      }
      webSocketService.emitInventoryUpdated(
        tripId ?? row.tripId,
        row.seatNo,
        row.legIndexes as number[],
      );
    }
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
