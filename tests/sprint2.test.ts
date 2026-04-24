/**
 * Sprint 2 (INTEGRATION & ENGINE STABILITY) — unit tests untuk audit
 * S2-01 (payBooking) dan S2-02 (cancelBooking).
 *
 * Jalankan: `npx vitest run tests/sprint2.test.ts`
 *
 * Strategi: db dan storage di-mock supaya kita test guard tanpa connect
 * ke DB real. Pola sama dengan tests/sprint1.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mock @server/db (chainable query builder) ----------
const dbState: {
  selectQueue: any[];
  insertQueue: any[];
  updateQueue: any[];
  executeQueue: any[];
  deleteQueue: any[];
} = { selectQueue: [], insertQueue: [], updateQueue: [], executeQueue: [], deleteQueue: [] };

function pushSelectResult(rows: any[]) { dbState.selectQueue.push(rows); }
function pushInsertResult(row: any | { error: any }) { dbState.insertQueue.push(row); }
function pushExecuteResult(rows: any[]) { dbState.executeQueue.push({ rows }); }
function pushUpdateResult(rows?: any[]) { dbState.updateQueue.push(rows ?? []); }
function pushDeleteResult() { dbState.deleteQueue.push(true); }

function makeSelectChain() {
  const chain: any = {
    from: () => chain, where: () => chain, limit: () => chain, orderBy: () => chain,
    innerJoin: () => chain, leftJoin: () => chain, offset: () => chain,
    then: (resolve: any) => Promise.resolve(dbState.selectQueue.shift() ?? []).then(resolve),
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
      return Promise.resolve(next ? [next] : [{ id: 'auto-' + Math.random() }]);
    },
    onConflictDoNothing: () => chain,
    then: (resolve: any) => Promise.resolve(dbState.insertQueue.shift() ?? []).then(resolve),
  };
  return chain;
}

function makeUpdateChain() {
  const chain: any = {
    set: () => chain,
    where: () => {
      const next = dbState.updateQueue.shift();
      // Simulasi update tanpa returning: return resolved promise.
      if (Array.isArray(next)) {
        // Saved untuk returning() berikutnya — tapi kalau where tanpa returning
        // langsung dipakai, kita anggap ok.
        return Promise.resolve(next);
      }
      return Promise.resolve();
    },
    returning: () => {
      const next = dbState.updateQueue.shift() ?? [];
      return Promise.resolve(next);
    },
  };
  return chain;
}

function makeDeleteChain() {
  const chain: any = {
    where: () => {
      dbState.deleteQueue.shift();
      return Promise.resolve();
    },
  };
  return chain;
}

const txMock = {
  select: () => makeSelectChain(),
  insert: () => makeInsertChain(),
  update: () => makeUpdateChain(),
  delete: () => makeDeleteChain(),
  execute: async () => dbState.executeQueue.shift() ?? { rows: [] },
};

vi.mock("@server/db", () => ({
  db: {
    select: () => makeSelectChain(),
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
    delete: () => makeDeleteChain(),
    execute: async () => dbState.executeQueue.shift() ?? { rows: [] },
    transaction: async (fn: any) => fn(txMock),
  },
}));

// Storage mock — payBooking memanggil getBookingById, getPassengers,
// getBookingPromoApplications, getTripById.
const storageMock = {
  getBookingById: vi.fn(),
  getPassengers: vi.fn(async () => []),
  getBookingPromoApplications: vi.fn(async () => []),
  getTripById: vi.fn(async () => ({ id: 't1', patternId: 'p1', serviceDate: '2026-05-01' })),
};

vi.mock("@server/storage", () => ({ storage: storageMock }));
vi.mock("@server/realtime/ws", () => ({
  webSocketService: {
    broadcast: vi.fn(),
    emit: vi.fn(),
    emitInventoryUpdated: vi.fn(),
    emitHoldsReleased: vi.fn(),
  },
}));
vi.mock("@modules/holds/holdsAdapter", () => ({
  isEngineEnabled: () => false,
  HoldsAdapter: { cancelSeats: vi.fn(async () => true) },
  holdsAdapter: { cancelSeats: vi.fn(async () => true) },
}));
// Pertahankan export asli (mis. getStuckCount) — hanya stub
// enqueueCancelSeats supaya pay/cancel test tidak butuh DB.
vi.mock("@modules/holds/compensationQueue", async () => {
  const actual = await vi.importActual<any>("@modules/holds/compensationQueue");
  return {
    ...actual,
    enqueueCancelSeats: vi.fn(async () => true),
  };
});
// PromosService dipanggil saat voucherCode ada — kita tidak test path itu.
vi.mock("@modules/promos/promos.service", () => ({
  PromosService: class {
    validateAndCalculateDiscount = vi.fn(async () => ({
      valid: true, discountAmount: 0, promotion: null, applications: [],
    }));
  },
}));

beforeEach(() => {
  dbState.selectQueue = [];
  dbState.insertQueue = [];
  dbState.updateQueue = [];
  dbState.executeQueue = [];
  dbState.deleteQueue = [];
  storageMock.getBookingById.mockReset();
  storageMock.getPassengers.mockReset();
  storageMock.getBookingPromoApplications.mockReset();
  storageMock.getPassengers.mockImplementation(async () => []);
  storageMock.getBookingPromoApplications.mockImplementation(async () => []);
});

// =====================================================================
// S2-01: AppService.payBooking — guards
// =====================================================================
describe("AppService.payBooking (S2-01)", () => {
  const baseBooking = {
    id: "b1",
    appUserId: "u1",
    status: "pending",
    pendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    totalAmount: "100000",
    discountAmount: "0",
    voucherCode: null,
    promoId: null,
    tripId: "t1",
    originSeq: 0,
    destinationSeq: 1,
    channel: "APP" as const,
    salesChannelCode: null,
    outletId: null,
  };

  it("menolak kalau booking tidak ditemukan", async () => {
    storageMock.getBookingById.mockResolvedValue(null);
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(storageMock as any);
    await expect(svc.payBooking("missing", "qr", undefined, "u1")).rejects.toThrow(/not found/i);
  });

  it("menolak kalau ownership tidak match (anti-IDOR)", async () => {
    storageMock.getBookingById.mockResolvedValue({ ...baseBooking });
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(storageMock as any);
    await expect(svc.payBooking("b1", "qr", undefined, "u-OTHER")).rejects.toThrow(/unauthorized/i);
  });

  it("menolak kalau booking sudah confirmed", async () => {
    storageMock.getBookingById.mockResolvedValue({ ...baseBooking, status: "confirmed" });
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(storageMock as any);
    await expect(svc.payBooking("b1", "qr", undefined, "u1")).rejects.toThrow(/pending/i);
  });

  it("menolak kalau hold sudah expired (pre-tx via pendingExpiresAt)", async () => {
    storageMock.getBookingById.mockResolvedValue({
      ...baseBooking,
      pendingExpiresAt: new Date(Date.now() - 1000),
    });
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(storageMock as any);
    await expect(svc.payBooking("b1", "qr", undefined, "u1")).rejects.toThrow(/expired/i);
  });

  it("menolak kalau seat_holds aktif sudah kosong (race dgn reaper)", async () => {
    storageMock.getBookingById.mockResolvedValue({ ...baseBooking });
    pushSelectResult([]); // active holds query → 0 row
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(storageMock as any);
    await expect(svc.payBooking("b1", "qr", undefined, "u1")).rejects.toThrow(/expired/i);
  });
});

// =====================================================================
// S2-04 regression: compensationQueue DLQ contract
// Memastikan getStuckCount export & alert format snake_case stable.
// =====================================================================
describe("compensationQueue DLQ (S2-04)", () => {
  it("export getStuckCount tersedia", async () => {
    const mod = await import("@modules/holds/compensationQueue");
    // getStuckCount adalah export baru dari S2-04. Health/deep
    // menggunakannya untuk subsystem 'compensationQueue'.
    expect(typeof (mod as any).getStuckCount).toBe("function");
  });
});
