import { IStorage } from "../../routes";
import { InsertTrip, Trip } from "@shared/schema";
import { TripLegsService } from "../tripLegs/tripLegs.service";
import { SeatInventoryService } from "../seatInventory/seatInventory.service";

export class TripsService {
  private tripLegsService: TripLegsService;
  private seatInventoryService: SeatInventoryService;

  constructor(private storage: IStorage) {
    this.tripLegsService = new TripLegsService(storage);
    this.seatInventoryService = new SeatInventoryService(storage);
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
    // Create the trip first
    const trip = await this.storage.createTrip(data);
    
    // Auto-initialize trip_stop_times from the pattern's stops
    await this.initializeTripStopTimes(trip.id, trip.patternId);
    
    return trip;
  }

  private async initializeTripStopTimes(tripId: string, patternId: string): Promise<void> {
    // Get pattern stops ordered by sequence
    const patternStops = await this.storage.getPatternStops(patternId);
    
    // Create trip stop times with null times initially
    const tripStopTimesData = patternStops.map(ps => ({
      tripId,
      stopId: ps.stopId,
      stopSequence: ps.stopSequence,
      arriveAt: null,
      departAt: null,
      dwellSeconds: ps.dwellSeconds || 0,
      boardingAllowed: null, // inherit from pattern
      alightingAllowed: null // inherit from pattern
    }));
    
    // Use bulk upsert to create the stop times
    if (tripStopTimesData.length > 0) {
      await this.storage.bulkUpsertTripStopTimes(tripId, tripStopTimesData);
    }
  }

  async updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip> {
    await this.getTripById(id);
    
    // Check if trip has bookings before allowing stop sequence changes
    const hasBookings = await this.storage.tripHasBookings(id);
    if (hasBookings) {
      throw new Error("Cannot modify trip that has existing bookings");
    }
    
    return await this.storage.updateTrip(id, data);
  }

