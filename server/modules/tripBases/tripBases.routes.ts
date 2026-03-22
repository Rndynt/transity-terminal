import type { FastifyInstance } from "fastify";
import { TripBasesController } from "./tripBases.controller";
import { TripBasesService } from "./tripBases.service";
import { IStorage } from "../../storage.interface";
import { requireFlag } from "../rbac/rbac.middleware";

export function registerTripBasesRoutes(app: FastifyInstance, storage: IStorage) {
  const service = new TripBasesService(storage);
  const controller = new TripBasesController(service);

  app.get('/api/trip-bases', async (req, reply) => controller.getAllTripBases(req, reply));
  app.get('/api/trip-bases/:id', async (req, reply) => controller.getTripBaseById(req, reply));
  app.post('/api/trip-bases', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => controller.createTripBase(req, reply));
  app.put('/api/trip-bases/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => controller.updateTripBase(req, reply));
  app.delete('/api/trip-bases/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => controller.deleteTripBase(req, reply));

  app.post('/api/cso/materialize-trip', { preHandler: [requireFlag('action.trip.materialize')] }, async (req, reply) => controller.materializeTrip(req, reply));
  app.post('/api/trips/:id/close', { preHandler: [requireFlag('action.trip.close')] }, async (req, reply) => controller.closeTrip(req, reply));
}
