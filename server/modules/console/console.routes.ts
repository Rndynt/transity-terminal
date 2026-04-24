import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
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

    // Lightweight ETag fingerprint: sha1(channel|limit|serviceDate|tripCount|maxUpdatedAt).
    // Hindari rebuild snapshot mahal kalau client polling dgn If-None-Match.
    // Trade-off: booking/seat changes dlm window 60s tidak invalidate ETag —
    // konsisten dgn Cache-Control max-age=60 di bawah.
    let maxUpdatedTs = 0;
    for (const t of allTripsForDay) {
      const u = (t as { updatedAt?: Date | string | null }).updatedAt;
      if (u) {
        const ts = u instanceof Date ? u.getTime() : Date.parse(String(u));
        if (Number.isFinite(ts) && ts > maxUpdatedTs) maxUpdatedTs = ts;
      }
    }
    const fingerprint = `${channelParam}|${limit}|${serviceDate}|${allTripsForDay.length}|${maxUpdatedTs}`;
    const etag = `W/"sched-${createHash("sha1").update(fingerprint).digest("hex").slice(0, 16)}"`;

    // Always set cache headers regardless of cache hit/miss
    reply.header("Cache-Control", "private, max-age=60, must-revalidate");
    reply.header("ETag", etag);

    const ifNoneMatch = req.headers["if-none-match"];
    if (typeof ifNoneMatch === "string" && ifNoneMatch === etag) {
      req.log.info(
        { serviceDate, channels: channelParam, etag },
        "console.schedules.snapshot.304"
      );
      return reply.code(304).send();
    }

    const t0 = Date.now();
    const snapshot = await buildScheduleSnapshot(storage, serviceDate, allTripsForDay);
    const t1 = Date.now();
    req.log.info(
      {
        rawTripCount: allTripsForDay.length,
        syncedTripCount: snapshot.length,
        skippedPast: allTripsForDay.length - snapshot.length,
        ms: t1 - t0,
        serviceDate,
        etag,
      },
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
