/**
 * Regression test for AtomicHoldService's FOR UPDATE NOWAIT handling.
 *
 * Before this change, a contended seat lock made the losing request BLOCK
 * inside `SELECT ... FOR UPDATE` until the winning transaction committed
 * or rolled back (benchmarked at ~127ms under contention in
 * docs/query-performance.md Q03) before either succeeding or discovering
 * the conflict. `noWait: true` makes Postgres fail that lock acquisition
 * immediately instead (SQLSTATE 55P03 / lock_not_available).
 *
 * What's tested:
 *   A) A 55P03 error (thrown directly with `.code`) is translated to the
 *      same {success:false, reason:'SEAT_CONFLICT'} shape every other
 *      "someone else has this seat" case already returns — so no caller
 *      needs to change, and it is NOT logged as an error (it's an
 *      expected, frequent outcome under contention, not a bug).
 *   B) Same, but with the pg error wrapped under `.cause.code` (how
 *      Drizzle/pg sometimes surfaces it) — mirrors the existing 23505
 *      handling pattern elsewhere in this codebase.
 *   C) A genuinely unexpected DB error (different code) still falls
 *      through to the original TRANSACTION_ERROR path and IS logged —
 *      confirming the 55P03 special-case didn't swallow real errors.
 *
 * Jalankan: `npx vitest run tests/atomicHold-nowait.test.ts`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let txShouldThrow: { code?: string; cause?: { code?: string } } | null = null;

const dbMock: any = {
  transaction: async (_cb: (tx: any) => Promise<any>) => {
    if (txShouldThrow) {
      const err: any = new Error("simulated pg error");
      if (txShouldThrow.code) err.code = txShouldThrow.code;
      if (txShouldThrow.cause) err.cause = txShouldThrow.cause;
      throw err;
    }
    // Not exercised in this file — every test here fails inside the
    // lock-acquisition step, before any select/update chain would run.
    throw new Error("test bug: tx should have thrown before reaching here");
  },
};
vi.mock("@server/db", () => ({ db: dbMock }));

vi.mock("@server/realtime/ws", () => ({
  webSocketService: { emitInventoryUpdated: vi.fn() },
}));

const errorLogSpy = vi.fn();
vi.mock("@server/lib/logger", () => ({
  createComponentLogger: () => ({
    error: errorLogSpy,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

const storageMock: any = {
  getTripById: vi.fn(async () => ({ id: "trip-1", status: "scheduled" })),
};

beforeEach(() => {
  txShouldThrow = null;
  errorLogSpy.mockClear();
  storageMock.getTripById.mockClear();
});

describe("AtomicHoldService — FOR UPDATE NOWAIT (55P03) handling", () => {
  it("A) direct 55P03 error → SEAT_CONFLICT result, not logged as an error", async () => {
    const { AtomicHoldService } = await import("@modules/bookings/atomicHold.service");
    const svc = new AtomicHoldService(storageMock);

    txShouldThrow = { code: "55P03" };

    const result = await svc.atomicHold({
      tripId: "trip-1",
      seatNo: "A1",
      legIndexes: [0],
      operatorId: "op-1",
      ttlClass: "short",
    });

    expect(result).toEqual({
      success: false,
      reason: "SEAT_CONFLICT",
      conflictSeats: ["A1"],
    });
    expect(errorLogSpy).not.toHaveBeenCalled();
  });

  it("B) wrapped .cause.code === '55P03' → same SEAT_CONFLICT result", async () => {
    const { AtomicHoldService } = await import("@modules/bookings/atomicHold.service");
    const svc = new AtomicHoldService(storageMock);

    txShouldThrow = { cause: { code: "55P03" } };

    const result = await svc.atomicHold({
      tripId: "trip-1",
      seatNo: "B2",
      legIndexes: [0, 1],
      operatorId: "op-1",
      ttlClass: "short",
    });

    expect(result).toEqual({
      success: false,
      reason: "SEAT_CONFLICT",
      conflictSeats: ["B2"],
    });
    expect(errorLogSpy).not.toHaveBeenCalled();
  });

  it("C) a genuinely different DB error still falls through to TRANSACTION_ERROR and IS logged", async () => {
    const { AtomicHoldService } = await import("@modules/bookings/atomicHold.service");
    const svc = new AtomicHoldService(storageMock);

    txShouldThrow = { code: "53300" }; // too_many_connections — unrelated to seat locking

    const result = await svc.atomicHold({
      tripId: "trip-1",
      seatNo: "C3",
      legIndexes: [0],
      operatorId: "op-1",
      ttlClass: "short",
    });

    expect(result).toEqual({
      success: false,
      reason: "TRANSACTION_ERROR",
      conflictSeats: ["C3"],
    });
    expect(errorLogSpy).toHaveBeenCalledTimes(1);
  });
});
