// engine_compensation_queue helper.
//
// All public callers go through `enqueueCancelSeats()` — this is the only
// way to record a failed best-effort engine cancel. The scheduler later
// drains via `runOnce()`. Both are no-ops when the engine flag is off
// (the queue is only meaningful in engine mode), so callers can invoke
// them unconditionally without leaking new behavior into legacy code.
//
// Design notes:
//   - Enqueue is FIRE-AND-FORGET from the caller's perspective; it logs
//     and swallows failures so it can be safely chained off any
//     compensation .catch(). Losing the queue insert is unfortunate but
//     not worse than the previous "log and forget" baseline.
//   - The worker batches a small number of rows per tick (default 50) so
//     a backlog never starves the rest of the scheduler. Rows are claimed
//     row-locked with `FOR UPDATE SKIP LOCKED` so multiple TT instances
//     can drain in parallel without double-processing.
//   - Hard cap (default 50 attempts) prevents a permanent failure from
//     looping forever; once exceeded the row is parked and visible to
//     SQL audits, never silently dropped.

import { db, pool } from "@server/db";
import { engineCompensationQueue } from "@shared/schema";
import { sql } from "drizzle-orm";
import { engineClient } from "./engineClient";
import { isEngineEnabled } from "./holdsAdapter";
import { createComponentLogger } from "@server/lib/logger";

const log = createComponentLogger("engineCompQueue");

const BATCH_SIZE = parseInt(
  process.env.ENGINE_COMPENSATION_BATCH ?? "50",
  10,
);
const MAX_ATTEMPTS = parseInt(
  process.env.ENGINE_COMPENSATION_MAX_ATTEMPTS ?? "50",
  10,
);

export interface EnqueueCancelSeatsInput {
  tripId: string;
  seatNo: string;
  legIndexes: number[];
  context?: Record<string, unknown>;
}

export async function enqueueCancelSeats(
  input: EnqueueCancelSeatsInput,
): Promise<void> {
  if (!isEngineEnabled()) return;
  try {
    await db.insert(engineCompensationQueue).values({
      opType: "cancel_seats",
      tripId: input.tripId,
      seatNo: input.seatNo,
      legIndexes: input.legIndexes,
      context: input.context ?? null,
    });
    log.warn(
      { tripId: input.tripId, seatNo: input.seatNo },
      "enqueued cancel_seats"
    );
  } catch (e) {
    log.error(
      { err: e, tripId: input.tripId, seatNo: input.seatNo },
      "enqueue failed (will not retry; data lost)"
    );
  }
}

interface ClaimedRow {
  id: string;
  op_type: string;
  trip_id: string;
  seat_no: string;
  leg_indexes: number[];
  attempts: number;
}

/**
 * Drain up to BATCH_SIZE rows. Caller is the scheduler; safe to call
 * concurrently across instances thanks to FOR UPDATE SKIP LOCKED on
 * the claim. Returns the number of rows that succeeded (and were
 * therefore deleted).
 */
