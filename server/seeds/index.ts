import { db } from "@server/db";
import { sql } from "drizzle-orm";

type SeedSet = "nusa" | "buskita";

/**
 * Seed context shape is identical between buskita and nusa
 * (`server/seeds/{nusa,buskita}/context.ts`). Typed as a structural
 * `Record` here because the actual type is loaded via dynamic import
 * and TS can't statically resolve `${base}/context`. Seed runners cast
 * to the concrete `SeedContext` they need internally.
 */
type SeedCtx = Record<string, unknown>;

interface CountRow { c: string | number }
interface CityRow { city: string }

async function loadSeedModules(set: SeedSet) {
  const base = set === "nusa" ? "./nusa" : "./buskita";
  const { createSeedContext } = await import(`${base}/context`);
  const { seedStops, seedOutlets } = await import(`${base}/01-stops`);
  const { seedLayouts } = await import(`${base}/02-layouts`);
  const { seedVehicles } = await import(`${base}/03-vehicles`);
  const { seedPatterns, seedPatternStops } = await import(`${base}/04-patterns`);
  const { seedPrices } = await import(`${base}/05-prices`);
  const { seedTripBases } = await import(`${base}/06-tripbases`);
  const { seedCargo } = await import(`${base}/07-cargo`);
  const { seedTrips } = await import(`${base}/08-trips`);
  const { seedRbac } = await import(`${base}/09-rbac`);

  return {
    createSeedContext,
    modules: {
      stops:     { name: "Stops & Outlets",    deps: [] as string[],                    run: async (ctx: SeedCtx) => { await seedStops(ctx); await seedOutlets(ctx); } },
      layouts:   { name: "Seat Layouts",        deps: [] as string[],                    run: async (ctx: SeedCtx) => { await seedLayouts(ctx); } },
      vehicles:  { name: "Vehicles",            deps: ["layouts"],                       run: async (ctx: SeedCtx) => { await seedVehicles(ctx); } },
      patterns:  { name: "Trip Patterns",       deps: ["stops", "layouts"],              run: async (ctx: SeedCtx) => { await seedPatterns(ctx); await seedPatternStops(ctx); } },
      prices:    { name: "Price Rules",         deps: ["patterns"],                      run: async (ctx: SeedCtx) => { await seedPrices(ctx); } },
      tripbases: { name: "Trip Bases",          deps: ["patterns", "vehicles"],          run: async (ctx: SeedCtx) => { await seedTripBases(ctx); } },
      cargo:     { name: "Cargo Types & Rates", deps: ["patterns"],                       run: async (ctx: SeedCtx) => { await seedCargo(ctx); } },
      trips:     { name: "Materialize Trips",   deps: ["tripbases"],                     run: async (ctx: SeedCtx) => { await seedTrips(ctx); } },
      rbac:      { name: "RBAC & Feature Flags",deps: [] as string[],                    run: async (_ctx: SeedCtx) => { await seedRbac(); } },
    },
  };
}

