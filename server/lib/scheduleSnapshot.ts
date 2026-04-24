import { and, eq, isNull, or, desc, inArray, type SQL } from "drizzle-orm";
import { db } from "@server/db";
import { priceRules } from "@shared/schema/inventory";
import type { IStorage } from "@server/storage.interface";
import type {
  Trip,
  PatternStop,
  TripStopTime,
  TripPattern,
  Booking,
  Passenger,
  Stop,
} from "@shared/schema";
import {
  deriveChannels,
  mapTripStatus,
  type SchedulePayloadTrip,
  type ChannelFlags,
} from "./consoleWebhook";
import { fromZonedHHMMToUtc, ensureDefaultTimezone } from "@server/utils/timezone";

/**
 * Decide whether a trip's departure is far enough in the past that we should
 * stop syncing it. We allow a grace window (default 60 minutes) after the
 * scheduled departure so last-minute updates (e.g. seat checked in 10 min after
 * departure) still propagate, but anything older than the grace is dropped.
 *
 * Returns true when the trip should be EXCLUDED from sync.
 */
export function isTripDeparturePastGrace(
  trip: Trip,
  graceMinutes: number,
  tz: string,
  now: Date = new Date()
): boolean {
  const sd: unknown = trip.serviceDate;
  let serviceDate: string | null = null;
  if (typeof sd === "string" && sd.length >= 10) {
    serviceDate = sd.substring(0, 10);
  } else if (sd instanceof Date) {
    serviceDate = sd.toISOString().substring(0, 10);
  }
  if (!serviceDate) return false; // unknown date — be conservative, keep it

  // Cheap pre-check: if serviceDate is more than ~2 days before "today" in tz,
  // it's definitely past-grace regardless of HH:MM.
  // (Skip — handled by the precise check below; small perf gain not needed.)

  const hhmm = trip.originDepartHHMM;
  if (!hhmm || typeof hhmm !== "string") {
    // No known departure time. Fall back to end-of-service-date in tz.
    // If serviceDate < today (in tz) by more than 1 day, exclude.
    const todayUtc = fromZonedHHMMToUtc(serviceDate, "23:59:59", tz);
    if (!todayUtc) return false;
    return todayUtc.getTime() < now.getTime() - graceMinutes * 60_000;
  }

  const departUtc = fromZonedHHMMToUtc(serviceDate, hhmm, tz);
  if (!departUtc) return false; // invalid time — keep, don't lose data

  return departUtc.getTime() < now.getTime() - graceMinutes * 60_000;
}

function extractFareFromRule(rule: unknown): number {
  if (!rule || typeof rule !== "object") return 0;
  const r = rule as Record<string, unknown>;
  const raw =
    r["basePricePerLeg"] ??
    r["basePrice"] ??
    r["price"] ??
    r["amount"] ??
    r["fare"];
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  const mult = Number(r["multiplier"]);
  return Math.round(n * (Number.isFinite(mult) && mult > 0 ? mult : 1));
}

async function resolveFarePerPerson(trip: Trip): Promise<number> {
  try {
    const conds: SQL[] = [];
    conds.push(eq(priceRules.tripId, trip.id));
    if (trip.patternId) conds.push(eq(priceRules.patternId, trip.patternId));
    const orCond = conds.length === 1 ? conds[0] : or(...conds);

    const rows = await db
      .select({
        scope: priceRules.scope,
        priority: priceRules.priority,
        rule: priceRules.rule,
        tripId: priceRules.tripId,
      })
      .from(priceRules)
      .where(and(orCond, isNull(priceRules.deletedAt)))
      .orderBy(desc(priceRules.priority));

    const tripScoped = rows.find((r) => r.tripId === trip.id);
    const chosen = tripScoped ?? rows[0];
    return chosen ? extractFareFromRule(chosen.rule) : 0;
  } catch {
    return 0;
  }
}

