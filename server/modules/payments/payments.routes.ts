import type { FastifyInstance } from "fastify";
import { PaymentsController } from "./payments.controller";
import { IStorage } from "../../storage.interface";
import { requireFlag } from "../rbac/rbac.middleware";

export function registerPaymentsRoutes(app: FastifyInstance, storage: IStorage) {
  const paymentsController = new PaymentsController(storage);

  app.get('/api/bookings/:bookingId/payments', async (req, reply) => paymentsController.getByBooking(req, reply));
  app.post('/api/payments', { preHandler: [requireFlag('action.payment.create')] }, async (req, reply) => paymentsController.create(req, reply));
}
