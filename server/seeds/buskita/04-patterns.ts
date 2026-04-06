import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedPatterns(ctx: SeedContext) {
  console.log("\n[5] Creating trip patterns...");

  const s = ctx.stops;
  const l = ctx.layouts;

  ctx.patterns.pSbyMlg01 = await storage.createTripPattern({
    code: "SBY-MLG-01", name: "Surabaya → Malang · via Darmo — Klojen",
    note: "Rute utama Surabaya-Malang via Darmo, Gubeng, Waru ke Soekarno Hatta, Klojen",
    vehicleClass: "premio-14", defaultLayoutId: l.premio14.id, active: true, tags: ["shuttle", "sby-mlg", "premio"],
  });

  ctx.patterns.pMlgSby01 = await storage.createTripPattern({
    code: "MLG-SBY-01", name: "Malang → Surabaya · via Klojen — Darmo",
    note: "Rute utama Malang-Surabaya via Klojen, Soekarno Hatta ke Waru, Gubeng, Darmo",
    vehicleClass: "premio-14", defaultLayoutId: l.premio14.id, active: true, tags: ["shuttle", "mlg-sby", "premio"],
  });

  ctx.patterns.pSbyMlg02 = await storage.createTripPattern({
    code: "SBY-MLG-02", name: "Surabaya → Malang · via MERR — Lowokwaru (Ekonomi)",
    note: "Rute ekonomi via MERR ke Lowokwaru UB Area",
    vehicleClass: "elf-12", defaultLayoutId: l.elf12.id, active: true, tags: ["shuttle", "sby-mlg", "elf", "ekonomi"],
  });

  ctx.patterns.pMlgSby02 = await storage.createTripPattern({
    code: "MLG-SBY-02", name: "Malang → Surabaya · via Lowokwaru — MERR (Ekonomi)",
    note: "Rute ekonomi via Lowokwaru ke MERR",
    vehicleClass: "elf-12", defaultLayoutId: l.elf12.id, active: true, tags: ["shuttle", "mlg-sby", "elf", "ekonomi"],
  });

  ctx.patterns.pSbyBli01 = await storage.createTripPattern({
    code: "SBY-BLI-01", name: "Surabaya → Bali · via Waru — Probolinggo — Sanur",
    note: "Rute intercity Surabaya-Bali via Probolinggo, penyeberangan Ketapang-Gilimanuk",
    vehicleClass: "bus-24", defaultLayoutId: l.bus24.id, active: true, tags: ["shuttle", "sby-bli", "bus", "intercity"],
  });

  ctx.patterns.pBliSby01 = await storage.createTripPattern({
    code: "BLI-SBY-01", name: "Bali → Surabaya · via Sanur — Probolinggo — Waru",
    note: "Rute intercity Bali-Surabaya via Gilimanuk-Ketapang, Probolinggo",
    vehicleClass: "bus-24", defaultLayoutId: l.bus24.id, active: true, tags: ["shuttle", "bli-sby", "bus", "intercity"],
  });

  ctx.patterns.pBliUbud01 = await storage.createTripPattern({
    code: "BLI-UBD-01", name: "Denpasar → Ubud · via Sanur — Kuta — Ubud",
    note: "Shuttle wisata Denpasar-Ubud via Sanur dan Kuta",
    vehicleClass: "elf-12", defaultLayoutId: l.elf12.id, active: true, tags: ["shuttle", "bli-ubd", "elf", "wisata"],
  });

  ctx.patterns.pUbudBli01 = await storage.createTripPattern({
    code: "UBD-BLI-01", name: "Ubud → Denpasar · via Ubud — Kuta — Sanur",
    note: "Shuttle wisata Ubud-Denpasar via Kuta dan Sanur",
    vehicleClass: "elf-12", defaultLayoutId: l.elf12.id, active: true, tags: ["shuttle", "ubd-bli", "elf", "wisata"],
  });

  console.log("  ✓ 8 patterns (SBY↔MLG ×2, SBY↔BLI ×1, BLI↔UBD ×1)");
}

export async function seedPatternStops(ctx: SeedContext) {
  console.log("\n[6] Creating pattern stops...");

  const s = ctx.stops;
  const p = ctx.patterns;
  const D = 300;

  await storage.createPatternStop({ patternId: p.pSbyMlg01.id, stopId: s.sbyDarmo.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSbyMlg01.id, stopId: s.sbyGubeng.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSbyMlg01.id, stopId: s.sbyWaru.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSbyMlg01.id, stopId: s.mlgSoekarno.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSbyMlg01.id, stopId: s.mlgKlojen.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pMlgSby01.id, stopId: s.mlgKlojen.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pMlgSby01.id, stopId: s.mlgSoekarno.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pMlgSby01.id, stopId: s.sbyWaru.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pMlgSby01.id, stopId: s.sbyGubeng.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pMlgSby01.id, stopId: s.sbyDarmo.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pSbyMlg02.id, stopId: s.sbyMerr.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSbyMlg02.id, stopId: s.sbyWaru.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSbyMlg02.id, stopId: s.mlgLowokwaru.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSbyMlg02.id, stopId: s.mlgKlojen.id, stopSequence: 4, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pMlgSby02.id, stopId: s.mlgKlojen.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pMlgSby02.id, stopId: s.mlgLowokwaru.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pMlgSby02.id, stopId: s.sbyWaru.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pMlgSby02.id, stopId: s.sbyMerr.id, stopSequence: 4, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pSbyBli01.id, stopId: s.sbyWaru.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSbyBli01.id, stopId: s.sbyDarmo.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSbyBli01.id, stopId: s.prbLinggo.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: true, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSbyBli01.id, stopId: s.bliSanur.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSbyBli01.id, stopId: s.bliKuta.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pBliSby01.id, stopId: s.bliKuta.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBliSby01.id, stopId: s.bliSanur.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBliSby01.id, stopId: s.prbLinggo.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: true, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pBliSby01.id, stopId: s.sbyDarmo.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pBliSby01.id, stopId: s.sbyWaru.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pBliUbud01.id, stopId: s.bliSanur.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBliUbud01.id, stopId: s.bliKuta.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBliUbud01.id, stopId: s.bliUbud.id, stopSequence: 3, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pUbudBli01.id, stopId: s.bliUbud.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pUbudBli01.id, stopId: s.bliKuta.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pUbudBli01.id, stopId: s.bliSanur.id, stopSequence: 3, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  console.log("  ✓ Pattern stops seeded");
}
