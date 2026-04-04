import { IStorage } from "@server/storage.interface";
import { InsertTripStopTime, TripStopTime, Trip } from "@shared/schema";
import { TripLegsService } from "@modules/tripLegs/tripLegs.service";
import { SeatInventoryService } from "@modules/seatInventory/seatInventory.service";

export class TripStopTimesService {
  public storage: IStorage; // Make public so controller can access it
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async getTripStopTimes(tripId: string): Promise<TripStopTime[]> {
    return await this.storage.getTripStopTimes(tripId);
  }

  async createTripStopTime(data: InsertTripStopTime): Promise<TripStopTime> {
    return await this.storage.createTripStopTime(data);
  }

  async updateTripStopTime(id: string, data: Partial<InsertTripStopTime>): Promise<TripStopTime> {
    return await this.storage.updateTripStopTime(id, data);
  }

  async deleteTripStopTime(id: string): Promise<void> {
    await this.storage.deleteTripStopTime(id);
  }

  async getTripStopTimesWithEffectiveFlags(tripId: string): Promise<any[]> {
    const existing = await this.storage.getTripStopTimesWithEffectiveFlags(tripId);
    if (existing.length > 0) return existing;

    const trip = await this.storage.getTripById(tripId);
    if (!trip) return [];

    const patternStops = await this.storage.getPatternStops(trip.patternId);
    if (patternStops.length === 0) return [];

    const stopTimesData = patternStops.map(ps => ({
      tripId,
      stopId: ps.stopId,
      stopSequence: ps.stopSequence,
      arriveAt: null,
      departAt: null,
      dwellSeconds: ps.dwellSeconds || 0,
      boardingAllowed: null,
      alightingAllowed: null,
    }));
    await this.storage.bulkUpsertTripStopTimes(tripId, stopTimesData);

    return await this.storage.getTripStopTimesWithEffectiveFlags(tripId);
  }

  async syncFromPattern(tripId: string): Promise<{ synced: boolean; stopCount: number }> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) throw new Error(`Trip with id ${tripId} not found`);

    const hasBookings = await this.storage.tripHasBookings(tripId);
    if (hasBookings) {
      throw new Error('Tidak bisa sync halte karena trip sudah memiliki booking.');
    }

    const patternStops = await this.storage.getPatternStops(trip.patternId);
    if (patternStops.length === 0) {
      throw new Error('Pola rute belum memiliki halte. Tambahkan halte ke pola rute terlebih dahulu.');
    }

    const stopTimesData = patternStops.map(ps => ({
      tripId,
      stopId: ps.stopId,
      stopSequence: ps.stopSequence,
      arriveAt: null,
      departAt: null,
      dwellSeconds: ps.dwellSeconds || 0,
      boardingAllowed: null,
      alightingAllowed: null,
    }));
    await this.storage.bulkUpsertTripStopTimes(tripId, stopTimesData);

    return { synced: true, stopCount: patternStops.length };
  }

  async bulkUpsertTripStopTimes(tripId: string, stopTimes: any[]): Promise<void> {
    await this.storage.bulkUpsertTripStopTimes(tripId, stopTimes);
  }

  async deriveLegs(tripId: string): Promise<void> {
    const tripLegsService = new TripLegsService(this.storage);
    const trip = await this.storage.getTripById(tripId);
    if (!trip) {
      throw new Error(`Trip with id ${tripId} not found`);
    }
    await tripLegsService.deriveLegsFromTrip(trip);
  }

  async precomputeSeatInventory(tripId: string): Promise<void> {
    const seatInventoryService = new SeatInventoryService(this.storage);
    const trip = await this.storage.getTripById(tripId);
    if (!trip) {
      throw new Error(`Trip with id ${tripId} not found`);
    }
    await seatInventoryService.precomputeInventory(trip);
  }

  async validateStopTimes(tripId: string): Promise<{ valid: boolean; errors: Array<{ stopSequence: number; field: string; message: string }> }> {
    const stopTimes = await this.storage.getTripStopTimes(tripId);
    const errors: Array<{ stopSequence: number; field: string; message: string }> = [];

    if (stopTimes.length < 2) {
      errors.push({ stopSequence: 0, field: 'general', message: 'Trip must have at least 2 stops' });
      return { valid: false, errors };
    }

    // Sort by sequence for validation
    const sortedStopTimes = stopTimes.sort((a, b) => a.stopSequence - b.stopSequence);
    
    for (let i = 0; i < sortedStopTimes.length; i++) {
      const stopTime = sortedStopTimes[i];
      const sequence = stopTime.stopSequence;
      const isFirst = i === 0;
      const isLast = i === sortedStopTimes.length - 1;
      
      // First stop: departure time required
      if (isFirst) {
        if (!stopTime.departAt) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'First stop must have departure time' 
          });
        }
      }
      
      // Last stop: arrival time required
      if (isLast) {
        if (!stopTime.arriveAt) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'arriveAt', 
            message: 'Last stop must have arrival time' 
          });
        }
      }
      
      // Middle stops: if either time is provided, both must be provided
      if (!isFirst && !isLast) {
        const hasArrival = stopTime.arriveAt !== null;
        const hasDeparture = stopTime.departAt !== null;
        
        if (hasArrival && !hasDeparture) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'Departure time required when arrival time is set' 
          });
        }
        
        if (hasDeparture && !hasArrival) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'arriveAt', 
            message: 'Arrival time required when departure time is set' 
          });
        }
      }
      
      // Validate departure >= arrival at same stop
      if (stopTime.arriveAt && stopTime.departAt) {
        if (new Date(stopTime.departAt) < new Date(stopTime.arriveAt)) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'Departure time must be after arrival time' 
          });
        }
      }
      
      // Validate chronological order with previous stop
      if (i > 0) {
        const prevStopTime = sortedStopTimes[i - 1];
        const prevDepartTime = prevStopTime.departAt;
        const currentArriveTime = stopTime.arriveAt;
        
        if (prevDepartTime && currentArriveTime) {
          if (new Date(currentArriveTime) < new Date(prevDepartTime)) {
            errors.push({ 
              stopSequence: sequence, 
              field: 'arriveAt', 
              message: 'Arrival time must be after previous stop departure time' 
            });
          }
        }
        
        // Also check dwell time compliance
        if (prevStopTime.departAt && prevStopTime.arriveAt && stopTime.arriveAt) {
          const prevDwell = prevStopTime.dwellSeconds || 0;
          const expectedMinDepart = new Date(new Date(prevStopTime.arriveAt).getTime() + prevDwell * 1000);
          
          if (new Date(prevStopTime.departAt) < expectedMinDepart) {
            errors.push({ 
              stopSequence: prevStopTime.stopSequence, 
              field: 'departAt', 
              message: `Departure time must account for ${prevDwell} second dwell time` 
            });
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
