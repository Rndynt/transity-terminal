import type { FastifyRequest, FastifyReply } from "fastify";
import { RefundsService } from "./refunds.service";

export class RefundsController {
  private service: RefundsService;

  constructor() {
    this.service = new RefundsService();
  }

  async getAll(_req: FastifyRequest, reply: FastifyReply) {
    const rows = await this.service.getAll();
    reply.send(rows);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const row = await this.service.getById(id);
    reply.send(row);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const requestedBy = (req as any).user?.email || 'Unknown';
    const row = await this.service.create(body, requestedBy);
    reply.send(row);
  }

  async approve(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const approvedBy = (req as any).user?.email || 'Unknown';
    const result = await this.service.approve(id, approvedBy);
    reply.send(result);
  }

  async process(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const processedBy = (req as any).user?.email || 'Unknown';
    const result = await this.service.process(id, processedBy);
    reply.send(result);
  }

  async reject(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const { notes } = req.body as any;
    const result = await this.service.reject(id, notes);
    reply.send(result);
  }
}
