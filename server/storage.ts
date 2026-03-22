import { IStorage, ManifestEntry, ManifestFull, ManifestCargoEntry } from "./routes";
import { 
  drivers, stops, outlets, vehicles, layouts, tripPatterns, patternStops, tripBases,
  trips, tripStopTimes, tripLegs, seatInventory, seatHolds, priceRules, 
  bookings, passengers, payments, printJobs, cargoShipments, cargoTypes, cargoRates,
  tripCostTemplates, tripCostItems, promotions, vouchers,
  type Driver, type InsertDriver,
  type Stop, type Outlet, type Vehicle, type Layout, type TripPattern, 
  type PatternStop, type TripBase, type Trip, type TripWithDetails, type TripStopTime, type TripLeg, 
  type SeatInventory, type PriceRule, type Booking, type Passenger, 
  type Payment, type PrintJob, type CargoShipment, type CargoType, type CargoRate, type CsoAvailableTrip,
  type TripCostTemplate, type InsertTripCostTemplate,
  type TripCostItem, type InsertTripCostItem,
  type Promotion, type InsertPromotion,
  type Voucher, type InsertVoucher,
  type InsertStop, type InsertOutlet, type InsertVehicle, type InsertLayout,
  type InsertTripPattern, type InsertPatternStop, type InsertTripBase, type InsertTrip,
  type InsertTripStopTime, type InsertTripLeg, type InsertSeatInventory,
  type InsertPriceRule, type InsertBooking, type InsertPassenger,
  type InsertPayment, type InsertPrintJob, type InsertCargoShipment,
  type InsertCargoType, type InsertCargoRate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, inArray, isNull } from "drizzle-orm";
import { fromZonedHHMMToUtc } from "./utils/timezone";

