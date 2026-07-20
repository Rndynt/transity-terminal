import { IStorage } from "@server/storage.interface";
import { TripBasesService } from "@modules/tripBases/tripBases.service";
import { TripBase } from "@shared/schema";
import { db } from "@server/db";
import { sql, and, eq, gte, lte, isNull } from "drizzle-orm";
import { scheduleExceptions, patternStops, scheduleStopExceptions } from "@shared/schema/scheduling";
import { stops } from "@shared/schema/network";
import { fireAndForget } from "@server/lib/consoleWebhook";
import { buildScheduleTripPayload } from "@server/lib/scheduleSnapshot";
import { webSocketService } from "@server/realtime/ws";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import { createComponentLogger } from "@server/lib/logger";
import { formatTimeInTZ } from "@server/utils/timezone";

const log = createComponentLogger("scheduler.service");

export type CalendarItem = {
  id: string;
  type: 'trip' | 'virtual' | 'exception';
  serviceDate: string;
  departureTime: string;
  hour: number;
  routeName: string;
  routeCode: string;
  baseId?: string | null;
  tripId?: string | null;
  vehicleId?: string | null;
  vehiclePlate?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  status?: string | null;
  capacity: number | null;
  seatsBooked?: number;
  exceptionId?: string | null;
  exceptionReason?: string | null;
  patternId?: string | null;
};

export class SchedulerService {
  private tripBasesService: TripBasesService;

  constructor(private storage: IStorage) {
    this.tripBasesService = new TripBasesService(storage);
  }

  async getCalendar(fromDate: string, toDate: string): Promise<CalendarItem[]> {
    const [realTrips, allBases, exceptions] = await Promise.all([
      this.storage.getTripsForDateRange(fromDate, toDate),
      this.storage.getTripBases(),
      this.getExceptionsForDateRange(fromDate, toDate),
    ]);

    const bookingCounts = await this.getBookingCountsForTrips(
      realTrips.map(t => t.id)
    );

    const exceptionMap = new Map<string, { id: string; reason: string | null }>();
    for (const ex of exceptions) {
      exceptionMap.set(`${ex.baseId}-${ex.exceptionDate}`, { id: ex.id, reason: ex.reason });
    }

    const items: CalendarItem[] = [];

    for (const trip of realTrips) {
      const departHHMM = this.resolveTripDepartHHMM(trip);
      const [hStr] = departHHMM.split(':');
      const hour = parseInt(hStr, 10) || 0;

      items.push({
        id: trip.id,
        type: 'trip',
        serviceDate: trip.serviceDate,
        departureTime: departHHMM,
        hour,
        routeName: trip.patternName || '—',
        routeCode: trip.patternCode || '—',
        baseId: trip.baseId,
        tripId: trip.id,
        vehicleId: trip.vehicleId || null,
        vehiclePlate: trip.vehiclePlate || null,
        driverId: trip.driverId || null,
        driverName: trip.driverName || null,
        status: trip.status || 'scheduled',
        capacity: trip.capacity,
        seatsBooked: bookingCounts.get(trip.id) || 0,
        patternId: trip.patternId || null,
      });
    }

    const baseIdsWithTrips = new Map<string, Set<string>>();
    for (const trip of realTrips) {
      if (trip.baseId) {
        if (!baseIdsWithTrips.has(trip.baseId)) {
          baseIdsWithTrips.set(trip.baseId, new Set());
        }
        baseIdsWithTrips.get(trip.baseId)!.add(trip.serviceDate);
      }
    }

    const from = new Date(fromDate + 'T00:00:00');
    const to = new Date(toDate + 'T00:00:00');

    for (const base of allBases) {
      if (!base.active || base.deletedAt) continue;

      const dateIter = new Date(from);
      while (dateIter <= to) {
        const dateStr = dateIter.toISOString().split('T')[0];

        const alreadyHasTrip = baseIdsWithTrips.get(base.id)?.has(dateStr);
        if (!alreadyHasTrip) {
          const eligible = await this.tripBasesService.isBaseEligible(base, dateStr);
          if (eligible) {
            const departHHMM = this.getBaseDepartureTime(base);
            const [hStr] = departHHMM.split(':');
            const hour = parseInt(hStr, 10) || 0;

            const exKey = `${base.id}-${dateStr}`;
            const exception = exceptionMap.get(exKey);

            if (exception) {
              items.push({
                id: `exception-${exception.id}`,
                type: 'exception',
                serviceDate: dateStr,
                departureTime: departHHMM,
                hour,
                routeName: base.name || '—',
                routeCode: base.code || '—',
                baseId: base.id,
                tripId: null,
                vehiclePlate: null,
                driverName: null,
                status: 'cancelled',
                capacity: base.capacity || null,
                seatsBooked: 0,
                exceptionId: exception.id,
                exceptionReason: exception.reason,
                patternId: base.patternId || null,
              });
            } else {
              items.push({
                id: `virtual-${base.id}-${dateStr}`,
                type: 'virtual',
                serviceDate: dateStr,
                departureTime: departHHMM,
                hour,
                routeName: base.name || '—',
                routeCode: base.code || '—',
                baseId: base.id,
                tripId: null,
                vehiclePlate: null,
                driverName: null,
                status: null,
                capacity: base.capacity || null,
                seatsBooked: 0,
                patternId: base.patternId || null,
              });
            }
          }
        }

        dateIter.setDate(dateIter.getDate() + 1);
      }
    }

    items.sort((a, b) => {
      if (a.serviceDate !== b.serviceDate) return a.serviceDate.localeCompare(b.serviceDate);
      return a.hour - b.hour || a.departureTime.localeCompare(b.departureTime);
    });

    return items;
  }

