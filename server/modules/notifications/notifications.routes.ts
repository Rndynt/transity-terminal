import type { FastifyInstance } from "fastify";
import { NotificationsController } from "./notifications.controller";

export function registerNotificationsRoutes(app: FastifyInstance) {
  const controller = new NotificationsController();

  app.get('/api/notifications', async (req, reply) => controller.getAll(req, reply));
  app.get('/api/notifications/unread-count', async (req, reply) => controller.getUnreadCount(req, reply));
  app.patch('/api/notifications/:id/read', async (req, reply) => controller.markRead(req, reply));
  app.patch('/api/notifications/read-all', async (req, reply) => controller.markAllRead(req, reply));
  app.delete('/api/notifications/:id', async (req, reply) => controller.remove(req, reply));
}
