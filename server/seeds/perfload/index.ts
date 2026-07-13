/**
 * TransityTerminal — Performance Load Seeder
 *
 * Generates high-volume realistic data untuk stress-testing query.
 * Semua data di-prefix "PL-" agar mudah diidentifikasi dan di-cleanup.
 *
 * Scale:
 *   •  25 stops  +  25 outlets  (5 kota × 5 masing-masing)
 *   •   3 layouts + 50 kendaraan
 *   • 100 patterns (rute) — direct 2-stop, beda kota
 *   •   2.000 trip bases  (100 rute × 20 jadwal, setiap 30 menit 05:00–14:30)
 *   •  60.000 trips  (30 hari)
 *   • 120.000 trip_stop_times  •  60.000 trip_legs
 *   • 840.000 seat_inventory   (14 kursi × 1 leg × 60K trips)
 *   • ~160.000 bookings + passengers + payments  (full 30 hari)
 *   •   5.000 seat_holds  (aktif & kadaluarsa)
 *
 * Usage:
 *   npx tsx server/seeds/perfload/index.ts          # run seeder
 *   npx tsx server/seeds/perfload/index.ts --clean  # hapus data PL- dulu, lalu seed ulang
 *   npx tsx server/seeds/perfload/index.ts --drop   # hapus data PL- saja, tidak seed
 */
import "@server/lib/loadEnv";
import { randomUUID } from "node:crypto";
import { db } from "@server/db";
import { sql } from "drizzle-orm";
import {
  stops, outlets,
} from "@shared/schema/network";
import { layouts, vehicles } from "@shared/schema/fleet";
import {
  tripPatterns, patternStops,
  tripBases, trips, tripStopTimes, tripLegs,
} from "@shared/schema/scheduling";
import { seatInventory, seatHolds } from "@shared/schema/inventory";
import { bookings, passengers, payments } from "@shared/schema/booking";
import { priceRules } from "@shared/schema/pricing";

// ─── Config ──────────────────────────────────────────────────────────────────
const NUM_PATTERNS        = 100;  // rute
const BASES_PER_PATTERN   = 20;   // trip bases per rute (setiap 30 mnt dari 05:00)
const DAYS                = 30;   // hari dimaterialisasi (15 lalu + hari ini + 14 mendatang)
const CAPACITY            = 14;   // kursi per kendaraan
const CHUNK               = 2000; // baris per batch insert
const PAST_DAYS           = 15;   // hari lalu (index 0..14)
const CHANNEL_FLAGS       = { CSO: true, WEB: false, APP: false, OTA: false };
const OPERATOR_ID         = "perfload-operator";
const PREFIX              = "PL-";

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

/** HH:MM string dari total menit sejak tengah malam */
function minsToHHMM(m: number) { return `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`; }

/** Date ISO (YYYY-MM-DD) dari offset hari relatif ke hari ini */
function dateOffset(today: Date, offsetDays: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Konversi dateStr (YYYY-MM-DD) + HH:MM (WIB / UTC+7) ke Date (UTC) */
function wibToDate(dateStr: string, hhmm: string): Date {
  return new Date(`${dateStr}T${hhmm}:00+07:00`);
}

/** Random int [min, max] deterministik dari seed integer */
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
  // Jakarta (0-4)
  ["Atrium Senen","Cempaka Putih","MT Haryono Tebet","Grogol Petamburan","Rasuna Said Kuningan"],
  // Bandung (5-9)
  ["Dipatiukur","Pasteur","Cihampelas","Buah Batu","Gedebage"],
  // Semarang (10-14)
  ["Karangayu","Majapahit","Penggaron","Banyumanik","Ungaran"],
  // Yogyakarta (15-19)
  ["Gading Mantrijeron","Jombor","Seturan","Prambanan","Klaten"],
  // Surabaya (20-24)
  ["Bungurasih","Jambangan","Waru","Darmo Satelit","Tanjung Perak"],
];

