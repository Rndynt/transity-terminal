import { db } from "@server/db";
import { bookings, passengers, seatInventory, bookingHistory } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";
import { IStorage } from "@server/storage.interface";

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
    if (passenger.ticketStatus === 'unseated' || passenger.ticketStatus === 'cancelled') {
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

      // Engine mode: defer the seat release to AFTER tx commit; the engine
      // owns inventory writes and runs its own tx. Flag-off mode keeps the
      // legacy inline SQL inside the outer tx for unchanged behavior.
      const { isEngineEnabled } = await import("@modules/holds/holdsAdapter");
      if (!isEngineEnabled()) {
        await tx.update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            eq(seatInventory.seatNo, passenger.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));
      }

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
        p => p.ticketStatus === 'unseated' || p.ticketStatus === 'cancelled'
      );
      if (allUnseatedOrCanceled) {
        await tx.update(bookings)
          .set({ status: 'unseated' })
          .where(eq(bookings.id, booking.id));
      }

      return updatedP;
    });

    // Engine mode: now that the local booking-state tx is committed, ask
    // the engine to release the seat back to inventory. On failure,
    // enqueue for asynchronous retry — the unseat is already done on TT
    // side and we don't want to roll it back.
    let engineModeUnseat = false;
    {
      const { isEngineEnabled, HoldsAdapter } = await import("@modules/holds/holdsAdapter");
      engineModeUnseat = isEngineEnabled();
      if (engineModeUnseat) {
        const { AtomicHoldService } = await import("./atomicHold.service");
        const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
        try {
          await adapter.cancelSeats({
            tripId: booking.tripId,
            seatNo: passenger.seatNo,
            legIndexes,
          });
        } catch (e) {
          console.error('[UNSEAT] engine cancelSeats failed, enqueuing:', e);
          const { enqueueCancelSeats } = await import("@modules/holds/compensationQueue");
          await enqueueCancelSeats({
            tripId: booking.tripId,
            seatNo: passenger.seatNo,
            legIndexes,
            context: { source: 'unseatPassenger', passengerId, bookingId: booking.id },
          });
        }
      }
    }

    // Adapter.cancelSeats already emitted per-seat WS in engine mode.
    if (!engineModeUnseat) {
      for (const legIdx of legIndexes) {
        webSocketService.emitInventoryUpdated(booking.tripId, passenger.seatNo, [legIdx]);
      }
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
    const activePax = paxList.filter(p => p.ticketStatus !== 'unseated' && p.ticketStatus !== 'cancelled');
    if (activePax.length === 0) throw new Error("Tidak ada penumpang aktif untuk di-unseat");

    const legIndexes = getLegIndexes(booking.originSeq, booking.destinationSeq);

    await db.transaction(async (tx) => {
      for (const p of activePax) {
        await tx.update(passengers)
          .set({ ticketStatus: 'unseated' })
          .where(eq(passengers.id, p.id));

        // See comment in unseatPassenger() about engine-mode deferral.
        const { isEngineEnabled } = await import("@modules/holds/holdsAdapter");
        if (!isEngineEnabled()) {
          await tx.update(seatInventory)
            .set({ booked: false, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              eq(seatInventory.seatNo, p.seatNo),
              inArray(seatInventory.legIndex, legIndexes)
            ));
        }

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

    // Engine mode: per-seat cancel after tx commit. Engine endpoint is
    // per-seat only, so we iterate. Each failure is enqueued for the
    // scheduler so a transient engine outage cannot leak seats.
    let engineModeBatch = false;
    {
      const { isEngineEnabled, HoldsAdapter } = await import("@modules/holds/holdsAdapter");
      engineModeBatch = isEngineEnabled();
      if (engineModeBatch) {
        const { AtomicHoldService } = await import("./atomicHold.service");
        const { enqueueCancelSeats } = await import("@modules/holds/compensationQueue");
        const adapter = new HoldsAdapter(new AtomicHoldService(this.storage));
        for (const p of activePax) {
          try {
            await adapter.cancelSeats({
              tripId: booking.tripId,
              seatNo: p.seatNo,
              legIndexes,
            });
          } catch (e) {
            console.error(`[UNSEAT] engine cancelSeats failed for seat ${p.seatNo}, enqueuing:`, e);
            await enqueueCancelSeats({
              tripId: booking.tripId,
              seatNo: p.seatNo,
              legIndexes,
              context: { source: 'unseatAllPassengers', passengerId: p.id, bookingId: booking.id },
            });
          }
        }
      }
    }

    // Adapter already emitted per-seat WS in engine mode.
    if (!engineModeBatch) {
      for (const p of activePax) {
        for (const legIdx of legIndexes) {
          webSocketService.emitInventoryUpdated(booking.tripId, p.seatNo, [legIdx]);
        }
      }
    }

    return {
      success: true,
      booking: await this.storage.getBookingById(booking.id)
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
