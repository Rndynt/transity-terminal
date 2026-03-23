import { IStorage } from "../../storage.interface";
import { InsertTripBase, TripBase, Trip, InsertTrip } from "@shared/schema";
import { TripLegsService } from "../tripLegs/tripLegs.service";
import { SeatInventoryService } from "../seatInventory/seatInventory.service";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { fromZonedHHMMToUtc, getDayInTZ, formatTimeInTZ, ensureDefaultTimezone, normalizeTimeFormat } from "../../utils/timezone";

export class TripBasesService {
  private tripLegsService: TripLegsService;
  private seatInventoryService: SeatInventoryService;

  constructor(private storage: IStorage) {
    this.tripLegsService = new TripLegsService(storage);
    this.seatInventoryService = new SeatInventoryService(storage);
  }

  async getAllTripBases(): Promise<TripBase[]> {
    return await this.storage.getTripBases();
  }

  async getTripBaseById(id: string): Promise<TripBase> {
    const base = await this.storage.getTripBaseById(id);
    if (!base) {
      throw new Error(`Trip base with id ${id} not found`);
    }
    return base;
  }

  async createTripBase(data: InsertTripBase): Promise<TripBase> {
    // Validate defaultStopTimes structure
    this.validateDefaultStopTimes(data.defaultStopTimes);
    return await this.storage.createTripBase(data);
  }

  async updateTripBase(id: string, data: Partial<InsertTripBase>): Promise<TripBase> {
    await this.getTripBaseById(id);
    
    // Validate defaultStopTimes if provided
    if (data.defaultStopTimes) {
      this.validateDefaultStopTimes(data.defaultStopTimes);
    }
    
    return await this.storage.updateTripBase(id, data);
  }

  async deleteTripBase(id: string): Promise<void> {
    await this.getTripBaseById(id);
    await this.storage.deleteTripBase(id);
  }

  /**
   * Check if a base is eligible for a given service date
   */
  async isBaseEligible(base: TripBase, serviceDate: string): Promise<boolean> {
    // Check if base is active
    if (!base.active) {
      return false;
    }

    const serviceDateObj = parseISO(serviceDate);
    
    // Check date range
    if (base.validFrom && serviceDateObj < parseISO(base.validFrom)) {
      return false;
    }
    if (base.validTo && serviceDateObj > parseISO(base.validTo)) {
      return false;
    }

    // Check day of week using the base's timezone to avoid timezone drift
    const timezone = ensureDefaultTimezone(base.timezone);
    const dayOfWeek = getDayInTZ(serviceDate, timezone);
    const dayFlags = [base.sun, base.mon, base.tue, base.wed, base.thu, base.fri, base.sat];
    
    return dayFlags[dayOfWeek];
  }

  /**
   * Get eligible bases for a given service date
   */
  async getEligibleBases(serviceDate: string): Promise<TripBase[]> {
    const allBases = await this.getAllTripBases();
    const eligibleBases: TripBase[] = [];

    for (const base of allBases) {
      if (await this.isBaseEligible(base, serviceDate)) {
        eligibleBases.push(base);
      }
    }

    return eligibleBases;
  }