// Travel time (menit) antar kota [origCityIdx][destCityIdx]
const TRAVEL_MINS: number[][] = [
  //  JKT   BDG   SMG   YGY   SBY
  [   0,  180,  360,  420,  600 ], // JKT
  [ 180,    0,  300,  360,  540 ], // BDG
  [ 360,  300,    0,  120,  240 ], // SMG
  [ 420,  360,  120,    0,  300 ], // YGY
  [ 600,  540,  240,  300,    0 ], // SBY
];

// Tarif berdasarkan durasi perjalanan
function fareForMins(mins: number): number {
  if (mins <= 180) return 95000;
  if (mins <= 300) return 150000;
  if (mins <= 420) return 200000;
  return 280000;
}

// 14 seat Premio layout
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
const SEAT_NOS = SEAT_MAP.map(s => s.seat_no); // 14 entries

// 20 departure times setiap 30 menit mulai 05:00
const DEPARTURE_TIMES: string[] = Array.from({ length: BASES_PER_PATTERN }, (_, k) =>
  minsToHHMM(5 * 60 + k * 30) // 05:00, 05:30, ..., 14:30
);

// Nama acak untuk passenger
const FIRST_NAMES = ["Budi","Siti","Ahmad","Dewi","Rudi","Rina","Joko","Ani","Hendra","Lestari",
                     "Agus","Wati","Eko","Indah","Wahyu","Putri","Dedi","Nita","Fajar","Yuni"];
const LAST_NAMES  = ["Santoso","Rahayu","Kusuma","Wijaya","Susanto","Hartono","Utomo","Wibowo",
                     "Setiawan","Purnama","Gunawan","Siregar","Nasution","Lubis","Harahap"];
const PAYMENT_METHODS = ["cash","qr","ewallet","bank"] as const;

