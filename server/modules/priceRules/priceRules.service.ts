import { and, eq, isNull } from "drizzle-orm";
import { db } from "@server/db";
import { IStorage } from "@server/storage.interface";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import { webSocketService } from "@server/realtime/ws";
import {
  priceRules,
  priceRuleExceptions,
  type PriceRule,
  type PriceRuleBlob,
} from "@shared/schema/pricing";
import {
  extractMatrixGrid,
  serializeMatrixGrid,
  matrixCellKey,
  buildPricedMatrix,
  type MatrixGridRow,
  type MatrixGridCell,
  type PricedMatrixStopInput,
} from "./priceRules.resolver";

export class StalePriceRuleError extends Error {
  constructor() {
    super("Data harga sudah diubah pihak lain sejak Anda membukanya. Muat ulang lalu coba simpan kembali.");
    this.name = "StalePriceRuleError";
  }
}

export interface PriceSyncStatus {
  missingPairs: Array<{ originStopId: string; destinationStopId: string; originName: string; destinationName: string }>;
  stalePairs: string[]; // cell keys present in the rule but no longer a valid forward pair in current pattern_stops
}

/**
 * OD-matrix pricing service. This IS the pricing system now (identity
 * swap complete) — the old flat/per_leg CRUD (getPriceRules/
 * createPriceRule/updatePriceRule/deletePriceRule on storage) is gone.
 */
export class PriceRulesService {
  constructor(private storage: IStorage) {}

  async listPriceRules(patternId?: string): Promise<PriceRule[]> {
    const conds = [isNull(priceRules.deletedAt)];
    if (patternId) {
      conds.push(eq(priceRules.patternId, patternId));
    } else {
      conds.push(eq(priceRules.scope, 'global'));
    }
    return db.select().from(priceRules).where(and(...conds));
  }

  private async getOrInitMatrixRow(scope: 'global' | 'pattern', patternId: string | undefined, kind: 'regular' | 'seasonal', matrixId?: string): Promise<PriceRule | null> {
    if (matrixId) {
      const [row] = await db.select().from(priceRules)
        .where(and(eq(priceRules.id, matrixId), isNull(priceRules.deletedAt)));
      return row ?? null;
    }
    const conds = [
      eq(priceRules.scope, scope),
      eq(priceRules.kind, kind),
      isNull(priceRules.deletedAt),
    ];
    if (scope === 'pattern' && patternId) conds.push(eq(priceRules.patternId, patternId));
    const [row] = await db.select().from(priceRules).where(and(...conds));
    return row ?? null;
  }

  /** Grid for the PATTERN tier (upper-triangular, from pattern_stops). */
  async getPatternPriceGrid(patternId: string, kind: 'regular' | 'seasonal' = 'regular', matrixId?: string): Promise<{
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
  async getGlobalPriceList(): Promise<{ matrixId: string | null; updatedAt: string | null; cells: Array<{ originStopId: string; destinationStopId: string; price: number }> }> {
    const row = await this.getOrInitMatrixRow('global', undefined, 'regular');
    const blob = (row?.matrix as PriceRuleBlob | undefined) ?? { version: 1, cells: {} };
    const cells = Object.entries(blob.cells).map(([key, v]) => {
      const [originStopId, destinationStopId] = key.split('|');
      return { originStopId, destinationStopId, price: v.price };
    });
    return { matrixId: row?.id ?? null, updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null, cells };
  }

  /** Upsert-with-optimistic-lock save for either tier. `expectedUpdatedAt`
   * must match the currently stored row's updated_at, or null when
   * creating the very first row for this (scope,pattern,kind) combo. */
  async savePriceRule(params: {
    scope: 'global' | 'pattern';
    patternId?: string;
    kind?: 'regular' | 'seasonal';
    matrixId?: string;
    name?: string;
    validFrom?: string | null;
    validTo?: string | null;
    cells: Array<{ originStopId: string; destinationStopId: string; price: number }>;
    expectedUpdatedAt: string | null;
  }, ctx: ServiceContext): Promise<PriceRule> {
    requirePermission(ctx, 'master.price_rules');
    const kind = params.kind ?? 'regular';
    const blob = serializeMatrixGrid(params.cells);

    const existing = await this.getOrInitMatrixRow(params.scope, params.patternId, kind, params.matrixId);

    if (existing) {
      const currentUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).toISOString() : null;
      if (params.expectedUpdatedAt !== currentUpdatedAt) {
        throw new StalePriceRuleError();
      }
      const [updated] = await db.update(priceRules)
        .set({
          matrix: blob,
          name: params.name ?? existing.name,
          validFrom: params.validFrom !== undefined ? (params.validFrom ? new Date(params.validFrom) : null) : existing.validFrom,
          validTo: params.validTo !== undefined ? (params.validTo ? new Date(params.validTo) : null) : existing.validTo,
          updatedAt: new Date(),
        })
        .where(eq(priceRules.id, existing.id))
        .returning();
      webSocketService.emitPriceRulesChanged({ patternId: params.patternId });
      return updated;
    }

    if (params.expectedUpdatedAt !== null) {
      // Caller thought a row already existed (stale client state / row
      // deleted concurrently) but none is found now.
      throw new StalePriceRuleError();
    }

    const [created] = await db.insert(priceRules).values({
      scope: params.scope,
      patternId: params.scope === 'pattern' ? params.patternId : null,
      kind,
      name: params.name ?? null,
      validFrom: params.validFrom ? new Date(params.validFrom) : null,
      validTo: params.validTo ? new Date(params.validTo) : null,
      matrix: blob,
      isActive: true,
    }).returning();
    webSocketService.emitPriceRulesChanged({ patternId: params.patternId });
    return created;
  }

