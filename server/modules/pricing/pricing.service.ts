import { IStorage } from "@server/storage.interface";
import { resolvePassengerCell, matrixSystemHasAnyData } from "./priceMatrix.resolver";

export interface FareQuote {
  total: number;
  perPassenger: number;
  breakdown: {
    base: number;
    legs: number;
    pricePerLeg: number;
    pricingMode: string;
    multiplier: number;
    ruleId: string;
    ruleScope: string;
    source?: 'trip' | 'pattern' | 'global' | 'legacy';
  };
}

export class PricingService {
  constructor(private storage: IStorage) {}

  async quoteFare(tripId: string, originSeq: number, destinationSeq: number, seatClass?: string): Promise<FareQuote> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) throw new Error('TRIP_NOT_FOUND');

    // --- OD-matrix path (primary) ---------------------------------------
    if (trip.patternId) {
      const stopTimes = await this.storage.getTripStopTimes(tripId);
      const originStopTime = stopTimes.find(st => st.stopSequence === originSeq);
      const destStopTime = stopTimes.find(st => st.stopSequence === destinationSeq);

      if (originStopTime && destStopTime) {
        const resolved = await resolvePassengerCell({
          patternId: trip.patternId,
          tripId,
          originStopId: originStopTime.stopId,
          destinationStopId: destStopTime.stopId,
          serviceDate: String(trip.serviceDate),
        });

        if (resolved.price > 0) {
          return {
            total: resolved.price,
            perPassenger: resolved.price,
            breakdown: {
              base: resolved.price,
              legs: Math.max(destinationSeq - originSeq, 0),
              pricePerLeg: 0,
              pricingMode: 'od_matrix',
              multiplier: 1,
              ruleId: resolved.source,
              ruleScope: resolved.source,
              source: resolved.source as 'trip' | 'pattern' | 'global',
            },
          };
        }

        // Resolved to 0. Only fall back to legacy price_rules if the
        // matrix system has genuinely never been configured for this
        // pattern (pre-migration state) — otherwise 0 means "this OD
        // really has no price set yet" and we must say so, not silently
        // reach for a linear flat/per_leg guess that would be wrong for
        // 3+-city patterns.
        const hasMatrixData = await matrixSystemHasAnyData(trip.patternId);
        if (!hasMatrixData) {
          const legacy = await this.legacyQuoteFare(tripId, originSeq, destinationSeq, trip.patternId);
          if (legacy) return legacy;
        }
        throw new Error('NO_PRICE_RULE');
      }
    }

    // Couldn't resolve stop times for the requested seqs (or trip has no
    // pattern) — fall back to legacy for backward compatibility.
    const legacy = await this.legacyQuoteFare(tripId, originSeq, destinationSeq, trip.patternId ?? undefined);
    if (legacy) return legacy;
    throw new Error('NO_PRICE_RULE');
  }

  /** Pre-matrix behavior, kept only as a fallback for patterns that
   * haven't been migrated to the OD-matrix system yet (§5). Remove once
   * all patterns have a matrix row (see final report "known limitations"). */
  private async legacyQuoteFare(tripId: string, originSeq: number, destinationSeq: number, patternId?: string): Promise<FareQuote | null> {
    if (!patternId) return null;
    const rules = await this.storage.getPriceRulesForTrip(tripId, patternId);
    if (rules.length === 0) return null;

    const rule = rules[0];
    const ruleData = rule.rule as { basePricePerLeg?: number; multiplier?: number; pricingMode?: string };
    const basePricePerLeg: number = ruleData.basePricePerLeg ?? 0;
    const multiplier: number = ruleData.multiplier ?? 1;
    const pricingMode: string = ruleData.pricingMode ?? 'per_leg';

    const legs = await this.storage.getTripLegs(tripId);
    const journeyLegs = legs.filter(leg => leg.legIndex >= originSeq && leg.legIndex < destinationSeq);

    const totalBase = pricingMode === 'flat'
      ? basePricePerLeg
      : journeyLegs.length * basePricePerLeg;
    const totalAmount = Math.round(totalBase * multiplier);
    if (totalAmount <= 0) return null;

    return {
      total: totalAmount,
      perPassenger: totalAmount,
      breakdown: {
        base: totalBase,
        legs: journeyLegs.length,
        pricePerLeg: basePricePerLeg,
        pricingMode,
        multiplier,
        ruleId: rule.id,
        ruleScope: rule.scope,
        source: 'legacy',
      },
    };
  }
}
