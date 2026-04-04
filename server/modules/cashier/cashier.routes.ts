import type { FastifyInstance } from "fastify";
import { CashierController } from "./cashier.controller";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export function registerCashierRoutes(app: FastifyInstance) {
  const controller = new CashierController();

  app.get('/api/cashier/active', { preHandler: [requireFlag('page.cashier')] }, async (req, reply) => controller.getActive(req, reply));
  app.get('/api/cashier/active/summary', { preHandler: [requireFlag('page.cashier')] }, async (req, reply) => controller.getActiveSummary(req, reply));
  app.post('/api/cashier/open', { preHandler: [requireFlag('page.cashier')] }, async (req, reply) => controller.open(req, reply));
  app.post('/api/cashier/close', { preHandler: [requireFlag('page.cashier')] }, async (req, reply) => controller.close(req, reply));
  app.patch('/api/cashier/:id/approve', { preHandler: [requireFlag('page.cashier')] }, async (req, reply) => controller.approve(req, reply));
  app.get('/api/cashier/history', { preHandler: [requireFlag('page.cashier')] }, async (req, reply) => controller.getHistory(req, reply));
  app.get('/api/cashier/:id/detail', { preHandler: [requireFlag('page.cashier')] }, async (req, reply) => controller.getDetail(req, reply));
}
