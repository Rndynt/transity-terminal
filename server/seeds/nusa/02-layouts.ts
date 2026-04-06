import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedLayouts(ctx: SeedContext) {
  console.log("\n[3] Creating layouts...");

  const premio8Map = [];
  for (let row = 1; row <= 4; row++) {
    premio8Map.push({ seat_no: `${row}A`, row, col: 1, class: "premio" });
    premio8Map.push({ seat_no: `${row}B`, row, col: 2, class: "premio" });
  }

  ctx.layouts.premio8 = await storage.createLayout({
    name: "HiAce Premio 8 Seat",
    rows: 4,
    cols: 2,
    seatMap: premio8Map,
  });

  const premio14Map = [];
  premio14Map.push({ seat_no: "1A", row: 1, col: 1, class: "premio" });
  premio14Map.push({ seat_no: "1B", row: 1, col: 3, class: "premio" });
  for (let row = 2; row <= 5; row++) {
    premio14Map.push({ seat_no: `${row}A`, row, col: 1, class: "premio" });
    premio14Map.push({ seat_no: `${row}B`, row, col: 2, class: "premio" });
    premio14Map.push({ seat_no: `${row}C`, row, col: 3, class: "premio" });
  }

  ctx.layouts.premio14 = await storage.createLayout({
    name: "HiAce Premio 14 Seat",
    rows: 5,
    cols: 3,
    seatMap: premio14Map,
  });

  const commuter14Map = [];
  commuter14Map.push({ seat_no: "1A", row: 1, col: 1, class: "commuter" });
  commuter14Map.push({ seat_no: "1B", row: 1, col: 3, class: "commuter" });
  for (let row = 2; row <= 5; row++) {
    commuter14Map.push({ seat_no: `${row}A`, row, col: 1, class: "commuter" });
    commuter14Map.push({ seat_no: `${row}B`, row, col: 2, class: "commuter" });
    commuter14Map.push({ seat_no: `${row}C`, row, col: 3, class: "commuter" });
  }

  ctx.layouts.commuter14 = await storage.createLayout({
    name: "HiAce Commuter 14 Seat",
    rows: 5,
    cols: 3,
    seatMap: commuter14Map,
  });

  console.log("  ✓ 3 layouts: Premio 8 (4×2), Premio 14 (5×3), Commuter 14 (5×3)");
}
