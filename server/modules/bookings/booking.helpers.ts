import { IStorage } from "@server/storage.interface";
import { PricingService } from "@modules/pricing/pricing.service";
import { PromosService } from "@modules/promos/promos.service";
import { passengers as passengersTable, seatInventory, seatHolds } from "@shared/schema";
import { scheduleStopExceptions } from "@shared/schema/scheduling";
import { generateBookingCode, generateTicketNumber } from "@server/utils/codeGenerator";
import { db } from "@server/db";
import { eq, and, inArray, gt, sql } from "drizzle-orm";

export { generateBookingCode, generateTicketNumber };

export function computeLegIndexes(originSeq: number, destinationSeq: number): number[] {
  const legs: number[] = [];
  for (let i = originSeq; i < destinationSeq; i++) legs.push(i);
  return legs;
}

export async function quoteFareForBooking(
  storage: IStorage,
  tripId: string,
  originSeq: number,
  destinationSeq: number
) {
  const pricingService = new PricingService(storage);
  try {
    return await pricingService.quoteFare(tripId, originSeq, destinationSeq);
  } catch (err: any) {
    if (err.message === 'NO_PRICE_RULE') {
      throw new Error('Trip ini belum memiliki aturan harga. Hubungi admin untuk mengatur harga sebelum memesan tiket.');
    }
    throw err;
  }
}

export interface BookingSnapshots {
  snapOriginStopName: string | null;
  snapDestinationStopName: string | null;
  snapDepartureHHMM: string | null;
  snapOutletName: string | null;
}

export async function fetchBookingSnapshots(
  storage: IStorage,
  tripId: string,
  originStopId: string,
  destinationStopId: string,
  outletId?: string | null,
  originSeq?: number
): Promise<BookingSnapshots> {
  const [originStop, destinationStop, trip, outlet] = await Promise.all([
    storage.getStopById(originStopId),
    storage.getStopById(destinationStopId),
    storage.getTripById(tripId),
    outletId ? storage.getOutletById(outletId) : null,
  ]);

  let departureHHMM = trip?.originDepartHHMM || null;

  if (!departureHHMM && originSeq != null) {
    const stopTimes = await storage.getTripStopTimes(tripId);
    const originST = stopTimes.find((st: any) => st.stopSequence === originSeq);
    if (originST?.departAt) {
      departureHHMM = String(originST.departAt).slice(11, 16);
    }
  }

  return {
    snapOriginStopName: originStop?.name || null,
    snapDestinationStopName: destinationStop?.name || null,
    snapDepartureHHMM: departureHHMM,
    snapOutletName: outlet?.name || null,
  };
}

export async function insertPassengerRows(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  bookingId: string,
  passengers: { fullName: string; phone?: string; idNumber?: string; seatNo: string }[],
  fareQuote: { perPassenger: string | number; breakdown: any }
) {
  for (const pax of passengers) {
    await tx.insert(passengersTable).values({
      bookingId,
      ticketNumber: generateTicketNumber(),
      fullName: pax.fullName,
      phone: pax.phone,
      idNumber: pax.idNumber,
      seatNo: pax.seatNo,
      fareAmount: fareQuote.perPassenger.toString(),
      fareBreakdown: fareQuote.breakdown,
    });
  }
}

