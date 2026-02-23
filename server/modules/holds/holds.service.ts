import { randomUUID } from "crypto";
import { getConfig } from "../../config";
import { db } from "../../db";
import { seatHolds, seatInventory } from "@shared/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { webSocketService } from "../../realtime/ws";

interface SeatHoldOwner {
  operatorId: string;
  bookingId?: string;
}

interface SeatHold {
  holdRef: string;
  tripId: string;
  seatNo: string;
  legIndexes: number[];
  expiresAt: number;
  ttlClass: 'short' | 'long';
  owner: SeatHoldOwner;
}

export class HoldsService {
  private holds: Map<string, SeatHold> = new Map();
  private seatHolds: Map<string, string> = new Map(); // seatKey -> holdRef

  constructor() {
    // Cleanup expired holds every 30 seconds
    setInterval(() => this.cleanupExpiredHolds(), 30000);
  }

  private getSeatKey(tripId: string, seatNo: string, legIndex: number): string {
    return `${tripId}:${seatNo}:${legIndex}`;
  }

  private cleanupExpiredHolds(): void {
    const now = Date.now();
    const expiredHolds = Array.from(this.holds.entries()).filter(([holdRef, hold]) => hold.expiresAt <= now);
    for (const [holdRef] of expiredHolds) {
      this.releaseHoldByRef(holdRef);
    }
  }

