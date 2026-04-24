/**
 * Sprint 2 / S1-09 (delivered di Sprint 2) — bukti integrasi bahwa
 * pemanggilan langsung ke service kelas TANPA konteks user yang valid
 * akan ditolak dengan PermissionDeniedError (HTTP 403).
 *
 * Cakupan 5 modul kritis:
 *   - DriversService     → flag `master.drivers`
 *   - VehiclesService    → flag `master.vehicles`
 *   - RefundsService     → flag `page.refunds` / `action.refund.*`
 *   - CashierService     → flag `page.cashier`
 *   - CargoService       → flag `action.cargo.create` / `action.cargo.manage`
 *
 * Untuk setiap service kita uji 3 skenario:
 *   1. ctx tidak ada (caller lupa pasang) → ditolak.
 *   2. ctx ada tapi flag yang dibutuhkan tidak ada → ditolak.
 *   3. ctx punya flag yang sesuai → method berjalan (storage / db
 *      di-mock supaya tidak butuh Postgres).
 *
 * Jalankan: `npx vitest run tests/sprint2-rbac-service-guards.test.ts`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PermissionDeniedError,
  type ServiceContext,
} from "@modules/rbac/rbac.guard";

// ---------- Mock @server/db (chainable, sangat tipis — guard test lebih
// peduli pada keputusan throw vs lolos, bukan SQL detail). ----------
const dbState: { selectQueue: any[]; insertQueue: any[]; updateQueue: any[]; executeQueue: any[] } = {
  selectQueue: [],
  insertQueue: [],
  updateQueue: [],
  executeQueue: [],
};
function pushSelectResult(rows: any[]) { dbState.selectQueue.push(rows); }
function pushInsertResult(row: any) { dbState.insertQueue.push(row); }
function pushExecuteResult(rows: any[]) { dbState.executeQueue.push({ rows }); }
function pushUpdateResult() { dbState.updateQueue.push(true); }

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
    returning: () => Promise.resolve([dbState.insertQueue.shift() ?? { id: "auto" }]),
    onConflictDoNothing: () => chain,
    then: (resolve: any) => Promise.resolve(dbState.insertQueue.shift() ?? []).then(resolve),
  };
  return chain;
}
function makeUpdateChain() {
  const chain: any = {
    set: () => chain,
    where: () => { dbState.updateQueue.shift(); return Promise.resolve(); },
    returning: () => Promise.resolve(dbState.updateQueue.shift() ? [{}] : []),
  };
  return chain;
}

vi.mock("@server/db", () => ({
  db: {
    select: () => makeSelectChain(),
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
    execute: async () => dbState.executeQueue.shift() ?? { rows: [] },
    transaction: async (fn: any) => fn({
      select: () => makeSelectChain(),
      insert: () => makeInsertChain(),
      update: () => makeUpdateChain(),
      execute: async () => dbState.executeQueue.shift() ?? { rows: [] },
    }),
  },
}));

vi.mock("@server/storage", () => ({
  storage: { getBookingPromoApplications: vi.fn(async () => []) },
}));
vi.mock("@server/realtime/ws", () => ({
  webSocketService: { broadcast: vi.fn(), emit: vi.fn(), emitInventoryUpdated: vi.fn() },
}));
vi.mock("@modules/holds/holdsAdapter", () => ({
  isEngineEnabled: () => false,
  HoldsAdapter: class { cancelSeats = vi.fn(async () => true); },
}));
vi.mock("@modules/bookings/atomicHold.service", () => ({
  AtomicHoldService: class { releaseHold = vi.fn(async () => true); },
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

// ---------- helper: bikin ctx test cepat ----------
function ctxWith(...flags: string[]): ServiceContext {
  return {
    flags: new Set(flags),
    outletId: null,
    roleId: "test-role",
    userId: "test-user",
    userEmail: "test@example.com",
  };
}
const EMPTY_CTX: ServiceContext = ctxWith();

// =====================================================================
// DriversService
// =====================================================================
describe("DriversService — service-layer guard (S1-09)", () => {
  function makeStorageMock() {
    return {
      getDrivers: vi.fn(async () => []),
      getDriverById: vi.fn(async () => ({ id: "d1" })),
      createDriver: vi.fn(async (d: any) => ({ id: "d-new", ...d })),
      updateDriver: vi.fn(async (id: string, d: any) => ({ id, ...d })),
      deleteDriver: vi.fn(async () => {}),
    };
  }

  it("createDriver tanpa ctx → PermissionDeniedError", async () => {
    const { DriversService } = await import("@modules/drivers/drivers.service");
    const svc = new DriversService(makeStorageMock() as any);
    await expect(svc.createDriver({} as any, undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createDriver dgn ctx tanpa flag master.drivers → ditolak", async () => {
    const { DriversService } = await import("@modules/drivers/drivers.service");
    const svc = new DriversService(makeStorageMock() as any);
    await expect(svc.createDriver({} as any, ctxWith("page.cso")))
      .rejects.toMatchObject({ statusCode: 403, requiredFlags: ["master.drivers"] });
  });

  it("createDriver dgn ctx yg punya flag master.drivers → lolos", async () => {
    const { DriversService } = await import("@modules/drivers/drivers.service");
    const storageMock = makeStorageMock();
    const svc = new DriversService(storageMock as any);
    const result = await svc.createDriver({ name: "Pak Budi" } as any, ctxWith("master.drivers"));
    expect(result).toMatchObject({ id: "d-new" });
    expect(storageMock.createDriver).toHaveBeenCalledOnce();
  });

  it("updateDriver dan deleteDriver juga butuh master.drivers", async () => {
    const { DriversService } = await import("@modules/drivers/drivers.service");
    const svc = new DriversService(makeStorageMock() as any);
    await expect(svc.updateDriver("d1", {} as any, EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.deleteDriver("d1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// =====================================================================
// VehiclesService
// =====================================================================
describe("VehiclesService — service-layer guard (S1-09)", () => {
  function makeStorageMock() {
    return {
      getVehicles: vi.fn(async () => []),
      getVehicleById: vi.fn(async () => ({ id: "v1" })),
      createVehicle: vi.fn(async (d: any) => ({ id: "v-new", ...d })),
      updateVehicle: vi.fn(async (id: string, d: any) => ({ id, ...d })),
      deleteVehicle: vi.fn(async () => {}),
    };
  }

  it("createVehicle tanpa ctx → 403", async () => {
    const { VehiclesService } = await import("@modules/vehicles/vehicles.service");
    const svc = new VehiclesService(makeStorageMock() as any);
    await expect(svc.createVehicle({} as any, undefined as any))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("createVehicle dgn flag master.vehicles → lolos", async () => {
    const { VehiclesService } = await import("@modules/vehicles/vehicles.service");
    const svc = new VehiclesService(makeStorageMock() as any);
    const result = await svc.createVehicle({ plate: "B 1234 AB" } as any, ctxWith("master.vehicles"));
    expect(result.id).toBe("v-new");
  });

  it("updateVehicle dgn ctx kosong → ditolak; deleteVehicle juga", async () => {
    const { VehiclesService } = await import("@modules/vehicles/vehicles.service");
    const svc = new VehiclesService(makeStorageMock() as any);
    await expect(svc.updateVehicle("v1", {} as any, EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.deleteVehicle("v1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// =====================================================================
// RefundsService
// =====================================================================
describe("RefundsService — service-layer guard (S1-09)", () => {
  it("getAll tanpa ctx → 403 (data finansial sensitif)", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const svc = new RefundsService();
    await expect(svc.getAll(undefined as any)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("create butuh action.refund.create", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const svc = new RefundsService();
    await expect(
      svc.create(
        { bookingId: "b1", originalAmount: "100", refundAmount: "100" } as any,
        "ops-1",
        ctxWith("page.refunds"),
      ),
    ).rejects.toMatchObject({ statusCode: 403, requiredFlags: ["action.refund.create"] });
  });

  it("approve butuh action.refund.approve, process butuh action.refund.process", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const svc = new RefundsService();
    await expect(svc.approve("r1", "ops-1", ctxWith("action.refund.create")))
      .rejects.toMatchObject({ requiredFlags: ["action.refund.approve"] });
    await expect(svc.process("r1", "ops-1", ctxWith("action.refund.create")))
      .rejects.toMatchObject({ requiredFlags: ["action.refund.process"] });
  });

  it("reject butuh action.refund.approve (sama dgn approve)", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const svc = new RefundsService();
    await expect(svc.reject("r1", "alasan", ctxWith("page.refunds")))
      .rejects.toMatchObject({ requiredFlags: ["action.refund.approve"] });
  });

  it("reject lolos kalau ctx punya action.refund.approve", async () => {
    const { RefundsService } = await import("@modules/refunds/refunds.service");
    const svc = new RefundsService();
    pushUpdateResult();
    const result = await svc.reject("r1", "alasan", ctxWith("action.refund.approve"));
    expect(result).toEqual({ success: true });
  });
});

// =====================================================================
// CashierService
// =====================================================================
describe("CashierService — service-layer guard (S1-09)", () => {
  it("openSession tanpa ctx → 403, sebelum sempat menyentuh DB", async () => {
    const { CashierService } = await import("@modules/cashier/cashier.service");
    const svc = new CashierService();
    await expect(
      svc.openSession(
        { outletId: "o1", staffId: "s1", staffName: "X", openingBalance: 0 } as any,
        undefined as any,
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("getActiveSession dan getHistory dan getDetail butuh page.cashier", async () => {
    const { CashierService } = await import("@modules/cashier/cashier.service");
    const svc = new CashierService();
    await expect(svc.getActiveSession("o1", "s1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.getHistory("o1", "s1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.getDetail("sess-1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("closeSession dan approveSession butuh page.cashier", async () => {
    const { CashierService } = await import("@modules/cashier/cashier.service");
    const svc = new CashierService();
    await expect(svc.closeSession("sess-1", [], undefined, EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.approveSession("sess-1", "ops-1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("openSession lolos guard kalau ctx punya page.cashier", async () => {
    const { CashierService } = await import("@modules/cashier/cashier.service");
    const svc = new CashierService();
    // Tidak ada existing session; insert sukses.
    pushSelectResult([]);
    pushInsertResult({ id: "sess-new", staffId: "s1", outletId: "o1" });
    const session = await svc.openSession(
      { outletId: "o1", staffId: "s1", staffName: "Alice", openingBalance: 0 } as any,
      ctxWith("page.cashier"),
    );
    expect(session.id).toBe("sess-new");
  });
});

// =====================================================================
// CargoService
// =====================================================================
describe("CargoService — service-layer guard (S1-09)", () => {
  function makeStorageMock() {
    return {
      getCargoShipments: vi.fn(async () => []),
      getCargoShipmentById: vi.fn(async () => ({ id: "c1" })),
      getCargoShipmentByWaybill: vi.fn(async () => null),
      getCargoAvailableTrips: vi.fn(async () => []),
      getTripStopTimes: vi.fn(async () => []),
      findCargoRate: vi.fn(async () => null),
      createCargoShipment: vi.fn(async (d: any) => ({ id: "c-new", waybillNumber: d.waybillNumber, ...d })),
    };
  }

  it("createShipment tanpa ctx → 403", async () => {
    const { CargoService } = await import("@modules/cargo/cargo.service");
    const svc = new CargoService(makeStorageMock() as any);
    await expect(svc.createShipment({} as any, undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createShipment dgn ctx tanpa action.cargo.create → ditolak", async () => {
    const { CargoService } = await import("@modules/cargo/cargo.service");
    const svc = new CargoService(makeStorageMock() as any);
    await expect(svc.createShipment({} as any, ctxWith("action.cargo.manage")))
      .rejects.toMatchObject({ requiredFlags: ["action.cargo.create"] });
  });

  it("updateShipment dan updateShipmentStatus butuh action.cargo.manage", async () => {
    const { CargoService } = await import("@modules/cargo/cargo.service");
    const svc = new CargoService(makeStorageMock() as any);
    await expect(svc.updateShipment("c1", {} as any, ctxWith("action.cargo.create")))
      .rejects.toMatchObject({ requiredFlags: ["action.cargo.manage"] });
    await expect(svc.updateShipmentStatus("c1", "loaded", ctxWith("action.cargo.create")))
      .rejects.toMatchObject({ requiredFlags: ["action.cargo.manage"] });
  });

  it("SYSTEM_CONTEXT memberikan semua flag (untuk caller internal eksplisit)", async () => {
    const { CargoService } = await import("@modules/cargo/cargo.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const storageMock = makeStorageMock();
    const svc = new CargoService(storageMock as any);

    // generateWaybillFromSequence → fallback ke random karena execute() return [].
    pushExecuteResult([]);

    const shipment = await svc.createShipment(
      {
        senderName: "A", senderPhone: "1", recipientName: "B", recipientPhone: "2",
        itemDescription: "x", quantity: 1, totalAmount: "0", channel: "APP",
      } as any,
      SYSTEM_CONTEXT,
    );
    expect(shipment.id).toBe("c-new");
    expect(storageMock.createCargoShipment).toHaveBeenCalledOnce();
  });
});

// =====================================================================
// PermissionDeniedError shape
// =====================================================================
describe("PermissionDeniedError", () => {
  it("punya statusCode 403 supaya Fastify errorHandler memetakan ke HTTP 403", () => {
    const err = new PermissionDeniedError(["master.drivers"]);
    expect(err.statusCode).toBe(403);
    expect(err.status).toBe(403);
    expect(err.message).toMatch(/master\.drivers/);
    expect(err.requiredFlags).toEqual(["master.drivers"]);
    expect(err.mode).toBe("all");
  });

  it("mode 'any' membuat pesan dan mode berbeda", () => {
    const err = new PermissionDeniedError(["a", "b"], "any");
    expect(err.mode).toBe("any");
    expect(err.message).toMatch(/Salah satu/);
  });
});
