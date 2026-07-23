import type { FastifyRequest, FastifyReply } from "fastify";
import { DriverAppService } from "./driverApp.service";

export class DriverAppController {
  private service = new DriverAppService();

  async getMe(req: FastifyRequest, reply: FastifyReply) {
    const driver = await this.service.getMyProfile(req.user!.id);
    reply.send({ driver });
  }

  async getMySchedule(req: FastifyRequest, reply: FastifyReply) {
    const schedule = await this.service.getMySchedule(req.user!.id);
    reply.send(schedule);
  }
}
