import { db } from "@server/db";
import { storage } from "@server/storage";
import { priceRules } from "@shared/schema/pricing";
import type { SeedContext } from "./context";

const FLAT_PRICE = 40000;

/**
 * Belum ada fitur harga per tipe kursi (Prioritas Rp 40.000 vs Standar
 * Rp 30.000 di poster) — jadi SEMUA kombinasi origin→destination di-flat-
 * kan ke Rp 40.000 (harga "Kursi Prioritas online" di poster), termasuk
 * kombinasi halte-ke-halte yang bukan endpoint outlet (mis. UKI Cawang →
 * Gelora Bung Karno). Matrix di-generate penuh (forward-only, semua i<j)
 * per pattern, bukan cuma 1 sel origin-akhir↔tujuan-akhir, supaya semua
 * ke-11 halte per arah bisa dijual CSO — persis mekanisme yang dibahas
 * sebelumnya (extractMatrixGrid, allowIntraCityBooking).
 */
export async function seedPrices(ctx: SeedContext) {
  console.log("\n[7] Creating price rules...");

  const patternIds: string[] = [ctx.patterns.pLpckBlokm01.id, ctx.patterns.pBlokmLpck01.id];
  let totalCells = 0;

  for (const patternId of patternIds) {
    const patternStops = await storage.getPatternStops(patternId);
    if (patternStops.length < 2) continue;
    const sorted = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);

    const cells: Record<string, { price: number }> = {};
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        cells[`${sorted[i].stopId}|${sorted[j].stopId}`] = { price: FLAT_PRICE };
        totalCells++;
      }
    }

    await db.insert(priceRules).values({
      scope: "pattern",
      patternId,
      kind: "regular",
      matrix: { version: 1, cells },
      isActive: true,
    });
  }

  console.log(`  ✓ 2 price rules (1 per pattern), ${totalCells} sel matrix flat Rp ${FLAT_PRICE.toLocaleString("id-ID")}`);
}
