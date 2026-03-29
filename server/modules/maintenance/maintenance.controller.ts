import type { FastifyRequest, FastifyReply } from "fastify";
import { MaintenanceService } from "./maintenance.service";

export class MaintenanceController {
  private service: MaintenanceService;

  constructor() {
    this.service = new MaintenanceService();
  }

  async getByVehicle(req: FastifyRequest, reply: FastifyReply) {
    const { vehicleId } = req.params as { vehicleId: string };
    const rows = await this.service.getByVehicle(vehicleId);
    reply.send(rows);
  }

  async getAlerts(_req: FastifyRequest, reply: FastifyReply) {
    const rows = await this.service.getAlerts();
    reply.send(rows);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const { vehicleId } = req.params as { vehicleId: string };
    const createdBy = (req as any).user?.email || 'Unknown';
    const row = await this.service.create(vehicleId, req.body, createdBy);
    reply.send(row);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const result = await this.service.update(id, req.body);
    reply.send(result);
  }

  async remove(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const result = await this.service.remove(id);
    reply.send(result);
  }
}
