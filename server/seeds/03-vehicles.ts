import { storage } from "../storage";
import type { SeedContext } from "./context";

export async function seedVehicles(ctx: SeedContext) {
  console.log("\n[4] Creating vehicles...");

  const vehicleDefs = [
    { code: "PR8-01",  plate: "B 1281 TGH", layoutId: ctx.layouts.premio8.id,    capacity: 8,  notes: "HiAce Premio 8 Seat — Premium" },
    { code: "PR8-02",  plate: "B 1282 TGH", layoutId: ctx.layouts.premio8.id,    capacity: 8,  notes: "HiAce Premio 8 Seat — Premium" },
    { code: "PR14-01", plate: "B 1401 TGJ", layoutId: ctx.layouts.premio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "PR14-02", plate: "B 1402 TGJ", layoutId: ctx.layouts.premio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "PR14-03", plate: "D 1403 TGJ", layoutId: ctx.layouts.premio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "PR14-04", plate: "D 1404 TGJ", layoutId: ctx.layouts.premio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "CM14-01", plate: "B 1501 TGK", layoutId: ctx.layouts.commuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-02", plate: "B 1502 TGK", layoutId: ctx.layouts.commuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-03", plate: "D 1503 TGK", layoutId: ctx.layouts.commuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-04", plate: "D 1504 TGK", layoutId: ctx.layouts.commuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-05", plate: "H 1505 TGK", layoutId: ctx.layouts.commuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-06", plate: "AB 1506 TGK", layoutId: ctx.layouts.commuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
  ];

  for (const v of vehicleDefs) {
    ctx.vehicles[v.code] = await storage.createVehicle(v);
  }

  console.log(`  ✓ ${vehicleDefs.length} vehicles (2 Premio 8, 4 Premio 14, 6 Commuter 14)`);
}
