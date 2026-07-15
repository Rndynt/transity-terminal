import { and, eq, isNull } from "drizzle-orm";
import { db } from "@server/db";
import {
  cargoRates,
  cargoRateExceptions,
  type CargoRate,
  type CargoRateBlob,
} from "@shared/schema/cargo";
import {
  matrixCellKey,
  getMatrixCellPrice,
  pickFirstPriced,
  pickActiveSeasonalOrRegular,
  extractMatrixGrid,
  serializeMatrixGrid,
  type MatrixStopLike,
  type MatrixGridRow,
  type MatrixGridCell,
} from "@modules/priceRules/priceRules.resolver";

/**
 * Cargo-side sibling of priceRules.resolver.ts (design decision #5 —
 * "sibling resolver, option B"). The domain-agnostic helpers
 * (`matrixCellKey`, `getMatrixCellPrice`, `pickFirstPriced`,
 * `pickActiveSeasonalOrRegular`, `extractMatrixGrid`, `serializeMatrixGrid`)
 * are IMPORTED and reused as-is — not copy-pasted or forked. Only the
 * table-specific fetch functions below (`getTripExceptionCargoPrice`,
 * `getEffectivePatternCargoMatrix`) are cargo-specific, mirroring
 * `getTripExceptionPrice`/`getEffectivePatternMatrix` in the passenger
 * resolver but scoped by (pattern, cargoType) instead of just pattern, and
 * reading `pricePerKg` instead of `price`.
 *
 * Precedence (NO global tier — design decision #4):
 *   trip exception (cargo_rate_exceptions) > pattern (seasonal-if-active
 *   else regular) > 0 ("Tarif belum diatur").
 */

const CARGO_CELL_FIELD = 'pricePerKg';

