import type { FastifyRequest, FastifyReply } from "fastify";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  private service: DashboardService;

  constructor() {
    this.service = new DashboardService();
  }

  async getTodaySummary(_req: FastifyRequest, reply: FastifyReply) {
    const summary = await this.service.getTodaySummary();
    reply.send(summary);
  }
}
