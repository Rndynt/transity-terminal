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
    console.warn(
      `[ENGINE_COMP_QUEUE] enqueued cancel_seats trip=${input.tripId} seat=${input.seatNo}`,
    );
  } catch (e) {
    console.error(
      "[ENGINE_COMP_QUEUE] enqueue failed (will not retry; data lost):",
      e,
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
        console.log(
          `[ENGINE_COMP_QUEUE] drained trip=${row.trip_id} seat=${row.seat_no} after attempt ${row.attempts + 1}`,
        );
      } catch (e) {
        // Persist the error message for forensics; attempt counter was
        // already incremented in the claim tx above.
        const msg = e instanceof Error ? e.message : String(e);
        await db
          .execute(
            sql`UPDATE engine_compensation_queue
                  SET last_error = ${msg.slice(0, 500)}
                WHERE id = ${row.id}::uuid`,
          )
          .catch((upErr) =>
            console.error(
              "[ENGINE_COMP_QUEUE] failed to record last_error:",
              upErr,
            ),
          );
        console.error(
          `[ENGINE_COMP_QUEUE] retry failed trip=${row.trip_id} seat=${row.seat_no} attempt=${row.attempts + 1}/${MAX_ATTEMPTS}:`,
          msg,
        );
      }
    }
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[ENGINE_COMP_QUEUE] worker tick failed:", e);
  } finally {
    client.release();
  }
  return { attempted, succeeded };
}
