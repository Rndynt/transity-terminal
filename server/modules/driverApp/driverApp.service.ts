import { db } from "@server/db";
import { sql } from "drizzle-orm";
import { fromZonedHHMMToUtc } from "@server/utils/timezone";

const TZ = "Asia/Jakarta";

function getRows(result: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] })?.rows || [])) as Array<Record<string, unknown>>;
}

export interface DriverProfile {
  id: string;
  code: string;
  name: string;
}

export interface DriverScheduleTrip {
  tripId: string;
  serviceDate: string;
  departureTime: string | null;
  status: string | null;
  patternName: string | null;
  patternCode: string | null;
  vehiclePlate: string | null;
  originStop: string | null;
  destinationStop: string | null;
}

export interface DriverSchedule {
  past: DriverScheduleTrip[];
  upcoming: DriverScheduleTrip[];
}

/**
 * A trip counts as "upcoming" when its departure hasn't happened yet.
 * Unknown/missing departure time falls back to end-of-service-date so a
 * trip isn't silently dropped from either bucket.
 */
function isUpcoming(serviceDate: string, hhmm: string | null, now: Date): boolean {
  const refTime = hhmm && hhmm.trim() ? hhmm : "23:59:59";
  const at = fromZonedHHMMToUtc(serviceDate, refTime, TZ);
  if (!at) return true;
  return at.getTime() >= now.getTime();
}

export class DriverAppService {
  /** Resolves the caller's own driver.id from their logged-in user id. */
  async resolveDriverId(userId: string): Promise<string | null> {
    const result = await db.execute(sql`
      SELECT id FROM drivers WHERE user_id = ${userId} AND deleted_at IS NULL LIMIT 1
    `);
    const row = getRows(result)[0];
    return (row?.id as string | undefined) ?? null;
  }

  async getMyProfile(userId: string): Promise<DriverProfile | null> {
    const result = await db.execute(sql`
      SELECT id, code, name FROM drivers WHERE user_id = ${userId} AND deleted_at IS NULL LIMIT 1
    `);
    const row = getRows(result)[0];
    if (!row) return null;
    return { id: row.id as string, code: row.code as string, name: row.name as string };
  }

  async getMySchedule(userId: string): Promise<DriverSchedule> {
    const driverId = await this.resolveDriverId(userId);
    if (!driverId) return { past: [], upcoming: [] };

    // P5-style cap: mirrors SchedulingRepository.getTrips (default 500, max 2000)
    // to keep this bounded even for long-tenured drivers.
    const cap = 500;

    const result = await db.execute(sql`
      SELECT
        t.id                  AS "tripId",
        t.service_date        AS "serviceDate",
        t.origin_depart_hhmm  AS "departureTime",
        t.status              AS "status",
        tp.name               AS "patternName",
        tp.code               AS "patternCode",
        v.plate               AS "vehiclePlate",
        origin_s.name         AS "originStop",
        dest_s.name           AS "destinationStop"
      FROM trips t
      LEFT JOIN trip_patterns tp ON tp.id = t.pattern_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN pattern_stops ps_origin ON ps_origin.pattern_id = t.pattern_id
        AND ps_origin.stop_sequence = (
          SELECT MIN(ps2.stop_sequence) FROM pattern_stops ps2 WHERE ps2.pattern_id = t.pattern_id
        )
      LEFT JOIN stops origin_s ON origin_s.id = ps_origin.stop_id
      LEFT JOIN pattern_stops ps_dest ON ps_dest.pattern_id = t.pattern_id
        AND ps_dest.stop_sequence = (
          SELECT MAX(ps3.stop_sequence) FROM pattern_stops ps3 WHERE ps3.pattern_id = t.pattern_id
        )
      LEFT JOIN stops dest_s ON dest_s.id = ps_dest.stop_id
      WHERE t.driver_id = ${driverId} AND t.deleted_at IS NULL
      ORDER BY t.service_date ASC, t.origin_depart_hhmm ASC NULLS LAST
      LIMIT ${cap}
    `);

    const now = new Date();
    const past: DriverScheduleTrip[] = [];
    const upcoming: DriverScheduleTrip[] = [];

    for (const row of getRows(result)) {
      const trip: DriverScheduleTrip = {
        tripId: row.tripId as string,
        serviceDate: row.serviceDate as string,
        departureTime: (row.departureTime as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        patternName: (row.patternName as string | null) ?? null,
        patternCode: (row.patternCode as string | null) ?? null,
        vehiclePlate: (row.vehiclePlate as string | null) ?? null,
        originStop: (row.originStop as string | null) ?? null,
        destinationStop: (row.destinationStop as string | null) ?? null,
      };
      if (isUpcoming(trip.serviceDate, trip.departureTime, now)) {
        upcoming.push(trip);
      } else {
        past.push(trip);
      }
    }

    // Query is ASC overall; flip `past` so the most recent past trip is first.
    past.reverse();

    return { past, upcoming };
  }
}
