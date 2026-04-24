/**
 * S2-03: Reschedule chaos test — kill engine mid-flow.
 *
 * Skenario chaos yang harus tidak diam-diam kehilangan inventori atau
 * uang:
 *
 *   A) Engine holdAndConfirmShort() FAIL sebelum tx → reschedule throw,
 *      tidak ada side-effect (tx tidak dimulai, kursi lama masih booked
 *      di engine, kursi baru tidak ter-book).
 *
 *   B) Engine holdAndConfirmShort() OK → tx FAIL → kompensasi
 *      cancelSeats(new) sukses → tidak ada enqueue (DLQ kosong).
 *
 *   C) Engine holdAndConfirmShort() OK → tx FAIL → kompensasi
 *      cancelSeats(new) JUGA FAIL → enqueueCancelSeats DIPANGGIL untuk
 *      scheduler retry (tidak silent loss).
 *
 *   D) Engine holdAndConfirmShort() OK → tx OK → cancelSeats(old) FAIL
 *      → enqueueCancelSeats DIPANGGIL untuk scheduler retry; reschedule
 *      tetap report success (tx sudah commit, tidak roll back kursi
 *      baru).
 *
 * Test pakai mock pattern yang sama dengan tests/sprint2.test.ts: mock
 * @server/db, @modules/holds/holdsAdapter, @modules/holds/compensationQueue
 * (partial via importActual).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ===== mocks =====

const selectResultsQueue: any[][] = [];
function pushSelectResult(rows: any[]) {
  selectResultsQueue.push(rows);
}
function nextSelectResult(): any[] {
  return selectResultsQueue.shift() ?? [];
}

// db.select chainable; db.transaction(cb) langsung jalanin cb dengan tx
// yang juga chainable; db.update / insert chainable.
const txWriteCallLog: string[] = [];
function buildTxObj(forceTxFail: boolean) {
  return {
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => {
          if (forceTxFail) throw new Error("CHAOS: db.transaction inner failure");
          return [{ id: "split-booking-id" }];
        },
      }),
    }),
  };
}

let txFailFlag = false;
const dbMock: any = {
  select: () => ({
    from: () => ({
      where: () => {
        const rows = nextSelectResult();
        const p: any = Promise.resolve(rows);
        // Drizzle pattern: kadang chained `.then(r => r[0])`. Mock tetap
        // return promise of rows.
        return p;
      },
    }),
  }),
  transaction: async (cb: (tx: any) => Promise<void>) => {
    const tx = buildTxObj(txFailFlag);
    await cb(tx);
  },
  update: () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: async () => [{ id: "x" }],
    }),
  }),
};

vi.mock("@server/db", () => ({ db: dbMock }));

// HoldsAdapter mock — instance methods di-spy per test.
const holdAndConfirmShortMock = vi.fn();
const cancelSeatsMock = vi.fn();
vi.mock("@modules/holds/holdsAdapter", () => ({
  HoldsAdapter: class {
    holdAndConfirmShort = holdAndConfirmShortMock;
    cancelSeats = cancelSeatsMock;
  },
  isEngineEnabled: () => true,
}));

// AtomicHoldService — constructor saja, tidak dipakai langsung.
vi.mock("@modules/bookings/atomicHold.service", () => ({
  AtomicHoldService: class {
    constructor(_s: any) {}
  },
}));

// compensationQueue partial mock (mempertahankan modul real, tapi
// override enqueueCancelSeats sebagai spy).
const enqueueCancelSeatsMock = vi.fn(async (_args: any) => "fake-id");
vi.mock("@modules/holds/compensationQueue", async () => {
  const actual = await vi.importActual<any>("@modules/holds/compensationQueue");
  return { ...actual, enqueueCancelSeats: enqueueCancelSeatsMock };
});

// websocket mock (tidak dipakai assertion, hanya supaya import tidak
// boot socket.io).
vi.mock("@server/realtime/ws", () => ({
  webSocketService: { emitInventoryUpdated: vi.fn() },
}));

// codeGenerator deterministik.
vi.mock("@server/utils/codeGenerator", () => ({
  generateBookingCode: () => "TT-CHAOS-001",
}));

// ===== fixtures =====

const passengerFix = {
  id: "p1",
  bookingId: "b1",
  ticketStatus: "active",
  seatNo: "A1",
  fareAmount: "100000",
  originSeq: 0,
  destinationSeq: 1,
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

const storageMock: any = {
  getBookingById: vi.fn(async (_id: string) => bookingFix),
  getActivePassengersForTrip: vi.fn(async () => []),
};

beforeEach(() => {
  selectResultsQueue.length = 0;
  txFailFlag = false;
  txWriteCallLog.length = 0;
  holdAndConfirmShortMock.mockReset();
  cancelSeatsMock.mockReset();
  enqueueCancelSeatsMock.mockReset();
  enqueueCancelSeatsMock.mockResolvedValue("fake-id");
  storageMock.getBookingById.mockClear();
});

// Helper: setup queue results untuk reschedulePassenger flow.
//   1) select passenger by id → [passengerFix]
//   2) select seatInventory new trip → fully available rows (sole pax = 1 row per leg)
//   3) select all passengers in booking → [passengerFix] (sole, no split)
function primeReschedulePassengerSelects() {
  // select passengers WHERE id=passengerId → array; service does .then(r => r[0])
  selectResultsQueue.push([passengerFix]);
  // select seatInventory for new trip → 1 row per leg (legIndex 0..1 = 2 rows)
  selectResultsQueue.push([
    { tripId: "trip-NEW", seatNo: "B2", legIndex: 0, booked: false, holdRef: null },
    // dest seq = 1, so legIndexes = [0]; only 1 row needed actually; pad anyway
  ]);
  // select all passengers in booking → [passengerFix] only → sole active
  selectResultsQueue.push([passengerFix]);
}

// ===== tests =====

describe("RescheduleService chaos (S2-03)", () => {
  it("A) holdAndConfirmShort FAIL pre-tx → throw, no compensation, no enqueue", async () => {
    primeReschedulePassengerSelects();
    holdAndConfirmShortMock.mockRejectedValueOnce(new Error("CHAOS: engine down (hold)"));

    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const svc = new RescheduleService(storageMock);

    await expect(
      svc.reschedulePassenger("p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "u-op", "test")
    ).rejects.toThrow(/CHAOS: engine down/);

    expect(cancelSeatsMock).not.toHaveBeenCalled();
    expect(enqueueCancelSeatsMock).not.toHaveBeenCalled();
  });

  it("B) tx FAIL + cancelSeats(new) sukses → no enqueue", async () => {
    primeReschedulePassengerSelects();
    holdAndConfirmShortMock.mockResolvedValueOnce(undefined);
    txFailFlag = true; // tx inner throw — but for sole-pax path, tx tidak insert.
    // Untuk sole-pax flow service hanya update; tx tidak akan throw via
    // forceTxFail. Force throw via custom transaction override.
    const origTx = dbMock.transaction;
    dbMock.transaction = async (_cb: any) => { throw new Error("CHAOS: tx commit fail"); };

    cancelSeatsMock.mockResolvedValueOnce(undefined); // compensation OK

    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const svc = new RescheduleService(storageMock);

    await expect(
      svc.reschedulePassenger("p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "u-op", "test")
    ).rejects.toThrow(/tx commit fail/);

    expect(cancelSeatsMock).toHaveBeenCalledTimes(1);
    expect(cancelSeatsMock.mock.calls[0][0]).toMatchObject({ tripId: "trip-NEW", seatNo: "B2" });
    expect(enqueueCancelSeatsMock).not.toHaveBeenCalled();

    dbMock.transaction = origTx; // restore
  });

  it("C) tx FAIL + cancelSeats(new) JUGA FAIL → enqueue DLQ (no silent loss)", async () => {
    primeReschedulePassengerSelects();
    holdAndConfirmShortMock.mockResolvedValueOnce(undefined);

    const origTx = dbMock.transaction;
    dbMock.transaction = async (_cb: any) => { throw new Error("CHAOS: tx commit fail"); };
    cancelSeatsMock.mockRejectedValueOnce(new Error("CHAOS: compensation cancelSeats also down"));

    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const svc = new RescheduleService(storageMock);

    await expect(
      svc.reschedulePassenger("p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "u-op", "test")
    ).rejects.toThrow(/tx commit fail/);

    expect(cancelSeatsMock).toHaveBeenCalledTimes(1);
    expect(enqueueCancelSeatsMock).toHaveBeenCalledTimes(1);
    expect(enqueueCancelSeatsMock.mock.calls[0][0]).toMatchObject({
      tripId: "trip-NEW",
      seatNo: "B2",
      context: expect.objectContaining({
        source: "reschedulePassenger.compensation",
        passengerId: "p1",
      }),
    });

    dbMock.transaction = origTx;
  });

  it("D) tx OK + cancelSeats(old) FAIL → enqueue DLQ untuk OLD seat, success tetap return", async () => {
    primeReschedulePassengerSelects();
    holdAndConfirmShortMock.mockResolvedValueOnce(undefined); // book new OK
    // tx commit succeeds (default path).
    cancelSeatsMock.mockRejectedValueOnce(new Error("CHAOS: cancel old seat down"));

    storageMock.getBookingById
      .mockResolvedValueOnce(bookingFix) // first call inside reschedule
      .mockResolvedValueOnce(bookingFix); // final lookup for return value

    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const svc = new RescheduleService(storageMock);

    const result = await svc.reschedulePassenger(
      "p1", "trip-NEW", "B2", "S0", "S1", 0, 1, "u-op", "test"
    );

    expect(result.success).toBe(true);
    // cancelSeats dipanggil sekali untuk OLD seat (satu-satunya call setelah
    // tx OK).
    expect(cancelSeatsMock).toHaveBeenCalledTimes(1);
    expect(cancelSeatsMock.mock.calls[0][0]).toMatchObject({
      tripId: "trip-OLD",
      seatNo: "A1",
    });
    // Kompensasi gagal → enqueue dipanggil dengan source cancelOld.
    expect(enqueueCancelSeatsMock).toHaveBeenCalledTimes(1);
    expect(enqueueCancelSeatsMock.mock.calls[0][0]).toMatchObject({
      tripId: "trip-OLD",
      seatNo: "A1",
      context: expect.objectContaining({
        source: "reschedulePassenger.cancelOld",
      }),
    });
  });
});
