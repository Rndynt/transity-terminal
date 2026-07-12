import { db } from "@server/db";
import { storage } from "@server/storage";
import { priceRules } from "@shared/schema/pricing";
import type { SeedContext } from "./context";

export async function seedPrices(ctx: SeedContext) {
  console.log("\n[7] Creating price rules...");

  const p = ctx.patterns;

  const priceRuleDefs = [
    { patternId: p.pSbyMlg01.id, price: 85000 },
    { patternId: p.pMlgSby01.id, price: 85000 },
    { patternId: p.pSbyMlg02.id, price: 55000 },
    { patternId: p.pMlgSby02.id, price: 55000 },
    { patternId: p.pSbyBli01.id, price: 250000 },
    { patternId: p.pBliSby01.id, price: 250000 },
    { patternId: p.pBliUbud01.id, price: 65000 },
    { patternId: p.pUbudBli01.id, price: 65000 },
  ];

  // OD-matrix pricing: each seed pattern here is a simple 2-endpoint route
  // (origin = first stop, destination = last stop by sequence), so one
  // matrix cell covering the full journey is the equivalent of the old
  // flat/per_leg "one price for the whole pattern" rule.
  for (const pr of priceRuleDefs) {
    const patternStops = await storage.getPatternStops(pr.patternId);
    if (patternStops.length < 2) continue;
    const sorted = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);
    const originStopId = sorted[0].stopId;
    const destinationStopId = sorted[sorted.length - 1].stopId;

    await db.insert(priceRules).values({
      scope: "pattern",
      patternId: pr.patternId,
      kind: "regular",
      matrix: { version: 1, cells: { [`${originStopId}|${destinationStopId}`]: { price: pr.price } } },
      isActive: true,
    });
  }

  console.log("  ✓ 8 price rules");
  console.log("    SBY↔MLG-01 Rp 85.000 (Premio) | SBY↔MLG-02 Rp 55.000 (Elf Ekonomi)");
  console.log("    SBY↔BLI    Rp 250.000 (Bus)    | BLI↔UBD    Rp 65.000 (Elf Wisata)");
}
