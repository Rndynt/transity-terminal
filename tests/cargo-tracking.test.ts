/**
 * S1-06 follow-up — pelacakan kargo publik wajib pakai `trackingSecret`.
 *
 * Yang diuji:
 *   1. AppService.trackCargo melempar "Tracking secret diperlukan" kalau
 *      caller tidak menyertakan secret.
 *   2. Melempar "Tracking secret tidak valid" untuk secret yang panjangnya
 *      sama tapi isinya beda.
 *   3. Melempar "Tracking secret tidak valid" untuk secret yang panjangnya
 *      beda (early-return sebelum timingSafeEqual).
 *   4. Mengembalikan payload tracking lengkap kalau secret cocok.
 *   5. AppController.trackCargo memetakan error secret → HTTP 401, dan
 *      sukses → HTTP 200 dengan body dari service.
 *
 * Jalankan: `npx vitest run tests/cargo-tracking.test.ts`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@server/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    execute: async () => ({ rows: [] }),
    transaction: async (fn: any) => fn({}),
  },
}));

vi.mock("@server/realtime/ws", () => ({
  webSocketService: {
    broadcast: vi.fn(),
    emit: vi.fn(),
    emitInventoryUpdated: vi.fn(),
    emitHoldsReleased: vi.fn(),
  },
}));

const SECRET = "abcdef0123456789";

const baseShipment: any = {
  id: "ship-1",
  waybillNumber: "WB-001",
  status: "received",
  tripId: "trip-1",
  originStopId: "stop-A",
  destinationStopId: "stop-B",
  senderName: "Sender A",
  recipientName: "Recipient B",
  itemDescription: "Box",
  weightKg: "3.5",
  totalAmount: "20000",
  createdAt: new Date("2026-04-01T00:00:00Z"),
  trackingSecret: SECRET,
};

function makeStorage() {
  return {
    getCargoShipmentByWaybill: vi.fn(async (wb: string) =>
      wb === baseShipment.waybillNumber ? { ...baseShipment } : undefined,
    ),
    getStopById: vi.fn(async (id: string) => ({
      id,
      name: id === "stop-A" ? "Origin" : "Dest",
      code: id === "stop-A" ? "ORG" : "DST",
      city: id === "stop-A" ? "Jakarta" : "Bandung",
    })),
    getTripById: vi.fn(async () => ({
      id: "trip-1",
      patternId: "pattern-1",
      serviceDate: "2026-05-01",
      status: "scheduled",
    })),
    getTripPatternById: vi.fn(async () => ({ id: "pattern-1", name: "JKT-BDG" })),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AppService.trackCargo (S1-06)", () => {
  it("menolak request tanpa secret", async () => {
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(makeStorage());
    await expect(svc.trackCargo("WB-001")).rejects.toThrow(/secret diperlukan/i);
    await expect(svc.trackCargo("WB-001", "")).rejects.toThrow(/secret diperlukan/i);
    await expect(svc.trackCargo("WB-001", "   ")).rejects.toThrow(/secret diperlukan/i);
    await expect(svc.trackCargo("WB-001", null)).rejects.toThrow(/secret diperlukan/i);
  });

  it("menolak secret yang panjangnya beda (length mismatch guard)", async () => {
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(makeStorage());
    await expect(svc.trackCargo("WB-001", "short")).rejects.toThrow(/tidak valid/i);
  });

  it("menolak secret yang panjangnya sama tapi isinya beda", async () => {
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(makeStorage());
    const wrong = "f".repeat(SECRET.length);
    expect(wrong.length).toBe(SECRET.length);
    await expect(svc.trackCargo("WB-001", wrong)).rejects.toThrow(/tidak valid/i);
  });

  it("menolak shipment yang tidak punya trackingSecret (backfill kosong)", async () => {
    const { AppService } = await import("@modules/app/app.service");
    const storage = makeStorage();
    storage.getCargoShipmentByWaybill = vi.fn(async () => ({
      ...baseShipment,
      trackingSecret: undefined,
    }));
    const svc = new AppService(storage);
    await expect(svc.trackCargo("WB-001", SECRET)).rejects.toThrow(/secret diperlukan/i);
  });

  it("404 path: waybill tidak ditemukan → 'Shipment not found'", async () => {
    const { AppService } = await import("@modules/app/app.service");
    const svc = new AppService(makeStorage());
    await expect(svc.trackCargo("WB-MISSING", SECRET)).rejects.toThrow(/not found/i);
  });

  it("mengembalikan payload tracking ketika secret cocok", async () => {
    const { AppService } = await import("@modules/app/app.service");
    const storage = makeStorage();
    const svc = new AppService(storage);

    const result = await svc.trackCargo("WB-001", SECRET);
    expect(result.waybillNumber).toBe("WB-001");
    expect(result.status).toBe("received");
    expect(result.origin).toEqual({ name: "Origin", code: "ORG", city: "Jakarta" });
    expect(result.destination).toEqual({ name: "Dest", code: "DST", city: "Bandung" });
    expect(result.serviceDate).toBe("2026-05-01");
    expect(result.patternName).toBe("JKT-BDG");
    expect(result.senderName).toBe("Sender A");
    expect(result.recipientName).toBe("Recipient B");
    expect(storage.getCargoShipmentByWaybill).toHaveBeenCalledWith("WB-001");
  });
});

describe("AppController.trackCargo (S1-06) — HTTP status mapping", () => {
  function makeReq(params: any, query: any = {}, headers: any = {}) {
    return { params, query, headers } as any;
  }
  function makeReply() {
    const reply: any = {
      _code: 200,
      _body: undefined as any,
      code(c: number) { reply._code = c; return reply; },
      send(body: any) { reply._body = body; return reply; },
    };
    return reply;
  }

  it("tanpa secret → 401 dengan pesan 'Tracking secret diperlukan'", async () => {
    const { AppController } = await import("@modules/app/app.controller");
    const ctrl = new AppController(makeStorage());
    const reply = makeReply();
    await ctrl.trackCargo(makeReq({ waybillNumber: "WB-001" }), reply);
    expect(reply._code).toBe(401);
    expect(reply._body.error).toMatch(/secret diperlukan/i);
  });

  it("secret salah (via query ?secret=) → 401", async () => {
    const { AppController } = await import("@modules/app/app.controller");
    const ctrl = new AppController(makeStorage());
    const reply = makeReply();
    await ctrl.trackCargo(
      makeReq({ waybillNumber: "WB-001" }, { secret: "f".repeat(SECRET.length) }),
      reply,
    );
    expect(reply._code).toBe(401);
    expect(reply._body.error).toMatch(/tidak valid/i);
  });

  it("waybill tidak ada → 404 (bukan 401)", async () => {
    const { AppController } = await import("@modules/app/app.controller");
    const ctrl = new AppController(makeStorage());
    const reply = makeReply();
    await ctrl.trackCargo(
      makeReq({ waybillNumber: "WB-MISSING" }, { secret: SECRET }),
      reply,
    );
    expect(reply._code).toBe(404);
    expect(reply._body.error).toMatch(/not found/i);
  });

  it("secret benar via header X-Tracking-Secret → 200 + payload", async () => {
    const { AppController } = await import("@modules/app/app.controller");
    const ctrl = new AppController(makeStorage());
    const reply = makeReply();
    await ctrl.trackCargo(
      makeReq({ waybillNumber: "WB-001" }, {}, { "x-tracking-secret": SECRET }),
      reply,
    );
    expect(reply._code).toBe(200);
    expect(reply._body.waybillNumber).toBe("WB-001");
    expect(reply._body.senderName).toBe("Sender A");
  });

  it("secret benar via query ?s= (alias pendek) → 200", async () => {
    const { AppController } = await import("@modules/app/app.controller");
    const ctrl = new AppController(makeStorage());
    const reply = makeReply();
    await ctrl.trackCargo(
      makeReq({ waybillNumber: "WB-001" }, { s: SECRET }),
      reply,
    );
    expect(reply._code).toBe(200);
    expect(reply._body.waybillNumber).toBe("WB-001");
  });
});
