import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@server/db";
import { IStorage } from "@server/storage.interface";
import {
  passengerPriceMatrices,
  passengerPriceExceptions,
  type PassengerPriceMatrix,
  type PassengerPriceMatrixBlob,
} from "@shared/schema/pricing";
import {
  extractMatrixGrid,
  serializeMatrixGrid,
  matrixCellKey,
  type MatrixGridRow,
  type MatrixGridCell,
} from "./priceMatrix.resolver";

export class StaleMatrixError extends Error {
  constructor() {
    super("Data matriks sudah diubah pihak lain sejak Anda membukanya. Muat ulang lalu coba simpan kembali.");
    this.name = "StaleMatrixError";
  }
}

export interface MatrixSyncStatus {
  missingPairs: Array<{ originStopId: string; destinationStopId: string; originName: string; destinationName: string }>;
  stalePairs: string[]; // cell keys present in matrix but no longer a valid forward pair in current pattern_stops
}

export class PriceMatrixService {
  constructor(private storage: IStorage) {}

  async listMatrices(patternId?: string): Promise<PassengerPriceMatrix[]> {
    const conds = [isNull(passengerPriceMatrices.deletedAt)];
    if (patternId) {
      conds.push(eq(passengerPriceMatrices.patternId, patternId));
    } else {
      conds.push(eq(passengerPriceMatrices.scope, 'global'));
    }
    return db.select().from(passengerPriceMatrices).where(and(...conds));
  }

  private async getOrInitMatrixRow(scope: 'global' | 'pattern', patternId: string | undefined, kind: 'regular' | 'seasonal', matrixId?: string): Promise<PassengerPriceMatrix | null> {
    if (matrixId) {
      const [row] = await db.select().from(passengerPriceMatrices)
        .where(and(eq(passengerPriceMatrices.id, matrixId), isNull(passengerPriceMatrices.deletedAt)));
      return row ?? null;
    }
    const conds = [
      eq(passengerPriceMatrices.scope, scope),
      eq(passengerPriceMatrices.kind, kind),
      isNull(passengerPriceMatrices.deletedAt),
    ];
    if (scope === 'pattern' && patternId) conds.push(eq(passengerPriceMatrices.patternId, patternId));
    const [row] = await db.select().from(passengerPriceMatrices).where(and(...conds));
    return row ?? null;
  }

  /** Grid for the PATTERN tier (upper-triangular, from pattern_stops). */
  async getPatternMatrixGrid(patternId: string, kind: 'regular' | 'seasonal' = 'regular', matrixId?: string): Promise<{
    matrixId: string | null; updatedAt: string | null; rows: MatrixGridRow[]; cells: MatrixGridCell[];
  }> {
    const patternStops = await this.storage.getPatternStops(patternId);
    const row = await this.getOrInitMatrixRow('pattern', patternId, kind, matrixId);
    const grid = extractMatrixGrid(row ?? null, patternStops);
    return {
      matrixId: row?.id ?? null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      ...grid,
    };
  }

  /** Global tier has no fixed stop set, so it's exposed as a flat list of
   * priced OD-pair rows (stop names resolved for display) rather than a
   * grid — there's no single pattern's stop-sequence to build a grid from. */
  async getGlobalMatrixList(): Promise<{ matrixId: string | null; updatedAt: string | null; cells: Array<{ originStopId: string; destinationStopId: string; price: number }> }> {
    const row = await this.getOrInitMatrixRow('global', undefined, 'regular');
    const blob = (row?.matrix as PassengerPriceMatrixBlob | undefined) ?? { version: 1, cells: {} };
    const cells = Object.entries(blob.cells).map(([key, v]) => {
      const [originStopId, destinationStopId] = key.split('|');
      return { originStopId, destinationStopId, price: v.price };
    });
    return { matrixId: row?.id ?? null, updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null, cells };
  }

