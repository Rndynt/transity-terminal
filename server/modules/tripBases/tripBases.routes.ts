import type { FastifyInstance } from "fastify";
import { TripBasesController } from "./tripBases.controller";
import { TripBasesService } from "./tripBases.service";
import { IStorage } from "../../storage.interface";
import { requireFlag, requireAnyFlag } from "../rbac/rbac.middleware";
import { RescheduleService } from "../bookings/reschedule.service";
import { webSocketService } from "../../realtime/ws";

export function registerTripBasesRoutes(app: FastifyInstance, storage: IStorage) {
  const service = new TripBasesService(storage);
  const controller = new TripBasesController(service);
  const rescheduleService = new RescheduleService(storage);

  app.get('/api/trip-bases', async (req, reply) => controller.getAllTripBases(req, reply));
  app.get('/api/trip-bases/:id', async (req, reply) => controller.getTripBaseById(req, reply));
  app.post('/api/trip-bases', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => controller.createTripBase(req, reply));
  app.put('/api/trip-bases/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => controller.updateTripBase(req, reply));
  app.delete('/api/trip-bases/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => controller.deleteTripBase(req, reply));

  app.post('/api/cso/materialize-trip', { preHandler: [requireFlag('action.trip.materialize')] }, async (req, reply) => controller.materializeTrip(req, reply));
  app.post('/api/trips/:id/close', { preHandler: [requireFlag('action.trip.close')] }, async (req, reply) => controller.closeTrip(req, reply));

  app.get('/api/trips/:id/active-passengers', { preHandler: [requireAnyFlag('action.trip.close', 'action.trip.batch_reschedule')] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const passengers = await storage.getActivePassengersForTrip(id);
      reply.send(passengers);
    } catch (error) {
      reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/trips/:id/close-with-reschedule', { preHandler: [requireFlag('action.trip.close'), requireFlag('action.trip.batch_reschedule')] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as {
        newTripId: string;
        newOriginStopId: string;
        newDestinationStopId: string;
        newOriginSeq: number;
        newDestinationSeq: number;
        reason?: string;
      };

      if (!body.newTripId || !body.newOriginStopId || !body.newDestinationStopId || body.newOriginSeq == null || body.newDestinationSeq == null) {
        return reply.code(400).send({ message: 'Missing required fields: newTripId, newOriginStopId, newDestinationStopId, newOriginSeq, newDestinationSeq' });
      }

      const performedBy = req.user?.id ?? 'system';
      const reason = body.reason || 'Batch reschedule — trip ditutup oleh operator';

      const result = await rescheduleService.batchRescheduleForTripClose(
        id,
        body.newTripId,
        body.newOriginStopId,
        body.newDestinationStopId,
        body.newOriginSeq,
        body.newDestinationSeq,
        performedBy,
        reason
      );

      const trip = await service.closeTrip(id);

      webSocketService.emitToTrip(body.newTripId, 'INVENTORY_UPDATED', { tripId: body.newTripId, seatNo: '*' });

      reply.send({
        ok: true,
        tripId: trip.id,
        status: trip.status,
        reschedule: {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          succeededPassengers: result.succeeded,
          failedPassengers: result.failed,
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({ message: error.message });
      } else {
        reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });
}