export async function runOnce(): Promise<{
  attempted: number;
  succeeded: number;
}> {
  if (!isEngineEnabled()) return { attempted: 0, succeeded: 0 };

  const client = await pool.connect();
  let attempted = 0;
  let succeeded = 0;
  try {
    await client.query("BEGIN");
    const claimed = await client.query<ClaimedRow>(
      `SELECT id, op_type, trip_id, seat_no, leg_indexes, attempts
         FROM engine_compensation_queue
        WHERE attempts < $1
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [MAX_ATTEMPTS, BATCH_SIZE],
    );

    if (claimed.rows.length === 0) {
      await client.query("COMMIT");
      return { attempted: 0, succeeded: 0 };
    }

    // Mark all as in-flight (bump attempts + last_attempt_at) inside the
    // claim tx so a crash mid-batch leaves them visible to the next tick
    // with their attempt counter incremented (no infinite retry storm).
    await client.query(
      `UPDATE engine_compensation_queue
          SET attempts = attempts + 1,
              last_attempt_at = now()
        WHERE id = ANY($1::uuid[])`,
      [claimed.rows.map((r) => r.id)],
    );
    await client.query("COMMIT");

    // Now actually call the engine (outside the row-lock tx). Per-row
    // try/catch so one bad row doesn't poison the rest of the batch.
    for (const row of claimed.rows) {
      attempted++;
      try {
        if (row.op_type !== "cancel_seats") {
          throw new Error(`unsupported op_type: ${row.op_type}`);
        }
        await engineClient.cancelSeats({
          trip_id: row.trip_id,
          seat_no: row.seat_no,
          leg_indexes: row.leg_indexes,
        });
        // Success → delete the row.
        await db.execute(
          sql`DELETE FROM engine_compensation_queue WHERE id = ${row.id}::uuid`,
        );
        succeeded++;
        log.info(
          { tripId: row.trip_id, seatNo: row.seat_no, attempt: row.attempts + 1 },
          "drained"
        );
      } catch (e) {
        // Persist the error message for forensics; attempt counter was
        // already incremented in the claim tx above.
        const msg = e instanceof Error ? e.message : String(e);
        const newAttempts = row.attempts + 1;
        const justEnteredDlq = newAttempts >= MAX_ATTEMPTS;

        // S2-04: kalau attempts mencapai MAX, tandai DLQ sekali (idempotent
        // via WHERE dead_lettered_at IS NULL) lalu emit alert structured
        // satu kali. Tick berikutnya skip karena attempts >= MAX_ATTEMPTS.
        await db
          .execute(
            sql`UPDATE engine_compensation_queue
                  SET last_error = ${msg.slice(0, 500)},
                      dead_lettered_at = CASE
                        WHEN ${justEnteredDlq}::boolean AND dead_lettered_at IS NULL
                          THEN now()
                        ELSE dead_lettered_at
                      END
                WHERE id = ${row.id}::uuid`,
          )
          .catch((upErr) =>
            log.error({ err: upErr }, "failed to record last_error"),
          );

        if (justEnteredDlq) {
          // Structured single-line JSON yang gampang di-pickup Sentry,
          // Datadog, Grafana Loki, atau grep manual. Field `alert` sengaja
          // pakai snake_case supaya stabil sebagai alert key.
          log.error(
            {
              alert: "engine_compensation_dlq",
              queueId: row.id,
              opType: row.op_type,
              tripId: row.trip_id,
              seatNo: row.seat_no,
              legIndexes: row.leg_indexes,
              attempts: newAttempts,
              maxAttempts: MAX_ATTEMPTS,
              lastError: msg.slice(0, 200),
            },
            "engine_compensation_dlq"
          );
        } else {
          log.error(
            { tripId: row.trip_id, seatNo: row.seat_no, attempt: newAttempts, maxAttempts: MAX_ATTEMPTS, msg },
            "retry failed"
          );
        }
      }
    }
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    log.error({ err: e }, "worker tick failed");
  } finally {
    client.release();
  }
  return { attempted, succeeded };
}

/**
 * S2-04: count baris yang sedang stuck (sudah masuk DLQ atau attempts
 * sudah mendekati cap). Dipakai oleh /api/health/deep dan scheduler heartbeat
 * untuk memberi sinyal kalau backlog menumpuk.
 */
export async function getStuckCount(): Promise<{
  deadLettered: number;
  nearCap: number;
}> {
  if (!isEngineEnabled()) return { deadLettered: 0, nearCap: 0 };
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE dead_lettered_at IS NOT NULL)::int    AS dead_lettered,
        COUNT(*) FILTER (WHERE dead_lettered_at IS NULL
                          AND attempts >= ${Math.floor(MAX_ATTEMPTS * 0.8)})::int AS near_cap
        FROM engine_compensation_queue
    `);
    const r = result as unknown as { rows?: Array<{ dead_lettered: number; near_cap: number }>; [k: number]: { dead_lettered: number; near_cap: number } };
    const row = r.rows?.[0] ?? r[0];
    return {
      deadLettered: Number(row?.dead_lettered ?? 0),
      nearCap: Number(row?.near_cap ?? 0),
    };
  } catch (e) {
    log.error({ err: e }, "getStuckCount failed");
    return { deadLettered: 0, nearCap: 0 };
  }
}
