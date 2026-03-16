import { IStorage } from "./routes";
import { 
  stops, outlets, vehicles, layouts, tripPatterns, patternStops, tripBases,
  trips, tripStopTimes, tripLegs, seatInventory, seatHolds, priceRules, 
  bookings, passengers, payments, printJobs, cargoShipments, cargoTypes, cargoRates,
  type Stop, type Outlet, type Vehicle, type Layout, type TripPattern, 
  type PatternStop, type TripBase, type Trip, type TripWithDetails, type TripStopTime, type TripLeg, 
  type SeatInventory, type PriceRule, type Booking, type Passenger, 
  type Payment, type PrintJob, type CargoShipment, type CargoType, type CargoRate, type CsoAvailableTrip,
  type InsertStop, type InsertOutlet, type InsertVehicle, type InsertLayout,
  type InsertTripPattern, type InsertPatternStop, type InsertTripBase, type InsertTrip,
  type InsertTripStopTime, type InsertTripLeg, type InsertSeatInventory,
  type InsertPriceRule, type InsertBooking, type InsertPassenger,
  type InsertPayment, type InsertPrintJob, type InsertCargoShipment,
  type InsertCargoType, type InsertCargoRate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { fromZonedHHMMToUtc } from "./utils/timezone";

export class DatabaseStorage implements IStorage {
  // Stops
  async getStops(): Promise<Stop[]> {
    return await db.select().from(stops).orderBy(stops.name);
  }

  async getStopById(id: string): Promise<Stop | undefined> {
    const [stop] = await db.select().from(stops).where(eq(stops.id, id));
    return stop;
  }

  async createStop(data: InsertStop): Promise<Stop> {
    const [stop] = await db.insert(stops).values(data).returning();
    return stop;
  }

  async updateStop(id: string, data: Partial<InsertStop>): Promise<Stop> {
    const [stop] = await db.update(stops).set(data).where(eq(stops.id, id)).returning();
    return stop;
  }

  async deleteStop(id: string): Promise<void> {
    await db.delete(stops).where(eq(stops.id, id));
  }

  // Outlets
  async getOutlets(): Promise<Outlet[]> {
    return await db.select().from(outlets).orderBy(outlets.name);
  }

  async getOutletById(id: string): Promise<Outlet | undefined> {
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, id));
    return outlet;
  }

  async createOutlet(data: InsertOutlet): Promise<Outlet> {
    const [outlet] = await db.insert(outlets).values(data).returning();
    return outlet;
  }

  async updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet> {
    const [outlet] = await db.update(outlets).set(data).where(eq(outlets.id, id)).returning();
    return outlet;
  }

  async deleteOutlet(id: string): Promise<void> {
    await db.delete(outlets).where(eq(outlets.id, id));
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(vehicles.code);
  }

  async getVehicleById(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async createVehicle(data: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(data).returning();
    return vehicle;
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle> {
    const [vehicle] = await db.update(vehicles).set(data).where(eq(vehicles.id, id)).returning();
    return vehicle;
  }

  async deleteVehicle(id: string): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  // Layouts
  async getLayouts(): Promise<Layout[]> {
    return await db.select().from(layouts).orderBy(layouts.name);
  }

  async getLayoutById(id: string): Promise<Layout | undefined> {
    const [layout] = await db.select().from(layouts).where(eq(layouts.id, id));
    return layout;
  }

  async createLayout(data: InsertLayout): Promise<Layout> {
    const [layout] = await db.insert(layouts).values(data).returning();
    return layout;
  }

  async updateLayout(id: string, data: Partial<InsertLayout>): Promise<Layout> {
    const [layout] = await db.update(layouts).set(data).where(eq(layouts.id, id)).returning();
    return layout;
  }

  async deleteLayout(id: string): Promise<void> {
    await db.delete(layouts).where(eq(layouts.id, id));
  }

  // Trip Patterns
  async getTripPatterns(): Promise<TripPattern[]> {
    return await db.select().from(tripPatterns).orderBy(tripPatterns.code);
  }

  async getTripPatternById(id: string): Promise<TripPattern | undefined> {
    const [pattern] = await db.select().from(tripPatterns).where(eq(tripPatterns.id, id));
    return pattern;
  }

  async createTripPattern(data: InsertTripPattern): Promise<TripPattern> {
    const [pattern] = await db.insert(tripPatterns).values(data).returning();
    return pattern;
  }

  async updateTripPattern(id: string, data: Partial<InsertTripPattern>): Promise<TripPattern> {
    const [pattern] = await db.update(tripPatterns).set(data).where(eq(tripPatterns.id, id)).returning();
    return pattern;
  }

  async deleteTripPattern(id: string): Promise<void> {
    await db.delete(tripPatterns).where(eq(tripPatterns.id, id));
  }

  // Pattern Stops
  async getPatternStops(patternId: string): Promise<PatternStop[]> {
    return await db.select().from(patternStops)
      .where(eq(patternStops.patternId, patternId))
      .orderBy(patternStops.stopSequence);
  }

  async createPatternStop(data: InsertPatternStop): Promise<PatternStop> {
    const [patternStop] = await db.insert(patternStops).values(data).returning();
    return patternStop;
  }

  async updatePatternStop(id: string, data: Partial<InsertPatternStop>): Promise<PatternStop> {
    const [patternStop] = await db.update(patternStops).set(data).where(eq(patternStops.id, id)).returning();
    return patternStop;
  }

  async deletePatternStop(id: string): Promise<void> {
    await db.delete(patternStops).where(eq(patternStops.id, id));
  }

  async bulkReplacePatternStops(patternId: string, newPatternStops: InsertPatternStop[]): Promise<PatternStop[]> {
    // Use transaction for atomic operation
    const result = await db.transaction(async (tx) => {
      // Delete existing pattern stops for this pattern
      await tx.delete(patternStops).where(eq(patternStops.patternId, patternId));
      
      // Insert new pattern stops if any
      if (newPatternStops.length > 0) {
        return await tx.insert(patternStops).values(newPatternStops).returning();
      }
      
      return [];
    });
    
    return result;
  }

  // Trip Bases
  async getTripBases(): Promise<TripBase[]> {
    return await db.select().from(tripBases).orderBy(tripBases.name);
  }

  async getTripBaseById(id: string): Promise<TripBase | undefined> {
    const [base] = await db.select().from(tripBases).where(eq(tripBases.id, id));
    return base;
  }

  async createTripBase(data: InsertTripBase): Promise<TripBase> {
    const [base] = await db.insert(tripBases).values(data).returning();
    return base;
  }

  async updateTripBase(id: string, data: Partial<InsertTripBase>): Promise<TripBase> {
    const [base] = await db.update(tripBases).set(data).where(eq(tripBases.id, id)).returning();
    return base;
  }

  async deleteTripBase(id: string): Promise<void> {
    await db.delete(tripBases).where(eq(tripBases.id, id));
  }

  // Trips
  async getTrips(serviceDate?: string): Promise<TripWithDetails[]> {
    const query = db.select({
      id: trips.id,
      patternId: trips.patternId,
      serviceDate: trips.serviceDate,
      vehicleId: trips.vehicleId,
      layoutId: trips.layoutId,
      capacity: trips.capacity,
      status: trips.status,
      channelFlags: trips.channelFlags,
      baseId: trips.baseId,
      originDepartHHMM: trips.originDepartHHMM,
      createdAt: trips.createdAt,
      // Joined fields
      patternName: tripPatterns.name,
      patternCode: tripPatterns.code,
      vehicleCode: vehicles.code,
      vehiclePlate: vehicles.plate,
      // Get earliest departure time as schedule time
      scheduleTime: sql<string>`(
        SELECT MIN(depart_at) 
        FROM ${tripStopTimes} 
        WHERE ${tripStopTimes.tripId} = ${trips.id}
      )`.as('scheduleTime')
    })
    .from(trips)
    .leftJoin(tripPatterns, eq(trips.patternId, tripPatterns.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id));
    
    if (serviceDate) {
      return await query.where(eq(trips.serviceDate, serviceDate)).orderBy(trips.serviceDate);
    }
    return await query.orderBy(desc(trips.serviceDate));
  }

  async getCsoAvailableTrips(serviceDate: string, outletId: string): Promise<CsoAvailableTrip[]> {
    // First get the outlet's stop ID
    const outlet = await this.getOutletById(outletId);
    if (!outlet) {
      throw new Error(`Outlet with id ${outletId} not found`);
    }

    // Get real trips
    const realTrips = await this.getRealTripsForCso(serviceDate, outlet.stopId);
    
    // Get virtual trips (computed from trip bases)
    const virtualTrips = await this.getVirtualTripsForCso(serviceDate, outlet.stopId);
    
    // Combine results and deduplicate (real trips override virtual ones)
    const baseIdsWithRealTrips = new Set(
      realTrips.filter(trip => trip.baseId).map(trip => trip.baseId!)
    );
    
    // Filter out virtual trips that have corresponding real trips
    const filteredVirtualTrips = virtualTrips.filter(
      trip => !baseIdsWithRealTrips.has(trip.baseId!)
    );
    
    // Combine and sort by departure time
    const allTrips = [...realTrips, ...filteredVirtualTrips];
    
    return allTrips.sort((a, b) => {
      if (!a.departAtAtOutlet && !b.departAtAtOutlet) return 0;
      if (!a.departAtAtOutlet) return 1;
      if (!b.departAtAtOutlet) return -1;
      return new Date(a.departAtAtOutlet).getTime() - new Date(b.departAtAtOutlet).getTime();
    });
  }

  private async getRealTripsForCso(serviceDate: string, outletStopId: string): Promise<CsoAvailableTrip[]> {
    // Build the complex query to find real trips that serve this outlet's stop with boarding allowed
    const result = await db.select({
      tripId: trips.id,
      baseId: trips.baseId,
      patternCode: tripPatterns.code,
      vehicleCode: vehicles.code,
      vehiclePlate: vehicles.plate,
      capacity: trips.capacity,
      status: trips.status,
      departAtOutlet: sql<string>`(
        SELECT tst.depart_at 
        FROM ${tripStopTimes} tst 
        WHERE tst.trip_id = ${trips.id} 
        AND tst.stop_id = ${outletStopId}
      )`.as('depart_at_outlet'),
      finalArrivalAt: sql<string>`(
        SELECT tst.arrive_at 
        FROM ${tripStopTimes} tst 
        WHERE tst.trip_id = ${trips.id} 
        ORDER BY tst.stop_sequence DESC 
        LIMIT 1
      )`.as('final_arrival_at'),
      stopCount: sql<number>`(
        SELECT COUNT(*) 
        FROM ${tripStopTimes} tst 
        WHERE tst.trip_id = ${trips.id}
      )`.as('stop_count'),
      patternStops: sql<string>`(
        SELECT STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence)
        FROM ${patternStops} ps
        JOIN ${stops} s ON ps.stop_id = s.id
        WHERE ps.pattern_id = ${trips.patternId}
      )`,
      availableSeats: sql<number>`(
        SELECT COALESCE(${trips.capacity}, 0) - COALESCE(
          (SELECT COUNT(p.id)
           FROM ${bookings} b
           LEFT JOIN ${passengers} p ON p.booking_id = b.id
           INNER JOIN ${tripStopTimes} origin_tst ON origin_tst.trip_id = b.trip_id AND origin_tst.stop_id = b.origin_stop_id
           INNER JOIN ${tripStopTimes} dest_tst ON dest_tst.trip_id = b.trip_id AND dest_tst.stop_id = b.destination_stop_id
           INNER JOIN ${tripStopTimes} outlet_tst ON outlet_tst.trip_id = b.trip_id AND outlet_tst.stop_id = ${outletStopId}
           WHERE b.trip_id = ${trips.id}
           AND b.status IN ('pending', 'confirmed', 'checked_in', 'paid')
           AND origin_tst.stop_sequence <= outlet_tst.stop_sequence
           AND outlet_tst.stop_sequence < dest_tst.stop_sequence), 0) - COALESCE(
          (SELECT COUNT(*)
           FROM ${seatHolds} sh
           INNER JOIN ${tripStopTimes} outlet_tst ON outlet_tst.trip_id = ${trips.id} AND outlet_tst.stop_id = ${outletStopId}
           WHERE sh.trip_id = ${trips.id}
           AND sh.expires_at > NOW()
           AND sh.booking_id IS NULL
           AND EXISTS (
             SELECT 1 FROM unnest(sh.leg_indexes) AS leg_idx
             INNER JOIN ${tripLegs} tl ON tl.trip_id = ${trips.id} AND tl.leg_index = leg_idx
             INNER JOIN ${tripStopTimes} leg_origin_tst ON leg_origin_tst.trip_id = ${trips.id} AND leg_origin_tst.stop_id = tl.from_stop_id
             INNER JOIN ${tripStopTimes} leg_dest_tst ON leg_dest_tst.trip_id = ${trips.id} AND leg_dest_tst.stop_id = tl.to_stop_id
             WHERE leg_origin_tst.stop_sequence <= outlet_tst.stop_sequence
             AND outlet_tst.stop_sequence < leg_dest_tst.stop_sequence
           )), 0)
      )`.as('available_seats')
    })
    .from(trips)
    .innerJoin(tripPatterns, eq(trips.patternId, tripPatterns.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        eq(trips.serviceDate, serviceDate),
        // Check that this trip has a stop time for this outlet's stop with boarding allowed
        // AND it's not the final destination (there must be stops after this one)
        sql`EXISTS (
          SELECT 1 
          FROM ${tripStopTimes} tst
          LEFT JOIN ${patternStops} ps ON ps.pattern_id = ${trips.patternId} AND ps.stop_id = tst.stop_id
          WHERE tst.trip_id = ${trips.id} 
          AND tst.stop_id = ${outletStopId}
          AND COALESCE(tst.boarding_allowed, ps.boarding_allowed, true) = true
          AND tst.stop_sequence < (
            SELECT MAX(tst2.stop_sequence) 
            FROM ${tripStopTimes} tst2 
            WHERE tst2.trip_id = ${trips.id}
          )
        )`
      )
    );

    // Transform the result to match the expected format
    return result.map(row => ({
      tripId: row.tripId,
      baseId: row.baseId || undefined,
      isVirtual: false,
      patternCode: row.patternCode,
      patternPath: row.patternStops || 'Unknown Route',
      vehicle: row.vehicleCode && row.vehiclePlate ? {
        code: row.vehicleCode,
        plate: row.vehiclePlate
      } : null,
      capacity: row.capacity,
      status: (row.status || 'scheduled') as any,
      departAtAtOutlet: row.departAtOutlet,
      finalArrivalAt: row.finalArrivalAt,
      stopCount: row.stopCount,
      availableSeats: Math.max(0, row.availableSeats || row.capacity || 0)
    }));
  }

  private async getVirtualTripsForCso(serviceDate: string, outletStopId: string): Promise<CsoAvailableTrip[]> {
    // Get all eligible trip bases for this date
    const eligibleBases = await this.getEligibleTripBases(serviceDate);
    
    const virtualTrips: CsoAvailableTrip[] = [];
    
    for (const base of eligibleBases) {
      try {
        // Check if this base serves the outlet stop
        const pattern = await this.getTripPatternById(base.patternId);
        if (!pattern) continue;
        
        const patternStopsForBase = await this.getPatternStops(base.patternId);
        const outletStop = patternStopsForBase.find(ps => ps.stopId === outletStopId);
        
        // Skip if this pattern doesn't serve the outlet stop or boarding not allowed
        if (!outletStop || !outletStop.boardingAllowed) continue;
        
        // Skip if outlet stop is the final destination
        const maxSequence = Math.max(...patternStopsForBase.map(ps => ps.stopSequence));
        if (outletStop.stopSequence >= maxSequence) continue;
        
        // Compute times for this virtual trip
        const { departAtOutlet, finalArrivalAt } = this.computeVirtualTripTimes(
          base, serviceDate, outletStop.stopSequence, maxSequence
        );
        
        // Get pattern path - use the same logic as real trips
        const patternPath = await this.getPatternPath(base.patternId);
        
        virtualTrips.push({
          baseId: base.id,
          isVirtual: true,
          patternCode: pattern.code,
          patternPath,
          vehicle: null, // Virtual trips don't have vehicles assigned yet
          capacity: base.capacity,
          status: 'scheduled',
          departAtAtOutlet: departAtOutlet,
          finalArrivalAt,
          stopCount: patternStopsForBase.length,
          availableSeats: base.capacity ?? undefined // Virtual trips show full capacity as available (estimated)
        });
      } catch (error) {
        // Skip this base if there's an error (e.g., invalid default times)
        console.warn(`Skipping virtual trip for base ${base.id}:`, error);
        continue;
      }
    }
    
    return virtualTrips;
  }

  private async getEligibleTripBases(serviceDate: string): Promise<TripBase[]> {
    const serviceDateObj = new Date(serviceDate);
    const dayOfWeek = serviceDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayColumns = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayColumn = dayColumns[dayOfWeek];
    
    return await db.select().from(tripBases)
      .where(
        and(
          eq(tripBases.active, true),
          sql`${tripBases[dayColumn as keyof typeof tripBases]} = true`,
          sql`(${tripBases.validFrom} IS NULL OR ${tripBases.validFrom} <= ${serviceDate})`,
          sql`(${tripBases.validTo} IS NULL OR ${serviceDate} <= ${tripBases.validTo})`
        )
      );
  }

  private computeVirtualTripTimes(base: TripBase, serviceDate: string, outletSequence: number, maxSequence: number): {
    departAtOutlet: string | null;
    finalArrivalAt: string | null;
  } {
    const defaultStopTimes = base.defaultStopTimes as any[];
    
    // Find departure time at outlet
    const outletTime = defaultStopTimes.find(st => st.stopSequence === outletSequence);
    const finalTime = defaultStopTimes.find(st => st.stopSequence === maxSequence);
    
    let departAtOutlet = null;
    let finalArrivalAt = null;
    
    if (outletTime?.departAt) {
      // Use proper timezone handling - interpret time as Asia/Jakarta timezone
      const departUtcTime = fromZonedHHMMToUtc(serviceDate, outletTime.departAt, "Asia/Jakarta");
      departAtOutlet = departUtcTime.toISOString();
    }
    
    if (finalTime?.arriveAt) {
      // Use proper timezone handling - interpret time as Asia/Jakarta timezone
      const arrivalUtcTime = fromZonedHHMMToUtc(serviceDate, finalTime.arriveAt, "Asia/Jakarta");
      finalArrivalAt = arrivalUtcTime.toISOString();
    }
    
    return { departAtOutlet, finalArrivalAt };
  }

  private async getPatternPath(patternId: string): Promise<string> {
    try {
      console.log(`[DEBUG] Getting pattern path for patternId: ${patternId}`);
      const result = await db.execute(sql`
        SELECT STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence) as pattern_stops
        FROM ${patternStops} ps
        JOIN ${stops} s ON ps.stop_id = s.id
        WHERE ps.pattern_id = ${patternId}
      `);
      
      console.log(`[DEBUG] Pattern path query result:`, result.rows);
      
      if (result.rows.length > 0 && result.rows[0].pattern_stops) {
        const patternPath = result.rows[0].pattern_stops as string;
        console.log(`[DEBUG] Returning pattern path: ${patternPath}`);
        return patternPath;
      } else {
        console.log(`[DEBUG] No pattern stops found for patternId: ${patternId}`);
        return 'Unknown Route';
      }
    } catch (error) {
      console.error(`[ERROR] Failed to get pattern path for ${patternId}:`, error);
      return 'Unknown Route';
    }
  }

  async getTripById(id: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip;
  }

  async createTrip(data: InsertTrip): Promise<Trip> {
    const [trip] = await db.insert(trips).values(data).returning();
    return trip;
  }

  async updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip> {
    const [trip] = await db.update(trips).set(data).where(eq(trips.id, id)).returning();
    return trip;
  }

  async deleteTrip(id: string): Promise<void> {
    // JANGAN hapus passenger, payment, bookings - hanya hapus data lainnya
    // Wrap in transaction for atomicity and concurrency safety
    await db.transaction(async (tx) => {
      // Re-check for active bookings inside transaction to prevent race conditions
      const [result] = await tx.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(
          eq(bookings.tripId, id),
          inArray(bookings.status, ['pending', 'paid'])
        ));
      
      if (result.count > 0) {
        throw new Error('TRIP_HAS_ACTIVE_BOOKINGS');
      }
      
      // Delete in proper order to avoid foreign key constraint violations
      // 1. Delete seat inventory
      await tx.delete(seatInventory).where(eq(seatInventory.tripId, id));
      
      // 2. Delete trip legs
      await tx.delete(tripLegs).where(eq(tripLegs.tripId, id));
      
      // 3. Delete trip stop times
      await tx.delete(tripStopTimes).where(eq(tripStopTimes.tripId, id));
      
      // 4. Delete trip-specific price rules
      await tx.delete(priceRules).where(eq(priceRules.tripId, id));
      
      // 5. Finally delete the trip itself
      await tx.delete(trips).where(eq(trips.id, id));
    });
  }

  // Trip Stop Times
  async getTripStopTimes(tripId: string): Promise<TripStopTime[]> {
    return await db.select().from(tripStopTimes)
      .where(eq(tripStopTimes.tripId, tripId))
      .orderBy(tripStopTimes.stopSequence);
  }

  async createTripStopTime(data: InsertTripStopTime): Promise<TripStopTime> {
    const [tripStopTime] = await db.insert(tripStopTimes).values(data).returning();
    return tripStopTime;
  }

  async updateTripStopTime(id: string, data: Partial<InsertTripStopTime>): Promise<TripStopTime> {
    const [tripStopTime] = await db.update(tripStopTimes).set(data).where(eq(tripStopTimes.id, id)).returning();
    return tripStopTime;
  }

  async deleteTripStopTime(id: string): Promise<void> {
    await db.delete(tripStopTimes).where(eq(tripStopTimes.id, id));
  }

  async getTripStopTimesWithEffectiveFlags(tripId: string): Promise<any[]> {
    // Get trip stop times with joined stop and pattern stop data to calculate effective flags
    const result = await db
      .select({
        id: tripStopTimes.id,
        tripId: tripStopTimes.tripId,
        stopId: tripStopTimes.stopId,
        stopSequence: tripStopTimes.stopSequence,
        arriveAt: tripStopTimes.arriveAt,
        departAt: tripStopTimes.departAt,
        dwellSeconds: tripStopTimes.dwellSeconds,
        tripBoardingAllowed: tripStopTimes.boardingAllowed,
        tripAlightingAllowed: tripStopTimes.alightingAllowed,
        stopName: stops.name,
        stopCode: stops.code,
        patternBoardingAllowed: patternStops.boardingAllowed,
        patternAlightingAllowed: patternStops.alightingAllowed,
      })
      .from(tripStopTimes)
      .leftJoin(stops, eq(tripStopTimes.stopId, stops.id))
      .leftJoin(trips, eq(tripStopTimes.tripId, trips.id))
      .leftJoin(patternStops, and(
        eq(patternStops.patternId, trips.patternId),
        eq(patternStops.stopId, tripStopTimes.stopId)
      ))
      .where(eq(tripStopTimes.tripId, tripId))
      .orderBy(tripStopTimes.stopSequence);

    // Calculate effective flags using coalesce logic
    return result.map(row => ({
      ...row,
      effectiveBoardingAllowed: row.tripBoardingAllowed ?? row.patternBoardingAllowed ?? true,
      effectiveAlightingAllowed: row.tripAlightingAllowed ?? row.patternAlightingAllowed ?? true,
    }));
  }

  async bulkUpsertTripStopTimes(tripId: string, stopTimes: any[]): Promise<void> {
    // Delete existing trip stop times for this trip
    await db.delete(tripStopTimes).where(eq(tripStopTimes.tripId, tripId));
    
    // Insert new stop times
    if (stopTimes.length > 0) {
      const insertData = stopTimes.map(st => ({
        tripId,
        stopId: st.stopId,
        stopSequence: st.stopSequence,
        arriveAt: st.arriveAt,
        departAt: st.departAt,
        dwellSeconds: st.dwellSeconds ?? 0,
        boardingAllowed: st.boardingAllowed,
        alightingAllowed: st.alightingAllowed,
      }));
      
      await db.insert(tripStopTimes).values(insertData);
    }
  }

  // Trip Legs
  async getTripLegs(tripId: string): Promise<TripLeg[]> {
    return await db.select().from(tripLegs)
      .where(eq(tripLegs.tripId, tripId))
      .orderBy(tripLegs.legIndex);
  }

  async createTripLeg(data: InsertTripLeg): Promise<TripLeg> {
    const [tripLeg] = await db.insert(tripLegs).values(data).returning();
    return tripLeg;
  }

  async deleteTripLegs(tripId: string): Promise<void> {
    await db.delete(tripLegs).where(eq(tripLegs.tripId, tripId));
  }

  // Seat Inventory
  async getSeatInventory(tripId: string, legIndexes?: number[]): Promise<SeatInventory[]> {
    if (legIndexes && legIndexes.length > 0) {
      return await db.select().from(seatInventory).where(and(
        eq(seatInventory.tripId, tripId),
        inArray(seatInventory.legIndex, legIndexes)
      ));
    }
    return await db.select().from(seatInventory).where(eq(seatInventory.tripId, tripId));
  }

  async createSeatInventory(data: InsertSeatInventory[]): Promise<SeatInventory[]> {
    return await db.insert(seatInventory).values(data).returning();
  }

  async updateSeatInventory(tripId: string, seatNo: string, legIndexes: number[], updates: Partial<InsertSeatInventory>): Promise<void> {
    await db.update(seatInventory)
      .set(updates)
      .where(and(
        eq(seatInventory.tripId, tripId),
        eq(seatInventory.seatNo, seatNo),
        inArray(seatInventory.legIndex, legIndexes)
      ));
  }

  async deleteSeatInventory(tripId: string): Promise<void> {
    await db.delete(seatInventory).where(eq(seatInventory.tripId, tripId));
  }

  // Price Rules
  async getPriceRules(): Promise<PriceRule[]> {
    return await db.select().from(priceRules).orderBy(desc(priceRules.priority));
  }

  async createPriceRule(data: InsertPriceRule): Promise<PriceRule> {
    const [priceRule] = await db.insert(priceRules).values(data).returning();
    return priceRule;
  }

  async updatePriceRule(id: string, data: Partial<InsertPriceRule>): Promise<PriceRule> {
    const [priceRule] = await db.update(priceRules).set(data).where(eq(priceRules.id, id)).returning();
    return priceRule;
  }

  async deletePriceRule(id: string): Promise<void> {
    await db.delete(priceRules).where(eq(priceRules.id, id));
  }

  // Bookings
  async getBookings(tripId?: string): Promise<Booking[]> {
    const query = db.select().from(bookings);
    if (tripId) {
      return await query.where(eq(bookings.tripId, tripId)).orderBy(desc(bookings.createdAt));
    }
    return await query.orderBy(desc(bookings.createdAt));
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async createBooking(data: InsertBooking): Promise<Booking> {
    const [booking] = await db.insert(bookings).values(data).returning();
    return booking;
  }

  async updateBooking(id: string, data: Partial<InsertBooking>): Promise<Booking> {
    const [booking] = await db.update(bookings).set(data).where(eq(bookings.id, id)).returning();
    return booking;
  }

  // Passengers
  async getPassengers(bookingId: string): Promise<Passenger[]> {
    return await db.select().from(passengers).where(eq(passengers.bookingId, bookingId));
  }

  async createPassenger(data: InsertPassenger): Promise<Passenger> {
    const [passenger] = await db.insert(passengers).values(data).returning();
    return passenger;
  }

  // Payments
  async getPayments(bookingId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.bookingId, bookingId));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(data).returning();
    return payment;
  }

  // Print Jobs
  async createPrintJob(data: InsertPrintJob): Promise<PrintJob> {
    const [printJob] = await db.insert(printJobs).values(data).returning();
    return printJob;
  }

  // Check if trip has active bookings (for immutability guard)
  async tripHasBookings(tripId: string): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.tripId, tripId),
        inArray(bookings.status, ['pending', 'paid'])
      ));
    return result.count > 0;
  }

  // Get trip by base and service date
  async getTripByBaseAndDate(baseId: string, serviceDate: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips)
      .where(and(
        eq(trips.baseId, baseId),
        eq(trips.serviceDate, serviceDate)
      ));
    return trip;
  }

  // Release all holds for a trip (used when closing a trip)
  async releaseHoldsForTrip(tripId: string): Promise<void> {
    await db.update(seatInventory)
      .set({ holdRef: null })
      .where(eq(seatInventory.tripId, tripId));
    
    await db.update(seatHolds)
      .set({ expiresAt: new Date() })
      .where(eq(seatHolds.tripId, tripId));
  }

  // Cargo Types
  async getCargoTypes(): Promise<CargoType[]> {
    return await db.select().from(cargoTypes).orderBy(cargoTypes.name);
  }

  async getCargoTypeById(id: string): Promise<CargoType | undefined> {
    const [ct] = await db.select().from(cargoTypes).where(eq(cargoTypes.id, id));
    return ct;
  }

  async createCargoType(data: InsertCargoType): Promise<CargoType> {
    const [ct] = await db.insert(cargoTypes).values(data).returning();
    return ct;
  }

  async updateCargoType(id: string, data: Partial<InsertCargoType>): Promise<CargoType> {
    const [ct] = await db.update(cargoTypes).set(data).where(eq(cargoTypes.id, id)).returning();
    return ct;
  }

  async deleteCargoType(id: string): Promise<void> {
    await db.delete(cargoTypes).where(eq(cargoTypes.id, id));
  }

  // Cargo Rates
  async getCargoRates(cargoTypeId?: string): Promise<CargoRate[]> {
    if (cargoTypeId) {
      return await db.select().from(cargoRates).where(eq(cargoRates.cargoTypeId, cargoTypeId)).orderBy(desc(cargoRates.createdAt));
    }
    return await db.select().from(cargoRates).orderBy(desc(cargoRates.createdAt));
  }

  async getCargoRateById(id: string): Promise<CargoRate | undefined> {
    const [cr] = await db.select().from(cargoRates).where(eq(cargoRates.id, id));
    return cr;
  }

  async createCargoRate(data: InsertCargoRate): Promise<CargoRate> {
    const [cr] = await db.insert(cargoRates).values(data).returning();
    return cr;
  }

  async updateCargoRate(id: string, data: Partial<InsertCargoRate>): Promise<CargoRate> {
    const [cr] = await db.update(cargoRates).set(data).where(eq(cargoRates.id, id)).returning();
    return cr;
  }

  async deleteCargoRate(id: string): Promise<void> {
    await db.delete(cargoRates).where(eq(cargoRates.id, id));
  }

  async findCargoRate(cargoTypeId: string, originStopId: string, destinationStopId: string): Promise<CargoRate | undefined> {
    const [specific] = await db.select().from(cargoRates).where(
      and(
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.originStopId, originStopId),
        eq(cargoRates.destinationStopId, destinationStopId),
        eq(cargoRates.isActive, true)
      )
    );
    if (specific) return specific;

    const [fallback] = await db.select().from(cargoRates).where(
      and(
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.isActive, true)
      )
    ).limit(1);
    return fallback;
  }

  // Cargo Shipments
  async getCargoShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<any[]> {
    const originStop = db.select({ id: stops.id, code: stops.code, name: stops.name }).from(stops).as('origin_stop');
    const destStop = db.select({ id: stops.id, code: stops.code, name: stops.name }).from(stops).as('dest_stop');

    const conditions = [];
    if (filters?.tripId) conditions.push(eq(cargoShipments.tripId, filters.tripId));
    if (filters?.status) conditions.push(sql`${cargoShipments.status} = ${filters.status}`);
    if (filters?.outletId) conditions.push(eq(cargoShipments.outletId, filters.outletId));

    const baseQuery = db
      .select({
        id: cargoShipments.id,
        waybillNumber: cargoShipments.waybillNumber,
        tripId: cargoShipments.tripId,
        originStopId: cargoShipments.originStopId,
        destinationStopId: cargoShipments.destinationStopId,
        outletId: cargoShipments.outletId,
        cargoTypeId: cargoShipments.cargoTypeId,
        senderName: cargoShipments.senderName,
        senderPhone: cargoShipments.senderPhone,
        recipientName: cargoShipments.recipientName,
        recipientPhone: cargoShipments.recipientPhone,
        itemDescription: cargoShipments.itemDescription,
        quantity: cargoShipments.quantity,
        weightKg: cargoShipments.weightKg,
        lengthCm: cargoShipments.lengthCm,
        widthCm: cargoShipments.widthCm,
        heightCm: cargoShipments.heightCm,
        declaredValue: cargoShipments.declaredValue,
        totalAmount: cargoShipments.totalAmount,
        status: cargoShipments.status,
        channel: cargoShipments.channel,
        paymentMethod: cargoShipments.paymentMethod,
        paidAt: cargoShipments.paidAt,
        notes: cargoShipments.notes,
        createdBy: cargoShipments.createdBy,
        createdAt: cargoShipments.createdAt,
        originStopCode: originStop.code,
        originStopName: originStop.name,
        destinationStopCode: destStop.code,
        destinationStopName: destStop.name
      })
      .from(cargoShipments)
      .leftJoin(originStop, eq(cargoShipments.originStopId, originStop.id))
      .leftJoin(destStop, eq(cargoShipments.destinationStopId, destStop.id));

    if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions)).orderBy(desc(cargoShipments.createdAt));
    }
    return await baseQuery.orderBy(desc(cargoShipments.createdAt));
  }

  async getCargoShipmentById(id: string): Promise<CargoShipment | undefined> {
    const [shipment] = await db.select().from(cargoShipments).where(eq(cargoShipments.id, id));
    return shipment;
  }

  async getCargoShipmentByWaybill(waybillNumber: string): Promise<CargoShipment | undefined> {
    const [shipment] = await db.select().from(cargoShipments).where(eq(cargoShipments.waybillNumber, waybillNumber));
    return shipment;
  }

  async createCargoShipment(data: InsertCargoShipment): Promise<CargoShipment> {
    const [shipment] = await db.insert(cargoShipments).values(data).returning();
    return shipment;
  }

  async updateCargoShipment(id: string, data: Partial<InsertCargoShipment>): Promise<CargoShipment> {
    const [shipment] = await db.update(cargoShipments).set(data).where(eq(cargoShipments.id, id)).returning();
    return shipment;
  }
}

export const storage = new DatabaseStorage();
