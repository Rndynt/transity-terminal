import type { FastifyRequest, FastifyReply } from "fastify";
import { NotificationsService } from "./notifications.service";

export class NotificationsController {
  private service: NotificationsService;

  constructor() {
    this.service = new NotificationsService();
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user?.id || (req.rbac as { staffId?: string } | undefined)?.staffId;
    const outletId = req.rbac?.outletId;
    const rows = await this.service.getForUser(userId ?? '', outletId ?? undefined);
    reply.send(rows);
  }

  async getUnreadCount(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user?.id || (req.rbac as { staffId?: string } | undefined)?.staffId;
    const outletId = req.rbac?.outletId;
    const count = await this.service.getUnreadCount(userId ?? '', outletId ?? undefined);
    reply.send({ count });
  }

  async markRead(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.service.markRead(id);
    reply.send({ success: true });
  }

  async markAllRead(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user?.id || (req.rbac as { staffId?: string } | undefined)?.staffId;
    await this.service.markAllRead(userId ?? '');
    reply.send({ success: true });
  }

  async remove(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.service.remove(id);
    reply.send({ success: true });
  }
}
