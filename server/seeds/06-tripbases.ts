import { storage } from "../storage";
import type { SeedContext } from "./context";

export async function seedTripBases(ctx: SeedContext) {
  console.log("\n[8] Creating trip bases...");

  const p = ctx.patterns;
  const l = ctx.layouts;
  const v = ctx.vehicles;
  const { validFrom, validTo, channelAll } = ctx;

  const tripBaseDefs = [
    { patternId: p.pJktBdg01.id, code: "JKT-BDG-01/06:00", name: "Jakarta → Bandung 01 — 06:00", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "06:00" }, { stopSequence: 2, arriveAt: "06:15", departAt: "06:20" },
        { stopSequence: 3, arriveAt: "06:40", departAt: "06:45" }, { stopSequence: 4, arriveAt: "09:00", departAt: "09:05" },
        { stopSequence: 5, arriveAt: "09:20", departAt: "09:25" }, { stopSequence: 6, arriveAt: "09:35", departAt: null },
      ] },
    { patternId: p.pJktBdg01.id, code: "JKT-BDG-01/09:00", name: "Jakarta → Bandung 01 — 09:00", vehicleCode: "PR14-02", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "09:00" }, { stopSequence: 2, arriveAt: "09:15", departAt: "09:20" },
        { stopSequence: 3, arriveAt: "09:40", departAt: "09:45" }, { stopSequence: 4, arriveAt: "12:00", departAt: "12:05" },
        { stopSequence: 5, arriveAt: "12:20", departAt: "12:25" }, { stopSequence: 6, arriveAt: "12:35", departAt: null },
      ] },
    { patternId: p.pJktBdg01.id, code: "JKT-BDG-01/12:00", name: "Jakarta → Bandung 01 — 12:00", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "12:00" }, { stopSequence: 2, arriveAt: "12:15", departAt: "12:20" },
        { stopSequence: 3, arriveAt: "12:40", departAt: "12:45" }, { stopSequence: 4, arriveAt: "15:15", departAt: "15:20" },
        { stopSequence: 5, arriveAt: "15:35", departAt: "15:40" }, { stopSequence: 6, arriveAt: "15:50", departAt: null },
      ] },
    { patternId: p.pJktBdg01.id, code: "JKT-BDG-01/15:00", name: "Jakarta → Bandung 01 — 15:00", vehicleCode: "PR14-02", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "15:00" }, { stopSequence: 2, arriveAt: "15:15", departAt: "15:20" },
        { stopSequence: 3, arriveAt: "15:40", departAt: "15:45" }, { stopSequence: 4, arriveAt: "18:15", departAt: "18:20" },
        { stopSequence: 5, arriveAt: "18:35", departAt: "18:40" }, { stopSequence: 6, arriveAt: "18:50", departAt: null },
      ] },
    { patternId: p.pJktBdg01.id, code: "JKT-BDG-01/18:00", name: "Jakarta → Bandung 01 — 18:00", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "18:00" }, { stopSequence: 2, arriveAt: "18:15", departAt: "18:20" },
        { stopSequence: 3, arriveAt: "18:40", departAt: "18:45" }, { stopSequence: 4, arriveAt: "21:00", departAt: "21:05" },
        { stopSequence: 5, arriveAt: "21:20", departAt: "21:25" }, { stopSequence: 6, arriveAt: "21:35", departAt: null },
      ] },
    { patternId: p.pJktBdg01.id, code: "JKT-BDG-01/21:00", name: "Jakarta → Bandung 01 — 21:00", vehicleCode: "PR14-02", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "21:00" }, { stopSequence: 2, arriveAt: "21:15", departAt: "21:20" },
        { stopSequence: 3, arriveAt: "21:40", departAt: "21:45" }, { stopSequence: 4, arriveAt: "23:45", departAt: "23:50" },
        { stopSequence: 5, arriveAt: "00:05", departAt: "00:10" }, { stopSequence: 6, arriveAt: "00:20", departAt: null },
      ] },

    { patternId: p.pBdgJkt01.id, code: "BDG-JKT-01/05:00", name: "Bandung → Jakarta 01 — 05:00", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "05:00" }, { stopSequence: 2, arriveAt: "05:10", departAt: "05:15" },
        { stopSequence: 3, arriveAt: "05:25", departAt: "05:30" }, { stopSequence: 4, arriveAt: "07:45", departAt: "07:50" },
        { stopSequence: 5, arriveAt: "08:10", departAt: "08:15" }, { stopSequence: 6, arriveAt: "08:30", departAt: null },
      ] },
    { patternId: p.pBdgJkt01.id, code: "BDG-JKT-01/08:00", name: "Bandung → Jakarta 01 — 08:00", vehicleCode: "PR14-04", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "08:00" }, { stopSequence: 2, arriveAt: "08:10", departAt: "08:15" },
        { stopSequence: 3, arriveAt: "08:25", departAt: "08:30" }, { stopSequence: 4, arriveAt: "11:00", departAt: "11:05" },
        { stopSequence: 5, arriveAt: "11:25", departAt: "11:30" }, { stopSequence: 6, arriveAt: "11:45", departAt: null },
      ] },
    { patternId: p.pBdgJkt01.id, code: "BDG-JKT-01/12:00", name: "Bandung → Jakarta 01 — 12:00", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "12:00" }, { stopSequence: 2, arriveAt: "12:10", departAt: "12:15" },
        { stopSequence: 3, arriveAt: "12:25", departAt: "12:30" }, { stopSequence: 4, arriveAt: "15:00", departAt: "15:05" },
        { stopSequence: 5, arriveAt: "15:25", departAt: "15:30" }, { stopSequence: 6, arriveAt: "15:45", departAt: null },
      ] },
    { patternId: p.pBdgJkt01.id, code: "BDG-JKT-01/15:00", name: "Bandung → Jakarta 01 — 15:00", vehicleCode: "PR14-04", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "15:00" }, { stopSequence: 2, arriveAt: "15:10", departAt: "15:15" },
        { stopSequence: 3, arriveAt: "15:25", departAt: "15:30" }, { stopSequence: 4, arriveAt: "18:00", departAt: "18:05" },
        { stopSequence: 5, arriveAt: "18:25", departAt: "18:30" }, { stopSequence: 6, arriveAt: "18:45", departAt: null },
      ] },
    { patternId: p.pBdgJkt01.id, code: "BDG-JKT-01/18:00", name: "Bandung → Jakarta 01 — 18:00", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "18:00" }, { stopSequence: 2, arriveAt: "18:10", departAt: "18:15" },
        { stopSequence: 3, arriveAt: "18:25", departAt: "18:30" }, { stopSequence: 4, arriveAt: "21:00", departAt: "21:05" },
        { stopSequence: 5, arriveAt: "21:25", departAt: "21:30" }, { stopSequence: 6, arriveAt: "21:45", departAt: null },
      ] },
    { patternId: p.pBdgJkt01.id, code: "BDG-JKT-01/21:00", name: "Bandung → Jakarta 01 — 21:00", vehicleCode: "PR14-04", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "21:00" }, { stopSequence: 2, arriveAt: "21:10", departAt: "21:15" },
        { stopSequence: 3, arriveAt: "21:25", departAt: "21:30" }, { stopSequence: 4, arriveAt: "23:45", departAt: "23:50" },
        { stopSequence: 5, arriveAt: "00:10", departAt: "00:15" }, { stopSequence: 6, arriveAt: "00:30", departAt: null },
      ] },

    { patternId: p.pJktBdg02.id, code: "JKT-BDG-02/07:00", name: "Jakarta → Bandung 02 — 07:00", vehicleCode: "CM14-01", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "07:00" }, { stopSequence: 2, arriveAt: "07:30", departAt: "07:35" },
        { stopSequence: 3, arriveAt: "09:45", departAt: "09:50" }, { stopSequence: 4, arriveAt: "10:10", departAt: null },
      ] },
    { patternId: p.pJktBdg02.id, code: "JKT-BDG-02/11:00", name: "Jakarta → Bandung 02 — 11:00", vehicleCode: "CM14-02", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "11:00" }, { stopSequence: 2, arriveAt: "11:30", departAt: "11:35" },
        { stopSequence: 3, arriveAt: "13:45", departAt: "13:50" }, { stopSequence: 4, arriveAt: "14:10", departAt: null },
      ] },
    { patternId: p.pJktBdg02.id, code: "JKT-BDG-02/15:00", name: "Jakarta → Bandung 02 — 15:00", vehicleCode: "CM14-01", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "15:00" }, { stopSequence: 2, arriveAt: "15:30", departAt: "15:35" },
        { stopSequence: 3, arriveAt: "17:45", departAt: "17:50" }, { stopSequence: 4, arriveAt: "18:10", departAt: null },
      ] },
    { patternId: p.pJktBdg02.id, code: "JKT-BDG-02/19:00", name: "Jakarta → Bandung 02 — 19:00", vehicleCode: "CM14-02", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "19:00" }, { stopSequence: 2, arriveAt: "19:30", departAt: "19:35" },
        { stopSequence: 3, arriveAt: "21:45", departAt: "21:50" }, { stopSequence: 4, arriveAt: "22:10", departAt: null },
      ] },

    { patternId: p.pBdgJkt02.id, code: "BDG-JKT-02/06:00", name: "Bandung → Jakarta 02 — 06:00", vehicleCode: "CM14-03", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "06:00" }, { stopSequence: 2, arriveAt: "06:20", departAt: "06:25" },
        { stopSequence: 3, arriveAt: "08:35", departAt: "08:40" }, { stopSequence: 4, arriveAt: "09:10", departAt: null },
      ] },
    { patternId: p.pBdgJkt02.id, code: "BDG-JKT-02/10:00", name: "Bandung → Jakarta 02 — 10:00", vehicleCode: "CM14-04", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "10:00" }, { stopSequence: 2, arriveAt: "10:20", departAt: "10:25" },
        { stopSequence: 3, arriveAt: "12:35", departAt: "12:40" }, { stopSequence: 4, arriveAt: "13:10", departAt: null },
      ] },
    { patternId: p.pBdgJkt02.id, code: "BDG-JKT-02/14:00", name: "Bandung → Jakarta 02 — 14:00", vehicleCode: "CM14-03", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "14:00" }, { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "16:35", departAt: "16:40" }, { stopSequence: 4, arriveAt: "17:10", departAt: null },
      ] },
    { patternId: p.pBdgJkt02.id, code: "BDG-JKT-02/18:00", name: "Bandung → Jakarta 02 — 18:00", vehicleCode: "CM14-04", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "18:00" }, { stopSequence: 2, arriveAt: "18:20", departAt: "18:25" },
        { stopSequence: 3, arriveAt: "20:35", departAt: "20:40" }, { stopSequence: 4, arriveAt: "21:10", departAt: null },
      ] },

    { patternId: p.pJktSmg01.id, code: "JKT-SMG-01/07:00", name: "Jakarta → Semarang 01 — 07:00", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "07:00" }, { stopSequence: 2, arriveAt: "07:20", departAt: "07:25" },
        { stopSequence: 3, arriveAt: "07:50", departAt: "07:55" }, { stopSequence: 4, arriveAt: "13:00", departAt: "13:05" },
        { stopSequence: 5, arriveAt: "13:25", departAt: null },
      ] },
    { patternId: p.pJktSmg01.id, code: "JKT-SMG-01/13:00", name: "Jakarta → Semarang 01 — 13:00", vehicleCode: "PR14-02", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "13:00" }, { stopSequence: 2, arriveAt: "13:20", departAt: "13:25" },
        { stopSequence: 3, arriveAt: "13:50", departAt: "13:55" }, { stopSequence: 4, arriveAt: "19:00", departAt: "19:05" },
        { stopSequence: 5, arriveAt: "19:25", departAt: null },
      ] },
    { patternId: p.pJktSmg01.id, code: "JKT-SMG-01/20:00", name: "Jakarta → Semarang 01 — 20:00", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "20:00" }, { stopSequence: 2, arriveAt: "20:20", departAt: "20:25" },
        { stopSequence: 3, arriveAt: "20:50", departAt: "20:55" }, { stopSequence: 4, arriveAt: "02:00", departAt: "02:05" },
        { stopSequence: 5, arriveAt: "02:25", departAt: null },
      ] },

    { patternId: p.pSmgJkt01.id, code: "SMG-JKT-01/06:00", name: "Semarang → Jakarta 01 — 06:00", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "06:00" }, { stopSequence: 2, arriveAt: "06:20", departAt: "06:25" },
        { stopSequence: 3, arriveAt: "11:30", departAt: "11:35" }, { stopSequence: 4, arriveAt: "12:00", departAt: "12:05" },
        { stopSequence: 5, arriveAt: "12:25", departAt: null },
      ] },
    { patternId: p.pSmgJkt01.id, code: "SMG-JKT-01/14:00", name: "Semarang → Jakarta 01 — 14:00", vehicleCode: "PR14-04", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "14:00" }, { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "19:30", departAt: "19:35" }, { stopSequence: 4, arriveAt: "20:00", departAt: "20:05" },
        { stopSequence: 5, arriveAt: "20:25", departAt: null },
      ] },
    { patternId: p.pSmgJkt01.id, code: "SMG-JKT-01/21:00", name: "Semarang → Jakarta 01 — 21:00", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "21:00" }, { stopSequence: 2, arriveAt: "21:20", departAt: "21:25" },
        { stopSequence: 3, arriveAt: "02:30", departAt: "02:35" }, { stopSequence: 4, arriveAt: "03:00", departAt: "03:05" },
        { stopSequence: 5, arriveAt: "03:25", departAt: null },
      ] },

    { patternId: p.pSmgYgy01.id, code: "SMG-YGY-01/06:00", name: "Semarang → Yogyakarta 01 — 06:00", vehicleCode: "CM14-05", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "06:00" }, { stopSequence: 2, arriveAt: "06:20", departAt: "06:25" },
        { stopSequence: 3, arriveAt: "09:00", departAt: "09:05" }, { stopSequence: 4, arriveAt: "09:25", departAt: "09:30" },
        { stopSequence: 5, arriveAt: "09:45", departAt: null },
      ] },
    { patternId: p.pSmgYgy01.id, code: "SMG-YGY-01/10:00", name: "Semarang → Yogyakarta 01 — 10:00", vehicleCode: "CM14-06", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "10:00" }, { stopSequence: 2, arriveAt: "10:20", departAt: "10:25" },
        { stopSequence: 3, arriveAt: "13:00", departAt: "13:05" }, { stopSequence: 4, arriveAt: "13:25", departAt: "13:30" },
        { stopSequence: 5, arriveAt: "13:45", departAt: null },
      ] },
    { patternId: p.pSmgYgy01.id, code: "SMG-YGY-01/14:00", name: "Semarang → Yogyakarta 01 — 14:00", vehicleCode: "CM14-05", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "14:00" }, { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "17:00", departAt: "17:05" }, { stopSequence: 4, arriveAt: "17:25", departAt: "17:30" },
        { stopSequence: 5, arriveAt: "17:45", departAt: null },
      ] },
    { patternId: p.pSmgYgy01.id, code: "SMG-YGY-01/18:00", name: "Semarang → Yogyakarta 01 — 18:00", vehicleCode: "CM14-06", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "18:00" }, { stopSequence: 2, arriveAt: "18:20", departAt: "18:25" },
        { stopSequence: 3, arriveAt: "21:00", departAt: "21:05" }, { stopSequence: 4, arriveAt: "21:25", departAt: "21:30" },
        { stopSequence: 5, arriveAt: "21:45", departAt: null },
      ] },

    { patternId: p.pYgySmg01.id, code: "YGY-SMG-01/05:00", name: "Yogyakarta → Semarang 01 — 05:00", vehicleCode: "CM14-05", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "05:00" }, { stopSequence: 2, arriveAt: "05:15", departAt: "05:20" },
        { stopSequence: 3, arriveAt: "05:35", departAt: "05:40" }, { stopSequence: 4, arriveAt: "08:20", departAt: "08:25" },
        { stopSequence: 5, arriveAt: "08:45", departAt: null },
      ] },
    { patternId: p.pYgySmg01.id, code: "YGY-SMG-01/09:00", name: "Yogyakarta → Semarang 01 — 09:00", vehicleCode: "CM14-06", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "09:00" }, { stopSequence: 2, arriveAt: "09:15", departAt: "09:20" },
        { stopSequence: 3, arriveAt: "09:35", departAt: "09:40" }, { stopSequence: 4, arriveAt: "12:20", departAt: "12:25" },
        { stopSequence: 5, arriveAt: "12:45", departAt: null },
      ] },
    { patternId: p.pYgySmg01.id, code: "YGY-SMG-01/13:00", name: "Yogyakarta → Semarang 01 — 13:00", vehicleCode: "CM14-05", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "13:00" }, { stopSequence: 2, arriveAt: "13:15", departAt: "13:20" },
        { stopSequence: 3, arriveAt: "13:35", departAt: "13:40" }, { stopSequence: 4, arriveAt: "16:20", departAt: "16:25" },
        { stopSequence: 5, arriveAt: "16:45", departAt: null },
      ] },
    { patternId: p.pYgySmg01.id, code: "YGY-SMG-01/17:00", name: "Yogyakarta → Semarang 01 — 17:00", vehicleCode: "CM14-06", layoutId: l.commuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "17:00" }, { stopSequence: 2, arriveAt: "17:15", departAt: "17:20" },
        { stopSequence: 3, arriveAt: "17:35", departAt: "17:40" }, { stopSequence: 4, arriveAt: "20:20", departAt: "20:25" },
        { stopSequence: 5, arriveAt: "20:45", departAt: null },
      ] },
  ];

  for (const def of tripBaseDefs) {
    const base = await storage.createTripBase({
      patternId: def.patternId, code: def.code, name: def.name,
      active: true, timezone: "Asia/Jakarta",
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
      validFrom, validTo,
      defaultLayoutId: def.layoutId,
      defaultVehicleId: v[def.vehicleCode].id,
      capacity: def.capacity,
      channelFlags: channelAll,
      defaultStopTimes: def.defaultStopTimes,
    });
    ctx.tripBases.push(base);
  }

  console.log(`  ✓ ${ctx.tripBases.length} trip bases`);
}
