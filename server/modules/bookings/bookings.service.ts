import { IStorage } from "@server/storage.interface";
import { InsertBooking, Booking } from "@shared/schema";
import { HoldsService } from "@modules/holds/holds.service";
import { AtomicHoldService } from "./atomicHold.service";
import { HoldsAdapter, isEngineEnabled } from "@modules/holds/holdsAdapter";
import { randomUUID } from "node:crypto";
import { PrintService } from "@modules/printing/print.service";
import { db } from "@server/db";
import { bookings as bookingsTable, payments as paymentsTable, printJobs as printJobsTable, seatHolds, seatInventory, promotions as promotionsTable, vouchers as vouchersTable, bookingPromoApplications as bookingPromoApplicationsTable } from "@shared/schema";
import { eq, and, inArray, gt, lt, sql, not } from "drizzle-orm";
import { webSocketService } from "@server/realtime/ws";
import {
  computeLegIndexes,
  fetchBookingSnapshots,
  insertPassengerRows,
  validateBoardingAlighting,
  validateHoldOwnership,
  confirmSeatsBooked,
  calculateBookingTotal,
  generateBookingCode,
} from "./booking.helpers";

export class BookingsService {
  private holdsService: HoldsService;
  private atomicHoldService: AtomicHoldService;
  private holdsAdapter: HoldsAdapter;
  private printService: PrintService;

  constructor(private storage: IStorage) {
    this.holdsService = new HoldsService();
    this.atomicHoldService = new AtomicHoldService(storage);
    this.holdsAdapter = new HoldsAdapter(this.atomicHoldService);
    this.printService = new PrintService();
  }

  async getAllBookings(tripId?: string): Promise<Booking[]> {
    return await this.storage.getBookings(tripId);
  }

  async getBookingsPaginated(options: { tripId?: string; outletId?: string; page: number; pageSize: number }): Promise<{ data: Booking[]; total: number }> {
    return await this.storage.getBookingsPaginated(options);
  }

