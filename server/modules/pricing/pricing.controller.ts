import type { FastifyRequest, FastifyReply } from "fastify";
import { PricingService } from "./pricing.service";
import { IStorage } from "@server/storage.interface";
import { z } from "zod";

const quoteFareSchema = z.object({
  tripId: z.string().uuid(),
  originSeq: z.coerce.number().int(),
  destinationSeq: z.coerce.number().int(),
  passengerCount: z.coerce.number().int().positive().default(1)
});

export class PricingController {
  private pricingService: PricingService;

  constructor(storage: IStorage) {
    this.pricingService = new PricingService(storage);
  }

  async quoteFare(req: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = quoteFareSchema.parse(req.query);
      const { tripId, originSeq, destinationSeq, passengerCount } = validatedData;
      
      const fareQuote = await this.pricingService.quoteFare(
        tripId,
        originSeq,
        destinationSeq
      );
      
      // Calculate total for all passengers
      const totalAmount = Number(fareQuote.total) * passengerCount;
      
      reply.send({
        perPassenger: fareQuote.total,
        totalForAllPassengers: totalAmount,
        passengerCount,
        breakdown: fareQuote.breakdown
      });
    } catch (error: any) {
      console.error('Fare quote error:', error);
      
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      
      if (error.message === 'NO_PRICE_RULE') {
        return reply.code(422).send({
          error: 'Tidak ada aturan harga untuk trip ini',
          code: 'NO_PRICE_RULE',
          details: 'Tambahkan aturan harga (pola atau trip) sebelum memesan tiket.'
        });
      }

      if (error.message === 'TRIP_NOT_FOUND') {
        return reply.code(404).send({
          error: 'Trip tidak ditemukan',
          code: 'TRIP_NOT_FOUND',
          details: ''
        });
      }

      reply.code(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: 'An unexpected error occurred while calculating fare'
      });
    }
  }
}