  /**
   * Convert defaultStopTimes local time strings to timestamptz using base timezone + serviceDate.
   * Handles overnight routes: if a converted timestamp is <= the previous one, it means midnight
   * was crossed, so we add the accumulated day offset to keep times strictly increasing.
   */
  computeDefaultTimestamps(base: TripBase, serviceDate: string): any[] {
    const defaultStopTimes = base.defaultStopTimes as any[];
    
    if (!Array.isArray(defaultStopTimes)) {
      throw new Error('defaultStopTimes must be an array');
    }

    const timezone = ensureDefaultTimezone(base.timezone);
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const result: any[] = [];
    let dayOffset = 0;
    let lastTimestamp: Date | null = null;

    for (let index = 0; index < defaultStopTimes.length; index++) {
      const stopTime = defaultStopTimes[index];
      const { stopSequence, arriveAt, departAt } = stopTime;

      const normalizedArriveAt = normalizeTimeFormat(arriveAt);
      const normalizedDepartAt = normalizeTimeFormat(departAt);

      // Validation rules
      if (index === 0) {
        if (!normalizedDepartAt) {
          throw new Error(`First stop (sequence ${stopSequence}) must have valid departAt time. Got: "${departAt}"`);
        }
      } else if (index === defaultStopTimes.length - 1) {
        if (!normalizedArriveAt) {
          throw new Error(`Last stop (sequence ${stopSequence}) must have valid arriveAt time. Got: "${arriveAt}"`);
        }
      } else {
        if ((normalizedArriveAt && !normalizedDepartAt) || (!normalizedArriveAt && normalizedDepartAt)) {
          throw new Error(`Intermediate stop (sequence ${stopSequence}) must have both arriveAt and departAt or neither. Got arriveAt="${arriveAt}", departAt="${departAt}"`);
        }
      }

      // Convert to UTC using current day offset, then bump offset if midnight is crossed
      let arriveAtTimestamp: Date | null = null;
      let departAtTimestamp: Date | null = null;

      if (normalizedArriveAt) {
        const raw = fromZonedHHMMToUtc(serviceDate, normalizedArriveAt, timezone);
        if (raw) {
          if (lastTimestamp && raw.getTime() + dayOffset * ONE_DAY_MS <= lastTimestamp.getTime()) {
            dayOffset++;
          }
          arriveAtTimestamp = new Date(raw.getTime() + dayOffset * ONE_DAY_MS);
          lastTimestamp = arriveAtTimestamp;
        }
      }

      if (normalizedDepartAt) {
        const raw = fromZonedHHMMToUtc(serviceDate, normalizedDepartAt, timezone);
        if (raw) {
          if (lastTimestamp && raw.getTime() + dayOffset * ONE_DAY_MS <= lastTimestamp.getTime()) {
            dayOffset++;
          }
          departAtTimestamp = new Date(raw.getTime() + dayOffset * ONE_DAY_MS);
          lastTimestamp = departAtTimestamp;
        }
      }

      result.push({ stopSequence, arriveAt: arriveAtTimestamp, departAt: departAtTimestamp });
    }

    // Final monotonicity check (should never fire now, kept as safety net)
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      const prevTime = prev.departAt || prev.arriveAt;
      const currTime = curr.arriveAt || curr.departAt;
      if (prevTime && currTime && prevTime >= currTime) {
        throw new Error(`Stop times must be monotonic (increasing). Stop ${prev.stopSequence} departs/arrives at or after stop ${curr.stopSequence}`);
      }
    }

