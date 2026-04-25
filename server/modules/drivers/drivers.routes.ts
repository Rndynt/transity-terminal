import type { FastifyInstance, RouteShorthandOptions } from "fastify";
import { DriversController } from "./drivers.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export function registerDriversRoutes(app: FastifyInstance, storage: IStorage, cacheHook: RouteShorthandOptions) {
  const controller = new DriversController(storage);

  app.get('/api/drivers', { ...cacheHook }, async (req, reply) => controller.getAll(req, reply));
  app.get('/api/drivers/:id', { ...cacheHook }, async (req, reply) => controller.getById(req, reply));
  app.post('/api/drivers', { preHandler: [requireFlag('master.drivers')] }, async (req, reply) => controller.create(req, reply));
  app.put('/api/drivers/:id', { preHandler: [requireFlag('master.drivers')] }, async (req, reply) => controller.update(req, reply));
  app.delete('/api/drivers/:id', { preHandler: [requireFlag('master.drivers')] }, async (req, reply) => controller.delete(req, reply));
}
