import type { FastifyInstance } from "fastify";
import { VehiclesController } from "./vehicles.controller";
import { IStorage } from "../../storage.interface";
import { requireFlag } from "../rbac/rbac.middleware";

export function registerVehiclesRoutes(app: FastifyInstance, storage: IStorage, cacheHook: any) {
  const controller = new VehiclesController(storage);

  app.get('/api/vehicles', { ...cacheHook }, async (req, reply) => controller.getAll(req, reply));
  app.get('/api/vehicles/:id', { ...cacheHook }, async (req, reply) => controller.getById(req, reply));
  app.post('/api/vehicles', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => controller.create(req, reply));
  app.put('/api/vehicles/:id', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => controller.update(req, reply));
  app.delete('/api/vehicles/:id', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => controller.delete(req, reply));
}
