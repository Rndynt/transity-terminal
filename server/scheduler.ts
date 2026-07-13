import { BookingsService } from './modules/bookings/bookings.service';
import { storage } from './storage';
import { getConfig } from './config';
import { db, pool } from './db';
import { seatHolds, seatInventory } from '@shared/schema';
import { lt, inArray, sql, and } from 'drizzle-orm';

// S3: per-job advisory lock IDs. Pick stable, project-unique numbers so that
// multi-instance deployments don't run cleanup or snapshot push in parallel.
const LOCK_HOLDS_CLEANUP = 8240_001;
const LOCK_ORPHAN_REFS   = 8240_002;
const LOCK_PENDING_BOOK  = 8240_003;
const LOCK_SNAPSHOT_PUSH = 8240_004;
const LOCK_ENGINE_COMP   = 8240_005;
// S2-08: notifications cleanup berjalan jauh lebih jarang dari hold reaper.
// Lock terpisah supaya cleanup yang lambat (DELETE besar pertama kali) tidak
// menahan lock cleanup hold yang dipakai tiap menit.
const LOCK_NOTIF_CLEAN   = 8240_006;
// PERF: mv_trip_stats materialized view refresh (every 5 min). Reports use
// this view as a fast path instead of aggregating 500K+ booking rows live.
const LOCK_MV_REFRESH    = 8240_007;
const MV_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// Interval cleanup notifikasi: 6 jam default (4× per hari sudah cukup).
const NOTIF_CLEANUP_INTERVAL_MS = parseInt(process.env.NOTIF_CLEANUP_INTERVAL_MS || `${6 * 60 * 60 * 1000}`, 10);

// IMPORTANT: session-level pg advisory locks are bound to a *single
// connection*. The default `db` client uses a connection pool — two separate
// `db.execute(...)` calls can land on different connections, so the unlock
// will fail (or worse, unlock another session's hold). We therefore pin a
// dedicated client from the pool for the entire acquire/work/release cycle.
async function withAdvisoryLock<T>(lockId: number, fn: () => Promise<T>): Promise<T | null> {
  const client = await pool.connect();
  try {
    const acquired = await client.query('SELECT pg_try_advisory_lock($1) AS got', [lockId]);
    if (!acquired.rows?.[0]?.got) {
      return null;
    }
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    }
  } finally {
    client.release();
  }
}
import { webSocketService } from './realtime/ws';
import { buildScheduleSnapshot } from './lib/scheduleSnapshot';
import { fireAndForget } from './lib/consoleWebhook';
import { createComponentLogger } from './lib/logger';

