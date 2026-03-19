import { IStorage } from "../../routes";
import { db } from "../../db";
import { bookings, passengers } from "@shared/schema";
import { eq } from "drizzle-orm";

export class PrintService {
  constructor() {}

  async generatePrintPayload(bookingId: string): Promise<any> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    const ticketList = await db.select().from(passengers).where(eq(passengers.bookingId, bookingId));

    const bookingRef = booking?.bookingCode ?? bookingId.slice(-8).toUpperCase();

    return {
      bookingId,
      bookingCode: bookingRef,
      type: "ticket",
      format: "thermal_80mm",
      content: {
        header: "TransityCore",
        bookingRef,
        tickets: ticketList.map(p => ({
          ticketNumber: p.ticketNumber,
          passengerName: p.fullName,
          seatNo: p.seatNo,
          fare: p.fareAmount
        })),
        timestamp: new Date().toISOString(),
        note: "Simpan tiket ini untuk perjalanan Anda"
      },
      printer: {
        profile: "default",
        copies: 1
      }
    };
  }
}
