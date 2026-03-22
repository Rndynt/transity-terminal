import type { FastifyInstance } from "fastify";
import { OutletsController } from "./outlets.controller";
import { IStorage } from "../../storage.interface";
import { requireFlag } from "../rbac/rbac.middleware";

export function registerOutletsRoutes(app: FastifyInstance, storage: IStorage, cacheHook: any) {
  const controller = new OutletsController(storage);

  app.get('/api/outlets', { ...cacheHook }, async (req, reply) => controller.getAll(req, reply));
  app.get('/api/outlets/:id', { ...cacheHook }, async (req, reply) => controller.getById(req, reply));
  app.post('/api/outlets', { preHandler: [requireFlag('master.outlets')] }, async (req, reply) => controller.create(req, reply));
  app.put('/api/outlets/:id', { preHandler: [requireFlag('master.outlets')] }, async (req, reply) => controller.update(req, reply));
  app.delete('/api/outlets/:id', { preHandler: [requireFlag('master.outlets')] }, async (req, reply) => controller.delete(req, reply));
}
