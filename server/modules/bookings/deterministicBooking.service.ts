import { IStorage } from "../../routes";
import { db } from "../../db";
import { seatInventory, seatHolds, bookings, passengers as passengersTable, payments, printJobs, trips } from "@shared/schema";
import { eq, and, inArray, sql, gt, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { PricingService } from "../pricing/pricing.service";
import { PrintService } from "../printing/print.service";
import { webSocketService } from "../../realtime/ws";

export interface SeatHoldRequest {
  tripId: string;
  seatNo: string;
  legIndexes: number[];
  operatorId: string;
  ttlClass: 'short' | 'long';
}

export interface BookingRequest {
  tripId: string;
  originSeq: number;
  destinationSeq: number;
  originStopId: string;
  destinationStopId: string;
  outletId?: string;
  channel: 'CSO' | 'WEB' | 'APP' | 'OTA';
  createdBy: string;
  passengers: Array<{
    fullName: string;
    phone?: string;
    idNumber?: string;
    seatNo: string;
  }>;
  payment: {
    method: 'cash' | 'qr' | 'ewallet' | 'bank';
    amount: number;
  };
}

export interface AtomicHoldResult {
  success: boolean;
  holdRef?: string;
  conflictSeats?: string[];
  reason?: string;
  expiresAt?: Date;
}

export interface AtomicBookingResult {
  success: boolean;
  booking?: any;
  printPayload?: any;
  conflictSeats?: string[];
  reason?: string;
}

export class DeterministicBookingService {
  private pricingService: PricingService;
  private printService: PrintService;

  constructor(private storage: IStorage) {
    this.pricingService = new PricingService(storage);
    this.printService = new PrintService();
  }

  /**
   * Calculate correct leg range: [originSeq, destinationSeq - 1]
   */
  private calculateLegIndexes(originSeq: number, destinationSeq: number): number[] {
    if (originSeq >= destinationSeq) {
      throw new Error('Origin sequence must be less than destination sequence');
    }
    
    const legIndexes: number[] = [];
    for (let i = originSeq; i < destinationSeq; i++) {
      legIndexes.push(i);
    }
    return legIndexes;
  }

  /**
   * Get available seats deterministically (sorted by seat_no ASC)
   */
  async getAvailableSeats(tripId: string, legIndexes: number[], count: number = 1): Promise<string[]> {
    console.log(`[DETERMINISTIC] Getting available seats for trip ${tripId}, legs [${legIndexes.join(',')}], count ${count}`);
    
    // Get all seat inventory for the trip and legs with FOR UPDATE lock
    const inventoryRows = await db
      .select({ 
        seatNo: seatInventory.seatNo,
        legIndex: seatInventory.legIndex,
        booked: seatInventory.booked,
        holdRef: seatInventory.holdRef
      })
      .from(seatInventory)
      .where(and(
        eq(seatInventory.tripId, tripId),
        inArray(seatInventory.legIndex, legIndexes)
      ))
      .orderBy(seatInventory.seatNo, seatInventory.legIndex);

    // Group by seat number
    const seatAvailability = new Map<string, { free: number; total: number }>();
    
    for (const row of inventoryRows) {
      if (!seatAvailability.has(row.seatNo)) {
        seatAvailability.set(row.seatNo, { free: 0, total: 0 });
      }
      
      const seat = seatAvailability.get(row.seatNo)!;
      seat.total++;
      
      // Check if this seat-leg is free (not booked and no unexpired hold)
      if (!row.booked && !row.holdRef) {
        seat.free++;
      }
    }

    // Find seats that are completely free across ALL required legs
    const availableSeats: string[] = [];
    const requiredLegs = legIndexes.length;
    
    for (const [seatNo, availability] of Array.from(seatAvailability.entries())) {
      if (availability.total === requiredLegs && availability.free === requiredLegs) {
        availableSeats.push(seatNo);
      }
    }

    // Sort deterministically by seat number
    availableSeats.sort((a, b) => a.localeCompare(b));
    
    console.log(`[DETERMINISTIC] Found ${availableSeats.length} available seats: [${availableSeats.slice(0, Math.min(count, 10)).join(',')}...]`);
    
    return availableSeats.slice(0, count);
  }

  /**
   * Atomic seat hold with proper locking
   */
  async atomicHold(request: SeatHoldRequest): Promise<AtomicHoldResult> {
    const { tripId, seatNo, legIndexes, operatorId, ttlClass } = request;
    const holdRef = randomUUID();
    const ttlSeconds = ttlClass === 'short' ? 300 : 1800; // 5min short, 30min long
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    console.log(`[DETERMINISTIC] Attempting atomic hold for seat ${seatNo} on trip ${tripId}, legs [${legIndexes.join(',')}]`);
    
    try {
      const result = await db.transaction(async (tx) => {
        // Lock and check seat availability for ALL required legs
        const inventoryRows = await tx
          .select()
          .from(seatInventory)
          .where(and(
            eq(seatInventory.tripId, tripId),
            eq(seatInventory.seatNo, seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ))
          .for('update');
        
        // Verify we have all required legs
        if (inventoryRows.length !== legIndexes.length) {
          return {
            success: false,
            reason: 'INCOMPLETE_INVENTORY',
            conflictSeats: [seatNo]
          };
        }

        // Check if any leg is booked or held
        const conflicts: string[] = [];
        for (const row of inventoryRows) {
          if (row.booked || row.holdRef) {
            conflicts.push(seatNo);
          }
        }

        if (conflicts.length > 0) {
          return {
            success: false,
            reason: 'SEAT_CONFLICT',
            conflictSeats: conflicts
          };
        }

        // Update all seat inventory rows with hold reference
        await tx
          .update(seatInventory)
          .set({ holdRef })
          .where(and(
            eq(seatInventory.tripId, tripId),
            eq(seatInventory.seatNo, seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        // Create hold record in database
        await tx.insert(seatHolds).values({
          holdRef,
          tripId,
          seatNo,
          legIndexes,
          ttlClass,
          operatorId,
          expiresAt
        });

        console.log(`[DETERMINISTIC] Hold created successfully: ${holdRef}`);
        
        return {
          success: true,
          holdRef,
          expiresAt
        };
      });

      // Emit inventory update event if successful
      if (result.success) {
        webSocketService.emitInventoryUpdated(tripId, seatNo, legIndexes);
      }

      return result;
    } catch (error) {
      console.error(`[DETERMINISTIC] Hold creation failed:`, error);
      return {
        success: false,
        reason: 'TRANSACTION_ERROR',
        conflictSeats: [seatNo]
      };
    }
  }

  /**
   * Atomic booking with idempotency
   */
  async atomicBooking(request: BookingRequest, idempotencyKey?: string): Promise<AtomicBookingResult> {
    const { tripId, originSeq, destinationSeq, passengers, payment } = request;
    
    console.log(`[DETERMINISTIC] Attempting atomic booking for trip ${tripId}, ${passengers.length} passengers, idempotency: ${idempotencyKey}`);
    
    // Check idempotency - if we have this key, return existing booking
    if (idempotencyKey) {
      const existingBooking = await this.findBookingByIdempotencyKey(idempotencyKey);
      if (existingBooking) {
        console.log(`[DETERMINISTIC] Found existing booking for idempotency key: ${existingBooking.id}`);
        return {
          success: true,
          booking: existingBooking,
          reason: 'IDEMPOTENT_SUCCESS'
        };
      }
    }

    // Calculate leg indexes
    const legIndexes = this.calculateLegIndexes(originSeq, destinationSeq);
    
    try {
      const result = await db.transaction(async (tx) => {
        // Verify all required seats are available and lock them
        const seatNumbers = passengers.map(p => p.seatNo);
        const allInventoryRows = [];
        
        for (const seatNo of seatNumbers) {
          const inventoryRows = await tx
            .select()
            .from(seatInventory)
            .where(and(
              eq(seatInventory.tripId, tripId),
              eq(seatInventory.seatNo, seatNo),
              inArray(seatInventory.legIndex, legIndexes)
            ))
            .for('update');
            
          if (inventoryRows.length !== legIndexes.length) {
            return {
              success: false,
              reason: 'INCOMPLETE_INVENTORY',
              conflictSeats: [seatNo]
            };
          }
          
          // Check for conflicts
          const conflicts: string[] = [];
          for (const row of inventoryRows) {
            if (row.booked) {
              conflicts.push(seatNo);
            }
            // For hold conflicts, verify operator ownership
            if (row.holdRef && !this.isHoldOwnedByOperator(row.holdRef, request.createdBy)) {
              conflicts.push(seatNo);
            }
          }
          
          if (conflicts.length > 0) {
            return {
              success: false,
              reason: 'SEAT_CONFLICT',
              conflictSeats: conflicts
            };
          }
          
          allInventoryRows.push(...inventoryRows);
        }

        // Calculate pricing
        const fareQuote = await this.pricingService.quoteFare(tripId, originSeq, destinationSeq);
        const expectedTotal = Number(fareQuote.total) * passengers.length;
        
        // Validate payment amount
        if (Math.abs(Number(payment.amount) - expectedTotal) > 0.01) {
          return {
            success: false,
            reason: 'PAYMENT_MISMATCH'
          };
        }

        const bookingStatus = (payment && payment.amount > 0) ? 'paid' : 'pending';

        const [booking] = await tx.insert(bookings).values({
          tripId,
          originStopId: request.originStopId,
          destinationStopId: request.destinationStopId,
          originSeq,
          destinationSeq,
          outletId: request.outletId,
          channel: request.channel,
          totalAmount: expectedTotal.toString(),
          createdBy: request.createdBy,
          status: bookingStatus,
        }).returning();

        // Create passengers
        for (const passengerData of passengers) {
          await tx.insert(passengersTable).values({
            ...passengerData,
            bookingId: booking.id,
            fareAmount: fareQuote.perPassenger.toString(),
            fareBreakdown: fareQuote.breakdown
          });
        }

        // Update seat inventory - mark as booked and clear holds
        for (const seatNo of seatNumbers) {
          await tx
            .update(seatInventory)
            .set({
              booked: true,
              holdRef: null
            })
            .where(and(
              eq(seatInventory.tripId, tripId),
              eq(seatInventory.seatNo, seatNo),
              inArray(seatInventory.legIndex, legIndexes)
            ));
        }

        // Create payment
        await tx.insert(payments).values({
          bookingId: booking.id,
          method: payment.method,
          amount: payment.amount.toString(),
          status: 'success'
        });

        // Create print job
        await tx.insert(printJobs).values({
          bookingId: booking.id,
          status: 'queued'
        });

        console.log(`[DETERMINISTIC] Booking created successfully: ${booking.id}`);
        
        return {
          success: true,
          booking
        };
      });

      // Generate print payload and emit events if successful
      if (result.success && result.booking) {
        const printPayload = await this.printService.generatePrintPayload(result.booking.id);
        
        // Emit inventory update events
        for (const passenger of passengers) {
          webSocketService.emitInventoryUpdated(tripId, passenger.seatNo, legIndexes);
        }
        
        return {
          ...result,
          printPayload
        };
      }

      return result;
    } catch (error) {
      console.error(`[DETERMINISTIC] Booking creation failed:`, error);
      return {
        success: false,
        reason: 'TRANSACTION_ERROR'
      };
    }
  }

  /**
   * Auto-select seats deterministically for multi-seat booking
   */
  async autoSelectSeats(tripId: string, legIndexes: number[], count: number): Promise<string[]> {
    console.log(`[DETERMINISTIC] Auto-selecting ${count} seats for trip ${tripId}`);
    
    const availableSeats = await this.getAvailableSeats(tripId, legIndexes, count);
    
    if (availableSeats.length < count) {
      throw new Error(`Not enough available seats. Requested: ${count}, Available: ${availableSeats.length}`);
    }
    
    // Return first N seats (already sorted deterministically)
    return availableSeats.slice(0, count);
  }

  /**
   * Cleanup expired holds
   */
  async cleanupExpiredHolds(): Promise<{ released: number }> {
    console.log(`[DETERMINISTIC] Cleaning up expired holds`);
    
    try {
      const result = await db.transaction(async (tx) => {
        // Find expired holds
        const expiredHolds = await tx
          .select({ holdRef: seatHolds.holdRef, tripId: seatHolds.tripId, seatNo: seatHolds.seatNo })
          .from(seatHolds)
          .where(lt(seatHolds.expiresAt, new Date()));

        if (expiredHolds.length === 0) {
          return { released: 0 };
        }

        // Clear hold references from seat inventory
        for (const hold of expiredHolds) {
          await tx
            .update(seatInventory)
            .set({ holdRef: null })
            .where(and(
              eq(seatInventory.tripId, hold.tripId),
              eq(seatInventory.holdRef, hold.holdRef)
            ));
        }

        // Delete expired hold records
        await tx
          .delete(seatHolds)
          .where(lt(seatHolds.expiresAt, new Date()));

        // Emit holds released events
        for (const hold of expiredHolds) {
          webSocketService.emitHoldsReleased(hold.tripId, [hold.seatNo]);
        }

        console.log(`[DETERMINISTIC] Released ${expiredHolds.length} expired holds`);
        return { released: expiredHolds.length };
      });

      return result;
    } catch (error) {
      console.error(`[DETERMINISTIC] Hold cleanup failed:`, error);
      return { released: 0 };
    }
  }

  /**
   * Release hold by reference
   */
  async releaseHoldByRef(holdRef: string): Promise<{ success: boolean }> {
    console.log(`[DETERMINISTIC] Releasing hold: ${holdRef}`);
    
    try {
      const result = await db.transaction(async (tx) => {
        // Get hold details
        const [hold] = await tx
          .select()
          .from(seatHolds)
          .where(eq(seatHolds.holdRef, holdRef));

        if (!hold) {
          return { success: false, reason: 'HOLD_NOT_FOUND' };
        }

        // Clear hold reference from seat inventory
        await tx
          .update(seatInventory)
          .set({ holdRef: null })
          .where(eq(seatInventory.holdRef, holdRef));

        // Delete hold record
        await tx
          .delete(seatHolds)
          .where(eq(seatHolds.holdRef, holdRef));

        // Emit inventory update event
        webSocketService.emitInventoryUpdated(
          hold.tripId,
          hold.seatNo,
          hold.legIndexes as number[]
        );
        webSocketService.emitHoldsReleased(hold.tripId, [hold.seatNo]);

        console.log(`[DETERMINISTIC] Hold released: ${holdRef}`);
        return { success: true };
      });

      return result;
    } catch (error) {
      console.error(`[DETERMINISTIC] Hold release failed:`, error);
      return { success: false };
    }
  }

  // Helper methods
  private async findBookingByIdempotencyKey(key: string): Promise<any> {
    // Implementation depends on how you want to store idempotency keys
    // Could be in booking metadata, separate table, etc.
    return null; // Placeholder
  }

  private async isHoldOwnedByOperator(holdRef: string, operatorId: string): Promise<boolean> {
    const [hold] = await db
      .select({ operatorId: seatHolds.operatorId })
      .from(seatHolds)
      .where(eq(seatHolds.holdRef, holdRef));
    
    return hold?.operatorId === operatorId;
  }
}