export async function resolveFaresForTrips(
  trips: Trip[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (trips.length === 0) return out;
  const tripIds = trips.map((t) => t.id);
  const patternIds = Array.from(
    new Set(trips.map((t) => t.patternId).filter((x): x is string => !!x))
  );
  try {
    const conds: SQL[] = [];
    if (tripIds.length) conds.push(inArray(priceRules.tripId, tripIds));
    if (patternIds.length) conds.push(inArray(priceRules.patternId, patternIds));
    if (conds.length === 0) return out;
    const orCond = conds.length === 1 ? conds[0] : or(...conds);
    const rows = await db
      .select({
        priority: priceRules.priority,
        rule: priceRules.rule,
        tripId: priceRules.tripId,
        patternId: priceRules.patternId,
      })
      .from(priceRules)
      .where(and(orCond, isNull(priceRules.deletedAt)))
      .orderBy(desc(priceRules.priority));

    const byTrip = new Map<string, number>();
    const byPattern = new Map<string, number>();
    for (const r of rows) {
      const v = extractFareFromRule(r.rule);
      if (r.tripId && !byTrip.has(r.tripId)) byTrip.set(r.tripId, v);
      else if (r.patternId && !byPattern.has(r.patternId))
        byPattern.set(r.patternId, v);
    }
    for (const t of trips) {
      const v =
        byTrip.get(t.id) ??
        (t.patternId ? byPattern.get(t.patternId) : undefined) ??
        0;
      out.set(t.id, v);
    }
  } catch {
    // best-effort: leave map empty -> 0
  }
  return out;
}

function toHHMMSS(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    const m = input.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) return `${m[1]}:${m[2]}:${m[3] || "00"}`;
  }
  if (input instanceof Date) {
    return input.toISOString().substring(11, 19);
  }
  return null;
}

function dateStr(d: unknown): string {
  if (typeof d === "string") return d.substring(0, 10);
  if (d instanceof Date) return d.toISOString().substring(0, 10);
  return new Date().toISOString().substring(0, 10);
}

export type BuildPayloadDeps = {
  patternStops: Array<PatternStop & { stop: Stop | null }>;
  stopTimes: TripStopTime[];
  pattern: TripPattern | null;
  bookings: Booking[];
  passengers: Passenger[];
  fare: number;
};

/**
 * Sync core builder — pure function over already-fetched deps.
 * Single source of truth for the SchedulePayloadTrip shape.
 */
export function buildScheduleTripPayloadSync(
  trip: Trip,
  deps: BuildPayloadDeps
): SchedulePayloadTrip | null {
  const channels = deriveChannels(trip.channelFlags as ChannelFlags | null | undefined);

  const sortedStops = [...deps.patternStops].sort((a, b) => a.stopSequence - b.stopSequence);
  const firstStop = sortedStops[0]?.stop ?? null;
  const lastStop = sortedStops[sortedStops.length - 1]?.stop ?? null;

  const sortedTimes = [...deps.stopTimes].sort((a, b) => a.stopSequence - b.stopSequence);
  const firstTime = sortedTimes[0];
  const lastTime = sortedTimes[sortedTimes.length - 1];

  let availableSeats = trip.capacity ?? 0;
  if (deps.bookings.length > 0) {
    const bookingIds = new Set(deps.bookings.map((b) => b.id));
    const tripPassengers = deps.passengers.filter((p) => bookingIds.has(p.bookingId));
    const taken = new Set(tripPassengers.map((p) => p.seatNo).filter(Boolean));
    availableSeats = Math.max(0, (trip.capacity ?? 0) - taken.size);
  }

  const routeName =
    (deps.pattern && (deps.pattern as { name?: string }).name) ||
    [firstStop?.city, lastStop?.city].filter(Boolean).join(" - ") ||
    "Unknown route";

  return {
    externalTripId: trip.id,
    externalBaseId: trip.baseId ?? null,
    routeName,
    originCity: firstStop?.city ?? "Unknown",
    originStop: firstStop?.name ?? null,
    destinationCity: lastStop?.city ?? "Unknown",
    destinationStop: lastStop?.name ?? null,
    serviceDate: dateStr(trip.serviceDate),
    departureTime: toHHMMSS(firstTime?.departAt) ?? toHHMMSS(trip.originDepartHHMM),
    arrivalTime: toHHMMSS(lastTime?.arriveAt),
    vehicleClass: (deps.pattern as { vehicleClass?: string | null } | null)?.vehicleClass ?? null,
    farePerPerson: deps.fare,
    capacity: trip.capacity ?? 0,
    availableSeats,
    channels,
    status: mapTripStatus(trip.status as string | null | undefined),
    raw: {
      tripId: trip.id,
      baseId: trip.baseId,
      patternId: trip.patternId,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
    },
  };
}

/**
 * Async single-trip builder. Thin wrapper that fetches deps then delegates
 * to buildScheduleTripPayloadSync. Kept for backward-compat with callers
 * that build payloads one trip at a time (webhooks: trip.created/updated).
 */
