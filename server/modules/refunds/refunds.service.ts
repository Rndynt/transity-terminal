import { db } from "@server/db";
import { refunds } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

function getRows(result: any): any[] {
  return Array.isArray(result) ? result : (result as any).rows || [];
}

export class RefundsService {
  async getAll() {
    const result = await db.execute(sql`
      SELECT r.*, b.booking_code, p.full_name AS passenger_name
      FROM refunds r
      LEFT JOIN bookings b ON b.id = r.booking_id
      LEFT JOIN passengers p ON p.id = r.passenger_id
      ORDER BY r.created_at DESC
      LIMIT 200
    `);
    return getRows(result);
  }

  async getById(id: string) {
    const result = await db.execute(sql`
      SELECT r.*, b.booking_code, b.total_amount AS booking_total, b.status AS booking_status,
             p.full_name AS passenger_name, p.ticket_number
      FROM refunds r
      LEFT JOIN bookings b ON b.id = r.booking_id
      LEFT JOIN passengers p ON p.id = r.passenger_id
      WHERE r.id = ${id}
    `);
    const rows = getRows(result);
    return rows[0] || null;
  }

  async create(data: {
    bookingId: string;
    passengerId?: string | null;
    originalAmount: string;
    refundAmount: string;
    adminFee?: string;
    reason?: string;
    refundMethod?: string;
    bankAccount?: string;
    bankName?: string;
    notes?: string;
  }, requestedBy: string) {
    const [row] = await db.insert(refunds).values({
      bookingId: data.bookingId,
      passengerId: data.passengerId || null,
      originalAmount: String(data.originalAmount),
      refundAmount: String(data.refundAmount),
      adminFee: String(data.adminFee || 0),
      reason: data.reason,
      refundMethod: data.refundMethod,
      requestedBy,
      bankAccount: data.bankAccount,
      bankName: data.bankName,
      notes: data.notes,
    }).returning();
    return row;
  }

  async approve(id: string, approvedBy: string) {
    await db.update(refunds)
      .set({ status: 'approved', approvedBy, approvedAt: new Date() })
      .where(eq(refunds.id, id));
    return { success: true };
  }

  async process(id: string, processedBy: string) {
    await db.update(refunds)
      .set({ status: 'processed', processedBy, processedAt: new Date() })
      .where(eq(refunds.id, id));
    return { success: true };
  }

  async reject(id: string, notes?: string) {
    await db.update(refunds)
      .set({ status: 'rejected', notes })
      .where(eq(refunds.id, id));
    return { success: true };
  }
}