  /** Upsert-with-optimistic-lock save for either tier. `expectedUpdatedAt`
   * must match the currently stored row's updated_at, or null when
   * creating the very first row for this (scope,pattern,kind) combo. */
  async saveMatrix(params: {
    scope: 'global' | 'pattern';
    patternId?: string;
    kind?: 'regular' | 'seasonal';
    matrixId?: string;
    name?: string;
    validFrom?: string | null;
    validTo?: string | null;
    cells: Array<{ originStopId: string; destinationStopId: string; price: number }>;
    expectedUpdatedAt: string | null;
  }): Promise<PassengerPriceMatrix> {
    const kind = params.kind ?? 'regular';
    const blob = serializeMatrixGrid(params.cells);

    const existing = await this.getOrInitMatrixRow(params.scope, params.patternId, kind, params.matrixId);

    if (existing) {
      const currentUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).toISOString() : null;
      if (params.expectedUpdatedAt !== currentUpdatedAt) {
        throw new StaleMatrixError();
      }
      const [updated] = await db.update(passengerPriceMatrices)
        .set({
          matrix: blob,
          name: params.name ?? existing.name,
          validFrom: params.validFrom !== undefined ? (params.validFrom ? new Date(params.validFrom) : null) : existing.validFrom,
          validTo: params.validTo !== undefined ? (params.validTo ? new Date(params.validTo) : null) : existing.validTo,
          updatedAt: new Date(),
        })
        .where(eq(passengerPriceMatrices.id, existing.id))
        .returning();
      return updated;
    }

    if (params.expectedUpdatedAt !== null) {
      // Caller thought a row already existed (stale client state / row
      // deleted concurrently) but none is found now.
      throw new StaleMatrixError();
    }