async function getTripExceptionCargoPrice(
  tripId: string,
  cargoTypeId: string,
  originStopId: string,
  destinationStopId: string,
): Promise<number> {
  const [row] = await db.select().from(cargoRateExceptions)
    .where(and(
      eq(cargoRateExceptions.tripId, tripId),
      eq(cargoRateExceptions.cargoTypeId, cargoTypeId),
      eq(cargoRateExceptions.originStopId, originStopId),
      eq(cargoRateExceptions.destinationStopId, destinationStopId),
      isNull(cargoRateExceptions.deletedAt),
    ));
  if (!row) return 0;
  const price = Number(row.pricePerKg);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

/** Pattern+cargoType tier: prefer an ACTIVE seasonal template whose window
 * contains serviceDate, else the regular row. Returns null if neither
 * exists. Mirrors getEffectivePatternMatrix, +cargoTypeId dimension. */
export async function getEffectivePatternCargoMatrix(
  patternId: string,
  cargoTypeId: string,
  serviceDate: string,
): Promise<CargoRate | null> {
  const rows = await db.select().from(cargoRates)
    .where(and(
      eq(cargoRates.patternId, patternId),
      eq(cargoRates.cargoTypeId, cargoTypeId),
      eq(cargoRates.isActive, true),
      isNull(cargoRates.deletedAt),
    ));
  if (rows.length === 0) return null;
  return pickActiveSeasonalOrRegular(rows, serviceDate);
}

/**
 * THE shared resolver every cargo consumer (CSO quote-tariff, passenger
 * quick-cargo via app.service.createAppCargo → cargo.service.calculateTariff)
 * must call for a single (cargoType, OD)'s per-kg price. Precedence:
 * trip-exception > pattern (seasonal-if-active else regular) > 0. No global
 * fallback — cargo pricing always needs a pattern to resolve against.
 */
export async function resolveCargoCell(args: {
  patternId: string;
  tripId?: string;
  cargoTypeId: string;
  originStopId: string;
  destinationStopId: string;
  serviceDate: string;
}): Promise<{ pricePerKg: number; source: 'trip' | 'pattern' | 'none' }> {
  const { patternId, tripId, cargoTypeId, originStopId, destinationStopId, serviceDate } = args;

  const [tripPrice, patternMatrix] = await Promise.all([
    tripId ? getTripExceptionCargoPrice(tripId, cargoTypeId, originStopId, destinationStopId) : Promise.resolve(0),
    getEffectivePatternCargoMatrix(patternId, cargoTypeId, serviceDate),
  ]);

  const resolved = pickFirstPriced<'trip' | 'pattern'>([
    { tag: 'trip', price: tripPrice },
    {
      tag: 'pattern',
      price: patternMatrix
        ? getMatrixCellPrice(patternMatrix.matrix as CargoRateBlob, originStopId, destinationStopId, CARGO_CELL_FIELD)
        : 0,
    },
  ]);

  return { pricePerKg: resolved.price, source: resolved.source };
}

/**
 * Cheaper existence-only check used for OD-aware selectability: does ANY
 * destination after `originStopId` on this pattern currently resolve to a
 * pricePerKg > 0 for this cargoType? Mirrors
 * hasAnyPricedDestinationFromOrigin (pattern tier only — no global tier to
 * also check, unlike passenger).
 */
export async function hasAnyPricedDestinationFromOriginCargo(args: {
  patternId: string;
  cargoTypeId: string;
  originStopId: string;
  destinationStopIds: string[];
  serviceDate: string;
}): Promise<boolean> {
  const { patternId, cargoTypeId, originStopId, destinationStopIds, serviceDate } = args;
  if (destinationStopIds.length === 0) return false;

  const patternMatrix = await getEffectivePatternCargoMatrix(patternId, cargoTypeId, serviceDate);
  const patternBlob = patternMatrix?.matrix as CargoRateBlob | undefined;

  return destinationStopIds.some(destinationStopId =>
    getMatrixCellPrice(patternBlob, originStopId, destinationStopId, CARGO_CELL_FIELD) > 0
  );
}

/**
 * Like hasAnyPricedDestinationFromOriginCargo but returns the actual
 * resolved pricePerKg per candidate destination (pattern tier only — trip
 * exceptions intentionally not applied here, same rationale as
 * listPricedDestinationsFromOrigin: this powers a pre-selection stop
 * picker, not the authoritative per-shipment quote).
 */
export async function listPricedDestinationsFromOriginCargo(args: {
  patternId: string;
  cargoTypeId: string;
  originStopId: string;
  destinationStopIds: string[];
  serviceDate: string;
}): Promise<Array<{ destinationStopId: string; pricePerKg: number }>> {
  const { patternId, cargoTypeId, originStopId, destinationStopIds, serviceDate } = args;
  if (destinationStopIds.length === 0) return [];

  const patternMatrix = await getEffectivePatternCargoMatrix(patternId, cargoTypeId, serviceDate);
  const patternBlob = patternMatrix?.matrix as CargoRateBlob | undefined;

  return destinationStopIds.map(destinationStopId => ({
    destinationStopId,
    pricePerKg: getMatrixCellPrice(patternBlob, originStopId, destinationStopId, CARGO_CELL_FIELD),
  }));
}

// ============================================================================
// Thin grid-extract/serialize wrappers for the cargoRates.service.ts admin
// CRUD (grid editor). Reuse the shared, generalized extractMatrixGrid/
// serializeMatrixGrid from priceRules.resolver.ts with field='pricePerKg'
// instead of forking them.
// ============================================================================

export function extractCargoMatrixGrid(
  matrixRow: { matrix: unknown } | null | undefined,
  patternStops: MatrixStopLike[],
): { rows: MatrixGridRow[]; cells: MatrixGridCell[] } {
  return extractMatrixGrid(matrixRow, patternStops, CARGO_CELL_FIELD);
}

export function serializeCargoMatrixGrid(
  cells: MatrixGridCell[],
): { version: 1; cells: Record<string, Record<string, number>> } {
  return serializeMatrixGrid(cells, CARGO_CELL_FIELD);
}

export { matrixCellKey };
