import { and, eq, isNull } from "drizzle-orm";
import { db } from "@server/db";
import { IStorage } from "@server/storage.interface";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import {
  cargoRates,
  cargoRateExceptions,
  type CargoRate,
  type CargoRateBlob,
} from "@shared/schema/cargo";
import {
  matrixCellKey,
  type MatrixGridRow,
  type MatrixGridCell,
} from "@modules/priceRules/priceRules.resolver";
import { extractCargoMatrixGrid, serializeCargoMatrixGrid } from "./cargoRates.resolver";

export class StaleCargoRateError extends Error {
  constructor() {
    super("Data tarif kargo sudah diubah pihak lain sejak Anda membukanya. Muat ulang lalu coba simpan kembali.");
    this.name = "StaleCargoRateError";
  }
}

export interface CargoSyncStatus {
  missingPairs: Array<{ originStopId: string; destinationStopId: string; originName: string; destinationName: string }>;
  stalePairs: string[]; // cell keys present in the rate but no longer a valid forward pair in current pattern_stops
}

/**
 * Cargo OD-matrix master service. Mirrors PriceRulesService (see
 * priceRules.service.ts) with one added dimension throughout: every matrix
 * row is bound to (patternId, cargoTypeId), not just patternId — cargo has
 * no global tier (design decision #4), so every lookup here requires both.
 */
export class CargoRatesService {
  constructor(private storage: IStorage) {}

