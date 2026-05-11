import type { FastifyRequest, FastifyReply } from "fastify";
import { RefundsService } from "./refunds.service";
import { buildServiceContext } from "@modules/rbac/rbac.guard";

export class RefundsController {
  private service: RefundsService;

  constructor() {
    this.service = new RefundsService();
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const query = (req.query as { limit?: string; offset?: string } | undefined) || {};
    const limit = query.limit ? parseInt(query.limit) : undefined;
    const offset = query.offset ? parseInt(query.offset) : undefined;
    const rows = await this.service.getAll(buildServiceContext(req), {
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    reply.send(rows);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const row = await this.service.getById(id, buildServiceContext(req));
    reply.send(row);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as Parameters<RefundsService['create']>[0];
    const requestedBy = req.user?.email || 'Unknown';
    const row = await this.service.create(body, requestedBy, buildServiceContext(req));
    reply.send(row);
  }

  async approve(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const approvedBy = req.user?.email || 'Unknown';
    const result = await this.service.approve(id, approvedBy, buildServiceContext(req));
    reply.send(result);
  }

  async process(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const processedBy = req.user?.email || 'Unknown';
    const result = await this.service.process(id, processedBy, buildServiceContext(req));
    reply.send(result);
  }

  async reject(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const { notes } = (req.body as { notes?: string } | undefined) || {};
    const result = await this.service.reject(id, notes, buildServiceContext(req));
    reply.send(result);
  }
}