  // `trips.originDepartHHMM` is only a snapshot filled in at auto-
  // materialization time (see TripBasesService.materializeTrip, which
  // derives it from the base's default timestamps). For a trip created
  // ad-hoc via "+ Tambah Trip" (not from a recurring TripBase), that
  // column is NULL at insert — and the actual departure time, entered
  // afterwards through the "Jadwal Keberangkatan" dialog, is saved via
  // bulkUpsertTripStopTimes() straight into trip_stop_times, which never
  // back-fills originDepartHHMM. getCalendar()'s hour bucketing used to
  // read only that stale/absent column, so such a trip always landed in
  // the 00:00 slot no matter what departure time was actually scheduled.
  // `getTripsForDateRange` already exposes `scheduleTime` (MIN(depart_at)
  // across the trip's own stop times) — that's the live, always-correct
  // source, so prefer it and only fall back to the snapshot (then to
  // '00:00') when a trip genuinely has no stop times scheduled yet.
  private resolveTripDepartHHMM(trip: { scheduleTime?: string | null; originDepartHHMM?: string | null }): string {
    if (trip.scheduleTime) {
      const formatted = formatTimeInTZ(new Date(trip.scheduleTime), 'Asia/Jakarta');
      if (formatted) return formatted;
    }
    return trip.originDepartHHMM || '00:00';
  }

  async getPatternStopMap(): Promise<Record<string, string[]>> {
    const rows = await db.select({
      patternId: patternStops.patternId,
      stopId: patternStops.stopId,
    })
    .from(patternStops)
    .where(and(
      isNull(patternStops.deletedAt),
      eq(patternStops.boardingAllowed, true)
    ));

    const map: Record<string, string[]> = {};
    for (const row of rows) {
      if (!map[row.patternId]) map[row.patternId] = [];
      map[row.patternId].push(row.stopId);
    }
    return map;
  }

  async addException(baseId: string, exceptionDate: string, reason: string | undefined, createdBy: string | undefined, ctx: ServiceContext) {
    requirePermission(ctx, 'action.trip.close');
    const [inserted] = await db.insert(scheduleExceptions).values({
      baseId,
      exceptionDate,
      reason: reason || null,
      createdBy: createdBy || null,
    }).onConflictDoUpdate({
      target: [scheduleExceptions.baseId, scheduleExceptions.exceptionDate],
      set: { reason: reason || null, createdBy: createdBy || null },
    }).returning();

    // If a trip has ALREADY been materialized for this base+date (e.g. a
    // booking came in moments before this exception was added — a real
    // race, since any channel can auto-materialize a virtual slot), the
    // exception row alone does nothing: it only blocks FUTURE virtual
    // generation/materialization, it never touches an existing `trips`
    // row. Without this sync, CSO/App/OTA would keep treating the trip as
    // live (status stays 'scheduled') while Console was told it's
    // cancelled — two systems disagreeing about the same trip.
    await this.syncMaterializedTripForException(baseId, exceptionDate);

    return inserted;
  }

  private async syncMaterializedTripForException(baseId: string, exceptionDate: string) {
    try {
      const trip = await this.storage.getTripByBaseAndDate(baseId, exceptionDate);
      if (!trip) return; // nothing materialized yet — exception row alone is sufficient
      if (trip.status !== 'scheduled') return; // already closed/cancelled, nothing to sync

      await this.storage.updateTrip(trip.id, { status: 'cancelled' });
      await this.storage.releaseHoldsForTrip(trip.id);

      webSocketService.emitTripStatusChanged(trip.id, 'cancelled', {
        baseId,
        serviceDate: exceptionDate,
      });

      void this.emitTripCancelledWebhook(trip.id);
    } catch (err) {
      log.warn({ err, baseId, exceptionDate, op: "addException.sync" }, "failed to sync materialized trip to exception");
    }
  }

