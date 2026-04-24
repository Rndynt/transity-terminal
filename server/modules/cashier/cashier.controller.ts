import type { FastifyRequest, FastifyReply } from "fastify";
import { CashierService } from "./cashier.service";

export class CashierController {
  private service: CashierService;

  constructor() {
    this.service = new CashierService();
  }

  private resolveStaffId(req: FastifyRequest): string | null {
    return (req as any).user?.id || (req as any).rbac?.staffId || null;
  }

  async getActive(req: FastifyRequest, reply: FastifyReply) {
    const outletId = (req as any).rbac?.outletId;
    const staffId = this.resolveStaffId(req);
    if (!outletId || !staffId) return reply.send(null);
    const session = await this.service.getActiveSession(outletId, staffId);
    reply.send(session);
  }

  async getActiveSummary(req: FastifyRequest, reply: FastifyReply) {
    const outletId = (req as any).rbac?.outletId;
    const staffId = this.resolveStaffId(req);
    if (!outletId || !staffId) return reply.send({ session: null, summary: [], transactions: [] });
    const result = await this.service.getActiveSummary(outletId, staffId);
    reply.send(result);
  }

  async open(req: FastifyRequest, reply: FastifyReply) {
    const { openingBalance, notes } = req.body as any;
    const outletId = (req as any).rbac?.outletId;
    const staffId = this.resolveStaffId(req);
    const staffName = (req as any).user?.email || (req as any).user?.name || 'Unknown';

    if (!outletId) return reply.code(400).send({ error: 'Outlet tidak ditemukan' });
    if (!staffId) return reply.code(400).send({ error: 'Staff ID tidak ditemukan — sesi tidak dapat dibuka' });

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
    const staffId = this.resolveStaffId(req);
    if (outletId && staffId) {
      const session = await this.service.getActiveSession(outletId, staffId);
      // Hanya bisa menutup sesi milik sendiri (atau via approve flow utk supervisor).
      if (!session || session.id !== sessionId) {
        return reply.code(403).send({ error: 'Tidak bisa menutup sesi milik staff lain' });
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
    const staffId = (req.query as any)?.staffId; // optional supervisor filter
    const rows = await this.service.getHistory(outletId, staffId);
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
