import type { FastifyRequest, FastifyReply } from "fastify";
import { RoundTripService } from "./roundTrip.service";
import { IStorage } from "../../storage.interface";
import { z } from "zod";

const roundTripSchema = z.object({
  outbound: z.object({
    tripId: z.string().uuid(),
    originStopId: z.string().uuid(),
    destinationStopId: z.string().uuid(),
    originSeq: z.number(),
    destinationSeq: z.number(),
    outletId: z.string().uuid().optional(),
    passengers: z.array(z.object({
      name: z.string().min(1),
      seatNo: z.string()
    }))
  }),
  return: z.object({
    tripId: z.string().uuid(),
    originStopId: z.string().uuid(),
    destinationStopId: z.string().uuid(),
    originSeq: z.number(),
    destinationSeq: z.number(),
    passengers: z.array(z.object({
      seatNo: z.string()
    }))
  }),
  payment: z.object({
    method: z.enum(['cash', 'qr', 'ewallet', 'bank']),
    amount: z.number()
  })
});

export class RoundTripController {
  private roundTripService: RoundTripService;

  constructor(storage: IStorage) {
    this.roundTripService = new RoundTripService(storage);
  }

  async createRoundTrip(req: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = roundTripSchema.parse(req.body);
      
      if (validatedData.outbound.passengers.length !== validatedData.return.passengers.length) {
        return reply.code(400).send({
          error: 'Jumlah penumpang tidak cocok',
          code: 'PASSENGER_COUNT_MISMATCH',
          details: 'Jumlah penumpang outbound dan return harus sama'
        });
      }

      const operatorId = req.user?.id ?? 'system';
      const result = await this.roundTripService.createRoundTripBooking(validatedData, operatorId);
      
      reply.code(201).send(result);
    } catch (error: any) {
      console.error('Round-trip booking creation error:', error);
      
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      
      if (error.message.includes('tidak lagi dihold') || error.message.includes('kadaluarsa') || error.message.includes('not held')) {
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

      reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message || 'An unexpected error occurred during round-trip booking creation'
      });
    }
  }

  async getGroupByCode(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { groupCode } = req.params as { groupCode: string };
      const result = await this.roundTripService.getBookingGroupByCode(groupCode);
      
      if (!result) {
        return reply.code(404).send({
          error: 'Booking group not found',
          code: 'GROUP_NOT_FOUND'
        });
      }
      
      reply.send(result);
    } catch (error: any) {
      console.error('Get group by code error:', error);
      reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message
      });
    }
  }
}
