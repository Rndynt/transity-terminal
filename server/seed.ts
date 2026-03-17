import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { fromZonedHHMMToUtc } from "./utils/timezone";

/**
 * SEED DATA - TransityCore
 *
 * Rute:
 * 1. JKT -> PWK -> BDG (Jakarta - Purwakarta - Bandung)
 * 2. JKT -> BDG -> SMR (Jakarta - Bandung - Semarang)
 *
 * Jadwal:
 * - 08:00 Pagi  - Jakarta-Bandung  (12 seat)
 * - 14:00 Siang - Jakarta-Bandung  (8 seat)
 * - 07:00 Pagi  - Jakarta-Semarang (8 seat)
 *
 * Paket Pengiriman:
 * - 7 jenis paket dengan tarif global + tarif per rute
 */

async function cleanDatabase() {
  console.log("\n[CLEANUP] Clearing all existing data...");
  await db.execute(sql`
    TRUNCATE TABLE
      print_jobs,
      payments,
      passengers,
      bookings,
      cargo_shipments,
      cargo_rates,
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

export async function seedData() {
  console.log("========================================");
  console.log("  TRANSITYCORE SEED DATA");
  console.log("========================================");

  await cleanDatabase();

  const currentYear = new Date().getFullYear();
  const validFrom = `${currentYear}-01-01`;
  const validTo = `${currentYear}-12-31`;

  // ============================================================
  // 1. STOPS
  // ============================================================
  console.log("\n[1/9] Creating stops...");

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

  console.log("  ✓ JKT, PWK, BDG, SMR");

  // ============================================================
  // 2. OUTLETS
  // ============================================================
  console.log("\n[2/9] Creating outlets...");

  await storage.createOutlet({
    stopId: jakartaStop.id,
    name: "Jakarta Terminal Outlet",
    address: "Jl. Terminal Jakarta No. 1, Jakarta Pusat",
    phone: "+62-21-1234567",
  });

  await storage.createOutlet({
    stopId: purwakartaStop.id,
    name: "Purwakarta Outlet",
    address: "Jl. Veteran No. 10, Purwakarta",
    phone: "+62-264-1234567",
  });

  await storage.createOutlet({
    stopId: bandungStop.id,
    name: "Bandung Terminal Outlet",
    address: "Jl. Terminal Bandung No. 1, Bandung",
    phone: "+62-22-1234567",
  });

  await storage.createOutlet({
    stopId: semarangStop.id,
    name: "Semarang Outlet",
    address: "Jl. Kh Dewantara No. 5, Semarang",
    phone: "+62-24-1234567",
  });

  console.log("  ✓ 4 outlets (JKT, PWK, BDG, SMR)");

  // ============================================================
  // 3. LAYOUTS
  // ============================================================
  console.log("\n[3/9] Creating layouts...");

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

  console.log("  ✓ Layout 12-seat, 8-seat");

  // ============================================================
  // 4. VEHICLES
  // ============================================================
  console.log("\n[4/9] Creating vehicles...");

  const vehicleA = await storage.createVehicle({
    code: "BUS-A",
    plate: "B 1234 ABC",
    layoutId: layout12.id,
    capacity: 12,
    notes: "Bus besar 12 kursi - Rute Jakarta-Bandung",
  });

  const vehicleB = await storage.createVehicle({
    code: "BUS-B",
    plate: "B 5678 DEF",
    layoutId: layout8.id,
    capacity: 8,
    notes: "Bus kecil 8 kursi - Rute Jakarta-Semarang",
  });

  console.log("  ✓ BUS-A (12 seat), BUS-B (8 seat)");

  // ============================================================
  // 5. TRIP PATTERNS
  // ============================================================
  console.log("\n[5/9] Creating trip patterns...");

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

  // Pattern Stops - Pattern A: JKT -> PWK -> BDG
  await storage.createPatternStop({ patternId: patternA.id, stopId: jakartaStop.id,    stopSequence: 1, dwellSeconds: 0,   boardingAllowed: true,  alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternA.id, stopId: purwakartaStop.id, stopSequence: 2, dwellSeconds: 300, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternA.id, stopId: bandungStop.id,    stopSequence: 3, dwellSeconds: 0,   boardingAllowed: true,  alightingAllowed: true  });

  // Pattern Stops - Pattern B: JKT -> BDG -> SMR
  await storage.createPatternStop({ patternId: patternB.id, stopId: jakartaStop.id,  stopSequence: 1, dwellSeconds: 0,   boardingAllowed: true, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: patternB.id, stopId: bandungStop.id,  stopSequence: 2, dwellSeconds: 600, boardingAllowed: true, alightingAllowed: false });
  await storage.createPatternStop({ patternId: patternB.id, stopId: semarangStop.id, stopSequence: 3, dwellSeconds: 0,   boardingAllowed: true, alightingAllowed: true  });

  console.log("  ✓ Pattern JKT-BDG, JKT-SMR + pattern stops");

  // ============================================================
  // 6. PRICE RULES (Tiket Penumpang)
  // ============================================================
  console.log("\n[6/9] Creating price rules...");

  await storage.createPriceRule({
    scope: "pattern",
    patternId: patternA.id,
    tripId: null, legIndex: null,
    rule: { basePricePerLeg: 25000, currency: "IDR", multiplier: 1.0 },
    validFrom: null, validTo: null, priority: 1,
  });

  await storage.createPriceRule({
    scope: "pattern",
    patternId: patternB.id,
    tripId: null, legIndex: null,
    rule: { basePricePerLeg: 35000, currency: "IDR", multiplier: 1.0 },
    validFrom: null, validTo: null, priority: 1,
  });

  console.log("  ✓ Harga penumpang: JKT-BDG Rp25.000/leg, JKT-SMR Rp35.000/leg");

  // ============================================================
  // 7. TRIP BASES (Virtual Scheduling)
  // ============================================================
  console.log("\n[7/9] Creating trip bases...");

  await storage.createTripBase({
    patternId: patternA.id,
    code: "JKT-BDG-0800",
    name: "Jakarta-Bandung 08:00 Pagi",
    active: true,
    timezone: "Asia/Jakarta",
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
    validFrom, validTo,
    defaultLayoutId: layout12.id,
    defaultVehicleId: vehicleA.id,
    capacity: 12,
    channelFlags: { CSO: true, WEB: true, APP: true, OTA: false },
    defaultStopTimes: [
      { stopSequence: 1, arriveAt: null,    departAt: "08:00" },
      { stopSequence: 2, arriveAt: "09:00", departAt: "09:05" },
      { stopSequence: 3, arriveAt: "10:00", departAt: null    },
    ],
  });

  await storage.createTripBase({
    patternId: patternA.id,
    code: "JKT-BDG-1400",
    name: "Jakarta-Bandung 14:00 Siang",
    active: true,
    timezone: "Asia/Jakarta",
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
    validFrom, validTo,
    defaultLayoutId: layout8.id,
    defaultVehicleId: vehicleB.id,
    capacity: 8,
    channelFlags: { CSO: true, WEB: true, APP: true, OTA: false },
    defaultStopTimes: [
      { stopSequence: 1, arriveAt: null,    departAt: "14:00" },
      { stopSequence: 2, arriveAt: "15:00", departAt: "15:05" },
      { stopSequence: 3, arriveAt: "16:00", departAt: null    },
    ],
  });

  await storage.createTripBase({
    patternId: patternB.id,
    code: "JKT-SMR-0700",
    name: "Jakarta-Semarang 07:00 Pagi",
    active: true,
    timezone: "Asia/Jakarta",
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
    validFrom, validTo,
    defaultLayoutId: layout8.id,
    defaultVehicleId: vehicleB.id,
    capacity: 8,
    channelFlags: { CSO: true, WEB: true, APP: true, OTA: false },
    defaultStopTimes: [
      { stopSequence: 1, arriveAt: null,    departAt: "07:00" },
      { stopSequence: 2, arriveAt: "09:00", departAt: "09:15" },
      { stopSequence: 3, arriveAt: "15:00", departAt: null    },
    ],
  });

  console.log("  ✓ 3 trip bases (JKT-BDG 08:00, JKT-BDG 14:00, JKT-SMR 07:00)");

  // ============================================================
  // 8. CARGO TYPES (Jenis Paket Pengiriman)
  // ============================================================
  console.log("\n[8/9] Creating cargo types (paket pengiriman)...");

  const ctDokumen = await storage.createCargoType({
    code: "DOK",
    name: "Dokumen",
    description: "Surat, berkas, dan dokumen penting. Ringan dan tidak mudah pecah.",
    maxWeightKg: "1.00",
    isActive: true,
  });

  const ctPaketMini = await storage.createCargoType({
    code: "PKT-MINI",
    name: "Paket Mini",
    description: "Paket kecil seperti aksesoris, kosmetik, atau barang kecil lainnya.",
    maxWeightKg: "2.00",
    isActive: true,
  });

  const ctPaketKecil = await storage.createCargoType({
    code: "PKT-S",
    name: "Paket Kecil",
    description: "Paket ukuran kecil seperti pakaian, buku, atau barang ringan.",
    maxWeightKg: "5.00",
    isActive: true,
  });

  const ctPaketSedang = await storage.createCargoType({
    code: "PKT-M",
    name: "Paket Sedang",
    description: "Paket ukuran sedang seperti sepatu, tas, atau barang rumah tangga kecil.",
    maxWeightKg: "10.00",
    isActive: true,
  });

  const ctPaketBesar = await storage.createCargoType({
    code: "PKT-L",
    name: "Paket Besar",
    description: "Paket ukuran besar seperti peralatan rumah tangga atau barang bervolume besar.",
    maxWeightKg: "20.00",
    isActive: true,
  });

  const ctElektronik = await storage.createCargoType({
    code: "ELEK",
    name: "Elektronik",
    description: "Barang elektronik seperti handphone, laptop, atau perangkat elektronik lainnya. Penanganan khusus.",
    maxWeightKg: "10.00",
    isActive: true,
  });

  const ctMakanan = await storage.createCargoType({
    code: "MKNN",
    name: "Makanan & Minuman",
    description: "Produk makanan, minuman, atau oleh-oleh. Prioritas pengiriman cepat.",
    maxWeightKg: "5.00",
    isActive: true,
  });

  console.log("  ✓ 7 jenis paket: DOK, PKT-MINI, PKT-S, PKT-M, PKT-L, ELEK, MKNN");

  // ============================================================
  // 9. CARGO RATES (Tarif Paket Pengiriman)
  // ============================================================
  console.log("\n[9/9] Creating cargo rates (tarif pengiriman)...");

  // --- TARIF GLOBAL (berlaku untuk semua rute & trip) ---
  // Dokumen
  await storage.createCargoRate({ cargoTypeId: ctDokumen.id,    scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: "15000", pricePerLeg: "0",     minCharge: "10000", isActive: true });
  // Paket Mini
  await storage.createCargoRate({ cargoTypeId: ctPaketMini.id,  scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: "12000", pricePerLeg: "0",     minCharge: "15000", isActive: true });
  // Paket Kecil
  await storage.createCargoRate({ cargoTypeId: ctPaketKecil.id, scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: "10000", pricePerLeg: "0",     minCharge: "20000", isActive: true });
  // Paket Sedang
  await storage.createCargoRate({ cargoTypeId: ctPaketSedang.id,scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: "8000",  pricePerLeg: "0",     minCharge: "35000", isActive: true });
  // Paket Besar
  await storage.createCargoRate({ cargoTypeId: ctPaketBesar.id, scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: "7000",  pricePerLeg: "0",     minCharge: "50000", isActive: true });
  // Elektronik (tarif premium)
  await storage.createCargoRate({ cargoTypeId: ctElektronik.id, scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: "20000", pricePerLeg: "0",     minCharge: "30000", isActive: true });
  // Makanan
  await storage.createCargoRate({ cargoTypeId: ctMakanan.id,    scope: "global", scopeRefId: null, originStopId: null, destinationStopId: null, pricePerKg: "10000", pricePerLeg: "0",     minCharge: "20000", isActive: true });

  console.log("  ✓ Tarif global 7 jenis paket");

  // --- TARIF PER RUTE - JKT -> BDG (lebih murah karena dekat) ---
  await storage.createCargoRate({ cargoTypeId: ctDokumen.id,    scope: "pattern", scopeRefId: patternA.id, originStopId: jakartaStop.id, destinationStopId: bandungStop.id, pricePerKg: "12000", pricePerLeg: "0", minCharge: "8000",  isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctPaketKecil.id, scope: "pattern", scopeRefId: patternA.id, originStopId: jakartaStop.id, destinationStopId: bandungStop.id, pricePerKg: "8000",  pricePerLeg: "0", minCharge: "15000", isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctPaketSedang.id,scope: "pattern", scopeRefId: patternA.id, originStopId: jakartaStop.id, destinationStopId: bandungStop.id, pricePerKg: "7000",  pricePerLeg: "0", minCharge: "28000", isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctPaketBesar.id, scope: "pattern", scopeRefId: patternA.id, originStopId: jakartaStop.id, destinationStopId: bandungStop.id, pricePerKg: "6000",  pricePerLeg: "0", minCharge: "40000", isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctElektronik.id, scope: "pattern", scopeRefId: patternA.id, originStopId: jakartaStop.id, destinationStopId: bandungStop.id, pricePerKg: "18000", pricePerLeg: "0", minCharge: "25000", isActive: true });

  console.log("  ✓ Tarif rute JKT->BDG (5 jenis paket)");

  // --- TARIF PER RUTE - JKT -> SMR (lebih mahal karena jauh) ---
  await storage.createCargoRate({ cargoTypeId: ctDokumen.id,    scope: "pattern", scopeRefId: patternB.id, originStopId: jakartaStop.id, destinationStopId: semarangStop.id, pricePerKg: "18000", pricePerLeg: "0", minCharge: "15000", isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctPaketKecil.id, scope: "pattern", scopeRefId: patternB.id, originStopId: jakartaStop.id, destinationStopId: semarangStop.id, pricePerKg: "12000", pricePerLeg: "0", minCharge: "25000", isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctPaketSedang.id,scope: "pattern", scopeRefId: patternB.id, originStopId: jakartaStop.id, destinationStopId: semarangStop.id, pricePerKg: "10000", pricePerLeg: "0", minCharge: "45000", isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctPaketBesar.id, scope: "pattern", scopeRefId: patternB.id, originStopId: jakartaStop.id, destinationStopId: semarangStop.id, pricePerKg: "8500",  pricePerLeg: "0", minCharge: "65000", isActive: true });
  await storage.createCargoRate({ cargoTypeId: ctElektronik.id, scope: "pattern", scopeRefId: patternB.id, originStopId: jakartaStop.id, destinationStopId: semarangStop.id, pricePerKg: "22000", pricePerLeg: "0", minCharge: "40000", isActive: true });

  console.log("  ✓ Tarif rute JKT->SMR (5 jenis paket)");

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n========================================");
  console.log("  SEED SELESAI");
  console.log("========================================");
  console.log(`  Stops      : 4  (JKT, PWK, BDG, SMR)`);
  console.log(`  Outlets    : 4`);
  console.log(`  Layouts    : 2  (12-seat, 8-seat)`);
  console.log(`  Vehicles   : 2  (BUS-A, BUS-B)`);
  console.log(`  Patterns   : 2  (JKT-BDG, JKT-SMR)`);
  console.log(`  Trip Bases : 3  (08:00, 14:00, 07:00)`);
  console.log(`  Cargo Types: 7  (DOK, PKT-MINI, PKT-S, PKT-M, PKT-L, ELEK, MKNN)`);
  console.log(`  Cargo Rates: 17 (7 global + 5 JKT-BDG + 5 JKT-SMR)`);
  console.log(`  Periode    : ${validFrom} s/d ${validTo}`);
  console.log("========================================\n");
}

// Run seeder if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData().catch(console.error).finally(() => process.exit(0));
}