  private async getOrInitMatrixRow(patternId: string, cargoTypeId: string, kind: 'regular' | 'seasonal', matrixId?: string): Promise<CargoRate | null> {
    if (matrixId) {
      const [row] = await db.select().from(cargoRates)
        .where(and(eq(cargoRates.id, matrixId), isNull(cargoRates.deletedAt)));
      return row ?? null;
    }
    const [row] = await db.select().from(cargoRates)
      .where(and(
        eq(cargoRates.patternId, patternId),
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.kind, kind),
        isNull(cargoRates.deletedAt),
      ));
    return row ?? null;
  }

  /** Grid for a (pattern, cargoType) pair (upper-triangular, from pattern_stops). */
  async getPatternCargoGrid(patternId: string, cargoTypeId: string, kind: 'regular' | 'seasonal' = 'regular', matrixId?: string): Promise<{
    matrixId: string | null; updatedAt: string | null; rows: MatrixGridRow[]; cells: MatrixGridCell[];
  }> {
    const patternStops = await this.storage.getPatternStops(patternId);
    const row = await this.getOrInitMatrixRow(patternId, cargoTypeId, kind, matrixId);
    const grid = extractCargoMatrixGrid(row ?? null, patternStops);
    return {
      matrixId: row?.id ?? null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      ...grid,
    };
  }

  /** Upsert-with-optimistic-lock save. `expectedUpdatedAt` must match the
   * currently stored row's updated_at, or null when creating the very
   * first row for this (pattern, cargoType, kind) combo. */
  async saveCargoRate(params: {
    patternId: string;
    cargoTypeId: string;
    kind?: 'regular' | 'seasonal';
    matrixId?: string;
    name?: string;
    validFrom?: string | null;
    validTo?: string | null;
    cells: Array<{ originStopId: string; destinationStopId: string; pricePerKg: number }>;
    expectedUpdatedAt: string | null;
  }, ctx: ServiceContext): Promise<CargoRate> {
    requirePermission(ctx, 'master.cargo_rates');
    const kind = params.kind ?? 'regular';
    const blob = serializeCargoMatrixGrid(params.cells);

    const existing = await this.getOrInitMatrixRow(params.patternId, params.cargoTypeId, kind, params.matrixId);

    if (existing) {
      const currentUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).toISOString() : null;
      if (params.expectedUpdatedAt !== currentUpdatedAt) {
        throw new StaleCargoRateError();
      }
      const [updated] = await db.update(cargoRates)
        .set({
          matrix: blob,
          name: params.name ?? existing.name,
          validFrom: params.validFrom !== undefined ? (params.validFrom ? new Date(params.validFrom) : null) : existing.validFrom,
          validTo: params.validTo !== undefined ? (params.validTo ? new Date(params.validTo) : null) : existing.validTo,
          updatedAt: new Date(),
        })
        .where(eq(cargoRates.id, existing.id))
        .returning();
      return updated;
    }

    if (params.expectedUpdatedAt !== null) {
      // Caller thought a row already existed (stale client state / row
      // deleted concurrently) but none is found now.
      throw new StaleCargoRateError();
    }

    const [created] = await db.insert(cargoRates).values({
      patternId: params.patternId,
      cargoTypeId: params.cargoTypeId,
      kind,
      name: params.name ?? null,
      validFrom: params.validFrom ? new Date(params.validFrom) : null,
      validTo: params.validTo ? new Date(params.validTo) : null,
      matrix: blob,
      isActive: true,
    }).returning();
    return created;
  }

  async listSeasonalTemplates(patternId: string, cargoTypeId: string): Promise<CargoRate[]> {
    return db.select().from(cargoRates)
      .where(and(
        eq(cargoRates.patternId, patternId),
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.kind, 'seasonal'),
        isNull(cargoRates.deletedAt),
      ));
  }

  /** Seeds a new seasonal template by copying the current regular row's
   * cells for this (pattern, cargoType) (or empty if none exists yet). */
  async createSeasonalTemplate(patternId: string, cargoTypeId: string, name: string, validFrom: string, validTo: string, duplicateFromRegular: boolean, ctx: ServiceContext): Promise<CargoRate> {
    requirePermission(ctx, 'master.cargo_rates');
    let cells: CargoRateBlob['cells'] = {};
    if (duplicateFromRegular) {
      const regular = await this.getOrInitMatrixRow(patternId, cargoTypeId, 'regular');
      const blob = regular?.matrix as CargoRateBlob | undefined;
      if (blob?.cells) cells = { ...blob.cells };
    }
    const [created] = await db.insert(cargoRates).values({
      patternId,
      cargoTypeId,
      kind: 'seasonal',
      name,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      matrix: { version: 1, cells },
      isActive: true,
    }).returning();
    return created;
  }

  /**
   * v1 duplication feature (design decision #6): copy an entire cargo
   * matrix (all cells) from one cargoType to ANOTHER cargoType, keeping
   * the same pattern/kind/seasonal-window identity — e.g. "Paket Kecil"
   * JKT-BDG-01 regular grid duplicated as the starting point for "Paket
   * Sedang" on the same pattern, then the operator edits deltas. If a row
   * already exists at the destination identity, its cells are REPLACED
   * (never merged) — duplication always means "start from an exact copy".
   */
  async duplicateMatrixToCargoType(sourceMatrixId: string, toCargoTypeId: string, ctx: ServiceContext): Promise<CargoRate> {
    requirePermission(ctx, 'master.cargo_rates');
    const [source] = await db.select().from(cargoRates)
      .where(and(eq(cargoRates.id, sourceMatrixId), isNull(cargoRates.deletedAt)));
    if (!source) throw new Error('Matrix sumber tidak ditemukan');
    if (source.cargoTypeId === toCargoTypeId) {
      throw new Error('cargoType asal dan tujuan duplikasi tidak boleh sama');
    }
    const sourceBlob = (source.matrix as CargoRateBlob | undefined) ?? { version: 1, cells: {} };

    const [existing] = await db.select().from(cargoRates).where(and(
      eq(cargoRates.patternId, source.patternId),
      eq(cargoRates.cargoTypeId, toCargoTypeId),
      eq(cargoRates.kind, source.kind),
      isNull(cargoRates.deletedAt),
      source.validFrom ? eq(cargoRates.validFrom, source.validFrom) : isNull(cargoRates.validFrom),
      source.validTo ? eq(cargoRates.validTo, source.validTo) : isNull(cargoRates.validTo),
    ));

    if (existing) {
      const [updated] = await db.update(cargoRates)
        .set({ matrix: sourceBlob, updatedAt: new Date() })
        .where(eq(cargoRates.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(cargoRates).values({
      patternId: source.patternId,
      cargoTypeId: toCargoTypeId,
      kind: source.kind,
      name: source.name,
      validFrom: source.validFrom,
      validTo: source.validTo,
      matrix: sourceBlob,
      isActive: true,
    }).returning();
    return created;
  }

  async setCargoRateActive(matrixId: string, isActive: boolean, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, 'master.cargo_rates');
    await db.update(cargoRates).set({ isActive, updatedAt: new Date() }).where(eq(cargoRates.id, matrixId));
  }

  async deleteCargoRate(matrixId: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, 'master.cargo_rates');
    await db.update(cargoRates).set({ deletedAt: new Date() }).where(eq(cargoRates.id, matrixId));
  }

  // ---- Trip exceptions -----------------------------------------------

  async listTripExceptions(tripId: string) {
    return db.select().from(cargoRateExceptions)
      .where(and(eq(cargoRateExceptions.tripId, tripId), isNull(cargoRateExceptions.deletedAt)));
  }

  async upsertTripException(tripId: string, cargoTypeId: string, originStopId: string, destinationStopId: string, pricePerKg: number, ctx: ServiceContext) {
    requirePermission(ctx, 'master.cargo_rates');
    const [existing] = await db.select().from(cargoRateExceptions)
      .where(and(
        eq(cargoRateExceptions.tripId, tripId),
        eq(cargoRateExceptions.cargoTypeId, cargoTypeId),
        eq(cargoRateExceptions.originStopId, originStopId),
        eq(cargoRateExceptions.destinationStopId, destinationStopId),
        isNull(cargoRateExceptions.deletedAt),
      ));
    if (existing) {
      const [updated] = await db.update(cargoRateExceptions)
        .set({ pricePerKg: pricePerKg.toFixed(2), updatedAt: new Date() })
        .where(eq(cargoRateExceptions.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(cargoRateExceptions).values({
      tripId, cargoTypeId, originStopId, destinationStopId, pricePerKg: pricePerKg.toFixed(2),
    }).returning();
    return created;
  }

  async deleteTripException(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, 'master.cargo_rates');
    await db.update(cargoRateExceptions).set({ deletedAt: new Date() }).where(eq(cargoRateExceptions.id, id));
  }

  // ---- Sync (read-time, no webhooks) ----------------------------------

  /** Compares the pattern's CURRENT forward-direction OD pairs (from live
   * pattern_stops) against keys present in this (pattern, cargoType)'s
   * regular row. Never auto-mutates; UI shows an alert + manual "Sync"
   * button that calls syncMissingPairs() below. Sync is per (pattern,
   * cargoType) — design decision #9.
   *
   * Mirrors PriceGrid's disableSameCityCells filter: when the pattern has
   * allowIntraCityBooking = false, same-city OD pairs are hidden from the
   * matrix UI and must also be excluded from the sync count so the alert
   * matches exactly the inputs the user can see. */
  async computeCargoSyncStatus(patternId: string, cargoTypeId: string): Promise<CargoSyncStatus> {
    const [patternStops, pattern] = await Promise.all([
      this.storage.getPatternStops(patternId),
      this.storage.getTripPatternById(patternId),
    ]);
    const sorted = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);
    const disableSameCity = !pattern?.allowIntraCityBooking;

    const currentPairKeys = new Set<string>();
    const pairMeta = new Map<string, { originStopId: string; destinationStopId: string; originName: string; destinationName: string }>();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const origin = sorted[i];
        const dest = sorted[j];
        // Skip same-city pairs when the pattern does not allow intra-city
        // routes — these cells are hidden in PriceGrid and must not count
        // as "missing" in the sync alert.
        if (disableSameCity && origin.stop?.city && dest.stop?.city && origin.stop.city === dest.stop.city) {
          continue;
        }
        const key = matrixCellKey(origin.stopId, dest.stopId);
        currentPairKeys.add(key);
        pairMeta.set(key, {
          originStopId: origin.stopId,
          destinationStopId: dest.stopId,
          originName: origin.stop?.name ?? origin.stopId,
          destinationName: dest.stop?.name ?? dest.stopId,
        });
      }
    }

    const regular = await this.getOrInitMatrixRow(patternId, cargoTypeId, 'regular');
    const blob = (regular?.matrix as CargoRateBlob | undefined) ?? { version: 1, cells: {} };
    const existingKeys = new Set(Object.keys(blob.cells));

    const missingPairs = [...currentPairKeys]
      .filter(k => !existingKeys.has(k))
      .map(k => pairMeta.get(k)!);
    const stalePairs = [...existingKeys].filter(k => !currentPairKeys.has(k));

    return { missingPairs, stalePairs };
  }

  /** Adds missing cells with pricePerKg 0 (never overwrites filled cells;
   * stale keys are left as-is — resolver ignores keys that no longer
   * match a live forward pair). */
  async syncMissingPairs(patternId: string, cargoTypeId: string, ctx: ServiceContext): Promise<CargoRate> {
    requirePermission(ctx, 'master.cargo_rates');
    const status = await this.computeCargoSyncStatus(patternId, cargoTypeId);
    const existing = await this.getOrInitMatrixRow(patternId, cargoTypeId, 'regular');
    const blob: CargoRateBlob = (existing?.matrix as CargoRateBlob | undefined)
      ? { version: 1, cells: { ...(existing!.matrix as CargoRateBlob).cells } }
      : { version: 1, cells: {} };

    for (const pair of status.missingPairs) {
      const key = matrixCellKey(pair.originStopId, pair.destinationStopId);
      if (!(key in blob.cells)) blob.cells[key] = { pricePerKg: 0 };
    }

    if (existing) {
      const [updated] = await db.update(cargoRates)
        .set({ matrix: blob, updatedAt: new Date() })
        .where(eq(cargoRates.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(cargoRates).values({
      patternId, cargoTypeId, kind: 'regular', matrix: blob, isActive: true,
    }).returning();
    return created;
  }
}
