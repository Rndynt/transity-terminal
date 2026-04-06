import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedLayouts(ctx: SeedContext) {
  console.log("\n[3] Creating layouts...");

  const elf12Map = [];
  elf12Map.push({ seat_no: "1A", row: 1, col: 1, class: "elf" });
  elf12Map.push({ seat_no: "1B", row: 1, col: 3, class: "elf" });
  for (let row = 2; row <= 4; row++) {
    elf12Map.push({ seat_no: `${row}A`, row, col: 1, class: "elf" });
    elf12Map.push({ seat_no: `${row}B`, row, col: 2, class: "elf" });
    elf12Map.push({ seat_no: `${row}C`, row, col: 3, class: "elf" });
  }
  elf12Map.push({ seat_no: "5A", row: 5, col: 2, class: "elf" });

  ctx.layouts.elf12 = await storage.createLayout({
    name: "Elf Long 12 Seat",
    rows: 5,
    cols: 3,
    seatMap: elf12Map,
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

  const bus24Map = [];
  for (let row = 1; row <= 6; row++) {
    bus24Map.push({ seat_no: `${row}A`, row, col: 1, class: "bus" });
    bus24Map.push({ seat_no: `${row}B`, row, col: 2, class: "bus" });
    bus24Map.push({ seat_no: `${row}C`, row, col: 4, class: "bus" });
    bus24Map.push({ seat_no: `${row}D`, row, col: 5, class: "bus" });
  }

  ctx.layouts.bus24 = await storage.createLayout({
    name: "Medium Bus 24 Seat",
    rows: 6,
    cols: 5,
    seatMap: bus24Map,
  });

  console.log("  ✓ 3 layouts: Elf 12 (5×3), Premio 14 (5×3), Medium Bus 24 (6×5)");
}
