import type { FastifyInstance } from "fastify";
import { CustomersController } from "./customers.controller";
import { requireFlag } from "@server/modules/rbac/rbac.middleware";

export function registerCustomersRoutes(app: FastifyInstance) {
  const controller = new CustomersController();

  app.get('/api/customers', { preHandler: [requireFlag('page.customers')] }, async (req, reply) => controller.getAll(req, reply));
  app.get('/api/customers/search', { preHandler: [requireFlag('page.customers')] }, async (req, reply) => controller.search(req, reply));
  app.get('/api/customers/:id', { preHandler: [requireFlag('page.customers')] }, async (req, reply) => controller.getById(req, reply));
  app.post('/api/customers', { preHandler: [requireFlag('page.customers')] }, async (req, reply) => controller.create(req, reply));
  app.patch('/api/customers/:id', { preHandler: [requireFlag('page.customers')] }, async (req, reply) => controller.update(req, reply));
  app.get('/api/drivers/:id/performance', async (req, reply) => controller.getDriverPerformance(req, reply));
}
