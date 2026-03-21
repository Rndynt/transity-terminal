import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { fromZonedHHMMToUtc } from "./utils/timezone";
import { TripBasesService } from "./modules/tripBases/tripBases.service";

/**
 * SEED DATA - TransityTerminal
 *
 * Rute:
 * 1. JKT -> CRB -> SMR -> YGY -> SLO -> SBY  (Jakarta - Surabaya)
 * 2. SBY -> SLO -> YGY -> SMR -> CRB -> JKT  (Surabaya - Jakarta)
 * 3. JKT -> BDG -> CRB -> SMR -> YGY          (Jakarta - Yogyakarta Eksekutif)
 * 4. YGY -> SMR -> CRB -> BDG -> JKT          (Yogyakarta - Jakarta Eksekutif)
 * 5. JKT -> BDG (Jakarta - Bandung Express)
 * 6. BDG -> JKT (Bandung - Jakarta Express)
 *
 * Jadwal: 2-3 jadwal per rute per hari, APP channel enabled
 * Periode: 30 hari ke depan
 */

async function cleanDatabase() {
  console.log("\n[CLEANUP] Clearing all existing data...");
  await db.execute(sql`
    TRUNCATE TABLE
      reviews,
      print_jobs,
      payments,
      passengers,
      bookings,
      cargo_shipments,
      cargo_rates,
      seat_holds,
      seat_inventory,
      trip_stop_times,
      trip_legs,
      trips,
      cargo_types,
      trip_bases,
      price_rules,
      pattern_stops,
      trip_patterns,
      outlets,
      vehicles,
      stops,
      layouts
    RESTART IDENTITY CASCADE
  `);
  console.log("[CLEANUP] Done.");
}

