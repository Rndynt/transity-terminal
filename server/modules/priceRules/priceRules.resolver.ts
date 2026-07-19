import { and, eq, isNull } from "drizzle-orm";
import { db } from "@server/db";
import {
  priceRules,
  priceRuleExceptions,
  type PriceRule,
  type PriceRuleBlob,
} from "@shared/schema/pricing";

// ============================================================================
// DOMAIN-AGNOSTIC HELPERS
// These know nothing about "passenger" vs "cargo" — they operate purely on
// the `{ version, cells: { "originStopId|destStopId": { price } } }` blob
// shape. Cargo pricing reuses these directly against its own price table/
// rows; only the table-specific fetch functions below
// (getEffectivePatternMatrix / getGlobalMatrix / trip-exception lookup) are
// domain-specific and would need a cargo-side sibling.
// ============================================================================

export function matrixCellKey(originStopId: string, destinationStopId: string): string {
  return `${originStopId}|${destinationStopId}`;
}

/**
 * Empty cell, missing key, or value<=0 all mean "price not set" -> 0.
 *
 * Cargo identity-swap: generalized to be agnostic of the cell's numeric
 * field name — passenger cells are `{ price }`, cargo cells are
 * `{ pricePerKg }`. `field` defaults to `'price'` so every existing
 * passenger call site below (and in priceRules.service.ts) is UNCHANGED;
 * the cargo resolver passes `'pricePerKg'` explicitly.
 *
 * Deliberately loosely-typed on `blob` (a plain `Record<string, unknown>`
 * per cell) rather than threading a generic cell-shape type parameter
 * through: a concrete non-index-signature type like `PriceRuleBlob` or
 * `CargoRateBlob` is awkward for TS to infer against a generic `Record<
 * string, TCell>` parameter (mapped-type inference in that position is
 * unreliable), and this function's whole job is a single dynamic-key
 * lookup that doesn't gain much from that extra precision — correctness
 * here is covered by the resolver test suites (passenger + cargo) instead.
 */
export function getMatrixCellPrice(
  blob: { cells?: Record<string, Record<string, unknown>> } | null | undefined,
  originStopId: string,
  destinationStopId: string,
  field: string = 'price',
): number {
  if (!blob?.cells) return 0;
  const cell = blob.cells[matrixCellKey(originStopId, destinationStopId)];
  const value = cell?.[field];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export interface PriceSource<TTag extends string> { tag: TTag; price: number; }

/** Walks an ORDERED list of already-resolved candidate prices (highest
 * precedence first) and returns the first one that's actually priced
 * (price > 0). This is the shared "precedence walk" both passenger and
 * cargo resolvers should use — the only domain-specific part is what list
 * of sources gets built before calling this. */
export function pickFirstPriced<T extends string>(sources: PriceSource<T>[]): { price: number; source: T | 'none' } {
  for (const s of sources) {
    if (s.price > 0) return { price: s.price, source: s.tag };
  }
  return { price: 0, source: 'none' };
}

export interface MatrixStopLike {
  stopId: string;
  stopSequence: number;
  stop?: { name?: string | null; code?: string | null; city?: string | null } | null;
}

export interface MatrixGridRow { stopId: string; stopName: string; stopCode: string; city: string | null; sequence: number; }
/**
 * Generalized (cargo identity-swap) via an index signature instead of a
 * hardcoded `price: number` — passenger cells carry `price`, cargo cells
 * carry `pricePerKg`. Nothing in either service's `.ts` code statically
 * reads a specific field off these cells (both just JSON-passthrough the
 * grid to the HTTP response), so the looser index signature costs nothing
 * while letting `extractMatrixGrid`/`serializeMatrixGrid` be shared as-is.
 */
export interface MatrixGridCell { originStopId: string; destinationStopId: string; [field: string]: string | number; }

/** Builds an upper-triangular (forward-only) grid for the UI from a price/
 * rate row + the pattern's stops-in-sequence. Sequence is ONLY used for
 * render ordering here — the actual cell lookup below is always by stopId
 * pair. `field` defaults to `'price'` (passenger); cargo passes
 * `'pricePerKg'`. */
export function extractMatrixGrid(
  matrixRow: { matrix: unknown } | null | undefined,
  patternStops: MatrixStopLike[],
  field: string = 'price',
): { rows: MatrixGridRow[]; cells: MatrixGridCell[] } {
  const sorted = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);
  const rows: MatrixGridRow[] = sorted.map(ps => ({
    stopId: ps.stopId,
    stopName: ps.stop?.name ?? ps.stopId,
    stopCode: ps.stop?.code ?? '',
    city: ps.stop?.city ?? null,
    sequence: ps.stopSequence,
  }));
  const blob = (matrixRow?.matrix as { cells?: Record<string, Record<string, unknown>> } | undefined) ?? { cells: {} };
  const cells: MatrixGridCell[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const originStopId = sorted[i].stopId;
      const destinationStopId = sorted[j].stopId;
      const value = getMatrixCellPrice(blob, originStopId, destinationStopId, field);
      cells.push({ originStopId, destinationStopId, [field]: value });
    }
  }
  return { rows, cells };
}