function fakeName(seed: number): string {
  return `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[(seed * 7) % LAST_NAMES.length]}`;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanPerfData() {
  console.log("\n[CLEANUP] Menghapus data PL- ...");

  // Ikuti urutan FK: hapus dari tabel "daun" dulu
  await db.execute(sql`
    DELETE FROM seat_holds      WHERE operator_id = ${OPERATOR_ID};
    DELETE FROM payments        WHERE booking_id IN (SELECT id FROM bookings WHERE booking_code LIKE 'PL-%');
    DELETE FROM passengers      WHERE booking_id IN (SELECT id FROM bookings WHERE booking_code LIKE 'PL-%');
    DELETE FROM bookings        WHERE booking_code LIKE 'PL-%';
    DELETE FROM seat_inventory  WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE 'PL-%');
    DELETE FROM trip_legs       WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE 'PL-%');
    DELETE FROM trip_stop_times WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE 'PL-%');
    DELETE FROM trips           WHERE snap_route_code LIKE 'PL-%';
    DELETE FROM trip_bases      WHERE code LIKE 'PL-%';
    DELETE FROM price_rules     WHERE pattern_id IN (SELECT id FROM trip_patterns WHERE code LIKE 'PL-%');
    DELETE FROM pattern_stops   WHERE pattern_id IN (SELECT id FROM trip_patterns WHERE code LIKE 'PL-%');
    DELETE FROM trip_patterns   WHERE code LIKE 'PL-%';
    DELETE FROM vehicles        WHERE code LIKE 'PL-%';
    DELETE FROM outlets         WHERE stop_id IN (SELECT id FROM stops WHERE code LIKE 'PL-%');
    DELETE FROM stops           WHERE code LIKE 'PL-%';
    DELETE FROM layouts         WHERE name LIKE 'PL-%';
  `);

  console.log("  ✓ Data PL- dihapus");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doClean = args.includes("--clean") || args.includes("--drop");
  const dropOnly = args.includes("--drop");

  if (doClean) await cleanPerfData();
  if (dropOnly) { console.log("Done."); process.exit(0); }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate date range: offset -PAST_DAYS .. +(DAYS-PAST_DAYS-1)
  const serviceDates: string[] = Array.from({ length: DAYS }, (_, i) =>
    dateOffset(today, i - PAST_DAYS)
  );
  // serviceDates[0]       = 15 hari lalu (paling lama)
  // serviceDates[PAST_DAYS] = hari ini
  // serviceDates[DAYS-1]  = 14 hari mendatang

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — STOPS + OUTLETS + LAYOUT + VEHICLES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[1] Membuat stops + outlets ...");

  const stopData: { id: string; code: string; city: string; cityIdx: number; stopInCity: number }[] = [];
  const stopRows: any[] = [];
  const outletRows: any[] = [];

  for (let c = 0; c < CITIES.length; c++) {
    const city = CITIES[c];
    for (let s = 0; s < 5; s++) {
      const globalIdx = c * 5 + s;
      const id = randomUUID();
      const code = `PL-${city.key}-${s + 1}`;
      const dlat = (s - 2) * 0.03;
      const dlng = (s - 2) * 0.02;
      stopData.push({ id, code, city: city.name, cityIdx: c, stopInCity: s });
      stopRows.push({
        id, code, name: `${PREFIX}${STOP_NAMES[c][s]}`, city: city.name,
        isOutlet: true,
        lat: String((city.lat + dlat).toFixed(6)),
        lng: String((city.lng + dlng).toFixed(6)),
      });
      outletRows.push({
        stopId: id,
        name: `${PREFIX}${STOP_NAMES[c][s]}`,
        address: `Jl. Perfload ${globalIdx + 1}, ${city.name}`,
        phone: `02${String(globalIdx).padStart(2,"0")}-PERF-${String(globalIdx + 1).padStart(4,"0")}`,
      });
    }
  }

  await bulkInsert(stops, stopRows);
  await bulkInsert(outlets, outletRows);
  console.log(`  ✓ ${stopRows.length} stops, ${outletRows.length} outlets`);

  // ─── Layout ──────────────────────────────────────────────────────────────
  console.log("\n[2] Membuat layout + vehicles ...");
  const [layout14] = await db.insert(layouts).values({
    name: "PL-Premio 14 Seat",
    rows: 5, cols: 3,
    seatMap: SEAT_MAP,
  }).returning({ id: layouts.id });

  // 50 vehicles, rotating plates
  const vehicleRows: any[] = Array.from({ length: 50 }, (_, i) => ({
    code: `PL-V-${String(i + 1).padStart(3, "0")}`,
    plate: `B ${String(1000 + i).padStart(4, "0")} PLF`,
    layoutId: layout14.id,
    capacity: CAPACITY,
    notes: `PerfLoad Vehicle #${i + 1}`,
  }));
  const vehicleIds: string[] = (
    await db.insert(vehicles).values(vehicleRows).returning({ id: vehicles.id })
  ).map(r => r.id);
  console.log(`  ✓ 1 layout (14 kursi), ${vehicleIds.length} vehicles`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — PATTERNS + PATTERN STOPS + PRICE RULES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[3] Membuat patterns ...");

  /**
   * 100 patterns: untuk setiap origin stop (25 total), buat 4 rute ke
   * kota berbeda. i = origIdx*4 + j
   *   origIdx  = floor(i/4)  → 0..24
   *   j        = i%4         → 0..3  (dest ke 4 kota berbeda)
   *   destCity = (origCity + j + 1) % 5
   *   destStop = cityStops[destCity][origIdx % 5]
   */
  const patternData: {
    id: string; code: string; origStopId: string; destStopId: string;
    origCityIdx: number; destCityIdx: number; travelMins: number;
  }[] = [];
  const patternRows: any[] = [];
  const patStopRows: any[] = [];
  const priceRuleRows: any[] = [];

  for (let i = 0; i < NUM_PATTERNS; i++) {
    const origIdx   = Math.floor(i / 4);         // 0..24
    const j         = i % 4;                     // 0..3
    const origCity  = Math.floor(origIdx / 5);   // 0..4
    const destCity  = (origCity + j + 1) % 5;
    const destIdx   = destCity * 5 + (origIdx % 5);

    const origStop  = stopData[origIdx];
    const destStop  = stopData[destIdx];
    const travelMins = TRAVEL_MINS[origCity][destCity];
    const fare       = fareForMins(travelMins);

    const patId = randomUUID();
    const code  = `PL-P${String(i + 1).padStart(3, "0")}`;

    patternData.push({
      id: patId, code,
      origStopId: origStop.id, destStopId: destStop.id,
      origCityIdx: origCity, destCityIdx: destCity, travelMins,
    });

    patternRows.push({
      id: patId, code,
      name: `${PREFIX}${CITIES[origCity].name} → ${CITIES[destCity].name} (${code})`,
      vehicleClass: "premio-14",
      defaultLayoutId: layout14.id,
      active: true,
      tags: ["perfload", CITIES[origCity].key.toLowerCase(), CITIES[destCity].key.toLowerCase()],
      allowIntraCityBooking: false,
    });

    // Pattern stops: seq 1 (boarding only) → seq 2 (alighting only)
    patStopRows.push(
      { patternId: patId, stopId: origStop.id, stopSequence: 1,
        boardingAllowed: true, alightingAllowed: false, dwellSeconds: 0 },
      { patternId: patId, stopId: destStop.id, stopSequence: 2,
        boardingAllowed: false, alightingAllowed: true, dwellSeconds: 0 },
    );

    // Price rule: OD matrix, satu cell origin→dest
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
  // PHASE 3 — TRIP BASES
  // 100 patterns × 20 departure times = 2.000 bases
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[4] Membuat trip bases (2.000) ...");

  const currentYear = today.getFullYear();
  const validFrom   = `${currentYear}-01-01`;
  const validTo     = `${currentYear + 1}-12-31`;

  // Pre-generate base IDs agar bisa dipetakan saat generate trips
  const baseIds: string[] = Array.from({ length: NUM_PATTERNS * BASES_PER_PATTERN }, () => randomUUID());
  const baseRows: any[] = [];

  for (let p = 0; p < NUM_PATTERNS; p++) {
    const pat = patternData[p];
    const vehId = vehicleIds[p % vehicleIds.length];
    const arrMins = pat.travelMins; // durasi perjalanan (menit)

    for (let t = 0; t < BASES_PER_PATTERN; t++) {
      const baseIdx    = p * BASES_PER_PATTERN + t;
      const departHHMM = DEPARTURE_TIMES[t];
      const [dh, dm]   = departHHMM.split(":").map(Number);
      const arrMinsTotal = dh * 60 + dm + arrMins;
      const arrHHMM    = minsToHHMM(arrMinsTotal);

      baseRows.push({
        id: baseIds[baseIdx],
        code: `PL-${String(p + 1).padStart(3, "0")}/${departHHMM}`,
        name: `${PREFIX}${CITIES[pat.origCityIdx].name}→${CITIES[pat.destCityIdx].name} ${departHHMM}`,
        patternId: pat.id,
        active: true,
        timezone: "Asia/Jakarta",
        validFrom, validTo,
        mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
        defaultLayoutId: layout14.id,
        defaultVehicleId: vehId,
        capacity: CAPACITY,
        channelFlags: CHANNEL_FLAGS,
        defaultStopTimes: [
          { stopSequence: 1, arriveAt: null,    departAt: departHHMM },
          { stopSequence: 2, arriveAt: arrHHMM, departAt: null },
        ],
      });
    }
  }

  for (const c of chunkArr(baseRows, CHUNK)) {
    await (db.insert(tripBases) as any).values(c);
  }
  console.log(`  ✓ ${baseRows.length} trip bases`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4 — TRIPS + STOP TIMES + LEGS + SEAT INVENTORY
  // 2.000 bases × 30 hari = 60.000 trips
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[5] Membuat trips, stop_times, legs, seat_inventory (ini yang paling berat) ...");

  // Pre-generate semua trip UUIDs agar bisa dipakai di phase booking
  const totalTrips = NUM_PATTERNS * BASES_PER_PATTERN * DAYS;
  const tripUUIDs: string[] = Array.from({ length: totalTrips }, () => randomUUID());

  // tripIdx(p, t, d) = p * BASES_PER_PATTERN * DAYS + t * DAYS + d
  function tripIdx(p: number, t: number, d: number) {
    return p * BASES_PER_PATTERN * DAYS + t * DAYS + d;
  }

  let insertedTrips = 0;

  // Batch per hari supaya memory tetap rendah
  for (let d = 0; d < DAYS; d++) {
    const serviceDate = serviceDates[d];
    const tripBatch:     any[] = [];
    const stopTimeBatch: any[] = [];
    const legBatch:      any[] = [];
    const invBatch:      any[] = [];

    for (let p = 0; p < NUM_PATTERNS; p++) {
      const pat    = patternData[p];
      const fare   = fareForMins(pat.travelMins);

      for (let t = 0; t < BASES_PER_PATTERN; t++) {
        const baseIdx    = p * BASES_PER_PATTERN + t;
        const tid        = tripUUIDs[tripIdx(p, t, d)];
        const departHHMM = DEPARTURE_TIMES[t];
        const [dh, dm]   = departHHMM.split(":").map(Number);
        const arrMinsTotal = dh * 60 + dm + pat.travelMins;
        const arrHHMM    = minsToHHMM(arrMinsTotal);

        const departAt = wibToDate(serviceDate, departHHMM);
        const arriveAt = wibToDate(serviceDate, arrHHMM);

        const vehIdx = (p * BASES_PER_PATTERN + t) % vehicleIds.length;
        const vehId  = vehicleIds[vehIdx];

        tripBatch.push({
          id: tid,
          baseId: baseIds[baseIdx],
          patternId: pat.id,
          serviceDate,
          status: "scheduled",
          vehicleId: vehId,
          layoutId: layout14.id,
          capacity: CAPACITY,
          originDepartHHMM: departHHMM,
          channelFlags: CHANNEL_FLAGS,
          snapRouteCode: `PL-P${String(p + 1).padStart(3, "0")}`,
          snapRouteName: `${PREFIX}${CITIES[pat.origCityIdx].name}→${CITIES[pat.destCityIdx].name}`,
          snapVehiclePlate: `B ${String(1000 + vehIdx).padStart(4, "0")} PLF`,
        });

        // Stop times
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

        // Leg (1 leg untuk 2-stop route, leg_index = 0)
        legBatch.push({
          tripId: tid, legIndex: 0,
          fromStopId: pat.origStopId, toStopId: pat.destStopId,
          departAt, arriveAt, durationMin: pat.travelMins,
        });

        // Seat inventory: 14 kursi × 1 leg
        for (const seatNo of SEAT_NOS) {
          invBatch.push({ tripId: tid, seatNo, legIndex: 0, booked: false });
        }
      }
    }

    // Bulk insert semua batch hari ini
    for (const c of chunkArr(tripBatch, CHUNK)) {
      await (db.insert(trips) as any).values(c);
    }
    for (const c of chunkArr(stopTimeBatch, CHUNK)) {
      await (db.insert(tripStopTimes) as any).values(c);
    }
    for (const c of chunkArr(legBatch, CHUNK)) {
      await (db.insert(tripLegs) as any).values(c);
    }
    for (const c of chunkArr(invBatch, CHUNK)) {
      await (db.insert(seatInventory) as any).values(c);
    }

    insertedTrips += tripBatch.length;
    process.stdout.write(`    trips: ${insertedTrips}/${totalTrips} (hari ${d + 1}/${DAYS})\r`);
  }

  console.log(`\n  ✓ ${totalTrips} trips, ${totalTrips * 2} stop_times, ${totalTrips} legs, ${totalTrips * CAPACITY} seat_inventory rows`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5 — BOOKINGS + PASSENGERS + PAYMENTS
  // Distribusi realistis selama 30 hari
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[6] Membuat bookings, passengers, payments ...");

  const bookingRows:   any[] = [];
  const passengerRows: any[] = [];
  const paymentRows:   any[] = [];

  // Seat inventory update tracker: (tripId → Set<seatNo>) yang booked=true
  const bookedMap = new Map<string, Set<string>>();

  let bkCounter = 0;

  for (let d = 0; d < DAYS; d++) {
    const serviceDate = serviceDates[d];
    const isPast      = d < PAST_DAYS;
    const isToday     = d === PAST_DAYS;

    for (let p = 0; p < NUM_PATTERNS; p++) {
      const pat  = patternData[p];
      const fare = fareForMins(pat.travelMins);

      for (let t = 0; t < BASES_PER_PATTERN; t++) {
        const tid  = tripUUIDs[tripIdx(p, t, d)];
        const departHHMM = DEPARTURE_TIMES[t];

        // Jumlah booking per trip:
        // - Lalu: 3–10 kursi terisi (pseudo-random), avg ~6–7
        // - Hari ini: 2–8
        // - Mendatang: 0–4
        const seed  = p * 1000 + t * 30 + d;
        const nBook = isPast
          ? pseudoRand(seed, 3, 10)
          : isToday
            ? pseudoRand(seed, 2, 8)
            : pseudoRand(seed, 0, 4);

        if (nBook === 0) continue;

        const tripBooked = new Set<string>();

        for (let k = 0; k < nBook && k < CAPACITY; k++) {
          const seatNo    = SEAT_NOS[k];
          const bookingId = randomUUID();
          const passId    = randomUUID();
          const payId     = randomUUID();
          const code      = `PL-${String(++bkCounter).padStart(7, "0")}`;
          const nameSeed  = bkCounter + k;
          const name      = fakeName(nameSeed);

          // Status: paid untuk trip lalu, campuran untuk mendatang
          const status = isPast
            ? (k < 2 && pseudoRand(seed + k, 0, 9) < 2 ? "cancelled" : "paid")
            : (pseudoRand(seed + k, 0, 9) < 4 ? "pending" : "confirmed");

          // Tanggal buat booking (1-7 hari sebelum perjalanan)
          const daysBeforeTrip = pseudoRand(seed + k, 1, 7);
          const createdAt = wibToDate(serviceDate, "08:00");
          createdAt.setDate(createdAt.getDate() - daysBeforeTrip);

          bookingRows.push({
            id: bookingId,
            bookingCode: code,
            status,
            legType: "single",
            tripId: tid,
            originStopId: pat.origStopId,
            destinationStopId: pat.destStopId,
            originSeq: 1,
            destinationSeq: 2,
            channel: "CSO",
            snapOriginStopName: `${PREFIX}${STOP_NAMES[pat.origCityIdx][stopData.find(s => s.id === pat.origStopId)!.stopInCity]}`,
            snapDestinationStopName: `${PREFIX}${STOP_NAMES[pat.destCityIdx][stopData.find(s => s.id === pat.destStopId)!.stopInCity]}`,
            snapDepartureHHMM: departHHMM,
            totalAmount: String(fare),
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
            phone: `08${String(1000000000 + bkCounter).slice(1)}`,
            fareAmount: String(fare),
          });

          const payStatus  = status === "paid" ? "success" : status === "cancelled" ? "failed" : "pending";
          const paidAt     = status === "paid" ? new Date(createdAt.getTime() + 30 * 60_000) : createdAt;
          const method     = PAYMENT_METHODS[bkCounter % PAYMENT_METHODS.length];

          paymentRows.push({
            id: payId,
            bookingId,
            method,
            status: payStatus,
            amount: String(fare),
            providerRef: payStatus === "success" ? `PERF-${code}` : null,
            paidAt,
          });

          if (status !== "cancelled") tripBooked.add(seatNo);
        }

        if (tripBooked.size > 0) bookedMap.set(tid, tripBooked);
      }
    }
  }

  // Bulk insert booking data dalam satu pass
  console.log(`  → Inserting ${bookingRows.length} bookings ...`);
  for (const c of chunkArr(bookingRows, CHUNK)) {
    await (db.insert(bookings) as any).values(c);
  }
  for (const c of chunkArr(passengerRows, CHUNK)) {
    await (db.insert(passengers) as any).values(c);
  }
  for (const c of chunkArr(paymentRows, CHUNK)) {
    await (db.insert(payments) as any).values(c);
  }
  console.log(`  ✓ ${bookingRows.length} bookings, ${passengerRows.length} passengers, ${paymentRows.length} payments`);

  // ─── Update seat_inventory.booked = true ──────────────────────────────────
  console.log("\n[7] Menandai seat_inventory.booked = true ...");
  // Lakukan satu UPDATE via SQL (lebih efisien daripada per-row)
  await db.execute(sql`
    UPDATE seat_inventory si
    SET    booked = true
    FROM   bookings b
    JOIN   passengers p ON p.booking_id = b.id
    WHERE  si.trip_id    = b.trip_id
      AND  si.seat_no    = p.seat_no
      AND  si.leg_index  = 0
      AND  b.status      IN ('paid', 'confirmed', 'checked_in')
      AND  b.booking_code LIKE 'PL-%'
  `);
  console.log("  ✓ seat_inventory.booked diperbarui");

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6 — SEAT HOLDS  (5.000 — mix aktif & kadaluarsa)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[8] Membuat seat holds (5.000) ...");

  const holdRows: any[] = [];
  const TOTAL_HOLDS = 5000;
  const now = new Date();

  for (let h = 0; h < TOTAL_HOLDS; h++) {
    // Pilih trip dari hari ini atau mendatang untuk holds aktif, hari lalu untuk expired
    const isActive   = h % 3 !== 0; // 2/3 aktif, 1/3 kadaluarsa
    const dayOffset  = isActive
      ? pseudoRand(h, 0, DAYS - PAST_DAYS - 1) // 0..14 hari mendatang
      : pseudoRand(h, 0, PAST_DAYS - 1);        // hari lalu (expired)
    const d = isActive ? PAST_DAYS + dayOffset : dayOffset;
    const p = pseudoRand(h * 7, 0, NUM_PATTERNS - 1);
    const t = pseudoRand(h * 13, 0, BASES_PER_PATTERN - 1);
    const tid = tripUUIDs[tripIdx(p, t, d)];

    // Pilih kursi yang tidak booked
    const takenSeats  = bookedMap.get(tid) ?? new Set<string>();
    const freeSeat    = SEAT_NOS.find((_, si) => !takenSeats.has(SEAT_NOS[(si + h) % CAPACITY]));
    const seatNo      = freeSeat ?? SEAT_NOS[h % CAPACITY];

    const expiresAt = isActive
      ? new Date(now.getTime() + pseudoRand(h, 5, 30) * 60_000) // expire 5-30 mnt dari sekarang
      : new Date(now.getTime() - pseudoRand(h, 1, 120) * 60_000); // sudah expired 1-120 mnt lalu

    holdRows.push({
      holdRef:    `PL-HOLD-${String(h + 1).padStart(6, "0")}`,
      tripId:     tid,
      seatNo,
      legIndexes: [0],
      ttlClass:   isActive ? "CSO_LONG" : "CSO_SHORT",
      operatorId: OPERATOR_ID,
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
  const invCount = await db.execute(sql`SELECT COUNT(*) AS c FROM seat_inventory WHERE trip_id IN (SELECT id FROM trips WHERE snap_route_code LIKE 'PL-%')`);
  const invTotal = (invCount.rows[0] as any).c;

  console.log(`
═══════════════════════════════════════════════════════════
  PERFLOAD SEED SELESAI
═══════════════════════════════════════════════════════════
  Stops / Outlets       : 25 / 25
  Layouts / Vehicles    : 1 / 50
  Patterns              : ${NUM_PATTERNS}
  Trip Bases            : ${NUM_PATTERNS * BASES_PER_PATTERN} (${BASES_PER_PATTERN} per rute, tiap 30 mnt 05:00–14:30)
  Trips                 : ${totalTrips.toLocaleString()} (${DAYS} hari)
  Seat Inventory        : ${Number(invTotal).toLocaleString()} rows
  Bookings              : ${bookingRows.length.toLocaleString()}
  Passengers            : ${passengerRows.length.toLocaleString()}
  Payments              : ${paymentRows.length.toLocaleString()}
  Seat Holds            : ${holdRows.length.toLocaleString()}
═══════════════════════════════════════════════════════════
  Jalankan --clean untuk reset + seed ulang
  Jalankan --drop  untuk hapus data PL- saja
═══════════════════════════════════════════════════════════
`);
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => process.exit(0));