function resolveDeps(registry: Record<string, { deps: string[] }>, targets: string[]): string[] {
  const resolved: string[] = [];
  const visited = new Set<string>();

  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = registry[key];
    if (!entry) {
      console.error(`Unknown seed: "${key}". Available: ${Object.keys(registry).join(", ")}`);
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
  console.log("\n[CLEANUP] Clearing all existing data (except users)...");
  await db.execute(sql`
    TRUNCATE TABLE
      reviews,
      print_jobs,
      payments,
      passengers,
      bookings,
      cargo_shipments,
      cargo_rates,
      cargo_rate_exceptions,
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
      layouts,
      role_flags,
      feature_flags,
      roles
    RESTART IDENTITY CASCADE
  `);
  try {
    await db.execute(sql`TRUNCATE TABLE schedule_exceptions RESTART IDENTITY CASCADE`);
  } catch (_) {}
  console.log("[CLEANUP] Done.");
}

async function printSummary() {
  const stopCount = await db.execute(sql`SELECT COUNT(*) as c FROM stops`);
  const tripCountDB = await db.execute(sql`SELECT COUNT(*) as c FROM trips`);
  const invCount = await db.execute(sql`SELECT COUNT(*) as c FROM seat_inventory`);
  const cityList = await db.execute(sql`SELECT DISTINCT city FROM stops ORDER BY city`);
  const baseCount = await db.execute(sql`SELECT COUNT(*) as c FROM trip_bases`);

  console.log("\n═══════════════════════════════════════════");
  console.log("  SEED SELESAI");
  console.log("═══════════════════════════════════════════");
  console.log(`  Kota        : ${(cityList.rows as unknown as CityRow[]).map(r => r.city).join(', ')}`);
  console.log(`  Stops       : ${(stopCount.rows[0] as unknown as CountRow).c}`);
  console.log(`  Trip Bases  : ${(baseCount.rows[0] as unknown as CountRow).c}`);
  console.log(`  Trips       : ${(tripCountDB.rows[0] as unknown as CountRow).c}`);
  console.log(`  Seat Inv    : ${(invCount.rows[0] as unknown as CountRow).c} baris`);
  console.log("═══════════════════════════════════════════\n");
}

export async function seedAll(set: SeedSet = "buskita") {
  console.log("═══════════════════════════════════════════");
  console.log(`  TRANSITY SHUTTLE — SEED ALL [${set.toUpperCase()}]`);
  console.log("═══════════════════════════════════════════");

  await cleanDatabase();

  const { createSeedContext, modules } = await loadSeedModules(set);
  const ctx = createSeedContext();
  const order = resolveDeps(modules, Object.keys(modules));

  for (const key of order) {
    const entry = modules[key as keyof typeof modules];
    console.log(`\n── ${entry.name} ──`);
    await entry.run(ctx);
  }

  await printSummary();
}

export async function seedSpecific(set: SeedSet, targets: string[]) {
  const { createSeedContext, modules } = await loadSeedModules(set);
  const ctx = createSeedContext();
  const order = resolveDeps(modules, targets);

  console.log("═══════════════════════════════════════════");
  console.log(`  SEED [${set.toUpperCase()}]: ${order.join(" → ")}`);
  console.log("═══════════════════════════════════════════");

  for (const key of order) {
    const entry = modules[key as keyof typeof modules];
    console.log(`\n── ${entry.name} ──`);
    await entry.run(ctx);
  }

  console.log("\n✓ Seed selesai.");
}

function printHelp() {
  console.log(`
Usage: npx tsx server/seeds/index.ts <dataset> [target...]

Datasets:
  nusa        Nusa Shuttle (Jakarta-Bandung-Semarang-Yogyakarta)
  buskita     BusKita (Surabaya-Malang-Bali)

Targets:
  (none)      Run ALL seeds (clean + full reseed)
  stops       Stops & outlets
  layouts     Seat layouts
  vehicles    Vehicles (depends: layouts)
  patterns    Trip patterns & stops (depends: stops, layouts)
  prices      Price rules (depends: patterns)
  tripbases   Trip base schedules (depends: patterns, vehicles)
  cargo       Cargo types & OD-matrix rates (depends: patterns)
  trips       Materialize trips (depends: tripbases)
  rbac        Roles, feature flags & matrix

Examples:
  npx tsx server/seeds/index.ts buskita          # Full seed BusKita
  npx tsx server/seeds/index.ts nusa             # Full seed Nusa
  npx tsx server/seeds/index.ts buskita trips    # Only materialize trips (BusKita)
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter(a => !a.startsWith("-"));

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const validSets = ["nusa", "buskita"];
  const set = (args[0] && validSets.includes(args[0]) ? args[0] : null) as SeedSet | null;

  if (!set) {
    console.error(`Error: dataset wajib. Gunakan: nusa | buskita`);
    printHelp();
    process.exit(1);
  }

  const targets = args.slice(1);
  const run = targets.length === 0 ? seedAll(set) : seedSpecific(set, targets);
  run.catch(console.error).finally(() => process.exit(0));
}
