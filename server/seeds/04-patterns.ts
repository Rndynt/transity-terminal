import { storage } from "../storage";
import type { SeedContext } from "./context";

export async function seedPatterns(ctx: SeedContext) {
  console.log("\n[5] Creating trip patterns...");

  const s = ctx.stops;
  const l = ctx.layouts;

  ctx.patterns.pJktBdg01 = await storage.createTripPattern({
    code: "JKT-BDG-01", name: "Jakarta → Bandung · via Senen — Pasteur — Dipatiukur",
    note: "Rute utama via Atrium Senen, Cempaka Putih, Tebet ke Pasteur, Cihampelas, Dipatiukur",
    vehicleClass: "premio-14", defaultLayoutId: l.premio14.id, active: true, tags: ["shuttle", "jkt-bdg", "premio"],
  });

  ctx.patterns.pBdgJkt01 = await storage.createTripPattern({
    code: "BDG-JKT-01", name: "Bandung → Jakarta · via Dipatiukur — Pasteur — Senen",
    note: "Rute utama via Dipatiukur, Cihampelas, Pasteur ke Tebet, Cempaka Putih, Atrium Senen",
    vehicleClass: "premio-14", defaultLayoutId: l.premio14.id, active: true, tags: ["shuttle", "bdg-jkt", "premio"],
  });

  ctx.patterns.pJktBdg02 = await storage.createTripPattern({
    code: "JKT-BDG-02", name: "Jakarta → Bandung · via Grogol — Pasteur — Buah Batu",
    note: "Rute via Grogol, Kuningan ke Pasteur, Buah Batu",
    vehicleClass: "commuter-14", defaultLayoutId: l.commuter14.id, active: true, tags: ["shuttle", "jkt-bdg", "commuter"],
  });

  ctx.patterns.pBdgJkt02 = await storage.createTripPattern({
    code: "BDG-JKT-02", name: "Bandung → Jakarta · via Buah Batu — Pasteur — Grogol",
    note: "Rute via Buah Batu, Pasteur ke Kuningan, Grogol",
    vehicleClass: "commuter-14", defaultLayoutId: l.commuter14.id, active: true, tags: ["shuttle", "bdg-jkt", "commuter"],
  });

  ctx.patterns.pJktSmg01 = await storage.createTripPattern({
    code: "JKT-SMG-01", name: "Jakarta → Semarang · via Tebet — Karangayu",
    note: "Rute antar kota Jakarta-Semarang via Cempaka Putih, Tebet, Jatiwaringin",
    vehicleClass: "premio-14", defaultLayoutId: l.premio14.id, active: true, tags: ["shuttle", "jkt-smg", "intercity", "premio"],
  });

  ctx.patterns.pSmgJkt01 = await storage.createTripPattern({
    code: "SMG-JKT-01", name: "Semarang → Jakarta · via Karangayu — Tebet",
    note: "Rute antar kota Semarang-Jakarta via Majapahit, Karangayu",
    vehicleClass: "premio-14", defaultLayoutId: l.premio14.id, active: true, tags: ["shuttle", "smg-jkt", "intercity", "premio"],
  });

  ctx.patterns.pSmgYgy01 = await storage.createTripPattern({
    code: "SMG-YGY-01", name: "Semarang → Yogyakarta · via Karangayu — Gading",
    note: "Rute Semarang-Yogyakarta via Karangayu, Majapahit ke Jombor, Gading, Seturan",
    vehicleClass: "commuter-14", defaultLayoutId: l.commuter14.id, active: true, tags: ["shuttle", "smg-ygy", "commuter"],
  });

  ctx.patterns.pYgySmg01 = await storage.createTripPattern({
    code: "YGY-SMG-01", name: "Yogyakarta → Semarang · via Gading — Karangayu",
    note: "Rute Yogyakarta-Semarang via Seturan, Gading, Jombor ke Majapahit, Karangayu",
    vehicleClass: "commuter-14", defaultLayoutId: l.commuter14.id, active: true, tags: ["shuttle", "ygy-smg", "commuter"],
  });

  console.log("  ✓ 8 patterns (JKT↔BDG ×2, JKT↔SMG ×1, SMG↔YGY ×1)");
}

export async function seedPatternStops(ctx: SeedContext) {
  console.log("\n[6] Creating pattern stops...");

  const s = ctx.stops;
  const p = ctx.patterns;
  const D = 300;

  await storage.createPatternStop({ patternId: p.pJktBdg01.id, stopId: s.jktAtrium.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktBdg01.id, stopId: s.jktCemput.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktBdg01.id, stopId: s.jktTebet.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktBdg01.id, stopId: s.bdgPasteur.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pJktBdg01.id, stopId: s.bdgCihampelas.id, stopSequence: 5, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pJktBdg01.id, stopId: s.bdgDipatiukur.id, stopSequence: 6, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pBdgJkt01.id, stopId: s.bdgDipatiukur.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBdgJkt01.id, stopId: s.bdgCihampelas.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBdgJkt01.id, stopId: s.bdgPasteur.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBdgJkt01.id, stopId: s.jktTebet.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pBdgJkt01.id, stopId: s.jktCemput.id, stopSequence: 5, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pBdgJkt01.id, stopId: s.jktAtrium.id, stopSequence: 6, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pJktBdg02.id, stopId: s.jktGrogol.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktBdg02.id, stopId: s.jktKuningan.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktBdg02.id, stopId: s.bdgPasteur.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pJktBdg02.id, stopId: s.bdgBuahBatu.id, stopSequence: 4, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pBdgJkt02.id, stopId: s.bdgBuahBatu.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBdgJkt02.id, stopId: s.bdgPasteur.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pBdgJkt02.id, stopId: s.jktKuningan.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pBdgJkt02.id, stopId: s.jktGrogol.id, stopSequence: 4, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pJktSmg01.id, stopId: s.jktCemput.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktSmg01.id, stopId: s.jktTebet.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktSmg01.id, stopId: s.jktJatiwaringin.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pJktSmg01.id, stopId: s.smgKarangayu.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pJktSmg01.id, stopId: s.smgMajapahit.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pSmgJkt01.id, stopId: s.smgKarangayu.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSmgJkt01.id, stopId: s.smgMajapahit.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSmgJkt01.id, stopId: s.jktJatiwaringin.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSmgJkt01.id, stopId: s.jktTebet.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSmgJkt01.id, stopId: s.jktCemput.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pSmgYgy01.id, stopId: s.smgKarangayu.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSmgYgy01.id, stopId: s.smgMajapahit.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pSmgYgy01.id, stopId: s.ygyJombor.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSmgYgy01.id, stopId: s.ygyGading.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pSmgYgy01.id, stopId: s.ygySeturan.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  await storage.createPatternStop({ patternId: p.pYgySmg01.id, stopId: s.ygySeturan.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pYgySmg01.id, stopId: s.ygyGading.id, stopSequence: 2, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pYgySmg01.id, stopId: s.ygyJombor.id, stopSequence: 3, dwellSeconds: D, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: p.pYgySmg01.id, stopId: s.smgMajapahit.id, stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true });
  await storage.createPatternStop({ patternId: p.pYgySmg01.id, stopId: s.smgKarangayu.id, stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true });

  console.log("  ✓ Pattern stops seeded");
}