    const [created] = await db.insert(passengerPriceMatrices).values({
      scope: params.scope,
      patternId: params.scope === 'pattern' ? params.patternId : null,
      kind,
      name: params.name ?? null,
      validFrom: params.validFrom ? new Date(params.validFrom) : null,
      validTo: params.validTo ? new Date(params.validTo) : null,
      matrix: blob,
      isActive: true,
    }).returning();
    return created;
  }

  async listSeasonalTemplates(patternId: string): Promise<PassengerPriceMatrix[]> {
    return db.select().from(passengerPriceMatrices)
      .where(and(
        eq(passengerPriceMatrices.scope, 'pattern'),
        eq(passengerPriceMatrices.patternId, patternId),
        eq(passengerPriceMatrices.kind, 'seasonal'),
        isNull(passengerPriceMatrices.deletedAt),
      ));
  }

  /** Seeds a new seasonal template by copying the current regular matrix's
   * cells (or empty if no regular matrix exists yet). */
  async createSeasonalTemplate(patternId: string, name: string, validFrom: string, validTo: string, duplicateFromRegular: boolean): Promise<PassengerPriceMatrix> {
    let cells: PassengerPriceMatrixBlob['cells'] = {};
    if (duplicateFromRegular) {
      const regular = await this.getOrInitMatrixRow('pattern', patternId, 'regular');
      const blob = regular?.matrix as PassengerPriceMatrixBlob | undefined;
      if (blob?.cells) cells = { ...blob.cells };
    }
    const [created] = await db.insert(passengerPriceMatrices).values({
      scope: 'pattern',
      patternId,
      kind: 'seasonal',
      name,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      matrix: { version: 1, cells },
      isActive: true,
    }).returning();
    return created;
  }

  async setMatrixActive(matrixId: string, isActive: boolean): Promise<void> {
    await db.update(passengerPriceMatrices).set({ isActive, updatedAt: new Date() }).where(eq(passengerPriceMatrices.id, matrixId));
  }

  async deleteMatrix(matrixId: string): Promise<void> {
    await db.update(passengerPriceMatrices).set({ deletedAt: new Date() }).where(eq(passengerPriceMatrices.id, matrixId));
  }

  // ---- Trip exceptions -----------------------------------------------

  async listTripExceptions(tripId: string) {
    return db.select().from(passengerPriceExceptions)
      .where(and(eq(passengerPriceExceptions.tripId, tripId), isNull(passengerPriceExceptions.deletedAt)));
  }

  async upsertTripException(tripId: string, originStopId: string, destinationStopId: string, price: number) {
    const [existing] = await db.select().from(passengerPriceExceptions)
      .where(and(
        eq(passengerPriceExceptions.tripId, tripId),
        eq(passengerPriceExceptions.originStopId, originStopId),
        eq(passengerPriceExceptions.destinationStopId, destinationStopId),
        isNull(passengerPriceExceptions.deletedAt),
      ));
    if (existing) {
      const [updated] = await db.update(passengerPriceExceptions)
        .set({ price: price.toFixed(2), updatedAt: new Date() })
        .where(eq(passengerPriceExceptions.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(passengerPriceExceptions).values({
      tripId, originStopId, destinationStopId, price: price.toFixed(2),
    }).returning();
    return created;
  }

  async deleteTripException(id: string): Promise<void> {
    await db.update(passengerPriceExceptions).set({ deletedAt: new Date() }).where(eq(passengerPriceExceptions.id, id));
  }

  // ---- Sync (read-time, no webhooks — §8) -----------------------------

  /** Compares the pattern's CURRENT forward-direction OD pairs (from live
   * pattern_stops) against keys present in its regular matrix. Never
   * auto-mutates; UI shows an alert + manual "Sync" button that calls
   * syncMissingPairs() below. */
  async computeMatrixSyncStatus(patternId: string): Promise<MatrixSyncStatus> {
    const patternStops = await this.storage.getPatternStops(patternId);
    const sorted = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);

    const currentPairKeys = new Set<string>();
    const pairMeta = new Map<string, { originStopId: string; destinationStopId: string; originName: string; destinationName: string }>();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = matrixCellKey(sorted[i].stopId, sorted[j].stopId);
        currentPairKeys.add(key);
        pairMeta.set(key, {
          originStopId: sorted[i].stopId,
          destinationStopId: sorted[j].stopId,
          originName: sorted[i].stop?.name ?? sorted[i].stopId,
          destinationName: sorted[j].stop?.name ?? sorted[j].stopId,
        });
      }
    }

    const regular = await this.getOrInitMatrixRow('pattern', patternId, 'regular');
    const blob = (regular?.matrix as PassengerPriceMatrixBlob | undefined) ?? { version: 1, cells: {} };
    const existingKeys = new Set(Object.keys(blob.cells));

    const missingPairs = [...currentPairKeys]
      .filter(k => !existingKeys.has(k))
      .map(k => pairMeta.get(k)!);
    const stalePairs = [...existingKeys].filter(k => !currentPairKeys.has(k));

    return { missingPairs, stalePairs };
  }

  /** Adds missing cells with price 0 (never overwrites filled cells; stale
   * keys are left as-is — resolver ignores keys that no longer match a
   * live forward pair). */
  async syncMissingPairs(patternId: string): Promise<PassengerPriceMatrix> {
    const status = await this.computeMatrixSyncStatus(patternId);
    const existing = await this.getOrInitMatrixRow('pattern', patternId, 'regular');
    const blob: PassengerPriceMatrixBlob = (existing?.matrix as PassengerPriceMatrixBlob | undefined)
      ? { version: 1, cells: { ...(existing!.matrix as PassengerPriceMatrixBlob).cells } }
      : { version: 1, cells: {} };

    for (const pair of status.missingPairs) {
      const key = matrixCellKey(pair.originStopId, pair.destinationStopId);
      if (!(key in blob.cells)) blob.cells[key] = { price: 0 };
    }

    if (existing) {
      const [updated] = await db.update(passengerPriceMatrices)
        .set({ matrix: blob, updatedAt: new Date() })
        .where(eq(passengerPriceMatrices.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(passengerPriceMatrices).values({
      scope: 'pattern', patternId, kind: 'regular', matrix: blob, isActive: true,
    }).returning();
    return created;
  }
}
