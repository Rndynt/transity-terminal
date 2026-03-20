import { Request, Response } from "express";
import { BookingsService } from "./bookings.service";
import { IStorage } from "../../routes";
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

export class BookingsController {
  private bookingsService: BookingsService;

  constructor(storage: IStorage) {
    this.bookingsService = new BookingsService(storage);
  }

  async getAll(req: Request, res: Response) {
    const { tripId } = req.query;
    const bookings = await this.bookingsService.getAllBookings(tripId as string);
    res.json(bookings);
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const booking = await this.bookingsService.getBookingById(id);
    res.json(booking);
  }

  async create(req: Request, res: Response) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      // Validate request data with enhanced validation
      const validatedData = createBookingSchema.parse(req.body);
      const { passengers, payment, ...bookingData } = validatedData;
      
      // Enhanced validation
      if (validatedData.totalAmount <= 0) {
        return res.status(400).json({ 
          error: 'Invalid total amount',
          code: 'INVALID_TOTAL',
          details: 'Total amount must be greater than 0'
        });
      }
      
      if (!passengers || passengers.length === 0) {
        return res.status(400).json({
          error: 'No passengers provided',
          code: 'NO_PASSENGERS',
          details: 'At least one passenger is required'
        });
      }
      
      if (payment.amount <= 0) {
        return res.status(400).json({
          error: 'Invalid payment amount',
          code: 'INVALID_PAYMENT',
          details: 'Payment amount must be greater than 0'
        });
      }

      if (Math.abs(payment.amount - validatedData.totalAmount) > 0.01) {
        return res.status(400).json({
          error: 'Payment amount mismatch',
          code: 'PAYMENT_AMOUNT_MISMATCH',
          details: `Payment amount ${payment.amount} does not match booking total ${validatedData.totalAmount}`
        });
      }
      
      // Validate seat ownership - this will be checked in the service
      // Convert totalAmount to string for database storage
      const bookingDataWithStringAmount = {
        ...bookingData,
        totalAmount: bookingData.totalAmount.toString(),
        createdBy: req.headers['x-operator-id'] as string || 'default-operator'
      };

      const result = await this.bookingsService.createBooking(
        bookingDataWithStringAmount,
        passengers,
        payment,
        idempotencyKey
      );
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Booking creation error:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      
      if (error.message.includes('not held') || error.message.includes('expired')) {
        return res.status(400).json({
          error: 'Seat hold validation failed',
          code: 'SEAT_NOT_HELD',
          details: error.message
        });
      }
      
      if (error.message.includes('already booked')) {
        return res.status(409).json({
          error: 'Seat already booked',
          code: 'SEAT_CONFLICT',
          details: error.message
        });
      }
      
      // Generic server error
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: 'An unexpected error occurred during booking creation'
      });
    }
  }

  async createHold(req: Request, res: Response) {
    try {
      const validatedData = createHoldSchema.parse(req.body);
      const operatorId = req.headers['x-operator-id'] as string || 'default-operator';
      
      const result = await this.bookingsService.createHold(
        validatedData.tripId,
        validatedData.seatNo,
        validatedData.originSeq,
        validatedData.destinationSeq,
        validatedData.ttlSeconds,
        operatorId
      );
      
      if (result.ok) {
        res.status(201).json(result);
      } else if (result.reason === 'already-held-by-you') {
        // Idempotent behavior: return success if already held by same operator
        res.status(200).json({
          ok: true,
          holdRef: null, // No new hold created, but request is successful
          message: 'Seat already held by you',
          ownedByYou: true
        });
      } else if (result.reason === 'INCOMPLETE_INVENTORY') {
        res.status(422).json({
          error: 'Inventori kursi belum diinisialisasi',
          code: 'INCOMPLETE_INVENTORY',
          details: 'Jalankan Precompute Seat Inventory di halaman Trip terlebih dahulu'
        });
      } else if (result.reason === 'TRANSACTION_ERROR') {
        res.status(500).json({
          error: 'Terjadi kesalahan sistem saat memegang kursi',
          code: 'TRANSACTION_ERROR',
          details: result.reason
        });
      } else {
        res.status(409).json({
          error: 'Kursi sedang dipegang oleh agen lain',
          code: 'HELD_BY_OTHER',
          details: result.reason
        });
      }
    } catch (error: any) {
      console.error('Hold creation error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }

  async releaseHold(req: Request, res: Response) {
    const { holdRef } = req.params;
    await this.bookingsService.releaseHold(holdRef);
    res.status(204).send();
  }

  async createPendingBooking(req: Request, res: Response) {
    try {
      const validatedData = createPendingBookingSchema.parse(req.body);
      const { passengers, ...bookingData } = validatedData;
      const operatorId = req.headers['x-operator-id'] as string || 'default-operator';
      
      // Enhanced validation
      if (validatedData.totalAmount <= 0) {
        return res.status(400).json({ 
          error: 'Invalid total amount',
          code: 'INVALID_TOTAL',
          details: 'Total amount must be greater than 0'
        });
      }
      
      if (!passengers || passengers.length === 0) {
        return res.status(400).json({
          error: 'No passengers provided',
          code: 'NO_PASSENGERS',
          details: 'At least one passenger is required'
        });
      }
      
      const bookingDataWithStringAmount = {
        ...bookingData,
        totalAmount: bookingData.totalAmount.toString(),
        createdBy: operatorId
      };
      
      const result = await this.bookingsService.createPendingBooking(
        bookingDataWithStringAmount,
        passengers,
        operatorId
      );
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Pending booking creation error:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      
      if (error.message.includes('not held') || error.message.includes('expired')) {
        return res.status(400).json({
          error: 'Seat hold validation failed',
          code: 'SEAT_NOT_HELD',
          details: error.message
        });
      }
      
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: 'An unexpected error occurred during pending booking creation'
      });
    }
  }

  async getPendingBookings(req: Request, res: Response) {
    const { outletId } = req.query;
    const operatorId = req.headers['x-operator-id'] as string || 'default-operator';
    
    const pendingBookings = await this.bookingsService.getPendingBookings(outletId as string, operatorId);
    res.json(pendingBookings);
  }

  async releasePendingBooking(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operatorId = req.headers['x-operator-id'] as string || 'default-operator';
      
      await this.bookingsService.releasePendingBooking(id, operatorId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Release pending booking error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }
}
