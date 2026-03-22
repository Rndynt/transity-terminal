import type { FastifyInstance } from "fastify";
import { AppController } from "./app.controller";
import { IStorage } from "../../storage.interface";
import { appAuthMiddleware, optionalAuthMiddleware } from "./app.auth";

export function registerAppRoutes(app: FastifyInstance, storage: IStorage) {
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/app/')) return;
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  app.options('/api/app/*', async (_req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.code(204).send();
  });

  const appController = new AppController(storage);

  app.post('/api/app/auth/register', async (req, reply) => appController.register(req, reply));
  app.post('/api/app/auth/login', async (req, reply) => appController.login(req, reply));
  app.get('/api/app/auth/me', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getMe(req, reply));

  app.get('/api/app/profile', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getProfile(req, reply));
  app.patch('/api/app/profile', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.updateProfile(req, reply));

  app.get('/api/app/cities', async (req, reply) => appController.getCities(req, reply));
  app.get('/api/app/operators', async (req, reply) => appController.getOperators(req, reply));
  app.get('/api/app/trips/search', async (req, reply) => appController.searchTrips(req, reply));
  app.get('/api/app/trips/:id', async (req, reply) => appController.getTripDetail(req, reply));
  app.get('/api/app/trips/:id/seatmap', async (req, reply) => appController.getSeatmap(req, reply));
  app.get('/api/app/trips/:tripId/reviews', async (req, reply) => appController.getTripReviews(req, reply));

  app.post('/api/app/bookings', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createBooking(req, reply));
  app.get('/api/app/bookings', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getMyBookings(req, reply));
  app.get('/api/app/bookings/:id', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getBookingDetail(req, reply));
  app.get('/api/app/bookings/:id/payment-status', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getPaymentStatus(req, reply));
  app.post('/api/app/bookings/:id/cancel', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.cancelBooking(req, reply));

  app.post('/api/app/payments/webhook', async (req, reply) => appController.paymentWebhook(req, reply));

  app.post('/api/app/reviews', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createReview(req, reply));

  app.get('/api/app/cargo/track/:waybillNumber', async (req, reply) => appController.trackCargo(req, reply));
  app.get('/api/app/cargo/:waybillNumber', async (req, reply) => appController.trackCargo(req, reply));
  app.post('/api/app/cargo', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createCargo(req, reply));
}
