import type { FastifyInstance } from "fastify";
import { RefundsController } from "./refunds.controller";
import { requireFlag } from "@server/modules/rbac/rbac.middleware";

export function registerRefundsRoutes(app: FastifyInstance) {
  const controller = new RefundsController();

  app.get('/api/refunds', { preHandler: [requireFlag('page.refunds')] }, async (req, reply) => controller.getAll(req, reply));
  app.get('/api/refunds/:id', { preHandler: [requireFlag('page.refunds')] }, async (req, reply) => controller.getById(req, reply));
  app.post('/api/refunds', { preHandler: [requireFlag('action.refund.create')] }, async (req, reply) => controller.create(req, reply));
  app.patch('/api/refunds/:id/approve', { preHandler: [requireFlag('action.refund.approve')] }, async (req, reply) => controller.approve(req, reply));
  app.patch('/api/refunds/:id/process', { preHandler: [requireFlag('action.refund.process')] }, async (req, reply) => controller.process(req, reply));
  app.patch('/api/refunds/:id/reject', { preHandler: [requireFlag('action.refund.approve')] }, async (req, reply) => controller.reject(req, reply));
}