export class DatabaseStorage implements IStorage {
  // Drivers
  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).where(isNull(drivers.deletedAt)).orderBy(drivers.name);
  }

  async getDriverById(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async createDriver(data: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(data).returning();
    return driver;
  }

  async updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver> {
    const [driver] = await db.update(drivers).set(data).where(eq(drivers.id, id)).returning();
    return driver;
  }

  async deleteDriver(id: string): Promise<void> {
    await db.update(drivers).set({ deletedAt: new Date() }).where(eq(drivers.id, id));
  }

  // Stops
  async getStops(): Promise<Stop[]> {
    return await db.select().from(stops).where(isNull(stops.deletedAt)).orderBy(stops.name);
  }

  async getStopById(id: string): Promise<Stop | undefined> {
    const [stop] = await db.select().from(stops).where(eq(stops.id, id));
    return stop;
  }

  async getStopsByIds(ids: string[]): Promise<Stop[]> {
    if (ids.length === 0) return [];
    return await db.select().from(stops).where(inArray(stops.id, ids));
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
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(patternStops).set({ deletedAt: now }).where(eq(patternStops.stopId, id));
      await tx.update(outlets).set({ deletedAt: now }).where(eq(outlets.stopId, id));
      await tx.update(stops).set({ deletedAt: now }).where(eq(stops.id, id));
    });
  }

  // Outlets
  async getOutlets(): Promise<Outlet[]> {
    return await db.select().from(outlets).where(isNull(outlets.deletedAt)).orderBy(outlets.name);
  }

  async getOutletById(id: string): Promise<Outlet | undefined> {
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, id));
    return outlet;
  }

  async getOutletsByIds(ids: string[]): Promise<Outlet[]> {
    if (ids.length === 0) return [];
    return await db.select().from(outlets).where(inArray(outlets.id, ids));
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
    await db.update(outlets).set({ deletedAt: new Date() }).where(eq(outlets.id, id));
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(isNull(vehicles.deletedAt)).orderBy(vehicles.code);
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
    await db.update(vehicles).set({ deletedAt: new Date() }).where(eq(vehicles.id, id));
  }

  // Layouts
  async getLayouts(): Promise<Layout[]> {
    return await db.select().from(layouts).where(isNull(layouts.deletedAt)).orderBy(layouts.name);
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
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(vehicles).set({ deletedAt: now }).where(eq(vehicles.layoutId, id));
      await tx.update(layouts).set({ deletedAt: now }).where(eq(layouts.id, id));
    });
  }

  // Trip Patterns
  async getTripPatterns(): Promise<TripPattern[]> {
    return await db.select().from(tripPatterns).where(isNull(tripPatterns.deletedAt)).orderBy(tripPatterns.code);
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
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(patternStops).set({ deletedAt: now }).where(eq(patternStops.patternId, id));
      await tx.update(priceRules).set({ deletedAt: now }).where(and(eq(priceRules.patternId, id), eq(priceRules.scope, 'pattern')));
      await tx.update(tripBases).set({ deletedAt: now }).where(eq(tripBases.patternId, id));
      await tx.update(tripPatterns).set({ deletedAt: now }).where(eq(tripPatterns.id, id));
    });
  }

  // Pattern Stops
  async getPatternStops(patternId: string): Promise<Array<PatternStop & { stop: Stop | null }>> {
    const rows = await db.query.patternStops.findMany({
      where: and(eq(patternStops.patternId, patternId), isNull(patternStops.deletedAt)),
      orderBy: patternStops.stopSequence,
      with: { stop: true }
    });
    return rows as Array<PatternStop & { stop: Stop | null }>;
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
    await db.update(patternStops).set({ deletedAt: new Date() }).where(eq(patternStops.id, id));
  }

  async bulkReplacePatternStops(patternId: string, newPatternStops: InsertPatternStop[]): Promise<PatternStop[]> {
    const result = await db.transaction(async (tx) => {
      await tx.update(patternStops).set({ deletedAt: new Date() }).where(
        and(eq(patternStops.patternId, patternId), isNull(patternStops.deletedAt))
      );
      
      if (newPatternStops.length > 0) {
        return await tx.insert(patternStops).values(newPatternStops).returning();
      }
      
      return [];
    });
    
    return result;
  }

  // Trip Bases
  async getTripBases(): Promise<TripBase[]> {
    return await db.select().from(tripBases).where(isNull(tripBases.deletedAt)).orderBy(tripBases.name);
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
    const now = new Date();
    await db.transaction(async (tx) => {
      const childTrips = await tx.select({ id: trips.id }).from(trips).where(
        and(eq(trips.baseId, id), isNull(trips.deletedAt))
      );
      if (childTrips.length > 0) {
        const tripIds = childTrips.map(t => t.id);
        await tx.update(tripStopTimes).set({ deletedAt: now }).where(inArray(tripStopTimes.tripId, tripIds));
        await tx.update(tripLegs).set({ deletedAt: now }).where(inArray(tripLegs.tripId, tripIds));
        await tx.update(priceRules).set({ deletedAt: now }).where(
          and(inArray(priceRules.tripId, tripIds), eq(priceRules.scope, 'trip'))
        );
        await tx.delete(seatInventory).where(inArray(seatInventory.tripId, tripIds));
        await tx.delete(seatHolds).where(inArray(seatHolds.tripId, tripIds));
        await tx.update(trips).set({ status: 'canceled', deletedAt: now }).where(inArray(trips.id, tripIds));
      }
      await tx.update(tripBases).set({ deletedAt: now }).where(eq(tripBases.id, id));
    });
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
      driverId: trips.driverId,
      originDepartHHMM: trips.originDepartHHMM,
      createdAt: trips.createdAt,
      // Joined fields
      patternName: tripPatterns.name,
      patternCode: tripPatterns.code,
      vehicleCode: vehicles.code,
      vehiclePlate: vehicles.plate,
      driverName: drivers.name,
      driverCode: drivers.code,
      // Get earliest departure time as schedule time
      scheduleTime: sql<string>`(
        SELECT MIN(depart_at) 
        FROM ${tripStopTimes} 
        WHERE ${tripStopTimes.tripId} = ${trips.id}
          AND ${tripStopTimes.deletedAt} IS NULL
      )`.as('scheduleTime')
    })
    .from(trips)
    .leftJoin(tripPatterns, eq(trips.patternId, tripPatterns.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(trips.driverId, drivers.id));
    
    if (serviceDate) {
      return await query.where(and(eq(trips.serviceDate, serviceDate), isNull(trips.deletedAt))).orderBy(trips.serviceDate);
    }
    return await query.where(isNull(trips.deletedAt)).orderBy(desc(trips.serviceDate));
  }

  async getCsoAvailableTrips(serviceDate: string, outletId: string): Promise<CsoAvailableTrip[]> {
    // First get the outlet's stop ID
    const outlet = await this.getOutletById(outletId);
    if (!outlet) {
      throw new Error(`Outlet with id ${outletId} not found`);
    }

    const [realTrips, virtualTrips] = await Promise.all([
      this.getRealTripsForCso(serviceDate, outlet.stopId),
      this.getVirtualTripsForCso(serviceDate, outlet.stopId)
    ]);
    
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
      departAtOutlet: sql<string>`outlet_tst.depart_at_outlet`.as('depart_at_outlet'),
      finalArrivalAt: sql<string>`trip_agg.final_arrival_at`.as('final_arrival_at'),
      outletStopSequence: sql<number>`outlet_tst.stop_sequence`.as('outlet_stop_sequence'),
      stopCount: sql<number>`trip_agg.stop_count`.as('stop_count'),
      patternStops: sql<string>`(
        SELECT STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence)
        FROM ${patternStops} ps
        JOIN ${stops} s ON ps.stop_id = s.id
        WHERE ps.pattern_id = ${trips.patternId}
          AND ps.deleted_at IS NULL
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
      )`.as('available_seats'),
      hasPriceRule: sql<boolean>`EXISTS (
        SELECT 1 FROM ${priceRules} pr
        WHERE pr.deleted_at IS NULL
        AND (pr.trip_id = ${trips.id}
        OR (pr.pattern_id = ${trips.patternId} AND pr.trip_id IS NULL))
      )`.as('has_price_rule')
    })
    .from(trips)
    .innerJoin(tripPatterns, eq(trips.patternId, tripPatterns.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .innerJoin(
      sql`LATERAL (
        SELECT tst.stop_sequence, COALESCE(tst.depart_at, tst.arrive_at) AS depart_at_outlet
        FROM ${tripStopTimes} tst
        WHERE tst.trip_id = ${trips.id} AND tst.stop_id = ${outletStopId} AND tst.deleted_at IS NULL
        LIMIT 1
      ) AS outlet_tst`,
      sql`true`
    )
    .innerJoin(
      sql`LATERAL (
        SELECT 
          MAX(tst.arrive_at) FILTER (WHERE tst.stop_sequence = (SELECT MAX(t2.stop_sequence) FROM ${tripStopTimes} t2 WHERE t2.trip_id = ${trips.id} AND t2.deleted_at IS NULL)) AS final_arrival_at,
          COUNT(*)::int AS stop_count
        FROM ${tripStopTimes} tst
        WHERE tst.trip_id = ${trips.id} AND tst.deleted_at IS NULL
      ) AS trip_agg`,
      sql`true`
    )
    .where(
      and(
        eq(trips.serviceDate, serviceDate),
        isNull(trips.deletedAt),
        sql`EXISTS (
          SELECT 1 
          FROM ${tripStopTimes} tst
          LEFT JOIN ${patternStops} ps ON ps.pattern_id = ${trips.patternId} AND ps.stop_id = tst.stop_id AND ps.deleted_at IS NULL
          WHERE tst.trip_id = ${trips.id} 
          AND tst.stop_id = ${outletStopId}
          AND tst.deleted_at IS NULL
          AND (
            (
              COALESCE(tst.boarding_allowed, ps.boarding_allowed, true) = true
              AND tst.depart_at IS NOT NULL
              AND tst.stop_sequence < (
                SELECT MAX(tst2.stop_sequence) 
                FROM ${tripStopTimes} tst2 
                WHERE tst2.trip_id = ${trips.id} AND tst2.deleted_at IS NULL
              )
            )
            OR
            (
              COALESCE(tst.alighting_allowed, ps.alighting_allowed, true) = true
              AND tst.arrive_at IS NOT NULL
              AND tst.stop_sequence > (
                SELECT MIN(tst2.stop_sequence) 
                FROM ${tripStopTimes} tst2 
                WHERE tst2.trip_id = ${trips.id} AND tst2.deleted_at IS NULL
              )
            )
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
      outletStopSequence: row.outletStopSequence || 1,
      availableSeats: Math.max(0, row.availableSeats || row.capacity || 0),
      hasPriceRule: Boolean(row.hasPriceRule)
    }));
  }

  private async getVirtualTripsForCso(serviceDate: string, outletStopId: string): Promise<CsoAvailableTrip[]> {
    const eligibleBases = await this.getEligibleTripBases(serviceDate);
    if (eligibleBases.length === 0) return [];
    
    const allPriceRules = await this.getPriceRules();
    
    const uniquePatternIds = [...new Set(eligibleBases.map(b => b.patternId))];
    
    const [allPatterns, allPatternStopsRows, patternPathRows] = await Promise.all([
      db.select().from(tripPatterns).where(inArray(tripPatterns.id, uniquePatternIds)),
      db.query.patternStops.findMany({
        where: and(inArray(patternStops.patternId, uniquePatternIds), isNull(patternStops.deletedAt)),
        orderBy: patternStops.stopSequence,
        with: { stop: true }
      }),
      db.execute(sql`
        SELECT ps.pattern_id, STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence) as pattern_path
        FROM ${patternStops} ps
        JOIN ${stops} s ON ps.stop_id = s.id
        WHERE ps.pattern_id IN ${sql`(${sql.join(uniquePatternIds.map(id => sql`${id}`), sql`, `)})`}
          AND ps.deleted_at IS NULL
        GROUP BY ps.pattern_id
      `)
    ]);
    
    const patternsMap = new Map(allPatterns.map(p => [p.id, p]));
    const patternStopsMap = new Map<string, typeof allPatternStopsRows>();
    for (const ps of allPatternStopsRows) {
      const list = patternStopsMap.get(ps.patternId) || [];
      list.push(ps);
      patternStopsMap.set(ps.patternId, list);
    }
    const patternPathMap = new Map<string, string>();
    for (const row of patternPathRows.rows as any[]) {
      patternPathMap.set(row.pattern_id, row.pattern_path || '');
    }
    
    const virtualTrips: CsoAvailableTrip[] = [];
    
    for (const base of eligibleBases) {
      try {
        const pattern = patternsMap.get(base.patternId);
        if (!pattern) continue;
        
        const patternStopsForBase = patternStopsMap.get(base.patternId) || [];
        const outletStop = patternStopsForBase.find(ps => ps.stopId === outletStopId);
        
        if (!outletStop || !outletStop.boardingAllowed) continue;
        
        const maxSequence = Math.max(...patternStopsForBase.map(ps => ps.stopSequence));
        if (outletStop.stopSequence >= maxSequence) continue;
        
        const { departAtOutlet, finalArrivalAt } = this.computeVirtualTripTimes(
          base, serviceDate, outletStop.stopSequence, maxSequence
        );
        
        const patternPath = patternPathMap.get(base.patternId) || '';
        
        const hasPriceRule = allPriceRules.some(r =>
          (r.patternId === base.patternId && !r.tripId)
        );

        virtualTrips.push({
          baseId: base.id,
          isVirtual: true,
          patternCode: pattern.code,
          patternPath,
          vehicle: null,
          capacity: base.capacity,
          status: 'scheduled',
          departAtAtOutlet: departAtOutlet,
          finalArrivalAt,
          stopCount: patternStopsForBase.length,
          outletStopSequence: outletStop.stopSequence,
          availableSeats: base.capacity ?? undefined,
          hasPriceRule
        });
      } catch (error) {
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
          isNull(tripBases.deletedAt),
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
      const result = await db.execute(sql`
        SELECT STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence) as pattern_stops
        FROM ${patternStops} ps
        JOIN ${stops} s ON ps.stop_id = s.id
        WHERE ps.pattern_id = ${patternId}
          AND ps.deleted_at IS NULL
      `);
      
      if (result.rows.length > 0 && result.rows[0].pattern_stops) {
        return result.rows[0].pattern_stops as string;
      } else {
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
    const now = new Date();
    await db.transaction(async (tx) => {
      const [result] = await tx.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(
          eq(bookings.tripId, id),
          inArray(bookings.status, ['pending', 'paid'])
        ));
      
      if (result.count > 0) {
        throw new Error('TRIP_HAS_ACTIVE_BOOKINGS');
      }

      await tx.update(tripStopTimes).set({ deletedAt: now }).where(eq(tripStopTimes.tripId, id));
      await tx.update(tripLegs).set({ deletedAt: now }).where(eq(tripLegs.tripId, id));
      await tx.update(priceRules).set({ deletedAt: now }).where(and(eq(priceRules.tripId, id), eq(priceRules.scope, 'trip')));
      await tx.delete(seatInventory).where(eq(seatInventory.tripId, id));
      await tx.delete(seatHolds).where(eq(seatHolds.tripId, id));
      await tx.update(trips).set({ status: 'canceled', deletedAt: now }).where(eq(trips.id, id));
    });
  }

  // Trip Stop Times
  async getTripStopTimes(tripId: string): Promise<TripStopTime[]> {
    return await db.select().from(tripStopTimes)
      .where(and(eq(tripStopTimes.tripId, tripId), isNull(tripStopTimes.deletedAt)))
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
    await db.update(tripStopTimes).set({ deletedAt: new Date() }).where(eq(tripStopTimes.id, id));
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
      .where(and(eq(tripStopTimes.tripId, tripId), isNull(tripStopTimes.deletedAt)))
      .orderBy(tripStopTimes.stopSequence);

    // Calculate effective flags using coalesce logic
    return result.map(row => ({
      ...row,
      // Expose raw trip-level overrides under canonical field names
      boardingAllowed: row.tripBoardingAllowed,
      alightingAllowed: row.tripAlightingAllowed,
      // Resolved values after inheriting from pattern
      effectiveBoardingAllowed: row.tripBoardingAllowed ?? row.patternBoardingAllowed ?? true,
      effectiveAlightingAllowed: row.tripAlightingAllowed ?? row.patternAlightingAllowed ?? true,
    }));
  }

  async bulkUpsertTripStopTimes(tripId: string, stopTimes: any[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(tripStopTimes).set({ deletedAt: new Date() }).where(
        and(eq(tripStopTimes.tripId, tripId), isNull(tripStopTimes.deletedAt))
      );

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

        await tx.insert(tripStopTimes).values(insertData);
      }
    });
  }

  // Trip Legs
  async getTripLegs(tripId: string): Promise<TripLeg[]> {
    return await db.select().from(tripLegs)
      .where(and(eq(tripLegs.tripId, tripId), isNull(tripLegs.deletedAt)))
      .orderBy(tripLegs.legIndex);
  }

  async createTripLeg(data: InsertTripLeg): Promise<TripLeg> {
    const [tripLeg] = await db.insert(tripLegs).values(data).returning();
    return tripLeg;
  }

  async deleteTripLegs(tripId: string): Promise<void> {
    await db.update(tripLegs).set({ deletedAt: new Date() }).where(
      and(eq(tripLegs.tripId, tripId), isNull(tripLegs.deletedAt))
    );
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
    return await db.select().from(priceRules).where(isNull(priceRules.deletedAt)).orderBy(desc(priceRules.priority));
  }

  async getPriceRulesForTrip(tripId: string, patternId: string): Promise<PriceRule[]> {
    return await db.select().from(priceRules)
      .where(
        and(
          isNull(priceRules.deletedAt),
          or(
            eq(priceRules.tripId, tripId),
            and(eq(priceRules.patternId, patternId), isNull(priceRules.tripId))
          )
        )
      )
      .orderBy(desc(priceRules.priority));
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
    await db.update(priceRules).set({ deletedAt: new Date() }).where(eq(priceRules.id, id));
  }

  // Bookings
  async getBookings(tripId?: string): Promise<Booking[]> {
    const query = db.select().from(bookings);
    if (tripId) {
      return await query.where(eq(bookings.tripId, tripId)).orderBy(desc(bookings.createdAt));
    }
    return await query.orderBy(desc(bookings.createdAt));
  }

  async getBookingsPaginated(options: { tripId?: string; outletId?: string; page: number; pageSize: number }): Promise<{ data: Booking[]; total: number }> {
    const { tripId, outletId, page, pageSize } = options;
    const conditions = [];
    if (tripId) conditions.push(eq(bookings.tripId, tripId));
    if (outletId) conditions.push(eq(bookings.outletId, outletId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(bookings).where(where);
    const total = countResult?.count ?? 0;

    const data = await db.select().from(bookings)
      .where(where)
      .orderBy(desc(bookings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total };
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

  // Booking lookup by code
  async getBookingByCode(bookingCode: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingCode, bookingCode));
    return booking;
  }

  // Passengers
  async getPassengers(bookingId: string): Promise<Passenger[]> {
    return await db.select().from(passengers).where(eq(passengers.bookingId, bookingId));
  }

  async getPassengersByBookingIds(bookingIds: string[]): Promise<Passenger[]> {
    if (bookingIds.length === 0) return [];
    return await db.select().from(passengers).where(inArray(passengers.bookingId, bookingIds));
  }

  async getPassengerByTicketNumber(ticketNumber: string): Promise<Passenger | undefined> {
    const [passenger] = await db.select().from(passengers).where(eq(passengers.ticketNumber, ticketNumber));
    return passenger;
  }

  async createPassenger(data: InsertPassenger): Promise<Passenger> {
    const [passenger] = await db.insert(passengers).values(data).returning();
    return passenger;
  }

  async updatePassenger(id: string, data: Partial<InsertPassenger>): Promise<Passenger> {
    const [passenger] = await db.update(passengers).set(data).where(eq(passengers.id, id)).returning();
    return passenger;
  }

  async getUnseatedPassengers(tripId: string): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.full_name             AS "fullName",
        p.phone,
        p.ticket_number         AS "ticketNumber",
        p.fare_amount           AS "fareAmount",
        b.booking_code          AS "bookingCode",
        b.id                    AS "bookingId",
        os.name                 AS "originStopName",
        ds.name                 AS "destinationStopName"
      FROM ${passengers} p
      INNER JOIN ${bookings} b ON b.id = p.booking_id
      LEFT JOIN ${stops} os ON os.id = b.origin_stop_id
      LEFT JOIN ${stops} ds ON ds.id = b.destination_stop_id
      WHERE b.trip_id = ${tripId}
        AND b.status NOT IN ('canceled', 'refunded')
        AND COALESCE(p.ticket_status, 'active') = 'unseated'
      ORDER BY p.full_name ASC
    `);
    return rows.rows as any[];
  }

  // Manifest — all passengers for a trip with booking and stop context
  async getManifest(tripId: string): Promise<ManifestEntry[]> {
    const rows = await db.execute(sql`
      SELECT
        p.ticket_number         AS "ticketNumber",
        COALESCE(p.ticket_status, 'active') AS "ticketStatus",
        p.full_name             AS "passengerName",
        p.seat_no               AS "seatNo",
        p.phone,
        p.id_number             AS "idNumber",
        p.fare_amount           AS "fareAmount",
        b.booking_code          AS "bookingCode",
        b.status                AS "bookingStatus",
        b.channel,
        b.created_at            AS "createdAt",
        os.name                 AS "originStopName",
        ds.name                 AS "destinationStopName"
      FROM ${passengers} p
      INNER JOIN ${bookings} b ON b.id = p.booking_id
      LEFT JOIN ${stops} os ON os.id = b.origin_stop_id
      LEFT JOIN ${stops} ds ON ds.id = b.destination_stop_id
      WHERE b.trip_id = ${tripId}
        AND b.status NOT IN ('canceled', 'refunded', 'unseated')
        AND COALESCE(p.ticket_status, 'active') NOT IN ('unseated', 'canceled')
      ORDER BY p.seat_no ASC
    `);

    return rows.rows as ManifestEntry[];
  }

  // Manifest — record first print timestamp (only sets it once; idempotent after that)
  async recordManifestPrint(tripId: string): Promise<string | null> {
    const rows = await db.execute(sql`
      UPDATE ${trips}
      SET manifest_first_printed_at = COALESCE(manifest_first_printed_at, NOW())
      WHERE id = ${tripId}
      RETURNING manifest_first_printed_at AS "firstPrintedAt"
    `);
    const row = rows.rows[0] as any;
    return row?.firstPrintedAt ? new Date(row.firstPrintedAt).toISOString() : null;
  }

  // Manifest Full — header + passengers + cargo + summary
  async getManifestFull(tripId: string): Promise<ManifestFull> {
    // 1. Trip header: trip + vehicle + driver + pattern + first/last stop
    const tripRows = await db.execute(sql`
      SELECT
        t.id                          AS "tripId",
        t.service_date                AS "serviceDate",
        t.origin_depart_hhmm          AS "departureTime",
        t.manifest_first_printed_at   AS "firstPrintedAt",
        tp.name                       AS "routeName",
        v.plate                       AS "vehiclePlate",
        v.code                        AS "vehicleType",
        d.name                        AS "driverName",
        d.license_no                  AS "driverLicense",
        origin_s.name                 AS "originStop",
        dest_s.name                   AS "destinationStop"
      FROM ${trips} t
      INNER JOIN ${vehicles} v ON v.id = t.vehicle_id
      INNER JOIN ${tripPatterns} tp ON tp.id = t.pattern_id
      LEFT JOIN ${drivers} d ON d.id = t.driver_id
      LEFT JOIN ${patternStops} ps_origin ON ps_origin.pattern_id = t.pattern_id
        AND ps_origin.stop_sequence = (
          SELECT MIN(ps2.stop_sequence) FROM ${patternStops} ps2 WHERE ps2.pattern_id = t.pattern_id
        )
      LEFT JOIN ${stops} origin_s ON origin_s.id = ps_origin.stop_id
      LEFT JOIN ${patternStops} ps_dest ON ps_dest.pattern_id = t.pattern_id
        AND ps_dest.stop_sequence = (
          SELECT MAX(ps3.stop_sequence) FROM ${patternStops} ps3 WHERE ps3.pattern_id = t.pattern_id
        )
      LEFT JOIN ${stops} dest_s ON dest_s.id = ps_dest.stop_id
      WHERE t.id = ${tripId}
    `);

    const tripRow = (tripRows.rows[0] || {}) as any;

    // 2. Passengers
    const passengerRows = await db.execute(sql`
      SELECT
        p.ticket_number         AS "ticketNumber",
        COALESCE(p.ticket_status, 'active') AS "ticketStatus",
        p.full_name             AS "passengerName",
        p.seat_no               AS "seatNo",
        p.phone,
        p.id_number             AS "idNumber",
        p.fare_amount           AS "fareAmount",
        b.booking_code          AS "bookingCode",
        b.status                AS "bookingStatus",
        b.channel,
        b.created_at            AS "createdAt",
        os.name                 AS "originStopName",
        ds.name                 AS "destinationStopName"
      FROM ${passengers} p
      INNER JOIN ${bookings} b ON b.id = p.booking_id
      LEFT JOIN ${stops} os ON os.id = b.origin_stop_id
      LEFT JOIN ${stops} ds ON ds.id = b.destination_stop_id
      WHERE b.trip_id = ${tripId}
        AND b.status NOT IN ('canceled', 'refunded', 'unseated')
        AND COALESCE(p.ticket_status, 'active') NOT IN ('unseated', 'canceled')
      ORDER BY p.seat_no ASC
    `);

    const passengerList = passengerRows.rows as ManifestEntry[];

    // 3. Cargo
    const cargoRows = await db.execute(sql`
      SELECT
        cs.waybill_number       AS "waybillNumber",
        cs.sender_name          AS "senderName",
        cs.recipient_name       AS "recipientName",
        cs.item_description     AS "itemDescription",
        cs.quantity,
        cs.weight_kg            AS "weightKg",
        cs.total_amount         AS "totalAmount",
        os.name                 AS "originStopName",
        ds.name                 AS "destinationStopName"
      FROM ${cargoShipments} cs
      LEFT JOIN ${stops} os ON os.id = cs.origin_stop_id
      LEFT JOIN ${stops} ds ON ds.id = cs.destination_stop_id
      WHERE cs.trip_id = ${tripId}
        AND cs.status NOT IN ('canceled')
      ORDER BY cs.created_at ASC
    `);

    const cargoList = cargoRows.rows as ManifestCargoEntry[];

    // 4. Summary
    const totalTicketRevenue = passengerList.reduce((sum, p) => sum + parseFloat(p.fareAmount || '0'), 0);
    const totalCargoRevenue = cargoList.reduce((sum, c) => sum + parseFloat((c as any).totalAmount || '0'), 0);
    const totalCargoWeight = cargoList.reduce((sum, c) => sum + parseFloat((c as any).weightKg || '0'), 0);

    const serviceDate = tripRow.serviceDate ? String(tripRow.serviceDate).replace(/-/g, '') : 'XXXXXX';
    const manifestNumber = `MNF-${tripId.slice(-6).toUpperCase()}-${serviceDate}`;

    return {
      header: {
        manifestNumber,
        tripId,
        serviceDate: tripRow.serviceDate || '',
        departureTime: tripRow.departureTime || null,
        routeName: tripRow.routeName || '',
        originStop: tripRow.originStop || '',
        destinationStop: tripRow.destinationStop || '',
        vehiclePlate: tripRow.vehiclePlate || '',
        vehicleType: tripRow.vehicleType || '',
        driverName: tripRow.driverName || null,
        driverLicense: tripRow.driverLicense || null,
        generatedAt: new Date().toISOString(),
        firstPrintedAt: tripRow.firstPrintedAt ? new Date(tripRow.firstPrintedAt).toISOString() : null,
      },
      passengers: passengerList,
      cargo: cargoList,
      summary: {
        totalPassengers: passengerList.length,
        totalCargoItems: cargoList.length,
        totalCargoWeight: Math.round(totalCargoWeight * 100) / 100,
        totalTicketRevenue: Math.round(totalTicketRevenue * 100) / 100,
        totalCargoRevenue: Math.round(totalCargoRevenue * 100) / 100,
        totalRevenue: Math.round((totalTicketRevenue + totalCargoRevenue) * 100) / 100,
      },
    };
  }

  // Payments
  async getPayments(bookingId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.bookingId, bookingId));
  }

  async getPaymentsByBookingIds(bookingIds: string[]): Promise<Payment[]> {
    if (bookingIds.length === 0) return [];
    return await db.select().from(payments).where(inArray(payments.bookingId, bookingIds));
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
    return await db.select().from(cargoTypes).where(isNull(cargoTypes.deletedAt)).orderBy(cargoTypes.name);
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
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(cargoRates).where(eq(cargoRates.cargoTypeId, id));
      await tx.update(cargoTypes).set({ deletedAt: now }).where(eq(cargoTypes.id, id));
    });
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

  async findCargoRate(cargoTypeId: string, originStopId: string, destinationStopId: string, tripId?: string): Promise<CargoRate | undefined> {
    const findBestInScope = async (scope: string, scopeRefId: string): Promise<CargoRate | undefined> => {
      const [routeSpecific] = await db.select().from(cargoRates).where(
        and(
          eq(cargoRates.cargoTypeId, cargoTypeId),
          eq(cargoRates.scope, scope),
          eq(cargoRates.scopeRefId, scopeRefId),
          eq(cargoRates.originStopId, originStopId),
          eq(cargoRates.destinationStopId, destinationStopId),
          eq(cargoRates.isActive, true)
        )
      );
      if (routeSpecific) return routeSpecific;

      const [scopeFallback] = await db.select().from(cargoRates).where(
        and(
          eq(cargoRates.cargoTypeId, cargoTypeId),
          eq(cargoRates.scope, scope),
          eq(cargoRates.scopeRefId, scopeRefId),
          isNull(cargoRates.originStopId),
          isNull(cargoRates.destinationStopId),
          eq(cargoRates.isActive, true)
        )
      );
      return scopeFallback;
    };

    if (tripId) {
      const tripRate = await findBestInScope('trip', tripId);
      if (tripRate) return tripRate;

      const trip = await this.getTripById(tripId);
      if (trip?.patternId) {
        const patternRate = await findBestInScope('pattern', trip.patternId);
        if (patternRate) return patternRate;
      }
    }

    const [globalRouteSpecific] = await db.select().from(cargoRates).where(
      and(
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.scope, 'global'),
        eq(cargoRates.originStopId, originStopId),
        eq(cargoRates.destinationStopId, destinationStopId),
        eq(cargoRates.isActive, true)
      )
    );
    if (globalRouteSpecific) return globalRouteSpecific;

    const [globalFallback] = await db.select().from(cargoRates).where(
      and(
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.scope, 'global'),
        isNull(cargoRates.originStopId),
        isNull(cargoRates.destinationStopId),
        eq(cargoRates.isActive, true)
      )
    );
    return globalFallback;
  }

  // Cargo Shipments
  async getCargoShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<CargoShipment[]> {
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

  // Trip Cost Templates
  async getTripCostTemplates(patternId?: string): Promise<TripCostTemplate[]> {
    if (patternId) {
      return await db.select().from(tripCostTemplates).where(eq(tripCostTemplates.patternId, patternId)).orderBy(tripCostTemplates.name);
    }
    return await db.select().from(tripCostTemplates).orderBy(tripCostTemplates.name);
  }

  async getTripCostTemplateById(id: string): Promise<TripCostTemplate | undefined> {
    const [template] = await db.select().from(tripCostTemplates).where(eq(tripCostTemplates.id, id));
    return template;
  }

  async createTripCostTemplate(data: InsertTripCostTemplate): Promise<TripCostTemplate> {
    const [template] = await db.insert(tripCostTemplates).values(data).returning();
    return template;
  }

  async updateTripCostTemplate(id: string, data: Partial<InsertTripCostTemplate>): Promise<TripCostTemplate> {
    const [template] = await db.update(tripCostTemplates).set(data).where(eq(tripCostTemplates.id, id)).returning();
    return template;
  }

  async deleteTripCostTemplate(id: string): Promise<void> {
    await db.delete(tripCostItems).where(eq(tripCostItems.templateId, id));
    await db.delete(tripCostTemplates).where(eq(tripCostTemplates.id, id));
  }

  // Trip Cost Items
  async getTripCostItems(templateId: string): Promise<TripCostItem[]> {
    return await db.select().from(tripCostItems).where(eq(tripCostItems.templateId, templateId)).orderBy(tripCostItems.createdAt);
  }

  async createTripCostItem(data: InsertTripCostItem): Promise<TripCostItem> {
    const [item] = await db.insert(tripCostItems).values(data).returning();
    return item;
  }

  async updateTripCostItem(id: string, data: Partial<InsertTripCostItem>): Promise<TripCostItem> {
    const [item] = await db.update(tripCostItems).set(data).where(eq(tripCostItems.id, id)).returning();
    return item;
  }

  async deleteTripCostItem(id: string): Promise<void> {
    await db.delete(tripCostItems).where(eq(tripCostItems.id, id));
  }

  // Promotions
  async getPromotions(): Promise<Promotion[]> {
    return await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  }

  async getPromotionById(id: string): Promise<Promotion | undefined> {
    const [promo] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promo;
  }

  async getPromotionByCode(code: string): Promise<Promotion | undefined> {
    const [promo] = await db.select().from(promotions).where(eq(promotions.code, code.toUpperCase()));
    return promo;
  }

  async createPromotion(data: InsertPromotion): Promise<Promotion> {
    const [promo] = await db.insert(promotions).values({ ...data, code: data.code.toUpperCase() }).returning();
    return promo;
  }

  async updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion> {
    if (data.code) data.code = data.code.toUpperCase();
    const [promo] = await db.update(promotions).set(data).where(eq(promotions.id, id)).returning();
    return promo;
  }

  async deletePromotion(id: string): Promise<void> {
    await db.delete(vouchers).where(eq(vouchers.promoId, id));
    await db.delete(promotions).where(eq(promotions.id, id));
  }

  async incrementPromoUsage(id: string): Promise<void> {
    await db.update(promotions).set({ usageCount: sql`${promotions.usageCount} + 1` }).where(eq(promotions.id, id));
  }

  // Vouchers
  async getVouchers(promoId?: string): Promise<Voucher[]> {
    if (promoId) {
      return await db.select().from(vouchers).where(eq(vouchers.promoId, promoId)).orderBy(desc(vouchers.createdAt));
    }
    return await db.select().from(vouchers).orderBy(desc(vouchers.createdAt));
  }

  async getVoucherById(id: string): Promise<Voucher | undefined> {
    const [v] = await db.select().from(vouchers).where(eq(vouchers.id, id));
    return v;
  }

  async getVoucherByCode(code: string): Promise<Voucher | undefined> {
    const [v] = await db.select().from(vouchers).where(eq(vouchers.code, code.toUpperCase()));
    return v;
  }

  async createVoucher(data: InsertVoucher): Promise<Voucher> {
    const [v] = await db.insert(vouchers).values({ ...data, code: data.code.toUpperCase() }).returning();
    return v;
  }

  async updateVoucher(id: string, data: Partial<InsertVoucher>): Promise<Voucher> {
    if (data.code) data.code = data.code.toUpperCase();
    const [v] = await db.update(vouchers).set(data).where(eq(vouchers.id, id)).returning();
    return v;
  }

  async deleteVoucher(id: string): Promise<void> {
    await db.delete(vouchers).where(eq(vouchers.id, id));
  }
}

export const storage = new DatabaseStorage();
