import { IStorage } from "@server/storage.interface";

export class PricingService {
  constructor(private storage: IStorage) {}

  async quoteFare(tripId: string, originSeq: number, destinationSeq: number, seatClass?: string): Promise<{
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
    };
  }> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) throw new Error('TRIP_NOT_FOUND');

    const rules = await this.storage.getPriceRulesForTrip(tripId, trip.patternId!);
    if (rules.length === 0) {
      throw new Error('NO_PRICE_RULE');
    }

    const rule = rules[0];
    const ruleData = rule.rule as { basePricePerLeg?: number; multiplier?: number; pricingMode?: string };
    const basePricePerLeg: number = ruleData.basePricePerLeg ?? 0;
    const multiplier: number = ruleData.multiplier ?? 1;
    const pricingMode: string = ruleData.pricingMode ?? 'per_leg';

    const legs = await this.storage.getTripLegs(tripId);
    const journeyLegs = legs.filter(leg =>
      leg.legIndex >= originSeq && leg.legIndex < destinationSeq
    );

    const totalBase = pricingMode === 'flat'
      ? basePricePerLeg
      : journeyLegs.length * basePricePerLeg;
    const totalAmount = Math.round(totalBase * multiplier);

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
      }
    };
  }
}
