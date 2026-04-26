import { IStorage } from "@server/storage.interface";
import { PricingService } from "@modules/pricing/pricing.service";
import { PromosService, type PromoApplicationItem, type PromoValidationResult } from "@modules/promos/promos.service";
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
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_PRICE_RULE') {
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
    const originST = stopTimes.find(st => st.stopSequence === originSeq);
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
  fareQuote: { perPassenger: string | number; breakdown: unknown }
) {
  if (passengers.length === 0) return;
  // Bulk insert: 1 round-trip per booking (vs N round-trip sebelumnya).
  await tx.insert(passengersTable).values(
    passengers.map((pax) => ({
      bookingId,
      ticketNumber: generateTicketNumber(),
      fullName: pax.fullName,
      phone: pax.phone,
      idNumber: pax.idNumber,
      seatNo: pax.seatNo,
      fareAmount: fareQuote.perPassenger.toString(),
      fareBreakdown: fareQuote.breakdown,
    }))
  );
}

export async function validateBoardingAlighting(
  storage: IStorage,
  tripId: string,
  originSeq: number,
  destinationSeq: number
): Promise<void> {
  const stopTimes = await storage.getTripStopTimesWithEffectiveFlags(tripId);

  const originStop = stopTimes.find((st) => st.stopSequence === originSeq);
  const destinationStop = stopTimes.find((st) => st.stopSequence === destinationSeq);

  if (!originStop) {
    throw new Error(`Origin stop at sequence ${originSeq} not found`);
  }
  if (!destinationStop) {
    throw new Error(`Destination stop at sequence ${destinationSeq} not found`);
  }

  if (!originStop.effectiveBoardingAllowed) {
    const error: Error & { code?: string } = new Error('Boarding not allowed at this stop');
    error.code = 'boarding-not-allowed';
    throw error;
  }
  if (!destinationStop.effectiveAlightingAllowed) {
    const error: Error & { code?: string } = new Error('Alighting not allowed at this stop');
    error.code = 'alighting-not-allowed';
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
        const error: Error & { code?: string } = new Error('Titik naik ini ditutup sementara oleh operasional');
        error.code = 'stop-closed-by-ops';
        throw error;
      }
      if (ex.stopId === destinationStop.stopId && ex.disableAlighting) {
        const error: Error & { code?: string } = new Error('Titik turun ini ditutup sementara oleh operasional');
        error.code = 'stop-closed-by-ops';
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
  // B2: lock the affected seat_inventory rows first and assert none of them
  // are already booked. This closes the race window between
  // validateHoldOwnership() (run outside the tx) and the actual confirm.
  const lockedRows = await tx
    .select({ seatNo: seatInventory.seatNo, legIndex: seatInventory.legIndex, booked: seatInventory.booked })
    .from(seatInventory)
    .where(and(
      eq(seatInventory.tripId, tripId),
      inArray(seatInventory.seatNo, seatNos),
      inArray(seatInventory.legIndex, legIndexes)
    ))
    .for('update');

  const expected = seatNos.length * legIndexes.length;
  if (lockedRows.length !== expected) {
    throw new Error(`Seat inventory mismatch: expected ${expected} rows, found ${lockedRows.length}`);
  }
  const conflict = lockedRows.find(r => r.booked === true);
  if (conflict) {
    throw new Error(`Seat ${conflict.seatNo} (leg ${conflict.legIndex}) is already booked`);
  }

  // B2 (additional): also lock the seat_holds rows for this operator and
  // re-assert ownership *under the same transaction*. This catches the case
  // where the hold expired (and was either reaped by the scheduler or grabbed
  // by another operator) between the outer validateHoldOwnership() call and
  // this confirm. We require that every seat being booked still has a live
  // hold owned by the caller.
  const lockedHolds = await tx
    .select({ seatNo: seatHolds.seatNo, legIndexes: seatHolds.legIndexes, expiresAt: seatHolds.expiresAt })
    .from(seatHolds)
    .where(and(
      eq(seatHolds.tripId, tripId),
      inArray(seatHolds.seatNo, seatNos),
      eq(seatHolds.operatorId, operatorId),
      gt(seatHolds.expiresAt, new Date())
    ))
    .for('update');

  const heldBySeat = new Map(lockedHolds.map(h => [h.seatNo, h]));
  for (const seatNo of seatNos) {
    const h = heldBySeat.get(seatNo);
    if (!h) {
      throw new Error(`Seat ${seatNo} hold ownership lost (expired or taken by another operator)`);
    }
    const holdLegs = (h.legIndexes as number[]) || [];
    if (!legIndexes.every(leg => holdLegs.includes(leg))) {
      throw new Error(`Seat ${seatNo} hold no longer covers all required legs`);
    }
  }

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
  promoValidation: PromoValidationResult | undefined;
  applications: PromoApplicationItem[];
}

export async function calculateBookingTotal(
  storage: IStorage,
  tripId: string,
  originSeq: number,
  destinationSeq: number,
  passengerCount: number,
  channel?: string,
  promoCode?: string,
  outletId?: string,
  salesChannelCode?: string,
  opts?: { autoApplyIfNoCode?: boolean }
): Promise<{ fareQuote: Awaited<ReturnType<PricingService['quoteFare']>>; subtotal: number; total: number; promo: PromoResult }> {
  const fareQuote = await quoteFareForBooking(storage, tripId, originSeq, destinationSeq);
  const subtotal = Number(fareQuote.total) * passengerCount;

  let discountAmount = 0;
  let promoId: string | undefined;
  let voucherCode: string | undefined;
  let promoValidation: PromoValidationResult | undefined;
  let applications: PromoApplicationItem[] = [];

  // Lazy-load trip hanya kalau dibutuhkan promo flow
  const promosService = new PromosService(storage);
  let tripCached: Awaited<ReturnType<IStorage['getTripById']>> | undefined;
  const getTrip = async () => {
    if (tripCached === undefined) tripCached = await storage.getTripById(tripId);
    return tripCached;
  };

  if (promoCode) {
    const trip = await getTrip();
    promoValidation = await promosService.validateAndCalculateDiscount(
      promoCode,
      subtotal,
      {
        channel,
        tripId,
        patternId: trip?.patternId || undefined,
        outletId,
        salesChannelCode,
        departureDate: trip?.serviceDate || undefined,
      }
    );
    if (!promoValidation.valid) {
      throw new Error(promoValidation.error || 'Kode promo tidak valid');
    }
    discountAmount = promoValidation.discountAmount;
    promoId = promoValidation.promotion?.id;
    if (promoValidation.voucher) {
      voucherCode = promoValidation.voucher.code;
    }
    applications = promoValidation.applications ?? [];
  } else if (opts?.autoApplyIfNoCode) {
    try {
      const trip = await getTrip();
      const best = await promosService.findBestAutoApplicablePromo(subtotal, {
        channel,
        tripId,
        patternId: trip?.patternId || undefined,
        outletId,
        salesChannelCode,
        departureDate: trip?.serviceDate || undefined,
      });
      if (best) {
        discountAmount = best.discountAmount;
        promoId = best.promotion.id;
        applications = [{
          promoId: best.promotion.id,
          promoCode: best.promotion.code,
          source: 'auto',
          discountAmount: best.discountAmount,
        }];
      }
    } catch (err) {
      console.warn('[calculateBookingTotal] auto-apply lookup failed:', err);
    }
  }

  return {
    fareQuote,
    subtotal,
    total: subtotal - discountAmount,
    promo: { discountAmount, promoId, voucherCode, promoValidation, applications },
  };
}
