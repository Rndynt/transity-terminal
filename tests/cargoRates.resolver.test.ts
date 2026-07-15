/**
 * Tests for the cargo OD-matrix pricing identity swap:
 *   - server/modules/cargo/cargoRates.resolver.ts (pure grid helpers +
 *     resolveCargoCell precedence, OD-aware selectability)
 *   - server/modules/cargo/cargoRates.service.ts (duplication, optimistic
 *     lock)
 *
 * minCharge-clamp math is covered at the CargoService.calculateTariff level
 * in tests/sprint2-integration.test.ts (I9/I9b), not repeated here.
 * Passenger pricing must be unaffected by the shared-helper generalization
 * in priceRules.resolver.ts — see tests/priceRules.resolver.test.ts, which
 * this change does not modify the assertions of.
 *
 * Run: `npx vitest run tests/cargoRates.resolver.test.ts`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Mock @server/db (chainable, queue-based — same pattern as
// tests/sprint2-integration.test.ts) ----------
const dbState: { selectQueue: any[]; insertQueue: any[]; updateQueue: any[] } = {
  selectQueue: [], insertQueue: [], updateQueue: [],
};
function pushSelectResult(rows: any[]) { dbState.selectQueue.push(rows); }
function pushInsertResult(row: any) { dbState.insertQueue.push(row); }
function pushUpdateResult(rows: any[]) { dbState.updateQueue.push(rows); }

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
    returning: () => Promise.resolve([dbState.insertQueue.shift() ?? { id: 'auto-' + Math.random() }]),
  };
  return chain;
}
function makeUpdateChain() {
  const chain: any = {
    set: () => chain,
    where: () => chain,
    returning: () => Promise.resolve(dbState.updateQueue.shift() ?? []),
  };
  return chain;
}

vi.mock("@server/db", () => ({
  db: {
    select: () => makeSelectChain(),
    insert: () => makeInsertChain(),
    update: () => makeUpdateChain(),
  },
}));

beforeEach(() => {
  dbState.selectQueue = [];
  dbState.insertQueue = [];
  dbState.updateQueue = [];
});

// ============================================================
// Pure logic: extractCargoMatrixGrid / serializeCargoMatrixGrid
// (thin wrappers reusing the generalized priceRules.resolver.ts helpers)
// ============================================================
describe("extractCargoMatrixGrid / serializeCargoMatrixGrid round-trip", () => {
  const patternStops = [
    { stopId: "jkt", stopSequence: 1, stop: { name: "Jakarta", code: "JKT" } },
    { stopId: "bdg", stopSequence: 2, stop: { name: "Bandung", code: "BDG" } },
    { stopId: "jog", stopSequence: 3, stop: { name: "Jogja", code: "JOG" } },
  ];

  it("builds an upper-triangular set of forward-only cells keyed by pricePerKg", async () => {
    const { extractCargoMatrixGrid } = await import("@modules/cargo/cargoRates.resolver");
    const { rows, cells } = extractCargoMatrixGrid(null, patternStops);
    expect(rows.map(r => r.stopId)).toEqual(["jkt", "bdg", "jog"]);
    expect(cells).toHaveLength(3);
    expect(cells.every(c => c.pricePerKg === 0)).toBe(true);
  });

  it("regression: multi-city JKT-BDG-JOG resolves each OD's pricePerKg independently (non-linear)", async () => {
    const { extractCargoMatrixGrid, serializeCargoMatrixGrid } = await import("@modules/cargo/cargoRates.resolver");
    // JKT->BDG 2000/kg, BDG->JOG 2500/kg, JKT->JOG 3000/kg — NOT 2000+2500.
    const blob = serializeCargoMatrixGrid([
      { originStopId: "jkt", destinationStopId: "bdg", pricePerKg: 2000 },
      { originStopId: "bdg", destinationStopId: "jog", pricePerKg: 2500 },
      { originStopId: "jkt", destinationStopId: "jog", pricePerKg: 3000 },
    ]);
    const { cells } = extractCargoMatrixGrid({ matrix: blob }, patternStops);
    expect(cells.find(c => c.originStopId === "jkt" && c.destinationStopId === "bdg")?.pricePerKg).toBe(2000);
    expect(cells.find(c => c.originStopId === "bdg" && c.destinationStopId === "jog")?.pricePerKg).toBe(2500);
    expect(cells.find(c => c.originStopId === "jkt" && c.destinationStopId === "jog")?.pricePerKg).toBe(3000);
    // deliberately not the sum of the sub-legs (this is exactly what the
    // old flat/per-leg cargo pricing could never express):
    const jktJog = cells.find(c => c.originStopId === "jkt" && c.destinationStopId === "jog")?.pricePerKg;
    expect(jktJog).not.toBe(2000 + 2500);
  });

  it("serializeCargoMatrixGrid omits zero/unset cells", async () => {
    const { serializeCargoMatrixGrid } = await import("@modules/cargo/cargoRates.resolver");
    const blob = serializeCargoMatrixGrid([
      { originStopId: "jkt", destinationStopId: "bdg", pricePerKg: 2000 },
      { originStopId: "jkt", destinationStopId: "jog", pricePerKg: 0 },
    ]);
    expect(blob.cells["jkt|bdg"]).toEqual({ pricePerKg: 2000 });
    expect(blob.cells["jkt|jog"]).toBeUndefined();
  });
});

// ============================================================
// resolveCargoCell precedence + seasonal window (DB-mocked)
// ============================================================
describe("resolveCargoCell precedence (trip-exception > seasonal > regular > none)", () => {
  it("falls through to 0/'none' when nothing is priced anywhere (no global tier)", async () => {
    const { resolveCargoCell } = await import("@modules/cargo/cargoRates.resolver");
    pushSelectResult([]); // trip exception: none
    pushSelectResult([]); // pattern rows: none at all
    const result = await resolveCargoCell({
      patternId: "p1", tripId: "trip-1", cargoTypeId: "ct1",
      originStopId: "S0", destinationStopId: "S2", serviceDate: "2026-06-07",
    });
    expect(result).toEqual({ pricePerKg: 0, source: "none" });
  });

  it("pattern regular wins when no trip exception and no active seasonal", async () => {
    const { resolveCargoCell } = await import("@modules/cargo/cargoRates.resolver");
    pushSelectResult([]); // no trip exception
    pushSelectResult([
      { id: "r1", patternId: "p1", cargoTypeId: "ct1", kind: "regular", validFrom: null, validTo: null,
        matrix: { version: 1, cells: { "S0|S2": { pricePerKg: 1500 } } }, isActive: true, deletedAt: null },
    ]);
    const result = await resolveCargoCell({
      patternId: "p1", tripId: "trip-1", cargoTypeId: "ct1", originStopId: "S0", destinationStopId: "S2", serviceDate: "2026-06-07",
    });
    expect(result).toEqual({ pricePerKg: 1500, source: "pattern" });
  });

  it("active seasonal window OUTRANKS regular for the same pattern+cargoType", async () => {
    const { resolveCargoCell } = await import("@modules/cargo/cargoRates.resolver");
    pushSelectResult([]); // no trip exception
    pushSelectResult([
      { id: "r1", patternId: "p1", cargoTypeId: "ct1", kind: "regular", validFrom: null, validTo: null,
        matrix: { version: 1, cells: { "S0|S2": { pricePerKg: 1500 } } }, isActive: true, deletedAt: null },
      { id: "r2", patternId: "p1", cargoTypeId: "ct1", kind: "seasonal", validFrom: "2026-06-01", validTo: "2026-06-15",
        matrix: { version: 1, cells: { "S0|S2": { pricePerKg: 3000 } } }, isActive: true, deletedAt: null },
    ]);
    const result = await resolveCargoCell({
      patternId: "p1", tripId: "trip-1", cargoTypeId: "ct1", originStopId: "S0", destinationStopId: "S2", serviceDate: "2026-06-07",
    });
    expect(result).toEqual({ pricePerKg: 3000, source: "pattern" });
  });

  it("seasonal window OUTSIDE its dates falls back to regular", async () => {
    const { resolveCargoCell } = await import("@modules/cargo/cargoRates.resolver");
    pushSelectResult([]);
    pushSelectResult([
      { id: "r1", patternId: "p1", cargoTypeId: "ct1", kind: "regular", validFrom: null, validTo: null,
        matrix: { version: 1, cells: { "S0|S2": { pricePerKg: 1500 } } }, isActive: true, deletedAt: null },
      { id: "r2", patternId: "p1", cargoTypeId: "ct1", kind: "seasonal", validFrom: "2026-06-01", validTo: "2026-06-15",
        matrix: { version: 1, cells: { "S0|S2": { pricePerKg: 3000 } } }, isActive: true, deletedAt: null },
    ]);
    const result = await resolveCargoCell({
      patternId: "p1", tripId: "trip-1", cargoTypeId: "ct1", originStopId: "S0", destinationStopId: "S2", serviceDate: "2026-07-20",
    });
    expect(result).toEqual({ pricePerKg: 1500, source: "pattern" });
  });

  it("trip exception OUTRANKS an active seasonal (and regular)", async () => {
    const { resolveCargoCell } = await import("@modules/cargo/cargoRates.resolver");
    pushSelectResult([
      { id: "ex1", tripId: "trip-1", cargoTypeId: "ct1", originStopId: "S0", destinationStopId: "S2", pricePerKg: "9999", deletedAt: null },
    ]);
    pushSelectResult([
      { id: "r1", patternId: "p1", cargoTypeId: "ct1", kind: "regular", validFrom: null, validTo: null,
        matrix: { version: 1, cells: { "S0|S2": { pricePerKg: 1500 } } }, isActive: true, deletedAt: null },
      { id: "r2", patternId: "p1", cargoTypeId: "ct1", kind: "seasonal", validFrom: "2026-06-01", validTo: "2026-06-15",
        matrix: { version: 1, cells: { "S0|S2": { pricePerKg: 3000 } } }, isActive: true, deletedAt: null },
    ]);
    const result = await resolveCargoCell({
      patternId: "p1", tripId: "trip-1", cargoTypeId: "ct1", originStopId: "S0", destinationStopId: "S2", serviceDate: "2026-06-07",
    });
    expect(result).toEqual({ pricePerKg: 9999, source: "trip" });
  });
});

// ============================================================
// OD-aware selectability (one 0-priced OD blocked, others selectable)
// ============================================================
describe("hasAnyPricedDestinationFromOriginCargo / listPricedDestinationsFromOriginCargo", () => {
  it("blocks a 0-priced OD while leaving priced ones selectable", async () => {
    const { listPricedDestinationsFromOriginCargo, hasAnyPricedDestinationFromOriginCargo } = await import("@modules/cargo/cargoRates.resolver");
    // Pattern regular matrix only prices S0->S1 (2000/kg); S0->S2 is unset.
    pushSelectResult([
      { id: "r1", patternId: "p1", cargoTypeId: "ct1", kind: "regular", validFrom: null, validTo: null,
        matrix: { version: 1, cells: { "S0|S1": { pricePerKg: 2000 } } }, isActive: true, deletedAt: null },
    ]);
    const list = await listPricedDestinationsFromOriginCargo({
      patternId: "p1", cargoTypeId: "ct1", originStopId: "S0",
      destinationStopIds: ["S1", "S2"], serviceDate: "2026-06-07",
    });
    expect(list).toEqual([
      { destinationStopId: "S1", pricePerKg: 2000 },
      { destinationStopId: "S2", pricePerKg: 0 },
    ]);

    pushSelectResult([
      { id: "r1", patternId: "p1", cargoTypeId: "ct1", kind: "regular", validFrom: null, validTo: null,
        matrix: { version: 1, cells: { "S0|S1": { pricePerKg: 2000 } } }, isActive: true, deletedAt: null },
    ]);
    const hasAnyWithS1 = await hasAnyPricedDestinationFromOriginCargo({
      patternId: "p1", cargoTypeId: "ct1", originStopId: "S0",
      destinationStopIds: ["S1", "S2"], serviceDate: "2026-06-07",
    });
    expect(hasAnyWithS1).toBe(true);

    pushSelectResult([
      { id: "r1", patternId: "p1", cargoTypeId: "ct1", kind: "regular", validFrom: null, validTo: null,
        matrix: { version: 1, cells: { "S0|S1": { pricePerKg: 2000 } } }, isActive: true, deletedAt: null },
    ]);
    const hasAnyOnlyS2 = await hasAnyPricedDestinationFromOriginCargo({
      patternId: "p1", cargoTypeId: "ct1", originStopId: "S0",
      destinationStopIds: ["S2"], serviceDate: "2026-06-07",
    });
    expect(hasAnyOnlyS2).toBe(false);
  });
});

// ============================================================
// CargoRatesService: duplication + optimistic lock (DB-mocked)
// ============================================================
describe("CargoRatesService.duplicateMatrixToCargoType", () => {
  it("copies ALL cells from the source matrix to the target cargoType", async () => {
    const { CargoRatesService } = await import("@modules/cargo/cargoRates.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new CargoRatesService({} as any);

    const sourceMatrix = {
      id: "rate-src", patternId: "p1", cargoTypeId: "ct-small", kind: "regular",
      name: null, validFrom: null, validTo: null, deletedAt: null,
      matrix: { version: 1, cells: { "S0|S1": { pricePerKg: 2000 }, "S0|S2": { pricePerKg: 3500 } } },
    };
    pushSelectResult([sourceMatrix]); // fetch source by id
    pushSelectResult([]); // no existing row at destination (ct-medium) yet
    pushInsertResult({ ...sourceMatrix, id: "rate-new", cargoTypeId: "ct-medium" });

    const created = await svc.duplicateMatrixToCargoType("rate-src", "ct-medium", SYSTEM_CONTEXT);
    expect(created.cargoTypeId).toBe("ct-medium");
    expect(created.matrix.cells).toEqual(sourceMatrix.matrix.cells);
  });

  it("rejects duplicating a matrix onto itself (same cargoType)", async () => {
    const { CargoRatesService } = await import("@modules/cargo/cargoRates.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new CargoRatesService({} as any);

    pushSelectResult([{ id: "rate-src", patternId: "p1", cargoTypeId: "ct-small", kind: "regular", matrix: { version: 1, cells: {} } }]);
    await expect(svc.duplicateMatrixToCargoType("rate-src", "ct-small", SYSTEM_CONTEXT)).rejects.toThrow(/tidak boleh sama/);
  });
});

describe("CargoRatesService.saveCargoRate — optimistic lock", () => {
  it("throws StaleCargoRateError (-> controller maps to 409) when expectedUpdatedAt is stale", async () => {
    const { CargoRatesService, StaleCargoRateError } = await import("@modules/cargo/cargoRates.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new CargoRatesService({} as any);

    // Row currently in DB was updated at T2, but the client's editor still
    // has the stale T1 value as its expectedUpdatedAt (concurrent save).
    pushSelectResult([{
      id: "rate1", patternId: "p1", cargoTypeId: "ct1", kind: "regular",
      matrix: { version: 1, cells: {} }, updatedAt: new Date("2026-06-01T12:00:00Z"),
      validFrom: null, validTo: null, name: null, deletedAt: null,
    }]);

    await expect(svc.saveCargoRate({
      patternId: "p1", cargoTypeId: "ct1", kind: "regular",
      cells: [{ originStopId: "S0", destinationStopId: "S1", pricePerKg: 1000 }],
      expectedUpdatedAt: new Date("2026-06-01T10:00:00Z").toISOString(), // stale
    }, SYSTEM_CONTEXT)).rejects.toBeInstanceOf(StaleCargoRateError);
  });

  it("succeeds and updates when expectedUpdatedAt matches the current row", async () => {
    const { CargoRatesService } = await import("@modules/cargo/cargoRates.service");
    const { SYSTEM_CONTEXT } = await import("@modules/rbac/rbac.guard");
    const svc = new CargoRatesService({} as any);

    const currentUpdatedAt = new Date("2026-06-01T12:00:00Z");
    pushSelectResult([{
      id: "rate1", patternId: "p1", cargoTypeId: "ct1", kind: "regular",
      matrix: { version: 1, cells: {} }, updatedAt: currentUpdatedAt,
      validFrom: null, validTo: null, name: null, deletedAt: null,
    }]);
    pushUpdateResult([{
      id: "rate1", patternId: "p1", cargoTypeId: "ct1", kind: "regular",
      matrix: { version: 1, cells: { "S0|S1": { pricePerKg: 1000 } } }, updatedAt: new Date(),
    }]);

    const updated = await svc.saveCargoRate({
      patternId: "p1", cargoTypeId: "ct1", kind: "regular",
      cells: [{ originStopId: "S0", destinationStopId: "S1", pricePerKg: 1000 }],
      expectedUpdatedAt: currentUpdatedAt.toISOString(),
    }, SYSTEM_CONTEXT);
    expect(updated.id).toBe("rate1");
  });
});
