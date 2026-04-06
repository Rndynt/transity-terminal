import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedPrices(ctx: SeedContext) {
  console.log("\n[7] Creating price rules...");

  const p = ctx.patterns;

  const priceRuleDefs = [
    { patternId: p.pSbyMlg01.id, price: 85000, currency: "IDR" },
    { patternId: p.pMlgSby01.id, price: 85000, currency: "IDR" },
    { patternId: p.pSbyMlg02.id, price: 55000, currency: "IDR" },
    { patternId: p.pMlgSby02.id, price: 55000, currency: "IDR" },
    { patternId: p.pSbyBli01.id, price: 250000, currency: "IDR" },
    { patternId: p.pBliSby01.id, price: 250000, currency: "IDR" },
    { patternId: p.pBliUbud01.id, price: 65000, currency: "IDR" },
    { patternId: p.pUbudBli01.id, price: 65000, currency: "IDR" },
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
  console.log("    SBY↔MLG-01 Rp 85.000 (Premio) | SBY↔MLG-02 Rp 55.000 (Elf Ekonomi)");
  console.log("    SBY↔BLI    Rp 250.000 (Bus)    | BLI↔UBD    Rp 65.000 (Elf Wisata)");
}
