import type { FastifyInstance } from "fastify";
import { SpjController } from "./spj.controller";
import { requireFlag } from "../rbac/rbac.middleware";

export function registerSpjRoutes(app: FastifyInstance) {
  const spjController = new SpjController();

  app.get('/api/spj', async (req, reply) => spjController.getAll(req, reply));
  app.get('/api/spj/:id', async (req, reply) => spjController.getById(req, reply));
  app.get('/api/spj/trip/:tripId', async (req, reply) => spjController.getByTripId(req, reply));
  app.post('/api/spj', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.create(req, reply));
  app.patch('/api/spj/:id/issue', { preHandler: [requireFlag('action.spj.issue')] }, async (req, reply) => spjController.issue(req, reply));
  app.patch('/api/spj/:id/settle', { preHandler: [requireFlag('action.spj.settle')] }, async (req, reply) => spjController.settle(req, reply));
  app.patch('/api/spj/:id/notes', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.updateNotes(req, reply));
  app.delete('/api/spj/:id', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.delete(req, reply));
  app.post('/api/spj/:spjId/cost-lines', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.addCostLine(req, reply));
  app.patch('/api/spj/cost-lines/:id', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.updateCostLine(req, reply));
  app.delete('/api/spj/cost-lines/:id', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.deleteCostLine(req, reply));
  app.get('/api/spj/trip/:tripId/profit', async (req, reply) => spjController.getTripProfit(req, reply));
}
