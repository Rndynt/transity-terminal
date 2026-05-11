/**
 * Task #6 (Sprint 2) — perluasan service-layer RBAC guard ke modul
 * operator inti yang belum tersentuh oleh test S1-09:
 *
 *   - BookingsService     → action.booking.create / action.booking.cancel
 *   - RoundTripService    → action.booking.create
 *   - RescheduleService   → action.passenger.reschedule /
 *                           action.trip.batch_reschedule
 *   - UnseatService       → action.passenger.unseat /
 *                           action.passenger.assign_seat
 *   - PaymentsService     → action.payment.create
 *   - PromosService       → master.promos
 *   - OutletsService      → master.outlets
 *   - PriceRulesService   → master.price_rules
 *   - TripPatternsService → master.trip_patterns
 *
 * Pola test sama dengan tests/sprint2-rbac-service-guards.test.ts:
 * tiga skenario (no ctx / ctx tanpa flag / ctx dengan flag) per method
 * sensitif. Untuk method yang menyentuh DB / WS / engine, kita mock
 * dependensi-nya supaya guard test fokus ke keputusan throw vs lolos.
 *
 * Jalankan: `npx vitest run tests/sprint2-rbac-service-guards-extended.test.ts`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PermissionDeniedError,
  type ServiceContext,
} from "@modules/rbac/rbac.guard";

// ---------- Mock @server/db ringan (chainable) ----------
const dbState: { selectQueue: any[]; insertQueue: any[]; updateQueue: any[]; executeQueue: any[] } = {
  selectQueue: [],
  insertQueue: [],
  updateQueue: [],
  executeQueue: [],
};
function pushSelectResult(rows: any[]) { dbState.selectQueue.push(rows); }
function pushInsertResult(row: any) { dbState.insertQueue.push(row); }

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
    delete: () => ({ where: () => Promise.resolve() }),
    execute: async () => dbState.executeQueue.shift() ?? { rows: [] },
    transaction: async (fn: any) => fn({
      select: () => makeSelectChain(),
      insert: () => makeInsertChain(),
      update: () => makeUpdateChain(),
      delete: () => ({ where: () => Promise.resolve() }),
      execute: async () => dbState.executeQueue.shift() ?? { rows: [] },
    }),
  },
}));

vi.mock("@server/realtime/ws", () => ({
  webSocketService: {
    broadcast: vi.fn(),
    emit: vi.fn(),
    emitInventoryUpdated: vi.fn(),
    emitToTrip: vi.fn(),
  },
}));
vi.mock("@modules/holds/holdsAdapter", () => ({
  isEngineEnabled: () => false,
  HoldsAdapter: class { cancelSeats = vi.fn(async () => true); holdAndConfirmShort = vi.fn(async () => true); release = vi.fn(async () => true); },
}));
vi.mock("@modules/bookings/atomicHold.service", () => ({
  AtomicHoldService: class { releaseHold = vi.fn(async () => true); confirmSeatsBookedAtomic = vi.fn(async () => true); },
}));
vi.mock("@modules/holds/compensationQueue", () => ({
  enqueueCancelSeats: vi.fn(async () => true),
  runOnce: vi.fn(async () => ({ attempted: 0, succeeded: 0 })),
}));

beforeEach(() => {
  dbState.selectQueue = [];
  dbState.insertQueue = [];
  dbState.updateQueue = [];
  dbState.executeQueue = [];
});

// ---------- helper: ctx test ----------
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
// OutletsService
// =====================================================================
describe("OutletsService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getOutlets: vi.fn(async () => []),
      getOutletById: vi.fn(async () => ({ id: "o1", name: "Existing" })),
      createOutlet: vi.fn(async (d: any) => ({ id: "o-new", ...d })),
      updateOutlet: vi.fn(async (id: string, d: any) => ({ id, ...d })),
      deleteOutlet: vi.fn(async () => {}),
    };
  }

  it("createOutlet tanpa ctx → 403", async () => {
    const { OutletsService } = await import("@modules/outlets/outlets.service");
    const svc = new OutletsService(makeStorage() as any);
    await expect(svc.createOutlet({} as any, undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createOutlet dgn ctx tanpa master.outlets → ditolak", async () => {
    const { OutletsService } = await import("@modules/outlets/outlets.service");
    const svc = new OutletsService(makeStorage() as any);
    await expect(svc.createOutlet({} as any, ctxWith("master.drivers")))
      .rejects.toMatchObject({ statusCode: 403, requiredFlags: ["master.outlets"] });
  });

  it("createOutlet dgn flag master.outlets → lolos", async () => {
    const { OutletsService } = await import("@modules/outlets/outlets.service");
    const storage = makeStorage();
    const svc = new OutletsService(storage as any);
    const r = await svc.createOutlet({ name: "Outlet Baru" } as any, ctxWith("master.outlets"));
    expect(r).toMatchObject({ id: "o-new" });
    expect(storage.createOutlet).toHaveBeenCalledOnce();
  });

  it("update & delete butuh master.outlets", async () => {
    const { OutletsService } = await import("@modules/outlets/outlets.service");
    const svc = new OutletsService(makeStorage() as any);
    await expect(svc.updateOutlet("o1", {} as any, EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.deleteOutlet("o1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// =====================================================================
// PriceRulesService
// =====================================================================
describe("PriceRulesService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getPriceRules: vi.fn(async () => []),
      createPriceRule: vi.fn(async (d: any) => ({ id: "pr-new", ...d })),
      updatePriceRule: vi.fn(async (id: string, d: any) => ({ id, ...d })),
      deletePriceRule: vi.fn(async () => {}),
    };
  }

  it("create / update / delete tanpa flag master.price_rules → 403", async () => {
    const { PriceRulesService } = await import("@modules/priceRules/priceRules.service");
    const svc = new PriceRulesService(makeStorage() as any);
    await expect(svc.createPriceRule({} as any, undefined as any)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.updatePriceRule("p1", {} as any, ctxWith("master.outlets"))).rejects.toMatchObject({
      requiredFlags: ["master.price_rules"],
    });
    await expect(svc.deletePriceRule("p1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createPriceRule dgn flag master.price_rules → lolos", async () => {
    const { PriceRulesService } = await import("@modules/priceRules/priceRules.service");
    const storage = makeStorage();
    const svc = new PriceRulesService(storage as any);
    const r = await svc.createPriceRule({ name: "PR Test" } as any, ctxWith("master.price_rules"));
    expect(r).toMatchObject({ id: "pr-new" });
    expect(storage.createPriceRule).toHaveBeenCalledOnce();
  });
});

// =====================================================================
// TripPatternsService
// =====================================================================
describe("TripPatternsService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getTripPatterns: vi.fn(async () => []),
      getTripPatternById: vi.fn(async () => ({ id: "tp1" })),
      createTripPattern: vi.fn(async (d: any) => ({ id: "tp-new", ...d })),
      updateTripPattern: vi.fn(async (id: string, d: any) => ({ id, ...d })),
      deleteTripPattern: vi.fn(async () => {}),
      getPatternStops: vi.fn(async () => []),
      getActiveTripsForPattern: vi.fn(async () => 0),
      getActiveBookingCountForPattern: vi.fn(async () => 0),
    };
  }

  it("create tanpa ctx → 403; ctx tanpa flag → ditolak; dgn flag → lolos", async () => {
    const { TripPatternsService } = await import("@modules/tripPatterns/tripPatterns.service");
    const storage = makeStorage();
    const svc = new TripPatternsService(storage as any);

    await expect(svc.createTripPattern({} as any, undefined as any)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.createTripPattern({} as any, ctxWith("master.outlets"))).rejects.toMatchObject({
      requiredFlags: ["master.trip_patterns"],
    });

    const r = await svc.createTripPattern({ name: "Pattern X" } as any, ctxWith("master.trip_patterns"));
    expect(r.id).toBe("tp-new");
  });

  it("update & delete butuh master.trip_patterns", async () => {
    const { TripPatternsService } = await import("@modules/tripPatterns/tripPatterns.service");
    const svc = new TripPatternsService(makeStorage() as any);
    await expect(svc.updateTripPattern("tp1", {} as any, EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.deleteTripPattern("tp1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// =====================================================================
// PaymentsService
// =====================================================================
describe("PaymentsService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getPayments: vi.fn(async () => []),
      createPayment: vi.fn(async (d: any) => ({ id: "pay-new", ...d })),
    };
  }

  it("createPayment tanpa ctx → 403", async () => {
    const { PaymentsService } = await import("@modules/payments/payments.service");
    const svc = new PaymentsService(makeStorage() as any);
    await expect(svc.createPayment({} as any, undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createPayment dgn ctx tanpa flag → ditolak dgn requiredFlags action.payment.create", async () => {
    const { PaymentsService } = await import("@modules/payments/payments.service");
    const svc = new PaymentsService(makeStorage() as any);
    await expect(svc.createPayment({} as any, ctxWith("page.cashier"))).rejects.toMatchObject({
      statusCode: 403,
      requiredFlags: ["action.payment.create"],
    });
  });

  it("createPayment dgn flag action.payment.create → lolos", async () => {
    const { PaymentsService } = await import("@modules/payments/payments.service");
    const storage = makeStorage();
    const svc = new PaymentsService(storage as any);
    const r = await svc.createPayment({ bookingId: "b1", method: "cash", amount: "100" } as any, ctxWith("action.payment.create"));
    expect(r.id).toBe("pay-new");
    expect(storage.createPayment).toHaveBeenCalledOnce();
  });
});

// =====================================================================
// PromosService
// =====================================================================
describe("PromosService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getAllPromotions: vi.fn(async () => []),
      getPromotionById: vi.fn(async () => ({ id: "promo1" })),
      getPromotionByCode: vi.fn(async () => null),
      createPromotion: vi.fn(async (d: any) => ({ id: "promo-new", ...d })),
      updatePromotion: vi.fn(async (id: string, d: any) => ({ id, ...d })),
      deletePromotion: vi.fn(async () => {}),
      getPromoConditions: vi.fn(async () => []),
      replacePromoConditions: vi.fn(async () => []),
      getVouchers: vi.fn(async () => []),
      getVoucherByCode: vi.fn(async () => null),
      createVoucher: vi.fn(async (v: any) => ({ id: "vch", ...v })),
      updateVoucher: vi.fn(async (id: string, v: any) => ({ id, ...v })),
      deleteVoucher: vi.fn(async () => {}),
    };
  }

  it("createPromotion / updatePromotion / deletePromotion tanpa flag → 403", async () => {
    const { PromosService } = await import("@modules/promos/promos.service");
    const svc = new PromosService(makeStorage() as any);
    await expect(svc.createPromotion({ code: "X" } as any, undefined as any)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.updatePromotion("p1", {} as any, ctxWith("master.outlets"))).rejects.toMatchObject({
      requiredFlags: ["master.promos"],
    });
    await expect(svc.deletePromotion("p1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createPromotion dgn master.promos → lolos", async () => {
    const { PromosService } = await import("@modules/promos/promos.service");
    const storage = makeStorage();
    const svc = new PromosService(storage as any);
    const r = await svc.createPromotion({ code: "DISKON10", name: "Disc" } as any, ctxWith("master.promos"));
    expect(r.id).toBe("promo-new");
    expect(storage.createPromotion).toHaveBeenCalledOnce();
  });

  it("replaceConditions / generateVouchers / revokeVoucher / deleteVoucher butuh master.promos", async () => {
    const { PromosService } = await import("@modules/promos/promos.service");
    const svc = new PromosService(makeStorage() as any);
    await expect(svc.replaceConditions("p1", [], EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.generateVouchers("p1", 5, undefined, undefined, EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.revokeVoucher("v1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.deleteVoucher("v1", EMPTY_CTX)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// =====================================================================
// BookingsService
// =====================================================================
describe("BookingsService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getBookingById: vi.fn(async () => ({ id: "b1", status: "pending" })),
      getPassengers: vi.fn(async () => []),
      getBookingPromoApplications: vi.fn(async () => []),
    };
  }

  it("createBooking tanpa ctx → 403", async () => {
    const { BookingsService } = await import("@modules/bookings/bookings.service");
    const svc = new BookingsService(makeStorage() as any);
    await expect(
      svc.createBooking({} as any, [], { method: "cash", amount: 0 }, undefined, undefined, undefined as any),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createBooking dgn ctx tanpa action.booking.create → ditolak", async () => {
    const { BookingsService } = await import("@modules/bookings/bookings.service");
    const svc = new BookingsService(makeStorage() as any);
    await expect(
      svc.createBooking(
        {} as any, [], { method: "cash", amount: 0 },
        undefined, undefined, ctxWith("page.cso"),
      ),
    ).rejects.toMatchObject({ requiredFlags: ["action.booking.create"] });
  });

  it("createPendingBooking butuh action.booking.create", async () => {
    const { BookingsService } = await import("@modules/bookings/bookings.service");
    const svc = new BookingsService(makeStorage() as any);
    await expect(
      svc.createPendingBooking({} as any, [], "op-1", EMPTY_CTX),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("releasePendingBooking butuh action.booking.cancel", async () => {
    const { BookingsService } = await import("@modules/bookings/bookings.service");
    const svc = new BookingsService(makeStorage() as any);
    await expect(
      svc.releasePendingBooking("b1", "op-1", ctxWith("action.booking.create")),
    ).rejects.toMatchObject({ requiredFlags: ["action.booking.cancel"] });
  });

  it("cleanupExpiredPendingBookings: caller cron tanpa arg lolos via SYSTEM_CONTEXT default", async () => {
    const { BookingsService } = await import("@modules/bookings/bookings.service");
    const svc = new BookingsService(makeStorage() as any);
    // Tidak throw karena default arg = SYSTEM_CONTEXT (flags.has() always true).
    await expect(svc.cleanupExpiredPendingBookings()).resolves.toBeUndefined();
  });

  it("cleanupExpiredPendingBookings: ctx user biasa tanpa flag → 403 (tidak bisa dipanggil dari HTTP)", async () => {
    const { BookingsService } = await import("@modules/bookings/bookings.service");
    const svc = new BookingsService(makeStorage() as any);
    await expect(svc.cleanupExpiredPendingBookings(ctxWith("page.cso")))
      .rejects.toMatchObject({ requiredFlags: ["action.booking.cancel"] });
  });
});

// =====================================================================
// RoundTripService
// =====================================================================
describe("RoundTripService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getStopsByIds: vi.fn(async () => []),
      getTripById: vi.fn(async () => null),
      getOutletById: vi.fn(async () => null),
      getTripStopTimesWithEffectiveFlags: vi.fn(async () => []),
    };
  }

  it("createRoundTripBooking tanpa ctx → 403, sebelum sentuh DB / pricing", async () => {
    const { RoundTripService } = await import("@modules/bookings/roundTrip.service");
    const svc = new RoundTripService(makeStorage() as any);
    await expect(
      svc.createRoundTripBooking(
        {
          outbound: { tripId: "t1", originSeq: 0, destinationSeq: 1, passengers: [{ name: "a", seatNo: "1A" }] },
          return: { tripId: "t2", originSeq: 0, destinationSeq: 1, passengers: [{ seatNo: "1A" }] },
          payment: { method: "cash", amount: 100 },
        } as any,
        "op-1",
        undefined as any,
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("createRoundTripBooking dgn ctx tanpa action.booking.create → ditolak", async () => {
    const { RoundTripService } = await import("@modules/bookings/roundTrip.service");
    const svc = new RoundTripService(makeStorage() as any);
    await expect(
      svc.createRoundTripBooking(
        {
          outbound: { tripId: "t1", originSeq: 0, destinationSeq: 1, passengers: [{ name: "a", seatNo: "1A" }] },
          return: { tripId: "t2", originSeq: 0, destinationSeq: 1, passengers: [{ seatNo: "1A" }] },
          payment: { method: "cash", amount: 100 },
        } as any,
        "op-1",
        ctxWith("page.cso"),
      ),
    ).rejects.toMatchObject({ requiredFlags: ["action.booking.create"] });
  });
});

// =====================================================================
// RescheduleService
// =====================================================================
describe("RescheduleService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getBookingById: vi.fn(async () => ({ id: "b1", originSeq: 0, destinationSeq: 1 })),
      getActivePassengersForTrip: vi.fn(async () => []),
    };
  }

  it("reschedulePassenger tanpa ctx → 403 sebelum query DB", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const svc = new RescheduleService(makeStorage() as any);
    await expect(
      svc.reschedulePassenger("p1", "t2", "1B", "s1", "s2", 0, 1, "op-1", undefined, undefined as any),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("reschedulePassenger butuh action.passenger.reschedule", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const svc = new RescheduleService(makeStorage() as any);
    await expect(
      svc.reschedulePassenger("p1", "t2", "1B", "s1", "s2", 0, 1, "op-1", undefined, ctxWith("action.booking.create")),
    ).rejects.toMatchObject({ requiredFlags: ["action.passenger.reschedule"] });
  });

  it("batchRescheduleForTripClose butuh action.trip.batch_reschedule", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const svc = new RescheduleService(makeStorage() as any);
    await expect(
      svc.batchRescheduleForTripClose("t1", "t2", "s1", "s2", 0, 1, "op-1", "alasan", EMPTY_CTX),
    ).rejects.toMatchObject({ requiredFlags: ["action.trip.batch_reschedule"] });
  });

  it("batchRescheduleForTripClose dgn flag yang sesuai → lolos (no-op kalau tidak ada penumpang)", async () => {
    const { RescheduleService } = await import("@modules/bookings/reschedule.service");
    const storage = makeStorage();
    const svc = new RescheduleService(storage as any);
    const r = await svc.batchRescheduleForTripClose(
      "t1", "t2", "s1", "s2", 0, 1, "op-1", "alasan",
      ctxWith("action.trip.batch_reschedule"),
    );
    expect(r).toEqual({ succeeded: [], failed: [] });
    expect(storage.getActivePassengersForTrip).toHaveBeenCalledWith("t1");
  });
});

// =====================================================================
// UnseatService
// =====================================================================
describe("UnseatService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getBookingById: vi.fn(async () => ({ id: "b1", originSeq: 0, destinationSeq: 1, tripId: "t1", status: "paid" })),
      getPassengers: vi.fn(async () => []),
    };
  }

  it("unseatPassenger tanpa ctx → 403", async () => {
    const { UnseatService } = await import("@modules/bookings/unseat.service");
    const svc = new UnseatService(makeStorage() as any);
    await expect(svc.unseatPassenger("p1", "op-1", undefined, undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("unseatPassenger dgn ctx tanpa flag → ditolak; unseatAllPassengers juga", async () => {
    const { UnseatService } = await import("@modules/bookings/unseat.service");
    const svc = new UnseatService(makeStorage() as any);
    await expect(svc.unseatPassenger("p1", "op-1", undefined, ctxWith("page.cso")))
      .rejects.toMatchObject({ requiredFlags: ["action.passenger.unseat"] });
    await expect(svc.unseatAllPassengers("b1", "op-1", undefined, ctxWith("page.cso")))
      .rejects.toMatchObject({ requiredFlags: ["action.passenger.unseat"] });
  });

  it("assignSeatToUnseated butuh action.passenger.assign_seat (bukan unseat)", async () => {
    const { UnseatService } = await import("@modules/bookings/unseat.service");
    const svc = new UnseatService(makeStorage() as any);
    await expect(svc.assignSeatToUnseated("p1", "1B", "op-1", ctxWith("action.passenger.unseat")))
      .rejects.toMatchObject({ requiredFlags: ["action.passenger.assign_seat"] });
  });
});

// =====================================================================
// SchedulerService — service-layer guard (Task #6)
// Mutating methods: addException, removeException, addStopException,
// removeStopException → semua butuh action.trip.close.
// =====================================================================
describe("SchedulerService — service-layer guard (Task #6)", () => {
  function makeStorage() {
    return {
      getTripByBaseAndDate: vi.fn(async () => null),
    };
  }

  it("addException tanpa ctx → 403 (PermissionDeniedError)", async () => {
    const { SchedulerService } = await import("@modules/scheduler/scheduler.service");
    const svc = new SchedulerService(makeStorage() as any);
    await expect(svc.addException("base-1", "2026-05-01", undefined, undefined, undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("addException dgn ctx tanpa flag → ditolak", async () => {
    const { SchedulerService } = await import("@modules/scheduler/scheduler.service");
    const svc = new SchedulerService(makeStorage() as any);
    await expect(svc.addException("base-1", "2026-05-01", undefined, undefined, ctxWith("page.cso")))
      .rejects.toMatchObject({ requiredFlags: ["action.trip.close"] });
  });

  it("removeException butuh action.trip.close", async () => {
    const { SchedulerService } = await import("@modules/scheduler/scheduler.service");
    const svc = new SchedulerService(makeStorage() as any);
    await expect(svc.removeException("ex-1", undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.removeException("ex-1", ctxWith("master.outlets")))
      .rejects.toMatchObject({ requiredFlags: ["action.trip.close"] });
  });

  it("addStopException + removeStopException butuh action.trip.close", async () => {
    const { SchedulerService } = await import("@modules/scheduler/scheduler.service");
    const svc = new SchedulerService(makeStorage() as any);
    await expect(svc.addStopException("base-1", "2026-05-01", "stop-1", true, false, undefined, undefined, undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.addStopException("base-1", "2026-05-01", "stop-1", true, false, undefined, undefined, ctxWith("page.cso")))
      .rejects.toMatchObject({ requiredFlags: ["action.trip.close"] });
    await expect(svc.removeStopException("ex-1", undefined as any))
      .rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(svc.removeStopException("ex-1", ctxWith("page.cso")))
      .rejects.toMatchObject({ requiredFlags: ["action.trip.close"] });
  });
});

// =====================================================================
// HTTP-level propagation — pastikan PermissionDeniedError yang dilempar
// service tetap muncul sebagai 403 ke klien (tidak ter-flatten ke 500
// oleh catch-all controller). Ini menutup gap yang ditemukan architect
// review: BookingsController & RoundTripController sebelumnya menelan
// error 403 karena catch-all `reply.code(500).send(...)`. Kini setiap
// catch block diawali `if (error?.statusCode === 403) throw error;`
// agar diteruskan ke global error handler di server/index.ts.
// =====================================================================
describe("HTTP propagation — PermissionDeniedError → 403", () => {
  it("Fastify global handler mengembalikan 403 saat service throw PermissionDeniedError", async () => {
    const Fastify = (await import("fastify")).default;
    const { PermissionDeniedError } = await import("@modules/rbac/rbac.guard");

    const app = Fastify();
    // Mirror perilaku server/index.ts: pakai err.statusCode kalau ada.
    app.setErrorHandler((err: any, _req, reply) => {
      const status = err.status || err.statusCode || 500;
      reply.code(status).send({ message: err.message });
    });

    // Endpoint-1: controller TANPA try/catch (mis. outlets/promos/payments)
    // → error langsung diteruskan ke global handler.
    app.post("/no-catch", async () => {
      throw new PermissionDeniedError(["master.outlets"]);
    });

    // Endpoint-2: controller DENGAN catch-all yang sebelumnya bocor.
    // Pola persis seperti BookingsController.releasePendingBooking
    // setelah perbaikan Task #6.
    app.post("/with-catch", async (_req, reply) => {
      try {
        throw new PermissionDeniedError(["action.booking.cancel"]);
      } catch (error: any) {
        if (error?.statusCode === 403) throw error;
        reply.code(500).send({ error: "Internal server error" });
      }
    });

    const r1 = await app.inject({ method: "POST", url: "/no-catch" });
    expect(r1.statusCode).toBe(403);
    expect(r1.json()).toMatchObject({ message: expect.stringContaining("master.outlets") });

    const r2 = await app.inject({ method: "POST", url: "/with-catch" });
    expect(r2.statusCode).toBe(403);
    expect(r2.json()).toMatchObject({ message: expect.stringContaining("action.booking.cancel") });

    await app.close();
  });

  it("regression: catch-all TANPA forward 403 akan SALAH menjadi 500", async () => {
    // Test ini sengaja menunjukkan kontra-faktualnya — supaya jelas kenapa
    // baris `if (error?.statusCode === 403) throw error;` itu wajib.
    const Fastify = (await import("fastify")).default;
    const { PermissionDeniedError } = await import("@modules/rbac/rbac.guard");

    const app = Fastify();
    app.setErrorHandler((err: any, _req, reply) => {
      reply.code(err.statusCode || 500).send({ message: err.message });
    });
    app.post("/buggy", async (_req, reply) => {
      try {
        throw new PermissionDeniedError(["x.y"]);
      } catch (error: any) {
        // sengaja TIDAK forward → bocor ke 500
        reply.code(500).send({ error: "Internal" });
      }
    });

    const r = await app.inject({ method: "POST", url: "/buggy" });
    expect(r.statusCode).toBe(500);
    await app.close();
  });
});
