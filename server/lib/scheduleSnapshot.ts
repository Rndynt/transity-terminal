import { and, eq, isNull, or, desc, inArray } from "drizzle-orm";
import { db } from "@server/db";
import { priceRules } from "@shared/schema/inventory";
import type { IStorage } from "@server/storage.interface";
import type { Trip } from "@shared/schema";
import {
  deriveChannels,
  mapTripStatus,
  type SchedulePayloadTrip,
} from "./consoleWebhook";

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
    const conds: any[] = [];
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
    const conds: any[] = [];
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

export async function buildScheduleTripPayload(
  storage: IStorage,
  trip: Trip
): Promise<SchedulePayloadTrip | null> {
  const channels = deriveChannels(trip.channelFlags as any);

  const patternStops = trip.patternId
    ? await storage.getPatternStops(trip.patternId).catch(() => [])
    : [];
  const stopTimes = await storage.getTripStopTimes(trip.id).catch(() => []);
  const pattern = trip.patternId
    ? await storage.getTripPatternById?.(trip.patternId).catch(() => null)
    : null;

  const sortedStops = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);
  const firstStop = sortedStops[0]?.stop ?? null;
  const lastStop = sortedStops[sortedStops.length - 1]?.stop ?? null;

  const sortedTimes = [...stopTimes].sort((a, b) => a.stopSequence - b.stopSequence);
  const firstTime = sortedTimes[0];
  const lastTime = sortedTimes[sortedTimes.length - 1];

  let availableSeats = trip.capacity ?? 0;
  try {
    const bookings = await storage.getActiveBookingsForTrip(trip.id);
    if (bookings.length > 0) {
      const ids = bookings.map((b) => b.id);
      const passengers = await storage.getPassengersByBookingIds(ids);
      const taken = new Set(passengers.map((p) => p.seatNo).filter(Boolean));
      availableSeats = Math.max(0, (trip.capacity ?? 0) - taken.size);
    }
  } catch {
    // best-effort
  }

  const farePerPerson = await resolveFarePerPerson(trip);

  const routeName =
    (pattern && (pattern as any).name) ||
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
    vehicleClass: (pattern as any)?.vehicleClass ?? null,
    farePerPerson,
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

export async function buildScheduleSnapshot(
  storage: IStorage,
  serviceDate?: string
): Promise<SchedulePayloadTrip[]> {
  const trips = await storage.getTrips(serviceDate);
  const out: SchedulePayloadTrip[] = [];
  for (const t of trips) {
    const payload = await buildScheduleTripPayload(storage, t);
    if (payload && payload.channels.length > 0) {
      out.push(payload);
    }
  }
  return out;
}
