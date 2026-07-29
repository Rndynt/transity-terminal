import type { SeedContext } from "./context";

/**
 * AO Shuttle (poster ini) murni layanan penumpang feeder MRT — tidak ada
 * penawaran kargo di materi promosi, jadi modul ini sengaja no-op. Tetap
 * diekspor supaya kontrak module seed (lihat server/seeds/index.ts) tetap
 * seragam dengan dataset nusa/buskita.
 */
export async function seedCargo(_ctx: SeedContext) {
  console.log("\n[9] Cargo types...");
  console.log("  ⊘ Dilewati — AO Shuttle tidak menjual layanan kargo");
}
