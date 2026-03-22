import type { FastifyRequest, FastifyReply } from "fastify";
import { TripPatternsService } from "./tripPatterns.service";
import { IStorage } from "../../storage.interface";
import { insertTripPatternSchema } from "@shared/schema";

export class TripPatternsController {
  private tripPatternsService: TripPatternsService;

  constructor(storage: IStorage) {
    this.tripPatternsService = new TripPatternsService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const patterns = await this.tripPatternsService.getAllTripPatterns();
    reply.send(patterns);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const pattern = await this.tripPatternsService.getTripPatternById(id);
    reply.send(pattern);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertTripPatternSchema.parse(req.body);
    const pattern = await this.tripPatternsService.createTripPattern(validatedData);
    reply.code(201).send(pattern);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const validatedData = insertTripPatternSchema.partial().parse(req.body);
    const pattern = await this.tripPatternsService.updateTripPattern(id, validatedData);
    reply.send(pattern);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    await this.tripPatternsService.deleteTripPattern(id);
    reply.code(204).send();
  }
}
