import { and, eq, isNull } from "drizzle-orm";
import { db } from "@server/db";
import {
  passengerPriceMatrices,
  passengerPriceExceptions,
  type PassengerPriceMatrix,
  type PassengerPriceMatrixBlob,
} from "@shared/schema/pricing";

// ============================================================================
// DOMAIN-AGNOSTIC HELPERS
// These know nothing about "passenger" vs "cargo" — they operate purely on
// the `{ version, cells: { "originStopId|destStopId": { price } } }` blob
// shape. Cargo pricing (Prompt #2) reuses these directly against its own
// matrix table/rows; only the table-specific fetch functions below
// (getEffectivePatternMatrix / getGlobalMatrix / trip-exception lookup) are
// domain-specific and will need a cargo-side sibling.
// ============================================================================

export function matrixCellKey(originStopId: string, destinationStopId: string): string {
  return `${originStopId}|${destinationStopId}`;
}

/** Empty cell, missing key, or price<=0 all mean "price not set" -> 0. */
export function getMatrixCellPrice(
  blob: PassengerPriceMatrixBlob | null | undefined,
  originStopId: string,
  destinationStopId: string,
): number {
  if (!blob?.cells) return 0;
  const cell = blob.cells[matrixCellKey(originStopId, destinationStopId)];
  const price = cell?.price;
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : 0;
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
  stop?: { name?: string | null; code?: string | null } | null;
}

export interface MatrixGridRow { stopId: string; stopName: string; stopCode: string; sequence: number; }
export interface MatrixGridCell { originStopId: string; destinationStopId: string; price: number; }

/** Builds an upper-triangular (forward-only) grid for the UI from a matrix
 * row + the pattern's stops-in-sequence. Sequence is ONLY used for render
 * ordering here — the actual cell lookup below is always by stopId pair. */
export function extractMatrixGrid(
  matrixRow: { matrix: unknown } | null | undefined,
  patternStops: MatrixStopLike[],
): { rows: MatrixGridRow[]; cells: MatrixGridCell[] } {
  const sorted = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);
  const rows: MatrixGridRow[] = sorted.map(ps => ({
    stopId: ps.stopId,
    stopName: ps.stop?.name ?? ps.stopId,
    stopCode: ps.stop?.code ?? '',
    sequence: ps.stopSequence,
  }));
  const blob = (matrixRow?.matrix as PassengerPriceMatrixBlob | undefined) ?? { version: 1, cells: {} };
  const cells: MatrixGridCell[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const originStopId = sorted[i].stopId;
      const destinationStopId = sorted[j].stopId;
      cells.push({ originStopId, destinationStopId, price: getMatrixCellPrice(blob, originStopId, destinationStopId) });
    }
  }
  return { rows, cells };
}

/** Inverse of extractMatrixGrid: turns edited grid cells back into a JSONB
 * blob. Cells with price<=0 are OMITTED (not stored as 0) so the blob only
 * ever contains meaningfully-set prices — keeps `hasAnyPricedDestination`
 * cheap (any key present = priced) and the blob small. */
export function serializeMatrixGrid(
  cells: Array<{ originStopId: string; destinationStopId: string; price: number }>,
): PassengerPriceMatrixBlob {
  const out: PassengerPriceMatrixBlob = { version: 1, cells: {} };
  for (const c of cells) {
    if (c.price > 0) {
      out.cells[matrixCellKey(c.originStopId, c.destinationStopId)] = { price: c.price };
    }
  }
  return out;
}

// ============================================================================
// PASSENGER-SPECIFIC FETCH + RESOLVE
// ============================================================================

async function getTripExceptionPrice(tripId: string, originStopId: string, destinationStopId: string): Promise<number> {
  const [row] = await db.select().from(passengerPriceExceptions)
    .where(and(
      eq(passengerPriceExceptions.tripId, tripId),
      eq(passengerPriceExceptions.originStopId, originStopId),
      eq(passengerPriceExceptions.destinationStopId, destinationStopId),
      isNull(passengerPriceExceptions.deletedAt),
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
export async function getEffectivePatternMatrix(patternId: string, serviceDate: string): Promise<PassengerPriceMatrix | null> {
  const rows = await db.select().from(passengerPriceMatrices)
    .where(and(
      eq(passengerPriceMatrices.scope, 'pattern'),
      eq(passengerPriceMatrices.patternId, patternId),
      eq(passengerPriceMatrices.isActive, true),
      isNull(passengerPriceMatrices.deletedAt),
    ));
  if (rows.length === 0) return null;
  return pickActiveSeasonalOrRegular(rows, serviceDate);
}

export async function getGlobalMatrix(): Promise<PassengerPriceMatrix | null> {
  const [row] = await db.select().from(passengerPriceMatrices)
    .where(and(
      eq(passengerPriceMatrices.scope, 'global'),
      eq(passengerPriceMatrices.kind, 'regular'),
      eq(passengerPriceMatrices.isActive, true),
      isNull(passengerPriceMatrices.deletedAt),
    ));
  return row ?? null;
}

/**
 * Backward-compat gate (§5): before the matrix system has ANY data for a
 * pattern (nor a global fallback), consumers should fall back to the
 * legacy price_rules flat/per_leg logic rather than treating every OD as
 * "not priced". Once a matrix row exists (even an empty/partially-filled
 * one an admin started editing), we trust the matrix as authoritative and
 * stop falling back — a 0-priced OD at that point means "genuinely not
 * set yet", not "pre-migration".
 */
export async function matrixSystemHasAnyData(patternId: string): Promise<boolean> {
  const [patternRow] = await db.select({ id: passengerPriceMatrices.id }).from(passengerPriceMatrices)
    .where(and(
      eq(passengerPriceMatrices.scope, 'pattern'),
      eq(passengerPriceMatrices.patternId, patternId),
      isNull(passengerPriceMatrices.deletedAt),
    ));
  if (patternRow) return true;
  const [globalRow] = await db.select({ id: passengerPriceMatrices.id }).from(passengerPriceMatrices)
    .where(and(eq(passengerPriceMatrices.scope, 'global'), isNull(passengerPriceMatrices.deletedAt)));
  return !!globalRow;
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
    { tag: 'pattern', price: patternMatrix ? getMatrixCellPrice(patternMatrix.matrix as PassengerPriceMatrixBlob, originStopId, destinationStopId) : 0 },
    { tag: 'global', price: globalMatrix ? getMatrixCellPrice(globalMatrix.matrix as PassengerPriceMatrixBlob, originStopId, destinationStopId) : 0 },
  ]);
}

/**
 * Cheaper existence-only check used for OD-aware selectability (§6): does
 * ANY destination after `originStopId` on this pattern currently resolve to
 * a price > 0? Fetches the pattern+global matrices ONCE and scans in
 * memory rather than calling resolvePassengerCell per candidate stop.
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
  const patternBlob = patternMatrix?.matrix as PassengerPriceMatrixBlob | undefined;
  const globalBlob = globalMatrix?.matrix as PassengerPriceMatrixBlob | undefined;

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
  const patternBlob = patternMatrix?.matrix as PassengerPriceMatrixBlob | undefined;
  const globalBlob = globalMatrix?.matrix as PassengerPriceMatrixBlob | undefined;

  return destinationStopIds.map(destinationStopId => {
    const patternPrice = getMatrixCellPrice(patternBlob, originStopId, destinationStopId);
    const price = patternPrice > 0 ? patternPrice : getMatrixCellPrice(globalBlob, originStopId, destinationStopId);
    return { destinationStopId, price };
  });
}