  async createSeatHold(
    tripId: string, 
    seatNo: string, 
    legIndexes: number[], 
    ttlClass: 'short' | 'long' = 'short',
    owner: SeatHoldOwner
  ): Promise<{ ok: boolean; holdRef?: string; expiresAt?: number; ownedByYou?: boolean; reason?: string }> {
    const config = getConfig();
    const now = Date.now();
    const ttlSeconds = ttlClass === 'short' ? config.holdTtlShortSeconds : config.holdTtlLongSeconds;
    const expiresAt = now + (ttlSeconds * 1000);
    const holdRef = randomUUID();

    // Check if any of the required legs are already held or booked
    for (const legIndex of legIndexes) {
      const seatKey = this.getSeatKey(tripId, seatNo, legIndex);
      const existingHoldRef = this.seatHolds.get(seatKey);
      
      if (existingHoldRef) {
        const existingHold = this.holds.get(existingHoldRef);
        if (existingHold) {
          // Check if it's the same operator
          if (existingHold.owner.operatorId === owner.operatorId) {
            return {
              ok: false,
              reason: 'already-held-by-you',
              ownedByYou: true
            };
          } else {
            return {
              ok: false,
              reason: 'held-by-other',
              ownedByYou: false
            };
          }
        }
      }
    }

    // Create hold for all legs atomically
    const hold: SeatHold = {
      holdRef,
      tripId,
      seatNo,
      legIndexes,
      expiresAt,
      ttlClass,
      owner
    };

    this.holds.set(holdRef, hold);

    // Mark each leg as held in memory
    for (const legIndex of legIndexes) {
      const seatKey = this.getSeatKey(tripId, seatNo, legIndex);
      this.seatHolds.set(seatKey, holdRef);
    }

    // Also update database seatInventory for consistency with seatmap queries
    try {
      await db.update(seatInventory)
        .set({ holdRef })
        .where(and(
          eq(seatInventory.tripId, tripId),
          eq(seatInventory.seatNo, seatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));
      
      console.log(`[HOLDS] Updated database seatInventory for hold: ${holdRef}`);
    } catch (dbError) {
      console.error(`[HOLDS] Failed to update database for hold ${holdRef}:`, dbError);
    }

    // Emit WebSocket event for real-time updates
    webSocketService.emitInventoryUpdated(tripId, seatNo, legIndexes);
    console.log(`[HOLDS] Emitted WebSocket INVENTORY_UPDATED for ${tripId}:${seatNo}`);

    return {
      ok: true,
      holdRef,
      expiresAt,
      ownedByYou: true
    };
  }

  async releaseSeatHold(tripId: string, seatNo: string, legIndexes: number[]): Promise<void> {
    // Find hold by checking first leg
    const firstLegKey = this.getSeatKey(tripId, seatNo, legIndexes[0]);
    const holdRef = this.seatHolds.get(firstLegKey);
    
    if (holdRef) {
      this.releaseHoldByRef(holdRef);
    }
  }

  async releaseHoldByRef(holdRef: string): Promise<void> {
    console.log(`[HOLDS] Attempting to release hold: ${holdRef}`);
    
    // First check in-memory
    const hold = this.holds.get(holdRef);
    
    if (hold) {
      console.log(`[HOLDS] Found hold in memory, releasing...`);
      // Remove from all legs
      for (const legIndex of hold.legIndexes) {
        const seatKey = this.getSeatKey(hold.tripId, hold.seatNo, legIndex);
        this.seatHolds.delete(seatKey);
      }

      this.holds.delete(holdRef);
    }

    // ALWAYS clear from database regardless of memory state
    // This handles holds created by DeterministicBookingService
    try {
      // First, get hold info from database to know which trip/seat to clear
      const [dbHold] = await db.select()
        .from(seatHolds)
        .where(eq(seatHolds.holdRef, holdRef))
        .limit(1);
      
      if (dbHold) {
        console.log(`[HOLDS] Found hold in database, clearing seat inventory for trip ${dbHold.tripId}, seat ${dbHold.seatNo}`);
        
        // Clear seat inventory
        await db.update(seatInventory)
          .set({ holdRef: null })
          .where(eq(seatInventory.holdRef, holdRef));
        
        // Delete the hold record
        await db.delete(seatHolds)
          .where(eq(seatHolds.holdRef, holdRef));
        
        console.log(`[HOLDS] Cleared database for released hold: ${holdRef}`);
        
        // Emit WebSocket events for real-time updates
        webSocketService.emitInventoryUpdated(dbHold.tripId, dbHold.seatNo, dbHold.legIndexes as number[]);
        webSocketService.emitHoldsReleased(dbHold.tripId, [dbHold.seatNo]);
        console.log(`[HOLDS] Emitted WebSocket events for release ${dbHold.tripId}:${dbHold.seatNo}`);
      } else {
        console.log(`[HOLDS] Hold ${holdRef} not found in database, may have already been released`);
      }
    } catch (dbError) {
      console.error(`[HOLDS] Failed to clear database for hold ${holdRef}:`, dbError);
    }
  }

  async isSeatHeld(tripId: string, seatNo: string, legIndexes: number[]): Promise<boolean> {
    // Check database for accurate hold status
    const hold = await this.getSeatHoldInfoFromDb(tripId, seatNo, legIndexes[0]);
    return hold !== null;
  }

  async getHoldInfo(holdRef: string): Promise<SeatHold | null> {
    // Check memory first
    const hold = this.holds.get(holdRef);
    if (hold && hold.expiresAt > Date.now()) {
      return hold;
    }
    
    // Check database
    const [dbHold] = await db.select()
      .from(seatHolds)
      .where(eq(seatHolds.holdRef, holdRef))
      .limit(1);
    
    if (dbHold && new Date(dbHold.expiresAt) > new Date()) {
      return {
        holdRef: dbHold.holdRef,
        tripId: dbHold.tripId,
        seatNo: dbHold.seatNo,
        legIndexes: dbHold.legIndexes as number[],
        expiresAt: new Date(dbHold.expiresAt).getTime(),
        ttlClass: dbHold.ttlClass as 'short' | 'long',
        owner: {
          operatorId: dbHold.operatorId,
          bookingId: dbHold.bookingId || undefined
        }
      };
    }
    
    return null;
  }

  async getSeatHoldInfo(tripId: string, seatNo: string, legIndex: number): Promise<SeatHold | null> {
    const seatKey = this.getSeatKey(tripId, seatNo, legIndex);
    const holdRef = this.seatHolds.get(seatKey);
    
    if (holdRef) {
      const hold = this.holds.get(holdRef);
      if (hold && hold.expiresAt > Date.now()) {
        return hold;
      }
    }
    
    // Check database
    return this.getSeatHoldInfoFromDb(tripId, seatNo, legIndex);
  }

  private async getSeatHoldInfoFromDb(tripId: string, seatNo: string, legIndex: number): Promise<SeatHold | null> {
    try {
      // Find hold that covers this seat and leg
      const [inventoryRow] = await db.select()
        .from(seatInventory)
        .where(and(
          eq(seatInventory.tripId, tripId),
          eq(seatInventory.seatNo, seatNo),
          eq(seatInventory.legIndex, legIndex)
        ))
        .limit(1);
      
      if (!inventoryRow || !inventoryRow.holdRef) {
        return null;
      }
      
      return this.getHoldInfo(inventoryRow.holdRef);
    } catch (error) {
      console.error(`[HOLDS] Error getting seat hold info from DB:`, error);
      return null;
    }
  }

  async extendHold(holdRef: string, ttlClass: 'short' | 'long'): Promise<boolean> {
    const hold = this.holds.get(holdRef);
    if (!hold) return false;

    const config = getConfig();
    const now = Date.now();
    const ttlSeconds = ttlClass === 'short' ? config.holdTtlShortSeconds : config.holdTtlLongSeconds;
    
    hold.expiresAt = now + (ttlSeconds * 1000);
    hold.ttlClass = ttlClass;
    
    return true;
  }

  async convertHoldsToLong(operatorId: string, bookingId: string): Promise<void> {
    // Find all holds owned by this operator and convert them to long holds
    for (const [holdRef, hold] of Array.from(this.holds.entries())) {
      if (hold.owner.operatorId === operatorId && !hold.owner.bookingId) {
        hold.owner.bookingId = bookingId;
        this.extendHold(holdRef, 'long');
      }
    }
  }

  async releaseHoldsByOwner(operatorId: string, bookingId?: string): Promise<void> {
    const holdsToRelease: string[] = [];
    
    for (const [holdRef, hold] of Array.from(this.holds.entries())) {
      if (hold.owner.operatorId === operatorId) {
        if (bookingId && hold.owner.bookingId === bookingId) {
          holdsToRelease.push(holdRef);
        } else if (!bookingId && !hold.owner.bookingId) {
          holdsToRelease.push(holdRef);
        }
      }
    }
    
    for (const holdRef of holdsToRelease) {
      this.releaseHoldByRef(holdRef);
    }
  }
}
