import { randomBytes } from "node:crypto";
import { db } from "@server/db";
import { 
  bookingGroups as bookingGroupsTable, 
  bookings as bookingsTable, 
  passengers as passengersTable, 
  payments as paymentsTable, 
  printJobs as printJobsTable, 
  seatHolds, 
  seatInventory,
  scheduleStopExceptions 
} from "@shared/schema";
import { eq, and, inArray, gt, sql } from "drizzle-orm";
import { generateBookingCode, generateTicketNumber, generateGroupCode } from "@server/utils/codeGenerator";
import { webSocketService } from "@server/realtime/ws";
import { PricingService } from "@modules/priceRules/pricing.service";
import { PrintService } from "@modules/printing/print.service";
import { IStorage } from "@server/storage.interface";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import { assertTripBookable } from "./booking.helpers";

interface OutboundPassengerInput {
  name: string;
  seatNo: string;
}
interface ReturnPassengerInput {
  seatNo: string;
}
export interface RoundTripBookingInput {
  outbound: {
    tripId: string;
    originStopId: string;
    destinationStopId: string;
    originSeq: number;
    destinationSeq: number;
    outletId?: string;
    passengers: OutboundPassengerInput[];
  };
  return: {
    tripId: string;
    originStopId: string;
    destinationStopId: string;
    originSeq: number;
    destinationSeq: number;
    passengers: ReturnPassengerInput[];
  };
  payment: {
    method: 'cash' | 'qr' | 'ewallet' | 'bank';
    amount: number;
  };
}

/**
 * S1-09 (Sprint 2): round-trip booking sama dengan dua booking sekaligus
 * jadi guard `action.booking.create` harus aktif walaupun service
 * dipanggil langsung (mis. dari batch import OTA di masa depan).
 */
export class RoundTripService {
  private pricingService: PricingService;
  private printService: PrintService;

  constructor(private storage: IStorage) {
    this.pricingService = new PricingService(storage);
    this.printService = new PrintService();
  }

