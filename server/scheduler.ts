import { BookingsService } from './modules/bookings/bookings.service';
import { storage } from './storage';
import { getConfig } from './config';
import { db } from './db';
import { seatHolds, seatInventory } from '@shared/schema';
import { lt, inArray, sql, and } from 'drizzle-orm';
import { webSocketService } from './realtime/ws';
import { buildScheduleSnapshot } from './lib/scheduleSnapshot';
import { fireAndForget } from './lib/consoleWebhook';

const SNAPSHOT_INTERVAL_MS = parseInt(
  process.env.CONSOLE_SNAPSHOT_INTERVAL_MS || `${10 * 60 * 1000}`,
  10
); // default: every 10 minutes
const SNAPSHOT_DAYS_AHEAD = parseInt(
  process.env.CONSOLE_SNAPSHOT_DAYS_AHEAD || '7',
  10
); // default: today + next 7 days

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

export class Scheduler {
  private bookingsService: BookingsService;
  private intervalId: NodeJS.Timeout | null = null;
  private snapshotIntervalId: NodeJS.Timeout | null = null;

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

  async pushScheduleSnapshot(): Promise<void> {
    // Only push if Console is configured. Without these env vars the webhook
    // emitter would skip anyway, so don't waste DB queries building snapshots.
    if (
      !process.env.CONSOLE_URL ||
      !process.env.CONSOLE_OPERATOR_SLUG ||
      !process.env.CONSOLE_WEBHOOK_SECRET
    ) {
      return;
    }

    try {
      const today = new Date().toISOString().substring(0, 10);
      const allTrips = [];
      for (let i = 0; i < SNAPSHOT_DAYS_AHEAD; i++) {
        const day = addDays(today, i);
        const trips = await buildScheduleSnapshot(storage, day);
        if (trips.length > 0) allTrips.push(...trips);
      }
      if (allTrips.length === 0) {
        return;
      }
      // Emit a single combined snapshot. fireAndForget will retry on failure
      // and coalesce repeated snapshot pushes if Console stays offline.
      fireAndForget({
        event: 'schedule.snapshot',
        trips: allTrips,
        emittedAt: new Date().toISOString(),
      });
      console.log(
        `[SCHEDULER] Pushed schedule snapshot to Console (${allTrips.length} trips, next ${SNAPSHOT_DAYS_AHEAD} days)`
      );
    } catch (error) {
      console.error('[SCHEDULER] Error pushing schedule snapshot:', error);
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

    // Periodic schedule snapshot push to Console — this is the safety net so
    // that even if every fire-and-forget delivery fails (e.g. Console is down
    // for an extended period), Console will reconverge on its own once it
    // comes back, without an operator having to press "Sync".
    if (SNAPSHOT_INTERVAL_MS > 0) {
      this.snapshotIntervalId = setInterval(() => {
        void this.pushScheduleSnapshot();
      }, SNAPSHOT_INTERVAL_MS);
      console.log(
        `[SCHEDULER] Schedule snapshot push started (every ${Math.round(
          SNAPSHOT_INTERVAL_MS / 1000
        )}s, ${SNAPSHOT_DAYS_AHEAD} days ahead)`
      );
      // Kick once on startup so a freshly-restarted Terminal pushes immediately.
      void this.pushScheduleSnapshot();
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SCHEDULER] Cleanup scheduler stopped');
    }
    if (this.snapshotIntervalId) {
      clearInterval(this.snapshotIntervalId);
      this.snapshotIntervalId = null;
      console.log('[SCHEDULER] Schedule snapshot push stopped');
    }
  }
}

export const scheduler = new Scheduler();
