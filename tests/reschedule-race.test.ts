/**
 * Race-condition regression test for RescheduleService (local/non-engine
 * path) — companion to tests/refund-race.test.ts.
 *
 * Bug this guards against: `reschedulePassenger` / `batchRescheduleForTripClose`
 * used to check the NEW seat's availability with a plain `db.select()`
 * (no lock, not even inside a tx), then — separately, inside a *later*
 * transaction — blindly `UPDATE`d that seat to booked=true with no
 * re-check and no CAS guard on the WHERE clause. Between the check and
 * the write, a concurrent atomicHold(), a normal booking confirm, or
 * another concurrent reschedule could claim the exact same seat. Because
 * the write targets an existing row (not an INSERT), there is no
 * unique-constraint to catch this — it fails silently as a double-booking.
 *
 * The fix (`claimSeatAtomically` in booking.helpers.ts) moves the
 * authoritative check inside the tx, under `FOR UPDATE`, mirroring
 * AtomicHoldService.atomicHold's locking discipline (including
 * isHoldActive-aware handling of expired-but-not-yet-reaped holds).
 *
 * What's tested here:
 *   A) Seat looks free at the (unprotected) advisory pre-check, but the
 *      row lock inside the tx reveals it's already booked → reschedule
 *      rejects, and NO write (seat claim, passenger, booking, history)
 *      ever happens.
 *   B) Same, but the conflict is an *active* hold (not yet booked) from
 *      someone else → also rejects.
 *   C) Seat genuinely free at lock time → reschedule succeeds, and the
 *      writes happen in the expected order (release old seat → claim new
 *      seat → update passenger → update booking → insert history).
 *   D) A *stale/expired* hold_ref (orphaned, not yet swept by the
 *      reaper) must NOT block the claim — matching atomicHold's
 *      isHoldActive semantics exactly (this was stricter than it should
 *      have been before the fix, since the old check treated ANY
 *      non-null holdRef as blocking regardless of expiry).
 *
 * Sanity-checked against the original (pre-fix) code: tests A and B fail
 * there (reschedule silently "succeeds" against a booked/held seat) while
 * C and D still pass — confirming this suite actually catches the bug
 * rather than testing mock plumbing.
 *
 * Jalankan: `npx vitest run tests/reschedule-race.test.ts`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Outer (outside-tx) db.select() queue ----------
const outerSelectQueue: any[][] = [];
function pushOuterSelect(rows: any[]) {
  outerSelectQueue.push(rows);
}
function makeOuterSelectChain() {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    then: (resolve: any) => Promise.resolve(outerSelectQueue.shift() ?? []).then(resolve),
  };
  return chain;
}

// ---------- tx.select(...).leftJoin(...).where(...).for('update', ...) queue ----------
// This is the row-lock re-check inside claimSeatAtomically. Kept separate
// from outerSelectQueue so tests can make the *pre-check* say "available"
// while the *lock* says otherwise (that gap is exactly the bug).
const lockedRowsQueue: any[][] = [];
function pushLockedRows(rows: any[]) {
  lockedRowsQueue.push(rows);
}
function makeLockedSelectChain() {
  const chain: any = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    for: () => Promise.resolve(lockedRowsQueue.shift() ?? []),
  };
  return chain;
}

// ---------- tx.update / tx.insert call logs ----------
const txUpdateLog: Array<{ set: any }> = [];
const txInsertLog: Array<{ values: any }> = [];

function makeTx() {
  return {
    select: () => makeLockedSelectChain(),
    update: () => ({
      set: (setObj: any) => ({
        where: () => {
          txUpdateLog.push({ set: setObj });
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (v: any) => {
        txInsertLog.push({ values: v });
        const p: any = Promise.resolve(undefined);
        p.returning = async () => [{ id: "unused-split-booking-id" }];
        return p;
      },
    }),
  };
}

const dbMock: any = {
  select: () => makeOuterSelectChain(),
  transaction: async (cb: (tx: any) => Promise<any>) => cb(makeTx()),
};
vi.mock("@server/db", () => ({ db: dbMock }));

// ---------- other dependencies ----------
// Local (non-engine) mode: this is the path the bug lived in.
vi.mock("@modules/holds/holdsAdapter", () => ({
  isEngineEnabled: () => false,
  HoldsAdapter: class {
    constructor(_s: any) {}
  },
}));

// Keep the REAL isHoldActive (pure function, no DB) since claimSeatAtomically
// depends on it — only stub the class, which isn't used in local mode.
vi.mock("@modules/bookings/atomicHold.service", async () => {
  const actual = await vi.importActual<any>("@modules/bookings/atomicHold.service");
  return {
    ...actual,
    AtomicHoldService: class {
      constructor(_s: any) {}
    },
  };
});

vi.mock("@server/realtime/ws", () => ({
  webSocketService: {
    emitInventoryUpdated: vi.fn(),
    emitHoldsReleased: vi.fn(),
  },
}));

vi.mock("@modules/holds/compensationQueue", () => ({
  enqueueCancelSeats: vi.fn(async () => "fake-id"),
}));

// ---------- fixtures ----------
const passengerFix = {
  id: "p1",
  bookingId: "b1",
  ticketStatus: "active",
  seatNo: "A1",
  fareAmount: "100000",
};
const bookingFix = {
  id: "b1",
  tripId: "trip-OLD",
  originSeq: 0,
  destinationSeq: 1,
  originStopId: "S0",
  destinationStopId: "S1",
  channel: "CSO",
  outletId: "out-1",
  currency: "IDR",
  status: "confirmed",
  createdBy: "u-op",
};
const tripFix = { id: "trip-NEW", status: "scheduled" };

const storageMock: any = {
  getTripById: vi.fn(async () => tripFix),
  getBookingById: vi.fn(async () => bookingFix),
};

beforeEach(() => {
  outerSelectQueue.length = 0;
  lockedRowsQueue.length = 0;
  txUpdateLog.length = 0;
  txInsertLog.length = 0;
  storageMock.getTripById.mockClear();
  storageMock.getBookingById.mockClear();
});

// Queues the 3 outside-tx selects reschedulePassenger makes, in order:
//   1) passenger by id
//   2) advisory pre-check on new seat (caller controls whether this says
//      "available" — the whole point is that this can be stale)
//   3) all passengers in the booking (sole-passenger determination)
function primeOuterSelects(opts: { preCheckRows: any[] }) {
  pushOuterSelect([passengerFix]);
  pushOuterSelect(opts.preCheckRows);
  pushOuterSelect([passengerFix]);
}

describe("RescheduleService.reschedulePassenger race condition (local/non-engine path)", () => {
  it("A) pre-check says available, but row lock reveals seat already booked → reject, no write happens", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RescheduleService(storageMock);

    // Advisory pre-check: looks free.
    primeOuterSelects({
      preCheckRows: [{ tripId: "trip-NEW", seatNo: "B2", legIndex: 0, booked: false, holdRef: null }],
    });
    // But under the lock, a concurrent request already won this seat.
    pushLockedRows([{ booked: true, holdRef: null, holdExpiresAt: null, holdBookingId: null }]);

    await expect(
      svc.reschedulePassenger(
        "p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "staff-1", "test", SYSTEM_CONTEXT
      )
    ).rejects.toThrow(/tidak tersedia/i);

    // Only the old-seat release should have happened. The new-seat claim
    // must have thrown BEFORE its own update, and everything after it
    // (passenger seat change, booking update, history insert) must never
    // have run.
    expect(txUpdateLog.length).toBe(1);
    expect(txUpdateLog[0].set).toMatchObject({ booked: false, holdRef: null });
    expect(txInsertLog.length).toBe(0);
  });

  it("B) row lock reveals an active hold from someone else (not yet booked) → reject", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RescheduleService(storageMock);

    primeOuterSelects({
      preCheckRows: [{ tripId: "trip-NEW", seatNo: "B2", legIndex: 0, booked: false, holdRef: null }],
    });
    // Active hold: expires in the future, no bookingId yet.
    const future = new Date(Date.now() + 5 * 60 * 1000);
    pushLockedRows([
      { booked: false, holdRef: "other-hold-ref", holdExpiresAt: future, holdBookingId: null },
    ]);

    await expect(
      svc.reschedulePassenger(
        "p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "staff-1", "test", SYSTEM_CONTEXT
      )
    ).rejects.toThrow(/tidak tersedia/i);

    expect(txUpdateLog.length).toBe(1); // old-seat release only
    expect(txInsertLog.length).toBe(0);
  });

  it("C) seat genuinely free at lock time → succeeds, writes happen in expected order", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RescheduleService(storageMock);

    primeOuterSelects({
      preCheckRows: [{ tripId: "trip-NEW", seatNo: "B2", legIndex: 0, booked: false, holdRef: null }],
    });
    pushLockedRows([{ booked: false, holdRef: null, holdExpiresAt: null, holdBookingId: null }]);

    const result = await svc.reschedulePassenger(
      "p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "staff-1", "test", SYSTEM_CONTEXT
    );

    expect(result.success).toBe(true);
    // release old seat, claim new seat, update passenger, update booking.
    expect(txUpdateLog.length).toBe(4);
    expect(txUpdateLog[0].set).toMatchObject({ booked: false, holdRef: null }); // old seat released
    expect(txUpdateLog[1].set).toMatchObject({ booked: true, holdRef: null });  // new seat claimed
    expect(txUpdateLog[2].set).toMatchObject({ seatNo: "B2" });                 // passenger moved
    expect(txInsertLog.length).toBe(1); // bookingHistory
  });

  it("D) stale/expired hold_ref (orphaned, reaper hasn't swept it) is NOT treated as a conflict", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RescheduleService(storageMock);

    primeOuterSelects({
      preCheckRows: [{ tripId: "trip-NEW", seatNo: "B2", legIndex: 0, booked: false, holdRef: null }],
    });
    // Expired hold: expiresAt in the past, no bookingId → isHoldActive() is
    // false → this is a tombstone, not a real conflict.
    const past = new Date(Date.now() - 5 * 60 * 1000);
    pushLockedRows([
      { booked: false, holdRef: "stale-hold-ref", holdExpiresAt: past, holdBookingId: null },
    ]);

    const result = await svc.reschedulePassenger(
      "p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "staff-1", "test", SYSTEM_CONTEXT
    );

    expect(result.success).toBe(true);
    expect(txUpdateLog.length).toBe(4);
    expect(txUpdateLog[1].set).toMatchObject({ booked: true, holdRef: null });
  });
});
