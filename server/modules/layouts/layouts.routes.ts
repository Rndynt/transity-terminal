import type { FastifyInstance } from "fastify";
import { LayoutsController } from "./layouts.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export function registerLayoutsRoutes(app: FastifyInstance, storage: IStorage, cacheHook: any) {
  const controller = new LayoutsController(storage);

  app.get('/api/layouts', { ...cacheHook }, async (req, reply) => controller.getAll(req, reply));
  app.get('/api/layouts/:id', { ...cacheHook }, async (req, reply) => controller.getById(req, reply));
  app.post('/api/layouts', { preHandler: [requireFlag('master.layouts')] }, async (req, reply) => controller.create(req, reply));
  app.put('/api/layouts/:id', { preHandler: [requireFlag('master.layouts')] }, async (req, reply) => controller.update(req, reply));
  app.delete('/api/layouts/:id', { preHandler: [requireFlag('master.layouts')] }, async (req, reply) => controller.delete(req, reply));
}
