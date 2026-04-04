import { BookingsService } from './modules/bookings/bookings.service';
import { storage } from './storage';
import { getConfig } from './config';
import { db } from './db';
import { seatHolds, seatInventory } from '@shared/schema';
import { lt, inArray, sql, and } from 'drizzle-orm';
import { webSocketService } from './realtime/ws';

export class Scheduler {
  private bookingsService: BookingsService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.bookingsService = new BookingsService(storage);
  }

  async cleanupExpiredHolds(): Promise<void> {
    console.log('[SCHEDULER] Running expired holds cleanup...');
    
    try {
      const now = new Date();
      const expiredHolds = await db.transaction(async (tx) => {
        const holds = await tx
          .select()
          .from(seatHolds)
          .where(lt(seatHolds.expiresAt, now))
          .for('update', { skipLocked: true });

        if (holds.length === 0) {
          console.log('[SCHEDULER] No expired holds to clean up');
          return [];
        }

        const expiredRefs = holds.map(h => h.holdRef);

        await tx
          .update(seatInventory)
          .set({ holdRef: null })
          .where(inArray(seatInventory.holdRef, expiredRefs));

        await tx
          .delete(seatHolds)
          .where(and(
            inArray(seatHolds.holdRef, expiredRefs),
            lt(seatHolds.expiresAt, now)
          ));

        console.log(`[SCHEDULER] Cleaned up ${holds.length} expired holds`);
        return holds;
      });

      if (expiredHolds.length > 0) {
        const tripGroups = new Map<string, string[]>();
        for (const hold of expiredHolds) {
          const seats = tripGroups.get(hold.tripId) || [];
          seats.push(hold.seatNo);
          tripGroups.set(hold.tripId, seats);
        }
        for (const [tripId, seats] of tripGroups) {
          webSocketService.emitHoldsReleased(tripId, seats);
        }
      }
    } catch (error) {
      console.error('[SCHEDULER] Error cleaning up expired holds:', error);
    }
  }

  async cleanupOrphanHoldRefs(): Promise<void> {
    try {
      const result = await db.execute(sql`
        UPDATE seat_inventory
        SET hold_ref = NULL
        WHERE hold_ref IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM seat_holds
            WHERE seat_holds.hold_ref = seat_inventory.hold_ref
          )
        RETURNING id
      `);

      const count = result.rows?.length || 0;
      if (count > 0) {
        console.log(`[SCHEDULER] Cleaned up ${count} orphan holdRefs in seat_inventory`);
      }
    } catch (error) {
      console.error('[SCHEDULER] Error cleaning up orphan holdRefs:', error);
    }
  }

  start(): void {
    const config = getConfig();
    
    // Run cleanup every 60 seconds
    this.intervalId = setInterval(async () => {
      try {
        // Cleanup expired holds
        await this.cleanupExpiredHolds();

        // Cleanup orphan holdRefs in seat_inventory
        await this.cleanupOrphanHoldRefs();
        
        // Cleanup expired pending bookings
        if (config.pendingBookingAutoRelease) {
          console.log('[SCHEDULER] Running expired pending bookings cleanup...');
          await this.bookingsService.cleanupExpiredPendingBookings();
        }
      } catch (error) {
        console.error('[SCHEDULER] Error during cleanup:', error);
      }
    }, 60 * 1000); // Every 1 minute

    console.log('[SCHEDULER] Cleanup scheduler started (runs every 1 minute)');

    // Run immediately on start
    this.cleanupExpiredHolds();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SCHEDULER] Cleanup scheduler stopped');
    }
  }
}

export const scheduler = new Scheduler();