  async listSeasonalTemplates(patternId: string): Promise<PriceRule[]> {
    return db.select().from(priceRules)
      .where(and(
        eq(priceRules.scope, 'pattern'),
        eq(priceRules.patternId, patternId),
        eq(priceRules.kind, 'seasonal'),
        isNull(priceRules.deletedAt),
      ));
  }

  /** Seeds a new seasonal template by copying the current regular rule's
   * cells (or empty if no regular rule exists yet). */
  async createSeasonalTemplate(patternId: string, name: string, validFrom: string, validTo: string, duplicateFromRegular: boolean, ctx: ServiceContext): Promise<PriceRule> {
    requirePermission(ctx, 'master.price_rules');
    let cells: PriceRuleBlob['cells'] = {};
    if (duplicateFromRegular) {
      const regular = await this.getOrInitMatrixRow('pattern', patternId, 'regular');
      const blob = regular?.matrix as PriceRuleBlob | undefined;
      if (blob?.cells) cells = { ...blob.cells };
    }
    const [created] = await db.insert(priceRules).values({
      scope: 'pattern',
      patternId,
      kind: 'seasonal',
      name,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      matrix: { version: 1, cells },
      isActive: true,
    }).returning();
    webSocketService.emitPriceRulesChanged({ patternId });
    return created;
  }

