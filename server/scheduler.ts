import { BookingsService } from './modules/bookings/bookings.service';
import { storage } from './storage';
import { getConfig } from './config';
import { db } from './db';
import { seatHolds, seatInventory } from '@shared/schema';
import { lt, eq, and } from 'drizzle-orm';

export class Scheduler {
  private bookingsService: BookingsService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.bookingsService = new BookingsService(storage);
  }

  async cleanupExpiredHolds(): Promise<void> {
    console.log('[SCHEDULER] Running expired holds cleanup...');
    
    try {
      await db.transaction(async (tx) => {
        // Get expired holds
        const expiredHolds = await tx
          .select()
          .from(seatHolds)
          .where(lt(seatHolds.expiresAt, new Date()));

        if (expiredHolds.length === 0) {
          console.log('[SCHEDULER] No expired holds to clean up');
          return;
        }

        // Clear hold references from seat inventory
        for (const hold of expiredHolds) {
          await tx
            .update(seatInventory)
            .set({ holdRef: null })
            .where(eq(seatInventory.holdRef, hold.holdRef));
        }

        // Delete expired holds
        const deleted = await tx
          .delete(seatHolds)
          .where(lt(seatHolds.expiresAt, new Date()))
          .returning();

        console.log(`[SCHEDULER] Cleaned up ${deleted.length} expired holds`);
      });
    } catch (error) {
      console.error('[SCHEDULER] Error cleaning up expired holds:', error);
    }
  }

  start(): void {
    const config = getConfig();
    
    // Run cleanup every 60 seconds
    this.intervalId = setInterval(async () => {
      try {
        // Cleanup expired holds
        await this.cleanupExpiredHolds();
        
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