import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedTripBases(ctx: SeedContext) {
  console.log("\n[8] Creating trip bases...");

  const p = ctx.patterns;
  const l = ctx.layouts;
  const v = ctx.vehicles;
  const { validFrom, validTo, channelAll } = ctx;

  const tripBaseDefs = [
    { patternId: p.pSbyMlg01.id, code: "SBY-MLG-01/05:30", name: "Surabaya → Malang 01 — 05:30", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "05:30" }, { stopSequence: 2, arriveAt: "05:45", departAt: "05:50" },
        { stopSequence: 3, arriveAt: "06:10", departAt: "06:15" }, { stopSequence: 4, arriveAt: "08:00", departAt: "08:05" },
        { stopSequence: 5, arriveAt: "08:20", departAt: null },
      ] },
    { patternId: p.pSbyMlg01.id, code: "SBY-MLG-01/08:00", name: "Surabaya → Malang 01 — 08:00", vehicleCode: "PR14-02", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "08:00" }, { stopSequence: 2, arriveAt: "08:15", departAt: "08:20" },
        { stopSequence: 3, arriveAt: "08:40", departAt: "08:45" }, { stopSequence: 4, arriveAt: "10:30", departAt: "10:35" },
        { stopSequence: 5, arriveAt: "10:50", departAt: null },
      ] },
    { patternId: p.pSbyMlg01.id, code: "SBY-MLG-01/11:00", name: "Surabaya → Malang 01 — 11:00", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "11:00" }, { stopSequence: 2, arriveAt: "11:15", departAt: "11:20" },
        { stopSequence: 3, arriveAt: "11:40", departAt: "11:45" }, { stopSequence: 4, arriveAt: "13:30", departAt: "13:35" },
        { stopSequence: 5, arriveAt: "13:50", departAt: null },
      ] },
    { patternId: p.pSbyMlg01.id, code: "SBY-MLG-01/14:00", name: "Surabaya → Malang 01 — 14:00", vehicleCode: "PR14-02", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "14:00" }, { stopSequence: 2, arriveAt: "14:15", departAt: "14:20" },
        { stopSequence: 3, arriveAt: "14:40", departAt: "14:45" }, { stopSequence: 4, arriveAt: "16:30", departAt: "16:35" },
        { stopSequence: 5, arriveAt: "16:50", departAt: null },
      ] },
    { patternId: p.pSbyMlg01.id, code: "SBY-MLG-01/17:00", name: "Surabaya → Malang 01 — 17:00", vehicleCode: "PR14-01", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "17:00" }, { stopSequence: 2, arriveAt: "17:15", departAt: "17:20" },
        { stopSequence: 3, arriveAt: "17:40", departAt: "17:45" }, { stopSequence: 4, arriveAt: "19:30", departAt: "19:35" },
        { stopSequence: 5, arriveAt: "19:50", departAt: null },
      ] },
    { patternId: p.pSbyMlg01.id, code: "SBY-MLG-01/20:00", name: "Surabaya → Malang 01 — 20:00", vehicleCode: "PR14-02", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "20:00" }, { stopSequence: 2, arriveAt: "20:15", departAt: "20:20" },
        { stopSequence: 3, arriveAt: "20:40", departAt: "20:45" }, { stopSequence: 4, arriveAt: "22:30", departAt: "22:35" },
        { stopSequence: 5, arriveAt: "22:50", departAt: null },
      ] },

    { patternId: p.pMlgSby01.id, code: "MLG-SBY-01/04:30", name: "Malang → Surabaya 01 — 04:30", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "04:30" }, { stopSequence: 2, arriveAt: "04:45", departAt: "04:50" },
        { stopSequence: 3, arriveAt: "06:35", departAt: "06:40" }, { stopSequence: 4, arriveAt: "07:00", departAt: "07:05" },
        { stopSequence: 5, arriveAt: "07:20", departAt: null },
      ] },
    { patternId: p.pMlgSby01.id, code: "MLG-SBY-01/07:00", name: "Malang → Surabaya 01 — 07:00", vehicleCode: "PR14-04", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "07:00" }, { stopSequence: 2, arriveAt: "07:15", departAt: "07:20" },
        { stopSequence: 3, arriveAt: "09:05", departAt: "09:10" }, { stopSequence: 4, arriveAt: "09:30", departAt: "09:35" },
        { stopSequence: 5, arriveAt: "09:50", departAt: null },
      ] },
    { patternId: p.pMlgSby01.id, code: "MLG-SBY-01/10:00", name: "Malang → Surabaya 01 — 10:00", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "10:00" }, { stopSequence: 2, arriveAt: "10:15", departAt: "10:20" },
        { stopSequence: 3, arriveAt: "12:05", departAt: "12:10" }, { stopSequence: 4, arriveAt: "12:30", departAt: "12:35" },
        { stopSequence: 5, arriveAt: "12:50", departAt: null },
      ] },
    { patternId: p.pMlgSby01.id, code: "MLG-SBY-01/13:00", name: "Malang → Surabaya 01 — 13:00", vehicleCode: "PR14-04", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "13:00" }, { stopSequence: 2, arriveAt: "13:15", departAt: "13:20" },
        { stopSequence: 3, arriveAt: "15:05", departAt: "15:10" }, { stopSequence: 4, arriveAt: "15:30", departAt: "15:35" },
        { stopSequence: 5, arriveAt: "15:50", departAt: null },
      ] },
    { patternId: p.pMlgSby01.id, code: "MLG-SBY-01/16:00", name: "Malang → Surabaya 01 — 16:00", vehicleCode: "PR14-03", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "16:00" }, { stopSequence: 2, arriveAt: "16:15", departAt: "16:20" },
        { stopSequence: 3, arriveAt: "18:05", departAt: "18:10" }, { stopSequence: 4, arriveAt: "18:30", departAt: "18:35" },
        { stopSequence: 5, arriveAt: "18:50", departAt: null },
      ] },
    { patternId: p.pMlgSby01.id, code: "MLG-SBY-01/19:00", name: "Malang → Surabaya 01 — 19:00", vehicleCode: "PR14-04", layoutId: l.premio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "19:00" }, { stopSequence: 2, arriveAt: "19:15", departAt: "19:20" },
        { stopSequence: 3, arriveAt: "21:05", departAt: "21:10" }, { stopSequence: 4, arriveAt: "21:30", departAt: "21:35" },
        { stopSequence: 5, arriveAt: "21:50", departAt: null },
      ] },

    { patternId: p.pSbyMlg02.id, code: "SBY-MLG-02/06:00", name: "Surabaya → Malang 02 — 06:00", vehicleCode: "ELF-01", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "06:00" }, { stopSequence: 2, arriveAt: "06:25", departAt: "06:30" },
        { stopSequence: 3, arriveAt: "08:30", departAt: "08:35" }, { stopSequence: 4, arriveAt: "08:50", departAt: null },
      ] },
    { patternId: p.pSbyMlg02.id, code: "SBY-MLG-02/09:00", name: "Surabaya → Malang 02 — 09:00", vehicleCode: "ELF-02", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "09:00" }, { stopSequence: 2, arriveAt: "09:25", departAt: "09:30" },
        { stopSequence: 3, arriveAt: "11:30", departAt: "11:35" }, { stopSequence: 4, arriveAt: "11:50", departAt: null },
      ] },
    { patternId: p.pSbyMlg02.id, code: "SBY-MLG-02/13:00", name: "Surabaya → Malang 02 — 13:00", vehicleCode: "ELF-01", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "13:00" }, { stopSequence: 2, arriveAt: "13:25", departAt: "13:30" },
        { stopSequence: 3, arriveAt: "15:30", departAt: "15:35" }, { stopSequence: 4, arriveAt: "15:50", departAt: null },
      ] },
    { patternId: p.pSbyMlg02.id, code: "SBY-MLG-02/17:00", name: "Surabaya → Malang 02 — 17:00", vehicleCode: "ELF-02", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "17:00" }, { stopSequence: 2, arriveAt: "17:25", departAt: "17:30" },
        { stopSequence: 3, arriveAt: "19:30", departAt: "19:35" }, { stopSequence: 4, arriveAt: "19:50", departAt: null },
      ] },

    { patternId: p.pMlgSby02.id, code: "MLG-SBY-02/05:00", name: "Malang → Surabaya 02 — 05:00", vehicleCode: "ELF-03", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "05:00" }, { stopSequence: 2, arriveAt: "05:15", departAt: "05:20" },
        { stopSequence: 3, arriveAt: "07:20", departAt: "07:25" }, { stopSequence: 4, arriveAt: "07:50", departAt: null },
      ] },
    { patternId: p.pMlgSby02.id, code: "MLG-SBY-02/08:00", name: "Malang → Surabaya 02 — 08:00", vehicleCode: "ELF-04", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "08:00" }, { stopSequence: 2, arriveAt: "08:15", departAt: "08:20" },
        { stopSequence: 3, arriveAt: "10:20", departAt: "10:25" }, { stopSequence: 4, arriveAt: "10:50", departAt: null },
      ] },
    { patternId: p.pMlgSby02.id, code: "MLG-SBY-02/12:00", name: "Malang → Surabaya 02 — 12:00", vehicleCode: "ELF-03", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "12:00" }, { stopSequence: 2, arriveAt: "12:15", departAt: "12:20" },
        { stopSequence: 3, arriveAt: "14:20", departAt: "14:25" }, { stopSequence: 4, arriveAt: "14:50", departAt: null },
      ] },
    { patternId: p.pMlgSby02.id, code: "MLG-SBY-02/16:00", name: "Malang → Surabaya 02 — 16:00", vehicleCode: "ELF-04", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "16:00" }, { stopSequence: 2, arriveAt: "16:15", departAt: "16:20" },
        { stopSequence: 3, arriveAt: "18:20", departAt: "18:25" }, { stopSequence: 4, arriveAt: "18:50", departAt: null },
      ] },

    { patternId: p.pSbyBli01.id, code: "SBY-BLI-01/06:00", name: "Surabaya → Bali 01 — 06:00", vehicleCode: "BUS-01", layoutId: l.bus24.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "06:00" }, { stopSequence: 2, arriveAt: "06:20", departAt: "06:25" },
        { stopSequence: 3, arriveAt: "08:30", departAt: "08:45" }, { stopSequence: 4, arriveAt: "14:00", departAt: "14:05" },
        { stopSequence: 5, arriveAt: "14:30", departAt: null },
      ] },
    { patternId: p.pSbyBli01.id, code: "SBY-BLI-01/14:00", name: "Surabaya → Bali 01 — 14:00", vehicleCode: "BUS-02", layoutId: l.bus24.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "14:00" }, { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "16:30", departAt: "16:45" }, { stopSequence: 4, arriveAt: "22:00", departAt: "22:05" },
        { stopSequence: 5, arriveAt: "22:30", departAt: null },
      ] },
    { patternId: p.pSbyBli01.id, code: "SBY-BLI-01/21:00", name: "Surabaya → Bali 01 — 21:00 (Malam)", vehicleCode: "BUS-01", layoutId: l.bus24.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "21:00" }, { stopSequence: 2, arriveAt: "21:20", departAt: "21:25" },
        { stopSequence: 3, arriveAt: "23:30", departAt: "23:45" }, { stopSequence: 4, arriveAt: "05:00", departAt: "05:05" },
        { stopSequence: 5, arriveAt: "05:30", departAt: null },
      ] },

    { patternId: p.pBliSby01.id, code: "BLI-SBY-01/05:00", name: "Bali → Surabaya 01 — 05:00", vehicleCode: "BUS-02", layoutId: l.bus24.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "05:00" }, { stopSequence: 2, arriveAt: "05:25", departAt: "05:30" },
        { stopSequence: 3, arriveAt: "11:00", departAt: "11:15" }, { stopSequence: 4, arriveAt: "13:20", departAt: "13:25" },
        { stopSequence: 5, arriveAt: "13:45", departAt: null },
      ] },
    { patternId: p.pBliSby01.id, code: "BLI-SBY-01/13:00", name: "Bali → Surabaya 01 — 13:00", vehicleCode: "BUS-01", layoutId: l.bus24.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "13:00" }, { stopSequence: 2, arriveAt: "13:25", departAt: "13:30" },
        { stopSequence: 3, arriveAt: "19:00", departAt: "19:15" }, { stopSequence: 4, arriveAt: "21:20", departAt: "21:25" },
        { stopSequence: 5, arriveAt: "21:45", departAt: null },
      ] },
    { patternId: p.pBliSby01.id, code: "BLI-SBY-01/20:00", name: "Bali → Surabaya 01 — 20:00 (Malam)", vehicleCode: "BUS-02", layoutId: l.bus24.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "20:00" }, { stopSequence: 2, arriveAt: "20:25", departAt: "20:30" },
        { stopSequence: 3, arriveAt: "02:00", departAt: "02:15" }, { stopSequence: 4, arriveAt: "04:20", departAt: "04:25" },
        { stopSequence: 5, arriveAt: "04:45", departAt: null },
      ] },

    { patternId: p.pBliUbud01.id, code: "BLI-UBD-01/07:00", name: "Denpasar → Ubud 01 — 07:00", vehicleCode: "ELF-01", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "07:00" }, { stopSequence: 2, arriveAt: "07:20", departAt: "07:25" },
        { stopSequence: 3, arriveAt: "08:15", departAt: null },
      ] },
    { patternId: p.pBliUbud01.id, code: "BLI-UBD-01/10:00", name: "Denpasar → Ubud 01 — 10:00", vehicleCode: "ELF-02", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "10:00" }, { stopSequence: 2, arriveAt: "10:20", departAt: "10:25" },
        { stopSequence: 3, arriveAt: "11:15", departAt: null },
      ] },
    { patternId: p.pBliUbud01.id, code: "BLI-UBD-01/14:00", name: "Denpasar → Ubud 01 — 14:00", vehicleCode: "ELF-01", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "14:00" }, { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "15:15", departAt: null },
      ] },
    { patternId: p.pBliUbud01.id, code: "BLI-UBD-01/17:00", name: "Denpasar → Ubud 01 — 17:00", vehicleCode: "ELF-02", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "17:00" }, { stopSequence: 2, arriveAt: "17:20", departAt: "17:25" },
        { stopSequence: 3, arriveAt: "18:15", departAt: null },
      ] },

    { patternId: p.pUbudBli01.id, code: "UBD-BLI-01/08:00", name: "Ubud → Denpasar 01 — 08:00", vehicleCode: "ELF-03", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "08:00" }, { stopSequence: 2, arriveAt: "08:50", departAt: "08:55" },
        { stopSequence: 3, arriveAt: "09:15", departAt: null },
      ] },
    { patternId: p.pUbudBli01.id, code: "UBD-BLI-01/11:00", name: "Ubud → Denpasar 01 — 11:00", vehicleCode: "ELF-04", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "11:00" }, { stopSequence: 2, arriveAt: "11:50", departAt: "11:55" },
        { stopSequence: 3, arriveAt: "12:15", departAt: null },
      ] },
    { patternId: p.pUbudBli01.id, code: "UBD-BLI-01/15:00", name: "Ubud → Denpasar 01 — 15:00", vehicleCode: "ELF-03", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "15:00" }, { stopSequence: 2, arriveAt: "15:50", departAt: "15:55" },
        { stopSequence: 3, arriveAt: "16:15", departAt: null },
      ] },
    { patternId: p.pUbudBli01.id, code: "UBD-BLI-01/18:00", name: "Ubud → Denpasar 01 — 18:00", vehicleCode: "ELF-04", layoutId: l.elf12.id, capacity: 12,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null, departAt: "18:00" }, { stopSequence: 2, arriveAt: "18:50", departAt: "18:55" },
        { stopSequence: 3, arriveAt: "19:15", departAt: null },
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
