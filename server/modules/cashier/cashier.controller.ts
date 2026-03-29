import type { FastifyRequest, FastifyReply } from "fastify";
import { CashierService } from "./cashier.service";

export class CashierController {
  private service: CashierService;

  constructor() {
    this.service = new CashierService();
  }

  async getActive(req: FastifyRequest, reply: FastifyReply) {
    const outletId = (req as any).rbac?.outletId;
    if (!outletId) return reply.send(null);
    const session = await this.service.getActiveSession(outletId);
    reply.send(session);
  }

  async getActiveSummary(req: FastifyRequest, reply: FastifyReply) {
    const outletId = (req as any).rbac?.outletId;
    if (!outletId) return reply.send({ session: null, summary: [], transactions: [] });
    const result = await this.service.getActiveSummary(outletId);
    reply.send(result);
  }

  async open(req: FastifyRequest, reply: FastifyReply) {
    const { openingBalance, notes } = req.body as any;
    const outletId = (req as any).rbac?.outletId;
    const staffId = (req as any).user?.id || (req as any).rbac?.staffId || 'system';
    const staffName = (req as any).user?.email || 'Unknown';

    if (!outletId) return reply.code(400).send({ error: 'Outlet tidak ditemukan' });

    try {
      const session = await this.service.openSession({ outletId, staffId, staffName, openingBalance, notes });
      reply.send(session);
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  }

  async close(req: FastifyRequest, reply: FastifyReply) {
    const { sessionId, settlements, notes } = req.body as any;
    const outletId = (req as any).rbac?.outletId;
    if (outletId) {
      const session = await this.service.getActiveSession(outletId);
      if (!session || session.id !== sessionId) {
        return reply.code(403).send({ error: 'Tidak bisa menutup sesi outlet lain' });
      }
    }
    try {
      const result = await this.service.closeSession(sessionId, settlements, notes);
      reply.send(result);
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  }

  async approve(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const outletId = (req as any).rbac?.outletId;
    const detail = await this.service.getDetail(id);
    if (outletId && detail.session && detail.session.outletId !== outletId) {
      return reply.code(403).send({ error: 'Tidak bisa approve sesi outlet lain' });
    }
    const approvedBy = (req as any).user?.email || 'Unknown';
    const result = await this.service.approveSession(id, approvedBy);
    reply.send(result);
  }

  async getHistory(req: FastifyRequest, reply: FastifyReply) {
    const outletId = (req as any).rbac?.outletId;
    const rows = await this.service.getHistory(outletId);
    reply.send(rows);
  }

  async getDetail(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const outletId = (req as any).rbac?.outletId;
    const detail = await this.service.getDetail(id);
    if (outletId && detail.session && detail.session.outletId !== outletId) {
      return reply.code(403).send({ error: 'Tidak bisa melihat sesi outlet lain' });
    }
    reply.send(detail);
  }
}
