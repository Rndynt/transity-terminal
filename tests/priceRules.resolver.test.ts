/**
 * Unit tests for the DOMAIN-AGNOSTIC, DB-free helpers in
 * server/modules/priceRules/priceRules.resolver.ts — the pure logic behind
 * OD-matrix pricing.
 *
 * DB-dependent parts (resolvePassengerCell, hasAnyPricedDestinationFromOrigin,
 * getEffectivePatternMatrix's row fetch, buildPricedMatrix's DB-fetching
 * wrapper + getTripExceptionsForTrip, consumer parity across
 * pricing.service/app.service/scheduleSnapshot, and the 409 optimistic-lock
 * concurrency test) need a live Postgres connection and were NOT run in
 * this sandbox — see the final report's "known limitations" section.
 * buildPricedMatrixCore is the pure logic extracted FROM buildPricedMatrix
 * specifically so this precedence/eligibility logic CAN be covered here
 * without a DB — see the "buildPricedMatrixCore" describe block below.
 *
 * Run: `npx vitest run tests/priceRules.resolver.test.ts`
 */
import { describe, it, expect } from "vitest";
import {
  matrixCellKey,
  getMatrixCellPrice,
  pickFirstPriced,
  pickActiveSeasonalOrRegular,
  extractMatrixGrid,
  serializeMatrixGrid,
  buildPricedMatrixCore,
  type PricedMatrixStopInput,
} from "@server/modules/priceRules/priceRules.resolver";
import type { PriceRuleBlob } from "@shared/schema/pricing";

