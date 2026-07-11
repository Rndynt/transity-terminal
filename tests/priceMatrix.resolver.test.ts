/**
 * Unit tests for the DOMAIN-AGNOSTIC, DB-free helpers in
 * server/modules/pricing/priceMatrix.resolver.ts — the pure logic behind
 * OD-matrix pricing (§10 of the passenger OD-matrix pricing prompt).
 *
 * DB-dependent parts (resolvePassengerCell, hasAnyPricedDestinationFromOrigin,
 * getEffectivePatternMatrix's row fetch, consumer parity across
 * pricing.service/app.service/scheduleSnapshot, and the 409 optimistic-lock
 * concurrency test) need a live Postgres connection and were NOT run in
 * this sandbox — see the final report's "known limitations" section.
 *
 * Run: `npx vitest run tests/priceMatrix.resolver.test.ts`
 */
import { describe, it, expect } from "vitest";
import {
  matrixCellKey,
  getMatrixCellPrice,
  pickFirstPriced,
  pickActiveSeasonalOrRegular,
  extractMatrixGrid,
  serializeMatrixGrid,
} from "@server/modules/pricing/priceMatrix.resolver";
import type { PassengerPriceMatrixBlob } from "@shared/schema/pricing";

describe("matrixCellKey / getMatrixCellPrice", () => {
  it("builds a stable 'origin|dest' key", () => {
    expect(matrixCellKey("stop-a", "stop-b")).toBe("stop-a|stop-b");
  });

  it("returns 0 for a missing cell", () => {
    const blob: PassengerPriceMatrixBlob = { version: 1, cells: {} };
    expect(getMatrixCellPrice(blob, "a", "b")).toBe(0);
  });

  it("returns 0 for a null/undefined blob", () => {
    expect(getMatrixCellPrice(undefined, "a", "b")).toBe(0);
    expect(getMatrixCellPrice(null, "a", "b")).toBe(0);
  });

  it("treats a stored price of exactly 0 as 'not set' -> 0", () => {
    const blob: PassengerPriceMatrixBlob = { version: 1, cells: { "a|b": { price: 0 } } };
    expect(getMatrixCellPrice(blob, "a", "b")).toBe(0);
  });

  it("returns the stored price for an existing cell", () => {
    const blob: PassengerPriceMatrixBlob = { version: 1, cells: { "a|b": { price: 95000 } } };
    expect(getMatrixCellPrice(blob, "a", "b")).toBe(95000);
  });

  it("JKT-BDG-JOG matrix: each OD pair resolves independently (non-linear)", () => {
    // JKT->BDG 95k, BDG->JOG 100k, JKT->JOG 200k — NOT 95k+100k=195k.
    // This is exactly the case the flat/per_leg legacy modes could never
    // express; the matrix must return each pair's OWN value untouched.
    const blob: PassengerPriceMatrixBlob = {
      version: 1,
      cells: {
        "jkt|bdg": { price: 95000 },
        "bdg|jog": { price: 100000 },
        "jkt|jog": { price: 200000 },
      },
    };
    expect(getMatrixCellPrice(blob, "jkt", "bdg")).toBe(95000);
    expect(getMatrixCellPrice(blob, "bdg", "jog")).toBe(100000);
    expect(getMatrixCellPrice(blob, "jkt", "jog")).toBe(200000);
    // and it's deliberately NOT the sum of the sub-legs:
    expect(getMatrixCellPrice(blob, "jkt", "jog")).not.toBe(95000 + 100000);
  });
});

describe("pickFirstPriced (precedence walk)", () => {
  it("picks the first source with price > 0, in given order", () => {
    const result = pickFirstPriced([
      { tag: "trip" as const, price: 0 },
      { tag: "pattern" as const, price: 95000 },
      { tag: "global" as const, price: 50000 },
    ]);
    expect(result).toEqual({ price: 95000, source: "pattern" });
  });

  it("trip-exception wins over pattern and global when priced", () => {
    const result = pickFirstPriced([
      { tag: "trip" as const, price: 77000 },
      { tag: "pattern" as const, price: 95000 },
      { tag: "global" as const, price: 50000 },
    ]);
    expect(result).toEqual({ price: 77000, source: "trip" });
  });

  it("falls through to 'none' / 0 when every source is unpriced", () => {
    const result = pickFirstPriced([
      { tag: "trip" as const, price: 0 },
      { tag: "pattern" as const, price: 0 },
      { tag: "global" as const, price: 0 },
    ]);
    expect(result).toEqual({ price: 0, source: "none" });
  });
});

