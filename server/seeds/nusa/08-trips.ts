import { storage } from "@server/storage";
import { TripBasesService } from "@modules/tripBases/tripBases.service";
import type { SeedContext } from "./context";

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

export async function seedTrips(ctx: SeedContext, days = 14) {
  console.log(`\n[11] Materializing trips for next ${days} days...`);

  const tripBasesService = new TripBasesService(storage);
  const serviceDates = nextNDays(days);

  let tripCount = 0;
  let errorCount = 0;

  for (const base of ctx.tripBases) {
    for (const serviceDate of serviceDates) {
      try {
        await tripBasesService.ensureMaterializedTrip(base.id, serviceDate);
        tripCount++;
      } catch (err: unknown) {
        if (err instanceof Error && err.message !== 'base-not-eligible') {
          console.warn(`  ! Failed to materialize ${base.code} on ${serviceDate}:`, err.message);
          errorCount++;
        }
      }
    }
    process.stdout.write(`  ✓ ${base.code}: trips materialized\n`);
  }

  console.log(`  ✓ ${tripCount} trips dibuat (${errorCount} error)`);
}
