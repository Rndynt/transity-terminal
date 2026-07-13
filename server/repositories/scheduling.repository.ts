import { db } from "@server/db";
import { eq, and, or, desc, sql, inArray, isNull, gte, lte } from "drizzle-orm";
import { fromZonedHHMMToUtc } from "@server/utils/timezone";
import { createComponentLogger } from "@server/lib/logger";
import { hasAnyPricedDestinationFromOrigin } from "@modules/priceRules/priceRules.resolver";
import { ManifestEntry, ManifestFull, ManifestCargoEntry } from "@server/storage.interface";
import {
  tripPatterns, patternStops, tripBases, trips, tripStopTimes, tripLegs,
  seatInventory, seatHolds, priceRules, priceRuleExceptions, stops, vehicles, drivers, bookings, passengers,
  cargoShipments, scheduleExceptions, scheduleStopExceptions,
  type TripPattern, type InsertTripPattern,
  type PatternStop, type InsertPatternStop, type Stop,
  type TripBase, type InsertTripBase,
  type Trip, type InsertTrip, type TripWithDetails,
  type TripStopTime, type InsertTripStopTime,
  type TripLeg, type InsertTripLeg,
  type SeatInventory, type InsertSeatInventory,
  type CsoAvailableTrip,
  type CargoAvailableTrip,
  type Outlet,
} from "@shared/schema";

const log = createComponentLogger("scheduling.repo");

/**
 * Shape of one element in `trip_bases.default_stop_times` (jsonb).
 * Mirrors the editor-side `DefaultStopTime` in
 * `client/src/components/masters/TripBaseFormDialog.tsx`. Kept local
 * because the schema column is typed as `jsonb` with no runtime
 * validator — this is the de-facto contract the application relies on.
 */
type DefaultStopTime = {
  stopSequence: number;
  stopName?: string;
  stopCode?: string;
  arriveAt?: string | null;
  departAt?: string | null;
};

/**
 * Row shape returned by the CSO real-trip CTE query in
 * `getRealTripsForCso`. Column aliases (snake_case) are whatever the
 * SELECT list produces, not drizzle column names.
 */
type CsoRealTripRow = {
  trip_id: string;
  base_id: string | null;
  pattern_id: string;
  pattern_code: string;
  vehicle_code: string | null;
  vehicle_plate: string | null;
  driver_name: string | null;
  capacity: number | null;
  status: string | null;
  depart_at_outlet: string | null;
  final_arrival_at: string | null;
  outlet_stop_sequence: number | null;
  stop_count: number;
  pattern_stops: string | null;
  available_seats: number | string | null;
  has_price_rule: boolean;
};

/** Row shape for `SELECT pattern_id, STRING_AGG(...) AS path/pattern_path`. */
type PatternPathRow = {
  pattern_id: string;
  path?: string | null;
  pattern_path?: string | null;
};

/**
 * Row shape for the cargo real-trip SELECT. Same trip-metadata surface
 * as `CsoRealTripRow` but without the capacity / availability / outlet
 * columns (cargo doesn't need seats).
 */
type CargoRealTripRow = {
  trip_id: string;
  base_id: string | null;
  pattern_id: string;
  vehicle_id: string | null;
  status: string | null;
  pattern_code: string;
  vehicle_code: string | null;
  vehicle_plate: string | null;
};

/** Row shape for the per-trip stop-times SELECT used by the cargo path. */
type CargoTripStopRow = {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  depart_at: string | null;
  arrive_at: string | null;
};

/** Row shape returned by `recordManifestPrint`'s UPDATE ... RETURNING. */
type ManifestPrintRow = { firstPrintedAt: string | Date | null };

/**
 * Row shape for the trip-header SELECT inside `getManifestFull`. All
 * fields come back aliased with quoted identifiers so property names
 * are camelCase here.
 */