/** Inverse of extractMatrixGrid: turns edited grid cells back into a JSONB
 * blob. Cells with value<=0 are OMITTED (not stored as 0) so the blob only
 * ever contains meaningfully-set prices. `field` defaults to `'price'`
 * (passenger); cargo passes `'pricePerKg'`. */
export function serializeMatrixGrid(
  cells: MatrixGridCell[],
  field: string = 'price',
): { version: 1; cells: Record<string, Record<string, number>> } {
  const out: { version: 1; cells: Record<string, Record<string, number>> } = { version: 1, cells: {} };
  for (const c of cells) {
    const value = c[field];
    if (typeof value === 'number' && value > 0) {
      out.cells[matrixCellKey(c.originStopId, c.destinationStopId)] = { [field]: value };
    }
  }
  return out;
}

// ============================================================================
// PASSENGER-SPECIFIC FETCH + RESOLVE
// ============================================================================

/**
 * Bulk-fetches every non-deleted trip-exception row for ONE trip in a
 * single query, keyed by matrixCellKey("originStopId|destinationStopId")
 * -> price. Used by buildPricedMatrix so building the whole matrix stays
 * O(1) DB round-trips for exceptions regardless of stop count — calling
 * the per-OD getTripExceptionPrice below once per candidate pair would be
 * N+1 (N = number of upper-triangular stop pairs on the pattern).
 */
export async function getTripExceptionsForTrip(tripId: string): Promise<Map<string, number>> {
  const rows = await db.select().from(priceRuleExceptions)
    .where(and(
      eq(priceRuleExceptions.tripId, tripId),
      isNull(priceRuleExceptions.deletedAt),
    ));
  const map = new Map<string, number>();
  for (const row of rows) {
    const price = Number(row.price);
    if (Number.isFinite(price) && price > 0) {
      map.set(matrixCellKey(row.originStopId, row.destinationStopId), price);
    }
  }
  return map;
}

