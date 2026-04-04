import { IStorage } from "../../storage.interface";
import { InsertBooking, Booking } from "@shared/schema";
import { HoldsService } from "../holds/holds.service";
import { DeterministicBookingService } from "./deterministicBooking.service";
import { PrintService } from "../printing/print.service";
import { db } from "../../db";
import { bookings as bookingsTable, payments as paymentsTable, printJobs as printJobsTable, seatHolds, seatInventory, promotions as promotionsTable, vouchers as vouchersTable } from "@shared/schema";
import { eq, and, inArray, gt, lt, sql } from "drizzle-orm";
import { webSocketService } from "../../realtime/ws";
import {
  computeLegIndexes,
  fetchBookingSnapshots,
  insertPassengerRows,
  validateBoardingAlighting,
  confirmSeatsBooked,
  calculateBookingTotal,
  generateBookingCode,
} from "./booking.helpers";

export class BookingsService {
  private holdsService: HoldsService;
  private deterministicService: DeterministicBookingService;
  private printService: PrintService;

  constructor(private storage: IStorage) {
    this.holdsService = new HoldsService();
    this.deterministicService = new DeterministicBookingService(storage);
    this.printService = new PrintService();
  }

  async getAllBookings(tripId?: string): Promise<Booking[]> {
    return await this.storage.getBookings(tripId);
  }

  async getBookingsPaginated(options: { tripId?: string; outletId?: string; page: number; pageSize: number }): Promise<{ data: Booking[]; total: number }> {
    return await this.storage.getBookingsPaginated(options);
  }