/** Generate service dates for the next N days */
function nextNDays(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function seedData() {
  console.log("========================================");
  console.log("  TRANSITYTERMINAL SEED DATA");
  console.log("========================================");

  await cleanDatabase();

  const currentYear = new Date().getFullYear();
  const validFrom = `${currentYear}-01-01`;
  const validTo = `${currentYear + 1}-12-31`;

  // ============================================================
  // 1. STOPS
  // ============================================================
  console.log("\n[1/10] Creating stops...");

  const jakartaStop = await storage.createStop({
    code: "JKT",
    name: "Terminal Pulogadung",
    city: "Jakarta",
    lat: "-6.187",
    lng: "106.900",
    isOutlet: true,
  });

  const bandungStop = await storage.createStop({
    code: "BDG",
    name: "Terminal Leuwipanjang",
    city: "Bandung",
    lat: "-6.958",
    lng: "107.572",
    isOutlet: true,
  });

  const cirebonStop = await storage.createStop({
    code: "CRB",
    name: "Terminal Harjamukti",
    city: "Cirebon",
    lat: "-6.757",
    lng: "108.556",
    isOutlet: true,
  });

  const semarangStop = await storage.createStop({
    code: "SMR",
    name: "Terminal Terboyo",
    city: "Semarang",
    lat: "-6.987",
    lng: "110.430",
    isOutlet: true,
  });

  const yogyakartaStop = await storage.createStop({
    code: "YGY",
    name: "Terminal Giwangan",
    city: "Yogyakarta",
    lat: "-7.832",
    lng: "110.384",
    isOutlet: true,
  });

  const soloStop = await storage.createStop({
    code: "SLO",
    name: "Terminal Tirtonadi",
    city: "Solo",
    lat: "-7.550",
    lng: "110.827",
    isOutlet: true,
  });

  const surabayaStop = await storage.createStop({
    code: "SBY",
    name: "Terminal Bungurasih",
    city: "Surabaya",
    lat: "-7.369",
    lng: "112.721",
    isOutlet: true,
  });

  console.log("  ✓ JKT, BDG, CRB, SMR, YGY, SLO, SBY");

  // ============================================================
  // 2. OUTLETS
  // ============================================================
  console.log("\n[2/10] Creating outlets...");

  await storage.createOutlet({ stopId: jakartaStop.id,   name: "Jakarta - Terminal Pulogadung",  address: "Jl. Bekasi Timur Raya, Jakarta Timur",     phone: "+62-21-4891234" });
  await storage.createOutlet({ stopId: bandungStop.id,   name: "Bandung - Terminal Leuwipanjang", address: "Jl. Leuwipanjang No. 1, Bandung",          phone: "+62-22-5234567" });
  await storage.createOutlet({ stopId: cirebonStop.id,   name: "Cirebon - Terminal Harjamukti",  address: "Jl. Brigjen Darsono, Cirebon",             phone: "+62-231-1234567" });
  await storage.createOutlet({ stopId: semarangStop.id,  name: "Semarang - Terminal Terboyo",    address: "Jl. Kaligawe Raya, Semarang",              phone: "+62-24-6581234" });
  await storage.createOutlet({ stopId: yogyakartaStop.id,name: "Yogyakarta - Terminal Giwangan", address: "Jl. Imogiri Timur, Yogyakarta",            phone: "+62-274-1234567" });
  await storage.createOutlet({ stopId: soloStop.id,      name: "Solo - Terminal Tirtonadi",      address: "Jl. Ahmad Yani No. 1, Solo",               phone: "+62-271-1234567" });
  await storage.createOutlet({ stopId: surabayaStop.id,  name: "Surabaya - Terminal Bungurasih", address: "Jl. Letjen Sutoyo, Surabaya",              phone: "+62-31-8491234" });

  console.log("  ✓ 7 outlets");

  // ============================================================
  // 3. LAYOUTS
  // ============================================================
  console.log("\n[3/10] Creating layouts...");

  // Ekonomi 2x2: 10 baris = 40 kursi
  const seatCols = ['A', 'B', 'C', 'D'];
  const ekonomiSeatMap = [];
  for (let row = 1; row <= 10; row++) {
    for (let col = 0; col < 4; col++) {
      ekonomiSeatMap.push({ seat_no: `${row}${seatCols[col]}`, row, col: col + 1, class: "ekonomi" });
    }
  }

  // Eksekutif 1+2: 8 baris = 24 kursi
  const eksekutifSeatMap = [];
  for (let row = 1; row <= 8; row++) {
    eksekutifSeatMap.push({ seat_no: `${row}A`, row, col: 1, class: "eksekutif" });
    eksekutifSeatMap.push({ seat_no: `${row}B`, row, col: 3, class: "eksekutif" });
    eksekutifSeatMap.push({ seat_no: `${row}C`, row, col: 4, class: "eksekutif" });
  }

  const layoutEkonomi = await storage.createLayout({
    name: "Bus Ekonomi 2×2 (40 kursi)",
    rows: 10,
    cols: 4,
    seatMap: ekonomiSeatMap,
  });

  const layoutEksekutif = await storage.createLayout({
    name: "Bus Eksekutif 1+2 (24 kursi)",
    rows: 8,
    cols: 4,
    seatMap: eksekutifSeatMap,
  });

  console.log("  ✓ Layout Ekonomi 40 kursi, Eksekutif 24 kursi");

  // ============================================================
  // 4. VEHICLES
  // ============================================================
  console.log("\n[4/10] Creating vehicles...");

  const busEk01 = await storage.createVehicle({ code: "BUS-EK-01", plate: "B 1001 AA", layoutId: layoutEkonomi.id,   capacity: 40, notes: "Bus Ekonomi AC" });
  const busEk02 = await storage.createVehicle({ code: "BUS-EK-02", plate: "B 1002 BB", layoutId: layoutEkonomi.id,   capacity: 40, notes: "Bus Ekonomi AC" });
  const busEk03 = await storage.createVehicle({ code: "BUS-EK-03", plate: "D 2001 CC", layoutId: layoutEkonomi.id,   capacity: 40, notes: "Bus Ekonomi AC" });
  const busEk04 = await storage.createVehicle({ code: "BUS-EK-04", plate: "D 2002 DD", layoutId: layoutEkonomi.id,   capacity: 40, notes: "Bus Ekonomi AC" });
  const busEx01 = await storage.createVehicle({ code: "BUS-EX-01", plate: "B 3001 EE", layoutId: layoutEksekutif.id, capacity: 24, notes: "Bus Eksekutif AC Premium" });
  const busEx02 = await storage.createVehicle({ code: "BUS-EX-02", plate: "B 3002 FF", layoutId: layoutEksekutif.id, capacity: 24, notes: "Bus Eksekutif AC Premium" });

  console.log("  ✓ 4 bus Ekonomi (40 kursi) + 2 bus Eksekutif (24 kursi)");

  // ============================================================
  // 5. TRIP PATTERNS
  // ============================================================
  console.log("\n[5/10] Creating trip patterns...");

  const channelAll = { CSO: true, WEB: true, APP: true, OTA: false };

  const patternJktSby = await storage.createTripPattern({ code: "JKT-SBY", name: "Jakarta → Surabaya", note: "Via Cirebon, Semarang, Yogyakarta, Solo",  vehicleClass: "ekonomi",   defaultLayoutId: layoutEkonomi.id,   active: true, tags: ["intercity", "ekonomi"] });
  const patternSbyJkt = await storage.createTripPattern({ code: "SBY-JKT", name: "Surabaya → Jakarta", note: "Via Solo, Yogyakarta, Semarang, Cirebon",  vehicleClass: "ekonomi",   defaultLayoutId: layoutEkonomi.id,   active: true, tags: ["intercity", "ekonomi"] });
  const patternJktYgy = await storage.createTripPattern({ code: "JKT-YGY", name: "Jakarta → Yogyakarta", note: "Via Bandung, Cirebon, Semarang · Eksekutif", vehicleClass: "eksekutif", defaultLayoutId: layoutEksekutif.id, active: true, tags: ["intercity", "eksekutif"] });
  const patternYgyJkt = await storage.createTripPattern({ code: "YGY-JKT", name: "Yogyakarta → Jakarta", note: "Via Semarang, Cirebon, Bandung · Eksekutif", vehicleClass: "eksekutif", defaultLayoutId: layoutEksekutif.id, active: true, tags: ["intercity", "eksekutif"] });
  const patternJktBdg = await storage.createTripPattern({ code: "JKT-BDG", name: "Jakarta → Bandung",   note: "Ekspres",                                    vehicleClass: "ekonomi",   defaultLayoutId: layoutEkonomi.id,   active: true, tags: ["express", "ekonomi"] });
  const patternBdgJkt = await storage.createTripPattern({ code: "BDG-JKT", name: "Bandung → Jakarta",   note: "Ekspres",                                    vehicleClass: "ekonomi",   defaultLayoutId: layoutEkonomi.id,   active: true, tags: ["express", "ekonomi"] });

  // Pattern Stops: JKT → SBY (seq 1-6)
  await storage.createPatternStop({ patternId: patternJktSby.id, stopId: jakartaStop.id,    stopSequence: 1, dwellSeconds: 0,    boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternJktSby.id, stopId: cirebonStop.id,    stopSequence: 2, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternJktSby.id, stopId: semarangStop.id,   stopSequence: 3, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternJktSby.id, stopId: yogyakartaStop.id, stopSequence: 4, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternJktSby.id, stopId: soloStop.id,       stopSequence: 5, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternJktSby.id, stopId: surabayaStop.id,   stopSequence: 6, dwellSeconds: 0,    boardingAllowed: false, alightingAllowed: true  });

  // Pattern Stops: SBY → JKT (seq 1-6)
  await storage.createPatternStop({ patternId: patternSbyJkt.id, stopId: surabayaStop.id,   stopSequence: 1, dwellSeconds: 0,    boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternSbyJkt.id, stopId: soloStop.id,       stopSequence: 2, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternSbyJkt.id, stopId: yogyakartaStop.id, stopSequence: 3, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternSbyJkt.id, stopId: semarangStop.id,   stopSequence: 4, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternSbyJkt.id, stopId: cirebonStop.id,    stopSequence: 5, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternSbyJkt.id, stopId: jakartaStop.id,    stopSequence: 6, dwellSeconds: 0,    boardingAllowed: false, alightingAllowed: true  });

  // Pattern Stops: JKT → YGY (seq 1-5)
  await storage.createPatternStop({ patternId: patternJktYgy.id, stopId: jakartaStop.id,    stopSequence: 1, dwellSeconds: 0,    boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternJktYgy.id, stopId: bandungStop.id,    stopSequence: 2, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternJktYgy.id, stopId: cirebonStop.id,    stopSequence: 3, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternJktYgy.id, stopId: semarangStop.id,   stopSequence: 4, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternJktYgy.id, stopId: yogyakartaStop.id, stopSequence: 5, dwellSeconds: 0,    boardingAllowed: false, alightingAllowed: true  });

  // Pattern Stops: YGY → JKT (seq 1-5)
  await storage.createPatternStop({ patternId: patternYgyJkt.id, stopId: yogyakartaStop.id, stopSequence: 1, dwellSeconds: 0,    boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternYgyJkt.id, stopId: semarangStop.id,   stopSequence: 2, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternYgyJkt.id, stopId: cirebonStop.id,    stopSequence: 3, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternYgyJkt.id, stopId: bandungStop.id,    stopSequence: 4, dwellSeconds: 1800, boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternYgyJkt.id, stopId: jakartaStop.id,    stopSequence: 5, dwellSeconds: 0,    boardingAllowed: false, alightingAllowed: true  });

  // Pattern Stops: JKT → BDG (seq 1-2)
  await storage.createPatternStop({ patternId: patternJktBdg.id, stopId: jakartaStop.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternJktBdg.id, stopId: bandungStop.id, stopSequence: 2, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // Pattern Stops: BDG → JKT (seq 1-2)
  await storage.createPatternStop({ patternId: patternBdgJkt.id, stopId: bandungStop.id, stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternBdgJkt.id, stopId: jakartaStop.id, stopSequence: 2, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  console.log("  ✓ 6 patterns + semua pattern stops");

  // ============================================================
  // 6. PRICE RULES
  // ============================================================
  console.log("\n[6/10] Creating price rules...");

  await storage.createPriceRule({ scope: "pattern", patternId: patternJktSby.id, tripId: null, legIndex: null, rule: { basePricePerLeg: 85000,  currency: "IDR", multiplier: 1.0 }, validFrom: null, validTo: null, priority: 1 });
  await storage.createPriceRule({ scope: "pattern", patternId: patternSbyJkt.id, tripId: null, legIndex: null, rule: { basePricePerLeg: 85000,  currency: "IDR", multiplier: 1.0 }, validFrom: null, validTo: null, priority: 1 });
  await storage.createPriceRule({ scope: "pattern", patternId: patternJktYgy.id, tripId: null, legIndex: null, rule: { basePricePerLeg: 150000, currency: "IDR", multiplier: 1.0 }, validFrom: null, validTo: null, priority: 1 });
  await storage.createPriceRule({ scope: "pattern", patternId: patternYgyJkt.id, tripId: null, legIndex: null, rule: { basePricePerLeg: 150000, currency: "IDR", multiplier: 1.0 }, validFrom: null, validTo: null, priority: 1 });
  await storage.createPriceRule({ scope: "pattern", patternId: patternJktBdg.id, tripId: null, legIndex: null, rule: { basePricePerLeg: 65000,  currency: "IDR", multiplier: 1.0 }, validFrom: null, validTo: null, priority: 1 });
  await storage.createPriceRule({ scope: "pattern", patternId: patternBdgJkt.id, tripId: null, legIndex: null, rule: { basePricePerLeg: 65000,  currency: "IDR", multiplier: 1.0 }, validFrom: null, validTo: null, priority: 1 });

  console.log("  ✓ Price rules: JKT-SBY Rp85rb/leg, JKT-YGY Rp150rb/leg, JKT-BDG Rp65rb/leg");

  // ============================================================
  // 7. TRIP BASES
  // ============================================================
  console.log("\n[7/10] Creating trip bases...");

  const tripBaseDefs = [
    // JKT → SBY: pagi 08:00 dan malam 20:00
    {
      patternId: patternJktSby.id, code: "JKT-SBY-0800", name: "Jakarta→Surabaya 08:00 Pagi",
      vehicleId: busEk01.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "08:00" },
        { stopSequence: 2, arriveAt: "12:00", departAt: "12:30" },
        { stopSequence: 3, arriveAt: "16:00", departAt: "16:30" },
        { stopSequence: 4, arriveAt: "19:30", departAt: "20:00" },
        { stopSequence: 5, arriveAt: "21:00", departAt: "21:30" },
        { stopSequence: 6, arriveAt: "00:30", departAt: null    },
      ],
    },
    {
      patternId: patternJktSby.id, code: "JKT-SBY-2000", name: "Jakarta→Surabaya 20:00 Malam",
      vehicleId: busEk02.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "20:00" },
        { stopSequence: 2, arriveAt: "00:00", departAt: "00:30" },
        { stopSequence: 3, arriveAt: "04:00", departAt: "04:30" },
        { stopSequence: 4, arriveAt: "07:30", departAt: "08:00" },
        { stopSequence: 5, arriveAt: "09:00", departAt: "09:30" },
        { stopSequence: 6, arriveAt: "12:30", departAt: null    },
      ],
    },
    // SBY → JKT: pagi 07:00 dan malam 19:00
    {
      patternId: patternSbyJkt.id, code: "SBY-JKT-0700", name: "Surabaya→Jakarta 07:00 Pagi",
      vehicleId: busEk03.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "07:00" },
        { stopSequence: 2, arriveAt: "10:00", departAt: "10:30" },
        { stopSequence: 3, arriveAt: "11:30", departAt: "12:00" },
        { stopSequence: 4, arriveAt: "15:30", departAt: "16:00" },
        { stopSequence: 5, arriveAt: "19:30", departAt: "20:00" },
        { stopSequence: 6, arriveAt: "00:00", departAt: null    },
      ],
    },
    {
      patternId: patternSbyJkt.id, code: "SBY-JKT-1900", name: "Surabaya→Jakarta 19:00 Malam",
      vehicleId: busEk04.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "19:00" },
        { stopSequence: 2, arriveAt: "22:00", departAt: "22:30" },
        { stopSequence: 3, arriveAt: "23:30", departAt: "00:00" },
        { stopSequence: 4, arriveAt: "03:30", departAt: "04:00" },
        { stopSequence: 5, arriveAt: "07:30", departAt: "08:00" },
        { stopSequence: 6, arriveAt: "12:00", departAt: null    },
      ],
    },
    // JKT → YGY: siang 09:00 dan malam 21:00
    {
      patternId: patternJktYgy.id, code: "JKT-YGY-0900", name: "Jakarta→Yogyakarta 09:00 Eksekutif",
      vehicleId: busEx01.id, layoutId: layoutEksekutif.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "09:00" },
        { stopSequence: 2, arriveAt: "13:00", departAt: "13:30" },
        { stopSequence: 3, arriveAt: "16:30", departAt: "17:00" },
        { stopSequence: 4, arriveAt: "21:00", departAt: "21:30" },
        { stopSequence: 5, arriveAt: "00:30", departAt: null    },
      ],
    },
    {
      patternId: patternJktYgy.id, code: "JKT-YGY-2100", name: "Jakarta→Yogyakarta 21:00 Eksekutif",
      vehicleId: busEx02.id, layoutId: layoutEksekutif.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "21:00" },
        { stopSequence: 2, arriveAt: "01:00", departAt: "01:30" },
        { stopSequence: 3, arriveAt: "04:30", departAt: "05:00" },
        { stopSequence: 4, arriveAt: "09:00", departAt: "09:30" },
        { stopSequence: 5, arriveAt: "12:30", departAt: null    },
      ],
    },
    // YGY → JKT: pagi 08:00 dan malam 20:00
    {
      patternId: patternYgyJkt.id, code: "YGY-JKT-0800", name: "Yogyakarta→Jakarta 08:00 Eksekutif",
      vehicleId: busEx01.id, layoutId: layoutEksekutif.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "08:00" },
        { stopSequence: 2, arriveAt: "11:00", departAt: "11:30" },
        { stopSequence: 3, arriveAt: "15:00", departAt: "15:30" },
        { stopSequence: 4, arriveAt: "18:30", departAt: "19:00" },
        { stopSequence: 5, arriveAt: "23:00", departAt: null    },
      ],
    },
    {
      patternId: patternYgyJkt.id, code: "YGY-JKT-2000", name: "Yogyakarta→Jakarta 20:00 Eksekutif",
      vehicleId: busEx02.id, layoutId: layoutEksekutif.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "20:00" },
        { stopSequence: 2, arriveAt: "23:00", departAt: "23:30" },
        { stopSequence: 3, arriveAt: "03:00", departAt: "03:30" },
        { stopSequence: 4, arriveAt: "06:30", departAt: "07:00" },
        { stopSequence: 5, arriveAt: "11:00", departAt: null    },
      ],
    },
    // JKT → BDG: pagi 07:00, siang 13:00, sore 16:00
    {
      patternId: patternJktBdg.id, code: "JKT-BDG-0700", name: "Jakarta→Bandung 07:00",
      vehicleId: busEk01.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "07:00" },
        { stopSequence: 2, arriveAt: "11:00", departAt: null    },
      ],
    },
    {
      patternId: patternJktBdg.id, code: "JKT-BDG-1300", name: "Jakarta→Bandung 13:00",
      vehicleId: busEk02.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "13:00" },
        { stopSequence: 2, arriveAt: "17:00", departAt: null    },
      ],
    },
    // BDG → JKT: pagi 07:00, siang 12:00, sore 17:00
    {
      patternId: patternBdgJkt.id, code: "BDG-JKT-0700", name: "Bandung→Jakarta 07:00",
      vehicleId: busEk03.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "07:00" },
        { stopSequence: 2, arriveAt: "11:00", departAt: null    },
      ],
    },
    {
      patternId: patternBdgJkt.id, code: "BDG-JKT-1700", name: "Bandung→Jakarta 17:00",
      vehicleId: busEk04.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "17:00" },
        { stopSequence: 2, arriveAt: "21:00", departAt: null    },
      ],
    },
    // SBY → JKT: malam 21:00 (tiba siang 12:00 esok hari)
    {
      patternId: patternSbyJkt.id, code: "SBY-JKT-2100", name: "Surabaya→Jakarta 21:00 Malam",
      vehicleId: busEk01.id, layoutId: layoutEkonomi.id, capacity: 40,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "21:00" },
        { stopSequence: 2, arriveAt: "23:00", departAt: "23:30" },
        { stopSequence: 3, arriveAt: "00:30", departAt: "01:00" },
        { stopSequence: 4, arriveAt: "04:30", departAt: "05:00" },
        { stopSequence: 5, arriveAt: "08:30", departAt: "09:00" },
        { stopSequence: 6, arriveAt: "12:00", departAt: null    },
      ],
    },
    // YGY → JKT: malam 21:00 Eksekutif (tiba siang 11:30 esok hari)
    {
      patternId: patternYgyJkt.id, code: "YGY-JKT-2100", name: "Yogyakarta→Jakarta 21:00 Eksekutif",
      vehicleId: busEx01.id, layoutId: layoutEksekutif.id, capacity: 24,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "21:00" },
        { stopSequence: 2, arriveAt: "23:30", departAt: "00:00" },
        { stopSequence: 3, arriveAt: "03:30", departAt: "04:00" },
        { stopSequence: 4, arriveAt: "07:30", departAt: "08:00" },
        { stopSequence: 5, arriveAt: "11:30", departAt: null    },
      ],
    },
  ];

  const createdBases = [];
  for (const def of tripBaseDefs) {
    const base = await storage.createTripBase({
      patternId: def.patternId,
      code: def.code,
      name: def.name,
      active: true,
      timezone: "Asia/Jakarta",
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
      validFrom, validTo,
      defaultLayoutId: def.layoutId,
      defaultVehicleId: def.vehicleId,
      capacity: def.capacity,
      channelFlags: channelAll,
      defaultStopTimes: def.defaultStopTimes,
    });
    createdBases.push(base);
  }

  console.log(`  ✓ ${createdBases.length} trip bases`);

  // ============================================================
  // 8. CARGO TYPES
  // ============================================================
  console.log("\n[8/10] Creating cargo types...");

  const ctDokumen    = await storage.createCargoType({ code: "DOK",      name: "Dokumen",             description: "Surat, berkas, dan dokumen penting.",          maxWeightKg: "1.00",  isActive: true });
  const ctPaketMini  = await storage.createCargoType({ code: "PKT-MINI", name: "Paket Mini",          description: "Aksesoris, kosmetik, barang kecil.",            maxWeightKg: "2.00",  isActive: true });
  const ctPaketKecil = await storage.createCargoType({ code: "PKT-S",    name: "Paket Kecil",         description: "Pakaian, buku, barang ringan.",                 maxWeightKg: "5.00",  isActive: true });
  const ctPaketSedang= await storage.createCargoType({ code: "PKT-M",    name: "Paket Sedang",        description: "Sepatu, tas, barang rumah tangga kecil.",       maxWeightKg: "10.00", isActive: true });
  const ctPaketBesar = await storage.createCargoType({ code: "PKT-L",    name: "Paket Besar",         description: "Peralatan rumah tangga, barang bervolume.",     maxWeightKg: "20.00", isActive: true });
  const ctElektronik = await storage.createCargoType({ code: "ELEK",     name: "Elektronik",          description: "Handphone, laptop, elektronik. Penanganan hati.",maxWeightKg: "10.00", isActive: true });
  const ctMakanan    = await storage.createCargoType({ code: "MKNN",     name: "Makanan & Minuman",   description: "Makanan, minuman, oleh-oleh. Prioritas cepat.", maxWeightKg: "5.00",  isActive: true });

  console.log("  ✓ 7 jenis kargo: DOK, PKT-MINI, PKT-S, PKT-M, PKT-L, ELEK, MKNN");

  // ============================================================
  // 9. CARGO RATES
  // ============================================================
  console.log("\n[9/10] Creating cargo rates...");

  const globalRates = [
    { type: ctDokumen,     pricePerKg: "15000", minCharge: "10000" },
    { type: ctPaketMini,   pricePerKg: "12000", minCharge: "15000" },
    { type: ctPaketKecil,  pricePerKg: "10000", minCharge: "20000" },
    { type: ctPaketSedang, pricePerKg: "8000",  minCharge: "35000" },
    { type: ctPaketBesar,  pricePerKg: "7000",  minCharge: "50000" },
    { type: ctElektronik,  pricePerKg: "20000", minCharge: "30000" },
    { type: ctMakanan,     pricePerKg: "10000", minCharge: "20000" },
  ];

  for (const r of globalRates) {
    await storage.createCargoRate({ cargoTypeId: r.type.id, scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: r.pricePerKg, pricePerLeg: "0", minCharge: r.minCharge, isActive: true });
  }

  console.log("  ✓ 7 tarif global kargo");

  // ============================================================
  // 10. MATERIALIZE TRIPS (next 30 days)
  // ============================================================
  console.log("\n[10/10] Materializing trips for next 30 days...");

  const tripBasesService = new TripBasesService(storage);
  const serviceDates = nextNDays(30);

  let tripCount = 0;
  let errorCount = 0;

  for (const base of createdBases) {
    for (const serviceDate of serviceDates) {
      try {
        await tripBasesService.ensureMaterializedTrip(base.id, serviceDate);
        tripCount++;
      } catch (err: unknown) {
        // 'base-not-eligible' means day-of-week filter, skip silently
        if (err instanceof Error && err.message !== 'base-not-eligible') {
          console.warn(`  ! Failed to materialize ${base.code} on ${serviceDate}:`, err.message);
          errorCount++;
        }
      }
    }
    process.stdout.write(`  ✓ ${base.code}: trips materialized\n`);
  }

  console.log(`  ✓ ${tripCount} trips dibuat (${errorCount} error)`);

  // ============================================================
  // SUMMARY
  // ============================================================
  const stopCount    = await db.execute(sql`SELECT COUNT(*) as c FROM stops`);
  const tripCountDB  = await db.execute(sql`SELECT COUNT(*) as c FROM trips`);
  const invCount     = await db.execute(sql`SELECT COUNT(*) as c FROM seat_inventory`);
  const cityList     = await db.execute(sql`SELECT DISTINCT city FROM stops ORDER BY city`);

  console.log("\n========================================");
  console.log("  SEED SELESAI");
  console.log("========================================");
  console.log(`  Stops       : ${(stopCount.rows[0] as any).c} (${(cityList.rows as any[]).map((r: any) => r.city).join(', ')})`);
  console.log(`  Trips       : ${(tripCountDB.rows[0] as any).c} (${serviceDates.length} hari × ${createdBases.length} jadwal)`);
  console.log(`  Seat Inv    : ${(invCount.rows[0] as any).c} baris`);
  console.log(`  Kargo Types : 7 | Patterns: 6 | Bases: ${createdBases.length}`);
  console.log("========================================\n");
}

// Run seeder if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData().catch(console.error).finally(() => process.exit(0));
}
