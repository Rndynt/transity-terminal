import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IStorage } from "@server/storage.interface";
import { SchedulerService } from "./scheduler.service";
import { TripsService } from "@server/modules/trips/trips.service";
import { z } from "zod";
import { requireFlag } from "@server/modules/rbac/rbac.middleware";
import { webSocketService } from "@server/realtime/ws";

export function registerSchedulerRoutes(app: FastifyInstance, storage: IStorage) {
  const schedulerService = new SchedulerService(storage);
  const tripsService = new TripsService(storage);

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

  app.get('/api/scheduler/pattern-stop-map', async (_req: FastifyRequest, reply: FastifyReply) => {
    const map = await schedulerService.getPatternStopMap();
    reply.send(map);
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

  app.get('/api/scheduler/stop-exceptions', async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      baseId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'baseId and date required' });
    }
    const items = await schedulerService.getStopExceptions(parsed.data.baseId, parsed.data.date);
    reply.send(items);
  });

  app.post('/api/scheduler/stop-exceptions', { preHandler: [requireFlag('action.trip.close')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      baseId: z.string().uuid(),
      exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      stopId: z.string().uuid(),
      disableBoarding: z.boolean().default(true),
      disableAlighting: z.boolean().default(false),
      reason: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid request', errors: parsed.error.flatten() });
    }
    const user = (req as any).user;
    const exception = await schedulerService.addStopException(
      parsed.data.baseId,
      parsed.data.exceptionDate,
      parsed.data.stopId,
      parsed.data.disableBoarding,
      parsed.data.disableAlighting,
      parsed.data.reason,
      user?.id || null,
    );
    webSocketService.broadcast('STOP_EXCEPTION_CHANGED', {
      baseId: parsed.data.baseId,
      serviceDate: parsed.data.exceptionDate,
      stopId: parsed.data.stopId,
    });
    reply.code(201).send(exception);
  });

  app.delete('/api/scheduler/stop-exceptions/:id', { preHandler: [requireFlag('action.trip.close')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const exception = await schedulerService.getStopExceptionById(id);
    await schedulerService.removeStopException(id);
    if (exception) {
      webSocketService.broadcast('STOP_EXCEPTION_CHANGED', {
        baseId: exception.baseId,
        serviceDate: exception.exceptionDate,
        stopId: exception.stopId,
      });
    }
    reply.send({ success: true });
  });

  app.patch('/api/scheduler/trips/:id/assign', { preHandler: [requireFlag('action.trip.close')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      driverId: z.string().uuid().nullable().optional(),
      vehicleId: z.string().uuid().nullable().optional(),
    }).refine(d => d.driverId !== undefined || d.vehicleId !== undefined, {
      message: 'At least one of driverId or vehicleId must be provided',
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid request', errors: parsed.error.flatten() });
    }

    try {
      const updateData: Record<string, any> = {};
      if (parsed.data.driverId !== undefined) updateData.driverId = parsed.data.driverId;
      if (parsed.data.vehicleId !== undefined) updateData.vehicleId = parsed.data.vehicleId;

      const updated = await tripsService.updateTrip(id, updateData);

      const driver = updated.driverId ? await storage.getDriverById(updated.driverId) : null;
      const vehicle = updated.vehicleId ? await storage.getVehicleById(updated.vehicleId) : null;

      reply.send({
        tripId: updated.id,
        driverId: updated.driverId,
        driverName: driver?.name || updated.snapDriverName || null,
        vehicleId: updated.vehicleId,
        vehiclePlate: vehicle?.plate || updated.snapVehiclePlate || null,
      });
    } catch (err: any) {
      return reply.code(400).send({ message: err.message || 'Failed to update assignment' });
    }
  });
}
