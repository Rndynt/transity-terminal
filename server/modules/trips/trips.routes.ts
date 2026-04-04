import type { FastifyInstance } from "fastify";
import { TripsController } from "./trips.controller";
import { TripStopTimesController } from "../tripStopTimes/tripStopTimes.controller";
import { TripLegsController } from "../tripLegs/tripLegs.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag, requireOutletScope } from "../rbac/rbac.middleware";

export function registerTripsRoutes(app: FastifyInstance, storage: IStorage) {
  const tripsController = new TripsController(storage);
  const tripStopTimesController = new TripStopTimesController(storage);
  const tripLegsController = new TripLegsController(storage);

  app.get('/api/trips', { preHandler: [requireOutletScope()] }, async (req, reply) => tripsController.getAll(req, reply));
  app.get('/api/cso/available-trips', { preHandler: [requireOutletScope()] }, async (req, reply) => tripsController.getCsoAvailableTrips(req, reply));
  app.get('/api/trips/:id', async (req, reply) => tripsController.getById(req, reply));
  app.post('/api/trips', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripsController.create(req, reply));
  app.put('/api/trips/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripsController.update(req, reply));
  app.delete('/api/trips/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripsController.delete(req, reply));

  app.get('/api/trips/:tripId/stop-times', async (req, reply) => tripStopTimesController.getByTrip(req, reply));
  app.get('/api/trips/:tripId/stop-times/effective', async (req, reply) => tripStopTimesController.getByTripWithEffectiveFlags(req, reply));
  app.post('/api/trips/:tripId/stop-times/bulk-upsert', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripStopTimesController.bulkUpsert(req, reply));
  app.post('/api/trips/:tripId/stop-times/sync-from-pattern', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripStopTimesController.syncFromPattern(req, reply));
  app.post('/api/trips/:tripId/derive-legs', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripStopTimesController.deriveLegs(req, reply));
  app.post('/api/trips/:tripId/precompute-seat-inventory', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripStopTimesController.precomputeSeatInventory(req, reply));
  app.post('/api/trip-stop-times', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripStopTimesController.create(req, reply));
  app.put('/api/trip-stop-times/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripStopTimesController.update(req, reply));
  app.delete('/api/trip-stop-times/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripStopTimesController.delete(req, reply));

  app.get('/api/trips/:id/seatmap', async (req, reply) => tripsController.getSeatmap(req, reply));
  app.get('/api/trips/:tripId/seats/:seatNo/passenger-details', { preHandler: [requireFlag('page.cso')] }, async (req, reply) => tripsController.getSeatPassengerDetails(req, reply));

  app.get('/api/trips/:id/unseated-passengers', { preHandler: [requireFlag('page.cso')] }, async (req, reply) => {
    const passengers = await storage.getUnseatedPassengers((req.params as any).id);
    reply.send(passengers);
  });

  app.get('/api/trips/:id/manifest', { preHandler: [requireFlag('page.manifest')] }, async (req, reply) => {
    const manifest = await storage.getManifestFull((req.params as any).id);
    reply.send(manifest);
  });

  app.post('/api/trips/:id/manifest/print', { preHandler: [requireFlag('page.manifest')] }, async (req, reply) => {
    const firstPrintedAt = await storage.recordManifestPrint((req.params as any).id);
    reply.send({ success: true, firstPrintedAt });
  });
}
