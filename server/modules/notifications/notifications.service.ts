import { db } from "@server/db";
import { notifications } from "@shared/schema";
import { eq, and, desc, sql, isNull, or } from "drizzle-orm";

export class NotificationsService {
  async getForUser(userId: string, outletId?: string) {
    const rows = await db.select().from(notifications)
      .where(
        or(
          isNull(notifications.targetUserId),
          eq(notifications.targetUserId, userId || ''),
          outletId ? eq(notifications.targetOutletId, outletId) : undefined
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return rows;
  }

  async getUnreadCount(userId: string, outletId?: string) {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM notifications
      WHERE is_read = false
      AND (target_user_id IS NULL OR target_user_id = ${userId || ''} ${outletId ? sql`OR target_outlet_id = ${outletId}` : sql``})
    `);
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    return rows[0]?.count || 0;
  }

  async markRead(id: string) {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id));
  }

  async markAllRead(userId: string) {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.isRead, false),
          or(
            isNull(notifications.targetUserId),
            eq(notifications.targetUserId, userId || '')
          )
        )
      );
  }

  async remove(id: string) {
    await db.delete(notifications).where(eq(notifications.id, id));
  }
}
