import { Request, Response } from "express";
import { PricingService } from "./pricing.service";
import { IStorage } from "../../routes";
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

  async quoteFare(req: Request, res: Response) {
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
      
      res.json({
        perPassenger: fareQuote.total,
        totalForAllPassengers: totalAmount,
        passengerCount,
        breakdown: fareQuote.breakdown
      });
    } catch (error: any) {
      console.error('Fare quote error:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      
      if (error.message === 'NO_PRICE_RULE') {
        return res.status(422).json({
          error: 'Tidak ada aturan harga untuk trip ini',
          code: 'NO_PRICE_RULE',
          details: 'Tambahkan aturan harga (pola atau trip) sebelum memesan tiket.'
        });
      }

      if (error.message === 'TRIP_NOT_FOUND') {
        return res.status(404).json({
          error: 'Trip tidak ditemukan',
          code: 'TRIP_NOT_FOUND',
          details: ''
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: 'An unexpected error occurred while calculating fare'
      });
    }
  }
}