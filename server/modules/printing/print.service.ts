import { IStorage } from "@server/storage.interface";
import { db } from "@server/db";
import { bookings, passengers } from "@shared/schema";
import { eq } from "drizzle-orm";

export class PrintService {
  constructor() {}

  async generatePrintPayload(bookingId: string): Promise<{
    bookingId: string;
    bookingCode: string;
    type: string;
    format: string;
    content: {
      header: string;
      bookingRef: string;
      tickets: Array<{ ticketNumber: string | null; passengerName: string; seatNo: string; fare: string | null }>;
      timestamp: string;
      note: string;
    };
    printer: { profile: string; copies: number };
  }> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    const ticketList = await db.select().from(passengers).where(eq(passengers.bookingId, bookingId));

    const bookingRef = booking?.bookingCode ?? bookingId.slice(-8).toUpperCase();

    return {
      bookingId,
      bookingCode: bookingRef,
      type: "ticket",
      format: "thermal_80mm",
      content: {
        header: "TransityTerminal",
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
