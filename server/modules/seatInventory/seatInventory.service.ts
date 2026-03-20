import { IStorage } from "../../routes";
import { Trip, SeatInventory } from "@shared/schema";

export class SeatInventoryService {
  constructor(private storage: IStorage) {}

  async getSeatInventory(tripId: string, legIndexes?: number[]): Promise<SeatInventory[]> {
    return await this.storage.getSeatInventory(tripId, legIndexes);
  }

  async precomputeInventory(trip: Trip): Promise<void> {
    const vehicle = await this.storage.getVehicleById(trip.vehicleId);
    const resolvedLayoutId = trip.layoutId ?? vehicle?.layoutId ?? null;
    const layout = resolvedLayoutId ? await this.storage.getLayoutById(resolvedLayoutId) : null;
    
    if (!layout) {
      throw new Error("Layout tidak ditemukan. Pastikan trip memiliki layout atau kendaraan memiliki layout yang valid.");
    }

    const legs = await this.storage.getTripLegs(trip.id);
    
    if (legs.length === 0) {
      throw new Error("Trip has no legs. Run derive-legs first.");
    }

    // Build a set of already-booked seat+leg combos from active bookings
    // so we don't wipe booking data when rebuilding inventory
    const bookedKeys = new Set<string>(); // "seatNo:legIndex"
    const activeBookings = await this.storage.getBookings(trip.id);
    const activeStatuses = new Set(['paid', 'confirmed', 'checked_in', 'pending']);

    for (const booking of activeBookings) {
      if (!activeStatuses.has(booking.status)) continue;
      const passengers = await this.storage.getPassengers(booking.id);
      // leg indexes span [originSeq, destinationSeq - 1]
      for (let legIdx = booking.originSeq; legIdx < booking.destinationSeq; legIdx++) {
        for (const p of passengers) {
          bookedKeys.add(`${p.seatNo}:${legIdx}`);
        }
      }
    }

    // Clear existing inventory
    await this.storage.deleteSeatInventory(trip.id);

    // Create inventory entries for each seat-leg combination,
    // restoring the booked=true flag for seats that are already booked
    const seatMap = layout.seatMap as any[];
    const inventoryEntries = [];

    for (const seat of seatMap) {
      if (seat.disabled) continue;

      for (const leg of legs) {
        const isBooked = bookedKeys.has(`${seat.seat_no}:${leg.legIndex}`);
        inventoryEntries.push({
          tripId: trip.id,
          seatNo: seat.seat_no,
          legIndex: leg.legIndex,
          booked: isBooked,
          holdRef: null
        });
      }
    }

    await this.storage.createSeatInventory(inventoryEntries);
  }
}
