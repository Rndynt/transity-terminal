import { storage } from "@server/storage";
import type { SeedContext } from "./context";

/**
 * AO Shuttle — Halte Citywalk Lippo Cikarang ⇌ Blok M, via MRT Istora
 * Mandiri, MRT Blok M BCA & MRT Senayan Mastercard (jadwal poster resmi).
 *
 * Sengaja HANYA 2 dari 19 halte yang isOutlet:true — Citywalk Lippo
 * Cikarang & Blok M (Jl. Palatehan II), karena cuma dua titik itu yang
 * benar-benar py CSO/loket dengan jadwal keberangkatan resmi di poster.
 * 17 halte sisanya murni titik naik/turun sepanjang rute (via
 * patternStops), TIDAK perlu jadi outlet — lihat pembahasan sebelumnya
 * soal pemisahan konsep stop vs outlet.
 */
export async function seedStops(ctx: SeedContext) {
  console.log("\n[1] Creating stops...");

  const s = ctx.stops;

  // --- Cluster Cikarang (5 halte) ---
  s.cwlc = await storage.createStop({ code: "CWLC", name: "Halte Citywalk Lippo Cikarang", city: "Cikarang", lat: "-6.323600", lng: "107.131500", isOutlet: true });
  s.mllc = await storage.createStop({ code: "MLLC", name: "Halte Mall Lippo Cikarang", city: "Cikarang", lat: "-6.319500", lng: "107.129000", isOutlet: false });
  s.slm  = await storage.createStop({ code: "SLM",  name: "Halte Siloam", city: "Cikarang", lat: "-6.328200", lng: "107.126500", isOutlet: false });
  s.bbv  = await storage.createStop({ code: "BBV",  name: "Bundaran Beverly", city: "Cikarang", lat: "-6.335000", lng: "107.119000", isOutlet: false });
  s.mdg  = await storage.createStop({ code: "MDG",  name: "Meadow Green", city: "Cikarang", lat: "-6.330000", lng: "107.123000", isOutlet: false });

  // --- Cluster Jakarta (14 halte, termasuk platform arah-berlawanan "2") ---
  s.ukic    = await storage.createStop({ code: "UKIC",    name: "UKI Cawang", city: "Jakarta", lat: "-6.243500", lng: "106.862300", isOutlet: false });
  s.bnn     = await storage.createStop({ code: "BNN",     name: "Halte BNN", city: "Jakarta", lat: "-6.240100", lng: "106.857700", isOutlet: false });
  s.tsmc    = await storage.createStop({ code: "TSMC",    name: "Halte Transmart Cawang", city: "Jakarta", lat: "-6.237800", lng: "106.853500", isOutlet: false });
  s.kmd     = await storage.createStop({ code: "KMD",     name: "Halte Komdak", city: "Jakarta", lat: "-6.228000", lng: "106.828000", isOutlet: false });
  s.istpm   = await storage.createStop({ code: "ISTPM",   name: "MRT Istora Mandiri (Halte Polda Metro Jaya)", city: "Jakarta", lat: "-6.225800", lng: "106.814400", isOutlet: false });
  s.gbk     = await storage.createStop({ code: "GBK",     name: "Halte Gelora Bung Karno", city: "Jakarta", lat: "-6.218500", lng: "106.802100", isOutlet: false });
  s.smt     = await storage.createStop({ code: "SMT",     name: "Halte Summit Mas", city: "Jakarta", lat: "-6.222500", lng: "106.809500", isOutlet: false });
  s.snbs    = await storage.createStop({ code: "SNBS",    name: "MRT Senayan Mastercard (Halte Bundaran Senayan)", city: "Jakarta", lat: "-6.224900", lng: "106.799800", isOutlet: false });
  s.mbca    = await storage.createStop({ code: "MBCA",    name: "MRT Blok M BCA", city: "Jakarta", lat: "-6.244000", lng: "106.798200", isOutlet: false });
  s.blkm    = await storage.createStop({ code: "BLKM",    name: "Blok M (Jl. Palatehan II)", city: "Jakarta", lat: "-6.244700", lng: "106.799400", isOutlet: true });
  s.snbs2   = await storage.createStop({ code: "SNBS2",   name: "MRT Senayan Mastercard (Halte Bundaran Senayan 2)", city: "Jakarta", lat: "-6.225500", lng: "106.800500", isOutlet: false });
  s.fxkd    = await storage.createStop({ code: "FXKD",    name: "Halte FX Kemendikbud", city: "Jakarta", lat: "-6.226300", lng: "106.799000", isOutlet: false });
  s.istgbk2 = await storage.createStop({ code: "ISTGBK2", name: "MRT Istora Mandiri (Halte Gelora Bung Karno 2)", city: "Jakarta", lat: "-6.220000", lng: "106.803500", isOutlet: false });
  s.smg     = await storage.createStop({ code: "SMG",     name: "Halte Semanggi", city: "Jakarta", lat: "-6.224300", lng: "106.818800", isOutlet: false });

  console.log("  ✓ 19 stops (Cikarang 5, Jakarta 14) — 2 di antaranya outlet-eligible (Citywalk Lippo Cikarang, Blok M)");
}

export async function seedOutlets(ctx: SeedContext) {
  console.log("\n[2] Creating outlets...");

  const s = ctx.stops;
  const outletDefs = [
    { stopId: s.cwlc.id, name: "Citywalk Lippo Cikarang", address: "Halte Citywalk Lippo Cikarang, Lippo Cikarang, Bekasi", phone: "0819-0679-2999" },
    { stopId: s.blkm.id, name: "Blok M", address: "Jl. Palatehan II, Blok M, Kebayoran Baru, Jakarta Selatan", phone: "0819-0679-2999" },
  ];

  for (const o of outletDefs) {
    ctx.outlets.push(await storage.createOutlet(o));
  }

  console.log(`  ✓ ${outletDefs.length} outlets (Citywalk Lippo Cikarang, Blok M) — 17 halte lain sengaja BUKAN outlet`);
}
