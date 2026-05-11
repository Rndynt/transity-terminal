/**
 * S1-01 follow-up — race-condition refund: dua approve paralel hanya boleh
 * memicu satu pelepasan kursi. Compare-and-swap di
 * `RefundsService.approve` (UPDATE refunds ... WHERE status='pending')
 * yang menjamin atomicity di DB asli; di test ini kita simulasikan dengan
 * mock execute() yang mengembalikan satu row untuk pemenang dan kosong
 * untuk peserta yang kalah.
 *
 * Yang diuji:
 *   1. Loser path murni: kalau CAS dalam transaction kembali kosong (ada
 *      writer lain yang sudah duluan), approve() balas idempotent dan
 *      TIDAK melakukan side-effect (tidak ada WS broadcast, tidak ada
 *      passenger update tambahan).
 *   2. Winner path penuh: CAS dapat row → passenger di-update, booking
 *      ditandai refunded saat semua passenger inactive, dan
 *      `emitInventoryUpdated` dipanggil tepat sekali per kursi.
 *   3. Pemanggilan dua approve() bersamaan via Promise.all menghasilkan
 *      tepat satu winner (releasedSeats=1) dan satu loser (idempotent),
 *      dengan WS event tepat satu kali.
 *
 * Jalankan: `npx vitest run tests/refund-race.test.ts`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mock @server/db (chainable) ----------
type Queues = {
  selectQueue: any[];
  insertQueue: any[];
  updateQueue: number;
  executeQueue: any[];
};
const dbState: Queues = {
  selectQueue: [],
  insertQueue: [],
  updateQueue: 0,
  executeQueue: [],
};

function pushSelect(rows: any[]) { dbState.selectQueue.push(rows); }
function pushExecute(rows: any[]) { dbState.executeQueue.push(rows); }

function makeSelectChain() {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    orderBy: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    then: (resolve: any) => {
      const next = dbState.selectQueue.shift() ?? [];
      return Promise.resolve(next).then(resolve);
    },
  };
  return chain;
}

function makeInsertChain() {
  const chain: any = {
    values: () => chain,
    returning: () => Promise.resolve(dbState.insertQueue.shift() ? [dbState.insertQueue.shift()] : []),
  };
  return chain;
}

function makeUpdateChain() {
  const chain: any = {
    set: () => chain,
    where: () => {
      dbState.updateQueue++;
      return Promise.resolve();
    },
  };
  return chain;
}

function makeTx() {
  return {
    select: () => makeSelectChain(),
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
    execute: async () => dbState.executeQueue.shift() ?? [],
  };
}

vi.mock("@server/db", () => ({
  db: {
    select: () => makeSelectChain(),
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
    execute: async () => dbState.executeQueue.shift() ?? [],
    transaction: async (fn: any) => fn(makeTx()),
  },
}));

// ---------- Mock dependencies of RefundsService ----------
vi.mock("@server/storage", () => ({
  storage: {
    getBookingPromoApplications: vi.fn(async () => []),
  },
}));
const wsMock = {
  broadcast: vi.fn(),
  emit: vi.fn(),
  emitInventoryUpdated: vi.fn(),
  emitHoldsReleased: vi.fn(),
};
vi.mock("@server/realtime/ws", () => ({ webSocketService: wsMock }));
vi.mock("@modules/holds/holdsAdapter", () => ({
  isEngineEnabled: () => false, // legacy mode → seat release inline + WS emit manual
  HoldsAdapter: class {
    cancelSeats = vi.fn(async () => true);
  },
}));
vi.mock("@modules/bookings/atomicHold.service", () => ({
  AtomicHoldService: class {
    releaseHold = vi.fn(async () => true);
  },
}));
vi.mock("@modules/holds/compensationQueue", () => ({
  enqueueCancelSeats: vi.fn(async () => true),
}));

beforeEach(() => {
  dbState.selectQueue = [];
  dbState.insertQueue = [];
  dbState.updateQueue = 0;
  dbState.executeQueue = [];
  wsMock.emitInventoryUpdated.mockClear();
  wsMock.broadcast.mockClear();
  wsMock.emit.mockClear();
});

// Helper: queue pre-flight selects + winner-only post-CAS selects.
function queuePreflightFor(opts: {
  refunds: number; // banyak panggilan approve() yang akan kita simulasikan
}) {
  const refundRow = { id: "r1", status: "pending", bookingId: "b1", passengerId: "p1" };
  const bookingRow = { id: "b1", tripId: "t1", originSeq: 0, destinationSeq: 1, status: "confirmed" };
  const tripRow = { id: "t1", status: "scheduled" };
  const passengerRow = { id: "p1", seatNo: "1A", ticketStatus: "confirmed" };

  for (let i = 0; i < opts.refunds; i++) pushSelect([refundRow]);
  for (let i = 0; i < opts.refunds; i++) pushSelect([bookingRow]);
  for (let i = 0; i < opts.refunds; i++) pushSelect([tripRow]);
  for (let i = 0; i < opts.refunds; i++) pushSelect([passengerRow]);
}

// =====================================================================
describe("RefundsService.approve race condition (S1-01 follow-up)", () => {
  it("loser path: CAS dalam tx kembali kosong → idempotent tanpa side-effect", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RefundsService();

    queuePreflightFor({ refunds: 1 });
    // CAS execute → kosong (winner lain sudah duluan finalize).
    pushExecute([]);

    const result = await svc.approve("r1", "staff-loser", SYSTEM_CONTEXT);

    expect(result).toEqual({ success: true, idempotent: true, releasedSeats: 0 });
    // Pastikan TIDAK ada side-effect publik: WS inventory tidak di-emit,
    // dan tidak ada update tambahan (passenger/booking) yang dieksekusi.
    expect(wsMock.emitInventoryUpdated).not.toHaveBeenCalled();
    expect(dbState.updateQueue).toBe(0);
  });

  it("winner path: CAS dapat row → passenger di-update + WS emit kursi", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RefundsService();

    queuePreflightFor({ refunds: 1 });
    // CAS won
    pushExecute([{ id: "r1" }]);
    // Setelah CAS won + per-passenger updates, refunds.service select ulang
    // semua passenger di booking → semua sudah refunded → allInactive=true.
    pushSelect([{ id: "p1", seatNo: "1A", ticketStatus: "refunded" }]);
    // bookingPromoApplications → kosong (skip promo decrement).
    pushSelect([]);

    const result = await svc.approve("r1", "staff-winner", SYSTEM_CONTEXT);

    expect(result.success).toBe(true);
    expect((result as any).releasedSeats).toBe(1);
    expect((result as any).bookingRefunded).toBe(true);
    // Legacy mode: emit manual sekali per passenger berkursi.
    expect(wsMock.emitInventoryUpdated).toHaveBeenCalledTimes(1);
    expect(wsMock.emitInventoryUpdated).toHaveBeenCalledWith("t1", "1A", [0]);
  });

  it("dua approve paralel: hanya satu yang melepas kursi, satunya idempotent", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RefundsService();

    // Pre-flight selects untuk DUA panggilan paralel: keduanya melihat
    // refund.status='pending' (race window sebelum CAS).
    queuePreflightFor({ refunds: 2 });
    // CAS executes: yang pertama menang, kedua kalah. Karena Promise.all
    // menjalankan kedua approve secara bergantian per await, urutan
    // konsumsi executeQueue adalah deterministic: panggilan pertama yang
    // sampai ke tx.execute() menang.
    pushExecute([{ id: "r1" }]); // winner
    pushExecute([]);              // loser
    // Setelah CAS won, winner butuh 2 select tambahan (allPassengers + promoApps).
    pushSelect([{ id: "p1", seatNo: "1A", ticketStatus: "refunded" }]);
    pushSelect([]);

    const [a, b] = await Promise.all([
      svc.approve("r1", "staff-A", SYSTEM_CONTEXT),
      svc.approve("r1", "staff-B", SYSTEM_CONTEXT),
    ]);

    const winner = (a as any).idempotent ? b : a;
    const loser = (a as any).idempotent ? a : b;

    expect((winner as any).releasedSeats).toBe(1);
    expect((winner as any).bookingRefunded).toBe(true);
    expect(loser).toEqual({ success: true, idempotent: true, releasedSeats: 0 });

    // WS event keluar tepat sekali — bukti loser tidak melepas kursi lagi.
    expect(wsMock.emitInventoryUpdated).toHaveBeenCalledTimes(1);
    expect(wsMock.emitInventoryUpdated).toHaveBeenCalledWith("t1", "1A", [0]);
  });

  it("approve() pre-flight: status sudah 'approved' → idempotent (tidak masuk tx sama sekali)", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RefundsService();

    pushSelect([{ id: "r1", status: "approved", bookingId: "b1", passengerId: "p1" }]);

    const result = await svc.approve("r1", "staff-late", SYSTEM_CONTEXT);
    expect(result).toEqual({ success: true, idempotent: true });
    // Tidak menyentuh execute/CAS/WS.
    expect(dbState.executeQueue.length).toBe(0);
    expect(wsMock.emitInventoryUpdated).not.toHaveBeenCalled();
  });
});