type ManifestHeaderRow = {
  tripId?: string;
  serviceDate?: string;
  departureTime?: string | null;
  firstPrintedAt?: string | Date | null;
  routeName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  driverName?: string | null;
  driverLicense?: string | null;
  originStop?: string;
  destinationStop?: string;
};

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

  async getPatternStopsByPatternIds(
    patternIds: string[]
  ): Promise<Map<string, Array<PatternStop & { stop: Stop | null }>>> {
    const map = new Map<string, Array<PatternStop & { stop: Stop | null }>>();
    if (patternIds.length === 0) return map;
    const rows = await db
      .select()
      .from(patternStops)
      .leftJoin(stops, eq(patternStops.stopId, stops.id))
      .where(and(inArray(patternStops.patternId, patternIds), isNull(patternStops.deletedAt)))
      .orderBy(patternStops.stopSequence);
    for (const r of rows) {
      const ps = r.pattern_stops as PatternStop;
      const st = r.stops as Stop | null;
      const arr = map.get(ps.patternId) ?? [];
      arr.push({ ...ps, stop: st });
      map.set(ps.patternId, arr);
    }
    return map;
  }

  async getTripPatternsByIds(patternIds: string[]): Promise<Map<string, TripPattern>> {
    const map = new Map<string, TripPattern>();
    if (patternIds.length === 0) return map;
    const rows = await db
      .select()
      .from(tripPatterns)
      .where(inArray(tripPatterns.id, patternIds));
    for (const r of rows) map.set(r.id, r);
    return map;
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
        await tx.update(priceRuleExceptions).set({ deletedAt: now }).where(
          inArray(priceRuleExceptions.tripId, tripIds)
        );
        await tx.delete(seatInventory).where(inArray(seatInventory.tripId, tripIds));
        await tx.delete(seatHolds).where(inArray(seatHolds.tripId, tripIds));
        await tx.update(trips).set({ status: 'cancelled', deletedAt: now }).where(inArray(trips.id, tripIds));
      }
      await tx.update(tripBases).set({ deletedAt: now }).where(eq(tripBases.id, id));
    });
  }

  async getTrips(serviceDate?: string, opts?: { limit?: number }): Promise<TripWithDetails[]> {
    // P5: enforce hard cap to avoid OOM if a caller forgets serviceDate.
    // Default 500 rows (~17 trips/day × 30 days), max 2000.
    const cap = Math.min(Math.max(opts?.limit ?? 500, 1), 2000);
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
      manifestFirstPrintedAt: trips.manifestFirstPrintedAt,
      snapRouteName: trips.snapRouteName,
      snapRouteCode: trips.snapRouteCode,
      snapDriverName: trips.snapDriverName,
      snapVehiclePlate: trips.snapVehiclePlate,
      createdAt: trips.createdAt,
      deletedAt: trips.deletedAt,
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
      return await query.where(and(eq(trips.serviceDate, serviceDate), isNull(trips.deletedAt))).orderBy(trips.serviceDate).limit(cap);
    }
    return await query.where(isNull(trips.deletedAt)).orderBy(desc(trips.serviceDate)).limit(cap);
  }

  async getTripsForDateRange(fromDate: string, toDate: string, opts?: { limit?: number }): Promise<TripWithDetails[]> {
    // P5: same cap policy as getTrips. Date range queries must be bounded.
    const cap = Math.min(Math.max(opts?.limit ?? 1000, 1), 2000);
    return await db.select({
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
      manifestFirstPrintedAt: trips.manifestFirstPrintedAt,
      snapRouteName: trips.snapRouteName,
      snapRouteCode: trips.snapRouteCode,
      snapDriverName: trips.snapDriverName,
      snapVehiclePlate: trips.snapVehiclePlate,
      createdAt: trips.createdAt,
      deletedAt: trips.deletedAt,
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
    .leftJoin(drivers, eq(trips.driverId, drivers.id))
    .where(and(
      gte(trips.serviceDate, fromDate),
      lte(trips.serviceDate, toDate),
      isNull(trips.deletedAt)
    ))
    .orderBy(trips.serviceDate) as unknown as TripWithDetails[];
  }

  async getCsoAvailableTrips(serviceDate: string, outletId: string, getOutletById: (id: string) => Promise<Outlet | undefined>): Promise<CsoAvailableTrip[]> {
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

    // OD-aware hasPriceRule (§6): legacy `hasPriceRule` above is a coarse
    // "does ANY price_rule exist for this trip/pattern" boolean. On top of
    // that, also check the OD-matrix: does at least one destination AFTER
    // this outlet resolve to a price>0? A trip stays selectable if EITHER
    // check passes — legacy keeps working pre-migration, matrix takes over
    // once configured. Only the SPECIFIC destination a CSO ultimately
    // picks gets blocked later (RouteTimeline "Turun" guard); this is just
    // the coarse trip-card-level gate.
    const uniquePatternIdsForPricing = [...new Set(allTrips.filter(t => t.patternId).map(t => t.patternId!))];
    if (uniquePatternIdsForPricing.length > 0) {
      const matrixHasPricedByPattern = new Map<string, boolean>();
      await Promise.all(uniquePatternIdsForPricing.map(async (patternId) => {
        try {
          const patternStopsForPattern = await this.getPatternStops(patternId);
          const outletStop = patternStopsForPattern.find(ps => ps.stopId === outlet.stopId);
          if (!outletStop) { matrixHasPricedByPattern.set(patternId, false); return; }
          const destinationStopIds = patternStopsForPattern
            .filter(ps => ps.stopSequence > outletStop.stopSequence)
            .map(ps => ps.stopId);
          const hasPriced = await hasAnyPricedDestinationFromOrigin({
            patternId, originStopId: outlet.stopId, destinationStopIds, serviceDate,
          });
          matrixHasPricedByPattern.set(patternId, hasPriced);
        } catch {
          matrixHasPricedByPattern.set(patternId, false);
        }
      }));
      for (const trip of allTrips) {
        if (trip.patternId && matrixHasPricedByPattern.get(trip.patternId)) {
          trip.hasPriceRule = true;
        }
      }
    }

    const baseIds = [...new Set(allTrips.filter(t => t.baseId).map(t => t.baseId!))];
    if (baseIds.length > 0) {
      const stopExceptions = await db.select()
        .from(scheduleStopExceptions)
        .where(and(
          inArray(scheduleStopExceptions.baseId, baseIds),
          eq(scheduleStopExceptions.exceptionDate, serviceDate),
          eq(scheduleStopExceptions.stopId, outlet.stopId),
          eq(scheduleStopExceptions.disableBoarding, true),
        ));
      const closedBaseMap = new Map(stopExceptions.map(e => [e.baseId, e.reason]));
      for (const trip of allTrips) {
        if (trip.baseId && closedBaseMap.has(trip.baseId)) {
          trip.outletStopClosed = true;
          trip.outletStopClosedReason = closedBaseMap.get(trip.baseId) || null;
        }
      }
    }
    
    return allTrips.sort((a, b) => {
      if (!a.departAtAtOutlet && !b.departAtAtOutlet) return 0;
      if (!a.departAtAtOutlet) return 1;
      if (!b.departAtAtOutlet) return -1;
      return new Date(a.departAtAtOutlet).getTime() - new Date(b.departAtAtOutlet).getTime();
    });
  }

  private async getRealTripsForCso(serviceDate: string, outletStopId: string): Promise<CsoAvailableTrip[]> {
    const result = await db.execute(sql`
      WITH eligible_trips AS (
        SELECT t.id, t.base_id, t.pattern_id, t.vehicle_id, t.driver_id, t.capacity, t.status
        FROM trips t
        WHERE t.service_date = ${serviceDate}
          AND t.deleted_at IS NULL
      ),
      outlet_stop_info AS (
        SELECT tst.trip_id, tst.stop_sequence, COALESCE(tst.depart_at, tst.arrive_at) AS depart_at_outlet
        FROM trip_stop_times tst
        WHERE tst.stop_id = ${outletStopId}
          AND tst.deleted_at IS NULL
          AND tst.trip_id IN (SELECT id FROM eligible_trips)
      ),
      trip_bounds_agg AS (
        SELECT tst.trip_id,
               MIN(tst.stop_sequence) AS min_seq,
               MAX(tst.stop_sequence) AS max_seq,
               COUNT(*)::int AS stop_count
        FROM trip_stop_times tst
        WHERE tst.deleted_at IS NULL
          AND tst.trip_id IN (SELECT id FROM eligible_trips)
        GROUP BY tst.trip_id
      ),
      trip_bounds AS (
        SELECT tba.trip_id, tba.min_seq, tba.max_seq, tba.stop_count,
               tst_last.arrive_at AS final_arrival_at
        FROM trip_bounds_agg tba
        JOIN trip_stop_times tst_last
          ON tst_last.trip_id = tba.trip_id
         AND tst_last.stop_sequence = tba.max_seq
         AND tst_last.deleted_at IS NULL
      ),
      boarding_check AS (
        SELECT tst.trip_id
        FROM trip_stop_times tst
        LEFT JOIN pattern_stops ps ON ps.pattern_id = (
          SELECT et.pattern_id FROM eligible_trips et WHERE et.id = tst.trip_id
        ) AND ps.stop_id = tst.stop_id AND ps.deleted_at IS NULL
        INNER JOIN trip_bounds tb ON tb.trip_id = tst.trip_id
        WHERE tst.stop_id = ${outletStopId}
          AND tst.deleted_at IS NULL
          AND tst.trip_id IN (SELECT id FROM eligible_trips)
          AND COALESCE(tst.boarding_allowed, ps.boarding_allowed, true) = true
          AND tst.depart_at IS NOT NULL
          AND tst.stop_sequence < tb.max_seq
      ),
      booked_counts AS (
        SELECT b.trip_id, COUNT(p.id) AS cnt
        FROM bookings b
        JOIN passengers p ON p.booking_id = b.id
        JOIN trip_stop_times origin_tst ON origin_tst.trip_id = b.trip_id AND origin_tst.stop_id = b.origin_stop_id AND origin_tst.deleted_at IS NULL
        JOIN trip_stop_times dest_tst ON dest_tst.trip_id = b.trip_id AND dest_tst.stop_id = b.destination_stop_id AND dest_tst.deleted_at IS NULL
        JOIN outlet_stop_info osi ON osi.trip_id = b.trip_id
        WHERE b.trip_id IN (SELECT id FROM eligible_trips)
          AND b.status IN ('pending', 'confirmed', 'checked_in', 'paid')
          AND origin_tst.stop_sequence <= osi.stop_sequence
          AND osi.stop_sequence < dest_tst.stop_sequence
        GROUP BY b.trip_id
      ),
      hold_counts AS (
        SELECT sh.trip_id, COUNT(*) AS cnt
        FROM seat_holds sh
        INNER JOIN outlet_stop_info osi ON osi.trip_id = sh.trip_id
        WHERE sh.trip_id IN (SELECT id FROM eligible_trips)
          AND sh.expires_at > NOW()
          AND sh.booking_id IS NULL
          AND EXISTS (
            SELECT 1 FROM unnest(sh.leg_indexes) AS leg_idx
            INNER JOIN trip_legs tl ON tl.trip_id = sh.trip_id AND tl.leg_index = leg_idx
            INNER JOIN trip_stop_times lo ON lo.trip_id = sh.trip_id AND lo.stop_id = tl.from_stop_id AND lo.deleted_at IS NULL
            INNER JOIN trip_stop_times ld ON ld.trip_id = sh.trip_id AND ld.stop_id = tl.to_stop_id AND ld.deleted_at IS NULL
            WHERE lo.stop_sequence <= osi.stop_sequence
              AND osi.stop_sequence < ld.stop_sequence
          )
        GROUP BY sh.trip_id
      ),
      pattern_paths AS (
        SELECT ps.pattern_id, STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence) AS path
        FROM pattern_stops ps
        JOIN stops s ON ps.stop_id = s.id
        WHERE ps.deleted_at IS NULL
          AND ps.pattern_id IN (SELECT DISTINCT pattern_id FROM eligible_trips)
        GROUP BY ps.pattern_id
      ),
      price_rule_check AS (
        SELECT DISTINCT pr.pattern_id
        FROM price_rules pr
        WHERE pr.deleted_at IS NULL
          AND pr.pattern_id IN (SELECT DISTINCT pattern_id FROM eligible_trips)
      )
      SELECT
        et.id AS trip_id,
        et.base_id,
        et.pattern_id,
        tp.code AS pattern_code,
        v.code AS vehicle_code,
        v.plate AS vehicle_plate,
        d.name AS driver_name,
        et.capacity,
        et.status,
        osi.depart_at_outlet,
        tb.final_arrival_at,
        osi.stop_sequence AS outlet_stop_sequence,
        tb.stop_count,
        pp.path AS pattern_stops,
        GREATEST(0, COALESCE(et.capacity, 0) - COALESCE(bc.cnt, 0) - COALESCE(hc.cnt, 0)) AS available_seats,
        (EXISTS (SELECT 1 FROM price_rule_check prc WHERE prc.pattern_id = et.pattern_id)) AS has_price_rule
      FROM eligible_trips et
      INNER JOIN trip_patterns tp ON tp.id = et.pattern_id
      LEFT JOIN vehicles v ON v.id = et.vehicle_id
      LEFT JOIN drivers d ON d.id = et.driver_id
      INNER JOIN outlet_stop_info osi ON osi.trip_id = et.id
      INNER JOIN trip_bounds tb ON tb.trip_id = et.id
      INNER JOIN boarding_check bc_check ON bc_check.trip_id = et.id
      LEFT JOIN booked_counts bc ON bc.trip_id = et.id
      LEFT JOIN hold_counts hc ON hc.trip_id = et.id
      LEFT JOIN pattern_paths pp ON pp.pattern_id = et.pattern_id
    `);

    return (result.rows as CsoRealTripRow[]).map(row => ({
      tripId: row.trip_id,
      baseId: row.base_id || undefined,
      patternId: row.pattern_id || undefined,
      isVirtual: false,
      patternCode: row.pattern_code,
      patternPath: row.pattern_stops || 'Unknown Route',
      vehicle: row.vehicle_code || row.vehicle_plate ? {
        code: row.vehicle_code || undefined,
        plate: row.vehicle_plate || undefined
      } : null,
      driver: row.driver_name ? { name: row.driver_name } : null,
      capacity: row.capacity,
      status: (row.status || 'scheduled') as CsoAvailableTrip['status'],
      departAtAtOutlet: row.depart_at_outlet,
      finalArrivalAt: row.final_arrival_at,
      stopCount: row.stop_count,
      outletStopSequence: row.outlet_stop_sequence || 1,
      availableSeats: Math.max(0, Number(row.available_seats) || row.capacity || 0),
      hasPriceRule: Boolean(row.has_price_rule)
    }));
  }

  private async getVirtualTripsForCso(serviceDate: string, outletStopId: string): Promise<CsoAvailableTrip[]> {
    const eligibleBases = await this.getEligibleTripBases(serviceDate);
    if (eligibleBases.length === 0) return [];

    const exceptions = await db.select({ baseId: scheduleExceptions.baseId })
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.exceptionDate, serviceDate));
    const exceptedBaseIds = new Set(exceptions.map(e => e.baseId));
    const filteredBases = eligibleBases.filter(b => !exceptedBaseIds.has(b.id));
    if (filteredBases.length === 0) return [];
    
    const uniquePatternIds = [...new Set(filteredBases.map(b => b.patternId))];

    const patternPriceRuleSet = new Set<string>();
    if (uniquePatternIds.length > 0) {
      const prRows = await db.select({ patternId: priceRules.patternId })
        .from(priceRules)
        .where(and(
          isNull(priceRules.deletedAt),
          inArray(priceRules.patternId, uniquePatternIds)
        ));
      for (const r of prRows) {
        if (r.patternId) patternPriceRuleSet.add(r.patternId);
      }
    }
    
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
    for (const row of patternPathRows.rows as PatternPathRow[]) {
      patternPathMap.set(row.pattern_id, row.pattern_path || '');
    }
    
    const virtualTrips: CsoAvailableTrip[] = [];
    
    for (const base of filteredBases) {
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
        
        const hasPriceRule = patternPriceRuleSet.has(base.patternId);

        virtualTrips.push({
          baseId: base.id,
          patternId: base.patternId,
          isVirtual: true,
          patternCode: pattern.code,
          patternPath,
          vehicle: null,
          driver: null,
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
        log.warn({ baseId: base.id, err: error }, "skipping virtual trip");
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
    const defaultStopTimes = base.defaultStopTimes as DefaultStopTime[];
    const outletTime = defaultStopTimes.find(st => st.stopSequence === outletSequence);
    const finalTime = defaultStopTimes.find(st => st.stopSequence === maxSequence);
    
    let departAtOutlet = null;
    let finalArrivalAt = null;
    
    if (outletTime?.departAt) {
      const departUtcTime = fromZonedHHMMToUtc(serviceDate, outletTime.departAt, "Asia/Jakarta");
      departAtOutlet = departUtcTime?.toISOString() ?? null;
    }
    
    if (finalTime?.arriveAt) {
      const arrivalUtcTime = fromZonedHHMMToUtc(serviceDate, finalTime.arriveAt, "Asia/Jakarta");
      if (arrivalUtcTime && departAtOutlet) {
        const departMs = new Date(departAtOutlet).getTime();
        if (arrivalUtcTime.getTime() <= departMs) {
          arrivalUtcTime.setDate(arrivalUtcTime.getDate() + 1);
        }
      }
      finalArrivalAt = arrivalUtcTime?.toISOString() ?? null;
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
      await tx.update(priceRuleExceptions).set({ deletedAt: now }).where(eq(priceRuleExceptions.tripId, id));
      await tx.delete(seatInventory).where(eq(seatInventory.tripId, id));
      await tx.delete(seatHolds).where(eq(seatHolds.tripId, id));
      await tx.update(trips).set({ status: 'cancelled', deletedAt: now }).where(eq(trips.id, id));
    });
  }

  async getTripStopTimes(tripId: string): Promise<TripStopTime[]> {
    return await db.select().from(tripStopTimes)
      .where(and(eq(tripStopTimes.tripId, tripId), isNull(tripStopTimes.deletedAt)))
      .orderBy(tripStopTimes.stopSequence);
  }

  async getTripStopTimesByTripIds(tripIds: string[]): Promise<Map<string, TripStopTime[]>> {
    const map = new Map<string, TripStopTime[]>();
    if (tripIds.length === 0) return map;
    const rows = await db.select().from(tripStopTimes)
      .where(and(inArray(tripStopTimes.tripId, tripIds), isNull(tripStopTimes.deletedAt)))
      .orderBy(tripStopTimes.stopSequence);
    for (const r of rows) {
      const arr = map.get(r.tripId) ?? [];
      arr.push(r);
      map.set(r.tripId, arr);
    }
    return map;
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

  async getTripStopTimesWithEffectiveFlags(tripId: string): Promise<import("@server/storage.interface").TripStopTimeWithEffectiveFlags[]> {
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
        eq(patternStops.stopId, tripStopTimes.stopId),
        isNull(patternStops.deletedAt)
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

  async bulkUpsertTripStopTimes(tripId: string, stopTimes: import("@server/storage.interface").BulkUpsertStopTimeInput[]): Promise<void> {
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
    // Skip soft-deleted rows: `deleteTrip` only flips `deletedAt` +
    // `status='cancelled'` and does NOT free the unique slot on
    // `uniq_trip_base_per_day`. Without this filter, any caller that
    // resolves a trip by (base, date) would inherit a cancelled
    // ghost trip — seats all released, legs soft-deleted, status
    // cancelled — as if it were live. All callers of this method use
    // the returned id to read live data (seatmap, manifest, emission
    // targets), so handing back a soft-deleted id is always wrong.
    const [trip] = await db.select().from(trips)
      .where(and(
        eq(trips.baseId, baseId),
        eq(trips.serviceDate, serviceDate),
        isNull(trips.deletedAt),
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
        AND b.status NOT IN ('cancelled', 'refunded', 'unseated')
        AND COALESCE(p.ticket_status, 'active') NOT IN ('unseated', 'cancelled')
      ORDER BY p.seat_no ASC
    `);

    return rows.rows as unknown as ManifestEntry[];
  }

  async recordManifestPrint(tripId: string): Promise<string | null> {
    const rows = await db.execute(sql`
      UPDATE ${trips}
      SET manifest_first_printed_at = COALESCE(manifest_first_printed_at, NOW())
      WHERE id = ${tripId}
      RETURNING manifest_first_printed_at AS "firstPrintedAt"
    `);
    const row = rows.rows[0] as ManifestPrintRow | undefined;
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

    const tripRow = (tripRows.rows[0] || {}) as ManifestHeaderRow;

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
        AND b.status NOT IN ('cancelled', 'refunded', 'unseated')
        AND COALESCE(p.ticket_status, 'active') NOT IN ('unseated', 'cancelled')
      ORDER BY p.seat_no ASC
    `);

    const passengerList = passengerRows.rows as unknown as ManifestEntry[];

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
        AND cs.status NOT IN ('cancelled')
      ORDER BY cs.created_at ASC
    `);

    const cargoList = cargoRows.rows as unknown as ManifestCargoEntry[];

    const totalTicketRevenue = passengerList.reduce((sum, p) => sum + parseFloat(p.fareAmount || '0'), 0);
    const totalCargoRevenue = cargoList.reduce((sum, c) => sum + parseFloat(c.totalAmount || '0'), 0);
    const totalCargoWeight = cargoList.reduce((sum, c) => sum + parseFloat(c.weightKg || '0'), 0);

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

  async getActiveTripsForPattern(patternId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trips)
      .where(and(
        eq(trips.patternId, patternId),
        eq(trips.status, 'scheduled'),
        isNull(trips.deletedAt)
      ));
    return result?.count || 0;
  }

  async getActiveBookingCountForPattern(patternId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.id))
      .where(and(
        eq(trips.patternId, patternId),
        inArray(bookings.status, ['pending', 'paid', 'confirmed'])
      ));
    return result?.count || 0;
  }

  async getCargoAvailableTrips(serviceDate: string, originStopId: string, destinationStopIds: string[]): Promise<CargoAvailableTrip[]> {
    // Cargo hanya boleh mengirim lewat trip REAL/materialized yang sudah
    // punya kendaraan fisik — beda dengan reservasi penumpang yang boleh
    // menampilkan jadwal virtual (baru dimaterialisasi saat ada booking).
    // Jadwal virtual sengaja TIDAK diikutsertakan di sini.
    const allTrips = await this.getRealTripsForCargo(serviceDate, originStopId, destinationStopIds);

    let filtered = allTrips;
    const baseIds = [...new Set(allTrips.filter(t => t.baseId).map(t => t.baseId!))];
    if (baseIds.length > 0) {
      const exceptions = await db.select({ baseId: scheduleExceptions.baseId })
        .from(scheduleExceptions)
        .where(and(
          inArray(scheduleExceptions.baseId, baseIds),
          eq(scheduleExceptions.exceptionDate, serviceDate),
        ));
      const exceptedBaseIds = new Set(exceptions.map(e => e.baseId));
      filtered = allTrips.filter(t => !t.baseId || !exceptedBaseIds.has(t.baseId));
    }

    return filtered.sort((a, b) => {
      if (!a.departAtOrigin && !b.departAtOrigin) return 0;
      if (!a.departAtOrigin) return 1;
      if (!b.departAtOrigin) return -1;
      return new Date(a.departAtOrigin).getTime() - new Date(b.departAtOrigin).getTime();
    });
  }

  private async getRealTripsForCargo(serviceDate: string, originStopId: string, destinationStopIds: string[]): Promise<CargoAvailableTrip[]> {
    const result = await db.execute(sql`
      SELECT
        t.id AS trip_id,
        t.base_id,
        t.pattern_id,
        t.vehicle_id,
        t.status,
        tp.code AS pattern_code,
        v.code AS vehicle_code,
        v.plate AS vehicle_plate
      FROM trips t
      JOIN trip_patterns tp ON tp.id = t.pattern_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.service_date = ${serviceDate}
        AND t.deleted_at IS NULL
        AND t.status NOT IN ('cancelled')
    `);

    const tripRows = result.rows as CargoRealTripRow[];
    if (tripRows.length === 0) return [];
    const uniquePatternIds = [...new Set(tripRows.map(r => r.pattern_id as string))];
    const uniqueBaseIds = [...new Set(tripRows.filter(r => r.base_id).map(r => r.base_id as string))];
    const tripIds = tripRows.map(r => r.trip_id as string);

    const [patternStopsRows, patternPathRows, basesRows, tstRows] = await Promise.all([
      db.query.patternStops.findMany({
        where: and(inArray(patternStops.patternId, uniquePatternIds), isNull(patternStops.deletedAt)),
        orderBy: patternStops.stopSequence,
      }),
      db.execute(sql`
        SELECT ps.pattern_id, STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence) AS path
        FROM ${patternStops} ps
        JOIN ${stops} s ON ps.stop_id = s.id
        WHERE ps.pattern_id IN ${sql`(${sql.join(uniquePatternIds.map(id => sql`${id}`), sql`, `)})`}
          AND ps.deleted_at IS NULL
        GROUP BY ps.pattern_id
      `),
      uniqueBaseIds.length > 0
        ? db.select().from(tripBases).where(inArray(tripBases.id, uniqueBaseIds))
        : Promise.resolve([]),
      db.execute(sql`
        SELECT tst.trip_id, tst.stop_id, tst.stop_sequence,
               tst.depart_at, tst.arrive_at
        FROM trip_stop_times tst
        WHERE tst.trip_id IN ${sql`(${sql.join(tripIds.map(id => sql`${id}`), sql`, `)})`}
          AND tst.deleted_at IS NULL
        ORDER BY tst.trip_id, tst.stop_sequence
      `)
    ]);

    const patternStopsByPattern = new Map<string, typeof patternStopsRows>();
    for (const ps of patternStopsRows) {
      const list = patternStopsByPattern.get(ps.patternId) || [];
      list.push(ps);
      patternStopsByPattern.set(ps.patternId, list);
    }
    const patternPathMap = new Map<string, string>();
    for (const row of patternPathRows.rows as PatternPathRow[]) {
      patternPathMap.set(row.pattern_id, row.path || '');
    }
    const basesMap = new Map((basesRows as TripBase[]).map(b => [b.id, b]));

    const tstByTrip = new Map<string, CargoTripStopRow[]>();
    for (const row of tstRows.rows as CargoTripStopRow[]) {
      const list = tstByTrip.get(row.trip_id) || [];
      list.push(row);
      tstByTrip.set(row.trip_id, list);
    }

    const trips: CargoAvailableTrip[] = [];

    for (const row of tripRows) {
      const psForPattern = patternStopsByPattern.get(row.pattern_id) || [];
      const originPs = psForPattern.find(ps => ps.stopId === originStopId);
      // Kota tujuan bisa punya beberapa stop; kumpulkan SEMUA stop kota
      // tujuan yang dilewati trip ini setelah origin. Stop pertama (sequence
      // terkecil) tetap dipakai untuk hitung tarif/waktu tiba, tapi seluruh
      // daftar dikirim ke frontend supaya titik drop bisa dipilih bebas
      // sepanjang rute — sama seperti mekanisme reservasi penumpang.
      const destCandidates = psForPattern
        .filter(ps => destinationStopIds.includes(ps.stopId) && originPs && ps.stopSequence > originPs.stopSequence)
        .sort((a, b) => a.stopSequence - b.stopSequence);
      const destPs = destCandidates[0];
      if (!originPs || !destPs) continue;

      let departAtOrigin: string | null = null;
      let arriveAtDestination: string | null = null;

      const tripStops = tstByTrip.get(row.trip_id);
      if (tripStops && tripStops.length > 0) {
        const originTst = tripStops.find(ts => ts.stop_id === originStopId);
        const destTst = tripStops.find(ts => ts.stop_id === destPs.stopId);
        if (originTst) departAtOrigin = originTst.depart_at || originTst.arrive_at || null;
        if (destTst) arriveAtDestination = destTst.arrive_at || destTst.depart_at || null;
      }

      if (!departAtOrigin && row.base_id) {
        const base = basesMap.get(row.base_id);
        if (base) {
          const defaultStopTimes = base.defaultStopTimes as DefaultStopTime[];
          const originTime = defaultStopTimes?.find(st => st.stopSequence === originPs.stopSequence);
          const destTime = defaultStopTimes?.find(st => st.stopSequence === destPs.stopSequence);
          if (originTime?.departAt) {
            const utc = fromZonedHHMMToUtc(serviceDate, originTime.departAt, "Asia/Jakarta");
            departAtOrigin = utc?.toISOString() ?? null;
          }
          if (destTime?.arriveAt) {
            const utc = fromZonedHHMMToUtc(serviceDate, destTime.arriveAt, "Asia/Jakarta");
            if (utc && departAtOrigin) {
              if (utc.getTime() <= new Date(departAtOrigin).getTime()) {
                utc.setDate(utc.getDate() + 1);
              }
            }
            arriveAtDestination = utc?.toISOString() ?? null;
          }
        }
      }

      trips.push({
        tripId: row.trip_id,
        baseId: row.base_id || undefined,
        patternId: row.pattern_id || undefined,
        isVirtual: false,
        patternCode: row.pattern_code,
        patternPath: patternPathMap.get(row.pattern_id) || 'Unknown Route',
        vehicle: row.vehicle_code && row.vehicle_plate ? {
          code: row.vehicle_code,
          plate: row.vehicle_plate
        } : null,
        status: (row.status || 'scheduled') as CargoAvailableTrip['status'],
        departAtOrigin,
        arriveAtDestination,
        destinationStopId: destPs.stopId,
        destinationStopIds: destCandidates.map(ps => ps.stopId),
        originStopSequence: originPs.stopSequence,
        destinationStopSequence: destPs.stopSequence,
        legCount: destPs.stopSequence - originPs.stopSequence,
      });
    }

    return trips;
  }

  // NOTE: virtual (belum-materialized) trip TIDAK boleh dipakai cargo — hanya
  // trip real dengan kendaraan fisik yang boleh menerima pengiriman paket.
  // Fungsi ini sengaja dihapus (dulu getVirtualTripsForCargo); lihat
  // getCargoAvailableTrips() yang sekarang hanya memanggil getRealTripsForCargo.
}
