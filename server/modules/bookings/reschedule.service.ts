import { db } from "@server/db";
import { bookings, passengers, seatInventory, bookingHistory } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";
import { IStorage, type ActivePassengerForTrip } from "@server/storage.interface";
import { generateBookingCode } from "@server/utils/codeGenerator";
import { HoldsAdapter, isEngineEnabled } from "@modules/holds/holdsAdapter";
import { AtomicHoldService } from "./atomicHold.service";
import { assertTripBookable } from "./booking.helpers";
import { enqueueCancelSeats } from "@modules/holds/compensationQueue";
import { randomUUID } from "node:crypto";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import { createComponentLogger } from "@server/lib/logger";

const log = createComponentLogger("reschedule.service");

/**
 * S1-09 (Sprint 2): operasi reschedule berisiko ganti kursi & buat
 * booking baru, jadi tetap di-guard di service-layer.
 *   - reschedulePassenger        → `action.passenger.reschedule`
 *   - batchRescheduleForTripClose → `action.trip.batch_reschedule`
 */

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
    reason: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; oldBooking: typeof bookings.$inferSelect; newBooking: typeof bookings.$inferSelect }> {
    requirePermission(ctx, "action.passenger.reschedule");
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

    // Target trip must actually be open for reservations — otherwise a
    // passenger could be "rescheduled into" a trip that's already been
    // closed or cancelled.
    await assertTripBookable(this.storage, newTripId);

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

    // Engine mode: book the new seat (hold→confirm) BEFORE the local tx, so
    // the engine owns the inventory write. We pre-generate the new booking
    // ID if the reschedule will split into a new booking, so the engine
    // confirm can carry the canonical id forward. Old seat is freed AFTER
    // the local tx commits (so a tx-fail compensation only has to revert
    // the new seat, not also re-book the old one).
    const engineMode = isEngineEnabled();
    const engineOperatorId = booking.createdBy || performedBy;
    const willSplit = !(isSoleActivePassenger || !tripChanged);
    const preGenNewBookingId = engineMode && willSplit ? randomUUID() : undefined;
    let engineNewSeatBooked = false;
    if (engineMode) {
      const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
      await adapter.holdAndConfirmShort({
        bookingId: preGenNewBookingId ?? booking.id,
        tripId: newTripId,
        seatNo: newSeatNo,
        legIndexes: newLegIndexes,
        operatorId: engineOperatorId,
      });
      engineNewSeatBooked = true;
    }

    try {
    await db.transaction(async (tx) => {
      // Inventory writes are owned by the engine when the flag is on.
      if (!engineMode) {
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
      }

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
          ...(preGenNewBookingId ? { id: preGenNewBookingId } : {}),
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
    } catch (err) {
      // Local tx failed AFTER we already booked the new seat in the engine.
      // Compensate by freeing the new seat so it doesn't leak. If the
      // compensating engine call ALSO fails (rare double-failure), enqueue
      // it so the scheduler retries — never give up silently.
      if (engineMode && engineNewSeatBooked) {
        const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
        try {
          await adapter.cancelSeats({
            tripId: newTripId,
            seatNo: newSeatNo,
            legIndexes: newLegIndexes,
          });
        } catch (e) {
          log.error({ err: e, op: "reschedule", tripId: newTripId }, "compensation cancelSeats(new) failed, enqueuing");
          
          await enqueueCancelSeats({
            tripId: newTripId,
            seatNo: newSeatNo,
            legIndexes: newLegIndexes,
            context: { source: 'reschedulePassenger.compensation', passengerId, originalBookingId: booking.id },
          });
        }
      }
      throw err;
    }

    // Engine mode: now that the local state is consistent with the new
    // booking, free the OLD seat in the engine. If this fails, enqueue it
    // for asynchronous retry — the reschedule itself is already complete
    // on TT side and we do not want to roll the new seat back.
    if (engineMode) {
      const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
      try {
        await adapter.cancelSeats({
          tripId: oldTripId,
          seatNo: oldSeatNo,
          legIndexes: oldLegIndexes,
        });
      } catch (e) {
        log.error({ err: e, op: "reschedule", tripId: oldTripId }, "engine cancelSeats(old) failed, enqueuing for retry");
        
        await enqueueCancelSeats({
          tripId: oldTripId,
          seatNo: oldSeatNo,
          legIndexes: oldLegIndexes,
          context: { source: 'reschedulePassenger.cancelOld', passengerId, originalBookingId: booking.id },
        });
      }
    }

    // In engine mode the adapter.cancelSeats() and holdAndConfirmShort()
    // calls already emitted per-seat inventory events. Skip the duplicate
    // caller-side broadcast to keep WS traffic lean.
    if (!engineMode) {
      for (const legIdx of oldLegIndexes) {
        webSocketService.emitInventoryUpdated(oldTripId, oldSeatNo, [legIdx]);
      }
      for (const legIdx of newLegIndexes) {
        webSocketService.emitInventoryUpdated(newTripId, newSeatNo, [legIdx]);
      }
    }

    const updatedBooking = await this.storage.getBookingById(resultBookingId);
    if (!updatedBooking) {
      throw new Error("Booking tidak ditemukan setelah reschedule");
    }
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
    reason: string,
    ctx: ServiceContext
  ): Promise<{ succeeded: Array<ActivePassengerForTrip & { newSeatNo: string }>; failed: Array<ActivePassengerForTrip & { failReason: string }> }> {
    requirePermission(ctx, "action.trip.batch_reschedule");
    const activePassengers = await this.storage.getActivePassengersForTrip(oldTripId);
    if (activePassengers.length === 0) {
      return { succeeded: [], failed: [] };
    }

    // Destination trip must be open — don't let a batch-reschedule (as
    // part of closing the old trip) dump passengers onto another trip
    // that's itself already closed/cancelled.
    await assertTripBookable(this.storage, newTripId);

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

    const succeeded: Array<ActivePassengerForTrip & { newSeatNo: string }> = [];
    const failed: Array<ActivePassengerForTrip & { failReason: string }> = [];
    let seatIdx = 0;

    const passengersByBooking = new Map<string, ActivePassengerForTrip[]>();
    for (const pax of activePassengers) {
      const arr = passengersByBooking.get(pax.bookingId) || [];
      arr.push(pax);
      passengersByBooking.set(pax.bookingId, arr);
    }

    for (const pax of activePassengers) {
      // Active (non-unseated) passengers always have a seat; the storage
      // contract returns `seatNo: string | null` because the column is
      // nullable, but the SQL filter excludes unseated tickets.
      const preferredSeat = pax.seatNo!;
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

        // Engine mode: book the new seat (hold→confirm) BEFORE the local
        // tx, on a per-pax basis. We pre-decide whether this pax will keep
        // its existing booking row or land on a freshly-split one so the
        // engine confirm carries the right canonical booking_id. Old seat
        // is freed AFTER the local tx commits; failures are logged.
        const engineMode = isEngineEnabled();
        const siblingsForPax = passengersByBooking.get(pax.bookingId) || [];
        const allSiblingsInBatchForPax = siblingsForPax.every(s =>
          activePassengers.some(ap => ap.id === s.id),
        );
        const willSplit = !allSiblingsInBatchForPax;
        const preGenSplitBookingId =
          engineMode && willSplit ? randomUUID() : undefined;
        let engineNewBooked = false;
        if (engineMode) {
          const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
          await adapter.holdAndConfirmShort({
            bookingId: preGenSplitBookingId ?? pax.bookingId,
            tripId: newTripId,
            seatNo: targetSeat!,
            legIndexes: newLegIndexes,
            operatorId: performedBy,
          });
          engineNewBooked = true;
        }

        try {
        await db.transaction(async (tx) => {
          if (!engineMode) {
            await tx.update(seatInventory)
              .set({ booked: false, holdRef: null })
              .where(and(
                eq(seatInventory.tripId, oldTripId),
                eq(seatInventory.seatNo, preferredSeat),
                inArray(seatInventory.legIndex, oldLegIndexes)
              ));

            await tx.update(seatInventory)
              .set({ booked: true, holdRef: null })
              .where(and(
                eq(seatInventory.tripId, newTripId),
                eq(seatInventory.seatNo, targetSeat!),
                inArray(seatInventory.legIndex, newLegIndexes)
              ));
          }

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
              ...(preGenSplitBookingId ? { id: preGenSplitBookingId } : {}),
              bookingCode: generateBookingCode(),
              tripId: newTripId,
              originStopId: newOriginStopId,
              destinationStopId: newDestinationStopId,
              originSeq: newOriginSeq,
              destinationSeq: newDestinationSeq,
              channel: oldBooking?.channel || 'CSO',
              outletId: oldBooking?.outletId,
              totalAmount: pax.fareAmount ?? '0',
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
        } catch (txErr) {
          // Compensate: free the new seat we already booked in the engine.
          // Enqueue if even the compensating call fails so the scheduler
          // can drain it later.
          if (engineMode && engineNewBooked) {
            const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
            try {
              await adapter.cancelSeats({
                tripId: newTripId,
                seatNo: targetSeat!,
                legIndexes: newLegIndexes,
              });
            } catch (e) {
              log.error({ err: e, op: "rescheduleBatch", tripId: newTripId }, "compensation cancelSeats(new) failed, enqueuing");
              
              await enqueueCancelSeats({
                tripId: newTripId,
                seatNo: targetSeat!,
                legIndexes: newLegIndexes,
                context: { source: 'batchReschedule.compensation', passengerId: pax.id },
              });
            }
          }
          throw txErr;
        }

        // Engine mode: free the old seat after tx commit. On failure,
        // enqueue for scheduler retry (do not roll back the new seat).
        if (engineMode) {
          const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
          try {
            await adapter.cancelSeats({
              tripId: oldTripId,
              seatNo: preferredSeat,
              legIndexes: oldLegIndexes,
            });
          } catch (e) {
            log.error(
              { err: e, op: "rescheduleBatch", paxId: pax.id, tripId: oldTripId },
              "engine cancelSeats(old) failed, enqueuing"
            );
            
            await enqueueCancelSeats({
              tripId: oldTripId,
              seatNo: preferredSeat,
              legIndexes: oldLegIndexes,
              context: { source: 'batchReschedule.cancelOld', passengerId: pax.id },
            });
          }
        }

        // Adapter already emitted per-seat WS events in engine mode.
        if (!engineMode) {
          const oldLegIdx = getLegIndexes(pax.originSeq, pax.destinationSeq);
          for (const legIdx of oldLegIdx) {
            webSocketService.emitInventoryUpdated(oldTripId, preferredSeat, [legIdx]);
          }
          for (const legIdx of newLegIndexes) {
            webSocketService.emitInventoryUpdated(newTripId, targetSeat, [legIdx]);
          }
        }

        succeeded.push({ ...pax, newSeatNo: targetSeat });
      } catch (err) {
        failed.push({ ...pax, failReason: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return { succeeded, failed };
  }
}
