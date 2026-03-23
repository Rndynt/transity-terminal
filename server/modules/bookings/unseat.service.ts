import { db } from "../../db";
import { bookings, passengers, seatInventory, bookingHistory } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { webSocketService } from "../../realtime/ws";
import { IStorage } from "../../storage.interface";
import { generateBookingCode } from "../../utils/codeGenerator";

function getLegIndexes(originSeq: number, destinationSeq: number): number[] {
  const legs: number[] = [];
  for (let i = originSeq; i < destinationSeq; i++) legs.push(i);
  return legs;
}

export class UnseatService {
  constructor(private storage: IStorage) {}

  async unseatPassenger(
    passengerId: string,
    performedBy: string,
    reason?: string
  ): Promise<{ success: boolean; booking: any; passenger: any }> {
    const passenger = await db.select().from(passengers).where(eq(passengers.id, passengerId)).then(r => r[0]);
    if (!passenger) throw new Error("Penumpang tidak ditemukan");
    if (passenger.ticketStatus === 'unseated' || passenger.ticketStatus === 'canceled') {
      throw new Error("Penumpang sudah di-unseat atau dibatalkan");
    }

    const booking = await this.storage.getBookingById(passenger.bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updatedP] = await tx.update(passengers)
        .set({ ticketStatus: 'unseated' })
        .where(eq(passengers.id, passengerId))
        .returning();

      await tx.update(seatInventory)
        .set({ booked: false, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, booking.tripId),
          eq(seatInventory.seatNo, passenger.seatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId: passengerId,
        action: 'unseated',
        details: {
          seatNo: passenger.seatNo,
          reason: reason || 'Manual unseat',
          previousStatus: passenger.ticketStatus
        },
        performedBy
      });

      const allPassengers = await tx.select().from(passengers).where(eq(passengers.bookingId, booking.id));
      const allUnseatedOrCanceled = allPassengers.every(
        p => p.ticketStatus === 'unseated' || p.ticketStatus === 'canceled'
      );
      if (allUnseatedOrCanceled) {
        await tx.update(bookings)
          .set({ status: 'unseated' })
          .where(eq(bookings.id, booking.id));
      }

      return updatedP;
    });

    for (const legIdx of legIndexes) {
      webSocketService.emitInventoryUpdated(booking.tripId, passenger.seatNo, [legIdx]);
    }

    return {
      success: true,
      booking: await this.storage.getBookingById(booking.id),
      passenger: updatedPassenger
    };
  }

  async unseatAllPassengers(
    bookingId: string,
    performedBy: string,
    reason?: string
  ): Promise<{ success: boolean; booking: any }> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const paxList = await this.storage.getPassengers(bookingId);
    const activePax = paxList.filter(p => p.ticketStatus !== 'unseated' && p.ticketStatus !== 'canceled');
    if (activePax.length === 0) throw new Error("Tidak ada penumpang aktif untuk di-unseat");

    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    await db.transaction(async (tx) => {
      for (const p of activePax) {
        await tx.update(passengers)
          .set({ ticketStatus: 'unseated' })
          .where(eq(passengers.id, p.id));

        await tx.update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            eq(seatInventory.seatNo, p.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        await tx.insert(bookingHistory).values({
          bookingId: booking.id,
          passengerId: p.id,
          action: 'unseated',
          details: {
            seatNo: p.seatNo,
            reason: reason || 'Unseat all passengers',
            previousStatus: p.ticketStatus
          },
          performedBy
        });
      }

      await tx.update(bookings)
        .set({ status: 'unseated' })
        .where(eq(bookings.id, booking.id));
    });

    for (const p of activePax) {
      for (const legIdx of legIndexes) {
        webSocketService.emitInventoryUpdated(booking.tripId, p.seatNo, [legIdx]);
      }
    }

    return {
      success: true,
      booking: await this.storage.getBookingById(booking.id)
    };
  }


  async reschedulePassenger(
    passengerId: string,
    newTripId: string,
    newSeatNo: string,
    newOriginStopId: string,
    newDestinationStopId: string,
    newOriginSeq: number,
    newDestinationSeq: number,
    performedBy: string,
    reason?: string
  ): Promise<{ success: boolean; oldBooking: any; newBooking: any }> {
    const passenger = await db.select().from(passengers).where(eq(passengers.id, passengerId)).then(r => r[0]);
    if (!passenger) throw new Error("Penumpang tidak ditemukan");
    if (passenger.ticketStatus === 'unseated' || passenger.ticketStatus === 'canceled') {
      throw new Error("Penumpang sudah di-unseat atau dibatalkan, tidak bisa di-reschedule");
    }

    const booking = await this.storage.getBookingById(passenger.bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const oldTripId = booking.tripId;
    const oldSeatNo = passenger.seatNo;
    const oldLegIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);
    const newLegIndexes = getLegIndexes(newOriginSeq, newDestinationSeq);

    const newSeatAvailability = await db.select().from(seatInventory)
      .where(and(
        eq(seatInventory.tripId, newTripId),
        eq(seatInventory.seatNo, newSeatNo),
        inArray(seatInventory.legIndex, newLegIndexes)
      ));

    if (newSeatAvailability.length === 0) {
      throw new Error("Inventori kursi trip baru belum diinisialisasi");
    }

    const isAvailable = newSeatAvailability.every(s => !s.booked && !s.holdRef);
    if (!isAvailable) {
      throw new Error(`Kursi ${newSeatNo} di trip baru tidak tersedia`);
    }

    const allPax = await db.select().from(passengers).where(eq(passengers.bookingId, booking.id));
    const activeSiblings = allPax.filter(
      p => p.id !== passengerId && p.ticketStatus !== 'unseated' && p.ticketStatus !== 'canceled'
    );
    const isSoleActivePassenger = activeSiblings.length === 0;
    const tripChanged = oldTripId !== newTripId;

    let resultBookingId = booking.id;

    await db.transaction(async (tx) => {
      await tx.update(seatInventory)
        .set({ booked: false, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, oldTripId),
          eq(seatInventory.seatNo, oldSeatNo),
          inArray(seatInventory.legIndex, oldLegIndexes)
        ));

      await tx.update(seatInventory)
        .set({ booked: true, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, newTripId),
          eq(seatInventory.seatNo, newSeatNo),
          inArray(seatInventory.legIndex, newLegIndexes)
        ));

      if (isSoleActivePassenger || !tripChanged) {
        await tx.update(passengers)
          .set({ seatNo: newSeatNo })
          .where(eq(passengers.id, passengerId));

        await tx.update(bookings)
          .set({
            tripId: newTripId,
            originStopId: newOriginStopId,
            destinationStopId: newDestinationStopId,
            originSeq: newOriginSeq,
            destinationSeq: newDestinationSeq,
          })
          .where(eq(bookings.id, booking.id));
      } else {
        const [newBooking] = await tx.insert(bookings).values({
          bookingCode: generateBookingCode(),
          tripId: newTripId,
          originStopId: newOriginStopId,
          destinationStopId: newDestinationStopId,
          originSeq: newOriginSeq,
          destinationSeq: newDestinationSeq,
          channel: booking.channel,
          outletId: booking.outletId,
          totalAmount: passenger.fareAmount,
          discountAmount: '0',
          currency: booking.currency || 'IDR',
          createdBy: performedBy,
          appUserId: booking.appUserId,
          status: booking.status === 'paid' ? 'paid' : 'confirmed',
        }).returning();

        resultBookingId = newBooking.id;

        await tx.update(passengers)
          .set({ seatNo: newSeatNo, bookingId: newBooking.id })
          .where(eq(passengers.id, passengerId));
      }

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId: passengerId,
        action: 'rescheduled',
        details: {
          oldTripId,
          oldSeatNo,
          oldOriginStopId: booking.originStopId,
          oldDestinationStopId: booking.destinationStopId,
          newTripId,
          newSeatNo,
          newOriginStopId,
          newDestinationStopId,
          newBookingId: resultBookingId !== booking.id ? resultBookingId : undefined,
          reason: reason || 'Reschedule'
        },
        performedBy
      });
    });

    for (const legIdx of oldLegIndexes) {
      webSocketService.emitInventoryUpdated(oldTripId, oldSeatNo, [legIdx]);
    }
    for (const legIdx of newLegIndexes) {
      webSocketService.emitInventoryUpdated(newTripId, newSeatNo, [legIdx]);
    }

    const updatedBooking = await this.storage.getBookingById(resultBookingId);
    return {
      success: true,
      oldBooking: updatedBooking,
      newBooking: updatedBooking
    };
  }

  async assignSeatToUnseated(
    passengerId: string,
    newSeatNo: string,
    performedBy: string
  ): Promise<{ success: boolean; passenger: any; booking: any }> {
    const passenger = await db.select().from(passengers).where(eq(passengers.id, passengerId)).then(r => r[0]);
    if (!passenger) throw new Error("Penumpang tidak ditemukan");
    if (passenger.ticketStatus !== 'unseated') {
      throw new Error("Hanya penumpang berstatus unseated yang bisa di-assign ulang");
    }

    const booking = await this.storage.getBookingById(passenger.bookingId);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    const newSeatAvailability = await db.select().from(seatInventory)
      .where(and(
        eq(seatInventory.tripId, booking.tripId),
        eq(seatInventory.seatNo, newSeatNo),
        inArray(seatInventory.legIndex, legIndexes)
      ));

    if (newSeatAvailability.length === 0) {
      throw new Error("Inventori kursi belum diinisialisasi untuk kursi ini");
    }

    if (newSeatAvailability.length !== legIndexes.length) {
      throw new Error("Inventori kursi tidak lengkap untuk semua leg rute");
    }

    const isAvailable = newSeatAvailability.every(s => !s.booked && !s.holdRef);
    if (!isAvailable) {
      throw new Error(`Kursi ${newSeatNo} tidak tersedia untuk semua leg rute ini`);
    }

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updatedP] = await tx.update(passengers)
        .set({ seatNo: newSeatNo, ticketStatus: 'active' })
        .where(eq(passengers.id, passengerId))
        .returning();

      await tx.update(seatInventory)
        .set({ booked: true, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, booking.tripId),
          eq(seatInventory.seatNo, newSeatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));

      const allPax = await tx.select().from(passengers).where(eq(passengers.bookingId, booking.id));
      const hasActivePax = allPax.some(p => p.ticketStatus === 'active');
      if (hasActivePax && booking.status === 'unseated') {
        const previousStatus = booking.status;
        const newStatus = 'paid';
        await tx.update(bookings)
          .set({ status: newStatus })
          .where(eq(bookings.id, booking.id));
      }

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId: passengerId,
        action: 'reassigned',
        details: {
          oldSeatNo: passenger.seatNo,
          newSeatNo,
          fromUnseated: true
        },
        performedBy
      });

      return updatedP;
    });

    for (const legIdx of legIndexes) {
      webSocketService.emitInventoryUpdated(booking.tripId, newSeatNo, [legIdx]);
    }

    return {
      success: true,
      passenger: updatedPassenger,
      booking: await this.storage.getBookingById(booking.id)
    };
  }

  async getBookingHistory(bookingId: string) {
    return await db.select().from(bookingHistory)
      .where(eq(bookingHistory.bookingId, bookingId))
      .orderBy(bookingHistory.createdAt);
  }
}
