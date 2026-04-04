import { db } from "@server/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  bookings, passengers, payments, printJobs, stops,
  type Booking, type InsertBooking,
  type Passenger, type InsertPassenger,
  type Payment, type InsertPayment,
  type PrintJob, type InsertPrintJob
} from "@shared/schema";

export class BookingRepository {
  async getBookings(tripId?: string): Promise<Booking[]> {
    const query = db.select().from(bookings);
    if (tripId) {
      return await query.where(eq(bookings.tripId, tripId)).orderBy(desc(bookings.createdAt));
    }
    return await query.orderBy(desc(bookings.createdAt));
  }

  async getActiveBookingsForTrip(tripId: string): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(and(
        eq(bookings.tripId, tripId),
        inArray(bookings.status, ['paid', 'pending', 'confirmed', 'checked_in'])
      ))
      .orderBy(desc(bookings.createdAt));
  }

  async getBookingsPaginated(options: { tripId?: string; outletId?: string; page: number; pageSize: number }): Promise<{ data: Booking[]; total: number }> {
    const { tripId, outletId, page, pageSize } = options;
    const conditions = [];
    if (tripId) conditions.push(eq(bookings.tripId, tripId));
    if (outletId) conditions.push(eq(bookings.outletId, outletId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(bookings).where(where);
    const total = countResult?.count ?? 0;

    const data = await db.select().from(bookings)
      .where(where)
      .orderBy(desc(bookings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total };
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async createBooking(data: InsertBooking): Promise<Booking> {
    const [booking] = await db.insert(bookings).values(data).returning();
    return booking;
  }

  async updateBooking(id: string, data: Partial<InsertBooking>): Promise<Booking> {
    const [booking] = await db.update(bookings).set(data).where(eq(bookings.id, id)).returning();
    return booking;
  }

  async getBookingByCode(bookingCode: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingCode, bookingCode));
    return booking;
  }

  async getPassengers(bookingId: string): Promise<Passenger[]> {
    return await db.select().from(passengers).where(eq(passengers.bookingId, bookingId));
  }

  async getPassengersByBookingIds(bookingIds: string[]): Promise<Passenger[]> {
    if (bookingIds.length === 0) return [];
    return await db.select().from(passengers).where(inArray(passengers.bookingId, bookingIds));
  }

  async getPassengerByTicketNumber(ticketNumber: string): Promise<Passenger | undefined> {
    const [passenger] = await db.select().from(passengers).where(eq(passengers.ticketNumber, ticketNumber));
    return passenger;
  }

  async createPassenger(data: InsertPassenger): Promise<Passenger> {
    const [passenger] = await db.insert(passengers).values(data).returning();
    return passenger;
  }

  async updatePassenger(id: string, data: Partial<InsertPassenger>): Promise<Passenger> {
    const [passenger] = await db.update(passengers).set(data).where(eq(passengers.id, id)).returning();
    return passenger;
  }

  async getActivePassengersForTrip(tripId: string): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.full_name             AS "fullName",
        p.phone,
        p.seat_no               AS "seatNo",
        p.ticket_number         AS "ticketNumber",
        p.ticket_status         AS "ticketStatus",
        p.fare_amount           AS "fareAmount",
        b.booking_code          AS "bookingCode",
        b.id                    AS "bookingId",
        b.origin_stop_id        AS "originStopId",
        b.destination_stop_id   AS "destinationStopId",
        b.origin_seq            AS "originSeq",
        b.destination_seq       AS "destinationSeq",
        os.name                 AS "originStopName",
        ds.name                 AS "destinationStopName"
      FROM ${passengers} p
      INNER JOIN ${bookings} b ON b.id = p.booking_id
      LEFT JOIN ${stops} os ON os.id = b.origin_stop_id
      LEFT JOIN ${stops} ds ON ds.id = b.destination_stop_id
      WHERE b.trip_id = ${tripId}
        AND b.status NOT IN ('canceled', 'refunded')
        AND COALESCE(p.ticket_status, 'active') NOT IN ('canceled', 'refunded', 'unseated')
      ORDER BY p.full_name ASC
    `);
    return rows.rows as any[];
  }

  async getUnseatedPassengers(tripId: string): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.full_name             AS "fullName",
        p.phone,
        p.ticket_number         AS "ticketNumber",
        p.fare_amount           AS "fareAmount",
        b.booking_code          AS "bookingCode",
        b.id                    AS "bookingId",
        os.name                 AS "originStopName",
        ds.name                 AS "destinationStopName"
      FROM ${passengers} p
      INNER JOIN ${bookings} b ON b.id = p.booking_id
      LEFT JOIN ${stops} os ON os.id = b.origin_stop_id
      LEFT JOIN ${stops} ds ON ds.id = b.destination_stop_id
      WHERE b.trip_id = ${tripId}
        AND b.status NOT IN ('canceled', 'refunded')
        AND COALESCE(p.ticket_status, 'active') = 'unseated'
      ORDER BY p.full_name ASC
    `);
    return rows.rows as any[];
  }

  async getPayments(bookingId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.bookingId, bookingId));
  }

  async getPaymentsByBookingIds(bookingIds: string[]): Promise<Payment[]> {
    if (bookingIds.length === 0) return [];
    return await db.select().from(payments).where(inArray(payments.bookingId, bookingIds));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(data).returning();
    return payment;
  }

  async createPrintJob(data: InsertPrintJob): Promise<PrintJob> {
    const [printJob] = await db.insert(printJobs).values(data).returning();
    return printJob;
  }
}
