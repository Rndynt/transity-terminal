import { storage } from "@server/storage";
import type { SeedContext } from "./context";

interface StopTimeDef { stopSequence: number; arriveAt: string | null; departAt: string | null }
interface DayFlags { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean }

const WEEKDAY: DayFlags = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
const WEEKEND: DayFlags = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true };

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * offsetsMin[i] = menit kumulatif dari keberangkatan stop pertama
 * (offsetsMin[0] harus 0). Poster HANYA mencantumkan jam keberangkatan
 * di 2 outlet ujung (Citywalk Lippo Cikarang & Blok M) — jam per-halte
 * transit TIDAK ada di poster, jadi offset di bawah ini estimasi kami
 * (durasi total ±90 menit, lonjakan besar di segmen tol Cikarang-Cawang)
 * dan bisa disesuaikan lewat Master Data → Trip Bases kalau ada data GPS
 * riil.
 */
function buildStopTimes(startHHMM: string, offsetsMin: number[], dwellMin = 1): StopTimeDef[] {
  const n = offsetsMin.length;
  return offsetsMin.map((offset, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === n - 1;
    return {
      stopSequence: idx + 1,
      arriveAt: isFirst ? null : addMinutes(startHHMM, offset),
      departAt: isLast ? null : addMinutes(startHHMM, offset + (isFirst ? 0 : dwellMin)),
    };
  });
}

// Estimasi menit-kumulatif per halte (lihat urutan di 04-patterns.ts).
const ROUTE1_OFFSETS = [0, 45, 50, 55, 60, 68, 73, 78, 82, 87, 90];
const ROUTE2_OFFSETS = [0, 3, 8, 13, 18, 23, 68, 73, 78, 83, 90];

// Jam keberangkatan persis dari poster "Jadwal Keberangkatan" AO Shuttle.
// (*) di poster pada beberapa jam — penanda "melalui MRT Blok M BCA" —
// disederhanakan: semua trip base di sini melewati seluruh 11 halte,
// termasuk MRT Blok M BCA. Lihat catatan di ringkasan chat.
const CWLC_WEEKDAY = ["05:00", "05:30", "06:00", "06:30", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:15", "17:15", "18:00", "19:00", "20:00"];
const CWLC_WEEKEND = ["06:30", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const BLKM_WEEKDAY = ["06:00", "06:30", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "16:30", "17:00", "18:00", "18:45", "19:30", "20:30", "21:30"];
const BLKM_WEEKEND = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "18:45", "19:30", "20:30", "21:30"];

export async function seedTripBases(ctx: SeedContext) {
  console.log("\n[8] Creating trip bases...");

  const p = ctx.patterns;
  const l = ctx.layouts;
  const v = ctx.vehicles;
  const { validFrom, validTo, channelAll } = ctx;

  const vehicleCodes = Object.keys(v);
  let vehicleCursor = 0;
  const nextVehicleCode = () => vehicleCodes[vehicleCursor++ % vehicleCodes.length];

  async function createBase(patternId: string, codePrefix: string, namePrefix: string, time: string, offsets: number[], days: DayFlags) {
    const base = await storage.createTripBase({
      patternId,
      code: `${codePrefix}/${time}`,
      name: `${namePrefix} — ${time}`,
      active: true,
      timezone: "Asia/Jakarta",
      ...days,
      validFrom, validTo,
      defaultLayoutId: l.bus32.id,
      defaultVehicleId: v[nextVehicleCode()].id,
      capacity: 32,
      channelFlags: channelAll,
      defaultStopTimes: buildStopTimes(time, offsets),
    });
    ctx.tripBases.push(base);
  }

  for (const t of CWLC_WEEKDAY) await createBase(p.pLpckBlokm01.id, "LPCK-BLOKM-01-WD", "Lippo Cikarang → Blok M (Senin-Jumat)", t, ROUTE1_OFFSETS, WEEKDAY);
  for (const t of CWLC_WEEKEND) await createBase(p.pLpckBlokm01.id, "LPCK-BLOKM-01-WE", "Lippo Cikarang → Blok M (Sabtu-Minggu/Libur)", t, ROUTE1_OFFSETS, WEEKEND);
  for (const t of BLKM_WEEKDAY) await createBase(p.pBlokmLpck01.id, "BLOKM-LPCK-01-WD", "Blok M → Lippo Cikarang (Senin-Jumat)", t, ROUTE2_OFFSETS, WEEKDAY);
  for (const t of BLKM_WEEKEND) await createBase(p.pBlokmLpck01.id, "BLOKM-LPCK-01-WE", "Blok M → Lippo Cikarang (Sabtu-Minggu/Libur)", t, ROUTE2_OFFSETS, WEEKEND);

  console.log(`  ✓ ${ctx.tripBases.length} trip bases (${CWLC_WEEKDAY.length} WD + ${CWLC_WEEKEND.length} WE outbound, ${BLKM_WEEKDAY.length} WD + ${BLKM_WEEKEND.length} WE inbound)`);
}
