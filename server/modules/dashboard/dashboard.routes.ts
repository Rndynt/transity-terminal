import type { FastifyInstance } from "fastify";
import { DashboardController } from "./dashboard.controller";
import { requireFlag } from "@server/modules/rbac/rbac.middleware";

export function registerDashboardRoutes(app: FastifyInstance) {
  const controller = new DashboardController();

  app.get('/api/dashboard/today', { preHandler: [requireFlag('page.dashboard')] }, async (req, reply) => controller.getTodaySummary(req, reply));
}
