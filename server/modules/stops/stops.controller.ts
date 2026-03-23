import type { FastifyRequest, FastifyReply } from "fastify";
import { StopsService } from "./stops.service";
import { IStorage } from "../../storage.interface";
import { insertStopSchema } from "@shared/schema";

export class StopsController {
  private stopsService: StopsService;

  constructor(storage: IStorage) {
    this.stopsService = new StopsService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const stops = await this.stopsService.getAllStops();
    reply.send(stops);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const stop = await this.stopsService.getStopById(id);
    reply.send(stop);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertStopSchema.parse(req.body);
    const stop = await this.stopsService.createStop(validatedData);
    reply.code(201).send(stop);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const validatedData = insertStopSchema.partial().parse(req.body);
    const stop = await this.stopsService.updateStop(id, validatedData);
    reply.send(stop);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    await this.stopsService.deleteStop(id);
    reply.code(204).send();
  }

  async getImpact(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const [activeBookings, activeTrips] = await Promise.all([
      this.stopsService.getActiveBookingCountForStop(id),
      this.stopsService.getActiveTripsForStop(id),
    ]);
    reply.send({ activeBookings, activeTrips });
  }
}
