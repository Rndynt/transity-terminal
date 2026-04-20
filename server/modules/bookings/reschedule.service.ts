import { db } from "@server/db";
import { bookings, passengers, seatInventory, bookingHistory } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";
import { IStorage } from "@server/storage.interface";
import { generateBookingCode } from "@server/utils/codeGenerator";

function getLegIndexes(originSeq: number, destinationSeq: number): number[] {
  const legs: number[] = [];
  for (let i = originSeq; i < destinationSeq; i++) legs.push(i);
  return legs;
}

export class RescheduleService {
  constructor(private storage: IStorage) {}

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
    if (passenger.ticketStatus === 'unseated' || passenger.ticketStatus === 'cancelled') {
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
      p => p.id !== passengerId && p.ticketStatus !== 'unseated' && p.ticketStatus !== 'cancelled'
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
          // Propagate identitas sales channel dari booking asal supaya laporan
          // per-OTA tetap konsisten setelah split akibat reschedule.
          salesChannelCode: booking.salesChannelCode,
          salesChannelName: booking.salesChannelName,
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

  async batchRescheduleForTripClose(
    oldTripId: string,
    newTripId: string,
    newOriginStopId: string,
    newDestinationStopId: string,
    newOriginSeq: number,
    newDestinationSeq: number,
    performedBy: string,
    reason: string
  ): Promise<{ succeeded: any[]; failed: any[] }> {
    const activePassengers = await this.storage.getActivePassengersForTrip(oldTripId);
    if (activePassengers.length === 0) {
      return { succeeded: [], failed: [] };
    }

    const newLegIndexes = getLegIndexes(newOriginSeq, newDestinationSeq);

    const availableSeats = await db.select()
      .from(seatInventory)
      .where(and(
        eq(seatInventory.tripId, newTripId),
        inArray(seatInventory.legIndex, newLegIndexes)
      ));

    const seatAvailabilityMap = new Map<string, { total: number; free: number }>();
    for (const row of availableSeats) {
      const entry = seatAvailabilityMap.get(row.seatNo) || { total: 0, free: 0 };
      entry.total++;
      if (!row.booked && !row.holdRef) entry.free++;
      seatAvailabilityMap.set(row.seatNo, entry);
    }

    const fullyAvailableSeats = Array.from(seatAvailabilityMap.entries())
      .filter(([, v]) => v.free === newLegIndexes.length)
      .map(([seatNo]) => seatNo)
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB || a.localeCompare(b);
      });

    const succeeded: any[] = [];
    const failed: any[] = [];
    let seatIdx = 0;

    const passengersByBooking = new Map<string, any[]>();
    for (const pax of activePassengers) {
      const arr = passengersByBooking.get(pax.bookingId) || [];
      arr.push(pax);
      passengersByBooking.set(pax.bookingId, arr);
    }

    for (const pax of activePassengers) {
      const preferredSeat = pax.seatNo;
      let targetSeat: string | null = null;

      if (fullyAvailableSeats.includes(preferredSeat)) {
        targetSeat = preferredSeat;
        fullyAvailableSeats.splice(fullyAvailableSeats.indexOf(preferredSeat), 1);
      } else if (seatIdx < fullyAvailableSeats.length) {
        targetSeat = fullyAvailableSeats[seatIdx];
        seatIdx++;
      }

      if (!targetSeat) {
        failed.push({ ...pax, failReason: 'Tidak ada kursi tersedia di trip tujuan' });
        continue;
      }

      try {
        const oldLegIndexes = getLegIndexes(pax.originSeq, pax.destinationSeq);

        await db.transaction(async (tx) => {
          await tx.update(seatInventory)
            .set({ booked: false, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, oldTripId),
              eq(seatInventory.seatNo, pax.seatNo),
              inArray(seatInventory.legIndex, oldLegIndexes)
            ));

          await tx.update(seatInventory)
            .set({ booked: true, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, newTripId),
              eq(seatInventory.seatNo, targetSeat!),
              inArray(seatInventory.legIndex, newLegIndexes)
            ));

          await tx.update(passengers)
            .set({ seatNo: targetSeat! })
            .where(eq(passengers.id, pax.id));

          const siblings = passengersByBooking.get(pax.bookingId) || [];
          const allSiblingsInBatch = siblings.every(s =>
            activePassengers.some(ap => ap.id === s.id)
          );

          if (allSiblingsInBatch) {
            await tx.update(bookings)
              .set({
                tripId: newTripId,
                originStopId: newOriginStopId,
                destinationStopId: newDestinationStopId,
                originSeq: newOriginSeq,
                destinationSeq: newDestinationSeq,
              })
              .where(eq(bookings.id, pax.bookingId));
          } else {
            const oldBooking = await this.storage.getBookingById(pax.bookingId);
            const [newBooking] = await tx.insert(bookings).values({
              bookingCode: generateBookingCode(),
              tripId: newTripId,
              originStopId: newOriginStopId,
              destinationStopId: newDestinationStopId,
              originSeq: newOriginSeq,
              destinationSeq: newDestinationSeq,
              channel: oldBooking?.channel || 'CSO',
              outletId: oldBooking?.outletId,
              totalAmount: pax.fareAmount,
              discountAmount: '0',
              currency: oldBooking?.currency || 'IDR',
              createdBy: performedBy,
              // Propagate identitas sales channel dari booking asal supaya laporan
              // per-OTA tetap konsisten setelah batch reschedule.
              salesChannelCode: oldBooking?.salesChannelCode,
              salesChannelName: oldBooking?.salesChannelName,
              appUserId: oldBooking?.appUserId,
              status: oldBooking?.status === 'paid' ? 'paid' : 'confirmed',
            }).returning();

            await tx.update(passengers)
              .set({ bookingId: newBooking.id })
              .where(eq(passengers.id, pax.id));
          }

          await tx.insert(bookingHistory).values({
            bookingId: pax.bookingId,
            passengerId: pax.id,
            action: 'rescheduled',
            details: {
              oldTripId,
              oldSeatNo: pax.seatNo,
              newTripId,
              newSeatNo: targetSeat,
              newOriginStopId,
              newDestinationStopId,
              batchReschedule: true,
              initiatedBy: 'operator',
              reason,
            },
            performedBy,
          });
        });

        const oldLegIdx = getLegIndexes(pax.originSeq, pax.destinationSeq);
        for (const legIdx of oldLegIdx) {
          webSocketService.emitInventoryUpdated(oldTripId, pax.seatNo, [legIdx]);
        }
        for (const legIdx of newLegIndexes) {
          webSocketService.emitInventoryUpdated(newTripId, targetSeat, [legIdx]);
        }

        succeeded.push({ ...pax, newSeatNo: targetSeat });
      } catch (err) {
        failed.push({ ...pax, failReason: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return { succeeded, failed };
  }
}
