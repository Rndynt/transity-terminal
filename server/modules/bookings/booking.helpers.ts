import { IStorage } from "../../storage.interface";
import { PricingService } from "../pricing/pricing.service";
import { passengers as passengersTable } from "@shared/schema";
import { scheduleStopExceptions } from "@shared/schema/scheduling";
import { generateBookingCode, generateTicketNumber } from "../../utils/codeGenerator";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";

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
