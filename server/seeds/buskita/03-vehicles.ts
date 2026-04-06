import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedVehicles(ctx: SeedContext) {
  console.log("\n[4] Creating vehicles...");

  const vehicleDefs = [
    { code: "ELF-01",  plate: "L 8801 BK", layoutId: ctx.layouts.elf12.id,    capacity: 12, notes: "Elf Long 12 Seat — Shuttle Kota" },
    { code: "ELF-02",  plate: "L 8802 BK", layoutId: ctx.layouts.elf12.id,    capacity: 12, notes: "Elf Long 12 Seat — Shuttle Kota" },
    { code: "ELF-03",  plate: "N 8803 BK", layoutId: ctx.layouts.elf12.id,    capacity: 12, notes: "Elf Long 12 Seat — Shuttle Kota" },
    { code: "ELF-04",  plate: "N 8804 BK", layoutId: ctx.layouts.elf12.id,    capacity: 12, notes: "Elf Long 12 Seat — Shuttle Kota" },
    { code: "PR14-01", plate: "L 1401 BK", layoutId: ctx.layouts.premio14.id, capacity: 14, notes: "HiAce Premio 14 Seat — Executive" },
    { code: "PR14-02", plate: "L 1402 BK", layoutId: ctx.layouts.premio14.id, capacity: 14, notes: "HiAce Premio 14 Seat — Executive" },
    { code: "PR14-03", plate: "N 1403 BK", layoutId: ctx.layouts.premio14.id, capacity: 14, notes: "HiAce Premio 14 Seat — Executive" },
    { code: "PR14-04", plate: "DK 1404 BK", layoutId: ctx.layouts.premio14.id, capacity: 14, notes: "HiAce Premio 14 Seat — Executive" },
    { code: "BUS-01",  plate: "L 2401 BK", layoutId: ctx.layouts.bus24.id,    capacity: 24, notes: "Medium Bus 24 Seat — Intercity" },
    { code: "BUS-02",  plate: "L 2402 BK", layoutId: ctx.layouts.bus24.id,    capacity: 24, notes: "Medium Bus 24 Seat — Intercity" },
  ];

  for (const v of vehicleDefs) {
    ctx.vehicles[v.code] = await storage.createVehicle(v);
  }

  console.log(`  ✓ ${vehicleDefs.length} vehicles (4 Elf 12, 4 Premio 14, 2 Bus 24)`);
}
