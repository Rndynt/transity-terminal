import { IStorage } from "@server/storage.interface";
import { InsertTrip, Trip } from "@shared/schema";
import { TripLegsService } from "@modules/tripLegs/tripLegs.service";
import { SeatInventoryService } from "@modules/seatInventory/seatInventory.service";
import { fireAndForget } from "@server/lib/consoleWebhook";
import { buildScheduleTripPayload } from "@server/lib/scheduleSnapshot";

export class TripsService {
  private tripLegsService: TripLegsService;
  private seatInventoryService: SeatInventoryService;

  constructor(private storage: IStorage) {
    this.tripLegsService = new TripLegsService(storage);
    this.seatInventoryService = new SeatInventoryService(storage);
  }

  private async emitWebhook(
    event: "schedule.created" | "schedule.updated" | "schedule.deleted",
    trip: Trip
  ) {
    try {
      const payload = await buildScheduleTripPayload(this.storage, trip);
      if (!payload) return;
      fireAndForget({ event, trip: payload, emittedAt: new Date().toISOString() });
    } catch (err) {
      console.warn("[trips.service] failed to build webhook payload:", (err as Error).message);
    }
  }

  async getAllTrips(serviceDate?: string): Promise<Trip[]> {
    return await this.storage.getTrips(serviceDate);
  }

  async getCsoAvailableTrips(serviceDate: string, outletId: string) {
    return await this.storage.getCsoAvailableTrips(serviceDate, outletId);
  }

  async getTripById(id: string): Promise<Trip> {
    const trip = await this.storage.getTripById(id);
    if (!trip) {
      throw new Error(`Trip with id ${id} not found`);
    }
    return trip;
  }

  async createTrip(data: InsertTrip): Promise<Trip> {
    const patternStops = await this.storage.getPatternStops(data.patternId);
    
    const trip = await this.storage.createTrip(data);
    
    const tripStopTimesData = patternStops.map(ps => ({
      tripId: trip.id,
      stopId: ps.stopId,
      stopSequence: ps.stopSequence,
      arriveAt: null,
      departAt: null,
      dwellSeconds: ps.dwellSeconds || 0,
      boardingAllowed: null,
      alightingAllowed: null
    }));
    
    if (tripStopTimesData.length > 0) {
      await this.storage.bulkUpsertTripStopTimes(trip.id, tripStopTimesData);
    }

    void this.emitWebhook("schedule.created", trip);
    return trip;
  }

  async updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip> {
    const trip = await this.getTripById(id);
    
    const safeFields = new Set(['driverId', 'status', 'channelFlags']);
    const changedFields = Object.keys(data);
    const hasStructuralChange = changedFields.some(f => !safeFields.has(f));
    
    if (hasStructuralChange) {
      if (data.vehicleId && data.vehicleId !== trip.vehicleId && !data.layoutId && !data.patternId) {
        const newVehicle = await this.storage.getVehicleById(data.vehicleId);
        const currentVehicle = trip.vehicleId ? await this.storage.getVehicleById(trip.vehicleId) : null;
        if (newVehicle && currentVehicle && newVehicle.layoutId === currentVehicle.layoutId) {
          const onlyVehicleAndSafe = changedFields.every(f => f === 'vehicleId' || safeFields.has(f));
          if (onlyVehicleAndSafe) {
            (data as any).snapVehiclePlate = newVehicle.plate;
          } else {
            const hasBookings = await this.storage.tripHasBookings(id);
            if (hasBookings) {
              throw new Error("Tidak bisa mengubah struktur trip (layout, pola) jika sudah ada booking aktif");
            }
            (data as any).snapVehiclePlate = newVehicle.plate;
          }
        } else {
          const hasBookings = await this.storage.tripHasBookings(id);
          if (hasBookings) {
            throw new Error("Tidak bisa mengganti kendaraan dengan layout berbeda jika sudah ada booking aktif. Gunakan kendaraan dengan layout yang sama.");
          }
          if (newVehicle) {
            (data as any).snapVehiclePlate = newVehicle.plate;
            (data as any).layoutId = newVehicle.layoutId;
            (data as any).capacity = newVehicle.capacity;
          }
        }
      } else {
        const hasBookings = await this.storage.tripHasBookings(id);
        if (hasBookings) {
          throw new Error("Tidak bisa mengubah struktur trip (kendaraan, layout, pola) jika sudah ada booking aktif");
        }
      }
    }

    if (data.driverId && data.driverId !== trip.driverId) {
      const driver = await this.storage.getDriverById(data.driverId);
      (data as any).snapDriverName = driver?.name || null;
    }
    if (data.driverId === null) {
      (data as any).snapDriverName = null;
    }
    
    const updated = await this.storage.updateTrip(id, data);
    void this.emitWebhook("schedule.updated", updated);
    return updated;
  }