  async getBookingById(id: string): Promise<Booking & { passengers?: any[]; payments?: any[]; tripDetails?: any; originStop?: any; destinationStop?: any; outlet?: any; vehicle?: any; departAt?: any; arriveAt?: any }> {
    const booking = await this.storage.getBookingById(id);
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`);
    }
    
    const [passengers, payments, trip, tripStopTimes] = await Promise.all([
      this.storage.getPassengers(booking.id),
      this.storage.getPayments(booking.id),
      this.storage.getTripById(booking.tripId),
      this.storage.getTripStopTimes(booking.tripId)
    ]);
    
    const secondaryFetches = await Promise.all([
      booking.originStopId ? this.storage.getStopById(booking.originStopId) : null,
      booking.destinationStopId ? this.storage.getStopById(booking.destinationStopId) : null,
      booking.outletId ? this.storage.getOutletById(booking.outletId) : null,
      trip?.vehicleId ? this.storage.getVehicleById(trip.vehicleId) : null
    ]);
    const originStop = secondaryFetches[0];
    const destinationStop = secondaryFetches[1];
    const outlet = secondaryFetches[2];
    const vehicle = secondaryFetches[3];

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
      arriveAt
    };
  }

  async createBooking(
    bookingData: InsertBooking,
    passengers: { fullName: string; phone?: string; idNumber?: string; seatNo: string }[],
    payment: { method: 'cash' | 'qr' | 'ewallet' | 'bank'; amount: number },
    idempotencyKey?: string,
    promoCode?: string
  ): Promise<{ booking: Booking; printPayload: any }> {
    
    await validateBoardingAlighting(this.storage, bookingData.tripId, bookingData.originSeq, bookingData.destinationSeq);

    const legIndexes = computeLegIndexes(bookingData.originSeq, bookingData.destinationSeq);
    const operatorId = bookingData.createdBy || 'default-operator';

    const seatNos = passengers.map(p => p.seatNo);
    const holdRecords = await db
      .select()
      .from(seatHolds)
      .where(and(
        eq(seatHolds.tripId, bookingData.tripId),
        inArray(seatHolds.seatNo, seatNos),
        gt(seatHolds.expiresAt, new Date()),
        eq(seatHolds.operatorId, operatorId)
      ));
    const holdsBySeat = new Map(holdRecords.map(h => [h.seatNo, h]));

    for (const passenger of passengers) {
      const holdRecord = holdsBySeat.get(passenger.seatNo);
      if (!holdRecord) {
        throw new Error(`Seat ${passenger.seatNo} is not held or hold has expired`);
      }

      const holdLegs = holdRecord.legIndexes as number[];
      const allLegsCovered = legIndexes.every(leg => holdLegs.includes(leg));
      if (!allLegsCovered) {
        throw new Error(`Seat ${passenger.seatNo} hold does not cover all required legs`);
      }
    }

    const { fareQuote, total: expectedTotal, promo } = await calculateBookingTotal(
      this.storage, bookingData.tripId, bookingData.originSeq, bookingData.destinationSeq,
      passengers.length, bookingData.channel || undefined, promoCode
    );

    const paymentAmount = Number(payment.amount);
    if (Math.round(paymentAmount) !== Math.round(expectedTotal)) {
      throw new Error(`Payment amount ${paymentAmount} does not match expected total ${expectedTotal}`);
    }

    const snapshots = await fetchBookingSnapshots(this.storage, bookingData.tripId, bookingData.originStopId, bookingData.destinationStopId, bookingData.outletId, bookingData.originSeq);

    const booking = await db.transaction(async (tx) => {
      const [newBooking] = await tx.insert(bookingsTable).values({
        ...bookingData,
        bookingCode: generateBookingCode(),
        status: 'paid',
        totalAmount: expectedTotal.toString(),
        discountAmount: promo.discountAmount.toString(),
        promoId: promo.promoId || null,
        voucherCode: promo.voucherCode || null,
        ...snapshots,
      }).returning();

      await insertPassengerRows(tx, newBooking.id, passengers, fareQuote);
      await confirmSeatsBooked(tx, bookingData.tripId, seatNos, legIndexes, operatorId);

      await tx.insert(paymentsTable).values({
        method: payment.method,
        amount: payment.amount.toString(),
        bookingId: newBooking.id
      });

      await tx.insert(printJobsTable).values({
        bookingId: newBooking.id,
        status: 'queued'
      });

      if (promo.promoId && promo.promoValidation) {
        const [promoUpdate] = await tx.update(promotionsTable)
          .set({ usageCount: sql`${promotionsTable.usageCount} + 1` })
          .where(and(
            eq(promotionsTable.id, promo.promoId),
            eq(promotionsTable.isActive, true),
            sql`(${promotionsTable.usageLimit} IS NULL OR ${promotionsTable.usageCount} < ${promotionsTable.usageLimit})`
          ))
          .returning({ id: promotionsTable.id });
        if (!promoUpdate) {
          throw new Error('Promo is no longer available or usage limit reached');
        }
        if (promo.promoValidation.voucher?.id) {
          const [voucherUpdate] = await tx.update(vouchersTable)
            .set({ status: 'used', usedAt: new Date(), usedByBookingId: newBooking.id })
            .where(and(
              eq(vouchersTable.id, promo.promoValidation.voucher.id),
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
    
    const result = await this.deterministicService.atomicHold({
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
    await this.deterministicService.releaseHoldByRef(holdRef);
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

    for (const passenger of passengers) {
      const [holdRecord] = await db
        .select()
        .from(seatHolds)
        .where(and(
          eq(seatHolds.tripId, bookingData.tripId),
          eq(seatHolds.seatNo, passenger.seatNo),
          gt(seatHolds.expiresAt, new Date()),
          eq(seatHolds.operatorId, operatorId)
        ))
        .limit(1);

      if (!holdRecord) {
        throw new Error(`Seat ${passenger.seatNo} is not held or hold has expired`);
      }
    }

    const { fareQuote, total: expectedTotal } = await calculateBookingTotal(
      this.storage, bookingData.tripId, bookingData.originSeq, bookingData.destinationSeq,
      passengers.length
    );

    const now = new Date();
    const pendingExpiresAt = new Date(now.getTime() + (config.holdTtlLongSeconds * 1000));

    const snapshots = await fetchBookingSnapshots(this.storage, bookingData.tripId, bookingData.originStopId, bookingData.destinationStopId, bookingData.outletId, bookingData.originSeq);

    const booking = await db.transaction(async (tx) => {
      const [newBooking] = await tx.insert(bookingsTable).values({
        ...bookingData,
        bookingCode: generateBookingCode(),
        status: 'pending',
        totalAmount: expectedTotal.toString(),
        pendingExpiresAt,
        ...snapshots,
      }).returning();

      await insertPassengerRows(tx, newBooking.id, passengers, fareQuote);
      await confirmSeatsBooked(tx, bookingData.tripId, seatNos, legIndexes, operatorId);

      return newBooking;
    });

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
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) {
      legIndexes.push(i);
    }

    await db.transaction(async (tx) => {
      for (const passenger of passengers) {
        await tx
          .update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            eq(seatInventory.seatNo, passenger.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));
      }

      await tx.update(bookingsTable)
        .set({ status: 'canceled' })
        .where(eq(bookingsTable.id, bookingId));
    });

    await this.holdsService.releaseHoldsByOwner(operatorId, bookingId);

    for (const passenger of passengers) {
      webSocketService.emitInventoryUpdated(booking.tripId, passenger.seatNo, legIndexes);
    }
  }

  async cleanupExpiredPendingBookings(): Promise<void> {
    const now = new Date();

    const expiredPendingBookings = await db
      .select()
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.status, 'pending'),
        lt(bookingsTable.pendingExpiresAt, now)
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

    for (const booking of expiredPendingBookings) {
      try {
        const bookingPassengers = passengersByBooking.get(booking.id) || [];
        const legIndexes: number[] = [];
        for (let i = booking.originSeq; i < booking.destinationSeq; i++) {
          legIndexes.push(i);
        }

        await db.transaction(async (tx) => {
          for (const passenger of bookingPassengers) {
            await tx
              .update(seatInventory)
              .set({ booked: false, holdRef: null })
              .where(and(
                eq(seatInventory.tripId, booking.tripId),
                eq(seatInventory.seatNo, passenger.seatNo),
                inArray(seatInventory.legIndex, legIndexes)
              ));
          }

          await tx.update(bookingsTable)
            .set({ status: 'canceled' })
            .where(eq(bookingsTable.id, booking.id));
        });

        for (const passenger of bookingPassengers) {
          webSocketService.emitInventoryUpdated(booking.tripId, passenger.seatNo, legIndexes);
        }

        console.log(`[CLEANUP] Expired pending booking ${booking.id} canceled and seats released`);
      } catch (error) {
        console.error(`[CLEANUP] Failed to cleanup expired booking ${booking.id}:`, error);
      }
    }
  }
}
