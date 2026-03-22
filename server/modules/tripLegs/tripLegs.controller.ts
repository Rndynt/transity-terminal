import type { FastifyRequest, FastifyReply } from "fastify";
import { TripLegsService } from "./tripLegs.service";
import { IStorage } from "../../storage.interface";

export class TripLegsController {
  private tripLegsService: TripLegsService;

  constructor(storage: IStorage) {
    this.tripLegsService = new TripLegsService(storage);
  }

  async getByTrip(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params;
    const legs = await this.tripLegsService.getTripLegs(tripId);
    reply.send(legs);
  }
}
