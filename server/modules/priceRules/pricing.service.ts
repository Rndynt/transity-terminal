import { IStorage } from "@server/storage.interface";
import { resolvePassengerCell } from "./priceRules.resolver";

export interface FareQuote {
  total: number;
  perPassenger: number;
  breakdown: {
    base: number;
    legs: number;
    pricePerLeg: number;
    multiplier: number;
    ruleId: string;
    ruleScope: string;
    source?: 'trip' | 'pattern' | 'global';
  };
}

export class PricingService {
  constructor(private storage: IStorage) {}

  async quoteFare(tripId: string, originSeq: number, destinationSeq: number, seatClass?: string): Promise<FareQuote> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) throw new Error('TRIP_NOT_FOUND');
    if (!trip.patternId) throw new Error('NO_PRICE_RULE');

    const stopTimes = await this.storage.getTripStopTimes(tripId);
    const originStopTime = stopTimes.find(st => st.stopSequence === originSeq);
    const destStopTime = stopTimes.find(st => st.stopSequence === destinationSeq);
    if (!originStopTime || !destStopTime) throw new Error('NO_PRICE_RULE');

    const resolved = await resolvePassengerCell({
      patternId: trip.patternId,
      tripId,
      originStopId: originStopTime.stopId,
      destinationStopId: destStopTime.stopId,
      serviceDate: String(trip.serviceDate),
    });

    if (resolved.price <= 0) throw new Error('NO_PRICE_RULE');

    return {
      total: resolved.price,
      perPassenger: resolved.price,
      breakdown: {
        base: resolved.price,
        legs: Math.max(destinationSeq - originSeq, 0),
        pricePerLeg: 0,
        multiplier: 1,
        ruleId: resolved.source,
        ruleScope: resolved.source,
        source: resolved.source as 'trip' | 'pattern' | 'global',
      },
    };
  }
}
