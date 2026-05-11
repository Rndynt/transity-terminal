import type { FastifyRequest, FastifyReply } from "fastify";
import { AppService } from "./app.service";
import { IStorage } from "@server/storage.interface";
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
  // Sales channel code OTA partner — opsional; mempengaruhi pemilihan auto-promo
  // (mis. promo yang hanya berlaku utk salesChannelCode tertentu).
  salesChannelCode: z.string().min(1).max(64).optional(),
});

const createBookingSchema = z.object({
  tripId: z.string().min(1),
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
  paymentMethod: z.enum(['qr', 'ewallet', 'bank']).optional(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Identitas sales channel (mis. nama OTA / aggregator). Opsional, hanya
  // dipakai saat request datang dari Service Key (channel OTA).
  salesChannelCode: z.string().min(1).max(64).optional(),
  salesChannelName: z.string().min(1).max(128).optional()
});

const payBookingSchema = z.object({
  paymentMethod: z.enum(['qr', 'ewallet', 'bank']),
  voucherCode: z.string().optional()
});

const validateVoucherSchema = z.object({
  code: z.string().min(1),
  amount: z.number().positive().optional()
});

const createReviewSchema = z.object({
  tripId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

const materializeSchema = z.object({
  baseId: z.string().uuid(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    try {
      const cities = await this.service.getCities();
      // T-CON-02: cities jarang berubah; izinkan caching publik 5 menit
      // (sesuai TTL CITIES di Console gateway aggregator). swr=60 supaya
      // worker bisa serve stale sambil refresh background.
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      reply.send(cities);
    } catch (e: unknown) {
      reply.code(500).send({ error: errMsg(e) });
    }
  }

  async getServiceLines(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const lines = await this.service.getServiceLines();
      // T-CON-02: service-lines metadata stabil, sama TTL dengan cities.
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      reply.send(lines);
    } catch (e: unknown) {
      reply.code(500).send({ error: errMsg(e) });
    }
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
    const isServiceClient = req.isServiceClient === true;
    const channel: 'OTA' | 'APP' = isServiceClient ? 'OTA' : 'APP';
    const result = await this.service.searchTrips({
      ...parsed.data,
      channel,
    });
    if (req.log.level === 'debug' || req.log.level === 'trace') {
      for (const trip of result.data) {
        req.log.debug({ tripId: trip.tripId, pattern: trip.patternCode, stops: trip.stops }, '[searchTrips] trip');
      }
    }
    reply.send(result);
  }

  async getTripDetail(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { serviceDate } = (req.query || {}) as { serviceDate?: string };
      const detail = await this.service.getTripDetail((req.params as { id: string }).id, serviceDate);
      if (req.log.level === 'debug' || req.log.level === 'trace') {
        req.log.debug({ tripId: detail.tripId, pattern: detail.patternCode, stops: detail.stops }, '[getTripDetail] trip');
      }
      reply.send(detail);
    } catch (e: unknown) {
      const msg = errMsg(e);
      if (msg.includes('serviceDate')) {
        reply.code(400).send({ error: msg });
      } else {
        reply.code(404).send({ error: msg });
      }
    }
  }

  async materializeTrip(req: FastifyRequest, reply: FastifyReply) {
    const parsed = materializeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const tripId = await this.service.materializeTrip(parsed.data.baseId, parsed.data.serviceDate);
      reply.send({ tripId });
    } catch (e: unknown) {
      const msg = errMsg(e);
      if (msg === 'base-not-eligible') {
        reply.code(422).send({ error: "Trip base is not eligible for this date" });
      } else if (msg.includes('not found')) {
        reply.code(404).send({ error: msg });
      } else {
        reply.code(500).send({ error: msg });
      }
    }
  }

  async getSeatmap(req: FastifyRequest, reply: FastifyReply) {
    const { originSeq, destinationSeq } = req.query as { originSeq?: string; destinationSeq?: string };
    if (!originSeq || !destinationSeq) return reply.code(400).send({ error: "originSeq and destinationSeq required" });
    try {
      const seatmap = await this.service.getSeatmap((req.params as { id: string }).id, Number(originSeq), Number(destinationSeq));
      reply.send(seatmap);
    } catch (e: unknown) {
      reply.code(404).send({ error: errMsg(e) });
    }
  }

  async createBooking(req: FastifyRequest, reply: FastifyReply) {
    const isServiceClient = req.isServiceClient === true;
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    const userId = isServiceClient ? null : (req.appUser?.userId ?? null);
    if (!isServiceClient && !userId) return reply.code(401).send({ error: "Unauthorized" });
    // Service client (Console) selalu OTA channel
    const channel = isServiceClient ? 'OTA' : 'APP';
    try {
      const result = await this.service.createAppBooking({
        userId,
        channel,
        ...parsed.data
      });
      reply.code(201).send(result);
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }

  async confirmOtaPaid(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const { providerRef } = (req.body ?? {}) as { providerRef?: string };
    // Terminal sengaja tidak peduli paymentMethod dari Console — yang me-manage
    // pilihan metode pembayaran (qris/va/ewallet/dst) adalah Console. Terminal
    // hanya butuh tahu booking ini lunas dari kanal OTA dan mencatat method 'online'.
    try {
      const result = await this.service.confirmOtaPayment(id, providerRef ?? '');
      reply.send(result);
    } catch (e: unknown) {
      const msg = errMsg(e);
      if (msg === 'Booking not found') {
        reply.code(404).send({ error: msg });
      } else if (msg.includes('already') || msg.includes('confirmed')) {
        // Idempotent — anggap sukses
        reply.send({ status: 'confirmed', bookingId: id });
      } else {
        reply.code(400).send({ error: msg });
      }
    }
  }

  async findOtaBooking(req: FastifyRequest, reply: FastifyReply) {
    const { tripId, seats } = req.query as { tripId?: string; seats?: string };
    if (!tripId || !seats) {
      return reply.code(400).send({ error: 'tripId and seats query parameters are required' });
    }
    const seatList = seats.split(',').map(s => s.trim()).filter(Boolean);
    if (seatList.length === 0) {
      return reply.code(400).send({ error: 'At least one seat number is required' });
    }
    try {
      const booking = await this.service.findOtaBookingByCriteria(tripId, seatList);
      if (!booking) return reply.code(404).send({ error: 'No matching OTA booking found' });
      reply.send(booking);
    } catch (e: unknown) {
      reply.code(500).send({ error: errMsg(e) });
    }
  }

  async getMyBookings(req: FastifyRequest, reply: FastifyReply) {
    const bookings = await this.service.getUserBookings(req.appUser!.userId);
    reply.send(bookings);
  }

  async getBookingDetail(req: FastifyRequest, reply: FastifyReply) {
    const isServiceClient = req.isServiceClient === true;
    const userId = isServiceClient ? undefined : (req.appUser?.userId ?? undefined);
    try {
      const detail = await this.service.getBookingDetail((req.params as { id: string }).id, userId);
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
    const isServiceClient = req.isServiceClient === true;
    const userId = isServiceClient ? undefined : (req.appUser?.userId ?? undefined);
    try {
      const result = await this.service.getPaymentStatus((req.params as { id: string }).id, userId!);
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
        req.log.error("[paymentWebhook] PAYMENT_WEBHOOK_SECRET not configured");
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

      const { providerRef, status: gatewayStatus } = (req.body ?? {}) as { providerRef?: string; status?: 'success' | 'failed' };
      if (!providerRef || !gatewayStatus || !['success', 'failed'].includes(gatewayStatus)) {
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
    const isServiceClient = req.isServiceClient === true;
    const userId = isServiceClient ? null : (req.appUser?.userId ?? null);
    try {
      await this.service.cancelBooking((req.params as { id: string }).id, userId);
      reply.send({ status: 'cancelled' });
    } catch (e: unknown) {
      const msg = errMsg(e);
      if (msg === "Booking not found") {
        reply.code(404).send({ error: msg });
      } else if (msg === "Unauthorized") {
        reply.code(403).send({ error: msg });
      } else {
        reply.code(400).send({ error: msg });
      }
    }
  }

  async payBooking(req: FastifyRequest, reply: FastifyReply) {
    const parsed = payBookingSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    const isServiceClient = req.isServiceClient === true;
    const userId = isServiceClient ? null : (req.appUser?.userId ?? null);
    try {
      const result = await this.service.payBooking((req.params as { id: string }).id, parsed.data.paymentMethod, parsed.data.voucherCode, userId);
      reply.send(result);
    } catch (e: unknown) {
      const msg = errMsg(e);
      if (msg === "Booking not found") {
        reply.code(404).send({ error: msg });
      } else if (msg === "Unauthorized") {
        reply.code(403).send({ error: msg });
      } else {
        reply.code(400).send({ error: msg });
      }
    }
  }

  async getPaymentMethods(_req: FastifyRequest, reply: FastifyReply) {
    const methods = this.service.getPaymentMethods();
    reply.send(methods);
  }

  async validateVoucher(req: FastifyRequest, reply: FastifyReply) {
    const parsed = validateVoucherSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.validateVoucher(parsed.data.code, parsed.data.amount);
      reply.send(result);
    } catch (e: unknown) {
      reply.code(400).send({ error: errMsg(e) });
    }
  }

  async listBookings(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as Record<string, string>;
    try {
      const result = await this.service.listBookings({
        status: query.status,
        date: query.date,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
      reply.send(result);
    } catch (e: unknown) {
      reply.code(500).send({ error: errMsg(e) });
    }
  }

  // T-CON-03: batch fetch by IDs untuk Console reconciler.
  // Format: GET /api/app/bookings?ids=uuid1,uuid2,...  (max 50).
  async batchBookings(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { ids?: string };
    const raw = (query.ids ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (raw.length === 0) {
      return reply.code(400).send({ error: 'ids query parameter is required' });
    }
    if (raw.length > 50) {
      return reply.code(400).send({ error: 'Maximum 50 IDs per batch request' });
    }
    // Dedupe — Console kadang kirim duplikat tidak sengaja.
    const ids = Array.from(new Set(raw));
    try {
      const result = await this.service.getBookingsByIds(ids);
      reply.send(result);
    } catch (e: unknown) {
      reply.code(500).send({ error: errMsg(e) });
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
    const reviews = await this.service.getTripReviews((req.params as { tripId: string }).tripId);
    reply.send(reviews);
  }

  async trackCargo(req: FastifyRequest, reply: FastifyReply) {
    try {
      const waybillNumber = (req.params as { waybillNumber: string }).waybillNumber;
      // S1-06: secret bisa dikirim via query (?secret=) atau header X-Tracking-Secret.
      const q = (req.query as { secret?: string; s?: string } | undefined) || {};
      const headerSecret = (req.headers['x-tracking-secret'] as string | undefined) || undefined;
      const secret: string | undefined = q.secret || q.s || headerSecret;
      const result = await this.service.trackCargo(waybillNumber, secret);
      reply.send(result);
    } catch (e: unknown) {
      const msg = errMsg(e);
      // 401 untuk secret salah, 404 untuk waybill tidak ada.
      if (msg.includes('Tracking secret')) return reply.code(401).send({ error: msg });
      reply.code(404).send({ error: msg });
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
