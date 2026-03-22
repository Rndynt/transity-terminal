import { IStorage } from "../../routes";
import { Trip, SeatInventory } from "@shared/schema";
import { db } from "../../db";
import { seatInventory, seatHolds } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

export class SeatInventoryService {
  constructor(private storage: IStorage) {}

  async getSeatInventory(tripId: string, legIndexes?: number[]): Promise<SeatInventory[]> {
    return await this.storage.getSeatInventory(tripId, legIndexes);
  }

  async precomputeInventory(trip: Trip): Promise<void> {
    const vehicle = await this.storage.getVehicleById(trip.vehicleId);
    const resolvedLayoutId = trip.layoutId ?? vehicle?.layoutId ?? null;
    const [layout, legs, activeBookings] = await Promise.all([
      resolvedLayoutId ? this.storage.getLayoutById(resolvedLayoutId) : Promise.resolve(null),
      this.storage.getTripLegs(trip.id),
      this.storage.getBookings(trip.id)
    ]);
    
    if (!layout) {
      throw new Error("Layout tidak ditemukan. Pastikan trip memiliki layout atau kendaraan memiliki layout yang valid.");
    }

    if (legs.length === 0) {
      throw new Error("Trip has no legs. Run derive-legs first.");
    }

    const bookedKeys = new Set<string>();
    const activeStatuses = new Set(['paid', 'confirmed', 'checked_in', 'pending']);
    const relevantBookings = activeBookings.filter(b => activeStatuses.has(b.status));
    
    if (relevantBookings.length > 0) {
      const allPassengers = await this.storage.getPassengersByBookingIds(
        relevantBookings.map(b => b.id)
      );
      const passengersByBooking = new Map<string, typeof allPassengers>();
      for (const p of allPassengers) {
        const list = passengersByBooking.get(p.bookingId) || [];
        list.push(p);
        passengersByBooking.set(p.bookingId, list);
      }

      for (const booking of relevantBookings) {
        const passengers = passengersByBooking.get(booking.id) || [];
        for (let legIdx = booking.originSeq; legIdx < booking.destinationSeq; legIdx++) {
          for (const p of passengers) {
            bookedKeys.add(`${p.seatNo}:${legIdx}`);
          }
        }
      }
    }

    await db.transaction(async (tx) => {
      const activeHolds = await tx
        .select({
          holdRef: seatHolds.holdRef,
          seatNo: seatHolds.seatNo,
          legIndexes: seatHolds.legIndexes
        })
        .from(seatHolds)
        .where(and(
          eq(seatHolds.tripId, trip.id),
          gt(seatHolds.expiresAt, new Date())
        ));

      const holdRefMap = new Map<string, string>();
      for (const hold of activeHolds) {
        for (const legIdx of hold.legIndexes) {
          holdRefMap.set(`${hold.seatNo}:${legIdx}`, hold.holdRef);
        }
      }

      const seatMap = layout.seatMap as any[];
      const inventoryEntries = [];

      for (const seat of seatMap) {
        if (seat.disabled) continue;
        for (const leg of legs) {
          const key = `${seat.seat_no}:${leg.legIndex}`;
          const isBooked = bookedKeys.has(key);
          const preservedHoldRef = holdRefMap.get(key) || null;
          inventoryEntries.push({
            tripId: trip.id,
            seatNo: seat.seat_no,
            legIndex: leg.legIndex,
            booked: isBooked,
            holdRef: isBooked ? null : preservedHoldRef
          });
        }
      }

      await tx.delete(seatInventory).where(eq(seatInventory.tripId, trip.id));
      if (inventoryEntries.length > 0) {
        await tx.insert(seatInventory).values(inventoryEntries);
      }
    });
  }
}
