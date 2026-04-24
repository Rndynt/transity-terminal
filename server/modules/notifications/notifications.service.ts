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

  /**
   * S2-08: cleanup periodik tabel notifications. Tabel ini cepat tumbuh
   * (auto-generated dari engine compensation, payment events, schedule
   * changes) dan tanpa cleanup akan jadi hot-spot untuk query unread
   * count user.
   *
   * Aturan retensi:
   *  - Notifikasi sudah read & lebih lama dari NOTIF_READ_TTL_DAYS (default 90)
   *    → hapus permanen.
   *  - Notifikasi belum read tapi lebih lama dari NOTIF_UNREAD_TTL_DAYS
   *    (default 180) → hapus juga (mencegah akumulasi tak terbatas dari
   *    user yang tidak pernah login).
   *  - Notifikasi dengan expires_at di masa lalu → hapus tanpa peduli
   *    status read.
   *
   * Return: jumlah row yang dihapus (untuk log scheduler).
   */
  async cleanupOldNotifications(): Promise<number> {
    const readTtlDays = Math.max(1, parseInt(process.env.NOTIF_READ_TTL_DAYS || '90', 10));
    const unreadTtlDays = Math.max(readTtlDays, parseInt(process.env.NOTIF_UNREAD_TTL_DAYS || '180', 10));

    const result: any = await db.execute(sql`
      DELETE FROM notifications
      WHERE
        (is_read = true  AND created_at < NOW() - (${readTtlDays}   || ' days')::interval)
        OR
        (is_read = false AND created_at < NOW() - (${unreadTtlDays} || ' days')::interval)
        OR
        (expires_at IS NOT NULL AND expires_at < NOW())
    `);
    // Drizzle/pg returns rowCount via different shapes depending on driver.
    return Number(result?.rowCount ?? result?.[0]?.rowCount ?? 0);
  }
}
