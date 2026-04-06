import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedPrices(ctx: SeedContext) {
  console.log("\n[7] Creating price rules...");

  const p = ctx.patterns;

  const priceRuleDefs = [
    { patternId: p.pJktBdg01.id, price: 95000, currency: "IDR" },
    { patternId: p.pBdgJkt01.id, price: 95000, currency: "IDR" },
    { patternId: p.pJktBdg02.id, price: 80000, currency: "IDR" },
    { patternId: p.pBdgJkt02.id, price: 80000, currency: "IDR" },
    { patternId: p.pJktSmg01.id, price: 160000, currency: "IDR" },
    { patternId: p.pSmgJkt01.id, price: 160000, currency: "IDR" },
    { patternId: p.pSmgYgy01.id, price: 80000, currency: "IDR" },
    { patternId: p.pYgySmg01.id, price: 80000, currency: "IDR" },
  ];

  for (const pr of priceRuleDefs) {
    await storage.createPriceRule({
      scope: "pattern", patternId: pr.patternId,
      tripId: null, legIndex: null,
      rule: { basePricePerLeg: pr.price, currency: pr.currency, multiplier: 1.0, pricingMode: "flat" },
      validFrom: null, validTo: null, priority: 1,
    });
  }

  console.log("  ✓ 8 price rules");
  console.log("    JKT↔BDG-01 Rp 95.000 flat (Premio) | JKT↔BDG-02 Rp 80.000 flat (Commuter)");
  console.log("    JKT↔SMG    Rp 160.000 flat          | SMG↔YGY    Rp 80.000 flat");
}
