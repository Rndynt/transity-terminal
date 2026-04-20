import type { IStorage } from "@server/storage.interface";
import type { Trip } from "@shared/schema";
import {
  deriveChannels,
  mapTripStatus,
  type SchedulePayloadTrip,
} from "./consoleWebhook";

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

  const farePerPerson = 0; // TODO: wire to price_rules / trip default fare when available

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
