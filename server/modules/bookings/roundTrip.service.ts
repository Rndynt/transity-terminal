import { db } from "../../db";
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
import { eq, and, inArray, gt } from "drizzle-orm";
import { generateBookingCode, generateTicketNumber, generateGroupCode } from "../../utils/codeGenerator";
import { webSocketService } from "../../realtime/ws";
import { PricingService } from "../pricing/pricing.service";
import { PrintService } from "../printing/print.service";
import { IStorage } from "../../storage.interface";
import { Booking, BookingGroup } from "@shared/schema";

export class RoundTripService {
  private pricingService: PricingService;
  private printService: PrintService;

  constructor(private storage: IStorage) {
    this.pricingService = new PricingService(storage);
    this.printService = new PrintService();
  }

  async createRoundTripBooking(data: any, operatorId: string) {
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

    // 3. Validasi kedua hold masih aktif
    const outboundSeatNos = outbound.passengers.map((p: any) => p.seatNo);
    const returnSeatNos = returnData.passengers.map((p: any) => p.seatNo);

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

    // 6. DB Transaction
    const result = await db.transaction(async (tx) => {
      // a. INSERT booking_groups
      const [group] = await tx.insert(bookingGroupsTable).values({
        groupCode,
        type: 'round_trip',
        channel: 'CSO',
        totalAmount: Math.round(totalAmount),
        outletId: outbound.outletId || null,
        createdBy: operatorId
      }).returning();

      // b. Outbound snapshots
      const [outOriginStop, outDestStop, outTrip, outOutlet] = await Promise.all([
        this.storage.getStopById(outbound.originStopId),
        this.storage.getStopById(outbound.destinationStopId),
        this.storage.getTripById(outbound.tripId),
        outbound.outletId ? this.storage.getOutletById(outbound.outletId) : null,
      ]);

      // c. INSERT outbound booking
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
        snapOutletName: outOutlet?.name || null,
      }).returning();

      // d. INSERT outbound passengers & update inventory
      const outboundLegIndexes = [];
      for (let i = outbound.originSeq; i < outbound.destinationSeq; i++) outboundLegIndexes.push(i);

      for (const p of outbound.passengers) {
        await tx.insert(passengersTable).values({
          bookingId: outboundBooking.id,
          fullName: p.name,
          seatNo: p.seatNo,
          ticketNumber: generateTicketNumber(),
          fareAmount: outboundFare.perPassenger.toString(),
          fareBreakdown: outboundFare.breakdown
        });

        await tx.update(seatInventory)
          .set({ booked: true, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, outbound.tripId),
            eq(seatInventory.seatNo, p.seatNo),
            inArray(seatInventory.legIndex, outboundLegIndexes)
          ));

        await tx.delete(seatHolds)
          .where(and(
            eq(seatHolds.tripId, outbound.tripId),
            eq(seatHolds.seatNo, p.seatNo),
            eq(seatHolds.operatorId, operatorId)
          ));
      }

      // g. Return snapshots
      const [retOriginStop, retDestStop, retTrip, retOutlet] = await Promise.all([
        this.storage.getStopById(returnData.originStopId),
        this.storage.getStopById(returnData.destinationStopId),
        this.storage.getTripById(returnData.tripId),
        outbound.outletId ? this.storage.getOutletById(outbound.outletId) : null, // Use same outlet
      ]);

      // h. INSERT return booking
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
        snapOutletName: retOutlet?.name || null,
      }).returning();

      // i. INSERT return passengers & update inventory
      const returnLegIndexes = [];
      for (let i = returnData.originSeq; i < returnData.destinationSeq; i++) returnLegIndexes.push(i);

      for (let i = 0; i < returnData.passengers.length; i++) {
        const outP = outbound.passengers[i];
        const retP = returnData.passengers[i];
        
        await tx.insert(passengersTable).values({
          bookingId: returnBooking.id,
          fullName: outP.name, // Nama sama dengan outbound
          seatNo: retP.seatNo,
          ticketNumber: generateTicketNumber(),
          fareAmount: returnFare.perPassenger.toString(),
          fareBreakdown: returnFare.breakdown
        });

        await tx.update(seatInventory)
          .set({ booked: true, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, returnData.tripId),
            eq(seatInventory.seatNo, retP.seatNo),
            inArray(seatInventory.legIndex, returnLegIndexes)
          ));

        await tx.delete(seatHolds)
          .where(and(
            eq(seatHolds.tripId, returnData.tripId),
            eq(seatHolds.seatNo, retP.seatNo),
            eq(seatHolds.operatorId, operatorId)
          ));
      }

      // l. INSERT payments (associated with outbound booking as primary)
      await tx.insert(paymentsTable).values({
        bookingId: outboundBooking.id,
        method: payment.method,
        amount: totalAmount.toString()
      });

      // m/n. INSERT print_jobs
      await tx.insert(printJobsTable).values({ bookingId: outboundBooking.id, status: 'queued' });
      await tx.insert(printJobsTable).values({ bookingId: returnBooking.id, status: 'queued' });

      return { group, outboundBooking, returnBooking };
    });

    // 8. Emit WebSocket
    const outboundLegIndexes = [];
    for (let i = outbound.originSeq; i < outbound.destinationSeq; i++) outboundLegIndexes.push(i);
    for (const p of outbound.passengers) {
      webSocketService.emitInventoryUpdated(outbound.tripId, p.seatNo, outboundLegIndexes);
    }

    const returnLegIndexes = [];
    for (let i = returnData.originSeq; i < returnData.destinationSeq; i++) returnLegIndexes.push(i);
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