  async deleteTrip(id: string): Promise<void> {
    await this.getTripById(id);
    await this.storage.deleteTrip(id);
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

    // Prefer trip's explicit layoutId; fall back to vehicle's layout
    let resolvedLayoutId = trip.layoutId ?? null;
    if (!resolvedLayoutId && trip.vehicleId) {
      const vehicle = await this.storage.getVehicleById(trip.vehicleId);
      resolvedLayoutId = vehicle?.layoutId ?? null;
    }
    const layout = resolvedLayoutId ? await this.storage.getLayoutById(resolvedLayoutId) : null;
    
    if (!layout) {
      throw new Error("Layout kursi tidak ditemukan. Pastikan trip atau kendaraan memiliki layout yang valid.");
    }

    // Get required leg indexes for this O-D pair
    const legIndexes = [];
    for (let i = originSeq; i < destinationSeq; i++) {
      legIndexes.push(i);
    }

    // Get seat inventory for required legs
    const inventory = await this.storage.getSeatInventory(tripId, legIndexes);
    
    // Get all bookings for this trip to determine booking types and status
    const allBookings = await this.storage.getBookings(tripId);
    const activeBookings = allBookings.filter(booking => 
      booking.status === 'paid' || booking.status === 'pending' || booking.status === 'confirmed'
    );
    
    // Get all trip stop times to understand the full trip coverage
    const tripStopTimes = await this.storage.getTripStopTimes(tripId);
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

    // Create a map of seat bookings for efficiency
    // Also track all booking IDs per seat to detect multi-seat scenario
    const seatBookingMap = new Map<string, { type: 'main' | 'transit'; status: 'pending' | 'paid' }>();
    const seatBookingIds = new Map<string, Set<string>>();
    
    for (const booking of activeBookings) {
      // Check if this booking overlaps with the requested journey
      if (booking.originSeq < destinationSeq && booking.destinationSeq > originSeq) {
        const passengers = await this.storage.getPassengers(booking.id);
        const bookingStopCoverage = booking.destinationSeq - booking.originSeq;
        const totalTripCoverage = totalStops - 1; // Total legs
        
        // If booking covers more than 70% of the trip, consider it "main"
        const bookingType: 'main' | 'transit' = (bookingStopCoverage / totalTripCoverage) > 0.7 ? 'main' : 'transit';
        const bookingStatus: 'pending' | 'paid' = booking.status === 'paid' || booking.status === 'confirmed' ? 'paid' : 'pending';
        
        passengers.forEach(passenger => {
          seatBookingMap.set(passenger.seatNo, { type: bookingType, status: bookingStatus });
          // Track all distinct booking IDs per seat for multi-seat detection
          if (!seatBookingIds.has(passenger.seatNo)) {
            seatBookingIds.set(passenger.seatNo, new Set());
          }
          seatBookingIds.get(passenger.seatNo)!.add(booking.id);
        });
      }
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

    return {
      trip,
      layout,
      seatAvailability,
      legIndexes,
      inventoryInitialized: inventory.length > 0
    };
  }

  async getSeatPassengerDetails(tripId: string, seatNo: string, originSeq: number, destinationSeq: number) {
    // Get required leg indexes for this O-D pair
    const legIndexes = [];
    for (let i = originSeq; i < destinationSeq; i++) {
      legIndexes.push(i);
    }

    // Check if seat is booked for these legs
    const inventory = await this.storage.getSeatInventory(tripId, legIndexes);
    const seatInventory = inventory.filter(inv => inv.seatNo === seatNo && inv.booked);
    
    if (seatInventory.length === 0) {
      return { 
        error: 'Seat not booked or available for this journey',
        available: true 
      };
    }

    // Find bookings for this trip and seat
    const allBookings = await this.storage.getBookings(tripId);
    const seatBookings = [];
    
    // Get all trip stop times to understand the full trip coverage for booking type determination
    const tripStopTimes = await this.storage.getTripStopTimes(tripId);
    const totalStops = tripStopTimes.length;
    
    for (const booking of allBookings) {
      if (booking.status === 'paid' || booking.status === 'pending') {
        const passengers = await this.storage.getPassengers(booking.id);
        const seatPassenger = passengers.find(p => p.seatNo === seatNo);
        
        // Include both overlapping bookings and those that completely cover the journey
        if (seatPassenger && 
            booking.originSeq < destinationSeq && 
            booking.destinationSeq > originSeq) {
          const payments = await this.storage.getPayments(booking.id);
          const originStop = await this.storage.getStopById(booking.originStopId);
          const destinationStop = await this.storage.getStopById(booking.destinationStopId);
          
          // Determine booking type based on trip coverage
          const bookingStopCoverage = booking.destinationSeq - booking.originSeq;
          const totalTripCoverage = totalStops - 1; // Total legs
          const bookingType: 'main' | 'transit' = (bookingStopCoverage / totalTripCoverage) > 0.7 ? 'main' : 'transit';
          
          // Determine overlap type with requested journey
          const overlapType = 
            (booking.originSeq <= originSeq && booking.destinationSeq >= destinationSeq) ? 'covers' :
            (booking.originSeq >= originSeq && booking.destinationSeq <= destinationSeq) ? 'within' :
            (booking.originSeq < originSeq && booking.destinationSeq > originSeq && booking.destinationSeq < destinationSeq) ? 'starts_before' :
            (booking.originSeq > originSeq && booking.originSeq < destinationSeq && booking.destinationSeq > destinationSeq) ? 'ends_after' :
            'partial_overlap';
          
          seatBookings.push({
            booking: {
              ...booking,
              originStop,
              destinationStop,
              bookingType,
              overlapType
            },
            passenger: seatPassenger,
            payments
          });
        }
      }
    }

    if (seatBookings.length === 0) {
      return { 
        error: 'No passenger details found for this seat',
        available: false 
      };
    }

    // Sort bookings by relevance: covers -> within -> partial overlaps
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
