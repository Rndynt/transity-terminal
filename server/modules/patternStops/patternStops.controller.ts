import type { FastifyRequest, FastifyReply } from "fastify";
import { PatternStopsService } from "./patternStops.service";
import { IStorage } from "../../storage.interface";
import { insertPatternStopSchema } from "@shared/schema";
import { z } from "zod";

export class PatternStopsController {
  private patternStopsService: PatternStopsService;

  constructor(storage: IStorage) {
    this.patternStopsService = new PatternStopsService(storage);
  }

  async getByPattern(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params;
    const patternStops = await this.patternStopsService.getPatternStops(patternId);
    reply.send(patternStops);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertPatternStopSchema.parse(req.body);
    const patternStop = await this.patternStopsService.createPatternStop(validatedData);
    reply.code(201).send(patternStop);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const validatedData = insertPatternStopSchema.partial().parse(req.body);
    const patternStop = await this.patternStopsService.updatePatternStop(id, validatedData);
    reply.send(patternStop);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    await this.patternStopsService.deletePatternStop(id);
    reply.code(204).send();
  }

  async bulkReplace(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params;
    const validatedData = z.array(insertPatternStopSchema).parse(req.body);
    const patternStops = await this.patternStopsService.bulkReplacePatternStops(patternId, validatedData);
    reply.send(patternStops);
  }
}