describe("matrixCellKey / getMatrixCellPrice", () => {
  it("builds a stable 'origin|dest' key", () => {
    expect(matrixCellKey("stop-a", "stop-b")).toBe("stop-a|stop-b");
  });

  it("returns 0 for a missing cell", () => {
    const blob: PriceRuleBlob = { version: 1, cells: {} };
    expect(getMatrixCellPrice(blob, "a", "b")).toBe(0);
  });

  it("returns 0 for a null/undefined blob", () => {
    expect(getMatrixCellPrice(undefined, "a", "b")).toBe(0);
    expect(getMatrixCellPrice(null, "a", "b")).toBe(0);
  });

  it("treats a stored price of exactly 0 as 'not set' -> 0", () => {
    const blob: PriceRuleBlob = { version: 1, cells: { "a|b": { price: 0 } } };
    expect(getMatrixCellPrice(blob, "a", "b")).toBe(0);
  });

  it("returns the stored price for an existing cell", () => {
    const blob: PriceRuleBlob = { version: 1, cells: { "a|b": { price: 95000 } } };
    expect(getMatrixCellPrice(blob, "a", "b")).toBe(95000);
  });

  it("JKT-BDG-JOG matrix: each OD pair resolves independently (non-linear)", () => {
    // JKT->BDG 95k, BDG->JOG 100k, JKT->JOG 200k — NOT 95k+100k=195k.
    // This is exactly the case the flat/per_leg legacy modes could never
    // express; the matrix must return each pair's OWN value untouched.
    const blob: PriceRuleBlob = {
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

describe("buildPricedMatrixCore (exception-aware priced matrix)", () => {
  // Same 3-city pattern used in the OD-aware pricedMatrix spec's own
  // verification example: Jakarta pickups (ATR, JTW) -> Bandung
  // (PST, CHP, DPU) -> Semarang drop (KAY). ATR/JTW are board-only
  // (first-city pickups), KAY is alight-only (final destination).
  const stops: PricedMatrixStopInput[] = [
    { stopId: "ATR", stopSequence: 1, boardingAllowed: true, alightingAllowed: false, city: "Jakarta" },
    { stopId: "JTW", stopSequence: 2, boardingAllowed: true, alightingAllowed: false, city: "Jakarta" },
    { stopId: "PST", stopSequence: 3, boardingAllowed: true, alightingAllowed: true, city: "Bandung" },
    { stopId: "CHP", stopSequence: 4, boardingAllowed: true, alightingAllowed: true, city: "Bandung" },
    { stopId: "DPU", stopSequence: 5, boardingAllowed: true, alightingAllowed: true, city: "Bandung" },
    { stopId: "KAY", stopSequence: 6, boardingAllowed: false, alightingAllowed: true, city: "Semarang" },
  ];

  // CHP->KAY is deliberately absent (unpriced transit OD). DPU->KAY is
  // deliberately absent from the PATTERN tier only, so it exercises the
  // global-tier fallback. PST|CHP (intra-city, both Bandung, both
  // boardable+alightable) IS priced here on purpose: it isolates the
  // intra-city filter as the ONLY reason it gets excluded below — unlike
  // ATR/JTW, which are board-only and would be excluded by the
  // boarding/alighting filters regardless of the intra-city flag.
  const patternMatrix: PriceRuleBlob = {
    version: 1,
    cells: {
      "ATR|PST": { price: 150000 },
      "ATR|CHP": { price: 150000 },
      "ATR|DPU": { price: 150000 },
      "ATR|KAY": { price: 250000 },
      "JTW|PST": { price: 150000 },
      "JTW|KAY": { price: 250000 },
      "PST|KAY": { price: 120000 },
      "PST|CHP": { price: 45000 },
    },
  };

  const globalMatrix: PriceRuleBlob = {
    version: 1,
    cells: {
      "DPU|KAY": { price: 60000 },
    },
  };

  it("includes a priced main OD (ATR Jakarta -> KAY Semarang)", () => {
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix, globalMatrix, tripExceptions: new Map(), allowIntraCityBooking: false,
    });
    expect(matrix["ATR"]["KAY"]).toBe(250000);
  });

  it("omits an unpriced transit OD (CHP -> KAY has no price at any tier)", () => {
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix, globalMatrix, tripExceptions: new Map(), allowIntraCityBooking: false,
    });
    expect(matrix["CHP"]?.["KAY"]).toBeUndefined();
  });

  it("a trip-exception overrides the pattern price for the same OD pair", () => {
    const tripExceptions = new Map([["ATR|KAY", 230000]]);
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix, globalMatrix, tripExceptions, allowIntraCityBooking: false,
    });
    expect(matrix["ATR"]["KAY"]).toBe(230000); // not the pattern's 250000
  });

  it("falls back to the global tier when the pattern has no cell for that pair", () => {
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix, globalMatrix, tripExceptions: new Map(), allowIntraCityBooking: false,
    });
    expect(matrix["DPU"]["KAY"]).toBe(60000);
  });

  it("excludes an intra-city pair (PST -> CHP, both Bandung) when allowIntraCityBooking=false, even though it IS priced", () => {
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix, globalMatrix, tripExceptions: new Map(), allowIntraCityBooking: false,
    });
    expect(matrix["PST"]?.["CHP"]).toBeUndefined();
  });

  it("includes that same intra-city pair once allowIntraCityBooking=true", () => {
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix, globalMatrix, tripExceptions: new Map(), allowIntraCityBooking: true,
    });
    expect(matrix["PST"]["CHP"]).toBe(45000);
  });

  it("never uses an alight-only stop (KAY) as an origin, or a board-only stop (ATR/JTW) as a destination", () => {
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix, globalMatrix, tripExceptions: new Map(), allowIntraCityBooking: false,
    });
    expect(matrix["KAY"]).toBeUndefined();
    for (const originStopId of Object.keys(matrix)) {
      expect(matrix[originStopId]["ATR"]).toBeUndefined();
      expect(matrix[originStopId]["JTW"]).toBeUndefined();
    }
  });

  it("omits an origin entirely when it has no priced+bookable destination (sparse map)", () => {
    const empty: PriceRuleBlob = { version: 1, cells: {} };
    const matrix = buildPricedMatrixCore({
      stops, patternMatrix: empty, globalMatrix: empty, tripExceptions: new Map(), allowIntraCityBooking: false,
    });
    expect(matrix).toEqual({});
  });
});
