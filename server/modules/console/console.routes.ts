import type { FastifyInstance } from "fastify";
import type { IStorage } from "@server/storage.interface";
import { buildScheduleSnapshot } from "@server/lib/scheduleSnapshot";

export function registerConsoleRoutes(app: FastifyInstance, storage: IStorage) {
  const requireServiceKey = (req: any, reply: any): boolean => {
    const incoming = req.headers["x-service-key"] as string | undefined;
    const expected = process.env.TERMINAL_SERVICE_KEY || "";
    if (!expected) {
      if (process.env.NODE_ENV === "production") {
        reply.code(503).send({ error: "TERMINAL_SERVICE_KEY not configured" });
        return false;
      }
      return true;
    }
    if (!incoming) {
      reply.code(401).send({ error: "Missing X-Service-Key header" });
      return false;
    }
    if (incoming !== expected) {
      reply.code(401).send({ error: "Invalid service key" });
      return false;
    }
    return true;
  };

  app.get("/api/console/schedules", async (req, reply) => {
    if (!requireServiceKey(req, reply)) return;

    const q = (req.query ?? {}) as Record<string, string | undefined>;
    const channelParam = (q.channel ?? "ota,app").toLowerCase();
    const wantedChannels = new Set(channelParam.split(",").map((s) => s.trim()));
    const today = new Date().toISOString().substring(0, 10);
    const serviceDate = q.serviceDate || q.date || today;
    const limit = Math.min(parseInt(q.limit || "200", 10) || 200, 500);

    const maxTrips = parseInt(process.env.CONSOLE_SNAPSHOT_MAX_TRIPS || "1000", 10);
    const allTripsForDay = await storage.getTrips(serviceDate);
    if (allTripsForDay.length > maxTrips) {
      return reply.code(413).send({
        error: `Snapshot too large (${allTripsForDay.length} trips). Use date range filter or increase CONSOLE_SNAPSHOT_MAX_TRIPS.`,
      });
    }

    const t0 = Date.now();
    const snapshot = await buildScheduleSnapshot(storage, serviceDate, allTripsForDay);
    const t1 = Date.now();
    req.log.info(
      { tripCount: snapshot.length, ms: t1 - t0, serviceDate },
      "console.schedules.snapshot.built"
    );

    const filtered = snapshot
      .filter((t) => t.channels.some((c) => wantedChannels.has(c)))
      .slice(0, limit);

    const trips = filtered.map((t) => ({
      tripId: t.externalTripId,
      baseScheduleId: t.externalBaseId,
      routeName: t.routeName,
      origin: {
        city: t.originCity,
        name: t.originStop,
        departAt: t.departureTime,
      },
      destination: {
        city: t.destinationCity,
        name: t.destinationStop,
        arriveAt: t.arrivalTime,
      },
      serviceDate: t.serviceDate,
      vehicleClass: t.vehicleClass,
      farePerPerson: t.farePerPerson,
      capacity: t.capacity,
      availableSeats: t.availableSeats,
      channels: t.channels,
      status: t.status,
      raw: t.raw,
    }));

    reply.send({
      event: "schedule.snapshot",
      serviceDate,
      trips,
      emittedAt: new Date().toISOString(),
    });
  });
}
