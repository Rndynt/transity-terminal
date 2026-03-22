import { IStorage } from "../../storage.interface";
import { Trip, TripLeg } from "@shared/schema";

export class TripLegsService {
  constructor(private storage: IStorage) {}

  async getTripLegs(tripId: string): Promise<TripLeg[]> {
    return await this.storage.getTripLegs(tripId);
  }

  async deriveLegsFromTrip(trip: Trip): Promise<void> {
    // Get stop times for the trip
    const stopTimes = await this.storage.getTripStopTimes(trip.id);
    
    if (stopTimes.length < 2) {
      throw new Error("Trip must have at least 2 stops to derive legs");
    }

    // Sort by stop sequence
    stopTimes.sort((a, b) => a.stopSequence - b.stopSequence);

    // Clear existing legs
    await this.storage.deleteTripLegs(trip.id);

    // Create legs between consecutive stops
    const legs = [];
    for (let i = 0; i < stopTimes.length - 1; i++) {
      const fromStop = stopTimes[i];
      const toStop = stopTimes[i + 1];

      if (!fromStop.departAt || !toStop.arriveAt) {
        throw new Error(`Missing departure/arrival times for leg ${i + 1}`);
      }

      const departAt = new Date(fromStop.departAt);
      const arriveAt = new Date(toStop.arriveAt);
      const durationMin = Math.round((arriveAt.getTime() - departAt.getTime()) / (1000 * 60));

      legs.push({
        tripId: trip.id,
        legIndex: i + 1,
        fromStopId: fromStop.stopId,
        toStopId: toStop.stopId,
        departAt: fromStop.departAt,
        arriveAt: toStop.arriveAt,
        durationMin
      });
    }

    // Insert all legs
    for (const leg of legs) {
      await this.storage.createTripLeg(leg);
    }
  }
}
