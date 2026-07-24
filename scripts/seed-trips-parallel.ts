/**
 * Parallel trip materialization script.
 * Runs ensureMaterializedTrip for all bases × next N days with concurrency.
 */
import "@server/lib/loadEnv";
import { storage } from "@server/storage";
import { TripBasesService } from "@modules/tripBases/tripBases.service";
import { db } from "@server/db";
import { sql } from "drizzle-orm";

const DAYS = Number(process.argv[2] ?? 14);
const CONCURRENCY = Number(process.argv[3] ?? 8);

function nextNDays(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const tripBasesService = new TripBasesService(storage);
  const bases = await storage.getTripBases();
  const dates = nextNDays(DAYS);

  console.log(`Materializing ${bases.length} bases × ${dates.length} days = ${bases.length * dates.length} trips (concurrency=${CONCURRENCY})`);

  let done = 0;
  let errors = 0;
  const total = bases.length * dates.length;

  const tasks: (() => Promise<void>)[] = [];
  for (const base of bases) {
    for (const date of dates) {
      tasks.push(async () => {
        try {
          await tripBasesService.ensureMaterializedTrip(base.id, date);
        } catch (err: unknown) {
          if (err instanceof Error && err.message !== 'base-not-eligible') {
            errors++;
            console.warn(`  ! ${base.id} ${date}: ${err.message}`);
          }
        }
        done++;
        if (done % 20 === 0 || done === total) {
          process.stdout.write(`  ${done}/${total} trips (${errors} errors)\n`);
        }
      });
    }
  }

  await runPool(tasks, CONCURRENCY);

  // Summary
  const tripCount = await db.execute(sql`SELECT COUNT(*) as c FROM trips`);
  const invCount = await db.execute(sql`SELECT COUNT(*) as c FROM seat_inventory`);
  console.log(`\n═══ Done ═══`);
  console.log(`  Trips     : ${(tripCount.rows[0] as { c: string }).c}`);
  console.log(`  Seat Inv  : ${(invCount.rows[0] as { c: string }).c} rows`);
}

main().catch(console.error).finally(() => process.exit(0));
