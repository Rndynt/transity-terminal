import { db } from "@server/db";
import { sql } from "drizzle-orm";
import { createSeedContext, type SeedContext } from "./context";
import { seedStops, seedOutlets } from "./01-stops";
import { seedLayouts } from "./02-layouts";
import { seedVehicles } from "./03-vehicles";
import { seedPatterns, seedPatternStops } from "./04-patterns";
import { seedPrices } from "./05-prices";
import { seedTripBases } from "./06-tripbases";
import { seedCargo } from "./07-cargo";
import { seedTrips } from "./08-trips";
import { seedRbac } from "./09-rbac";

const SEED_REGISTRY: Record<string, {
  name: string;
  deps: string[];
  run: (ctx: SeedContext) => Promise<void>;
}> = {
  stops:        { name: "Stops & Outlets",   deps: [],                                          run: async (ctx) => { await seedStops(ctx); await seedOutlets(ctx); } },
  layouts:      { name: "Seat Layouts",       deps: [],                                          run: async (ctx) => { await seedLayouts(ctx); } },
  vehicles:     { name: "Vehicles",           deps: ["layouts"],                                 run: async (ctx) => { await seedVehicles(ctx); } },
  patterns:     { name: "Trip Patterns",      deps: ["stops", "layouts"],                        run: async (ctx) => { await seedPatterns(ctx); await seedPatternStops(ctx); } },
  prices:       { name: "Price Rules",        deps: ["patterns"],                                run: async (ctx) => { await seedPrices(ctx); } },
  tripbases:    { name: "Trip Bases",         deps: ["patterns", "vehicles"],                    run: async (ctx) => { await seedTripBases(ctx); } },
  cargo:        { name: "Cargo Types & Rates",deps: [],                                          run: async (ctx) => { await seedCargo(); } },
  trips:        { name: "Materialize Trips",  deps: ["tripbases"],                               run: async (ctx) => { await seedTrips(ctx); } },
  rbac:         { name: "RBAC & Feature Flags",deps: [],                                          run: async (ctx) => { await seedRbac(); } },
};

function resolveDeps(targets: string[]): string[] {
  const resolved: string[] = [];
  const visited = new Set<string>();

  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = SEED_REGISTRY[key];
    if (!entry) {
      console.error(`Unknown seed: "${key}". Available: ${Object.keys(SEED_REGISTRY).join(", ")}`);
      process.exit(1);
    }
    for (const dep of entry.deps) {
      visit(dep);
    }
    resolved.push(key);
  }

  for (const t of targets) visit(t);
  return resolved;
}

async function cleanDatabase() {
  console.log("\n[CLEANUP] Clearing all existing data...");
  await db.execute(sql`
    TRUNCATE TABLE
      reviews,
      print_jobs,
      payments,
      passengers,
      bookings,
      cargo_shipments,
      cargo_rates,
      seat_holds,
      seat_inventory,
      trip_stop_times,
      trip_legs,
      trips,
      cargo_types,
      trip_bases,
      price_rules,
      pattern_stops,
      trip_patterns,
      outlets,
      vehicles,
      stops,
      layouts
    RESTART IDENTITY CASCADE
  `);
  console.log("[CLEANUP] Done.");
}

async function printSummary() {
  const stopCount = await db.execute(sql`SELECT COUNT(*) as c FROM stops`);
  const tripCountDB = await db.execute(sql`SELECT COUNT(*) as c FROM trips`);
  const invCount = await db.execute(sql`SELECT COUNT(*) as c FROM seat_inventory`);
  const cityList = await db.execute(sql`SELECT DISTINCT city FROM stops ORDER BY city`);

  console.log("\n═══════════════════════════════════════════");
  console.log("  SEED SELESAI");
  console.log("═══════════════════════════════════════════");
  console.log(`  Kota        : ${(cityList.rows as any[]).map((r: any) => r.city).join(', ')}`);
  console.log(`  Stops       : ${(stopCount.rows[0] as any).c}`);
  console.log(`  Trips       : ${(tripCountDB.rows[0] as any).c}`);
  console.log(`  Seat Inv    : ${(invCount.rows[0] as any).c} baris`);
  console.log("═══════════════════════════════════════════\n");
}

export async function seedAll() {
  console.log("═══════════════════════════════════════════");
  console.log("  TRANSITY SHUTTLE — SEED ALL");
  console.log("═══════════════════════════════════════════");

  await cleanDatabase();

  const ctx = createSeedContext();
  const order = resolveDeps(Object.keys(SEED_REGISTRY));

  for (const key of order) {
    const entry = SEED_REGISTRY[key];
    console.log(`\n── ${entry.name} ──`);
    await entry.run(ctx);
  }

  await printSummary();
}

export async function seedSpecific(targets: string[]) {
  const ctx = createSeedContext();
  const order = resolveDeps(targets);

  console.log("═══════════════════════════════════════════");
  console.log(`  SEED: ${order.join(" → ")}`);
  console.log("═══════════════════════════════════════════");

  for (const key of order) {
    const entry = SEED_REGISTRY[key];
    console.log(`\n── ${entry.name} ──`);
    await entry.run(ctx);
  }

  console.log("\n✓ Seed selesai.");
}

function printHelp() {
  console.log(`
Usage: npx tsx server/seeds/index.ts [target...]

Targets:
  (none)      Run ALL seeds (clean + full reseed)
  stops       Stops & outlets
  layouts     Seat layouts
  vehicles    Vehicles (depends: layouts)
  patterns    Trip patterns & stops (depends: stops, layouts)
  prices      Price rules (depends: patterns)
  tripbases   Trip base schedules (depends: patterns, vehicles)
  cargo       Cargo types & rates
  trips       Materialize trips (depends: tripbases)
  rbac        Roles, feature flags & matrix (depends: stops)

Dependencies are auto-resolved. Example:
  npx tsx server/seeds/index.ts rbac        # runs: stops → rbac
  npx tsx server/seeds/index.ts prices      # runs: stops → layouts → patterns → prices
  npx tsx server/seeds/index.ts trips       # runs: stops → layouts → vehicles → patterns → tripbases → trips
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter(a => !a.startsWith("-"));

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const run = args.length === 0 ? seedAll() : seedSpecific(args);
  run.catch(console.error).finally(() => process.exit(0));
}
