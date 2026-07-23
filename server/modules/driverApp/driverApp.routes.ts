import type { FastifyInstance } from "fastify";
import { DriverAppController } from "./driverApp.controller";
import { requireFlag } from "@modules/rbac/rbac.middleware";

/**
 * Shared read-only `/api/driver/*` surface consumed by BOTH the terminal
 * "Jadwal Saya" page (web, cookie auth) and the future mobile driver app
 * (Bearer auth). Auth transport is already handled upstream by
 * `requireAuth`/`verifyWithRealmio` — this module only adds the
 * `access.driver_app` flag gate and scopes every query to the caller's
 * own driver record. Do not add write/action endpoints here.
 */
export function registerDriverAppRoutes(app: FastifyInstance) {
  const controller = new DriverAppController();

  app.get('/api/driver/me', { preHandler: [requireFlag('access.driver_app')] }, async (req, reply) => controller.getMe(req, reply));
  app.get('/api/driver/my-schedule', { preHandler: [requireFlag('access.driver_app')] }, async (req, reply) => controller.getMySchedule(req, reply));
}