export async function validateBoardingAlighting(
  storage: IStorage,
  tripId: string,
  originSeq: number,
  destinationSeq: number
): Promise<void> {
  const stopTimes = await storage.getTripStopTimesWithEffectiveFlags(tripId);

  const originStop = stopTimes.find((st: any) => st.stopSequence === originSeq);
  const destinationStop = stopTimes.find((st: any) => st.stopSequence === destinationSeq);

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

  const trip = await storage.getTripById(tripId);
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function validateHoldOwnership(
  tripId: string,
  seatNos: string[],
  legIndexes: number[],
  operatorId: string
) {
  const holdRecords = await db
    .select()
    .from(seatHolds)
    .where(and(
      eq(seatHolds.tripId, tripId),
      inArray(seatHolds.seatNo, seatNos),
      gt(seatHolds.expiresAt, new Date()),
      eq(seatHolds.operatorId, operatorId)
    ));
  const holdsBySeat = new Map(holdRecords.map(h => [h.seatNo, h]));

  for (const seatNo of seatNos) {
    const holdRecord = holdsBySeat.get(seatNo);
    if (!holdRecord) {
      throw new Error(`Seat ${seatNo} is not held or hold has expired`);
    }

    const holdLegs = holdRecord.legIndexes as number[];
    const allLegsCovered = legIndexes.every(leg => holdLegs.includes(leg));
    if (!allLegsCovered) {
      throw new Error(`Seat ${seatNo} hold does not cover all required legs`);
    }
  }
}

export async function confirmSeatsBooked(
  tx: Tx,
  tripId: string,
  seatNos: string[],
  legIndexes: number[],
  operatorId: string
) {
  await tx
    .update(seatInventory)
    .set({ booked: true, holdRef: null })
    .where(and(
      eq(seatInventory.tripId, tripId),
      inArray(seatInventory.seatNo, seatNos),
      inArray(seatInventory.legIndex, legIndexes)
    ));

  await tx
    .delete(seatHolds)
    .where(and(
      eq(seatHolds.tripId, tripId),
      inArray(seatHolds.seatNo, seatNos),
      eq(seatHolds.operatorId, operatorId)
    ));
}

export async function checkSeatsAvailable(
  tx: Tx,
  tripId: string,
  seatNos: string[],
  legIndexes: number[]
) {
  const legArr = sql`ARRAY[${sql.join(legIndexes.map(i => sql`${i}::int`), sql`, `)}]`;
  const seatArr = sql`ARRAY[${sql.join(seatNos.map(s => sql`${s}`), sql`, `)}]`;
  const inv = await tx.execute(sql`
    SELECT seat_no, booked, hold_ref FROM seat_inventory
    WHERE trip_id = ${tripId}
      AND seat_no = ANY(${seatArr})
      AND leg_index = ANY(${legArr})
    FOR UPDATE
  `);
  for (const row of inv.rows as Record<string, unknown>[]) {
    if (row.booked === true) throw new Error(`Seat ${row.seat_no} is already booked`);
    if (!!row.hold_ref) throw new Error(`Seat ${row.seat_no} is currently held by another user`);
  }
}

export async function createSeatHoldsForBooking(
  tx: Tx,
  tripId: string,
  bookingId: string,
  seatNos: string[],
  legIndexes: number[],
  holderId: string | null,
  expiresAt: Date
) {
  const holdValues = seatNos.map(seatNo => ({
    holdRef: `app-hold:${bookingId}:${seatNo}`,
    tripId,
    seatNo,
    legIndexes,
    ttlClass: 'short' as const,
    operatorId: holderId || 'service-client',
    bookingId,
    expiresAt,
  }));

  await tx.insert(seatHolds).values(holdValues);

  for (const seatNo of seatNos) {
    await tx.update(seatInventory)
      .set({ holdRef: `app-hold:${bookingId}:${seatNo}` })
      .where(and(
        eq(seatInventory.tripId, tripId),
        eq(seatInventory.seatNo, seatNo),
        inArray(seatInventory.legIndex, legIndexes)
      ));
  }
}

export interface PromoResult {
  discountAmount: number;
  promoId: string | undefined;
  voucherCode: string | undefined;
  promoValidation: any;
}

export async function calculateBookingTotal(
  storage: IStorage,
  tripId: string,
  originSeq: number,
  destinationSeq: number,
  passengerCount: number,
  channel?: string,
  promoCode?: string
): Promise<{ fareQuote: Awaited<ReturnType<PricingService['quoteFare']>>; subtotal: number; total: number; promo: PromoResult }> {
  const fareQuote = await quoteFareForBooking(storage, tripId, originSeq, destinationSeq);
  const subtotal = Number(fareQuote.total) * passengerCount;

  let discountAmount = 0;
  let promoId: string | undefined;
  let voucherCode: string | undefined;
  let promoValidation: any;

  if (promoCode) {
    const promosService = new PromosService(storage);
    const trip = await storage.getTripById(tripId);
    promoValidation = await promosService.validateAndCalculateDiscount(
      promoCode,
      subtotal,
      channel,
      tripId,
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

  return {
    fareQuote,
    subtotal,
    total: subtotal - discountAmount,
    promo: { discountAmount, promoId, voucherCode, promoValidation },
  };
}
