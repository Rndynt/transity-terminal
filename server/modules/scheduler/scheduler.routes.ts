import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IStorage } from "../../storage.interface";
import { SchedulerService } from "./scheduler.service";
import { z } from "zod";

export function registerSchedulerRoutes(app: FastifyInstance, storage: IStorage) {
  const schedulerService = new SchedulerService(storage);

  app.get('/api/scheduler/calendar', async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'from and to query params required (YYYY-MM-DD)' });
    }

    const items = await schedulerService.getCalendar(parsed.data.from, parsed.data.to);
    reply.send(items);
  });
}
