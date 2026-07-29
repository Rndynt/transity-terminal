import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedPatterns(ctx: SeedContext) {
  console.log("\n[5] Creating trip patterns...");

  const l = ctx.layouts;

  // allowIntraCityBooking:true karena mayoritas ke-11 halte per arah itu
  // sama-sama berada di 1 kota (Jakarta, atau Cikarang) — tanpa flag ini,
  // kombinasi naik-turun dalam kota yang sama (mis. UKI Cawang → Blok M
  // BCA, dua-duanya "Jakarta") akan diblokir fail-closed by design.
  ctx.patterns.pLpckBlokm01 = await storage.createTripPattern({
    code: "LPCK-BLOKM-01",
    name: "Lippo Cikarang → Blok M · via MRT Istora Mandiri, MRT Senayan Mastercard, MRT Blok M BCA",
    note: "Rute AO Shuttle resmi: Citywalk Lippo Cikarang - UKI Cawang - BNN - Transmart Cawang - Komdak - Istora Mandiri - Gelora Bung Karno - Summit Mas - Senayan Mastercard - Blok M BCA - Blok M",
    vehicleClass: "medium-bus-32", defaultLayoutId: l.bus32.id, active: true,
    tags: ["shuttle", "lpck-blokm", "ao-shuttle"],
    allowIntraCityBooking: true,
  });

  ctx.patterns.pBlokmLpck01 = await storage.createTripPattern({
    code: "BLOKM-LPCK-01",
    name: "Blok M → Lippo Cikarang · via MRT Blok M BCA, MRT Senayan Mastercard, MRT Istora Mandiri",
    note: "Rute AO Shuttle resmi: Blok M - Blok M BCA - Senayan Mastercard 2 - FX Kemendikbud - Istora Mandiri 2 - Semanggi - Bundaran Beverly - Meadow Green - Mall Lippo Cikarang - Siloam - Citywalk Lippo Cikarang",
    vehicleClass: "medium-bus-32", defaultLayoutId: l.bus32.id, active: true,
    tags: ["shuttle", "blokm-lpck", "ao-shuttle"],
    allowIntraCityBooking: true,
  });

  console.log("  ✓ 2 patterns (Lippo Cikarang ⇌ Blok M), allowIntraCityBooking = true di keduanya");
}

export async function seedPatternStops(ctx: SeedContext) {
  console.log("\n[6] Creating pattern stops...");

  const s = ctx.stops;
  const p = ctx.patterns;
  const D = 60; // dwell 1 menit di tiap halte transit — shuttle kota, bukan rest-stop antar-kota

  /**
   * Semua halte transit (bukan stop pertama/terakhir) sengaja dibuka
   * boardingAllowed DAN alightingAllowed, supaya skenario "naik di
   * halte X, turun di halte Y" (dua-duanya bukan endpoint outlet) bisa
   * dijual CSO — ini persis kasus yang kita bahas sebelumnya.
   */
  async function addStop(patternId: string, stopId: string, stopSequence: number, opts: { boarding: boolean; alighting: boolean; dwell?: number }) {
    await storage.createPatternStop({
      patternId, stopId, stopSequence,
      dwellSeconds: opts.dwell ?? D,
      boardingAllowed: opts.boarding,
      alightingAllowed: opts.alighting,
    });
  }

  // Rute 1: Lippo Cikarang → Blok M (11 halte)
  const route1 = [s.cwlc, s.ukic, s.bnn, s.tsmc, s.kmd, s.istpm, s.gbk, s.smt, s.snbs, s.mbca, s.blkm];
  for (let i = 0; i < route1.length; i++) {
    const isFirst = i === 0;
    const isLast = i === route1.length - 1;
    await addStop(p.pLpckBlokm01.id, route1[i].id, i + 1, {
      boarding: !isLast,
      alighting: !isFirst,
      dwell: isFirst || isLast ? 0 : D,
    });
  }

  // Rute 2: Blok M → Lippo Cikarang (11 halte, jalur & platform arah-berlawanan)
  const route2 = [s.blkm, s.mbca, s.snbs2, s.fxkd, s.istgbk2, s.smg, s.bbv, s.mdg, s.mllc, s.slm, s.cwlc];
  for (let i = 0; i < route2.length; i++) {
    const isFirst = i === 0;
    const isLast = i === route2.length - 1;
    await addStop(p.pBlokmLpck01.id, route2[i].id, i + 1, {
      boarding: !isLast,
      alighting: !isFirst,
      dwell: isFirst || isLast ? 0 : D,
    });
  }

  console.log(`  ✓ ${route1.length + route2.length} pattern stops (11 per arah)`);
}
