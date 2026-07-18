/**
 * TransityTerminal — Performance Load Seeder (v2)
 *
 * Menghasilkan data volume tinggi untuk stress-test query.
 * Semua data di-prefix "PL-" agar mudah diidentifikasi.
 *
 * Scale:
 *   •  25 stops  +  25 outlets  (5 kota × 5 masing-masing)
 *   •  20 drivers
 *   •   3 layouts + 50 kendaraan
 *   • 100 patterns (rute) — direct 2-stop, beda kota
 *   •   2.000 trip bases  (100 rute × 20 jadwal, setiap 30 menit 05:00–14:30)
 *   •  60.000 trips  (30 hari)
 *   • 120.000 trip_stop_times  •  60.000 trip_legs  (legIndex=1)
 *   • 840.000 seat_inventory   (14 kursi × 1 leg × 60K trips, legIndex=1)
 *   • ~260K bookings + passengers + payments
 *   •   5.000 seat_holds  (aktif & kadaluarsa)
 *
 * Usage:
 *   npx tsx server/seeds/perfload/index.ts          # run seeder
 *   npx tsx server/seeds/perfload/index.ts --clean  # hapus data PL- dulu, seed ulang
 *   npx tsx server/seeds/perfload/index.ts --drop   # hapus data PL- saja
 *
 * FIX LOG (v2):
 *   - legIndex 0→1 (computeLegIndexes(1,2) = [1], bukan [0])
 *   - seat_holds.legIndexes [0]→[1]
 *   - bookings.outletId diisi dari outlet origin stop
 *   - trips.driverId + snapDriverName untuk semua trip
 *   - 20 PL- drivers ditambahkan
 *   - Cleanup SQL diperbaiki sesuai perubahan
 */
import "@server/lib/loadEnv";
import { randomUUID } from "node:crypto";
import { db } from "@server/db";
import { sql } from "drizzle-orm";
import { stops, outlets } from "@shared/schema/network";
import { layouts, vehicles, drivers } from "@shared/schema/fleet";
import {
  tripPatterns, patternStops,
  tripBases, trips, tripStopTimes, tripLegs,
} from "@shared/schema/scheduling";
import { seatInventory, seatHolds } from "@shared/schema/inventory";
import { bookings, passengers, payments } from "@shared/schema/booking";
import { priceRules } from "@shared/schema/pricing";

// ─── Config ──────────────────────────────────────────────────────────────────
const NUM_PATTERNS      = 100;
const BASES_PER_PATTERN = 20;   // 05:00 – 14:30, tiap 30 mnt
const DAYS              = 30;   // 15 hari lalu + hari ini + 14 mendatang
const CAPACITY          = 14;
const CHUNK             = 2000;
const PAST_DAYS         = 15;   // index 0..14 = hari lalu
const CHANNEL_FLAGS     = { CSO: true, WEB: false, APP: false, OTA: false };

// LEG INDEX — computeLegIndexes(originSeq=1, destSeq=2) = [1]
// Jangan ubah! Harus konsisten dengan booking.helpers.ts
const LEG_IDX = 1;