async function getTripExceptionPrice(tripId: string, originStopId: string, destinationStopId: string): Promise<number> {
  const [row] = await db.select().from(priceRuleExceptions)
    .where(and(
      eq(priceRuleExceptions.tripId, tripId),
      eq(priceRuleExceptions.originStopId, originStopId),
      eq(priceRuleExceptions.destinationStopId, destinationStopId),
      isNull(priceRuleExceptions.deletedAt),
    ));
  if (!row) return 0;
  const price = Number(row.price);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

/** Pure precedence logic: pick the seasonal row whose window contains
 * serviceDate, else the regular row, else null. Extracted from
 * getEffectivePatternMatrix so it's unit-testable without a DB. */
export function pickActiveSeasonalOrRegular<T extends { kind: string; validFrom?: Date | string | null; validTo?: Date | string | null }>(
  rows: T[],
  serviceDate: string,
): T | null {
  const serviceDateObj = new Date(serviceDate);
  const seasonal = rows.find(r =>
    r.kind === 'seasonal' &&
    r.validFrom && r.validTo &&
    new Date(r.validFrom).getTime() <= serviceDateObj.getTime() &&
    serviceDateObj.getTime() <= new Date(r.validTo).getTime()
  );
  if (seasonal) return seasonal;
  return rows.find(r => r.kind === 'regular') ?? null;
}

/** Pattern tier: prefer an ACTIVE seasonal template whose window contains
 * serviceDate, else the regular row. Returns null if neither exists. */
export async function getEffectivePatternMatrix(patternId: string, serviceDate: string): Promise<PriceRule | null> {
  const rows = await db.select().from(priceRules)
    .where(and(
      eq(priceRules.scope, 'pattern'),
      eq(priceRules.patternId, patternId),
      eq(priceRules.isActive, true),
      isNull(priceRules.deletedAt),
    ));
  if (rows.length === 0) return null;
  return pickActiveSeasonalOrRegular(rows, serviceDate);
}

export async function getGlobalMatrix(): Promise<PriceRule | null> {
  const [row] = await db.select().from(priceRules)
    .where(and(
      eq(priceRules.scope, 'global'),
      eq(priceRules.kind, 'regular'),
      eq(priceRules.isActive, true),
      isNull(priceRules.deletedAt),
    ));
  return row ?? null;
}

/**
 * THE shared resolver every passenger consumer (CSO quote, App search,
 * schedule webhook snapshot) must call for a single OD's price. Precedence:
 * trip-exception > pattern (seasonal-if-active else regular) > global > 0.
 */
export async function resolvePassengerCell(args: {
  patternId: string;
  tripId?: string;
  originStopId: string;
  destinationStopId: string;
  serviceDate: string;
}): Promise<{ price: number; source: 'trip' | 'pattern' | 'global' | 'none' }> {
  const { patternId, tripId, originStopId, destinationStopId, serviceDate } = args;

  const [tripPrice, patternMatrix, globalMatrix] = await Promise.all([
    tripId ? getTripExceptionPrice(tripId, originStopId, destinationStopId) : Promise.resolve(0),
    getEffectivePatternMatrix(patternId, serviceDate),
    getGlobalMatrix(),
  ]);

  return pickFirstPriced<'trip' | 'pattern' | 'global'>([
    { tag: 'trip', price: tripPrice },
    { tag: 'pattern', price: patternMatrix ? getMatrixCellPrice(patternMatrix.matrix as PriceRuleBlob, originStopId, destinationStopId) : 0 },
    { tag: 'global', price: globalMatrix ? getMatrixCellPrice(globalMatrix.matrix as PriceRuleBlob, originStopId, destinationStopId) : 0 },
  ]);
}

/**
 * Cheaper existence-only check used for OD-aware selectability: does ANY
 * destination after `originStopId` on this pattern currently resolve to a
 * price > 0? Fetches the pattern+global rows ONCE and scans in memory
 * rather than calling resolvePassengerCell per candidate stop.
 */
export async function hasAnyPricedDestinationFromOrigin(args: {
  patternId: string;
  originStopId: string;
  destinationStopIds: string[];
  serviceDate: string;
}): Promise<boolean> {
  const { patternId, originStopId, destinationStopIds, serviceDate } = args;
  if (destinationStopIds.length === 0) return false;

  const [patternMatrix, globalMatrix] = await Promise.all([
    getEffectivePatternMatrix(patternId, serviceDate),
    getGlobalMatrix(),
  ]);
  const patternBlob = patternMatrix?.matrix as PriceRuleBlob | undefined;
  const globalBlob = globalMatrix?.matrix as PriceRuleBlob | undefined;

  return destinationStopIds.some(destinationStopId =>
    getMatrixCellPrice(patternBlob, originStopId, destinationStopId) > 0 ||
    getMatrixCellPrice(globalBlob, originStopId, destinationStopId) > 0
  );
}

/**
 * Like hasAnyPricedDestinationFromOrigin but returns the actual resolved
 * price per candidate destination (pattern/global tier only — trip
 * exceptions are intentionally NOT applied here since this powers the
 * "Pilih Rute" stop-picker which runs before a trip's exceptions are the
 * primary concern; the authoritative per-booking price still goes through
 * resolvePassengerCell/quoteFare at hold/quote time).
 */
export async function listPricedDestinationsFromOrigin(args: {
  patternId: string;
  originStopId: string;
  destinationStopIds: string[];
  serviceDate: string;
}): Promise<Array<{ destinationStopId: string; price: number }>> {
  const { patternId, originStopId, destinationStopIds, serviceDate } = args;
  if (destinationStopIds.length === 0) return [];

  const [patternMatrix, globalMatrix] = await Promise.all([
    getEffectivePatternMatrix(patternId, serviceDate),
    getGlobalMatrix(),
  ]);
  const patternBlob = patternMatrix?.matrix as PriceRuleBlob | undefined;
  const globalBlob = globalMatrix?.matrix as PriceRuleBlob | undefined;

  return destinationStopIds.map(destinationStopId => {
    const patternPrice = getMatrixCellPrice(patternBlob, originStopId, destinationStopId);
    const price = patternPrice > 0 ? patternPrice : getMatrixCellPrice(globalBlob, originStopId, destinationStopId);
    return { destinationStopId, price };
  });
}

/**
 * Stop shape buildPricedMatrix needs per stop on the trip: identity +
 * ordering + the EFFECTIVE (schedule-exception-aware) boarding/alighting
 * flags + city. Callers already have this after loading a trip's ordered
 * stop times (e.g. IStorage.getTripStopTimesWithEffectiveFlags + the stops
 * themselves) — see AppService.getTripDetail and
 * PriceRulesService.getPricedMatrixForTrip for the two current call sites.
 */
export interface PricedMatrixStopInput {
  stopId: string;
  stopSequence: number;
  boardingAllowed: boolean;
  alightingAllowed: boolean;
  city: string | null;
}

/**
 * Pure matrix-building core, split out from buildPricedMatrix so it's
 * unit-testable without a DB (same reasoning as pickActiveSeasonalOrRegular
 * above). Walks the SAME upper-triangular (j > i, sequence order) pairing
 * as extractMatrixGrid, resolves each pair with the SAME precedence as
 * resolvePassengerCell (trip-exception > pattern > global, via
 * pickFirstPriced), then applies the 3 eligibility filters booking enforces
 * (see booking.helpers.ts validateBoardingAlighting +
 * ~lines 190-217 for the intra-city guard, mirrored identically in
 * cargoRates.service.ts ~274-293) so a pair only ends up in the result if
 * it would actually be bookable as-is.
 */
export function buildPricedMatrixCore(args: {
  stops: PricedMatrixStopInput[];
  patternMatrix: PriceRuleBlob | null | undefined;
  globalMatrix: PriceRuleBlob | null | undefined;
  tripExceptions: Map<string, number>;
  allowIntraCityBooking: boolean;
}): Record<string, Record<string, number>> {
  const { patternMatrix, globalMatrix, tripExceptions, allowIntraCityBooking } = args;
  const sorted = [...args.stops].sort((a, b) => a.stopSequence - b.stopSequence);
  const result: Record<string, Record<string, number>> = {};

  for (let i = 0; i < sorted.length; i++) {
    const origin = sorted[i];
    if (!origin.boardingAllowed) continue; // filter 1: origin must allow boarding

    for (let j = i + 1; j < sorted.length; j++) {
      const dest = sorted[j];
      if (!dest.alightingAllowed) continue; // filter 2: destination must allow alighting
      // filter 3: intra-city guard (skip same-city pairs unless the pattern opts in)
      if (!allowIntraCityBooking && origin.city && dest.city && origin.city === dest.city) continue;

      const key = matrixCellKey(origin.stopId, dest.stopId);
      const { price } = pickFirstPriced<'trip' | 'pattern' | 'global'>([
        { tag: 'trip', price: tripExceptions.get(key) ?? 0 },
        { tag: 'pattern', price: getMatrixCellPrice(patternMatrix, origin.stopId, dest.stopId) },
        { tag: 'global', price: getMatrixCellPrice(globalMatrix, origin.stopId, dest.stopId) },
      ]);

      if (price > 0) {
        if (!result[origin.stopId]) result[origin.stopId] = {};
        result[origin.stopId][dest.stopId] = price;
      }
    }
  }

  return result;
}

/**
 * Exception-aware, sparse, per-origin priced OD matrix for one trip:
 * `{ [originStopId]: { [destinationStopId]: price } }`. Origins with no
 * priced+bookable destination are omitted entirely.
 *
 * This is DELIBERATELY separate from listPricedDestinationsFromOrigin
 * above: that helper is pattern+global ONLY (trip-exceptions intentionally
 * skipped, see its docstring) and is fine for its existing lightweight
 * callers, but is NOT accurate enough to gate booking — a trip-exception
 * can price (or unprice) a pair the pattern/global tiers disagree with.
 * buildPricedMatrix is exception-accurate and is the source of truth for
 * `GET /api/app/trips/:id`'s `pricedMatrix` field and the CSO route
 * picker's OD-aware "Belum Ada Harga" gating — both need the exact same
 * answer booking will actually enforce. Do not use
 * listPricedDestinationsFromOrigin for new booking-gating logic.
 *
 * Fetches the pattern matrix, global matrix, and this trip's exceptions
 * ONCE (Promise.all) regardless of how many stops the pattern has.
 */
export async function buildPricedMatrix(args: {
  patternId: string;
  tripId: string;
  serviceDate: string;
  stops: PricedMatrixStopInput[];
  allowIntraCityBooking: boolean;
}): Promise<Record<string, Record<string, number>>> {
  const [patternMatrixRow, globalMatrixRow, tripExceptions] = await Promise.all([
    getEffectivePatternMatrix(args.patternId, args.serviceDate),
    getGlobalMatrix(),
    getTripExceptionsForTrip(args.tripId),
  ]);

  return buildPricedMatrixCore({
    stops: args.stops,
    patternMatrix: patternMatrixRow?.matrix as PriceRuleBlob | undefined,
    globalMatrix: globalMatrixRow?.matrix as PriceRuleBlob | undefined,
    tripExceptions,
    allowIntraCityBooking: args.allowIntraCityBooking,
  });
}
