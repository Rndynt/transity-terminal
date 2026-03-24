import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IStorage } from "../../storage.interface";
import { SchedulerService } from "./scheduler.service";
import { z } from "zod";
import { requireFlag } from "../rbac/rbac.middleware";

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

  app.post('/api/scheduler/exceptions', { preHandler: [requireFlag('action.trip.close')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      baseId: z.string().uuid(),
      exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid request', errors: parsed.error.flatten() });
    }

    const user = (req as any).user;
    const exception = await schedulerService.addException(
      parsed.data.baseId,
      parsed.data.exceptionDate,
      parsed.data.reason,
      user?.id || null,
    );
    reply.code(201).send(exception);
  });

  app.delete('/api/scheduler/exceptions/:id', { preHandler: [requireFlag('action.trip.close')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await schedulerService.removeException(id);
    reply.send({ success: true });
  });
}