  async setPriceRuleActive(matrixId: string, isActive: boolean, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, 'master.price_rules');
    await db.update(priceRules).set({ isActive, updatedAt: new Date() }).where(eq(priceRules.id, matrixId));
    webSocketService.emitPriceRulesChanged();
  }

  async deletePriceRule(matrixId: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, 'master.price_rules');
    await db.update(priceRules).set({ deletedAt: new Date() }).where(eq(priceRules.id, matrixId));
    webSocketService.emitPriceRulesChanged();
  }

  // ---- Trip exceptions -----------------------------------------------

  async listTripExceptions(tripId: string) {
    return db.select().from(priceRuleExceptions)
      .where(and(eq(priceRuleExceptions.tripId, tripId), isNull(priceRuleExceptions.deletedAt)));
  }

  async upsertTripException(tripId: string, originStopId: string, destinationStopId: string, price: number, ctx: ServiceContext) {
    requirePermission(ctx, 'master.price_rules');
    const [existing] = await db.select().from(priceRuleExceptions)
      .where(and(
        eq(priceRuleExceptions.tripId, tripId),
        eq(priceRuleExceptions.originStopId, originStopId),
        eq(priceRuleExceptions.destinationStopId, destinationStopId),
        isNull(priceRuleExceptions.deletedAt),
      ));
    if (existing) {
      const [updated] = await db.update(priceRuleExceptions)
        .set({ price: price.toFixed(2), updatedAt: new Date() })
        .where(eq(priceRuleExceptions.id, existing.id))
        .returning();
      webSocketService.emitPriceRulesChanged({ tripId });
      return updated;
    }
    const [created] = await db.insert(priceRuleExceptions).values({
      tripId, originStopId, destinationStopId, price: price.toFixed(2),
    }).returning();
    webSocketService.emitPriceRulesChanged({ tripId });
    return created;
  }

  async deleteTripException(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, 'master.price_rules');
    const [existing] = await db.select().from(priceRuleExceptions).where(eq(priceRuleExceptions.id, id));
    await db.update(priceRuleExceptions).set({ deletedAt: new Date() }).where(eq(priceRuleExceptions.id, id));
    webSocketService.emitPriceRulesChanged({ tripId: existing?.tripId });
  }

  // ---- Sync (read-time, no webhooks) ----------------------------------

  /** Compares the pattern's CURRENT forward-direction OD pairs (from live
   * pattern_stops) against keys present in its regular rule. Never
   * auto-mutates; UI shows an alert + manual "Sync" button that calls
   * syncMissingPairs() below.
   *
   * Mirrors PriceGrid's disableSameCityCells filter: when the pattern has
   * allowIntraCityBooking = false, same-city OD pairs are hidden from the
   * matrix UI and must also be excluded from the sync count so the alert
   * matches exactly the inputs the user can see. */
  async computePriceSyncStatus(patternId: string): Promise<PriceSyncStatus> {
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

    const regular = await this.getOrInitMatrixRow('pattern', patternId, 'regular');
    const blob = (regular?.matrix as PriceRuleBlob | undefined) ?? { version: 1, cells: {} };
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
  async syncMissingPairs(patternId: string, ctx: ServiceContext): Promise<PriceRule> {
    requirePermission(ctx, 'master.price_rules');
    const status = await this.computePriceSyncStatus(patternId);
    const existing = await this.getOrInitMatrixRow('pattern', patternId, 'regular');
    const blob: PriceRuleBlob = (existing?.matrix as PriceRuleBlob | undefined)
      ? { version: 1, cells: { ...(existing!.matrix as PriceRuleBlob).cells } }
      : { version: 1, cells: {} };

    for (const pair of status.missingPairs) {
      const key = matrixCellKey(pair.originStopId, pair.destinationStopId);
      if (!(key in blob.cells)) blob.cells[key] = { price: 0 };
    }

    if (existing) {
      const [updated] = await db.update(priceRules)
        .set({ matrix: blob, updatedAt: new Date() })
        .where(eq(priceRules.id, existing.id))
        .returning();
      webSocketService.emitPriceRulesChanged({ patternId });
      return updated;
    }
    const [created] = await db.insert(priceRules).values({
      scope: 'pattern', patternId, kind: 'regular', matrix: blob, isActive: true,
    }).returning();
    webSocketService.emitPriceRulesChanged({ patternId });
    return created;
  }

  /**
   * Exception-aware priced OD matrix for one trip — the CSO-facing sibling
   * of AppService.getTripDetail's inline buildPricedMatrix call (Step 2 of
   * the OD-aware pricedMatrix feature). Fetches trip -> pattern ->
   * stopTimes -> stops itself (CSO's RouteTimeline has no other reason to
   * already hold this data the way AppService does), then delegates to the
   * SAME buildPricedMatrix the App API uses, so both consumers agree on
   * exactly one definition of "priced" — no second, divergent
   * implementation. Read-only, no permission check (mirrors
   * listPricedDestinationsFromOrigin's route: booking-flow UI, not admin).
   * Returns {} for a trip with no pattern.
   */
  async getPricedMatrixForTrip(tripId: string): Promise<Record<string, Record<string, number>>> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip?.patternId) return {};

    const [pattern, stopTimes] = await Promise.all([
      this.storage.getTripPatternById(trip.patternId),
      this.storage.getTripStopTimesWithEffectiveFlags(tripId),
    ]);

    const stopIds = [...new Set(stopTimes.map(st => st.stopId))];
    const stopDetails = await this.storage.getStopsByIds(stopIds);
    const cityByStopId = new Map(stopDetails.map(s => [s.id, s.city ?? null]));

    const stops: PricedMatrixStopInput[] = stopTimes.map(st => ({
      stopId: st.stopId,
      stopSequence: st.stopSequence,
      boardingAllowed: st.effectiveBoardingAllowed,
      alightingAllowed: st.effectiveAlightingAllowed,
      city: cityByStopId.get(st.stopId) ?? null,
    }));

    return buildPricedMatrix({
      patternId: trip.patternId,
      tripId,
      serviceDate: String(trip.serviceDate),
      stops,
      allowIntraCityBooking: pattern?.allowIntraCityBooking ?? false,
    });
  }
}
