import { storage } from "./storage";
import { fromZonedHHMMToUtc } from "./utils/timezone";

/**
 * SEED DATA - TransityCore
 * 
 * Data konsisten untuk testing CSO booking flow
 * 
 * Rute:
 * 1. JKT -> PWK -> BDG (Jakarta - Purwakarta - Bandung)
 * 2. JKT -> BDG -> SMR (Jakarta - Bandung - Semarang)
 * 
 * Jadwal:
 * - 08:00 Pagi - Jakarta-Bandung
 * - 14:00 Siang - Jakarta-Bandung  
 * - 07:00 Pagi - Jakarta-Semarang
 */

export async function seedData() {
  console.log("Starting seed data creation...");

  // Current year for date ranges
  const currentYear = new Date().getFullYear();
  const validFrom = `${currentYear}-01-01`;
  const validTo = `${currentYear}-12-31`;

  // ============================================
  // 1. STOPS
  // ============================================
  console.log("\n[SEED] Creating stops...");

  const jakartaStop = await storage.createStop({
    code: "JKT",
    name: "Jakarta Terminal",
    city: "Jakarta",
    lat: "-6.175110",
    lng: "106.865039",
    isOutlet: true,
  });

  const purwakartaStop = await storage.createStop({
    code: "PWK",
    name: "Purwakarta",
    city: "Purwakarta",
    lat: "-6.556830",
    lng: "107.444618",
    isOutlet: true,
  });

  const bandungStop = await storage.createStop({
    code: "BDG",
    name: "Bandung Terminal",
    city: "Bandung",
    lat: "-6.914744",
    lng: "107.609810",
    isOutlet: true,
  });

  const semarangStop = await storage.createStop({
    code: "SMR",
    name: "Semarang",
    city: "Semarang",
    lat: "-6.972222",
    lng: "110.416667",
    isOutlet: true,
  });

  console.log("[SEED] Stops created: JKT, PWK, BDG, SMR");

  // ============================================
  // 2. OUTLETS (with CORRECT stop_id)
  // ============================================
  console.log("\n[SEED] Creating outlets...");

  const jakartaOutlet = await storage.createOutlet({
    stopId: jakartaStop.id,  // JKT
    name: "Jakarta Terminal Outlet",
    address: "Jl. Terminal Jakarta No. 1",
    phone: "+62-21-1234567",
  });

  const purwakartaOutlet = await storage.createOutlet({
    stopId: purwakartaStop.id,  // PWK
    name: "Purwakarta Outlet",
    address: "Jl. Veteran Purwakarta",
    phone: "+62-264-1234567",
  });

  const bandungOutlet = await storage.createOutlet({
    stopId: bandungStop.id,  // BDG
    name: "Bandung Terminal Outlet",
    address: "Jl. Terminal Bandung No. 1",
    phone: "+62-22-1234567",
  });

  const semarangOutlet = await storage.createOutlet({
    stopId: semarangStop.id,  // SMR
    name: "Semarang Outlet",
    address: "Jl. Kh Dewantara Semarang",
    phone: "+62-24-1234567",
  });

  console.log("[SEED] Outlets created with correct stop_ids");

  // ============================================
  // 3. LAYOUTS
  // ============================================
  console.log("\n[SEED] Creating layouts...");

  const layout12 = await storage.createLayout({
    name: "Standard 12-seat (3x4)",
    rows: 3,
    cols: 4,
    seatMap: [
      { seat_no: "1A", row: 1, col: 1, class: "standard" },
      { seat_no: "1B", row: 1, col: 2, class: "standard" },
      { seat_no: "1C", row: 1, col: 3, class: "standard" },
      { seat_no: "1D", row: 1, col: 4, class: "standard" },
      { seat_no: "2A", row: 2, col: 1, class: "standard" },
      { seat_no: "2B", row: 2, col: 2, class: "standard" },
      { seat_no: "2C", row: 2, col: 3, class: "standard" },
      { seat_no: "2D", row: 2, col: 4, class: "standard" },
      { seat_no: "3A", row: 3, col: 1, class: "standard" },
      { seat_no: "3B", row: 3, col: 2, class: "standard" },
      { seat_no: "3C", row: 3, col: 3, class: "standard" },
      { seat_no: "3D", row: 3, col: 4, class: "standard" },
    ],
  });

  const layout8 = await storage.createLayout({
    name: "Standard 8-seat (2x4)",
    rows: 2,
    cols: 4,
    seatMap: [
      { seat_no: "1A", row: 1, col: 1, class: "standard" },
      { seat_no: "1B", row: 1, col: 2, class: "standard" },
      { seat_no: "1C", row: 1, col: 3, class: "standard" },
      { seat_no: "1D", row: 1, col: 4, class: "standard" },
      { seat_no: "2A", row: 2, col: 1, class: "standard" },
      { seat_no: "2B", row: 2, col: 2, class: "standard" },
      { seat_no: "2C", row: 2, col: 3, class: "standard" },
      { seat_no: "2D", row: 2, col: 4, class: "standard" },
    ],
  });

  console.log("[SEED] Layouts created: 12-seat, 8-seat");

  // ============================================
  // 4. VEHICLES
  // ============================================
  console.log("\n[SEED] Creating vehicles...");

  const vehicleA = await storage.createVehicle({
    code: "BUS-A",
    plate: "B 1234 ABC",
    layoutId: layout12.id,
    capacity: 12,
    notes: "Bus besar 12 kursi",
  });

  const vehicleB = await storage.createVehicle({
    code: "BUS-B",
    plate: "B 5678 DEF",
    layoutId: layout8.id,
    capacity: 8,
    notes: "Bus kecil 8 kursi",
  });

  console.log("[SEED] Vehicles created: BUS-A, BUS-B");

  // ============================================
  // 5. TRIP PATTERNS
  // ============================================
  console.log("\n[SEED] Creating trip patterns...");

  // Pattern A: Jakarta -> Purwakarta -> Bandung
  const patternA = await storage.createTripPattern({
    code: "JKT-BDG",
    name: "Jakarta - Bandung via Purwakarta",
    vehicleClass: "standard",
    defaultLayoutId: layout12.id,
    active: true,
    tags: ["intercity", "reguler"],
  });

  // Pattern B: Jakarta -> Bandung -> Semarang
  const patternB = await storage.createTripPattern({
    code: "JKT-SMR",
    name: "Jakarta - Semarang via Bandung",
    vehicleClass: "standard",
    defaultLayoutId: layout8.id,
    active: true,
    tags: ["intercity", "reguler"],
  });

  console.log("[SEED] Trip patterns created: JKT-BDG, JKT-SMR");

  // ============================================
  // 6. PATTERN STOPS
  // ============================================
  console.log("\n[SEED] Creating pattern stops...");

  // Pattern A: JKT -> PWK -> BDG
  // PWK = pickup-only (hanya bisa naik, tidak bisa turun)
  await storage.createPatternStop({
    patternId: patternA.id,
    stopId: jakartaStop.id,
    stopSequence: 1,
    dwellSeconds: 0,
    boardingAllowed: true,
    alightingAllowed: true,  // Terminal bisa naik & turun
  });

  await storage.createPatternStop({
    patternId: patternA.id,
    stopId: purwakartaStop.id,
    stopSequence: 2,
    dwellSeconds: 300, // 5 menit
    boardingAllowed: true,   // Bisa naik
    alightingAllowed: false, // TIDAK bisa turun (pickup-only)
  });

  await storage.createPatternStop({
    patternId: patternA.id,
    stopId: bandungStop.id,
    stopSequence: 3,
    dwellSeconds: 0,
    boardingAllowed: true,
    alightingAllowed: true,
  });

  // Pattern B: JKT -> BDG -> SMR
  // BDG = pickup-only
  await storage.createPatternStop({
    patternId: patternB.id,
    stopId: jakartaStop.id,
    stopSequence: 1,
    dwellSeconds: 0,
    boardingAllowed: true,
    alightingAllowed: true,
  });

  await storage.createPatternStop({
    patternId: patternB.id,
    stopId: bandungStop.id,
    stopSequence: 2,
    dwellSeconds: 600, // 10 menit
    boardingAllowed: true,   // Bisa naik
    alightingAllowed: false, // TIDAK bisa turun (pickup-only)
  });

  await storage.createPatternStop({
    patternId: patternB.id,
    stopId: semarangStop.id,
    stopSequence: 3,
    dwellSeconds: 0,
    boardingAllowed: true,
    alightingAllowed: true,
  });

  console.log("[SEED] Pattern stops created with pickup-only configurations");

  // ============================================
  // 7. PRICE RULES
  // ============================================
  console.log("\n[SEED] Creating price rules...");

  await storage.createPriceRule({
    scope: "pattern",
    patternId: patternA.id,
    tripId: null,
    legIndex: null,
    rule: {
      basePricePerLeg: 25000, // Rp 25.000 per leg
      currency: "IDR",
      multiplier: 1.0,
    },
    validFrom: null,
    validTo: null,
    priority: 1,
  });

  await storage.createPriceRule({
    scope: "pattern",
    patternId: patternB.id,
    tripId: null,
    legIndex: null,
    rule: {
      basePricePerLeg: 35000, // Rp 35.000 per leg (lebih jauh)
      currency: "IDR",
      multiplier: 1.0,
    },
    validFrom: null,
    validTo: null,
    priority: 1,
  });

  console.log("[SEED] Price rules created");

  // ============================================
  // 8. TRIP BASES (Virtual Scheduling)
  // ============================================
  console.log("\n[SEED] Creating trip bases...");

  // JADWAL 1: Jakarta-Bandung 08:00 (Pagi)
  const tripBase1 = await storage.createTripBase({
    patternId: patternA.id,
    code: "JKT-BDG-08:00",
    name: "Jakarta-Bandung 08:00 Pagi",
    active: true,
    timezone: "Asia/Jakarta",
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
    validFrom,
    validTo,
    defaultLayoutId: layout12.id,
    defaultVehicleId: vehicleA.id,
    capacity: 12,
    channelFlags: { CSO: true, WEB: true, APP: true, OTA: false },
    defaultStopTimes: [
      { stopSequence: 1, arriveAt: null, departAt: "08:00" },  // JKT: berangkat 08:00
      { stopSequence: 2, arriveAt: "09:00", departAt: "09:05" }, // PWK: transit 5 menit
      { stopSequence: 3, arriveAt: "10:00", departAt: null },  // BDG: tiba 10:00
    ],
  });

  // JADWAL 2: Jakarta-Bandung 14:00 (Siang)
  const tripBase2 = await storage.createTripBase({
    patternId: patternA.id,
    code: "JKT-BDG-14:00",
    name: "Jakarta-Bandung 14:00 Siang",
    active: true,
    timezone: "Asia/Jakarta",
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
    validFrom,
    validTo,
    defaultLayoutId: layout8.id,
    defaultVehicleId: vehicleB.id,
    capacity: 8,
    channelFlags: { CSO: true, WEB: true, APP: true, OTA: false },
    defaultStopTimes: [
      { stopSequence: 1, arriveAt: null, departAt: "14:00" },  // JKT
      { stopSequence: 2, arriveAt: "15:00", departAt: "15:05" }, // PWK
      { stopSequence: 3, arriveAt: "16:00", departAt: null },  // BDG
    ],
  });

  // JADWAL 3: Jakarta-Semarang 07:00 (Pagi)
  const tripBase3 = await storage.createTripBase({
    patternId: patternB.id,
    code: "JKT-SMR-07:00",
    name: "Jakarta-Semarang 07:00 Pagi",
    active: true,
    timezone: "Asia/Jakarta",
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
    validFrom,
    validTo,
    defaultLayoutId: layout8.id,
    defaultVehicleId: vehicleB.id,
    capacity: 8,
    channelFlags: { CSO: true, WEB: true, APP: true, OTA: false },
    defaultStopTimes: [
      { stopSequence: 1, arriveAt: null, departAt: "07:00" },  // JKT
      { stopSequence: 2, arriveAt: "09:00", departAt: "09:15" }, // BDG (transit 15 menit)
      { stopSequence: 3, arriveAt: "15:00", departAt: null },  // SMR
    ],
  });

  console.log("[SEED] Trip bases created:");
  console.log("[SEED]   - JKT-BDG 08:00 Pagi (12 seat)");
  console.log("[SEED]   - JKT-BDG 14:00 Siang (8 seat)");
  console.log("[SEED]   - JKT-SMR 07:00 Pagi (8 seat)");

  console.log("\n========================================");
  console.log("SEED DATA CREATION COMPLETED");
  console.log("========================================");
  console.log("\nSummary:");
  console.log(`  Stops: 4 (JKT, PWK, BDG, SMR)`);
  console.log(`  Outlets: 4 (matched with correct stops)`);
  console.log(`  Layouts: 2 (12-seat, 8-seat)`);
  console.log(`  Vehicles: 2 (BUS-A, BUS-B)`);
  console.log(`  Patterns: 2 (JKT-BDG, JKT-SMR)`);
  console.log(`  Trip Bases: 3 (08:00, 14:00, 07:00)`);
  console.log(`\nValid Period: ${validFrom} to ${validTo}`);
  console.log("========================================\n");
}

// Run the seeder if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData().catch(console.error);
}