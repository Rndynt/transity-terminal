import { db } from "../db";
import { eq, and, or, desc, sql, inArray, isNull } from "drizzle-orm";
import { fromZonedHHMMToUtc } from "../utils/timezone";
import { ManifestEntry, ManifestFull, ManifestCargoEntry } from "../storage.interface";
import {
  tripPatterns, patternStops, tripBases, trips, tripStopTimes, tripLegs,
  seatInventory, seatHolds, priceRules, stops, vehicles, drivers, bookings, passengers,
  cargoShipments,
  type TripPattern, type InsertTripPattern,
  type PatternStop, type InsertPatternStop, type Stop,
  type TripBase, type InsertTripBase,
  type Trip, type InsertTrip, type TripWithDetails,
  type TripStopTime, type InsertTripStopTime,
  type TripLeg, type InsertTripLeg,
  type SeatInventory, type InsertSeatInventory,
  type PriceRule, type InsertPriceRule,
  type CsoAvailableTrip
} from "@shared/schema";

export class SchedulingRepository {
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
      patternName: tripPatterns.name,
      patternCode: tripPatterns.code,
      vehicleCode: vehicles.code,
      vehiclePlate: vehicles.plate,
      driverName: drivers.name,
      driverCode: drivers.code,
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

  async getCsoAvailableTrips(serviceDate: string, outletId: string, getOutletById: (id: string) => Promise<any>): Promise<CsoAvailableTrip[]> {
    const outlet = await getOutletById(outletId);
    if (!outlet) {
      throw new Error(`Outlet with id ${outletId} not found`);
    }

    const [realTrips, virtualTrips] = await Promise.all([
      this.getRealTripsForCso(serviceDate, outlet.stopId),
      this.getVirtualTripsForCso(serviceDate, outlet.stopId)
    ]);
    
    const baseIdsWithRealTrips = new Set(
      realTrips.filter(trip => trip.baseId).map(trip => trip.baseId!)
    );
    
    const filteredVirtualTrips = virtualTrips.filter(
      trip => !baseIdsWithRealTrips.has(trip.baseId!)
    );
    
    const allTrips = [...realTrips, ...filteredVirtualTrips];
    
    return allTrips.sort((a, b) => {
      if (!a.departAtAtOutlet && !b.departAtAtOutlet) return 0;
      if (!a.departAtAtOutlet) return 1;
      if (!b.departAtAtOutlet) return -1;
      return new Date(a.departAtAtOutlet).getTime() - new Date(b.departAtAtOutlet).getTime();
    });
  }

  private async getRealTripsForCso(serviceDate: string, outletStopId: string): Promise<CsoAvailableTrip[]> {
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
    const dayOfWeek = serviceDateObj.getDay();
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
    const outletTime = defaultStopTimes.find(st => st.stopSequence === outletSequence);
    const finalTime = defaultStopTimes.find(st => st.stopSequence === maxSequence);
    
    let departAtOutlet = null;
    let finalArrivalAt = null;
    
    if (outletTime?.departAt) {
      const departUtcTime = fromZonedHHMMToUtc(serviceDate, outletTime.departAt, "Asia/Jakarta");
      departAtOutlet = departUtcTime.toISOString();
    }
    
    if (finalTime?.arriveAt) {
      const arrivalUtcTime = fromZonedHHMMToUtc(serviceDate, finalTime.arriveAt, "Asia/Jakarta");
      finalArrivalAt = arrivalUtcTime.toISOString();
    }
    
    return { departAtOutlet, finalArrivalAt };
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

    return result.map(row => ({
      ...row,
      boardingAllowed: row.tripBoardingAllowed,
      alightingAllowed: row.tripAlightingAllowed,
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

  async tripHasBookings(tripId: string): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.tripId, tripId),
        inArray(bookings.status, ['pending', 'paid'])
      ));
    return result.count > 0;
  }

  async getTripByBaseAndDate(baseId: string, serviceDate: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips)
      .where(and(
        eq(trips.baseId, baseId),
        eq(trips.serviceDate, serviceDate)
      ));
    return trip;
  }

  async releaseHoldsForTrip(tripId: string): Promise<void> {
    await db.update(seatInventory)
      .set({ holdRef: null })
      .where(eq(seatInventory.tripId, tripId));
    
    await db.update(seatHolds)
      .set({ expiresAt: new Date() })
      .where(eq(seatHolds.tripId, tripId));
  }

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

  async getManifestFull(tripId: string): Promise<ManifestFull> {
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
}