describe("pickActiveSeasonalOrRegular (seasonal date-window selection)", () => {
  const rows = [
    { kind: "regular", validFrom: null, validTo: null, tag: "R" },
    { kind: "seasonal", validFrom: "2026-06-01", validTo: "2026-06-15", tag: "LEBARAN" },
  ];

  it("picks the seasonal row when serviceDate falls inside its window", () => {
    const picked = pickActiveSeasonalOrRegular(rows, "2026-06-07");
    expect(picked?.tag).toBe("LEBARAN");
  });

  it("falls back to regular when serviceDate is outside every seasonal window", () => {
    const picked = pickActiveSeasonalOrRegular(rows, "2026-07-01");
    expect(picked?.tag).toBe("R");
  });

  it("includes the window boundary dates (inclusive)", () => {
    expect(pickActiveSeasonalOrRegular(rows, "2026-06-01")?.tag).toBe("LEBARAN");
    expect(pickActiveSeasonalOrRegular(rows, "2026-06-15")?.tag).toBe("LEBARAN");
  });

  it("returns null when there is no regular row and no matching seasonal", () => {
    const seasonalOnly = [{ kind: "seasonal", validFrom: "2026-06-01", validTo: "2026-06-15", tag: "LEBARAN" }];
    expect(pickActiveSeasonalOrRegular(seasonalOnly, "2026-07-01")).toBeNull();
  });
});

describe("extractMatrixGrid / serializeMatrixGrid round-trip", () => {
  const patternStops = [
    { stopId: "jkt", stopSequence: 1, stop: { name: "Jakarta", code: "JKT" } },
    { stopId: "bdg", stopSequence: 2, stop: { name: "Bandung", code: "BDG" } },
    { stopId: "jog", stopSequence: 3, stop: { name: "Jogja", code: "JOG" } },
  ];

  it("builds an upper-triangular set of forward-only cells", () => {
    const { rows, cells } = extractMatrixGrid(null, patternStops);
    expect(rows.map(r => r.stopId)).toEqual(["jkt", "bdg", "jog"]);
    // 3 stops -> 3 forward pairs: jkt-bdg, jkt-jog, bdg-jog
    expect(cells).toHaveLength(3);
    expect(cells.every(c => c.price === 0)).toBe(true);
  });

  it("reflects existing matrix values keyed by stopId", () => {
    const matrixRow = { matrix: { version: 1, cells: { "jkt|bdg": { price: 95000 } } } };
    const { cells } = extractMatrixGrid(matrixRow, patternStops);
    const jktBdg = cells.find(c => c.originStopId === "jkt" && c.destinationStopId === "bdg");
    expect(jktBdg?.price).toBe(95000);
  });

  it("serializeMatrixGrid omits zero/unset cells and keeps only priced ones", () => {
    const blob = serializeMatrixGrid([
      { originStopId: "jkt", destinationStopId: "bdg", price: 95000 },
      { originStopId: "bdg", destinationStopId: "jog", price: 100000 },
      { originStopId: "jkt", destinationStopId: "jog", price: 0 }, // unset
    ]);
    expect(blob.cells["jkt|bdg"]).toEqual({ price: 95000 });
    expect(blob.cells["bdg|jog"]).toEqual({ price: 100000 });
    expect(blob.cells["jkt|jog"]).toBeUndefined();
  });

  it("round-trips: extract -> edit -> serialize -> extract gives the same independent JKT-BDG-JOG prices", () => {
    const edited = serializeMatrixGrid([
      { originStopId: "jkt", destinationStopId: "bdg", price: 95000 },
      { originStopId: "bdg", destinationStopId: "jog", price: 100000 },
      { originStopId: "jkt", destinationStopId: "jog", price: 200000 },
    ]);
    const { cells } = extractMatrixGrid({ matrix: edited }, patternStops);
    expect(cells.find(c => c.originStopId === "jkt" && c.destinationStopId === "bdg")?.price).toBe(95000);
    expect(cells.find(c => c.originStopId === "bdg" && c.destinationStopId === "jog")?.price).toBe(100000);
    expect(cells.find(c => c.originStopId === "jkt" && c.destinationStopId === "jog")?.price).toBe(200000);
  });
});
