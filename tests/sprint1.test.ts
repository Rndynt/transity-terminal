/**
 * Sprint 1 (STOP THE BLEED) — unit tests untuk S1-01 (refunds.approve) dan
 * S1-02 (cashier multi-staff).
 *
 * Jalankan: `npx vitest run tests/sprint1.test.ts`
 *
 * Strategi: db dan storage di-mock supaya kita bisa test logika tanpa
 * connect ke DB real. Mock di-reset per test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mock @server/db (chainable query builder) ----------
type ChainResolver = (state: { table?: any; where?: any; values?: any; set?: any }) => any;

const dbState: {
  selectQueue: any[];
  insertQueue: any[];
  updateQueue: any[];
  executeQueue: any[];
} = { selectQueue: [], insertQueue: [], updateQueue: [], executeQueue: [] };

function pushSelectResult(rows: any[]) { dbState.selectQueue.push(rows); }
function pushInsertResult(row: any | { error: any }) { dbState.insertQueue.push(row); }
function pushExecuteResult(rows: any[]) { dbState.executeQueue.push(rows); }
function pushUpdateResult() { dbState.updateQueue.push(true); }

function makeSelectChain() {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    orderBy: () => chain,
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
    returning: () => {
      const next = dbState.insertQueue.shift();
      if (next && typeof next === 'object' && 'error' in next) {
        return Promise.reject((next as any).error);
      }
      return Promise.resolve(next ? [next] : []);
    },
  };
  return chain;
}

function makeUpdateChain() {
  const chain: any = {
    set: () => chain,
    where: () => {
      dbState.updateQueue.shift();
      return Promise.resolve();
    },
  };
  return chain;
}

vi.mock("@server/db", () => ({
  db: {
    select: () => makeSelectChain(),
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
    execute: async () => dbState.executeQueue.shift() ?? [],
    transaction: async (fn: any) => fn({
      select: () => makeSelectChain(),
      insert: () => makeInsertChain(),
      update: () => makeUpdateChain(),
      execute: async () => dbState.executeQueue.shift() ?? [],
    }),
  },
}));

// ---------- Mock dependent modules untuk RefundsService ----------
vi.mock("@server/storage", () => ({
  storage: {
    getBookingPromoApplications: vi.fn(async () => []),
  },
}));
vi.mock("@server/realtime/ws", () => ({
  webSocketService: { broadcast: vi.fn(), emit: vi.fn() },
}));
vi.mock("@modules/holds/holdsAdapter", () => ({
  isEngineEnabled: () => false,
  HoldsAdapter: {
    cancelSeats: vi.fn(async () => true),
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
  dbState.updateQueue = [];
  dbState.executeQueue = [];
});

// =====================================================================
// S1-02: CashierService — multi-staff per outlet
// =====================================================================
describe("CashierService (S1-02)", () => {
  it("openSession menolak ketika staffId kosong", async () => {
    const { CashierService } = await import("@modules/cashier/cashier.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new CashierService();
    await expect(
      svc.openSession(
        { outletId: "outlet-1", staffId: "", staffName: "X", openingBalance: 0 } as any,
        SYSTEM_CONTEXT,
      ),
    ).rejects.toThrow(/staffId/i);
  });

  it("openSession memetakan PG 23505 menjadi error race-condition yang user-friendly", async () => {
    const { CashierService } = await import("@modules/cashier/cashier.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new CashierService();
    // Pertama: select existing → kosong (boleh insert).
    pushSelectResult([]);
    // Kedua: insert melempar 23505 (race condition antara dua request paralel).
    const pgErr: any = new Error("duplicate key value violates unique constraint");
    pgErr.code = "23505";
    pushInsertResult({ error: pgErr });

    await expect(
      svc.openSession(
        {
          outletId: "outlet-1",
          staffId: "staff-1",
          staffName: "Alice",
          openingBalance: 100000,
        } as any,
        SYSTEM_CONTEXT,
      ),
    ).rejects.toThrow(/sudah dibuka|paralel/i);
  });

  it("openSession menolak ketika staff sudah punya sesi open di outlet ini", async () => {
    const { CashierService } = await import("@modules/cashier/cashier.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new CashierService();
    pushSelectResult([{ id: "session-existing", status: "open" }]);

    await expect(
      svc.openSession(
        {
          outletId: "outlet-1",
          staffId: "staff-1",
          staffName: "Alice",
          openingBalance: 100000,
        } as any,
        SYSTEM_CONTEXT,
      ),
    ).rejects.toThrow(/sesi kasir aktif/i);
  });
});

// =====================================================================
// S1-01: RefundsService.approve — idempotent, trip-closed guard
// =====================================================================
describe("RefundsService.approve (S1-01)", () => {
  it("idempotent: refund yang sudah approved tidak dieksekusi ulang", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RefundsService();
    pushSelectResult([{ id: "r1", status: "approved", bookingId: "b1", passengerId: null }]);

    const result = await svc.approve("r1", "staff-1", SYSTEM_CONTEXT);
    expect(result).toEqual({ success: true, idempotent: true });
  });

  it("menolak refund jika trip sudah closed (departed)", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new RefundsService();
    // 1) refunds query
    pushSelectResult([{ id: "r1", status: "pending", bookingId: "b1", passengerId: null }]);
    // 2) bookings query
    pushSelectResult([{ id: "b1", tripId: "t1", status: "confirmed" }]);
    // 3) trips query — closed
    pushSelectResult([{ id: "t1", status: "closed" }]);

    await expect(svc.approve("r1", "staff-1", SYSTEM_CONTEXT)).rejects.toThrow(/closed|berangkat/i);
  });
});
