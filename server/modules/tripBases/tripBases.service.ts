import { IStorage } from "@server/storage.interface";
import { InsertTripBase, TripBase, Trip, InsertTrip, scheduleExceptions } from "@shared/schema";
import { TripLegsService } from "@modules/tripLegs/tripLegs.service";
import { SeatInventoryService } from "@modules/seatInventory/seatInventory.service";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { fromZonedHHMMToUtc, getDayInTZ, formatTimeInTZ, ensureDefaultTimezone, normalizeTimeFormat } from "@server/utils/timezone";
import { webSocketService } from "@server/realtime/ws";
import { db } from "@server/db";
import { eq, and } from "drizzle-orm";
import { fireAndForget } from "@server/lib/consoleWebhook";
import { buildScheduleTripPayload } from "@server/lib/scheduleSnapshot";

async function emitTripWebhook(
  storage: IStorage,
  event: "schedule.created" | "schedule.updated" | "schedule.deleted",
  tripId: string,
) {
  try {
    const trip = await storage.getTripById(tripId);
    if (!trip) return;
    const payload = await buildScheduleTripPayload(storage, trip);
    if (!payload) return;
    fireAndForget({ event, trip: payload, emittedAt: new Date().toISOString() });
  } catch (err) {
    console.warn("[tripBases.service] failed to emit webhook:", (err as Error).message);
  }
}

/**
 * Detects PostgreSQL `unique_violation` (SQLSTATE 23505). node-pg and
 * neon-serverless surface it on `err.code`; drizzle sometimes wraps the
 * driver error and the code ends up on `err.cause.code` instead. We
 * keep the old message-match as a last-resort fallback, but the code
 * check is the deterministic path — relying on the human-readable
 * message was the bug this helper replaces.
 */
function isPgUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === "23505") return true;
  const causeCode = (err as { cause?: { code?: unknown } }).cause?.code;
  if (causeCode === "23505") return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("duplicate key") ||
      msg.includes("unique constraint") ||
      msg.includes("unique violation")
    );
  }
  return false;
}

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
    
    if (!dayFlags[dayOfWeek]) {
      return false;
    }

    const exceptions = await db.select({ baseId: scheduleExceptions.baseId })
      .from(scheduleExceptions)
      .where(and(
        eq(scheduleExceptions.baseId, base.id),
        eq(scheduleExceptions.exceptionDate, serviceDate),
      ));

    if (exceptions.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Get eligible bases for a given service date.
   *
   * Performance: pre-fetch all schedule exceptions for `serviceDate` in one
   * query, then evaluate each base's eligibility in-memory. Avoids the N+1
   * pattern of `getAllTripBases() + per-base isBaseEligible()`.
   */
  async getEligibleBases(serviceDate: string): Promise<TripBase[]> {
    const allBases = await this.getAllTripBases();
    if (allBases.length === 0) return [];

    const exceptionRows = await db.select({ baseId: scheduleExceptions.baseId })
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.exceptionDate, serviceDate));
    const exceptedBaseIds = new Set(exceptionRows.map(r => r.baseId).filter((id): id is string => id != null));

    const serviceDateObj = parseISO(serviceDate);
    const eligibleBases: TripBase[] = [];

    for (const base of allBases) {
      if (!base.active) continue;
      if (base.validFrom && serviceDateObj < parseISO(base.validFrom)) continue;
      if (base.validTo && serviceDateObj > parseISO(base.validTo)) continue;

      const timezone = ensureDefaultTimezone(base.timezone);
      const dayOfWeek = getDayInTZ(serviceDate, timezone);
      const dayFlags = [base.sun, base.mon, base.tue, base.wed, base.thu, base.fri, base.sat];
      if (!dayFlags[dayOfWeek]) continue;

      if (exceptedBaseIds.has(base.id)) continue;

      eligibleBases.push(base);
    }

    return eligibleBases;
  }

  /**
   * Convert defaultStopTimes local time strings to timestamptz using base timezone + serviceDate.
   * Handles overnight routes: if a converted timestamp is <= the previous one, it means midnight
   * was crossed, so we add the accumulated day offset to keep times strictly increasing.
   */
  computeDefaultTimestamps(base: TripBase, serviceDate: string): Array<{ stopSequence: number; arriveAt: Date | null; departAt: Date | null }> {
    const defaultStopTimes = base.defaultStopTimes as Array<{ stopSequence: number; arriveAt: string | null; departAt: string | null }>;
    
    if (!Array.isArray(defaultStopTimes)) {
      throw new Error('defaultStopTimes must be an array');
    }

    const timezone = ensureDefaultTimezone(base.timezone);
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const result: Array<{ stopSequence: number; arriveAt: Date | null; departAt: Date | null }> = [];
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
    // 1. Check if trip already exists (idempotency — always return existing trip regardless of eligibility changes)
    const existingTrip = await this.storage.getTripByBaseAndDate(baseId, serviceDate);
    if (existingTrip) {
      return existingTrip.id;
    }

    // 2. Load base and validate eligibility only when creating new trip
    const base = await this.getTripBaseById(baseId);
    const isEligible = await this.isBaseEligible(base, serviceDate);
    
    if (!isEligible) {
      throw new Error('base-not-eligible');
    }

    // 3. Prepare the row data up-front (no DB writes yet) so we can treat
    // the create-trip step as the single race-point. All unique keys on
    // `trips` funnel through the one insert on line marked below.
    const patternStops = await this.storage.getPatternStops(base.patternId);

    let vehicleId = base.defaultVehicleId;
    if (!vehicleId) {
      const pattern = await this.storage.getTripPatternById(base.patternId);
      if (pattern?.defaultLayoutId) {
        const vehicles = await this.storage.getVehicles();
        const compatibleVehicle = vehicles.find(v => v.layoutId === pattern.defaultLayoutId);
        vehicleId = compatibleVehicle?.id || null;
      }
      if (!vehicleId) {
        throw new Error('No suitable vehicle found for trip base. Please assign a default vehicle to the trip base or ensure vehicles exist for the pattern layout.');
      }
    }

    let capacity = base.capacity || null;
    if (!capacity) {
      const vehicle = await this.storage.getVehicleById(vehicleId);
      capacity = vehicle?.capacity || null;
    }
    if (!capacity && base.defaultLayoutId) {
      const layout = await this.storage.getLayoutById(base.defaultLayoutId);
      capacity = layout?.seatMap ? (layout.seatMap as Array<unknown>).length : null;
    }

    const timestamps = this.computeDefaultTimestamps(base, serviceDate);
    const firstStopTime = timestamps.find(t => t.stopSequence === 1);
    const timezone = ensureDefaultTimezone(base.timezone);
    const originDepartHHMM = firstStopTime?.departAt
      ? formatTimeInTZ(firstStopTime.departAt, timezone)
      : null;

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
      channelFlags: base.channelFlags as InsertTrip['channelFlags'],
      baseId: base.id,
      driverId: base.defaultDriverId,
      originDepartHHMM,
      snapRouteName: pattern?.name || null,
      snapRouteCode: pattern?.code || null,
      snapDriverName: driver?.name || null,
      snapVehiclePlate: vehicle?.plate || null,
    };

    const tripStopTimesData = timestamps.map(ts => {
      const patternStop = patternStops.find(ps => ps.stopSequence === ts.stopSequence);
      if (!patternStop) {
        throw new Error(`Pattern stop not found for sequence ${ts.stopSequence}`);
      }
      return {
        stopId: patternStop.stopId,
        stopSequence: ts.stopSequence,
        arriveAt: ts.arriveAt,
        departAt: ts.departAt,
        dwellSeconds: patternStop.dwellSeconds || 0,
        boardingAllowed: null,
        alightingAllowed: null,
      };
    });

    // 4. Attempt creation. The unique constraint on trips(base_id,
    // service_date) is our race serializer — two concurrent calls both
    // reach here, one wins `createTrip`, the other sees 23505 and
    // re-reads the winner's row. If any step *after* createTrip throws
    // (bulkUpsertTripStopTimes, deriveLegsFromTrip, precomputeInventory),
    // the new trip row stays in the DB as an orphan: no legs, no stop
    // times, no inventory. This is latent behavior that has existed
    // since the method was written; PR #11 tried to clean it up via
    // `storage.deleteTrip` and introduced a worse bug — `deleteTrip` is
    // a soft-delete but neither the `uniq_trip_base_per_day` unique
    // index nor `getTripByBaseAndDate` filters on `deleted_at`, so the
    // cleanup permanently poisoned the (base_id, service_date) slot.
    // Proper fix requires either (a) threading a tx through every step,
    // or (b) hard-deleting the orphan with explicit cascade on child
    // tables, or (c) making the unique index partial on deleted_at IS
    // NULL. None of those fit a regression hotfix, so we back off to
    // the pre-#11 behavior: let the orphan stay. The defense-in-depth
    // `deletedAt` filter on `getTripByBaseAndDate` (see
    // scheduling.repository.ts) ensures any unrelated soft-delete on a
    // trip does not cause this method to hand out a cancelled id.
    let tripIdResolved: string;
    let isFreshlyCreated = false;
    try {
      const trip = await this.storage.createTrip(tripData); // race point — unique (base_id, service_date)

      if (tripStopTimesData.length > 0) {
        await this.storage.bulkUpsertTripStopTimes(
          trip.id,
          tripStopTimesData.map(r => ({ ...r, tripId: trip.id })),
        );
      }

      await this.tripLegsService.deriveLegsFromTrip(trip);
      await this.seatInventoryService.precomputeInventory(trip);

      tripIdResolved = trip.id;
      isFreshlyCreated = true;
    } catch (error) {
      if (isPgUniqueViolation(error)) {
        // Race-loss at createTrip: another concurrent request committed
        // first. Re-read and return the winner's id. The winner row is
        // guaranteed to be `deletedAt IS NULL` here because createTrip
        // only inserts live rows.
        const winnerTrip = await this.storage.getTripByBaseAndDate(baseId, serviceDate);
        if (!winnerTrip) {
          throw new Error(`Failed to materialize trip for base ${baseId} on ${serviceDate}: unique constraint violation but no existing trip found`);
        }
        tripIdResolved = winnerTrip.id;
      } else {
        throw error;
      }
    }

    // B3: Emit WebSocket + webhook AFTER all DB work has settled, so listeners
    // never see a "trip materialized" event that points at a row still mid-write.
    // Skip emission for the race-condition path where another request already
    // emitted on the original creation.
    if (isFreshlyCreated) {
      webSocketService.emitTripMaterialized(baseId, serviceDate, tripIdResolved);
      void emitTripWebhook(this.storage, "schedule.created", tripIdResolved);
    }

    return tripIdResolved;
  }

  /**
   * Close a trip (operational close)
   */
  async closeTrip(tripId: string): Promise<Trip> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) {
      throw new Error(`Trip with id ${tripId} not found`);
    }

    const updatedTrip = await this.storage.updateTrip(tripId, { status: 'closed' });
    await this.storage.releaseHoldsForTrip(tripId);

    webSocketService.emitTripStatusChanged(tripId, 'closed', {
      baseId: trip.baseId || undefined,
      serviceDate: trip.serviceDate || undefined,
    });
    void emitTripWebhook(this.storage, "schedule.updated", tripId);

    return updatedTrip;
  }

  /**
   * Validate the structure of defaultStopTimes
   */
  private validateDefaultStopTimes(defaultStopTimes: unknown): void {
    if (!Array.isArray(defaultStopTimes)) {
      throw new Error('defaultStopTimes must be an array');
    }

    if (defaultStopTimes.length === 0) {
      throw new Error('defaultStopTimes must not be empty');
    }

    for (const stopTime of defaultStopTimes as Array<{ stopSequence?: unknown; arriveAt?: unknown; departAt?: unknown }>) {
      if (!stopTime.stopSequence || typeof stopTime.stopSequence !== 'number') {
        throw new Error('Each stop time must have a numeric stopSequence');
      }

      // Validate time format (HH:MM:SS or HH:MM)
      if (stopTime.arriveAt && !/^\d{2}:\d{2}(:\d{2})?$/.test(String(stopTime.arriveAt))) {
        throw new Error(`Invalid arriveAt format: ${stopTime.arriveAt}. Expected HH:MM or HH:MM:SS`);
      }

      if (stopTime.departAt && !/^\d{2}:\d{2}(:\d{2})?$/.test(String(stopTime.departAt))) {
        throw new Error(`Invalid departAt format: ${stopTime.departAt}. Expected HH:MM or HH:MM:SS`);
      }
    }
  }
}