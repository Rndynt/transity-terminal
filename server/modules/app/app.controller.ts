import type { FastifyRequest, FastifyReply } from "fastify";
import { AppService } from "./app.service";
import { IStorage } from "../../storage.interface";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const searchSchema = z.object({
  originCity: z.string().min(1),
  destinationCity: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passengers: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const createBookingSchema = z.object({
  tripId: z.string().uuid(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  originSeq: z.number().int().min(1),
  destinationSeq: z.number().int().min(2),
  passengers: z.array(z.object({
    fullName: z.string().min(1),
    phone: z.string().optional(),
    idNumber: z.string().optional(),
    seatNo: z.string().min(1)
  })).min(1),
  paymentMethod: z.enum(['qr', 'ewallet', 'bank'])
});

const createReviewSchema = z.object({
  tripId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

const createCargoSchema = z.object({
  tripId: z.string().uuid(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  cargoTypeId: z.string().uuid().optional(),
  senderName: z.string().min(1),
  senderPhone: z.string().min(1),
  recipientName: z.string().min(1),
  recipientPhone: z.string().min(1),
  itemDescription: z.string().min(1),
  quantity: z.number().int().min(1),
  weightKg: z.number().optional(),
  notes: z.string().optional()
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().optional()
});

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

export class AppController {
  private service: AppService;

  constructor(storage: IStorage) {
    this.service = new AppService(storage);
  }

  async register(req: FastifyRequest, reply: FastifyReply) {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.register(parsed.data.email, parsed.data.password, parsed.data.name, parsed.data.phone);
      reply.code(201).send(result);
    } catch (e: unknown) {
      reply.code(409).send({ error: errMsg(e) });
    }
  }

  async login(req: FastifyRequest, reply: FastifyReply) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.login(parsed.data.email, parsed.data.password);
      reply.send(result);
    } catch (e: unknown) {
      reply.code(401).send({ error: errMsg(e) });
    }
  }

  async getProfile(req: FastifyRequest, reply: FastifyReply) {
    try {
      const user = await this.service.getProfile(req.appUser!.userId);
      reply.send(user);
    } catch (e: unknown) {
      reply.code(404).send({ error: errMsg(e) });
    }
  }

  async updateProfile(req: FastifyRequest, reply: FastifyReply) {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const user = await this.service.updateProfile(req.appUser!.userId, parsed.data);
      reply.send(user);
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }

  async getMe(req: FastifyRequest, reply: FastifyReply) {
    try {
      const user = await this.service.getProfile(req.appUser!.userId);
      reply.send(user);
    } catch (e: unknown) {
      reply.code(404).send({ error: errMsg(e) });
    }
  }

  async getCities(_req: FastifyRequest, reply: FastifyReply) {
    const cities = await this.service.getCities();
    reply.send(cities);
  }

  async getOperators(_req: FastifyRequest, reply: FastifyReply) {
    const operators = await this.service.getOperators();
    reply.send(operators);
  }

  async getOperatorInfo(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const info = await this.service.getOperatorInfo();
      reply.send(info);
    } catch (e: unknown) {
      reply.code(500).send({ error: errMsg(e), code: 'OPERATOR_INFO_ERROR' });
    }
  }

  async searchTrips(req: FastifyRequest, reply: FastifyReply) {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", code: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    const result = await this.service.searchTrips(parsed.data);
    reply.send(result);
  }

  async getTripDetail(req: FastifyRequest, reply: FastifyReply) {
    try {
      const detail = await this.service.getTripDetail(req.params.id);
      reply.send(detail);
    } catch (e: unknown) {
      reply.code(404).send({ error: errMsg(e) });
    }
  }

  async getSeatmap(req: FastifyRequest, reply: FastifyReply) {
    const { originSeq, destinationSeq } = req.query;
    if (!originSeq || !destinationSeq) return reply.code(400).send({ error: "originSeq and destinationSeq required" });
    try {
      const seatmap = await this.service.getSeatmap(req.params.id, Number(originSeq), Number(destinationSeq));
      reply.send(seatmap);
    } catch (e: unknown) {
      reply.code(404).send({ error: errMsg(e) });
    }
  }

  async createBooking(req: FastifyRequest, reply: FastifyReply) {
    const isServiceClient = (req as any).isServiceClient === true;
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    const userId = isServiceClient ? null : (req.appUser?.userId ?? null);
    if (!isServiceClient && !userId) return reply.code(401).send({ error: "Unauthorized" });
    try {
      const result = await this.service.createAppBooking({
        userId,
        ...parsed.data
      });
      reply.code(201).send(result);
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }

  async getMyBookings(req: FastifyRequest, reply: FastifyReply) {
    const bookings = await this.service.getUserBookings(req.appUser!.userId);
    reply.send(bookings);
  }

  async getBookingDetail(req: FastifyRequest, reply: FastifyReply) {
    try {
      const detail = await this.service.getBookingDetail(req.params.id, req.appUser!.userId);
      reply.send(detail);
    } catch (e: unknown) {
      if (errMsg(e) === "Unauthorized") {
        reply.code(403).send({ error: errMsg(e) });
      } else {
        reply.code(404).send({ error: errMsg(e) });
      }
    }
  }

  async getPaymentStatus(req: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.service.getPaymentStatus(req.params.id, req.appUser!.userId);
      reply.send(result);
    } catch (e: unknown) {
      if (errMsg(e) === "Unauthorized") {
        reply.code(403).send({ error: errMsg(e) });
      } else {
        reply.code(400).send({ error: errMsg(e) });
      }
    }
  }

  async paymentWebhook(req: FastifyRequest & { rawBody?: Buffer }, reply: FastifyReply) {
    try {
      const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[paymentWebhook] PAYMENT_WEBHOOK_SECRET not configured");
        reply.code(503).send({ error: "Payment webhook not configured" });
        return;
      }

      const signature = req.headers['x-webhook-signature'] as string | undefined;
      if (!signature) {
        reply.code(401).send({ error: "Missing webhook signature" });
        return;
      }

      const crypto = await import('crypto');
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      const expectedSig = crypto.createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (signature.length !== expectedSig.length ||
          !crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        reply.code(401).send({ error: "Invalid webhook signature" });
        return;
      }

      const { providerRef, status: gatewayStatus } = req.body;
      if (!providerRef || !['success', 'failed'].includes(gatewayStatus)) {
        reply.code(400).send({ error: "Invalid webhook payload: providerRef and status (success|failed) required" });
        return;
      }
      const result = await this.service.processPaymentWebhook(providerRef, gatewayStatus);
      reply.send(result);
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }

  async cancelBooking(req: FastifyRequest, reply: FastifyReply) {
    try {
      await this.service.cancelBooking(req.params.id, req.appUser!.userId);
      reply.send({ success: true });
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }

  async createReview(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const review = await this.service.createReview({
        userId: req.appUser!.userId,
        ...parsed.data
      });
      reply.code(201).send(review);
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }

  async getTripReviews(req: FastifyRequest, reply: FastifyReply) {
    const reviews = await this.service.getTripReviews(req.params.tripId);
    reply.send(reviews);
  }

  async trackCargo(req: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.service.trackCargo(req.params.waybillNumber);
      reply.send(result);
    } catch (e: unknown) {
      reply.code(404).send({ error: errMsg(e) });
    }
  }

  async createCargo(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createCargoSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.createAppCargo({
        userId: req.appUser!.userId,
        ...parsed.data
      });
      reply.code(201).send(result);
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }
}
