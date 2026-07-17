import { db } from "@server/db";
import { storage } from "@server/storage";
import { priceRules } from "@shared/schema/pricing";
import type { SeedContext } from "./context";

export async function seedPrices(ctx: SeedContext) {
  console.log("\n[7] Creating price rules...");

  const p = ctx.patterns;

  const priceRuleDefs = [
    { patternId: p.pJktBdg01.id, price: 95000 },
    { patternId: p.pBdgJkt01.id, price: 95000 },
    { patternId: p.pJktBdg02.id, price: 80000 },
    { patternId: p.pBdgJkt02.id, price: 80000 },
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

  console.log("  ✓ 4 price rules");
  console.log("    JKT↔BDG-01 Rp 95.000 (Premio) | JKT↔BDG-02 Rp 80.000 (Commuter)");
}
