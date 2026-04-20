import type { FastifyRequest, FastifyReply } from "fastify";
import { BookingsService } from "./bookings.service";
import { UnseatService } from "./unseat.service";
import { RescheduleService } from "./reschedule.service";
import { IStorage } from "@server/storage.interface";
import { insertBookingSchema, insertPassengerSchema, insertPaymentSchema } from "@shared/schema";
import { z } from "zod";

const createBookingSchema = z.object({
  tripId: z.string().uuid(),
  outletId: z.string().uuid().optional(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  originSeq: z.number(),
  destinationSeq: z.number(),
  totalAmount: z.number().positive(),
  channel: z.enum(['CSO', 'WEB', 'APP', 'OTA']).default('CSO'),
  currency: z.string().default('IDR'),
  createdBy: z.string().optional(),
  promoCode: z.string().optional(),
  passengers: z.array(z.object({
    fullName: z.string(),
    phone: z.string().optional(),
    idNumber: z.string().optional(),
    seatNo: z.string()
  })),
  payment: z.object({
    method: z.enum(['cash', 'qr', 'ewallet', 'bank']),
    amount: z.number()
  })
});

const createHoldSchema = z.object({
  tripId: z.string().uuid(),
  seatNo: z.string(),
  originSeq: z.number(),
  destinationSeq: z.number(),
  ttlSeconds: z.number().default(300)
});

const createPendingBookingSchema = z.object({
  tripId: z.string().uuid(),
  outletId: z.string().uuid().optional(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  originSeq: z.number(),
  destinationSeq: z.number(),
  totalAmount: z.number().positive(),
  channel: z.enum(['CSO', 'WEB', 'APP', 'OTA']).default('CSO'),
  currency: z.string().default('IDR'),
  createdBy: z.string().optional(),
  passengers: z.array(z.object({
    fullName: z.string(),
    phone: z.string().optional(),
    idNumber: z.string().optional(),
    seatNo: z.string()
  }))
});

const unseatPassengerSchema = z.object({
  reason: z.string().min(1, 'Alasan unseat wajib diisi')
});

const reschedulePassengerSchema = z.object({
  newTripId: z.string().uuid(),
  newSeatNo: z.string(),
  newOriginStopId: z.string().uuid(),
  newDestinationStopId: z.string().uuid(),
  newOriginSeq: z.number(),
  newDestinationSeq: z.number(),
  reason: z.string().min(1, 'Alasan reschedule wajib diisi')
});

const cancelTicketSchema = z.object({
  reason: z.string().min(1, 'Alasan pembatalan wajib diisi')
});

export class BookingsController {
  private bookingsService: BookingsService;
  private unseatService: UnseatService;
  private rescheduleService: RescheduleService;

  constructor(storage: IStorage) {
    this.bookingsService = new BookingsService(storage);
    this.unseatService = new UnseatService(storage);
    this.rescheduleService = new RescheduleService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { tripId?: string; page?: string; pageSize?: string };
    const tripId = typeof query.tripId === 'string' ? query.tripId : undefined;
    const outletId = req.scopedOutletId ?? req.rbac?.outletId ?? null;
    const pageParam = query.page;
    if (pageParam) {
      const page = Math.max(1, parseInt(pageParam) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '') || 50));
      const { data, total } = await this.bookingsService.getBookingsPaginated({
        tripId,
        outletId: outletId || undefined,
        page,
        pageSize
      });
      return reply.send({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    }
    let bookings = await this.bookingsService.getAllBookings(tripId);
    if (outletId) {
      bookings = bookings.filter((b) => b.outletId === outletId);
    }
    reply.send(bookings);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const booking = await this.bookingsService.getBookingById(id);
    reply.send(booking);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      // Validate request data with enhanced validation
      const validatedData = createBookingSchema.parse(req.body);
      const { passengers, payment, promoCode, ...bookingData } = validatedData;
      
      // Enhanced validation
      if (validatedData.totalAmount <= 0) {
        return reply.code(400).send({ 
          error: 'Invalid total amount',
          code: 'INVALID_TOTAL',
          details: 'Total amount must be greater than 0'
        });
      }
      
      if (!passengers || passengers.length === 0) {
        return reply.code(400).send({
          error: 'No passengers provided',
          code: 'NO_PASSENGERS',
          details: 'At least one passenger is required'
        });
      }
      
      if (payment.amount <= 0) {
        return reply.code(400).send({
          error: 'Invalid payment amount',
          code: 'INVALID_PAYMENT',
          details: 'Payment amount must be greater than 0'
        });
      }

      if (Math.abs(payment.amount - validatedData.totalAmount) > 0.01) {
        return reply.code(400).send({
          error: 'Payment amount mismatch',
          code: 'PAYMENT_AMOUNT_MISMATCH',
          details: `Payment amount ${payment.amount} does not match booking total ${validatedData.totalAmount}`
        });
      }
      
      // Validate seat ownership - this will be checked in the service
      // Convert totalAmount to string for database storage
      const staffOutletId = req.rbac?.outletId ?? null;
      const bookingDataWithStringAmount = {
        ...bookingData,
        outletId: staffOutletId ?? bookingData.outletId ?? undefined,
        totalAmount: bookingData.totalAmount.toString(),
        createdBy: req.user?.id ?? 'system'
      };

      const result = await this.bookingsService.createBooking(
        bookingDataWithStringAmount,
        passengers,
        payment,
        idempotencyKey,
        promoCode
      );
      
      reply.code(201).send(result);
    } catch (error: any) {
      req.log.error({ err: error }, 'Booking creation error');
      
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      
      if (error.message.includes('not held') || error.message.includes('expired')) {
        return reply.code(400).send({
          error: 'Seat hold validation failed',
          code: 'SEAT_NOT_HELD',
          details: error.message
        });
      }
      
      if (error.message.includes('already booked')) {
        return reply.code(409).send({
          error: 'Seat already booked',
          code: 'SEAT_CONFLICT',
          details: error.message
        });
      }

      if (error.message.includes('promo') || error.message.includes('Promo') || error.message.includes('voucher') || error.message.includes('Voucher') || error.message.includes('Kode promo') || error.message.includes('Kuota') || error.message.includes('Minimum')) {
        return reply.code(400).send({
          error: 'Promo validation failed',
          code: 'PROMO_INVALID',
          details: error.message
        });
      }
      
      // Generic server error
      reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: 'An unexpected error occurred during booking creation'
      });
    }
  }

  async createHold(req: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = createHoldSchema.parse(req.body);
      const operatorId = req.user?.id ?? 'system';
      
      const result = await this.bookingsService.createHold(
        validatedData.tripId,
        validatedData.seatNo,
        validatedData.originSeq,
        validatedData.destinationSeq,
        validatedData.ttlSeconds,
        operatorId
      );
      
      if (result.ok) {
        reply.code(201).send(result);
      } else if (result.reason === 'already-held-by-you') {
        // Idempotent behavior: return success if already held by same operator
        reply.code(200).send({
          ok: true,
          holdRef: null, // No new hold created, but request is successful
          message: 'Seat already held by you',
          ownedByYou: true
        });
      } else if (result.reason === 'INCOMPLETE_INVENTORY') {
        reply.code(422).send({
          error: 'Inventori kursi belum diinisialisasi',
          code: 'INCOMPLETE_INVENTORY',
          details: 'Jalankan Precompute Seat Inventory di halaman Trip terlebih dahulu'
        });
      } else if (result.reason === 'TRANSACTION_ERROR') {
        reply.code(500).send({
          error: 'Terjadi kesalahan sistem saat memegang kursi',
          code: 'TRANSACTION_ERROR',
          details: result.reason
        });
      } else {
        reply.code(409).send({
          error: 'Kursi sedang dipegang oleh agen lain',
          code: 'HELD_BY_OTHER',
          details: result.reason
        });
      }
    } catch (error: any) {
      req.log.error({ err: error }, 'Hold creation error');
      reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  async releaseHold(req: FastifyRequest, reply: FastifyReply) {
    const { holdRef } = req.params as { holdRef: string };
    const operatorId = req.user?.id ?? 'system';

    const holdCheck = await this.bookingsService.isHoldOwner(holdRef, operatorId);
    if (!holdCheck.exists) {
      return reply.code(404).send({
        error: 'Not found',
        code: 'HOLD_NOT_FOUND',
        details: 'Hold not found or already expired'
      });
    }
    if (!holdCheck.owned) {
      return reply.code(403).send({
        error: 'Forbidden',
        code: 'NOT_HOLD_OWNER',
        details: 'You can only release holds that belong to you'
      });
    }

    await this.bookingsService.releaseHold(holdRef);
    reply.code(204).send();
  }

  async createPendingBooking(req: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = createPendingBookingSchema.parse(req.body);
      const { passengers, ...bookingData } = validatedData;
      const operatorId = req.user?.id ?? 'system';
      
      // Enhanced validation
      if (validatedData.totalAmount <= 0) {
        return reply.code(400).send({ 
          error: 'Invalid total amount',
          code: 'INVALID_TOTAL',
          details: 'Total amount must be greater than 0'
        });
      }
      
      if (!passengers || passengers.length === 0) {
        return reply.code(400).send({
          error: 'No passengers provided',
          code: 'NO_PASSENGERS',
          details: 'At least one passenger is required'
        });
      }
      
      const staffOutletIdPending = req.rbac?.outletId ?? null;
      const bookingDataWithStringAmount = {
        ...bookingData,
        outletId: staffOutletIdPending ?? bookingData.outletId ?? undefined,
        totalAmount: bookingData.totalAmount.toString(),
        createdBy: operatorId
      };
      
      const result = await this.bookingsService.createPendingBooking(
        bookingDataWithStringAmount,
        passengers,
        operatorId
      );
      
      reply.code(201).send(result);
    } catch (error: any) {
      req.log.error({ err: error }, 'Pending booking creation error');
      
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      
      if (error.message.includes('not held') || error.message.includes('expired')) {
        return reply.code(400).send({
          error: 'Seat hold validation failed',
          code: 'SEAT_NOT_HELD',
          details: error.message
        });
      }
      
      reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: 'An unexpected error occurred during pending booking creation'
      });
    }
  }

  async getPendingBookings(req: FastifyRequest, reply: FastifyReply) {
    const { outletId } = req.query as { outletId?: string };
    const operatorId = req.user?.id ?? 'system';
    
    const pendingBookings = await this.bookingsService.getPendingBookings(outletId as string, operatorId);
    reply.send(pendingBookings);
  }

  async releasePendingBooking(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const operatorId = req.user?.id ?? 'system';
      
      await this.bookingsService.releasePendingBooking(id, operatorId);
      reply.code(204).send();
    } catch (error: any) {
      req.log.error({ err: error }, 'Release pending booking error');
      reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  async unseatPassenger(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { passengerId } = req.params as { passengerId: string };
      const { reason } = unseatPassengerSchema.parse(req.body || {});
      const performedBy = req.user?.id ?? 'system';
      const result = await this.unseatService.unseatPassenger(passengerId, performedBy, reason);
      reply.send(result);
    } catch (error: any) {
      req.log.error({ err: error }, 'Unseat passenger error');
      reply.code(error.message.includes('tidak ditemukan') ? 404 : 400).send({
        error: error.message,
        code: 'UNSEAT_ERROR'
      });
    }
  }

  async unseatAllPassengers(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId } = req.params as { bookingId: string };
      const { reason } = unseatPassengerSchema.parse(req.body || {});
      const performedBy = req.user?.id ?? 'system';
      const result = await this.unseatService.unseatAllPassengers(bookingId, performedBy, reason);
      reply.send(result);
    } catch (error: any) {
      req.log.error({ err: error }, 'Unseat all passengers error');
      reply.code(error.message.includes('tidak ditemukan') ? 404 : 400).send({
        error: error.message,
        code: 'UNSEAT_ERROR'
      });
    }
  }


  async reschedulePassenger(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { passengerId } = req.params as { passengerId: string };
      const data = reschedulePassengerSchema.parse(req.body);
      const performedBy = req.user?.id ?? 'system';
      const result = await this.rescheduleService.reschedulePassenger(
        passengerId,
        data.newTripId,
        data.newSeatNo,
        data.newOriginStopId,
        data.newDestinationStopId,
        data.newOriginSeq,
        data.newDestinationSeq,
        performedBy,
        data.reason
      );
      reply.send(result);
    } catch (error: any) {
      req.log.error({ err: error }, 'Reschedule passenger error');
      const status = error.message.includes('tidak ditemukan') ? 404
        : error.message.includes('tidak tersedia') ? 409 : 400;
      reply.code(status).send({
        error: error.message,
        code: 'RESCHEDULE_ERROR'
      });
    }
  }

  async assignSeatToUnseated(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { passengerId } = req.params as { passengerId: string };
      const { newSeatNo } = z.object({ newSeatNo: z.string() }).parse(req.body);
      const performedBy = req.user?.id ?? 'system';
      const result = await this.unseatService.assignSeatToUnseated(passengerId, newSeatNo, performedBy);
      reply.send(result);
    } catch (error: any) {
      req.log.error({ err: error }, 'Assign seat to unseated error');
      const status = error.message.includes('tidak ditemukan') ? 404
        : error.message.includes('tidak tersedia') ? 409
        : error.message.includes('berstatus unseated') ? 400 : 400;
      reply.code(status).send({
        error: error.message,
        code: 'ASSIGN_UNSEATED_ERROR'
      });
    }
  }

  async getBookingHistory(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId } = req.params as { bookingId: string };
      const history = await this.unseatService.getBookingHistory(bookingId);
      reply.send(history);
    } catch (error: any) {
      req.log.error({ err: error }, 'Get booking history error');
      reply.code(500).send({
        error: error.message,
        code: 'HISTORY_ERROR'
      });
    }
  }
}
