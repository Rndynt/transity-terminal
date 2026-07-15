import { db } from "@server/db";
import { storage } from "@server/storage";
import { cargoRates } from "@shared/schema/cargo";
import type { SeedContext } from "./context";

/**
 * Cargo OD-matrix identity swap: cargo pricing is now pattern-scoped (no
 * global tier — a shipment always needs to know which route/pattern it's
 * on to resolve a price), so — unlike the old flat "7 global rates" —
 * every cargo type now needs a `cargo_rates` matrix row per pattern it can
 * ship on. For simplicity this seed uses the SAME pricePerKg for a given
 * cargo type across every pattern (a flat network-wide per-kg rate is a
 * common real-world choice; only minCharge varies by cargo type) rather
 * than fabricating a distance-based tariff table — the architecture fully
 * supports per-pattern variation, an operator can edit any cell later in
 * Master Data → Tarif Kargo.
 */
export async function seedCargo(ctx: SeedContext) {
  console.log("\n[9] Creating cargo types...");

  const cargoTypeDefs = [
    { code: "DOK", name: "Dokumen", description: "Surat, berkas, dan dokumen penting.", maxWeightKg: "1.00", minCharge: "10000", pricePerKg: 15000 },
    { code: "PKT-MINI", name: "Paket Mini", description: "Aksesoris, kosmetik, barang kecil.", maxWeightKg: "2.00", minCharge: "15000", pricePerKg: 12000 },
    { code: "PKT-S", name: "Paket Kecil", description: "Pakaian, buku, barang ringan.", maxWeightKg: "5.00", minCharge: "20000", pricePerKg: 10000 },
    { code: "PKT-M", name: "Paket Sedang", description: "Sepatu, tas, barang rumah tangga kecil.", maxWeightKg: "10.00", minCharge: "35000", pricePerKg: 8000 },
    { code: "PKT-L", name: "Paket Besar", description: "Peralatan rumah tangga, barang bervolume.", maxWeightKg: "20.00", minCharge: "50000", pricePerKg: 7000 },
    { code: "ELEK", name: "Elektronik", description: "Handphone, laptop, elektronik. Penanganan hati.", maxWeightKg: "10.00", minCharge: "30000", pricePerKg: 20000 },
    { code: "MKNN", name: "Makanan & Minuman", description: "Makanan, minuman, oleh-oleh. Prioritas cepat.", maxWeightKg: "5.00", minCharge: "20000", pricePerKg: 10000 },
  ];

  const createdTypes: Array<{ id: string; pricePerKg: number }> = [];
  for (const def of cargoTypeDefs) {
    const ct = await storage.createCargoType({
      code: def.code, name: def.name, description: def.description,
      maxWeightKg: def.maxWeightKg, minCharge: def.minCharge, isActive: true,
    });
    createdTypes.push({ id: ct.id, pricePerKg: def.pricePerKg });
  }
  console.log("  ✓ 7 jenis kargo: DOK, PKT-MINI, PKT-S, PKT-M, PKT-L, ELEK, MKNN");

  console.log("\n[10] Creating cargo OD-matrix rates...");

  const p = ctx.patterns;
  const patternIds: string[] = [
    p.pSbyMlg01.id, p.pMlgSby01.id, p.pSbyMlg02.id, p.pMlgSby02.id,
    p.pSbyBli01.id, p.pBliSby01.id, p.pBliUbud01.id, p.pUbudBli01.id,
  ];

  let rateCount = 0;
  for (const patternId of patternIds) {
    const patternStops = await storage.getPatternStops(patternId);
    if (patternStops.length < 2) continue;
    const sorted = [...patternStops].sort((a, b) => a.stopSequence - b.stopSequence);
    const originStopId = sorted[0].stopId;
    const destinationStopId = sorted[sorted.length - 1].stopId;

    for (const ct of createdTypes) {
      await db.insert(cargoRates).values({
        patternId,
        cargoTypeId: ct.id,
        kind: "regular",
        matrix: { version: 1, cells: { [`${originStopId}|${destinationStopId}`]: { pricePerKg: ct.pricePerKg } } },
        isActive: true,
      });
      rateCount++;
    }
  }

  console.log(`  ✓ ${rateCount} tarif kargo (8 pola x 7 jenis kargo)`);
}