    return result;
  }

  /**
   * Ensure a trip is materialized for the given base and service date (idempotent and race-safe)
   */
  async ensureMaterializedTrip(baseId: string, serviceDate: string): Promise<string> {
    // 1. Load base and validate eligibility
    const base = await this.getTripBaseById(baseId);
    const isEligible = await this.isBaseEligible(base, serviceDate);
    
    if (!isEligible) {
      throw new Error('base-not-eligible');
    }

    // 2. Check if trip already exists
    const existingTrip = await this.storage.getTripByBaseAndDate(baseId, serviceDate);
    if (existingTrip) {
      return existingTrip.id;
    }

    // 3. Begin transaction to create trip
    try {
      // Get pattern stops for this base
      const patternStops = await this.storage.getPatternStops(base.patternId);
      
      // Ensure we have a valid vehicle ID
      let vehicleId = base.defaultVehicleId;
      if (!vehicleId) {
        // Get pattern's default layout to find a vehicle
        const pattern = await this.storage.getTripPatternById(base.patternId);
        if (pattern?.defaultLayoutId) {
          // Find a vehicle that uses this layout
          const vehicles = await this.storage.getVehicles();
          const compatibleVehicle = vehicles.find(v => v.layoutId === pattern.defaultLayoutId);
          vehicleId = compatibleVehicle?.id || null;
        }
        
        if (!vehicleId) {
          throw new Error('No suitable vehicle found for trip base. Please assign a default vehicle to the trip base or ensure vehicles exist for the pattern layout.');
        }
      }

      // Determine capacity
      let capacity = base.capacity || null;
      if (!capacity) {
        const vehicle = await this.storage.getVehicleById(vehicleId);
        capacity = vehicle?.capacity || null;
      }
      if (!capacity && base.defaultLayoutId) {
        const layout = await this.storage.getLayoutById(base.defaultLayoutId);
        capacity = layout?.seatMap ? (layout.seatMap as any[]).length : null;
      }

      // Extract origin departure time for sorting using base timezone
      const timestamps = this.computeDefaultTimestamps(base, serviceDate);
      const firstStopTime = timestamps.find(t => t.stopSequence === 1);
      const timezone = ensureDefaultTimezone(base.timezone);
      const originDepartHHMM = firstStopTime?.departAt ? 
        formatTimeInTZ(firstStopTime.departAt, timezone) : null;

      const [pattern, driver, vehicle] = await Promise.all([
        this.storage.getTripPatternById(base.patternId),
        base.defaultDriverId ? this.storage.getDriverById(base.defaultDriverId) : null,
        this.storage.getVehicleById(vehicleId),
      ]);

      const tripData: InsertTrip = {
        patternId: base.patternId,
        serviceDate,
        vehicleId,
        layoutId: base.defaultLayoutId,
        capacity: capacity || 50,
        status: 'scheduled',
        channelFlags: base.channelFlags as any,
        baseId: base.id,
        driverId: base.defaultDriverId,
        originDepartHHMM,
        snapRouteName: pattern?.name || null,
        snapRouteCode: pattern?.code || null,
        snapDriverName: driver?.name || null,
        snapVehiclePlate: vehicle?.plate || null,
      };

      const trip = await this.storage.createTrip(tripData);
      
      // Create trip stop times from defaultStopTimes
      const tripStopTimesData = timestamps.map(ts => {
        const patternStop = patternStops.find(ps => ps.stopSequence === ts.stopSequence);
        if (!patternStop) {
          throw new Error(`Pattern stop not found for sequence ${ts.stopSequence}`);
        }
        
        return {
          tripId: trip.id,
          stopId: patternStop.stopId,
          stopSequence: ts.stopSequence,
          arriveAt: ts.arriveAt,
          departAt: ts.departAt,
          dwellSeconds: patternStop.dwellSeconds || 0,
          boardingAllowed: null, // inherit from pattern
          alightingAllowed: null // inherit from pattern
        };
      });

      // Bulk upsert trip stop times
      if (tripStopTimesData.length > 0) {
        await this.storage.bulkUpsertTripStopTimes(trip.id, tripStopTimesData);
      }

      // Derive trip legs
      await this.tripLegsService.deriveLegsFromTrip(trip);
      
      // Precompute seat inventory
      await this.seatInventoryService.precomputeInventory(trip);

      return trip.id;
    } catch (error) {
      // Handle race condition: if unique constraint violation, fetch the existing trip
      if (error instanceof Error && (
        error.message.includes('unique') || 
        error.message.includes('duplicate') ||
        error.message.includes('violates unique constraint')
      )) {
        // Another request already created the trip, fetch it
        const existingTrip = await this.storage.getTripByBaseAndDate(baseId, serviceDate);
        if (existingTrip) {
          return existingTrip.id;
        }
        // If still not found, there might be a deeper issue
        throw new Error(`Failed to materialize trip for base ${baseId} on ${serviceDate}: unique constraint violation but no existing trip found`);
      }
      throw error;
    }
  }

  /**
   * Close a trip (operational close)
   */
  async closeTrip(tripId: string): Promise<Trip> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) {
      throw new Error(`Trip with id ${tripId} not found`);
    }

    // Update trip status to closed
    const updatedTrip = await this.storage.updateTrip(tripId, { status: 'closed' });
    
    // Release/expire all holds for this trip
    await this.storage.releaseHoldsForTrip(tripId);
    
    // TODO: Publish realtime event for trip status change
    
    return updatedTrip;
  }

  /**
   * Validate the structure of defaultStopTimes
   */
  private validateDefaultStopTimes(defaultStopTimes: any): void {
    if (!Array.isArray(defaultStopTimes)) {
      throw new Error('defaultStopTimes must be an array');
    }

    if (defaultStopTimes.length === 0) {
      throw new Error('defaultStopTimes must not be empty');
    }

    for (const stopTime of defaultStopTimes) {
      if (!stopTime.stopSequence || typeof stopTime.stopSequence !== 'number') {
        throw new Error('Each stop time must have a numeric stopSequence');
      }
      
      // Validate time format (HH:MM:SS or HH:MM)
      if (stopTime.arriveAt && !/^\d{2}:\d{2}(:\d{2})?$/.test(stopTime.arriveAt)) {
        throw new Error(`Invalid arriveAt format: ${stopTime.arriveAt}. Expected HH:MM or HH:MM:SS`);
      }
      
      if (stopTime.departAt && !/^\d{2}:\d{2}(:\d{2})?$/.test(stopTime.departAt)) {
        throw new Error(`Invalid departAt format: ${stopTime.departAt}. Expected HH:MM or HH:MM:SS`);
      }
    }
  }
}