  async getBookingById(id: string): Promise<Booking & { passengers?: any[]; payments?: any[]; tripDetails?: any; originStop?: any; destinationStop?: any; outlet?: any; vehicle?: any; departAt?: any; arriveAt?: any; promoApplications?: any[] }> {
    const booking = await this.storage.getBookingById(id);
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`);
    }
    
    const [passengers, payments, trip, tripStopTimes, originStop, destinationStop, outlet, promoApplications] = await Promise.all([
      this.storage.getPassengers(booking.id),
      this.storage.getPayments(booking.id),
      this.storage.getTripById(booking.tripId),
      this.storage.getTripStopTimes(booking.tripId),
      booking.originStopId ? this.storage.getStopById(booking.originStopId) : null,
      booking.destinationStopId ? this.storage.getStopById(booking.destinationStopId) : null,
      booking.outletId ? this.storage.getOutletById(booking.outletId) : null,
      this.storage.getBookingPromoApplicationsWithName(booking.id),
    ]);
    
    const vehicle = trip?.vehicleId ? await this.storage.getVehicleById(trip.vehicleId) : null;

    let departAt = null;
    let arriveAt = null;
    if (tripStopTimes) {
      if (booking.originSeq) {
        const originTime = tripStopTimes.find(st => st.stopSequence === booking.originSeq);
        if (originTime?.departAt) departAt = originTime.departAt;
      }
      if (booking.destinationSeq) {
        const destTime = tripStopTimes.find(st => st.stopSequence === booking.destinationSeq);
        if (destTime?.arriveAt) arriveAt = destTime.arriveAt;
      }
    }
    
    return {
      ...booking,
      passengers: passengers || [],
      payments: payments || [],
      tripDetails: trip,
      originStop,
      destinationStop,
      outlet,
      vehicle,
      departAt,
      arriveAt,
      // Daftar promo yang diterapkan ke booking ini (sudah join nama promo).
      // UI sebaiknya menampilkan `promoName` saja, bukan `promoCode`.
      promoApplications: (promoApplications || []).map(a => ({
        promoName: a.promoName,
        source: a.source as 'auto' | 'manual',
        discountAmount: Number(a.discountAmount),
        voucherCode: a.voucherCode,
      })),
    };
  }

  async createBooking(
    bookingData: InsertBooking,
    passengers: { fullName: string; phone?: string; idNumber?: string; seatNo: string }[],
    payment: { method: 'cash' | 'qr' | 'ewallet' | 'bank'; amount: number },
    idempotencyKey?: string,
    promoCode?: string
  ): Promise<{ booking: Booking; printPayload: any }> {

    // B1: Idempotency — if same key was already used, return the existing booking
    // unchanged. This protects against double-charge from network retries.
    if (idempotencyKey) {
      const [existing] = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing) {
        const bookingWithRelations = await this.getBookingById(existing.id);
        const printPayload = await this.printService.generatePrintPayload(existing.id);
        return { booking: bookingWithRelations, printPayload };
      }
    }

    const legIndexes = computeLegIndexes(bookingData.originSeq, bookingData.destinationSeq);
    const operatorId = bookingData.createdBy || 'default-operator';
    const seatNos = passengers.map(p => p.seatNo);

    const [,, { fareQuote, total: expectedTotal, promo }, snapshots] = await Promise.all([
      validateBoardingAlighting(this.storage, bookingData.tripId, bookingData.originSeq, bookingData.destinationSeq),
      validateHoldOwnership(bookingData.tripId, seatNos, legIndexes, operatorId),
      calculateBookingTotal(
        this.storage, bookingData.tripId, bookingData.originSeq, bookingData.destinationSeq,
        passengers.length, bookingData.channel || undefined, promoCode,
        bookingData.outletId || undefined, bookingData.salesChannelCode || undefined,
        { autoApplyIfNoCode: true }
      ),
      fetchBookingSnapshots(this.storage, bookingData.tripId, bookingData.originStopId, bookingData.destinationStopId, bookingData.outletId, bookingData.originSeq),
    ]);

    const paymentAmount = Number(payment.amount);
    if (Math.round(paymentAmount) !== Math.round(expectedTotal)) {
      throw new Error(`Payment amount ${paymentAmount} does not match expected total ${expectedTotal}`);
    }

    // Engine mode: pre-generate booking ID and confirm seats in the engine
    // BEFORE opening the local DB tx. The engine has its own DB tx and we
    // cannot compose them. If the engine confirm fails, we exit before any
    // TT state changes; if the local tx below later fails, we run a
    // best-effort compensating cancel-seats call (see catch block).
    const preGeneratedBookingId = isEngineEnabled() ? randomUUID() : undefined;
    let engineConfirmed: Array<{ seatNo: string; holdRef: string }> = [];
    if (preGeneratedBookingId) {
      engineConfirmed = await this.holdsAdapter.confirmForBooking({
        bookingId: preGeneratedBookingId,
        tripId: bookingData.tripId,
        seatNos,
        legIndexes,
        operatorId,
      });
    }

    let booking: Booking;
    try {
      booking = await db.transaction(async (tx) => {
      const [newBooking] = await tx.insert(bookingsTable).values({
        ...(preGeneratedBookingId ? { id: preGeneratedBookingId } : {}),
        ...bookingData,
        bookingCode: generateBookingCode(),
        status: 'paid',
        totalAmount: expectedTotal.toString(),
        discountAmount: promo.discountAmount.toString(),
        promoId: promo.promoId || null,
        voucherCode: promo.voucherCode || null,
        idempotencyKey: idempotencyKey || null,
        ...snapshots,
      }).returning();

      // Persist semua aplikasi promo (auto / manual / stacked)
      if (promo.applications && promo.applications.length > 0) {
        await tx.insert(bookingPromoApplicationsTable).values(
          promo.applications.map(a => ({
            bookingId: newBooking.id,
            promoId: a.promoId,
            promoCode: a.promoCode,
            voucherId: a.voucherId ?? null,
            voucherCode: a.voucherCode ?? null,
            source: a.source,
            discountAmount: a.discountAmount.toString(),
          }))
        );
      }

      await insertPassengerRows(tx, newBooking.id, passengers, fareQuote);
      // In engine mode, the engine already marked seats booked via
      // confirmForBooking() above. Skip the local SQL to avoid double-write.
      if (!preGeneratedBookingId) {
        await confirmSeatsBooked(tx, bookingData.tripId, seatNos, legIndexes, operatorId);
      }

      await tx.insert(paymentsTable).values({
        method: payment.method,
        amount: payment.amount.toString(),
        bookingId: newBooking.id
      });

      await tx.insert(printJobsTable).values({
        bookingId: newBooking.id,
        status: 'queued'
      });

      // Increment usage utk SETIAP applied promo + tandai voucher (jika ada)
      for (const app of (promo.applications ?? [])) {
        const [promoUpdate] = await tx.update(promotionsTable)
          .set({ usageCount: sql`${promotionsTable.usageCount} + 1` })
          .where(and(
            eq(promotionsTable.id, app.promoId),
            eq(promotionsTable.isActive, true),
            sql`(${promotionsTable.usageLimit} IS NULL OR ${promotionsTable.usageCount} < ${promotionsTable.usageLimit})`
          ))
          .returning({ id: promotionsTable.id });
        if (!promoUpdate) {
          throw new Error('Promo is no longer available or usage limit reached');
        }
        if (app.voucherId) {
          const [voucherUpdate] = await tx.update(vouchersTable)
            .set({ status: 'used', usedAt: new Date(), usedByBookingId: newBooking.id })
            .where(and(
              eq(vouchersTable.id, app.voucherId),
              eq(vouchersTable.status, 'active')
            ))
            .returning({ id: vouchersTable.id });
          if (!voucherUpdate) {
            throw new Error('Voucher is no longer available or already used');
          }
        }
      }

      return newBooking;
      });
    } catch (err: unknown) {
      // B1: race-loss path. If two concurrent requests with the same
      // idempotency key reach the INSERT at the same time, the loser will hit
      // the partial unique index `uniq_bookings_idempotency_key`. Recover by
      // returning the winner's booking instead of bubbling a generic 500.
      const dbErr = err as { code?: string; constraint?: string };
      if (
        idempotencyKey &&
        dbErr?.code === '23505' &&
        (dbErr?.constraint === 'uniq_bookings_idempotency_key' ||
          dbErr?.constraint?.includes('idempotency_key'))
      ) {
        const [existing] = await db
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.idempotencyKey, idempotencyKey))
          .limit(1);
        if (existing) {
          // Engine-mode race: we already confirmed seats in the engine but
          // the local insert lost the idempotency race. The winning request
          // holds the canonical seat→booking_id linkage in the engine; OUR
          // confirms point at a non-existent booking_id. Compensate by
          // freeing what we confirmed so the winner's seats remain intact.
          if (engineConfirmed.length > 0) {
            await this.holdsAdapter.compensateConfirms(
              bookingData.tripId,
              engineConfirmed,
              legIndexes,
            );
          }
          const bookingWithRelations = await this.getBookingById(existing.id);
          const printPayload = await this.printService.generatePrintPayload(existing.id);
          return { booking: bookingWithRelations, printPayload };
        }
      }
      // Any other tx failure with engine confirms in flight: compensate.
      if (engineConfirmed.length > 0) {
        await this.holdsAdapter.compensateConfirms(
          bookingData.tripId,
          engineConfirmed,
          legIndexes,
        );
      }
      throw err;
    }

    const bookingWithRelations = await this.getBookingById(booking.id);
    const printPayload = await this.printService.generatePrintPayload(booking.id);

    return { booking: bookingWithRelations, printPayload };
  }

  async createHold(
    tripId: string, 
    seatNo: string, 
    originSeq: number, 
    destinationSeq: number, 
    ttlSeconds: number = 300,
    operatorId: string = 'default-operator'
  ): Promise<{ ok: boolean; holdRef?: string; expiresAt?: number; ownedByYou?: boolean; reason?: string }> {
    const legIndexes = [];
    for (let i = originSeq; i < destinationSeq; i++) {
      legIndexes.push(i);
    }

    const ttlClass: 'short' | 'long' = ttlSeconds <= 600 ? 'short' : 'long';
    
    const result = await this.holdsAdapter.hold({
      tripId,
      seatNo,
      legIndexes,
      operatorId,
      ttlClass
    });

    // Convert result format to match expected response
    if (result.success) {
      return {
        ok: true,
        holdRef: result.holdRef,
        expiresAt: result.expiresAt?.getTime(),
        ownedByYou: true
      };
    } else {
      return {
        ok: false,
        reason: result.reason,
        ownedByYou: false
      };
    }
  }

  async isHoldOwner(holdRef: string, operatorId: string): Promise<{ exists: boolean; owned: boolean }> {
    const [hold] = await db
      .select({ operatorId: seatHolds.operatorId })
      .from(seatHolds)
      .where(eq(seatHolds.holdRef, holdRef));
    if (!hold) return { exists: false, owned: false };
    return { exists: true, owned: hold.operatorId === operatorId };
  }

  async releaseHold(holdRef: string): Promise<void> {
    await this.holdsAdapter.release(holdRef);
  }

  async createPendingBooking(
    bookingData: InsertBooking,
    passengers: { fullName: string; phone?: string; idNumber?: string; seatNo: string }[],
    operatorId: string
  ): Promise<{ booking: Booking; pendingExpiresAt: Date }> {
    const { getConfig } = await import("../../config");
    const config = getConfig();
    
    const legIndexes = computeLegIndexes(bookingData.originSeq, bookingData.destinationSeq);
    const seatNos = passengers.map(p => p.seatNo);

    await validateHoldOwnership(bookingData.tripId, seatNos, legIndexes, operatorId);

    const { fareQuote, total: expectedTotal, promo: pendingPromo } = await calculateBookingTotal(
      this.storage, bookingData.tripId, bookingData.originSeq, bookingData.destinationSeq,
      passengers.length, bookingData.channel || undefined, undefined,
      bookingData.outletId || undefined, bookingData.salesChannelCode || undefined,
      { autoApplyIfNoCode: true }
    );

    const now = new Date();
    const pendingExpiresAt = new Date(now.getTime() + (config.holdTtlLongSeconds * 1000));

    const snapshots = await fetchBookingSnapshots(this.storage, bookingData.tripId, bookingData.originStopId, bookingData.destinationStopId, bookingData.outletId, bookingData.originSeq);

    // Engine mode: confirm seats BEFORE the local tx (see createPaidBooking
    // for the full rationale). Pre-generate booking ID so engine and TT
    // agree on the canonical id.
    const preGeneratedPendingId = isEngineEnabled() ? randomUUID() : undefined;
    let pendingEngineConfirmed: Array<{ seatNo: string; holdRef: string }> = [];
    if (preGeneratedPendingId) {
      pendingEngineConfirmed = await this.holdsAdapter.confirmForBooking({
        bookingId: preGeneratedPendingId,
        tripId: bookingData.tripId,
        seatNos,
        legIndexes,
        operatorId,
      });
    }

    let booking;
    try {
      booking = await db.transaction(async (tx) => {
      const [newBooking] = await tx.insert(bookingsTable).values({
        ...(preGeneratedPendingId ? { id: preGeneratedPendingId } : {}),
        ...bookingData,
        bookingCode: generateBookingCode(),
        status: 'pending',
        totalAmount: expectedTotal.toString(),
        // Catat hasil auto-apply agar saat pay-later, promo + diskon tidak hilang
        discountAmount: (pendingPromo.discountAmount || 0).toString(),
        promoId: pendingPromo.promoId || null,
        voucherCode: pendingPromo.voucherCode || null,
        pendingExpiresAt,
        ...snapshots,
      }).returning();

      // Persist applications (tanpa increment usage — itu saat pay/confirm)
      if (pendingPromo.applications && pendingPromo.applications.length > 0) {
        await tx.insert(bookingPromoApplicationsTable).values(
          pendingPromo.applications.map(a => ({
            bookingId: newBooking.id,
            promoId: a.promoId,
            promoCode: a.promoCode,
            voucherId: a.voucherId ?? null,
            voucherCode: a.voucherCode ?? null,
            source: a.source,
            discountAmount: a.discountAmount.toString(),
          }))
        );
      }

      await insertPassengerRows(tx, newBooking.id, passengers, fareQuote);
      // Engine mode: seats already confirmed via confirmForBooking() above.
      if (!preGeneratedPendingId) {
        await confirmSeatsBooked(tx, bookingData.tripId, seatNos, legIndexes, operatorId);
      }

      return newBooking;
      });
    } catch (err) {
      if (pendingEngineConfirmed.length > 0) {
        await this.holdsAdapter.compensateConfirms(
          bookingData.tripId,
          pendingEngineConfirmed,
          legIndexes,
        );
      }
      throw err;
    }

    const bookingWithRelations = await this.getBookingById(booking.id);
    return { booking: bookingWithRelations, pendingExpiresAt };
  }

  async getPendingBookings(outletId?: string, operatorId?: string): Promise<Booking[]> {
    const now = new Date();
    const conditions = [
      eq(bookingsTable.status, 'pending'),
      gt(bookingsTable.pendingExpiresAt, now),
    ];

    if (outletId) {
      conditions.push(eq(bookingsTable.outletId, outletId));
    }
    if (operatorId) {
      conditions.push(eq(bookingsTable.createdBy, operatorId));
    }

    return await db.select().from(bookingsTable).where(and(...conditions));
  }

  async releasePendingBooking(bookingId: string, operatorId: string): Promise<void> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking with id ${bookingId} not found`);
    }

    if (booking.status !== 'pending') {
      throw new Error(`Booking ${bookingId} is not in pending status`);
    }

    const passengers = await this.storage.getPassengers(bookingId);
    const seatNos = passengers.map(p => p.seatNo);
    const legIndexes = computeLegIndexes(booking.originSeq, booking.destinationSeq);

    // Engine mode owns inventory writes — skip the inline SQL and let the
    // post-tx engine cancel-seats call handle the seat release per-seat.
    const engineMode = isEngineEnabled();

    await db.transaction(async (tx) => {
      if (!engineMode && seatNos.length > 0) {
        await tx
          .update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            inArray(seatInventory.seatNo, seatNos),
            inArray(seatInventory.legIndex, legIndexes)
          ));
      }

      await tx.update(bookingsTable)
        .set({ status: 'cancelled' })
        .where(eq(bookingsTable.id, bookingId));

      // S1-03: decrement promo usage + revert voucher saat pending → cancelled.
      // GREATEST guard supaya tidak negatif kalau race / belum sempat ter-increment.
      const apps = await tx.select().from(bookingPromoApplicationsTable)
        .where(eq(bookingPromoApplicationsTable.bookingId, bookingId));
      for (const app of apps) {
        await tx.update(promotionsTable)
          .set({ usageCount: sql`GREATEST(0, ${promotionsTable.usageCount} - 1)` })
          .where(eq(promotionsTable.id, app.promoId));
        if (app.voucherId) {
          await tx.update(vouchersTable)
            .set({ status: 'active', usedAt: null, usedByBookingId: null })
            .where(eq(vouchersTable.id, app.voucherId));
        }
      }
    });

    await this.holdsService.releaseHoldsByOwner(operatorId, bookingId);

    if (engineMode && seatNos.length > 0) {
      // Per-seat cancel via adapter; failures enqueue for scheduler retry
      // so a transient engine outage cannot leak seats from sale.
      const { enqueueCancelSeats } = await import('@modules/holds/compensationQueue');
      for (const passenger of passengers) {
        try {
          await this.holdsAdapter.cancelSeats({
            tripId: booking.tripId,
            seatNo: passenger.seatNo,
            legIndexes,
          });
        } catch (e) {
          console.error(
            `[RELEASE_PENDING] engine cancelSeats failed for ${passenger.seatNo}, enqueuing:`,
            e,
          );
          await enqueueCancelSeats({
            tripId: booking.tripId,
            seatNo: passenger.seatNo,
            legIndexes,
            context: { source: 'releasePendingBooking', bookingId, passengerId: passenger.id },
          });
        }
      }
    } else {
      // Adapter already emitted in engine path; only emit here for legacy.
      for (const passenger of passengers) {
        webSocketService.emitInventoryUpdated(booking.tripId, passenger.seatNo, legIndexes);
      }
    }
  }

  async cleanupExpiredPendingBookings(): Promise<void> {
    const now = new Date();

    const expiredPendingBookings = await db
      .select()
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.status, 'pending'),
        lt(bookingsTable.pendingExpiresAt, now),
        not(eq(bookingsTable.channel, 'OTA'))
      ));

    if (expiredPendingBookings.length === 0) return;

    const allPassengers = await this.storage.getPassengersByBookingIds(
      expiredPendingBookings.map(b => b.id)
    );
    const passengersByBooking = new Map<string, typeof allPassengers>();
    for (const p of allPassengers) {
      const list = passengersByBooking.get(p.bookingId) || [];
      list.push(p);
      passengersByBooking.set(p.bookingId, list);
    }

    const engineMode = isEngineEnabled();
    const enqueueCancel = engineMode
      ? (await import('@modules/holds/compensationQueue')).enqueueCancelSeats
      : null;

    for (const booking of expiredPendingBookings) {
      try {
        const bookingPassengers = passengersByBooking.get(booking.id) || [];
        const seatNos = bookingPassengers.map(p => p.seatNo);
        const legIndexes = computeLegIndexes(booking.originSeq, booking.destinationSeq);

        await db.transaction(async (tx) => {
          if (!engineMode && seatNos.length > 0) {
            // Engine owns inventory writes — see release path above.
            await tx
              .update(seatInventory)
              .set({ booked: false, holdRef: null })
              .where(and(
                eq(seatInventory.tripId, booking.tripId),
                inArray(seatInventory.seatNo, seatNos),
                inArray(seatInventory.legIndex, legIndexes)
              ));
          }

          await tx.update(bookingsTable)
            .set({ status: 'cancelled' })
            .where(eq(bookingsTable.id, booking.id));

          // S1-03: decrement promo usage + revert voucher pada cleanup expired.
          const apps = await tx.select().from(bookingPromoApplicationsTable)
            .where(eq(bookingPromoApplicationsTable.bookingId, booking.id));
          for (const app of apps) {
            await tx.update(promotionsTable)
              .set({ usageCount: sql`GREATEST(0, ${promotionsTable.usageCount} - 1)` })
              .where(eq(promotionsTable.id, app.promoId));
            if (app.voucherId) {
              await tx.update(vouchersTable)
                .set({ status: 'active', usedAt: null, usedByBookingId: null })
                .where(eq(vouchersTable.id, app.voucherId));
            }
          }
        });

        if (engineMode && seatNos.length > 0) {
          for (const passenger of bookingPassengers) {
            try {
              await this.holdsAdapter.cancelSeats({
                tripId: booking.tripId,
                seatNo: passenger.seatNo,
                legIndexes,
              });
            } catch (e) {
              console.error(
                `[CLEANUP] engine cancelSeats failed for booking=${booking.id} seat=${passenger.seatNo}, enqueuing:`,
                e,
              );
              await enqueueCancel!({
                tripId: booking.tripId,
                seatNo: passenger.seatNo,
                legIndexes,
                context: { source: 'cleanupExpiredPendingBookings', bookingId: booking.id, passengerId: passenger.id },
              });
            }
          }
        } else {
          for (const passenger of bookingPassengers) {
            webSocketService.emitInventoryUpdated(booking.tripId, passenger.seatNo, legIndexes);
          }
        }

        console.log(`[CLEANUP] Expired pending booking ${booking.id} canceled and seats released`);
      } catch (error) {
        console.error(`[CLEANUP] Failed to cleanup expired booking ${booking.id}:`, error);
      }
    }
  }
}
