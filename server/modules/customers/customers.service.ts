import { db } from "@server/db";
import { customerProfiles } from "@shared/schema";
import { eq, desc, ilike, or, sql } from "drizzle-orm";

export class CustomersService {
  private getRows(result: any): any[] {
    return Array.isArray(result) ? result : (result as any).rows || [];
  }

  async getAll(search?: string, limit?: number) {
    const maxRows = Math.min(limit || 100, 500);

    if (search) {
      const q = `%${search}%`;
      return db.select().from(customerProfiles)
        .where(or(ilike(customerProfiles.fullName, q), ilike(customerProfiles.phone, q)))
        .orderBy(desc(customerProfiles.totalTrips))
        .limit(maxRows);
    }

    return db.select().from(customerProfiles)
      .orderBy(desc(customerProfiles.totalTrips))
      .limit(maxRows);
  }

  async search(phone: string) {
    if (!phone || phone.length < 4) return [];
    return db.select().from(customerProfiles)
      .where(ilike(customerProfiles.phone, `%${phone}%`))
      .limit(5);
  }

  async getById(id: string) {
    const [customer] = await db.select().from(customerProfiles).where(eq(customerProfiles.id, id));
    if (!customer) return null;

    const bookingsResult = await db.execute(sql`
      SELECT b.id, b.booking_code, b.status, b.total_amount, b.channel, b.created_at,
             o.name AS origin_name, d.name AS dest_name
      FROM bookings b
      LEFT JOIN stops o ON o.id = b.origin_stop_id
      LEFT JOIN stops d ON d.id = b.destination_stop_id
      JOIN passengers p ON p.booking_id = b.id
      WHERE p.phone = ${customer.phone} OR p.full_name = ${customer.fullName}
      ORDER BY b.created_at DESC LIMIT 50
    `);
    const bookings = this.getRows(bookingsResult);

    return { ...customer, bookings };
  }

  async create(data: { fullName: string; phone: string; email?: string; idNumber?: string; tag?: string; notes?: string }) {
    const [row] = await db.insert(customerProfiles).values({
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      idNumber: data.idNumber,
      tag: (data.tag as any) || 'regular',
      notes: data.notes,
    }).returning();
    return row;
  }

  async update(id: string, data: Record<string, any>) {
    const updates: any = { updatedAt: new Date() };
    if (data.fullName) updates.fullName = data.fullName;
    if (data.phone) updates.phone = data.phone;
    if (data.email !== undefined) updates.email = data.email;
    if (data.idNumber !== undefined) updates.idNumber = data.idNumber;
    if (data.tag) updates.tag = data.tag;
    if (data.notes !== undefined) updates.notes = data.notes;

    await db.update(customerProfiles).set(updates).where(eq(customerProfiles.id, id));
    return { success: true };
  }

  async getDriverPerformance(driverId: string, days?: number) {
    const periodDays = days || 30;

    const statsResult = await db.execute(sql`
      SELECT
        COUNT(t.id)::int AS total_trips,
        COALESCE(SUM(
          CASE WHEN v.capacity > 0 THEN
            (SELECT COUNT(*) FROM passengers p JOIN bookings bk ON bk.id = p.booking_id
             WHERE bk.trip_id = t.id AND p.ticket_status NOT IN ('canceled','unseated'))
          ELSE 0 END
        ), 0)::int AS total_passengers,
        COALESCE(AVG(
          CASE WHEN v.capacity > 0 THEN
            (SELECT COUNT(*) FROM passengers p JOIN bookings bk ON bk.id = p.booking_id
             WHERE bk.trip_id = t.id AND p.ticket_status NOT IN ('canceled','unseated'))::numeric / v.capacity * 100
          ELSE 0 END
        ), 0)::numeric AS avg_load_factor
      FROM trips t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.driver_id = ${driverId}
        AND t.service_date >= (CURRENT_DATE - ${periodDays}::int)::text
    `);
    const statsRows = this.getRows(statsResult);

    const tripHistoryResult = await db.execute(sql`
      SELECT t.id, t.service_date, t.status,
             tp.name AS pattern_name,
             v.plate AS vehicle_plate,
             (SELECT COUNT(*) FROM passengers p JOIN bookings bk ON bk.id = p.booking_id
              WHERE bk.trip_id = t.id AND p.ticket_status NOT IN ('canceled','unseated'))::int AS passenger_count
      FROM trips t
      LEFT JOIN trip_patterns tp ON tp.id = t.pattern_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.driver_id = ${driverId}
        AND t.service_date >= (CURRENT_DATE - ${periodDays}::int)::text
      ORDER BY t.service_date DESC
      LIMIT 50
    `);
    const tripHistory = this.getRows(tripHistoryResult);

    return { stats: statsRows[0] || {}, tripHistory };
  }
}