  async deleteTrip(id: string): Promise<void> {
    const trip = await this.getTripById(id);
    await this.storage.deleteTrip(id);
    void this.emitWebhook("schedule.deleted", trip);
  }

  async deriveLegs(tripId: string): Promise<void> {
    const trip = await this.getTripById(tripId);
    await this.tripLegsService.deriveLegsFromTrip(trip);
  }

  async precomputeSeatInventory(tripId: string): Promise<void> {
    const trip = await this.getTripById(tripId);
    await this.seatInventoryService.precomputeInventory(trip);
  }

  async validateTripStopTimes(tripId: string): Promise<{ valid: boolean; errors: Array<{ stopSequence: number; field: string; message: string }> }> {
    const stopTimes = await this.storage.getTripStopTimes(tripId);
    const errors: Array<{ stopSequence: number; field: string; message: string }> = [];

    if (stopTimes.length < 2) {
      errors.push({ stopSequence: 0, field: 'general', message: 'Trip must have at least 2 stops' });
      return { valid: false, errors };
    }

    // Sort by sequence for validation
    const sortedStopTimes = stopTimes.sort((a, b) => a.stopSequence - b.stopSequence);
    
    for (let i = 0; i < sortedStopTimes.length; i++) {
      const stopTime = sortedStopTimes[i];
      const sequence = stopTime.stopSequence;
      const isFirst = i === 0;
      const isLast = i === sortedStopTimes.length - 1;
      
      // First stop: departure time required
      if (isFirst) {
        if (!stopTime.departAt) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'First stop must have departure time' 
          });
        }
      }
      
      // Last stop: arrival time required
      if (isLast) {
        if (!stopTime.arriveAt) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'arriveAt', 
            message: 'Last stop must have arrival time' 
          });
        }
      }
      
      // Middle stops: if either time is provided, both must be provided
      if (!isFirst && !isLast) {
        const hasArrival = stopTime.arriveAt !== null;
        const hasDeparture = stopTime.departAt !== null;
        
        if (hasArrival && !hasDeparture) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'Departure time required when arrival time is set' 
          });
        }
        
        if (hasDeparture && !hasArrival) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'arriveAt', 
            message: 'Arrival time required when departure time is set' 
          });
        }
      }
      
      // Validate departure >= arrival at same stop
      if (stopTime.arriveAt && stopTime.departAt) {
        if (new Date(stopTime.departAt) < new Date(stopTime.arriveAt)) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'Departure time must be after arrival time' 
          });
        }
      }
      
      // Validate chronological order with previous stop
      if (i > 0) {
        const prevStopTime = sortedStopTimes[i - 1];
        const prevDepartTime = prevStopTime.departAt;
        const currentArriveTime = stopTime.arriveAt;
        
        if (prevDepartTime && currentArriveTime) {
          if (new Date(currentArriveTime) < new Date(prevDepartTime)) {
            errors.push({ 
              stopSequence: sequence, 
              field: 'arriveAt', 
              message: 'Arrival time must be after previous stop departure time' 
            });
          }
        }
        
        // Also check dwell time compliance
        if (prevStopTime.departAt && prevStopTime.arriveAt && stopTime.arriveAt) {
          const prevDwell = prevStopTime.dwellSeconds || 0;
          const expectedMinDepart = new Date(new Date(prevStopTime.arriveAt).getTime() + prevDwell * 1000);
          
          if (new Date(prevStopTime.departAt) < expectedMinDepart) {
            errors.push({ 
              stopSequence: prevStopTime.stopSequence, 
              field: 'departAt', 
              message: `Departure time must account for ${prevDwell} second dwell time` 
            });
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async getSeatmap(tripId: string, originSeq: number, destinationSeq: number) {
    const trip = await this.getTripById(tripId);

    let resolvedLayoutId = trip.layoutId ?? null;
    if (!resolvedLayoutId && trip.vehicleId) {
      const vehicle = await this.storage.getVehicleById(trip.vehicleId);
      resolvedLayoutId = vehicle?.layoutId ?? null;
    }

    const legIndexes = [];
    for (let i = originSeq; i < destinationSeq; i++) {
      legIndexes.push(i);
    }

    const [layout, inventory, activeBookings, tripStopTimes] = await Promise.all([
      resolvedLayoutId ? this.storage.getLayoutById(resolvedLayoutId) : null,
      this.storage.getSeatInventory(tripId, legIndexes),
      this.storage.getActiveBookingsForTrip(tripId),
      this.storage.getTripStopTimes(tripId)
    ]);
    
    if (!layout) {
      throw new Error("Layout kursi tidak ditemukan. Pastikan trip atau kendaraan memiliki layout yang valid.");
    }
    const totalStops = tripStopTimes.length;
    
    // Initialize all seats as available
    const seatAvailability: Record<string, { 
      available: boolean; 
      held: boolean; 
      holdRef?: string; 
      bookedType?: 'main' | 'transit' | null;
      bookingStatus?: 'pending' | 'paid' | null;
      isMultiSeat?: boolean;
    }> = {};
    
    const seatMap = layout.seatMap as any[];
    seatMap.forEach(seat => {
      seatAvailability[seat.seat_no] = { available: true, held: false, bookedType: null, bookingStatus: null, isMultiSeat: false };
    });

    const seatBookingMap = new Map<string, { type: 'main' | 'transit'; status: 'pending' | 'paid' }>();
    const seatBookingIds = new Map<string, Set<string>>();
    
    const overlappingBookings = activeBookings.filter(
      booking => booking.originSeq < destinationSeq && booking.destinationSeq > originSeq
    );
    
    const allPassengers = overlappingBookings.length > 0
      ? await this.storage.getPassengersByBookingIds(overlappingBookings.map(b => b.id))
      : [];
    const passengersByBooking = new Map<string, typeof allPassengers>();
    for (const p of allPassengers) {
      const list = passengersByBooking.get(p.bookingId) || [];
      list.push(p);
      passengersByBooking.set(p.bookingId, list);
    }
    
    for (const booking of overlappingBookings) {
      const passengers = passengersByBooking.get(booking.id) || [];
      const bookingStopCoverage = booking.destinationSeq - booking.originSeq;
      const totalTripCoverage = totalStops - 1;
      
      const bookingType: 'main' | 'transit' = (bookingStopCoverage / totalTripCoverage) > 0.7 ? 'main' : 'transit';
      const bookingStatus: 'pending' | 'paid' = booking.status === 'paid' || booking.status === 'confirmed' ? 'paid' : 'pending';
      
      passengers.forEach(passenger => {
        seatBookingMap.set(passenger.seatNo, { type: bookingType, status: bookingStatus });
        if (!seatBookingIds.has(passenger.seatNo)) {
          seatBookingIds.set(passenger.seatNo, new Set());
        }
        seatBookingIds.get(passenger.seatNo)!.add(booking.id);
      });
    }

    // Check each required leg for seat availability and determine booking type
    // A seat is "multi-seat" if it is occupied by more than one distinct booking
    // (i.e. different passengers sharing the same seat on different sub-legs)
    inventory.forEach(inv => {
      if (inv.booked) {
        const bookingInfo = seatBookingMap.get(inv.seatNo);
        const bookingCount = seatBookingIds.get(inv.seatNo)?.size ?? 0;
        seatAvailability[inv.seatNo] = { 
          available: false, 
          held: false, 
          bookedType: bookingInfo?.type || null,
          bookingStatus: bookingInfo?.status || null,
          isMultiSeat: bookingCount > 1
        };
      } else if (inv.holdRef) {
        seatAvailability[inv.seatNo] = { 
          available: false, 
          held: true, 
          holdRef: inv.holdRef,
          bookedType: null,
          bookingStatus: null,
          isMultiSeat: false
        };
      }
    });

    // Safety fallback: if a seat appears in active bookings but inventory.booked
    // was wrongly reset (e.g. precompute ran after booking), still mark it unavailable.
    // This prevents "phantom available" seats when inventory gets rebuilt.
    for (const [seatNo, bookingInfo] of seatBookingMap.entries()) {
      if (seatAvailability[seatNo]?.available) {
        const bookingCount = seatBookingIds.get(seatNo)?.size ?? 0;
        seatAvailability[seatNo] = {
          available: false,
          held: false,
          bookedType: bookingInfo.type,
          bookingStatus: bookingInfo.status,
          isMultiSeat: bookingCount > 1
        };
      }
    }

    return {
      trip,
      layout,
      seatAvailability,
      legIndexes,
      inventoryInitialized: inventory.length > 0
    };
  }

  async getSeatPassengerDetails(tripId: string, seatNo: string, originSeq: number, destinationSeq: number) {
    const [activeBookings, tripStopTimes, trip] = await Promise.all([
      this.storage.getActiveBookingsForTrip(tripId),
      this.storage.getTripStopTimes(tripId),
      this.storage.getTripById(tripId)
    ]);
    const seatBookings: Array<{
      booking: typeof activeBookings[number] & {
        originStop: unknown;
        destinationStop: unknown;
        bookingType: 'main' | 'transit';
        overlapType: 'covers' | 'within' | 'starts_before' | 'ends_after' | 'partial_overlap';
        outlet: unknown;
        vehicle: unknown;
        departAt: unknown;
        arriveAt: unknown;
      };
      passenger: typeof allPassengers[number];
      otherPassengers: unknown[];
      payments: unknown[];
    }> = [];
    const totalStops = tripStopTimes.length;

    const activeBookingIds = activeBookings.map(b => b.id);

    const allPassengers = activeBookingIds.length > 0
      ? await this.storage.getPassengersByBookingIds(activeBookingIds)
      : [];
    const passengersByBooking = new Map<string, typeof allPassengers>();
    for (const p of allPassengers) {
      const list = passengersByBooking.get(p.bookingId) || [];
      list.push(p);
      passengersByBooking.set(p.bookingId, list);
    }

    const matchingBookings = activeBookings.filter(booking => {
      const passengers = passengersByBooking.get(booking.id) || [];
      return passengers.some(p => p.seatNo === seatNo) &&
        booking.originSeq < destinationSeq && booking.destinationSeq > originSeq;
    });

    if (matchingBookings.length > 0) {
      const stopIds = [...new Set(matchingBookings.flatMap(b => [b.originStopId, b.destinationStopId]))];
      const outletIds = [...new Set(matchingBookings.map(b => b.outletId).filter(Boolean))] as string[];

      const matchingBookingIds = matchingBookings.map(b => b.id);
      const [stopsData, outletsData, allPayments, vehicle, allPromoApps] = await Promise.all([
        this.storage.getStopsByIds(stopIds),
        outletIds.length > 0 ? this.storage.getOutletsByIds(outletIds) : Promise.resolve([]),
        this.storage.getPaymentsByBookingIds(matchingBookingIds),
        trip?.vehicleId ? this.storage.getVehicleById(trip.vehicleId) : Promise.resolve(null),
        this.storage.getBookingPromoApplicationsWithNameForBookings(matchingBookingIds),
      ]);
      const promoAppsByBooking = new Map<string, Array<{ promoName: string; source: 'auto' | 'manual'; discountAmount: number; voucherCode: string | null }>>();
      for (const a of allPromoApps) {
        const list = promoAppsByBooking.get(a.bookingId) || [];
        list.push({
          promoName: a.promoName,
          source: a.source as 'auto' | 'manual',
          discountAmount: Number(a.discountAmount),
          voucherCode: a.voucherCode,
        });
        promoAppsByBooking.set(a.bookingId, list);
      }

      const stopsMap = new Map<string, any>();
      stopsData.forEach((s: any) => { if (s) stopsMap.set(s.id, s); });
      const outletsMap = new Map<string, any>();
      outletsData.forEach((o: any) => { if (o) outletsMap.set(o.id, o); });
      const paymentsByBooking = new Map<string, any[]>();
      for (const p of allPayments) {
        const list = paymentsByBooking.get(p.bookingId) || [];
        list.push(p);
        paymentsByBooking.set(p.bookingId, list);
      }

      matchingBookings.forEach((booking) => {
        const passengers = passengersByBooking.get(booking.id) || [];
        const seatPassenger = passengers.find(p => p.seatNo === seatNo);
        if (!seatPassenger) return;

        const originStop = stopsMap.get(booking.originStopId);
        const destinationStop = stopsMap.get(booking.destinationStopId);
        const payments = paymentsByBooking.get(booking.id) || [];

        const bookingStopCoverage = booking.destinationSeq - booking.originSeq;
        const totalTripCoverage = totalStops - 1;
        const bookingType: 'main' | 'transit' = (bookingStopCoverage / totalTripCoverage) > 0.7 ? 'main' : 'transit';

        const overlapType =
          (booking.originSeq <= originSeq && booking.destinationSeq >= destinationSeq) ? 'covers' :
          (booking.originSeq >= originSeq && booking.destinationSeq <= destinationSeq) ? 'within' :
          (booking.originSeq < originSeq && booking.destinationSeq > originSeq && booking.destinationSeq < destinationSeq) ? 'starts_before' :
          (booking.originSeq > originSeq && booking.originSeq < destinationSeq && booking.destinationSeq > destinationSeq) ? 'ends_after' :
          'partial_overlap';

        const outlet = booking.outletId ? outletsMap.get(booking.outletId) : null;

        let departAt = null;
        let arriveAt = null;
        if (booking.originSeq) {
          const originTime = tripStopTimes.find(st => st.stopSequence === booking.originSeq);
          if (originTime?.departAt) departAt = originTime.departAt;
        }
        if (booking.destinationSeq) {
          const destTime = tripStopTimes.find(st => st.stopSequence === booking.destinationSeq);
          if (destTime?.arriveAt) arriveAt = destTime.arriveAt;
        }

        const otherPassengers = passengers
          .filter(p => p.id !== seatPassenger.id)
          .map(p => ({
            id: p.id,
            fullName: p.fullName,
            seatNo: p.seatNo,
            phone: p.phone,
            ticketNumber: p.ticketNumber,
            ticketStatus: p.ticketStatus,
            fareAmount: p.fareAmount
          }));

        seatBookings.push({
          booking: {
            ...booking,
            originStop,
            destinationStop,
            bookingType,
            overlapType,
            outlet,
            vehicle,
            departAt,
            arriveAt,
            promoApplications: promoAppsByBooking.get(booking.id) || [],
          } as any,
          passenger: seatPassenger,
          otherPassengers,
          payments
        });
      });
    }

    if (seatBookings.length === 0) {
      return {
        error: 'No passenger details found for this seat',
        available: false
      };
    }

    seatBookings.sort((a, b) => {
      const relevanceOrder = { covers: 0, within: 1, starts_before: 2, ends_after: 3, partial_overlap: 4 };
      const aRelevance = relevanceOrder[a.booking.overlapType as keyof typeof relevanceOrder] || 99;
      const bRelevance = relevanceOrder[b.booking.overlapType as keyof typeof relevanceOrder] || 99;
      return aRelevance - bRelevance;
    });

    return {
      seatNo,
      bookings: seatBookings,
      available: false
    };
  }
}
