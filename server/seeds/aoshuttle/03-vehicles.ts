import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedVehicles(ctx: SeedContext) {
  console.log("\n[4] Creating vehicles...");

  const vehicleDefs = [
    { code: "AOS-01", plate: "B 7001 AO", layoutId: ctx.layouts.bus32.id, capacity: 32, notes: "Medium Bus 32 Seat" },
    { code: "AOS-02", plate: "B 7002 AO", layoutId: ctx.layouts.bus32.id, capacity: 32, notes: "Medium Bus 32 Seat" },
    { code: "AOS-03", plate: "B 7003 AO", layoutId: ctx.layouts.bus32.id, capacity: 32, notes: "Medium Bus 32 Seat" },
    { code: "AOS-04", plate: "B 7004 AO", layoutId: ctx.layouts.bus32.id, capacity: 32, notes: "Medium Bus 32 Seat" },
    { code: "AOS-05", plate: "B 7005 AO", layoutId: ctx.layouts.bus32.id, capacity: 32, notes: "Medium Bus 32 Seat" },
    { code: "AOS-06", plate: "B 7006 AO", layoutId: ctx.layouts.bus32.id, capacity: 32, notes: "Medium Bus 32 Seat" },
  ];

  for (const v of vehicleDefs) {
    ctx.vehicles[v.code] = await storage.createVehicle(v);
  }

  console.log(`  ✓ ${vehicleDefs.length} vehicles (Medium Bus 32 Seat, dirotasi antar trip base)`);
}
