import type { FastifyInstance } from "fastify";
import { MaintenanceController } from "./maintenance.controller";
import { requireFlag } from "@server/modules/rbac/rbac.middleware";

export function registerMaintenanceRoutes(app: FastifyInstance) {
  const controller = new MaintenanceController();

  app.get('/api/vehicles/:vehicleId/maintenance', async (req, reply) => controller.getByVehicle(req, reply));
  app.get('/api/maintenance/alerts', async (req, reply) => controller.getAlerts(req, reply));
  app.post('/api/vehicles/:vehicleId/maintenance', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => controller.create(req, reply));
  app.patch('/api/maintenance/:id', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => controller.update(req, reply));
  app.delete('/api/maintenance/:id', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => controller.remove(req, reply));
}
