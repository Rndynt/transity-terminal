import type { FastifyRequest, FastifyReply } from "fastify";
import { CustomersService } from "./customers.service";

export class CustomersController {
  private service: CustomersService;

  constructor() {
    this.service = new CustomersService();
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const { search, limit } = (req.query as { search?: string; limit?: string } | undefined) || {};
    const rows = await this.service.getAll(search, limit ? parseInt(limit) : undefined);
    reply.send(rows);
  }

  async search(req: FastifyRequest, reply: FastifyReply) {
    const { phone } = (req.query as { phone?: string } | undefined) || {};
    const rows = await this.service.search(phone ?? '');
    reply.send(rows);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const customer = await this.service.getById(id);
    if (!customer) return reply.code(404).send({ error: 'Pelanggan tidak ditemukan' });
    reply.send(customer);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as Parameters<CustomersService['create']>[0];
    const row = await this.service.create(body);
    reply.send(row);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = (req.body as Record<string, unknown>) || {};
    const result = await this.service.update(id, body);
    reply.send(result);
  }

  async getDriverPerformance(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const { days } = (req.query as { days?: string } | undefined) || {};
    const result = await this.service.getDriverPerformance(id, days ? parseInt(days) : undefined);
    reply.send(result);
  }
}