// ─── Helper ──────────────────────────────────────────────────────────────────
function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function bulkInsert(table: any, rows: any[], size = CHUNK) {
  if (!rows.length) return;
  for (const c of chunkArr(rows, size)) await (db.insert(table) as any).values(c);
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function minsToHHMM(m: number) { return `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`; }

function dateOffset(today: Date, offsetDays: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function wibToDate(dateStr: string, hhmm: string): Date {
  return new Date(`${dateStr}T${hhmm}:00+07:00`);
}

/** Pseudo-random int [min, max] deterministik */
function pseudoRand(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
}

// ─── Master data statik ───────────────────────────────────────────────────────
const CITIES = [
  { key: "JKT", name: "Jakarta",    lat: -6.20,  lng: 106.80 },
  { key: "BDG", name: "Bandung",    lat: -6.90,  lng: 107.60 },
  { key: "SMG", name: "Semarang",   lat: -7.00,  lng: 110.40 },
  { key: "YGY", name: "Yogyakarta", lat: -7.80,  lng: 110.35 },
  { key: "SBY", name: "Surabaya",   lat: -7.25,  lng: 112.75 },
];

const STOP_NAMES = [
  // Jakarta (city 0)
  ["Atrium Senen","Cempaka Putih","MT Haryono Tebet","Grogol Petamburan","Rasuna Said Kuningan"],
  // Bandung (city 1)
  ["Dipatiukur","Pasteur","Cihampelas","Buah Batu","Gedebage"],
  // Semarang (city 2)
  ["Karangayu","Majapahit","Penggaron","Banyumanik","Ungaran"],
  // Yogyakarta (city 3)
  ["Gading Mantrijeron","Jombor","Seturan","Prambanan","Klaten"],
  // Surabaya (city 4)
  ["Bungurasih","Jambangan","Waru","Darmo Satelit","Tanjung Perak"],
];

const TRAVEL_MINS: number[][] = [
  //  JKT   BDG   SMG   YGY   SBY
  [   0,  180,  360,  420,  600 ],
  [ 180,    0,  300,  360,  540 ],
  [ 360,  300,    0,  120,  240 ],
  [ 420,  360,  120,    0,  300 ],
  [ 600,  540,  240,  300,    0 ],
];

function fareForMins(mins: number): number {
  if (mins <= 180) return 95000;
  if (mins <= 300) return 150000;
  if (mins <= 420) return 200000;
  return 280000;
}

/** 14-seat Premio layout */
const SEAT_MAP = (() => {
  const m: { seat_no: string; row: number; col: number; class: string }[] = [];
  m.push({ seat_no: "1A", row: 1, col: 1, class: "premio" });
  m.push({ seat_no: "1B", row: 1, col: 3, class: "premio" });
  for (let r = 2; r <= 5; r++) {
    m.push({ seat_no: `${r}A`, row: r, col: 1, class: "premio" });
    m.push({ seat_no: `${r}B`, row: r, col: 2, class: "premio" });
    m.push({ seat_no: `${r}C`, row: r, col: 3, class: "premio" });
  }
  return m;
})();
const SEAT_NOS = SEAT_MAP.map(s => s.seat_no);

const DEPARTURE_TIMES: string[] = Array.from({ length: BASES_PER_PATTERN }, (_, k) =>
  minsToHHMM(5 * 60 + k * 30)
);

const FIRST_NAMES = ["Budi","Siti","Ahmad","Dewi","Rudi","Rina","Joko","Ani","Hendra","Lestari",
                     "Agus","Wati","Eko","Indah","Wahyu","Putri","Dedi","Nita","Fajar","Yuni"];
const LAST_NAMES  = ["Santoso","Rahayu","Kusuma","Wijaya","Susanto","Hartono","Utomo","Wibowo",
                     "Setiawan","Purnama","Gunawan","Siregar","Nasution","Lubis","Harahap"];
const PAYMENT_METHODS = ["cash","qr","ewallet","bank"] as const;

function fakeName(seed: number): string {
  return `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[(seed * 7) % LAST_NAMES.length]}`;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanPerfData(prefix: string) {
  const p = prefix.replace(/'/g, "''"); // SQL-safe
  console.log(`\n[CLEANUP] Menghapus data ${prefix}* ...`);
  await db.execute(sql.raw(`
    DELETE FROM seat_holds      WHERE hold_ref LIKE '${p}%';
    DELETE FROM payments        WHERE booking_id IN (SELECT id FROM bookings WHERE booking_code LIKE '${p}%');
    DELETE FROM passengers      WHERE booking_id IN (SELECT id FROM bookings WHERE booking_code LIKE '${p}%');
    DELETE FROM bookings        WHERE booking_code LIKE '${p}%';
    DELETE FROM seat_inventory  WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE '${p}%');
    DELETE FROM trip_legs       WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE '${p}%');
    DELETE FROM trip_stop_times WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE '${p}%');
    DELETE FROM trips           WHERE snap_route_code LIKE '${p}%';
    DELETE FROM trip_bases      WHERE code LIKE '${p}%';
    DELETE FROM price_rules     WHERE pattern_id IN (SELECT id FROM trip_patterns WHERE code LIKE '${p}%');
    DELETE FROM pattern_stops   WHERE pattern_id IN (SELECT id FROM trip_patterns WHERE code LIKE '${p}%');
    DELETE FROM trip_patterns   WHERE code LIKE '${p}%';
    DELETE FROM vehicles        WHERE code LIKE '${p}%';
    DELETE FROM outlets         WHERE stop_id IN (SELECT id FROM stops WHERE code LIKE '${p}%');
    DELETE FROM stops           WHERE code LIKE '${p}%';
    DELETE FROM layouts         WHERE name LIKE '${p}%';
    DELETE FROM drivers         WHERE code LIKE '${p}%';
  `));
  console.log(`  ✓ Data ${prefix}* dihapus`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doClean = args.includes("--clean") || args.includes("--drop");
  const dropOnly = args.includes("--drop");

  // --prefix PL2- allows a second independent run alongside the first PL- dataset
  const prefixArg = args.find(a => a.startsWith("--prefix="))?.split("=")[1]
    ?? (args[args.indexOf("--prefix") + 1] !== undefined && !args[args.indexOf("--prefix") + 1].startsWith("--")
      ? args[args.indexOf("--prefix") + 1]
      : undefined);
  const PREFIX = prefixArg ?? "PL-";

  if (doClean) await cleanPerfData(PREFIX);
  if (dropOnly) { console.log("Done."); process.exit(0); }

  console.log(`  Using prefix: "${PREFIX}"`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const serviceDates: string[] = Array.from({ length: DAYS }, (_, i) =>
    dateOffset(today, i - PAST_DAYS)
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — STOPS + OUTLETS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[1] Membuat stops + outlets ...");

  const stopData: {
    id: string; code: string; city: string; cityIdx: number; stopInCity: number; name: string;
  }[] = [];
  const stopRows: any[]   = [];
  const outletRows: any[] = [];

  for (let c = 0; c < CITIES.length; c++) {
    const city = CITIES[c];
    for (let s = 0; s < 5; s++) {
      const globalIdx = c * 5 + s;
      const id   = randomUUID();
      const code = `${PREFIX}${city.key}-${s + 1}`;
      const name = `${PREFIX}${STOP_NAMES[c][s]}`;
      stopData.push({ id, code, city: city.name, cityIdx: c, stopInCity: s, name });
      stopRows.push({
        id, code, name, city: city.name,
        isOutlet: true,
        lat: String((city.lat + (s - 2) * 0.03).toFixed(6)),
        lng: String((city.lng + (s - 2) * 0.02).toFixed(6)),
      });
      outletRows.push({
        stopId: id,
        name,
        address: `Jl. Perfload ${globalIdx + 1}, ${city.name}`,
        phone: `021-PERF-${String(globalIdx + 1).padStart(4, "0")}`,
      });
    }
  }

  await bulkInsert(stops, stopRows);
  await bulkInsert(outlets, outletRows);

  // Query balik outletId berdasarkan stopId
  const outletRows2 = await db.select({ id: outlets.id, stopId: outlets.stopId }).from(outlets)
    .where(sql`stop_id = ANY(${sql`ARRAY[${sql.join(stopData.map(s => sql`${s.id}::uuid`), sql`, `)}]`})`);
  const stopToOutletId = new Map<string, string>(outletRows2.map(o => [o.stopId!, o.id]));
  console.log(`  ✓ ${stopRows.length} stops, ${outletRows.length} outlets (${stopToOutletId.size} outlet IDs diperoleh)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — DRIVERS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[2] Membuat drivers ...");
  const DRIVER_NAMES = [
    "Slamet Riyadi","Bambang Susilo","Hartono Wibowo","Supriyanto Eko","Agung Prasetyo",
    "Mulyadi Santoso","Dwi Cahyono","Hendri Kurniawan","Ari Setiawan","Yusuf Hidayat",
    "Rizki Permana","Fandi Irawan","Doni Pradana","Bagas Nugroho","Taufik Hakim",
    "Reza Firmansyah","Galih Purnomo","Wahyu Nugraha","Arif Budiman","Teguh Prasetya",
  ];
  const driverRows: any[] = DRIVER_NAMES.map((name, i) => ({
    code:        `${PREFIX}DRV-${String(i + 1).padStart(3, "0")}`,
    name,
    phone:       `0812-PERF-${String(1000 + i)}`,
    licenseNo:   `SIM-${PREFIX}${String(i + 1).padStart(5, "0")}`,
    licenseType: "B2",
    status:      "active",
  }));
  const driverIds: string[] = (
    await db.insert(drivers).values(driverRows).returning({ id: drivers.id })
  ).map(r => r.id);
  console.log(`  ✓ ${driverIds.length} drivers`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3 — LAYOUT + VEHICLES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[3] Membuat layout + vehicles ...");
  const [layout14] = await db.insert(layouts).values({
    name: `${PREFIX}Premio 14 Seat`,
    rows: 5, cols: 3,
    seatMap: SEAT_MAP,
  }).returning({ id: layouts.id });

  const vehicleRows: any[] = Array.from({ length: 50 }, (_, i) => ({
    code:     `${PREFIX}V-${String(i + 1).padStart(3, "0")}`,
    plate:    `B ${String(1000 + i).padStart(4, "0")} ${PREFIX.replace(/[^A-Z0-9]/gi,"").slice(0,4).toUpperCase()}`,
    layoutId: layout14.id,
    capacity: CAPACITY,
    notes:    `PerfLoad Vehicle #${i + 1}`,
  }));
  const vehicleIds: string[] = (
    await db.insert(vehicles).values(vehicleRows).returning({ id: vehicles.id })
  ).map(r => r.id);
  console.log(`  ✓ 1 layout (14 kursi), ${vehicleIds.length} vehicles`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4 — PATTERNS + PATTERN STOPS + PRICE RULES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[4] Membuat patterns ...");

  const patternData: {
    id: string; code: string;
    origStopId: string; destStopId: string;
    origStopName: string; destStopName: string;
    origCityIdx: number; destCityIdx: number;
    travelMins: number;
  }[] = [];
  const patternRows: any[]   = [];
  const patStopRows: any[]   = [];
  const priceRuleRows: any[] = [];

  for (let i = 0; i < NUM_PATTERNS; i++) {
    const origIdx  = Math.floor(i / 4);
    const j        = i % 4;
    const origCity = Math.floor(origIdx / 5);
    const destCity = (origCity + j + 1) % 5;
    const destIdx  = destCity * 5 + (origIdx % 5);

    const origStop   = stopData[origIdx];
    const destStop   = stopData[destIdx];
    const travelMins = TRAVEL_MINS[origCity][destCity];
    const fare       = fareForMins(travelMins);
    const patId      = randomUUID();
    const code       = `${PREFIX}P${String(i + 1).padStart(3, "0")}`;

    patternData.push({
      id: patId, code,
      origStopId: origStop.id, destStopId: destStop.id,
      origStopName: origStop.name, destStopName: destStop.name,
      origCityIdx: origCity, destCityIdx: destCity, travelMins,
    });

    patternRows.push({
      id: patId, code,
      name: `${PREFIX}${CITIES[origCity].name} → ${CITIES[destCity].name} (${code})`,
      vehicleClass: "premio-14",
      defaultLayoutId: layout14.id,
      active: true,
      tags: ["perfload"],
      allowIntraCityBooking: false,
    });

    patStopRows.push(
      { patternId: patId, stopId: origStop.id, stopSequence: 1,
        boardingAllowed: true,  alightingAllowed: false, dwellSeconds: 0 },
      { patternId: patId, stopId: destStop.id, stopSequence: 2,
        boardingAllowed: false, alightingAllowed: true,  dwellSeconds: 0 },
    );

    priceRuleRows.push({
      scope: "pattern",
      patternId: patId,
      kind: "regular",
      isActive: true,
      matrix: {
        version: 1,
        cells: { [`${origStop.id}|${destStop.id}`]: { price: fare } },
      },
    });
  }

  await bulkInsert(tripPatterns, patternRows);
  await bulkInsert(patternStops, patStopRows);
  await bulkInsert(priceRules, priceRuleRows);
  console.log(`  ✓ ${patternRows.length} patterns, ${patStopRows.length} pattern stops, ${priceRuleRows.length} price rules`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5 — TRIP BASES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[5] Membuat trip bases (2.000) ...");

  const currentYear = today.getFullYear();
  const validFrom   = `${currentYear}-01-01`;
  const validTo     = `${currentYear + 1}-12-31`;

  const baseIds: string[] = Array.from({ length: NUM_PATTERNS * BASES_PER_PATTERN }, () => randomUUID());
  const baseRows: any[]   = [];

  for (let p = 0; p < NUM_PATTERNS; p++) {
    const pat   = patternData[p];
    const vehId = vehicleIds[p % vehicleIds.length];

    for (let t = 0; t < BASES_PER_PATTERN; t++) {
      const baseIdx      = p * BASES_PER_PATTERN + t;
      const departHHMM   = DEPARTURE_TIMES[t];
      const [dh, dm]     = departHHMM.split(":").map(Number);
      const arrMinsTotal = dh * 60 + dm + pat.travelMins;
      const arrHHMM      = minsToHHMM(arrMinsTotal);

      baseRows.push({
        id:              baseIds[baseIdx],
        code:            `${PREFIX}${String(p + 1).padStart(3, "0")}/${departHHMM}`,
        name:            `${PREFIX}${CITIES[pat.origCityIdx].name}→${CITIES[pat.destCityIdx].name} ${departHHMM}`,
        patternId:       pat.id,
        active:          true,
        timezone:        "Asia/Jakarta",
        validFrom, validTo,
        mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
        defaultLayoutId:  layout14.id,
        defaultVehicleId: vehId,
        capacity:         CAPACITY,
        channelFlags:     CHANNEL_FLAGS,
        defaultStopTimes: [
          { stopSequence: 1, arriveAt: null,    departAt: departHHMM },
          { stopSequence: 2, arriveAt: arrHHMM, departAt: null       },
        ],
      });
    }
  }

  for (const c of chunkArr(baseRows, CHUNK)) {
    await (db.insert(tripBases) as any).values(c);
  }
  console.log(`  ✓ ${baseRows.length} trip bases`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6 — TRIPS + STOP TIMES + LEGS + SEAT INVENTORY
  // PENTING: legIndex = LEG_IDX (= 1), sesuai computeLegIndexes(originSeq=1, destSeq=2) = [1]
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[6] Membuat trips, stop_times, legs, seat_inventory ...");

  const totalTrips = NUM_PATTERNS * BASES_PER_PATTERN * DAYS;
  const tripUUIDs: string[] = Array.from({ length: totalTrips }, () => randomUUID());

  function tripIdx(p: number, t: number, d: number) {
    return p * BASES_PER_PATTERN * DAYS + t * DAYS + d;
  }

  let insertedTrips = 0;

  for (let d = 0; d < DAYS; d++) {
    const serviceDate  = serviceDates[d];
    const tripBatch:     any[] = [];
    const stopTimeBatch: any[] = [];
    const legBatch:      any[] = [];
    const invBatch:      any[] = [];

    for (let p = 0; p < NUM_PATTERNS; p++) {
      const pat  = patternData[p];

      for (let t = 0; t < BASES_PER_PATTERN; t++) {
        const baseIdx    = p * BASES_PER_PATTERN + t;
        const tid        = tripUUIDs[tripIdx(p, t, d)];
        const departHHMM = DEPARTURE_TIMES[t];
        const [dh, dm]   = departHHMM.split(":").map(Number);
        const arrMinsTotal = dh * 60 + dm + pat.travelMins;
        const arrHHMM    = minsToHHMM(arrMinsTotal);

        const departAt = wibToDate(serviceDate, departHHMM);
        const arriveAt = wibToDate(serviceDate, arrHHMM);

        const vehIdx     = (p * BASES_PER_PATTERN + t) % vehicleIds.length;
        const vehId      = vehicleIds[vehIdx];
        // Assign driver: setiap trip dapat driver berrotasi. Trip lalu wajib punya driver.
        const driverIdx  = (p * BASES_PER_PATTERN * DAYS + t * DAYS + d) % driverIds.length;
        const driverId   = driverIds[driverIdx];
        const driverName = driverRows[driverIdx].name;

        tripBatch.push({
          id:              tid,
          baseId:          baseIds[baseIdx],
          patternId:       pat.id,
          serviceDate,
          status:          "scheduled",
          vehicleId:       vehId,
          layoutId:        layout14.id,
          capacity:        CAPACITY,
          driverId,                       // ← driver assigned
          originDepartHHMM: departHHMM,
          channelFlags:    CHANNEL_FLAGS,
          snapRouteCode:   `${PREFIX}P${String(p + 1).padStart(3, "0")}`,
          snapRouteName:   `${PREFIX}${CITIES[pat.origCityIdx].name}→${CITIES[pat.destCityIdx].name}`,
          snapDriverName:  driverName,    // ← snap driver name
          snapVehiclePlate: `B ${String(1000 + vehIdx).padStart(4, "0")} ${PREFIX.replace(/[^A-Z0-9]/gi,"").slice(0,4).toUpperCase()}`,
        });

        // Stop times: seq 1 (berangkat) dan seq 2 (tiba)
        stopTimeBatch.push(
          {
            tripId: tid, stopId: pat.origStopId, stopSequence: 1,
            departAt, arriveAt: null,
            boardingAllowed: true, alightingAllowed: false, dwellSeconds: 0,
          },
          {
            tripId: tid, stopId: pat.destStopId, stopSequence: 2,
            departAt: null, arriveAt,
            boardingAllowed: false, alightingAllowed: true, dwellSeconds: 0,
          },
        );

        // Leg: legIndex = LEG_IDX (1), bukan 0
        // computeLegIndexes(originSeq=1, destSeq=2) = [1]
        legBatch.push({
          tripId: tid, legIndex: LEG_IDX,
          fromStopId: pat.origStopId, toStopId: pat.destStopId,
          departAt, arriveAt, durationMin: pat.travelMins,
        });

        // Seat inventory: 14 kursi × legIndex=LEG_IDX
        for (const seatNo of SEAT_NOS) {
          invBatch.push({ tripId: tid, seatNo, legIndex: LEG_IDX, booked: false });
        }
      }
    }

    for (const c of chunkArr(tripBatch,     CHUNK)) await (db.insert(trips)         as any).values(c);
    for (const c of chunkArr(stopTimeBatch, CHUNK)) await (db.insert(tripStopTimes) as any).values(c);
    for (const c of chunkArr(legBatch,      CHUNK)) await (db.insert(tripLegs)       as any).values(c);
    for (const c of chunkArr(invBatch,      CHUNK)) await (db.insert(seatInventory)  as any).values(c);

    insertedTrips += tripBatch.length;
    process.stdout.write(`    trips: ${insertedTrips}/${totalTrips} (hari ${d + 1}/${DAYS})\r`);
  }

  console.log(`\n  ✓ ${totalTrips} trips, ${totalTrips * 2} stop_times, ${totalTrips} legs (legIdx=${LEG_IDX}), ${totalTrips * CAPACITY} seat_inventory rows`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 7 — BOOKINGS + PASSENGERS + PAYMENTS
  // bookings.outletId diisi dari outlet origin stop (CSO booking dari loket asal)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[7] Membuat bookings, passengers, payments ...");

  const bookingRows:   any[] = [];
  const passengerRows: any[] = [];
  const paymentRows:   any[] = [];

  // Track kursi yang di-book (tripId → Set<seatNo>) untuk seat_inventory update + holds
  const bookedMap = new Map<string, Set<string>>();

  let bkCounter = 0;

  for (let d = 0; d < DAYS; d++) {
    const serviceDate = serviceDates[d];
    const isPast      = d < PAST_DAYS;
    const isToday     = d === PAST_DAYS;

    for (let p = 0; p < NUM_PATTERNS; p++) {
      const pat       = patternData[p];
      const fare      = fareForMins(pat.travelMins);
      // outletId: booking dibuat dari outlet asal (origin stop)
      const outletId  = stopToOutletId.get(pat.origStopId);

      for (let t = 0; t < BASES_PER_PATTERN; t++) {
        const tid        = tripUUIDs[tripIdx(p, t, d)];
        const departHHMM = DEPARTURE_TIMES[t];

        const seed  = p * 1000 + t * 30 + d;
        const nBook = isPast  ? pseudoRand(seed, 3, 10)
                    : isToday ? pseudoRand(seed, 2, 8)
                    :           pseudoRand(seed, 0, 4);

        if (nBook === 0) continue;

        const tripBooked = new Set<string>();

        for (let k = 0; k < nBook && k < CAPACITY; k++) {
          const seatNo    = SEAT_NOS[k];
          const bookingId = randomUUID();
          const passId    = randomUUID();
          const payId     = randomUUID();
          const code      = `${PREFIX}${String(++bkCounter).padStart(7, "0")}`;
          const nameSeed  = bkCounter + k;
          const name      = fakeName(nameSeed);

          const status = isPast
            ? (k < 2 && pseudoRand(seed + k, 0, 9) < 2 ? "cancelled" : "paid")
            : (pseudoRand(seed + k, 0, 9) < 4 ? "pending" : "confirmed");

          const daysBeforeTrip = pseudoRand(seed + k, 1, 7);
          const createdAt = wibToDate(serviceDate, "08:00");
          createdAt.setDate(createdAt.getDate() - daysBeforeTrip);

          bookingRows.push({
            id: bookingId,
            bookingCode: code,
            status,
            legType: "single",
            tripId: tid,
            outletId,                      // ← outletId dari outlet origin stop
            originStopId: pat.origStopId,
            destinationStopId: pat.destStopId,
            originSeq: 1,
            destinationSeq: 2,
            channel: "CSO",
            snapOriginStopName:      pat.origStopName,
            snapDestinationStopName: pat.destStopName,
            snapDepartureHHMM:       departHHMM,
            totalAmount:   String(fare),
            discountAmount: "0",
            currency: "IDR",
            createdBy: "perfload-seeder",
            createdAt,
          });

          passengerRows.push({
            id: passId,
            bookingId,
            seatNo,
            fullName: name,
            phone:    `08${String(1000000000 + bkCounter).slice(1)}`,
            fareAmount: String(fare),
          });

          const payStatus = status === "paid"      ? "success"
                          : status === "cancelled" ? "failed"
                          :                          "pending";
          const paidAt    = status === "paid"
            ? new Date(createdAt.getTime() + 30 * 60_000)
            : createdAt;
          const method    = PAYMENT_METHODS[bkCounter % PAYMENT_METHODS.length];

          paymentRows.push({
            id: payId,
            bookingId,
            method,
            status:      payStatus,
            amount:      String(fare),
            providerRef: payStatus === "success" ? `PERF-${code}` : null,
            paidAt,
          });

          if (status !== "cancelled") tripBooked.add(seatNo);
        }

        if (tripBooked.size > 0) bookedMap.set(tid, tripBooked);
      }
    }
  }

  console.log(`  → Inserting ${bookingRows.length} bookings ...`);
  for (const c of chunkArr(bookingRows,   CHUNK)) await (db.insert(bookings)   as any).values(c);
  for (const c of chunkArr(passengerRows, CHUNK)) await (db.insert(passengers) as any).values(c);
  for (const c of chunkArr(paymentRows,   CHUNK)) await (db.insert(payments)   as any).values(c);
  console.log(`  ✓ ${bookingRows.length} bookings, ${passengerRows.length} passengers, ${paymentRows.length} payments`);

  // ─── Update seat_inventory.booked = true ──────────────────────────────────
  console.log("\n[8] Menandai seat_inventory.booked = true ...");
  await db.execute(sql`
    UPDATE seat_inventory si
    SET    booked = true
    FROM   bookings b
    JOIN   passengers p ON p.booking_id = b.id
    WHERE  si.trip_id    = b.trip_id
      AND  si.seat_no    = p.seat_no
      AND  si.leg_index  = ${LEG_IDX}
      AND  b.status      IN ('paid', 'confirmed', 'checked_in')
      AND  b.booking_code LIKE ${PREFIX + '%'}
  `);
  console.log("  ✓ seat_inventory.booked diperbarui");

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 9 — SEAT HOLDS
  // legIndexes = [LEG_IDX] sesuai computeLegIndexes(1,2) = [1]
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[9] Membuat seat holds (5.000) ...");

  const holdRows: any[] = [];
  const TOTAL_HOLDS = 5000;
  const now = new Date();

  for (let h = 0; h < TOTAL_HOLDS; h++) {
    const isActive  = h % 3 !== 0;
    const dayOffset = isActive
      ? pseudoRand(h, 0, DAYS - PAST_DAYS - 1)
      : pseudoRand(h, 0, PAST_DAYS - 1);
    const d = isActive ? PAST_DAYS + dayOffset : dayOffset;
    const p = pseudoRand(h * 7,  0, NUM_PATTERNS      - 1);
    const t = pseudoRand(h * 13, 0, BASES_PER_PATTERN - 1);
    const tid = tripUUIDs[tripIdx(p, t, d)];

    const takenSeats = bookedMap.get(tid) ?? new Set<string>();
    const freeSeat   = SEAT_NOS.find((sn, si) => !takenSeats.has(SEAT_NOS[(si + h) % CAPACITY]));
    const seatNo     = freeSeat ?? SEAT_NOS[h % CAPACITY];

    const expiresAt = isActive
      ? new Date(now.getTime() + pseudoRand(h, 5, 30) * 60_000)
      : new Date(now.getTime() - pseudoRand(h, 1, 120) * 60_000);

    holdRows.push({
      holdRef:    `${PREFIX}HOLD-${String(h + 1).padStart(6, "0")}`,
      tripId:     tid,
      seatNo,
      legIndexes: [LEG_IDX],              // ← [1], sesuai computeLegIndexes(1,2)
      ttlClass:   isActive ? "CSO_LONG" : "CSO_SHORT",
      operatorId: "perfload-operator",
      bookingId:  null,
      expiresAt,
    });
  }

  for (const c of chunkArr(holdRows, CHUNK)) {
    await (db.insert(seatHolds) as any).values(c);
  }
  console.log(`  ✓ ${holdRows.length} seat holds (${holdRows.filter(r => r.expiresAt > now).length} aktif)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const invResult = await db.execute(sql`
    SELECT COUNT(*) AS c FROM seat_inventory
    WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE ${PREFIX + '%'})
  `);
  const invTotal = (invResult.rows?.[0] as any)?.c ?? "?";

  console.log(`
═══════════════════════════════════════════════════════════
  PERFLOAD SEED SELESAI (v2)
═══════════════════════════════════════════════════════════
  Stops / Outlets       : 25 / 25
  Drivers               : ${driverIds.length}
  Layouts / Vehicles    : 1 / 50
  Patterns              : ${NUM_PATTERNS}
  Trip Bases            : ${NUM_PATTERNS * BASES_PER_PATTERN}
  Trips                 : ${totalTrips.toLocaleString()} (${DAYS} hari, semua ada driver)
  Seat Inventory        : ${Number(invTotal).toLocaleString()} rows (legIndex=${LEG_IDX})
  Bookings              : ${bookingRows.length.toLocaleString()} (semua ada outletId)
  Passengers            : ${passengerRows.length.toLocaleString()}
  Payments              : ${paymentRows.length.toLocaleString()}
  Seat Holds            : ${holdRows.length.toLocaleString()} (legIndexes=[${LEG_IDX}])
═══════════════════════════════════════════════════════════
  FIXES vs v1:
  ✓ legIndex 0→${LEG_IDX}  (sesuai computeLegIndexes(1,2)=[${LEG_IDX}])
  ✓ bookings.outletId diisi  → booking list tampil di CSO
  ✓ trips.driverId+snapDriverName → SPJ/manifest bisa dicetak
  ✓ seat_holds.legIndexes=[${LEG_IDX}]
═══════════════════════════════════════════════════════════
  npx tsx server/seeds/perfload/index.ts --clean   # seed ulang
  npx tsx server/seeds/perfload/index.ts --drop    # hapus saja
═══════════════════════════════════════════════════════════
`);
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => process.exit(0));