  private async emitTripCancelledWebhook(tripId: string) {
    try {
      const trip = await this.storage.getTripById(tripId);
      if (!trip) return;
      const payload = await buildScheduleTripPayload(this.storage, trip);
      if (!payload) return;
      // No status override needed here — trip.status is now genuinely
      // 'cancelled' in the DB, so buildScheduleTripPayload's own
      // mapTripStatus() already renders it correctly.
      fireAndForget({
        event: "schedule.updated",
        trip: payload,
        emittedAt: new Date().toISOString(),
      });
    } catch (err) {
      log.warn({ err, tripId, op: "addException" }, "webhook emit failed");
    }
  }

  async removeException(exceptionId: string, ctx: ServiceContext) {
    requirePermission(ctx, 'action.trip.close');
    await db.delete(scheduleExceptions).where(eq(scheduleExceptions.id, exceptionId));
  }

  async addStopException(baseId: string, exceptionDate: string, stopId: string, disableBoarding: boolean, disableAlighting: boolean, reason: string | undefined, createdBy: string | undefined, ctx: ServiceContext) {
    requirePermission(ctx, 'action.trip.close');
    const [inserted] = await db.insert(scheduleStopExceptions).values({
      baseId,
      exceptionDate,
      stopId,
      disableBoarding,
      disableAlighting,
      reason: reason || null,
      createdBy: createdBy || null,
    }).onConflictDoUpdate({
      target: [scheduleStopExceptions.baseId, scheduleStopExceptions.exceptionDate, scheduleStopExceptions.stopId],
      set: { disableBoarding, disableAlighting, reason: reason || null, createdBy: createdBy || null },
    }).returning();
    return inserted;
  }

  async getStopExceptionById(exceptionId: string) {
    const [row] = await db.select().from(scheduleStopExceptions).where(eq(scheduleStopExceptions.id, exceptionId));
    return row || null;
  }

  async removeStopException(exceptionId: string, ctx: ServiceContext) {
    requirePermission(ctx, 'action.trip.close');
    await db.delete(scheduleStopExceptions).where(eq(scheduleStopExceptions.id, exceptionId));
  }

  async getStopExceptions(baseId: string, exceptionDate: string) {
    return db.select({
      id: scheduleStopExceptions.id,
      baseId: scheduleStopExceptions.baseId,
      exceptionDate: scheduleStopExceptions.exceptionDate,
      stopId: scheduleStopExceptions.stopId,
      disableBoarding: scheduleStopExceptions.disableBoarding,
      disableAlighting: scheduleStopExceptions.disableAlighting,
      reason: scheduleStopExceptions.reason,
      stopName: stops.name,
      stopCode: stops.code,
    })
    .from(scheduleStopExceptions)
    .leftJoin(stops, eq(scheduleStopExceptions.stopId, stops.id))
    .where(and(
      eq(scheduleStopExceptions.baseId, baseId),
      eq(scheduleStopExceptions.exceptionDate, exceptionDate),
    ));
  }

  async getStopExceptionsForDateRange(fromDate: string, toDate: string) {
    return db.select()
    .from(scheduleStopExceptions)
    .where(and(
      gte(scheduleStopExceptions.exceptionDate, fromDate),
      lte(scheduleStopExceptions.exceptionDate, toDate),
    ));
  }

  private async getExceptionsForDateRange(fromDate: string, toDate: string) {
    return db.select().from(scheduleExceptions)
      .where(and(
        gte(scheduleExceptions.exceptionDate, fromDate),
        lte(scheduleExceptions.exceptionDate, toDate),
      ));
  }

  private getBaseDepartureTime(base: TripBase): string {
    const stopTimes = base.defaultStopTimes as Array<{ stopSequence: number; departAt?: string | null; arriveAt?: string | null }>;
    if (Array.isArray(stopTimes) && stopTimes.length > 0) {
      const first = stopTimes.find((s) => s.stopSequence === 1) || stopTimes[0];
      return first.departAt || first.arriveAt || '00:00';
    }
    return '00:00';
  }

  private async getBookingCountsForTrips(tripIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (tripIds.length === 0) return result;

    const pgArray = `{${tripIds.join(',')}}`;
    const rows = await db.execute(sql`
      SELECT b.trip_id AS "tripId", COUNT(DISTINCT p.id)::int AS "count"
      FROM bookings b
      JOIN passengers p ON p.booking_id = b.id
      WHERE b.trip_id = ANY(${pgArray}::uuid[])
        AND b.status IN ('pending', 'paid', 'confirmed')
        AND COALESCE(p.ticket_status, 'active') != 'cancelled'
      GROUP BY b.trip_id
    `);

    for (const row of rows.rows as Array<{ tripId: string; count: number }>) {
      result.set(row.tripId, row.count);
    }
    return result;
  }
}
