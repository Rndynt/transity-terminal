import type { FastifyRequest, FastifyReply } from "fastify";
import { TripPatternsService } from "./tripPatterns.service";
import { IStorage } from "@server/storage.interface";
import { insertTripPatternSchema } from "@shared/schema";

export class TripPatternsController {
  private tripPatternsService: TripPatternsService;

  constructor(storage: IStorage) {
    this.tripPatternsService = new TripPatternsService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const patterns = await this.tripPatternsService.getAllTripPatterns();
    const patternsWithStops = await Promise.all(
      patterns.map(async (p) => {
        const patternStops = await this.tripPatternsService.getPatternStops(p.id);
        return { ...p, patternStops };
      })
    );
    reply.send(patternsWithStops);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const pattern = await this.tripPatternsService.getTripPatternById(id);
    reply.send(pattern);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertTripPatternSchema.parse(req.body);
    const pattern = await this.tripPatternsService.createTripPattern(validatedData);
    reply.code(201).send(pattern);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const validatedData = insertTripPatternSchema.partial().parse(req.body);
    const pattern = await this.tripPatternsService.updateTripPattern(id, validatedData);
    reply.send(pattern);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.tripPatternsService.deleteTripPattern(id);
    reply.code(204).send();
  }

  async getImpact(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const [activeTrips, activeBookings] = await Promise.all([
      this.tripPatternsService.getActiveTripsForPattern(id),
      this.tripPatternsService.getActiveBookingCountForPattern(id),
    ]);
    reply.send({ activeTrips, activeBookings });
  }
}