  async createRoundTripBooking(data: RoundTripBookingInput, operatorId: string, ctx: ServiceContext) {
    requirePermission(ctx, "action.booking.create");
    const { outbound, return: returnData, payment } = data;

    // 1. Validasi jumlah seats outbound == return
    if (outbound.passengers.length !== returnData.passengers.length) {
      throw new Error("Jumlah penumpang outbound dan return harus sama");
    }

    // 2. Validasi boarding/alighting rules
    await Promise.all([
      this.validateBoardingAlightingRules(outbound.tripId, outbound.originSeq, outbound.destinationSeq),
      this.validateBoardingAlightingRules(returnData.tripId, returnData.originSeq, returnData.destinationSeq)
    ]);

    // 2b. Kedua trip harus masih berstatus 'scheduled' — hold di step 3
    // hanya membuktikan kursi PERNAH tersedia saat di-hold, bukan bahwa
    // trip-nya belum keburu ditutup/dibatalkan operator di antara hold
    // dan konfirmasi ini.
    await Promise.all([
      assertTripBookable(this.storage, outbound.tripId),
      assertTripBookable(this.storage, returnData.tripId),
    ]);

    // 3. Validasi kedua hold masih aktif
    const outboundSeatNos = outbound.passengers.map((p) => p.seatNo);
    const returnSeatNos = returnData.passengers.map((p) => p.seatNo);

    const [outboundHolds, returnHolds] = await Promise.all([
      db.select().from(seatHolds).where(and(
        eq(seatHolds.tripId, outbound.tripId),
        inArray(seatHolds.seatNo, outboundSeatNos),
        gt(seatHolds.expiresAt, new Date()),
        eq(seatHolds.operatorId, operatorId)
      )),
      db.select().from(seatHolds).where(and(
        eq(seatHolds.tripId, returnData.tripId),
        inArray(seatHolds.seatNo, returnSeatNos),
        gt(seatHolds.expiresAt, new Date()),
        eq(seatHolds.operatorId, operatorId)
      ))
    ]);

    if (outboundHolds.length !== outboundSeatNos.length) {
      throw new Error("Satu atau lebih kursi outbound tidak lagi dihold atau telah kadaluarsa");
    }
    if (returnHolds.length !== returnSeatNos.length) {
      throw new Error("Satu atau lebih kursi return tidak lagi dihold atau telah kadaluarsa");
    }

    // 4. Quote fare
    const [outboundFare, returnFare] = await Promise.all([
      this.pricingService.quoteFare(outbound.tripId, outbound.originSeq, outbound.destinationSeq),
      this.pricingService.quoteFare(returnData.tripId, returnData.originSeq, returnData.destinationSeq)
    ]);

    const totalAmount = (Number(outboundFare.total) * outbound.passengers.length) + 
                        (Number(returnFare.total) * returnData.passengers.length);

    // 5. Generate groupCode
    const groupCode = generateGroupCode();

    const allStopIds = [...new Set([outbound.originStopId, outbound.destinationStopId, returnData.originStopId, returnData.destinationStopId])];
    const allTripIds = [...new Set([outbound.tripId, returnData.tripId])];
    const [allStopsData, allTripsData, outletData] = await Promise.all([
      this.storage.getStopsByIds(allStopIds),
      Promise.all(allTripIds.map(id => this.storage.getTripById(id))),
      outbound.outletId ? this.storage.getOutletById(outbound.outletId) : null,
    ]);
    const stopsMap = new Map(allStopsData.map(s => [s.id, s]));
    const tripsMap = new Map(allTripsData.filter(Boolean).map(t => [t!.id, t!]));

    const outboundLegIndexes: number[] = [];
    for (let i = outbound.originSeq; i < outbound.destinationSeq; i++) outboundLegIndexes.push(i);
    const returnLegIndexes: number[] = [];
    for (let i = returnData.originSeq; i < returnData.destinationSeq; i++) returnLegIndexes.push(i);

    const outboundSeatNosArr = outbound.passengers.map((p) => p.seatNo);
    const returnSeatNosArr = returnData.passengers.map((p) => p.seatNo);

    // 6. DB Transaction with advisory lock to prevent deadlocks
    const result = await db.transaction(async (tx) => {
      const sortedTripIds = [outbound.tripId, returnData.tripId].sort();
      for (const tid of sortedTripIds) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tid}))`);
      }

      const [group] = await tx.insert(bookingGroupsTable).values({
        groupCode,
        type: 'round_trip',
        channel: 'CSO',
        // §3.8: booking_groups.totalAmount is numeric(12,2) → string at
        // runtime. Keep IDR-rounded semantics for now via Math.round, but
        // the schema accepts fractions if a future commission flow needs it.
        totalAmount: Math.round(totalAmount).toFixed(2),
        outletId: outbound.outletId || null,
        createdBy: operatorId
      }).returning();

      const outOriginStop = stopsMap.get(outbound.originStopId);
      const outDestStop = stopsMap.get(outbound.destinationStopId);
      const outTrip = tripsMap.get(outbound.tripId);

      const [outboundBooking] = await tx.insert(bookingsTable).values({
        bookingCode: generateBookingCode(),
        status: 'paid',
        groupId: group.id,
        legType: 'outbound',
        tripId: outbound.tripId,
        originStopId: outbound.originStopId,
        destinationStopId: outbound.destinationStopId,
        originSeq: outbound.originSeq,
        destinationSeq: outbound.destinationSeq,
        totalAmount: (Number(outboundFare.total) * outbound.passengers.length).toString(),
        outletId: outbound.outletId || null,
        createdBy: operatorId,
        snapOriginStopName: outOriginStop?.name || null,
        snapDestinationStopName: outDestStop?.name || null,
        snapDepartureHHMM: outTrip?.originDepartHHMM || null,
        snapOutletName: outletData?.name || null,
      }).returning();

      const outboundPaxValues = outbound.passengers.map((p) => ({
        bookingId: outboundBooking.id,
        fullName: p.name,
        seatNo: p.seatNo,
        ticketNumber: generateTicketNumber(),
        fareAmount: outboundFare.perPassenger.toString(),
        fareBreakdown: outboundFare.breakdown
      }));
      await tx.insert(passengersTable).values(outboundPaxValues);

      await tx.update(seatInventory)
        .set({ booked: true, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, outbound.tripId),
          inArray(seatInventory.seatNo, outboundSeatNosArr),
          inArray(seatInventory.legIndex, outboundLegIndexes)
        ));

      await tx.delete(seatHolds)
        .where(and(
          eq(seatHolds.tripId, outbound.tripId),
          inArray(seatHolds.seatNo, outboundSeatNosArr),
          eq(seatHolds.operatorId, operatorId)
        ));

      const retOriginStop = stopsMap.get(returnData.originStopId);
      const retDestStop = stopsMap.get(returnData.destinationStopId);
      const retTrip = tripsMap.get(returnData.tripId);

      const [returnBooking] = await tx.insert(bookingsTable).values({
        bookingCode: generateBookingCode(),
        status: 'paid',
        groupId: group.id,
        legType: 'return',
        tripId: returnData.tripId,
        originStopId: returnData.originStopId,
        destinationStopId: returnData.destinationStopId,
        originSeq: returnData.originSeq,
        destinationSeq: returnData.destinationSeq,
        totalAmount: (Number(returnFare.total) * returnData.passengers.length).toString(),
        outletId: outbound.outletId || null,
        createdBy: operatorId,
        snapOriginStopName: retOriginStop?.name || null,
        snapDestinationStopName: retDestStop?.name || null,
        snapDepartureHHMM: retTrip?.originDepartHHMM || null,
        snapOutletName: outletData?.name || null,
      }).returning();

      const returnPaxValues = returnData.passengers.map((retP, i) => ({
        bookingId: returnBooking.id,
        fullName: outbound.passengers[i].name,
        seatNo: retP.seatNo,
        ticketNumber: generateTicketNumber(),
        fareAmount: returnFare.perPassenger.toString(),
        fareBreakdown: returnFare.breakdown
      }));
      await tx.insert(passengersTable).values(returnPaxValues);

      await tx.update(seatInventory)
        .set({ booked: true, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, returnData.tripId),
          inArray(seatInventory.seatNo, returnSeatNosArr),
          inArray(seatInventory.legIndex, returnLegIndexes)
        ));

      await tx.delete(seatHolds)
        .where(and(
          eq(seatHolds.tripId, returnData.tripId),
          inArray(seatHolds.seatNo, returnSeatNosArr),
          eq(seatHolds.operatorId, operatorId)
        ));

      // Round-trip booking is created with status='paid' for both legs
      // (line 176 above), so the payment row needs the matching
      // status='success' + paidAt + providerRef — otherwise finance
      // reports that filter on status='success' miss every round-trip
      // sale and the partial index idx_payments_paid_date is bypassed.
      // Single payment row covers both legs (amount = outbound + return).
      const paymentRef = `PAY-${randomBytes(12).toString('hex').toUpperCase()}`;
      await tx.insert(paymentsTable).values({
        bookingId: outboundBooking.id,
        method: payment.method,
        amount: totalAmount.toString(),
        status: 'success',
        providerRef: paymentRef,
        paidAt: new Date(),
      });

      await tx.insert(printJobsTable).values([
        { bookingId: outboundBooking.id, status: 'queued' as const },
        { bookingId: returnBooking.id, status: 'queued' as const },
      ]);

      return { group, outboundBooking, returnBooking };
    });

    for (const p of outbound.passengers) {
      webSocketService.emitInventoryUpdated(outbound.tripId, p.seatNo, outboundLegIndexes);
    }
    for (const p of returnData.passengers) {
      webSocketService.emitInventoryUpdated(returnData.tripId, p.seatNo, returnLegIndexes);
    }

    // Generate print payloads
    const [outboundPayload, returnPayload] = await Promise.all([
      this.printService.generatePrintPayload(result.outboundBooking.id),
      this.printService.generatePrintPayload(result.returnBooking.id)
    ]);

    return {
      group: result.group,
      outboundBooking: result.outboundBooking,
      returnBooking: result.returnBooking,
      printPayloads: [outboundPayload, returnPayload]
    };
  }

  async getBookingGroupByCode(groupCode: string) {
    const [group] = await db.select().from(bookingGroupsTable).where(eq(bookingGroupsTable.groupCode, groupCode));
    if (!group) return null;

    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.groupId, group.id));
    return { group, bookings };
  }

  private async validateBoardingAlightingRules(
    tripId: string,
    originSeq: number,
    destinationSeq: number
  ): Promise<void> {
    const stopTimes = await this.storage.getTripStopTimesWithEffectiveFlags(tripId);
    
    const originStop = stopTimes.find(st => st.stopSequence === originSeq);
    const destinationStop = stopTimes.find(st => st.stopSequence === destinationSeq);
    
    if (!originStop) throw new Error(`Origin stop at sequence ${originSeq} not found`);
    if (!destinationStop) throw new Error(`Destination stop at sequence ${destinationSeq} not found`);
    
    if (!originStop.effectiveBoardingAllowed) {
      throw new Error('Boarding not allowed at this stop');
    }
    
    if (!destinationStop.effectiveAlightingAllowed) {
      throw new Error('Alighting not allowed at this stop');
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
          throw new Error('Titik naik ini ditutup sementara oleh operasional');
        }
        if (ex.stopId === destinationStop.stopId && ex.disableAlighting) {
          throw new Error('Titik turun ini ditutup sementara oleh operasional');
        }
      }
    }
  }
}
