import { IStorage } from "../../storage.interface";
import { InsertBooking, Booking, InsertPassenger, InsertPayment, InsertPrintJob } from "@shared/schema";
import { HoldsService } from "../holds/holds.service";
import { DeterministicBookingService } from "./deterministicBooking.service";
import { PricingService } from "../pricing/pricing.service";
import { PromosService } from "../promos/promos.service";
import { PrintService } from "../printing/print.service";
import { db } from "../../db";
import { bookings as bookingsTable, seatHolds, seatInventory } from "@shared/schema";
import { scheduleStopExceptions } from "@shared/schema/scheduling";
import { eq, and, inArray, gt, lt } from "drizzle-orm";
import { webSocketService } from "../../realtime/ws";
import { generateBookingCode, generateTicketNumber } from "../../utils/codeGenerator";

export class BookingsService {
  private holdsService: HoldsService;
  private deterministicService: DeterministicBookingService;
  private pricingService: PricingService;
  private promosService: PromosService;
  private printService: PrintService;

  constructor(private storage: IStorage) {
    this.holdsService = new HoldsService();
    this.deterministicService = new DeterministicBookingService(storage);
    this.pricingService = new PricingService(storage);
    this.promosService = new PromosService(storage);
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
    
    await this.validateBoardingAlightingRules(
      bookingData.tripId,
      bookingData.originSeq,
      bookingData.destinationSeq
    );
    
    const legIndexes = [];
    for (let i = bookingData.originSeq; i < bookingData.destinationSeq; i++) {
      legIndexes.push(i);
    }

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

    let fareQuote: Awaited<ReturnType<typeof this.pricingService.quoteFare>>;
    try {
      fareQuote = await this.pricingService.quoteFare(
        bookingData.tripId,
        bookingData.originSeq,
        bookingData.destinationSeq
      );
    } catch (err: any) {
      if (err.message === 'NO_PRICE_RULE') {
        throw new Error('Trip ini belum memiliki aturan harga. Hubungi admin untuk mengatur harga sebelum memesan tiket.');
      }
      throw err;
    }

    const subtotal = Number(fareQuote.total) * passengers.length;

    let discountAmount = 0;
    let promoId: string | undefined;
    let voucherCode: string | undefined;
    let promoValidation: any;

    if (promoCode) {
      const trip = await this.storage.getTripById(bookingData.tripId);
      promoValidation = await this.promosService.validateAndCalculateDiscount(
        promoCode,
        subtotal,
        bookingData.channel || undefined,
        bookingData.tripId,
        trip?.patternId || undefined
      );
      if (!promoValidation.valid) {
        throw new Error(promoValidation.error || 'Kode promo tidak valid');
      }
      discountAmount = promoValidation.discountAmount;
      promoId = promoValidation.promotion?.id;
      if (promoValidation.voucher) {
        voucherCode = promoValidation.voucher.code;
      }
    }

    const expectedTotal = subtotal - discountAmount;
    const paymentAmount = Number(payment.amount);
    if (Math.abs(paymentAmount - expectedTotal) > 0.01) {
      throw new Error(`Payment amount ${paymentAmount} does not match expected total ${expectedTotal}`);
    }

    const [originStop, destinationStop, trip, outlet] = await Promise.all([
      this.storage.getStopById(bookingData.originStopId),
      this.storage.getStopById(bookingData.destinationStopId),
      this.storage.getTripById(bookingData.tripId),
      bookingData.outletId ? this.storage.getOutletById(bookingData.outletId) : null,
    ]);

    const booking = await db.transaction(async (tx) => {
      const newBooking = await this.storage.createBooking({
        ...bookingData,
        bookingCode: generateBookingCode(),
        status: 'paid',
        totalAmount: expectedTotal.toString(),
        discountAmount: discountAmount.toString(),
        promoId: promoId || null,
        voucherCode: voucherCode || null,
        snapOriginStopName: originStop?.name || null,
        snapDestinationStopName: destinationStop?.name || null,
        snapDepartureHHMM: trip?.originDepartHHMM || null,
        snapOutletName: outlet?.name || null,
      });

      for (const passengerData of passengers) {
        await this.storage.createPassenger({
          ...passengerData,
          ticketNumber: generateTicketNumber(),
          bookingId: newBooking.id,
          fareAmount: fareQuote.perPassenger.toString(),
          fareBreakdown: fareQuote.breakdown
        });

        await tx
          .update(seatInventory)
          .set({ booked: true, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, bookingData.tripId),
            eq(seatInventory.seatNo, passengerData.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        await tx
          .delete(seatHolds)
          .where(and(
            eq(seatHolds.tripId, bookingData.tripId),
            eq(seatHolds.seatNo, passengerData.seatNo),
            eq(seatHolds.operatorId, operatorId)
          ));
      }

      await this.storage.createPayment({
        method: payment.method,
        amount: payment.amount.toString(),
        bookingId: newBooking.id
      });

      await this.storage.createPrintJob({
        bookingId: newBooking.id,
        status: 'queued'
      });

      return newBooking;
    });

    if (promoId && promoValidation) {
      await this.promosService.markUsed(promoId, promoValidation.voucher?.id, booking.id);
    }

    const bookingWithRelations = await this.getBookingById(booking.id);
    const printPayload = await this.printService.generatePrintPayload(booking.id);

    return { booking: bookingWithRelations, printPayload };
  }

  private async validateBoardingAlightingRules(
    tripId: string,
    originSeq: number,
    destinationSeq: number
  ): Promise<void> {
    const stopTimes = await this.storage.getTripStopTimesWithEffectiveFlags(tripId);
    
    const originStop = stopTimes.find(st => st.stopSequence === originSeq);
    const destinationStop = stopTimes.find(st => st.stopSequence === destinationSeq);
    
    if (!originStop) {
      throw new Error(`Origin stop at sequence ${originSeq} not found`);
    }
    
    if (!destinationStop) {
      throw new Error(`Destination stop at sequence ${destinationSeq} not found`);
    }
    
    if (!originStop.effectiveBoardingAllowed) {
      const error = new Error('Boarding not allowed at this stop');
      (error as any).code = 'boarding-not-allowed';
      throw error;
    }
    
    if (!destinationStop.effectiveAlightingAllowed) {
      const error = new Error('Alighting not allowed at this stop');
      (error as any).code = 'alighting-not-allowed';
      throw error;
    }

    const trip = await this.storage.getTripById(tripId);
    if (trip?.baseId && trip?.serviceDate) {
      const stopExceptions = await db.select()
        .from(scheduleStopExceptions)
        .where(and(
          eq(scheduleStopExceptions.baseId, trip.baseId),
          eq(scheduleStopExceptions.exceptionDate, trip.serviceDate),
        ));

      for (const ex of stopExceptions) {
        if (ex.stopId === originStop.stopId && ex.disableBoarding) {
          const error = new Error('Titik naik ini ditutup sementara oleh operasional');
          (error as any).code = 'stop-closed-by-ops';
          throw error;
        }
        if (ex.stopId === destinationStop.stopId && ex.disableAlighting) {
          const error = new Error('Titik turun ini ditutup sementara oleh operasional');
          (error as any).code = 'stop-closed-by-ops';
          throw error;
        }
      }
    }
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
    
    // Validate that all required seats are held by this operator
    const legIndexes = [];
    for (let i = bookingData.originSeq; i < bookingData.destinationSeq; i++) {
      legIndexes.push(i);
    }

    // Check seat holds from DATABASE for all passengers
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

    // Calculate pricing
    let fareQuote: Awaited<ReturnType<typeof this.pricingService.quoteFare>>;
    try {
      fareQuote = await this.pricingService.quoteFare(
        bookingData.tripId,
        bookingData.originSeq,
        bookingData.destinationSeq
      );
    } catch (err: any) {
      if (err.message === 'NO_PRICE_RULE') {
        throw new Error('Trip ini belum memiliki aturan harga. Hubungi admin untuk mengatur harga sebelum memesan tiket.');
      }
      throw err;
    }

    // Set pending expiration
    const now = new Date();
    const pendingExpiresAt = new Date(now.getTime() + (config.holdTtlLongSeconds * 1000));

    const [originStop, destinationStop, tripForSnap, outlet] = await Promise.all([
      this.storage.getStopById(bookingData.originStopId),
      this.storage.getStopById(bookingData.destinationStopId),
      this.storage.getTripById(bookingData.tripId),
      bookingData.outletId ? this.storage.getOutletById(bookingData.outletId) : null,
    ]);

    const expectedTotal = Number(fareQuote.total) * passengers.length;
    const booking = await this.storage.createBooking({
      ...bookingData,
      bookingCode: generateBookingCode(),
      status: 'pending',
      totalAmount: expectedTotal.toString(),
      pendingExpiresAt,
      snapOriginStopName: originStop?.name || null,
      snapDestinationStopName: destinationStop?.name || null,
      snapDepartureHHMM: tripForSnap?.originDepartHHMM || null,
      snapOutletName: outlet?.name || null,
    });

    // Create passengers and mark seats as booked (pending status)
    for (const passengerData of passengers) {
      await this.storage.createPassenger({
        ...passengerData,
        ticketNumber: generateTicketNumber(),
        bookingId: booking.id,
        fareAmount: fareQuote.perPassenger.toString(),
        fareBreakdown: fareQuote.breakdown
      });

      // Mark seats as booked (with hold cleared) - pending booking
      await db.transaction(async (tx) => {
        // Update seat inventory - mark as booked
        await tx
          .update(seatInventory)
          .set({ booked: true, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, bookingData.tripId),
            eq(seatInventory.seatNo, passengerData.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        // Delete hold record
        await tx
          .delete(seatHolds)
          .where(and(
            eq(seatHolds.tripId, bookingData.tripId),
            eq(seatHolds.seatNo, passengerData.seatNo),
            eq(seatHolds.operatorId, operatorId)
          ));
      });
    }

    const bookingWithRelations = await this.getBookingById(booking.id);
    return { booking: bookingWithRelations, pendingExpiresAt };
  }

  async getPendingBookings(outletId?: string, operatorId?: string): Promise<Booking[]> {
    // Get all pending bookings
    const allBookings = await this.storage.getBookings();
    
    let pendingBookings = allBookings.filter(b => 
      b.status === 'pending' && 
      b.pendingExpiresAt && 
      new Date(b.pendingExpiresAt) > new Date()
    );

    // Filter by outlet if provided
    if (outletId) {
      pendingBookings = pendingBookings.filter(b => b.outletId === outletId);
    }

    // TODO: Add operator filtering once we have operator tracking in bookings
    // For now, we'll use the createdBy field as a proxy
    if (operatorId) {
      pendingBookings = pendingBookings.filter(b => b.createdBy === operatorId);
    }

    return pendingBookings;
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
    });

    await this.holdsService.releaseHoldsByOwner(operatorId, bookingId);

    await this.storage.updateBooking(bookingId, { status: 'canceled' });

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
        });

        await this.storage.updateBooking(booking.id, { status: 'canceled' });

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
