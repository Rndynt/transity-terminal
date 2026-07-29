import { storage } from "@server/storage";
import type { SeedContext } from "./context";

/**
 * Poster membedakan "Kursi Prioritas" (Rp 40.000) vs "Kursi Standar"
 * (Rp 30.000). Sistem belum punya fitur harga per tipe kursi, jadi harga
 * tetap flat (lihat 05-prices.ts) — tapi seat map tetap merefleksikan 2
 * zona kursi itu (baris 1-2 = prioritas, baris 3-8 = standar) supaya
 * SeatMap CSO tampil sesuai bus aslinya.
 */
export async function seedLayouts(ctx: SeedContext) {
  console.log("\n[3] Creating layouts...");

  const busMap: Array<{ seat_no: string; row: number; col: number; class: string }> = [];
  for (let row = 1; row <= 8; row++) {
    const cls = row <= 2 ? "prioritas" : "standar";
    busMap.push({ seat_no: `${row}A`, row, col: 1, class: cls });
    busMap.push({ seat_no: `${row}B`, row, col: 2, class: cls });
    busMap.push({ seat_no: `${row}C`, row, col: 3, class: cls });
    busMap.push({ seat_no: `${row}D`, row, col: 4, class: cls });
  }

  ctx.layouts.bus32 = await storage.createLayout({
    name: "AO Shuttle Medium Bus 32 Seat",
    rows: 8,
    cols: 4,
    seatMap: busMap,
  });

  console.log("  ✓ 1 layout: Medium Bus 32 Seat (2×2, baris 1-2 prioritas / baris 3-8 standar)");
}
