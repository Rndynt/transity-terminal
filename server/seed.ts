import { storage } from "./storage";
import { fromZonedHHMMToUtc } from "./utils/timezone";

/**
 * SEED DATA - TransityCore
 * 
 * Penting:
 * - Format waktu HARUS menggunakan colon (:) bukan titik (.)
 *   Contoh: "08:30" BUKAN "08.30"
 * - Tanggal valid_from dan valid_to harus mencakup tanggal sekarang
 * - Untuk testing, buat minimal 2 jadwal dengan waktu berbeda
 */

export async function seedData() {
  console.log("Starting seed data creation...");

  // Get current year for date ranges
  const currentYear = new Date().getFullYear();
  const validFrom = `${currentYear}-01-01`;
  const validTo = `${currentYear}-12-31`;
  const today = new Date().toISOString().split("T")[0];

  console.log(`[SEED] Date range: ${validFrom} to ${validTo}`);
  console.log(`[SEED] Today: ${today}`);

  // ============================================
  // 1. STOPS - Lokasi pemberhentian
  // ============================================
  console.log("\n[SEED] Creating stops...");

  const jakartaStop = await storage.createStop({
    code: "JKT",
    name: "Jakarta Terminal",
    city: "Jakarta",
    isOutlet: true,
  });

  const purwakartaStop = await storage.createStop({
    code: "PWK",
    name: "Purwakarta",
    city: "Purwakarta",
    isOutlet: true, // Pickup-only stop
  });

  const bandungStop = await storage.createStop({
    code: "BDG",
    name: "Bandung Terminal",
    city: "Bandung",
    isOutlet: true,
  });

  const semarangStop = await storage.createStop({
    code: "SMR",
    name: "Semarang",
    city: "Semarang",
    isOutlet: true,
  });

  console.log("[SEED] Stops created: JKT, PWK, BDG, SMR");

  // ============================================
  // 2. OUTLETS - Lokasi penjualan tiket
  // ============================================
  console.log("\n[SEED] Creating outlets...");

  await storage.createOutlet({
    stopId: jakartaStop.id,
    name: "Jakarta Terminal Outlet",
    address: "Jl. Terminal Jakarta No. 1",
    phone: "+62-21-1234567",
  });

  await storage.createOutlet({
    stopId: bandungStop.id,
    name: "Bandung Terminal Outlet",
    address: "Jl. Terminal Bandung No. 1",
    phone: "+62-22-1234567",
  });

  await storage.createOutlet({
    stopId: purwakartaStop.id,
    name: "Purwakarta Outlet",
    address: "Jl. Veteran Purwakarta",
    phone: "+62-264-1234567",
  });

  await storage.createOutlet({
    stopId: semarangStop.id,
    name: "Semarang Outlet",
    address: "Jl. Kh Dewantara Semarang",
    phone: "+62-24-1234567",
  });

  console.log("[SEED] Outlets created: Jakarta, Bandung, Purwakarta, Semarang");

  // ============================================
  // 3. LAYOUTS - Konfigurasi kursi
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
  // 4. VEHICLES - Armada kendaraan
  // ============================================
  console.log("\n[SEED] Creating vehicles...");

  const vehicleA = await storage.createVehicle({
    code: "BUS-A",
    plate: "B 1234 ABC",
    layoutId: layout12.id,
    capacity: 12,
    notes: "Bus besar 12 kursi untuk rute utama",
  });

  const vehicleB = await storage.createVehicle({
    code: "BUS-B",
    plate: "B 5678 DEF",
    layoutId: layout8.id,
    capacity: 8,
    notes: "Bus kecil 8 kursi untuk rute sekunder",
  });

  console.log("[SEED] Vehicles created: BUS-A (12 seat), BUS-B (8 seat)");

  // ============================================
  // 5. TRIP PATTERNS - Pola rute
  // ============================================
  console.log("\n[SEED] Creating trip patterns...");

  const patternA = await storage.createTripPattern({
    code: "JKT-BDG",
    name: "Jakarta - Bandung via Purwakarta",
    vehicleClass: "standard",
    defaultLayoutId: layout12.id,
    active: true,
    tags: ["intercity", "reguler"],
  });

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
  // 6. PATTERN STOPS - Detail stop per pattern
  // ============================================
  console.log("\n[SEED] Creating pattern stops...");

  // Pattern A: Jakarta -> Purwakarta -> Bandung
  // Purwakarta adalah pickup-only (boarding=true, alighting=false)
  await storage.createPatternStop({
    patternId: patternA.id,
    stopId: jakartaStop.id,
    stopSequence: 1,
    dwellSeconds: 0,
    boardingAllowed: true,
    alightingAllowed: true,
  });

  await storage.createPatternStop({
    patternId: patternA.id,
    stopId: purwakartaStop.id,
    stopSequence: 2,
    dwellSeconds: 300, // 5 menit
    boardingAllowed: true,
    alightingAllowed: false, // PICKUP-ONLY: hanya bisa naik, tidak bisa turun
  });

  await storage.createPatternStop({
    patternId: patternA.id,
    stopId: bandungStop.id,
    stopSequence: 3,
    dwellSeconds: 0,
    boardingAllowed: true,
    alightingAllowed: true,
  });

  // Pattern B: Jakarta -> Bandung -> Semarang
  // Bandung adalah transit stop (boarding=true, alighting=false)
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
    boardingAllowed: true,
    alightingAllowed: false, // PICKUP-ONLY
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
  // 7. PRICE RULES - Aturan harga
  // ============================================
  console.log("\n[SEED] Creating price rules...");

  await storage.createPriceRule({
    scope: "pattern",
    patternId: patternA.id,
    tripId: null,
    legIndex: null,
    rule: {
      basePricePerLeg: 25000,
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
      basePricePerLeg: 35000,
      currency: "IDR",
      multiplier: 1.0,
    },
    validFrom: null,
    validTo: null,
    priority: 1,
  });

  console.log("[SEED] Price rules created: JKT-BDG Rp25.000/leg, JKT-SMR Rp35.000/leg");

  // ============================================
  // 8. TRIP BASES - Template jadwal virtual
  // ============================================
  console.log("\n[SEED] Creating trip bases...");

  // JADWAL 1: Jakarta-Bandung 08:00 (Pagi)
  // Pattern: JKT -> PWK -> BDG
  // Waktu: 08:00 -> 09:00 -> 10:00
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
  // Pattern: JKT -> PWK -> BDG
  // Waktu: 14:00 -> 15:00 -> 16:00
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
      { stopSequence: 1, arriveAt: null, departAt: "14:00" },  // JKT: berangkat 14:00
      { stopSequence: 2, arriveAt: "15:00", departAt: "15:05" }, // PWK: transit 5 menit
      { stopSequence: 3, arriveAt: "16:00", departAt: null },  // BDG: tiba 16:00
    ],
  });

  // JADWAL 3: Jakarta-Semarang 07:00 (Pagi)
  // Pattern: JKT -> BDG -> SMR
  // Waktu: 07:00 -> 09:00 -> 15:00
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
      { stopSequence: 1, arriveAt: null, departAt: "07:00" },  // JKT: berangkat 07:00
      { stopSequence: 2, arriveAt: "09:00", departAt: "09:15" }, // BDG: transit 15 menit
      { stopSequence: 3, arriveAt: "15:00", departAt: null },  // SMR: tiba 15:00
    ],
  });

  console.log("[SEED] Trip bases created:");
  console.log("[SEED]   - JKT-BDG 08:00 Pagi (12 seat)");
  console.log("[SEED]   - JKT-BDG 14:00 Siang (8 seat)");
  console.log("[SEED]   - JKT-SMR 07:00 Pagi (8 seat)");

  // ============================================
  // 9. TRIP INSTANCE (untuk hari ini)
  // ============================================
  console.log("\n[SEED] Creating trip instance for today...");

  const trip = await storage.createTrip({
    patternId: patternA.id,
    serviceDate: today,
    vehicleId: vehicleA.id,
    layoutId: layout12.id,
    capacity: 12,
    status: "scheduled",
    channelFlags: { CSO: true, WEB: false, APP: false, OTA: false },
  });

  console.log(`[SEED] Trip created for ${today}`);

  // Create trip stop times using proper timezone conversion
  // Format waktu: "HH:MM" dengan COLON
  const jakartaDepartAt = fromZonedHHMMToUtc(today, "08:00", "Asia/Jakarta");
  const purwakartaArriveAt = fromZonedHHMMToUtc(today, "09:00", "Asia/Jakarta");
  const purwakartaDepartAt = fromZonedHHMMToUtc(today, "09:05", "Asia/Jakarta");
  const bandungArriveAt = fromZonedHHMMToUtc(today, "10:00", "Asia/Jakarta");

  await storage.createTripStopTime({
    tripId: trip.id,
    stopId: jakartaStop.id,
    stopSequence: 1,
    arriveAt: null,
    departAt: jakartaDepartAt,
    dwellSeconds: 0,
  });

  await storage.createTripStopTime({
    tripId: trip.id,
    stopId: purwakartaStop.id,
    stopSequence: 2,
    arriveAt: purwakartaArriveAt,
    departAt: purwakartaDepartAt,
    dwellSeconds: 300, // 5 menit
  });

  await storage.createTripStopTime({
    tripId: trip.id,
    stopId: bandungStop.id,
    stopSequence: 3,
    arriveAt: bandungArriveAt,
    departAt: null,
    dwellSeconds: 0,
  });

  console.log("[SEED] Trip stop times created: 08:00 -> 09:00-09:05 -> 10:00");

  // Derive legs
  const { TripLegsService } = await import("./modules/tripLegs/tripLegs.service");
  const tripLegsService = new TripLegsService(storage);
  await tripLegsService.deriveLegsFromTrip(trip);

  console.log("[SEED] Trip legs derived");

  // Precompute seat inventory
  const { SeatInventoryService } = await import("./modules/seatInventory/seatInventory.service");
  const seatInventoryService = new SeatInventoryService(storage);
  await seatInventoryService.precomputeInventory(trip);

  console.log("[SEED] Seat inventory precomputed");

  console.log("\n=======================================");
  console.log("SEED DATA CREATION COMPLETED");
  console.log("=======================================");
  console.log("\nSummary:");
  console.log(`  Stops: 4 (JKT, PWK, BDG, SMR)`);
  console.log(`  Outlets: 4 (Jakarta, Bandung, Purwakarta, Semarang)`);
  console.log(`  Layouts: 2 (12-seat, 8-seat)`);
  console.log(`  Vehicles: 2 (BUS-A, BUS-B)`);
  console.log(`  Patterns: 2 (JKT-BDG, JKT-SMR)`);
  console.log(`  Trip Bases: 3 (08:00, 14:00, 07:00)`);
  console.log(`  Real Trip: 1 (today ${today})`);
  console.log(`\nValid Period: ${validFrom} to ${validTo}`);
  console.log("=======================================\n");
}

// Run the seeder if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData().catch(console.error);
}
