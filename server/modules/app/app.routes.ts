import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AppController } from "./app.controller";
import { IStorage } from "@server/storage.interface";
import { appAuthMiddleware } from "./app.auth";

const getTerminalServiceKey = () => process.env.TERMINAL_SERVICE_KEY || '';

// S1-08: CORS sekarang ditangani sentral di server/index.ts via @fastify/cors.
// Route-level header injection di sini DIHAPUS supaya tidak konflik /
// menumpuk header ganda dengan global CORS handler.

function serviceKeyMiddleware(req: FastifyRequest, reply: FastifyReply, done: () => void) {
  const incomingKey = req.headers['x-service-key'] as string | undefined;
  if (!incomingKey) {
    if (getTerminalServiceKey()) {
      reply.code(401).send({ error: 'Missing X-Service-Key header', code: 'MISSING_SERVICE_KEY' });
      return;
    }
    (req as any).isServiceClient = true;
    done();
    return;
  }
  if (!getTerminalServiceKey()) {
    reply.code(401).send({ error: 'Service key not configured on this terminal', code: 'SERVICE_KEY_NOT_CONFIGURED' });
    return;
  }
  if (incomingKey !== getTerminalServiceKey()) {
    reply.code(401).send({ error: 'Invalid service key', code: 'INVALID_SERVICE_KEY' });
    return;
  }
  (req as any).isServiceClient = true;
  done();
}

export function registerAppRoutes(app: FastifyInstance, storage: IStorage) {
  // CORS preflight + headers di-handle global oleh @fastify/cors (lihat
  // server/index.ts). Tidak ada lagi route-level injection di sini.

  const appController = new AppController(storage);

  app.post('/api/app/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => appController.register(req, reply));
  app.post('/api/app/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => appController.login(req, reply));
  app.get('/api/app/auth/me', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getMe(req, reply));

  app.get('/api/app/profile', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getProfile(req, reply));
  app.patch('/api/app/profile', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.updateProfile(req, reply));

  app.get('/api/app/operator-info', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.getOperatorInfo(req, reply));
  app.get('/api/app/cities', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.getCities(req, reply));
  app.get('/api/app/service-lines', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.getServiceLines(req, reply));
  app.get('/api/app/trips/search', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.searchTrips(req, reply));
  app.get('/api/app/trips/:id', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.getTripDetail(req, reply));
  app.get('/api/app/trips/:id/seatmap', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.getSeatmap(req, reply));
  app.post('/api/app/trips/materialize', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.materializeTrip(req, reply));
  app.get('/api/app/trips/:tripId/reviews', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.getTripReviews(req, reply));

  async function bookingAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
    const incomingKey = req.headers['x-service-key'] as string | undefined;
    if (incomingKey) {
      if (!getTerminalServiceKey()) {
        return reply.code(401).send({ error: 'Service key not configured on this terminal', code: 'SERVICE_KEY_NOT_CONFIGURED' });
      }
      if (incomingKey !== getTerminalServiceKey()) {
        return reply.code(401).send({ error: 'Invalid service key', code: 'INVALID_SERVICE_KEY' });
      }
      (req as any).isServiceClient = true;
    } else {
      await appAuthMiddleware(req, reply);
    }
  }

  app.get('/api/app/bookings/find-ota', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.findOtaBooking(req, reply));
  app.post('/api/app/bookings', { preHandler: [bookingAuthMiddleware] }, async (req, reply) => appController.createBooking(req, reply));
  app.get('/api/app/bookings', { preHandler: [bookingAuthMiddleware] }, async (req, reply) => {
    const isServiceClient = (req as any).isServiceClient === true;
    if (isServiceClient) {
      return appController.listBookings(req, reply);
    }
    return appController.getMyBookings(req, reply);
  });
  app.get('/api/app/bookings/:id', { preHandler: [bookingAuthMiddleware] }, async (req, reply) => appController.getBookingDetail(req, reply));
  app.get('/api/app/bookings/:id/payment-status', { preHandler: [bookingAuthMiddleware] }, async (req, reply) => appController.getPaymentStatus(req, reply));
  app.post('/api/app/bookings/:id/pay', { preHandler: [bookingAuthMiddleware] }, async (req, reply) => appController.payBooking(req, reply));
  app.post('/api/app/bookings/:id/cancel', { preHandler: [bookingAuthMiddleware] }, async (req, reply) => appController.cancelBooking(req, reply));
  // Endpoint khusus untuk Console mengkonfirmasi pembayaran OTA — hanya service client
  app.post('/api/app/bookings/:id/confirm-paid', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.confirmOtaPaid(req, reply));

  app.get('/api/app/payments/methods', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.getPaymentMethods(req, reply));
  app.post('/api/app/payments/webhook', async (req, reply) => appController.paymentWebhook(req, reply));

  app.post('/api/app/vouchers/validate', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.validateVoucher(req, reply));

  app.post('/api/app/reviews', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createReview(req, reply));

  app.get('/api/app/cargo/track/:waybillNumber', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.trackCargo(req, reply));
  app.get('/api/app/cargo/:waybillNumber', { preHandler: [serviceKeyMiddleware] }, async (req, reply) => appController.trackCargo(req, reply));
  app.post('/api/app/cargo', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createCargo(req, reply));
}
