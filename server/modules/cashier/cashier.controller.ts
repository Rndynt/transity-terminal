import type { FastifyRequest, FastifyReply } from "fastify";
import { CashierService } from "./cashier.service";
import { buildServiceContext } from "@modules/rbac/rbac.guard";

/**
 * Payloads submitted by the cashier UI. Structural types match what
 * the frontend sends; zod validation lives in the routes layer.
 */
interface OpenSessionBody {
  openingBalance: number;
  notes?: string;
}

interface SettlementInput {
  paymentMethod: string;
  actualAmount: number;
  notes?: string;
}

interface CloseSessionBody {
  sessionId: string;
  settlements: SettlementInput[];
  notes?: string;
}

interface HistoryQuery {
  staffId?: string;
}

/**
 * `EffectivePermissions.staffId` doesn't exist on the typed shape but
 * some middleware historically attached it. Narrow defensively without
 * introducing `any`.
 */
type RbacWithStaffId = { staffId?: string };

export class CashierController {
  private service: CashierService;

  constructor() {
    this.service = new CashierService();
  }

  private resolveStaffId(req: FastifyRequest): string | null {
    return req.user?.id || (req.rbac as RbacWithStaffId | undefined)?.staffId || null;
  }

  async getActive(req: FastifyRequest, reply: FastifyReply) {
    const outletId = req.rbac?.outletId;
    const staffId = this.resolveStaffId(req);
    if (!outletId || !staffId) return reply.send(null);
    const session = await this.service.getActiveSession(outletId, staffId, buildServiceContext(req));
    reply.send(session);
  }

  async getActiveSummary(req: FastifyRequest, reply: FastifyReply) {
    const outletId = req.rbac?.outletId;
    const staffId = this.resolveStaffId(req);
    if (!outletId || !staffId) return reply.send({ session: null, summary: [], transactions: [] });
    const result = await this.service.getActiveSummary(outletId, staffId, buildServiceContext(req));
    reply.send(result);
  }

  async open(req: FastifyRequest, reply: FastifyReply) {
    const { openingBalance, notes } = req.body as OpenSessionBody;
    const outletId = req.rbac?.outletId;
    const staffId = this.resolveStaffId(req);
    const staffName = req.user?.email || req.user?.name || 'Unknown';

    if (!outletId) return reply.code(400).send({ error: 'Outlet tidak ditemukan' });
    if (!staffId) return reply.code(400).send({ error: 'Staff ID tidak ditemukan — sesi tidak dapat dibuka' });

    try {
      const session = await this.service.openSession(
        { outletId, staffId, staffName, openingBalance, notes },
        buildServiceContext(req),
      );
      reply.send(session);
    } catch (err) {
      reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  async close(req: FastifyRequest, reply: FastifyReply) {
    const { sessionId, settlements, notes } = req.body as CloseSessionBody;
    const outletId = req.rbac?.outletId;
    const staffId = this.resolveStaffId(req);
    const ctx = buildServiceContext(req);
    if (outletId && staffId) {
      const session = await this.service.getActiveSession(outletId, staffId, ctx);
      // Hanya bisa menutup sesi milik sendiri (atau via approve flow utk supervisor).
      if (!session || session.id !== sessionId) {
        return reply.code(403).send({ error: 'Tidak bisa menutup sesi milik staff lain' });
      }
    }
    try {
      const result = await this.service.closeSession(sessionId, settlements, notes, ctx);
      reply.send(result);
    } catch (err) {
      reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  async approve(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const outletId = req.rbac?.outletId;
    const ctx = buildServiceContext(req);
    const detail = await this.service.getDetail(id, ctx);
    if (outletId && detail.session && detail.session.outletId !== outletId) {
      return reply.code(403).send({ error: 'Tidak bisa approve sesi outlet lain' });
    }
    const approvedBy = req.user?.email || 'Unknown';
    const result = await this.service.approveSession(id, approvedBy, ctx);
    reply.send(result);
  }

  async getHistory(req: FastifyRequest, reply: FastifyReply) {
    const outletId = req.rbac?.outletId ?? undefined;
    const staffId = (req.query as HistoryQuery | undefined)?.staffId; // optional supervisor filter
    const rows = await this.service.getHistory(outletId, staffId, buildServiceContext(req));
    reply.send(rows);
  }

  async getDetail(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const outletId = req.rbac?.outletId;
    const detail = await this.service.getDetail(id, buildServiceContext(req));
    if (outletId && detail.session && detail.session.outletId !== outletId) {
      return reply.code(403).send({ error: 'Tidak bisa melihat sesi outlet lain' });
    }
    reply.send(detail);
  }
}
