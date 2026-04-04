import type { FastifyInstance } from "fastify";
import { StopsController } from "./stops.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export function registerStopsRoutes(app: FastifyInstance, storage: IStorage, cacheHook: any) {
  const controller = new StopsController(storage);

  app.get('/api/stops', { ...cacheHook }, async (req, reply) => controller.getAll(req, reply));
  app.get('/api/stops/:id', { ...cacheHook }, async (req, reply) => controller.getById(req, reply));
  app.post('/api/stops', { preHandler: [requireFlag('master.stops')] }, async (req, reply) => controller.create(req, reply));
  app.put('/api/stops/:id', { preHandler: [requireFlag('master.stops')] }, async (req, reply) => controller.update(req, reply));
  app.delete('/api/stops/:id', { preHandler: [requireFlag('master.stops')] }, async (req, reply) => controller.delete(req, reply));
  app.get('/api/stops/:id/impact', async (req, reply) => controller.getImpact(req, reply));
}
