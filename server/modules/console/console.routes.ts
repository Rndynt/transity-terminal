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

    const snapshot = await buildScheduleSnapshot(storage, serviceDate);
    const filtered = snapshot
      .filter((t) => t.channels.some((c) => wantedChannels.has(c)))
      .slice(0, limit);

    reply.send({
      event: "schedule.snapshot",
      serviceDate,
      trips: filtered,
      emittedAt: new Date().toISOString(),
    });
  });
}