const log = createComponentLogger('scheduler');

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
  private notifCleanupIntervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.bookingsService = new BookingsService(storage);
  }

  async cleanupExpiredHolds(): Promise<void> {
    log.debug('running expired holds cleanup');
    
    try {
      const now = new Date();
      const expiredHolds = await db.transaction(async (tx) => {
        const holds = await tx
          .select()
          .from(seatHolds)
          .where(lt(seatHolds.expiresAt, now))
          .for('update', { skipLocked: true });

        if (holds.length === 0) {
          log.debug('no expired holds to clean up');
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

        log.info({ count: holds.length }, 'cleaned up expired holds');
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
      log.error({ err: error }, 'error cleaning up expired holds');
    }
  }

  /**
   * P2 §7: engine-mode safety net for `seat_holds`.
   *
   * When `RESERVATION_ENGINE_ENABLED=true` the Rust sidecar owns
   * `seat_inventory.hold_ref` and emits its own WS releases. But the
   * sidecar does NOT touch TT's `seat_holds` table — that's a TT-local
   * artefact of legacy paths and of post-confirm state that the adapter
   * never actively cleans up (`HoldsAdapter.confirmForBooking` relies on
   * engine-side ownership of release). Without this sweep the table
   * grows unbounded and `idx_seat_holds_trip_id` scans slow down.
   *
   * This variant deliberately:
   *   - Deletes expired rows from `seat_holds` only.
   *   - Does NOT touch `seat_inventory.hold_ref` — writing there would
   *     fight the engine and could clear a valid confirmed slot.
   *   - Does NOT emit `holdsReleased` — the engine already publishes
   *     that via its own pub/sub.
   *   - Uses `FOR UPDATE SKIP LOCKED` so concurrent booking flows that
   *     happen to be updating / extending the same row don't block.
   */
  async cleanupExpiredSeatHoldsOnly(): Promise<void> {
    try {
      const now = new Date();
      const deleted = await db.transaction(async (tx) => {
        const holds = await tx
          .select({ holdRef: seatHolds.holdRef })
          .from(seatHolds)
          .where(lt(seatHolds.expiresAt, now))
          .for('update', { skipLocked: true });

        if (holds.length === 0) return 0;

        const refs = holds.map(h => h.holdRef);
        await tx
          .delete(seatHolds)
          .where(and(
            inArray(seatHolds.holdRef, refs),
            lt(seatHolds.expiresAt, now)
          ));

        return holds.length;
      });

      if (deleted > 0) {
        log.info({ deleted }, 'engine-mode seat_holds sweep completed');
      }
    } catch (error) {
      log.error({ err: error }, 'error in engine-mode seat_holds sweep');
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
        log.info({ count }, 'cleaned up orphan holdRefs in seat_inventory');
      }
    } catch (error) {
      log.error({ err: error }, 'error cleaning up orphan holdRefs');
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
      log.info(
        { trips: allTrips.length, daysAhead: SNAPSHOT_DAYS_AHEAD },
        'pushed schedule snapshot to console'
      );
    } catch (error) {
      log.error({ err: error }, 'error pushing schedule snapshot');
    }
  }

  start(): void {
    const config = getConfig();
    const engineOwnsHolds =
      (process.env.RESERVATION_ENGINE_ENABLED ?? 'false').toLowerCase() === 'true';

    if (engineOwnsHolds) {
      log.info(
        { engineOwnsHolds: true },
        'RESERVATION_ENGINE_ENABLED=true — engine sidecar owns seat_inventory.hold_ref reaping; local orphan-ref cleanup disabled. TT still sweeps expired seat_holds rows locally (P2 §7). Pending-booking cleanup remains active.'
      );
    }

    // Run cleanup every 60 seconds. Wrap each job in a Postgres advisory lock
    // so multi-instance deployments do not run the same cleanup multiple times.
    this.intervalId = setInterval(async () => {
      try {
        if (!engineOwnsHolds) {
          await withAdvisoryLock(LOCK_HOLDS_CLEANUP, () => this.cleanupExpiredHolds());
          await withAdvisoryLock(LOCK_ORPHAN_REFS, () => this.cleanupOrphanHoldRefs());
        } else {
          // Engine mode: only reap TT's local `seat_holds` table. The engine
          // sidecar handles `seat_inventory.hold_ref` + WS broadcast itself.
          await withAdvisoryLock(LOCK_HOLDS_CLEANUP, () => this.cleanupExpiredSeatHoldsOnly());
        }

        if (config.pendingBookingAutoRelease) {
          await withAdvisoryLock(LOCK_PENDING_BOOK, async () => {
            log.debug('running expired pending bookings cleanup');
            await this.bookingsService.cleanupExpiredPendingBookings();
          });
        }

        // Drain queued engine compensations (cancel-seats calls that
        // failed after a local tx commit). No-op when flag is off.
        if (engineOwnsHolds) {
          await withAdvisoryLock(LOCK_ENGINE_COMP, async () => {
            const { runOnce } = await import('@modules/holds/compensationQueue');
            const r = await runOnce();
            if (r.attempted > 0) {
              log.info(
                { succeeded: r.succeeded, attempted: r.attempted },
                'engine compensation queue drained'
              );
            }
          });
        }
      } catch (error) {
        log.error({ err: error }, 'error during cleanup');
      }
    }, 60 * 1000); // Every 1 minute

    log.info({ intervalMs: 60_000 }, 'cleanup scheduler started');

    // S2-08: notifications cleanup. Berjalan jauh lebih jarang (default 6 jam)
    // karena DELETE TTL tidak perlu high-frequency dan akan berat di run
    // pertama setelah deploy dengan tabel besar.
    if (NOTIF_CLEANUP_INTERVAL_MS > 0) {
      const runNotifCleanup = async () => {
        try {
          await withAdvisoryLock(LOCK_NOTIF_CLEAN, async () => {
            const { NotificationsService } = await import('@modules/notifications/notifications.service');
            const svc = new NotificationsService();
            const deleted = await svc.cleanupOldNotifications();
            if (deleted > 0) {
              log.info(
                {
                  deleted,
                  ttlReadDays: parseInt(process.env.NOTIF_READ_TTL_DAYS || '90', 10),
                  ttlUnreadDays: parseInt(process.env.NOTIF_UNREAD_TTL_DAYS || '180', 10),
                },
                'notifications cleanup completed'
              );
            }
          });
        } catch (e) {
          log.error({ err: e }, 'notifications cleanup failed');
        }
      };
      this.notifCleanupIntervalId = setInterval(runNotifCleanup, NOTIF_CLEANUP_INTERVAL_MS);
      log.info({ intervalMin: Math.round(NOTIF_CLEANUP_INTERVAL_MS / 1000 / 60) }, 'notifications cleanup started');
      // Kick once on startup supaya backlog dari deploy sebelumnya langsung
      // dibersihkan tanpa menunggu interval pertama.
      void runNotifCleanup();
    }

    // Run immediately on start so a backlog from the previous process
    // gets swept without waiting a full minute.
    if (!engineOwnsHolds) {
      this.cleanupExpiredHolds();
    } else {
      void this.cleanupExpiredSeatHoldsOnly();
    }

    // PERF: Refresh mv_trip_stats every 5 minutes so report fast-path stays
    // fresh. CONCURRENTLY allows readers to keep using the old snapshot while
    // the new one builds. Advisory lock prevents parallel refreshes across
    // instances (each refresh scans bookings + passengers, so no point doubling).
    // Gracefully skipped if the view doesn't exist yet (pre-migration env).
    if (MV_REFRESH_INTERVAL_MS > 0) {
      const refreshMv = async () => {
        try {
          await withAdvisoryLock(LOCK_MV_REFRESH, async () => {
            await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trip_stats`);
            log.debug('mv_trip_stats refreshed');
          });
        } catch (e: unknown) {
          // Silently skip if view does not exist yet (fresh DB before migration runs).
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('does not exist')) {
            log.error({ err: e }, 'mv_trip_stats refresh failed');
          }
        }
      };
      setInterval(refreshMv, MV_REFRESH_INTERVAL_MS);
      // Kick once on startup so the view is fresh immediately after boot.
      void refreshMv();
      log.info({ intervalMin: Math.round(MV_REFRESH_INTERVAL_MS / 60_000) }, 'mv_trip_stats refresh scheduled');
    }

    // Periodic schedule snapshot push to Console — this is the safety net so
    // that even if every fire-and-forget delivery fails (e.g. Console is down
    // for an extended period), Console will reconverge on its own once it
    // comes back, without an operator having to press "Sync".
    if (SNAPSHOT_INTERVAL_MS > 0) {
      this.snapshotIntervalId = setInterval(() => {
        void withAdvisoryLock(LOCK_SNAPSHOT_PUSH, () => this.pushScheduleSnapshot());
      }, SNAPSHOT_INTERVAL_MS);
      log.info(
        { intervalSec: Math.round(SNAPSHOT_INTERVAL_MS / 1000), daysAhead: SNAPSHOT_DAYS_AHEAD },
        'schedule snapshot push started'
      );
      // Kick once on startup so a freshly-restarted Terminal pushes immediately.
      void withAdvisoryLock(LOCK_SNAPSHOT_PUSH, () => this.pushScheduleSnapshot());
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('cleanup scheduler stopped');
    }
    if (this.snapshotIntervalId) {
      clearInterval(this.snapshotIntervalId);
      this.snapshotIntervalId = null;
      log.info('schedule snapshot push stopped');
    }
    if (this.notifCleanupIntervalId) {
      clearInterval(this.notifCleanupIntervalId);
      this.notifCleanupIntervalId = null;
      log.info('notifications cleanup stopped');
    }
  }
}

export const scheduler = new Scheduler();
