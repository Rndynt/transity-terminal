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
  constructor() {
    setInterval(() => this.cleanupExpiredHolds(), 30000);
  }

  private async cleanupExpiredHolds(): Promise<void> {
    try {
      const now = new Date();
      const expiredHolds = await db.select()
        .from(seatHolds)
        .where(lt(seatHolds.expiresAt, now));

      if (expiredHolds.length === 0) return;

      const expiredRefs = expiredHolds.map(h => h.holdRef);

      await db.update(seatInventory)
        .set({ holdRef: null })
        .where(inArray(seatInventory.holdRef, expiredRefs));

      await db.delete(seatHolds)
        .where(inArray(seatHolds.holdRef, expiredRefs));

      const tripIds = [...new Set(expiredHolds.map(h => h.tripId))];
      for (const tid of tripIds) {
        const seats = expiredHolds.filter(h => h.tripId === tid).map(h => h.seatNo);
        webSocketService.emitHoldsReleased(tid, seats);
      }
    } catch (error) {
      console.error('[HOLDS] Cleanup error:', error);
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
    const expiresAt = new Date(now + (ttlSeconds * 1000));
    const holdRef = randomUUID();

    try {
      const existingRows = await db.select()
        .from(seatInventory)
        .where(and(
          eq(seatInventory.tripId, tripId),
          eq(seatInventory.seatNo, seatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));

      if (existingRows.some(r => r.booked)) {
        return { ok: false, reason: 'already-booked', ownedByYou: false };
      }

      const activeHoldRefs = [...new Set(existingRows.map(r => r.holdRef).filter(Boolean))] as string[];
      if (activeHoldRefs.length > 0) {
        const activeHolds = await db.select()
          .from(seatHolds)
          .where(inArray(seatHolds.holdRef, activeHoldRefs));
        
        const now = new Date();
        for (const h of activeHolds) {
          if (new Date(h.expiresAt) > now) {
            if (h.operatorId === owner.operatorId) {
              return { ok: false, reason: 'already-held-by-you', ownedByYou: true };
            } else {
              return { ok: false, reason: 'held-by-other', ownedByYou: false };
            }
          }
        }
      }

      await db.insert(seatHolds).values({
        holdRef,
        tripId,
        seatNo,
        legIndexes,
        operatorId: owner.operatorId,
        bookingId: owner.bookingId || null,
        ttlClass,
        expiresAt
      });

      await db.update(seatInventory)
        .set({ holdRef })
        .where(and(
          eq(seatInventory.tripId, tripId),
          eq(seatInventory.seatNo, seatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));

      webSocketService.emitInventoryUpdated(tripId, seatNo, legIndexes);

      return {
        ok: true,
        holdRef,
        expiresAt: expiresAt.getTime(),
        ownedByYou: true
      };
    } catch (error) {
      console.error(`[HOLDS] Failed to create hold for ${tripId}:${seatNo}:`, error);
      return { ok: false, reason: 'internal-error' };
    }
  }

  async releaseSeatHold(tripId: string, seatNo: string, legIndexes: number[]): Promise<void> {
    const [inventoryRow] = await db.select()
      .from(seatInventory)
      .where(and(
        eq(seatInventory.tripId, tripId),
        eq(seatInventory.seatNo, seatNo),
        eq(seatInventory.legIndex, legIndexes[0])
      ))
      .limit(1);

    if (inventoryRow?.holdRef) {
      await this.releaseHoldByRef(inventoryRow.holdRef);
    }
  }

  async releaseHoldByRef(holdRef: string): Promise<void> {
    try {
      const [dbHold] = await db.select()
        .from(seatHolds)
        .where(eq(seatHolds.holdRef, holdRef))
        .limit(1);

      if (dbHold) {
        await db.update(seatInventory)
          .set({ holdRef: null })
          .where(eq(seatInventory.holdRef, holdRef));

        await db.delete(seatHolds)
          .where(eq(seatHolds.holdRef, holdRef));

        webSocketService.emitInventoryUpdated(dbHold.tripId, dbHold.seatNo, dbHold.legIndexes as number[]);
        webSocketService.emitHoldsReleased(dbHold.tripId, [dbHold.seatNo]);
      }
    } catch (dbError) {
      console.error(`[HOLDS] Failed to release hold ${holdRef}:`, dbError);
      throw dbError;
    }
  }

  async isSeatHeld(tripId: string, seatNo: string, legIndexes: number[]): Promise<boolean> {
    const hold = await this.getSeatHoldInfoFromDb(tripId, seatNo, legIndexes[0]);
    return hold !== null;
  }

  async getHoldInfo(holdRef: string): Promise<SeatHold | null> {
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
    return this.getSeatHoldInfoFromDb(tripId, seatNo, legIndex);
  }

  private async getSeatHoldInfoFromDb(tripId: string, seatNo: string, legIndex: number): Promise<SeatHold | null> {
    try {
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
    const config = getConfig();
    const now = Date.now();
    const ttlSeconds = ttlClass === 'short' ? config.holdTtlShortSeconds : config.holdTtlLongSeconds;
    const newExpiry = new Date(now + (ttlSeconds * 1000));

    const result = await db.update(seatHolds)
      .set({ expiresAt: newExpiry, ttlClass })
      .where(eq(seatHolds.holdRef, holdRef));

    return true;
  }

  async convertHoldsToLong(operatorId: string, bookingId: string): Promise<void> {
    const config = getConfig();
    const now = Date.now();
    const newExpiry = new Date(now + (config.holdTtlLongSeconds * 1000));
    const { isNull } = await import("drizzle-orm");

    await db.update(seatHolds)
      .set({ bookingId, ttlClass: 'long', expiresAt: newExpiry })
      .where(and(
        eq(seatHolds.operatorId, operatorId),
        isNull(seatHolds.bookingId)
      ));
  }

  async releaseHoldsByOwner(operatorId: string, bookingId?: string): Promise<void> {
    let holdsToRelease;

    if (bookingId) {
      holdsToRelease = await db.select()
        .from(seatHolds)
        .where(and(
          eq(seatHolds.operatorId, operatorId),
          eq(seatHolds.bookingId, bookingId)
        ));
    } else {
      holdsToRelease = await db.select()
        .from(seatHolds)
        .where(eq(seatHolds.operatorId, operatorId));
    }

    for (const hold of holdsToRelease) {
      await this.releaseHoldByRef(hold.holdRef);
    }
  }
}