export async function buildScheduleTripPayload(
  storage: IStorage,
  trip: Trip
): Promise<SchedulePayloadTrip | null> {
  const [patternStops, stopTimes, pattern, bookings, fare] = await Promise.all([
    trip.patternId
      ? storage.getPatternStops(trip.patternId).catch(() => [])
      : Promise.resolve([] as Array<PatternStop & { stop: Stop | null }>),
    storage.getTripStopTimes(trip.id).catch(() => [] as TripStopTime[]),
    trip.patternId
      ? (storage.getTripPatternById?.(trip.patternId).catch(() => null) ??
         Promise.resolve(null))
      : Promise.resolve(null),
    storage.getActiveBookingsForTrip(trip.id).catch(() => [] as Booking[]),
    resolveFarePerPerson(trip),
  ]);

  const passengers = bookings.length
    ? await storage
        .getPassengersByBookingIds(bookings.map((b) => b.id))
        .catch(() => [] as Passenger[])
    : [];

  return buildScheduleTripPayloadSync(trip, {
    patternStops,
    stopTimes,
    pattern: pattern ?? null,
    bookings,
    passengers,
    fare,
  });
}

/**
 * Batched snapshot builder. Fetches all related data in ~5 parallel queries
 * (regardless of trip count), then assembles payloads in-memory.
 *
 * If `preloadedTrips` is provided, skips the initial `getTrips` query — useful
 * when the caller has already fetched trips (e.g. for a size guard).
 */
export async function buildScheduleSnapshot(
  storage: IStorage,
  serviceDate?: string,
  preloadedTrips?: Trip[]
): Promise<SchedulePayloadTrip[]> {
  const allTrips = preloadedTrips ?? (await storage.getTrips(serviceDate));
  if (allTrips.length === 0) return [];

  // Drop trips whose departure has already passed by more than the grace
  // window, so we don't keep re-syncing yesterday's / earlier-today's trips.
  const graceMinutes = Math.max(
    0,
    parseInt(process.env.SCHEDULE_SNAPSHOT_GRACE_MINUTES || "60", 10) || 60
  );
  const tz = ensureDefaultTimezone(process.env.OPERATOR_TZ);
  const now = new Date();
  const trips = allTrips.filter(
    (t) => !isTripDeparturePastGrace(t, graceMinutes, tz, now)
  );
  if (trips.length === 0) return [];

  const tripIds = trips.map((t) => t.id);
  const patternIds = Array.from(
    new Set(trips.map((t) => t.patternId).filter((x): x is string => !!x))
  );

  const [
    patternStopsByPattern,
    stopTimesByTrip,
    patternsById,
    bookingsByTrip,
    faresByTrip,
  ] = await Promise.all([
    storage.getPatternStopsByPatternIds(patternIds).catch(() => new Map()),
    storage.getTripStopTimesByTripIds(tripIds).catch(() => new Map()),
    storage.getTripPatternsByIds(patternIds).catch(() => new Map()),
    storage.getActiveBookingsByTripIds(tripIds).catch(() => new Map()),
    resolveFaresForTrips(trips),
  ]);

  const allBookingIds: string[] = [];
  Array.from(bookingsByTrip.values()).forEach((list) => {
    for (const b of list) allBookingIds.push(b.id);
  });
  const allPassengers = allBookingIds.length
    ? await storage.getPassengersByBookingIds(allBookingIds).catch(() => [] as Passenger[])
    : [];

  // Group passengers by bookingId for O(1) lookup per trip
  const passengersByBooking = new Map<string, Passenger[]>();
  for (const p of allPassengers) {
    const arr = passengersByBooking.get(p.bookingId) ?? [];
    arr.push(p);
    passengersByBooking.set(p.bookingId, arr);
  }

  const out: SchedulePayloadTrip[] = [];
  for (const t of trips) {
    const tripBookings = bookingsByTrip.get(t.id) ?? [];
    const tripPassengers: Passenger[] = [];
    for (const b of tripBookings) {
      const ps = passengersByBooking.get(b.id);
      if (ps) tripPassengers.push(...ps);
    }

    const payload = buildScheduleTripPayloadSync(t, {
      patternStops: t.patternId ? (patternStopsByPattern.get(t.patternId) ?? []) : [],
      stopTimes: stopTimesByTrip.get(t.id) ?? [],
      pattern: t.patternId ? (patternsById.get(t.patternId) ?? null) : null,
      bookings: tripBookings,
      passengers: tripPassengers,
      fare: faresByTrip.get(t.id) ?? 0,
    });
    if (payload && payload.channels.length > 0) out.push(payload);
  }
  return out;
}
