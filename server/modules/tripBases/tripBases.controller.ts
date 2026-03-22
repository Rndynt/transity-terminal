import type { FastifyRequest, FastifyReply } from "fastify";
import { TripBasesService } from "./tripBases.service";
import { z } from "zod";
import { insertTripBaseSchema } from "@shared/schema";

export class TripBasesController {
  constructor(private tripBasesService: TripBasesService) {}

  async getAllTripBases(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tripBases = await this.tripBasesService.getAllTripBases();
      reply.send(tripBases);
    } catch (error) {
      reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getTripBaseById(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = req.params;
      const tripBase = await this.tripBasesService.getTripBaseById(id);
      reply.send(tripBase);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({ message: error.message });
      } else {
        reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  async createTripBase(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const data = insertTripBaseSchema.parse(req.body);
      const tripBase = await this.tripBasesService.createTripBase(data);
      reply.code(201).send(tripBase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.errors });
      } else {
        reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  async updateTripBase(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = req.params;
      const data = insertTripBaseSchema.partial().parse(req.body);
      const tripBase = await this.tripBasesService.updateTripBase(id, data);
      reply.send(tripBase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.errors });
      } else if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({ message: error.message });
      } else {
        reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  async deleteTripBase(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = req.params;
      await this.tripBasesService.deleteTripBase(id);
      reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({ message: error.message });
      } else {
        reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  async materializeTrip(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const schema = z.object({
        baseId: z.string().uuid(),
        serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD')
      });
      
      const { baseId, serviceDate } = schema.parse(req.body);
      const tripId = await this.tripBasesService.ensureMaterializedTrip(baseId, serviceDate);
      
      reply.send({ tripId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.errors });
      } else if (error instanceof Error && error.message === 'base-not-eligible') {
        reply.code(400).send({ code: 'base-not-eligible', message: 'Trip base is not eligible for the specified date' });
      } else {
        reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  async closeTrip(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = req.params;
      const trip = await this.tripBasesService.closeTrip(id);
      reply.send({ ok: true, tripId: trip.id, status: trip.status });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({ message: error.message });
      } else {
        reply.code(500).send({ message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }
}