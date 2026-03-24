import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { fromZonedHHMMToUtc } from "./utils/timezone";
import { TripBasesService } from "./modules/tripBases/tripBases.service";
import { seedRbac } from "./modules/rbac/rbac.seed";

/**
 * ═══════════════════════════════════════════════════════════════════
 * SEED DATA — Transity Shuttle
 * ═══════════════════════════════════════════════════════════════════
 *
 * Data referensi: DayTrans (daytrans.co.id)
 *
 * ─── KONVENSI PENAMAAN ─────────────────────────────────────────
 *
 *   STOP CODE    : {KOTA 3 huruf}-{AREA 3 huruf}
 *                  JKT-ATR  → Jakarta Atrium Senen
 *                  BDG-DPU  → Bandung Dipatiukur
 *
 *   OUTLET NAME  : {Kota} — {Nama Area}
 *                  Jakarta — Atrium Senen
 *                  Bandung — Dipatiukur
 *
 *   PATTERN CODE : {ASAL 3 huruf}-{TUJUAN 3 huruf}-{VARIAN 2 digit}
 *                  JKT-BDG-01  → Jakarta→Bandung Rute 1
 *                  SMG-YGY-01  → Semarang→Yogyakarta Rute 1
 *
 *   PATTERN NAME : {Kota Asal} → {Kota Tujuan} · {Deskripsi Singkat}
 *                  Jakarta → Bandung · via Senen — Pasteur — Dipatiukur
 *
 *   SCHEDULE CODE: {PATTERN CODE}/{HH:MM}
 *                  JKT-BDG-01/06:00  → Rute JKT-BDG-01 berangkat 06:00
 *
 *   SCHEDULE NAME: {Pattern Name} — {HH:MM}
 *                  Jakarta → Bandung 01 — 06:00
 *
 *   VEHICLE CODE : {TIPE}-{NOMOR 2 digit}
 *                  PR8-01   → Premio 8 unit 01
 *                  PR14-03  → Premio 14 unit 03
 *                  CM14-05  → Commuter 14 unit 05
 *
 * ─── KOTA & OUTLET ─────────────────────────────────────────────
 *
 *   Jakarta  (6 outlet) : Atrium Senen, Cempaka Putih, Tebet,
 *                          Grogol, Kuningan, Jatiwaringin
 *   Bandung  (4 outlet) : Dipatiukur, Pasteur, Cihampelas, Buah Batu
 *   Semarang (2 outlet) : Karangayu, Majapahit
 *   Yogyakarta (3 outlet): Gading, Jombor, Seturan
 *
 * ─── RUTE (8 patterns) ────────────────────────────────────────
 *
 *   JKT-BDG-01  Jakarta → Bandung   (Atrium→CemPut→Tebet → Pasteur→Cihampelas→Dipatiukur)
 *   BDG-JKT-01  Bandung → Jakarta   (Dipatiukur→Cihampelas→Pasteur → Tebet→CemPut→Atrium)
 *   JKT-BDG-02  Jakarta → Bandung   (Grogol→Kuningan → Pasteur→Buah Batu)
 *   BDG-JKT-02  Bandung → Jakarta   (Buah Batu→Pasteur → Kuningan→Grogol)
 *   JKT-SMG-01  Jakarta → Semarang  (CemPut→Tebet → Karangayu→Majapahit)
 *   SMG-JKT-01  Semarang → Jakarta  (Karangayu→Majapahit → Tebet→CemPut)
 *   SMG-YGY-01  Semarang → Yogya    (Karangayu→Majapahit → Jombor→Gading→Seturan)
 *   YGY-SMG-01  Yogya → Semarang    (Seturan→Gading→Jombor → Majapahit→Karangayu)
 *
 * ─── ARMADA (3 tipe layout) ───────────────────────────────────
 *
 *   HiAce Premio 8 Seat   — 4 baris × 2 kolom (A-B), premium
 *   HiAce Premio 14 Seat  — 5 baris × 3 kolom (A-B-C), row 1 hanya A-B
 *   HiAce Commuter 14 Seat — 5 baris × 3 kolom (A-B-C), row 1 hanya A-B
 *
 * ─── JADWAL ───────────────────────────────────────────────────
 *
 *   JKT↔BDG : 06:00, 09:00, 12:00, 15:00, 18:00, 21:00
 *   JKT↔SMG : 07:00, 13:00, 20:00
 *   SMG↔YGY : 06:00, 10:00, 14:00, 18:00
 *
 * ─── HARGA (per leg, berdasarkan referensi DayTrans) ──────────
 *
 *   JKT↔BDG : Rp 90.000/leg  (range 75rb-150rb, rata-rata)
 *   JKT↔SMG : Rp 160.000/leg (range 150rb-170rb)
 *   SMG↔YGY : Rp 80.000/leg  (range 70rb-90rb)
 *
 * ═══════════════════════════════════════════════════════════════════
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
  console.log("═══════════════════════════════════════════");
  console.log("  TRANSITY SHUTTLE — SEED DATA");
  console.log("═══════════════════════════════════════════");

  await cleanDatabase();

  const currentYear = new Date().getFullYear();
  const validFrom = `${currentYear}-01-01`;
  const validTo = `${currentYear + 1}-12-31`;
  const channelAll = { CSO: true, WEB: true, APP: true, OTA: false };

  // ════════════════════════════════════════════════════════════════
  // 1. STOPS (15 outlet di 4 kota)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[1/11] Creating stops...");

  // ── JAKARTA (6 outlet) ──
  const jktAtrium = await storage.createStop({
    code: "ATR", name: "Atrium Senen",
    city: "Jakarta", lat: "-6.1745", lng: "106.8413", isOutlet: true,
  });
  const jktCemput = await storage.createStop({
    code: "CPT", name: "Cempaka Putih",
    city: "Jakarta", lat: "-6.1753", lng: "106.8688", isOutlet: true,
  });
  const jktTebet = await storage.createStop({
    code: "TBT", name: "MT Haryono Tebet",
    city: "Jakarta", lat: "-6.2297", lng: "106.8547", isOutlet: true,
  });
  const jktGrogol = await storage.createStop({
    code: "GRG", name: "Daan Mogot Grogol",
    city: "Jakarta", lat: "-6.1582", lng: "106.7863", isOutlet: true,
  });
  const jktKuningan = await storage.createStop({
    code: "KNN", name: "Rasuna Said Kuningan",
    city: "Jakarta", lat: "-6.2275", lng: "106.8318", isOutlet: true,
  });
  const jktJatiwaringin = await storage.createStop({
    code: "JTW", name: "Jatiwaringin",
    city: "Jakarta", lat: "-6.2789", lng: "106.9069", isOutlet: true,
  });

  // ── BANDUNG (4 outlet) ──
  const bdgDipatiukur = await storage.createStop({
    code: "DPU", name: "Dipatiukur",
    city: "Bandung", lat: "-6.8935", lng: "107.6162", isOutlet: true,
  });
  const bdgPasteur = await storage.createStop({
    code: "PST", name: "Pasteur",
    city: "Bandung", lat: "-6.8893", lng: "107.5896", isOutlet: true,
  });
  const bdgCihampelas = await storage.createStop({
    code: "CHP", name: "Cihampelas",
    city: "Bandung", lat: "-6.8953", lng: "107.6031", isOutlet: true,
  });
  const bdgBuahBatu = await storage.createStop({
    code: "BBT", name: "Buah Batu",
    city: "Bandung", lat: "-6.9523", lng: "107.6341", isOutlet: true,
  });

  // ── SEMARANG (2 outlet) ──
  const smgKarangayu = await storage.createStop({
    code: "KAY", name: "Karangayu",
    city: "Semarang", lat: "-6.9698", lng: "110.3852", isOutlet: true,
  });
  const smgMajapahit = await storage.createStop({
    code: "MJP", name: "Majapahit",
    city: "Semarang", lat: "-6.9933", lng: "110.4494", isOutlet: true,
  });

  // ── YOGYAKARTA (3 outlet) ──
  const ygyGading = await storage.createStop({
    code: "GDG", name: "Gading Mantrijeron",
    city: "Yogyakarta", lat: "-7.8100", lng: "110.3630", isOutlet: true,
  });
  const ygyJombor = await storage.createStop({
    code: "JBR", name: "Jombor",
    city: "Yogyakarta", lat: "-7.7400", lng: "110.3610", isOutlet: true,
  });
  const ygySeturan = await storage.createStop({
    code: "STR", name: "Seturan",
    city: "Yogyakarta", lat: "-7.7584", lng: "110.4099", isOutlet: true,
  });

  console.log("  ✓ 15 stops (Jakarta 6, Bandung 4, Semarang 2, Yogyakarta 3)");

  // ════════════════════════════════════════════════════════════════
  // 2. OUTLETS
  // ════════════════════════════════════════════════════════════════
  console.log("\n[2/11] Creating outlets...");

  const outletDefs = [
    { stopId: jktAtrium.id,        name: "Atrium Senen",             address: "Plaza Atrium Lobby Utara, Jl. Senen Raya No. 135, Jakarta Pusat 10410",                   phone: "021-3424-6767" },
    { stopId: jktCemput.id,        name: "Cempaka Putih",            address: "Jl. Letjend Suprapto No. 58 (Seberang Kampus YARSI), Cempaka Putih, Jakarta Pusat",        phone: "021-3662-6767" },
    { stopId: jktTebet.id,         name: "MT Haryono Tebet",         address: "SPBU Coco Pertamina Kav. 18, Jl. MT. Haryono, Tebet Barat, Jakarta Selatan 12810",         phone: "021-7080-6767" },
    { stopId: jktGrogol.id,        name: "Daan Mogot Grogol",        address: "SPBU Pertamina COCO Daan Mogot, Jelambar, Grogol Petamburan, Jakarta Barat",               phone: "0815-804-6767" },
    { stopId: jktKuningan.id,      name: "Rasuna Said Kuningan",     address: "SPBU COCO Pertamina, Jl. HR. Rasuna Said Kav. X2/02, Kuningan Timur, Jakarta Selatan",     phone: "0816-1799-6767" },
    { stopId: jktJatiwaringin.id,  name: "Jatiwaringin",             address: "Jl. Jatiwaringin Raya No. 7 (Seberang Pizza Hut), Jakarta Timur",                          phone: "0815-805-6767" },
    { stopId: bdgDipatiukur.id,    name: "Dipatiukur",               address: "Jl. Dipati Ukur No. 107, Lebakgede, Kec. Coblong, Kota Bandung 40132",                     phone: "022-7025-6767" },
    { stopId: bdgPasteur.id,       name: "Pasteur",                  address: "Jl. Dr. Djunjunan No. 55B, Pajajaran, Kec. Cicendo, Kota Bandung 40173",                   phone: "0816-1780-6767" },
    { stopId: bdgCihampelas.id,    name: "Cihampelas",               address: "Jl. Cihampelas No. 210 (Depan SMU Pasundan 2), Bandung Wetan, Kota Bandung",               phone: "022-3114-0000" },
    { stopId: bdgBuahBatu.id,      name: "Buah Batu",                address: "Jl. Terusan Buah Batu No. 298, Kujangsari, Kec. Bandung Kidul, Kota Bandung 40287",        phone: "0815-8511-6767" },
    { stopId: smgKarangayu.id,     name: "Karangayu",                address: "Jl. Jend. Sudirman No. 251, Karangayu, Semarang Barat",                                    phone: "024-7604-192" },
    { stopId: smgMajapahit.id,     name: "Majapahit",                address: "Jl. Majapahit No. 318, Perum Singatara, Palebon, Pedurungan, Semarang",                    phone: "0815-7535-9942" },
    { stopId: ygyGading.id,        name: "Gading Mantrijeron",       address: "Jl. MT. Haryono No. 1, Suryodiningratan, Kec. Mantrijeron, Kota Yogyakarta",               phone: "0274-385-990" },
    { stopId: ygyJombor.id,        name: "Jombor",                   address: "Terminal Jombor, Jl. Magelang, Jombor Lor, Sendangadi, Mlati, Sleman",                     phone: "0274-868-767" },
    { stopId: ygySeturan.id,       name: "Seturan",                  address: "Jl. Seturan Raya, Caturtunggal, Kec. Depok, Sleman, Yogyakarta",                           phone: "0274-487-6767" },
  ];

  for (const o of outletDefs) {
    await storage.createOutlet(o);
  }

  console.log(`  ✓ ${outletDefs.length} outlets`);

  // ════════════════════════════════════════════════════════════════
  // 3. LAYOUTS (3 tipe armada HiAce)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[3/11] Creating layouts...");

  // ── HiAce Premio 8 Seat ──
  // Layout 1+1: 4 baris × 2 kolom (kursi kapten, sangat luas)
  // Seat map:  1A 1B │ 2A 2B │ 3A 3B │ 4A 4B
  const premio8Map = [];
  for (let row = 1; row <= 4; row++) {
    premio8Map.push({ seat_no: `${row}A`, row, col: 1, class: "premio" });
    premio8Map.push({ seat_no: `${row}B`, row, col: 2, class: "premio" });
  }

  const layoutPremio8 = await storage.createLayout({
    name: "HiAce Premio 8 Seat",
    rows: 4,
    cols: 2,
    seatMap: premio8Map,
  });

  // ── HiAce Premio 14 Seat ──
  // Layout 2+3: baris 1 = 2 kursi (A-B), baris 2-5 = 3 kursi (A-B-C)
  // Total: 2 + (4×3) = 14 seat
  const premio14Map = [];
  premio14Map.push({ seat_no: "1A", row: 1, col: 1, class: "premio" });
  premio14Map.push({ seat_no: "1B", row: 1, col: 3, class: "premio" });
  for (let row = 2; row <= 5; row++) {
    premio14Map.push({ seat_no: `${row}A`, row, col: 1, class: "premio" });
    premio14Map.push({ seat_no: `${row}B`, row, col: 2, class: "premio" });
    premio14Map.push({ seat_no: `${row}C`, row, col: 3, class: "premio" });
  }

  const layoutPremio14 = await storage.createLayout({
    name: "HiAce Premio 14 Seat",
    rows: 5,
    cols: 3,
    seatMap: premio14Map,
  });

  // ── HiAce Commuter 14 Seat ──
  // Layout sama dengan Premio 14, tapi kelas ekonomi
  const commuter14Map = [];
  commuter14Map.push({ seat_no: "1A", row: 1, col: 1, class: "commuter" });
  commuter14Map.push({ seat_no: "1B", row: 1, col: 3, class: "commuter" });
  for (let row = 2; row <= 5; row++) {
    commuter14Map.push({ seat_no: `${row}A`, row, col: 1, class: "commuter" });
    commuter14Map.push({ seat_no: `${row}B`, row, col: 2, class: "commuter" });
    commuter14Map.push({ seat_no: `${row}C`, row, col: 3, class: "commuter" });
  }

  const layoutCommuter14 = await storage.createLayout({
    name: "HiAce Commuter 14 Seat",
    rows: 5,
    cols: 3,
    seatMap: commuter14Map,
  });

  console.log("  ✓ 3 layouts: Premio 8 (4×2), Premio 14 (5×3), Commuter 14 (5×3)");

  // ════════════════════════════════════════════════════════════════
  // 4. VEHICLES (12 unit armada)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[4/11] Creating vehicles...");

  // Format kode: {TIPE}-{NN}
  //   PR8  = Premio 8 Seat
  //   PR14 = Premio 14 Seat
  //   CM14 = Commuter 14 Seat
  const vehicleDefs = [
    { code: "PR8-01",  plate: "B 1281 TGH", layoutId: layoutPremio8.id,    capacity: 8,  notes: "HiAce Premio 8 Seat — Premium" },
    { code: "PR8-02",  plate: "B 1282 TGH", layoutId: layoutPremio8.id,    capacity: 8,  notes: "HiAce Premio 8 Seat — Premium" },
    { code: "PR14-01", plate: "B 1401 TGJ", layoutId: layoutPremio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "PR14-02", plate: "B 1402 TGJ", layoutId: layoutPremio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "PR14-03", plate: "D 1403 TGJ", layoutId: layoutPremio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "PR14-04", plate: "D 1404 TGJ", layoutId: layoutPremio14.id,   capacity: 14, notes: "HiAce Premio 14 Seat — Standard" },
    { code: "CM14-01", plate: "B 1501 TGK", layoutId: layoutCommuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-02", plate: "B 1502 TGK", layoutId: layoutCommuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-03", plate: "D 1503 TGK", layoutId: layoutCommuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-04", plate: "D 1504 TGK", layoutId: layoutCommuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-05", plate: "H 1505 TGK", layoutId: layoutCommuter14.id, capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
    { code: "CM14-06", plate: "AB 1506 TGK", layoutId: layoutCommuter14.id,capacity: 14, notes: "HiAce Commuter 14 Seat — Economy" },
  ];

  const vehicles: Record<string, Awaited<ReturnType<typeof storage.createVehicle>>> = {};
  for (const v of vehicleDefs) {
    vehicles[v.code] = await storage.createVehicle(v);
  }

  console.log(`  ✓ ${vehicleDefs.length} vehicles (2 Premio 8, 4 Premio 14, 6 Commuter 14)`);

  // ════════════════════════════════════════════════════════════════
  // 5. TRIP PATTERNS (8 rute)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[5/11] Creating trip patterns...");

  // ── Jakarta ↔ Bandung Rute 1 ──
  // Atrium → Cempaka Putih → Tebet → Pasteur → Cihampelas → Dipatiukur
  const pJktBdg01 = await storage.createTripPattern({
    code: "JKT-BDG-01",
    name: "Jakarta → Bandung · via Senen — Pasteur — Dipatiukur",
    note: "Rute utama via Atrium Senen, Cempaka Putih, Tebet ke Pasteur, Cihampelas, Dipatiukur",
    vehicleClass: "premio-14", defaultLayoutId: layoutPremio14.id,
    active: true, tags: ["shuttle", "jkt-bdg", "premio"],
  });

  const pBdgJkt01 = await storage.createTripPattern({
    code: "BDG-JKT-01",
    name: "Bandung → Jakarta · via Dipatiukur — Pasteur — Senen",
    note: "Rute utama via Dipatiukur, Cihampelas, Pasteur ke Tebet, Cempaka Putih, Atrium Senen",
    vehicleClass: "premio-14", defaultLayoutId: layoutPremio14.id,
    active: true, tags: ["shuttle", "bdg-jkt", "premio"],
  });

  // ── Jakarta ↔ Bandung Rute 2 ──
  // Grogol → Kuningan → Pasteur → Buah Batu
  const pJktBdg02 = await storage.createTripPattern({
    code: "JKT-BDG-02",
    name: "Jakarta → Bandung · via Grogol — Pasteur — Buah Batu",
    note: "Rute via Grogol, Kuningan ke Pasteur, Buah Batu",
    vehicleClass: "commuter-14", defaultLayoutId: layoutCommuter14.id,
    active: true, tags: ["shuttle", "jkt-bdg", "commuter"],
  });

  const pBdgJkt02 = await storage.createTripPattern({
    code: "BDG-JKT-02",
    name: "Bandung → Jakarta · via Buah Batu — Pasteur — Grogol",
    note: "Rute via Buah Batu, Pasteur ke Kuningan, Grogol",
    vehicleClass: "commuter-14", defaultLayoutId: layoutCommuter14.id,
    active: true, tags: ["shuttle", "bdg-jkt", "commuter"],
  });

  // ── Jakarta ↔ Semarang ──
  // Cempaka Putih → Tebet → Jatiwaringin → Karangayu → Majapahit
  const pJktSmg01 = await storage.createTripPattern({
    code: "JKT-SMG-01",
    name: "Jakarta → Semarang · via Tebet — Karangayu",
    note: "Rute antar kota Jakarta-Semarang via Cempaka Putih, Tebet, Jatiwaringin",
    vehicleClass: "premio-14", defaultLayoutId: layoutPremio14.id,
    active: true, tags: ["shuttle", "jkt-smg", "intercity", "premio"],
  });

  const pSmgJkt01 = await storage.createTripPattern({
    code: "SMG-JKT-01",
    name: "Semarang → Jakarta · via Karangayu — Tebet",
    note: "Rute antar kota Semarang-Jakarta via Majapahit, Karangayu",
    vehicleClass: "premio-14", defaultLayoutId: layoutPremio14.id,
    active: true, tags: ["shuttle", "smg-jkt", "intercity", "premio"],
  });

  // ── Semarang ↔ Yogyakarta ──
  // Karangayu → Majapahit → Jombor → Gading → Seturan
  const pSmgYgy01 = await storage.createTripPattern({
    code: "SMG-YGY-01",
    name: "Semarang → Yogyakarta · via Karangayu — Gading",
    note: "Rute Semarang-Yogyakarta via Karangayu, Majapahit ke Jombor, Gading, Seturan",
    vehicleClass: "commuter-14", defaultLayoutId: layoutCommuter14.id,
    active: true, tags: ["shuttle", "smg-ygy", "commuter"],
  });

  const pYgySmg01 = await storage.createTripPattern({
    code: "YGY-SMG-01",
    name: "Yogyakarta → Semarang · via Gading — Karangayu",
    note: "Rute Yogyakarta-Semarang via Seturan, Gading, Jombor ke Majapahit, Karangayu",
    vehicleClass: "commuter-14", defaultLayoutId: layoutCommuter14.id,
    active: true, tags: ["shuttle", "ygy-smg", "commuter"],
  });

  console.log("  ✓ 8 patterns (JKT↔BDG ×2, JKT↔SMG ×1, SMG↔YGY ×1)");

  // ════════════════════════════════════════════════════════════════
  // 6. PATTERN STOPS (urutan pemberhentian tiap rute)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[6/11] Creating pattern stops...");

  // Dwell = waktu berhenti di outlet (detik).
  // Titik asal: dwell 0 (langsung berangkat). Titik transit: dwell 300 (5 menit pickup).
  // Titik akhir: dwell 0 (turun saja).
  const D = 300; // 5 menit dwell di titik transit

  // ── JKT-BDG-01: Atrium → CemPut → Tebet → Pasteur → Cihampelas → Dipatiukur ──
  await storage.createPatternStop({ patternId: pJktBdg01.id, stopId: jktAtrium.id,      stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktBdg01.id, stopId: jktCemput.id,      stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktBdg01.id, stopId: jktTebet.id,       stopSequence: 3, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktBdg01.id, stopId: bdgPasteur.id,     stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pJktBdg01.id, stopId: bdgCihampelas.id,  stopSequence: 5, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pJktBdg01.id, stopId: bdgDipatiukur.id,  stopSequence: 6, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // ── BDG-JKT-01: Dipatiukur → Cihampelas → Pasteur → Tebet → CemPut → Atrium ──
  await storage.createPatternStop({ patternId: pBdgJkt01.id, stopId: bdgDipatiukur.id,  stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pBdgJkt01.id, stopId: bdgCihampelas.id,  stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pBdgJkt01.id, stopId: bdgPasteur.id,     stopSequence: 3, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pBdgJkt01.id, stopId: jktTebet.id,       stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pBdgJkt01.id, stopId: jktCemput.id,      stopSequence: 5, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pBdgJkt01.id, stopId: jktAtrium.id,      stopSequence: 6, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // ── JKT-BDG-02: Grogol → Kuningan → Pasteur → Buah Batu ──
  await storage.createPatternStop({ patternId: pJktBdg02.id, stopId: jktGrogol.id,      stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktBdg02.id, stopId: jktKuningan.id,    stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktBdg02.id, stopId: bdgPasteur.id,     stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pJktBdg02.id, stopId: bdgBuahBatu.id,    stopSequence: 4, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // ── BDG-JKT-02: Buah Batu → Pasteur → Kuningan → Grogol ──
  await storage.createPatternStop({ patternId: pBdgJkt02.id, stopId: bdgBuahBatu.id,    stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pBdgJkt02.id, stopId: bdgPasteur.id,     stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pBdgJkt02.id, stopId: jktKuningan.id,    stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pBdgJkt02.id, stopId: jktGrogol.id,      stopSequence: 4, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // ── JKT-SMG-01: CemPut → Tebet → Jatiwaringin → Karangayu → Majapahit ──
  await storage.createPatternStop({ patternId: pJktSmg01.id, stopId: jktCemput.id,      stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktSmg01.id, stopId: jktTebet.id,       stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktSmg01.id, stopId: jktJatiwaringin.id,stopSequence: 3, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pJktSmg01.id, stopId: smgKarangayu.id,   stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pJktSmg01.id, stopId: smgMajapahit.id,   stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // ── SMG-JKT-01: Karangayu → Majapahit → Jatiwaringin → Tebet → CemPut ──
  await storage.createPatternStop({ patternId: pSmgJkt01.id, stopId: smgKarangayu.id,   stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pSmgJkt01.id, stopId: smgMajapahit.id,   stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pSmgJkt01.id, stopId: jktJatiwaringin.id,stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pSmgJkt01.id, stopId: jktTebet.id,       stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pSmgJkt01.id, stopId: jktCemput.id,      stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // ── SMG-YGY-01: Karangayu → Majapahit → Jombor → Gading → Seturan ──
  await storage.createPatternStop({ patternId: pSmgYgy01.id, stopId: smgKarangayu.id,   stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pSmgYgy01.id, stopId: smgMajapahit.id,   stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pSmgYgy01.id, stopId: ygyJombor.id,      stopSequence: 3, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pSmgYgy01.id, stopId: ygyGading.id,      stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pSmgYgy01.id, stopId: ygySeturan.id,     stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  // ── YGY-SMG-01: Seturan → Gading → Jombor → Majapahit → Karangayu ──
  await storage.createPatternStop({ patternId: pYgySmg01.id, stopId: ygySeturan.id,     stopSequence: 1, dwellSeconds: 0, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pYgySmg01.id, stopId: ygyGading.id,      stopSequence: 2, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pYgySmg01.id, stopId: ygyJombor.id,      stopSequence: 3, dwellSeconds: D, boardingAllowed: true,  alightingAllowed: false });
  await storage.createPatternStop({ patternId: pYgySmg01.id, stopId: smgMajapahit.id,   stopSequence: 4, dwellSeconds: D, boardingAllowed: false, alightingAllowed: true  });
  await storage.createPatternStop({ patternId: pYgySmg01.id, stopId: smgKarangayu.id,   stopSequence: 5, dwellSeconds: 0, boardingAllowed: false, alightingAllowed: true  });

  console.log("  ✓ Pattern stops untuk 8 rute");

  // ════════════════════════════════════════════════════════════════
  // 7. PRICE RULES (harga per leg berdasarkan referensi DayTrans)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[7/11] Creating price rules...");

  // Harga referensi DayTrans (per leg):
  //   JKT↔BDG Rute 1 (Premio 14) : Rp 95.000/leg   — 5 leg, range 75rb-150rb
  //   JKT↔BDG Rute 2 (Commuter)  : Rp 80.000/leg   — 3 leg, lebih murah (economy)
  //   JKT↔SMG (Premio 14)         : Rp 160.000/leg  — 4 leg, jarak jauh
  //   SMG↔YGY (Commuter)          : Rp 80.000/leg   — 4 leg, jarak menengah

  const priceRuleDefs = [
    { patternId: pJktBdg01.id, basePricePerLeg: 95000,  currency: "IDR" },
    { patternId: pBdgJkt01.id, basePricePerLeg: 95000,  currency: "IDR" },
    { patternId: pJktBdg02.id, basePricePerLeg: 80000,  currency: "IDR" },
    { patternId: pBdgJkt02.id, basePricePerLeg: 80000,  currency: "IDR" },
    { patternId: pJktSmg01.id, basePricePerLeg: 160000, currency: "IDR" },
    { patternId: pSmgJkt01.id, basePricePerLeg: 160000, currency: "IDR" },
    { patternId: pSmgYgy01.id, basePricePerLeg: 80000,  currency: "IDR" },
    { patternId: pYgySmg01.id, basePricePerLeg: 80000,  currency: "IDR" },
  ];

  for (const pr of priceRuleDefs) {
    await storage.createPriceRule({
      scope: "pattern", patternId: pr.patternId,
      tripId: null, legIndex: null,
      rule: { basePricePerLeg: pr.basePricePerLeg, currency: pr.currency, multiplier: 1.0 },
      validFrom: null, validTo: null, priority: 1,
    });
  }

  console.log("  ✓ 8 price rules");
  console.log("    JKT↔BDG-01 Rp 95.000/leg (Premio) | JKT↔BDG-02 Rp 80.000/leg (Commuter)");
  console.log("    JKT↔SMG    Rp 160.000/leg          | SMG↔YGY    Rp 80.000/leg");

  // ════════════════════════════════════════════════════════════════
  // 8. TRIP BASES (jadwal keberangkatan harian)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[8/11] Creating trip bases...");

  // Waktu format HH:MM. arriveAt null = titik awal. departAt null = titik akhir.
  // Durasi antar titik Jakarta-Bandung: ~20-30 menit (dalam kota) + ~2.5 jam tol

  const tripBaseDefs = [
    // ──────────────────────────────────────────────────────
    // JKT-BDG-01: Atrium → CemPut → Tebet → Pasteur → Cihampelas → Dipatiukur
    // Durasi total ~3.5 jam. Dalam kota JKT ~40 menit. Tol ~2 jam. Dalam kota BDG ~30 menit.
    // ──────────────────────────────────────────────────────
    {
      patternId: pJktBdg01.id, code: "JKT-BDG-01/06:00", name: "Jakarta → Bandung 01 — 06:00",
      vehicleCode: "PR14-01", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "06:00" },
        { stopSequence: 2, arriveAt: "06:15", departAt: "06:20" },
        { stopSequence: 3, arriveAt: "06:40", departAt: "06:45" },
        { stopSequence: 4, arriveAt: "09:00", departAt: "09:05" },
        { stopSequence: 5, arriveAt: "09:20", departAt: "09:25" },
        { stopSequence: 6, arriveAt: "09:35", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg01.id, code: "JKT-BDG-01/09:00", name: "Jakarta → Bandung 01 — 09:00",
      vehicleCode: "PR14-02", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "09:00" },
        { stopSequence: 2, arriveAt: "09:15", departAt: "09:20" },
        { stopSequence: 3, arriveAt: "09:40", departAt: "09:45" },
        { stopSequence: 4, arriveAt: "12:00", departAt: "12:05" },
        { stopSequence: 5, arriveAt: "12:20", departAt: "12:25" },
        { stopSequence: 6, arriveAt: "12:35", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg01.id, code: "JKT-BDG-01/12:00", name: "Jakarta → Bandung 01 — 12:00",
      vehicleCode: "PR14-01", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "12:00" },
        { stopSequence: 2, arriveAt: "12:15", departAt: "12:20" },
        { stopSequence: 3, arriveAt: "12:40", departAt: "12:45" },
        { stopSequence: 4, arriveAt: "15:15", departAt: "15:20" },
        { stopSequence: 5, arriveAt: "15:35", departAt: "15:40" },
        { stopSequence: 6, arriveAt: "15:50", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg01.id, code: "JKT-BDG-01/15:00", name: "Jakarta → Bandung 01 — 15:00",
      vehicleCode: "PR14-02", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "15:00" },
        { stopSequence: 2, arriveAt: "15:15", departAt: "15:20" },
        { stopSequence: 3, arriveAt: "15:40", departAt: "15:45" },
        { stopSequence: 4, arriveAt: "18:15", departAt: "18:20" },
        { stopSequence: 5, arriveAt: "18:35", departAt: "18:40" },
        { stopSequence: 6, arriveAt: "18:50", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg01.id, code: "JKT-BDG-01/18:00", name: "Jakarta → Bandung 01 — 18:00",
      vehicleCode: "PR14-01", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "18:00" },
        { stopSequence: 2, arriveAt: "18:15", departAt: "18:20" },
        { stopSequence: 3, arriveAt: "18:40", departAt: "18:45" },
        { stopSequence: 4, arriveAt: "21:00", departAt: "21:05" },
        { stopSequence: 5, arriveAt: "21:20", departAt: "21:25" },
        { stopSequence: 6, arriveAt: "21:35", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg01.id, code: "JKT-BDG-01/21:00", name: "Jakarta → Bandung 01 — 21:00",
      vehicleCode: "PR14-02", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "21:00" },
        { stopSequence: 2, arriveAt: "21:15", departAt: "21:20" },
        { stopSequence: 3, arriveAt: "21:40", departAt: "21:45" },
        { stopSequence: 4, arriveAt: "23:45", departAt: "23:50" },
        { stopSequence: 5, arriveAt: "00:05", departAt: "00:10" },
        { stopSequence: 6, arriveAt: "00:20", departAt: null    },
      ],
    },

    // ──────────────────────────────────────────────────────
    // BDG-JKT-01: Dipatiukur → Cihampelas → Pasteur → Tebet → CemPut → Atrium
    // ──────────────────────────────────────────────────────
    {
      patternId: pBdgJkt01.id, code: "BDG-JKT-01/05:00", name: "Bandung → Jakarta 01 — 05:00",
      vehicleCode: "PR14-03", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "05:00" },
        { stopSequence: 2, arriveAt: "05:10", departAt: "05:15" },
        { stopSequence: 3, arriveAt: "05:25", departAt: "05:30" },
        { stopSequence: 4, arriveAt: "07:45", departAt: "07:50" },
        { stopSequence: 5, arriveAt: "08:10", departAt: "08:15" },
        { stopSequence: 6, arriveAt: "08:30", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt01.id, code: "BDG-JKT-01/08:00", name: "Bandung → Jakarta 01 — 08:00",
      vehicleCode: "PR14-04", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "08:00" },
        { stopSequence: 2, arriveAt: "08:10", departAt: "08:15" },
        { stopSequence: 3, arriveAt: "08:25", departAt: "08:30" },
        { stopSequence: 4, arriveAt: "11:00", departAt: "11:05" },
        { stopSequence: 5, arriveAt: "11:25", departAt: "11:30" },
        { stopSequence: 6, arriveAt: "11:45", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt01.id, code: "BDG-JKT-01/12:00", name: "Bandung → Jakarta 01 — 12:00",
      vehicleCode: "PR14-03", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "12:00" },
        { stopSequence: 2, arriveAt: "12:10", departAt: "12:15" },
        { stopSequence: 3, arriveAt: "12:25", departAt: "12:30" },
        { stopSequence: 4, arriveAt: "15:00", departAt: "15:05" },
        { stopSequence: 5, arriveAt: "15:25", departAt: "15:30" },
        { stopSequence: 6, arriveAt: "15:45", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt01.id, code: "BDG-JKT-01/15:00", name: "Bandung → Jakarta 01 — 15:00",
      vehicleCode: "PR14-04", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "15:00" },
        { stopSequence: 2, arriveAt: "15:10", departAt: "15:15" },
        { stopSequence: 3, arriveAt: "15:25", departAt: "15:30" },
        { stopSequence: 4, arriveAt: "18:00", departAt: "18:05" },
        { stopSequence: 5, arriveAt: "18:25", departAt: "18:30" },
        { stopSequence: 6, arriveAt: "18:45", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt01.id, code: "BDG-JKT-01/18:00", name: "Bandung → Jakarta 01 — 18:00",
      vehicleCode: "PR14-03", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "18:00" },
        { stopSequence: 2, arriveAt: "18:10", departAt: "18:15" },
        { stopSequence: 3, arriveAt: "18:25", departAt: "18:30" },
        { stopSequence: 4, arriveAt: "21:00", departAt: "21:05" },
        { stopSequence: 5, arriveAt: "21:25", departAt: "21:30" },
        { stopSequence: 6, arriveAt: "21:45", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt01.id, code: "BDG-JKT-01/21:00", name: "Bandung → Jakarta 01 — 21:00",
      vehicleCode: "PR14-04", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "21:00" },
        { stopSequence: 2, arriveAt: "21:10", departAt: "21:15" },
        { stopSequence: 3, arriveAt: "21:25", departAt: "21:30" },
        { stopSequence: 4, arriveAt: "23:45", departAt: "23:50" },
        { stopSequence: 5, arriveAt: "00:10", departAt: "00:15" },
        { stopSequence: 6, arriveAt: "00:30", departAt: null    },
      ],
    },

    // ──────────────────────────────────────────────────────
    // JKT-BDG-02: Grogol → Kuningan → Pasteur → Buah Batu
    // Durasi total ~3 jam. Grogol→Kuningan ~30 menit. Tol ~2 jam. Pasteur→BuahBatu ~20 menit.
    // ──────────────────────────────────────────────────────
    {
      patternId: pJktBdg02.id, code: "JKT-BDG-02/07:00", name: "Jakarta → Bandung 02 — 07:00",
      vehicleCode: "CM14-01", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "07:00" },
        { stopSequence: 2, arriveAt: "07:30", departAt: "07:35" },
        { stopSequence: 3, arriveAt: "09:45", departAt: "09:50" },
        { stopSequence: 4, arriveAt: "10:10", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg02.id, code: "JKT-BDG-02/11:00", name: "Jakarta → Bandung 02 — 11:00",
      vehicleCode: "CM14-02", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "11:00" },
        { stopSequence: 2, arriveAt: "11:30", departAt: "11:35" },
        { stopSequence: 3, arriveAt: "13:45", departAt: "13:50" },
        { stopSequence: 4, arriveAt: "14:10", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg02.id, code: "JKT-BDG-02/15:00", name: "Jakarta → Bandung 02 — 15:00",
      vehicleCode: "CM14-01", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "15:00" },
        { stopSequence: 2, arriveAt: "15:30", departAt: "15:35" },
        { stopSequence: 3, arriveAt: "17:45", departAt: "17:50" },
        { stopSequence: 4, arriveAt: "18:10", departAt: null    },
      ],
    },
    {
      patternId: pJktBdg02.id, code: "JKT-BDG-02/19:00", name: "Jakarta → Bandung 02 — 19:00",
      vehicleCode: "CM14-02", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "19:00" },
        { stopSequence: 2, arriveAt: "19:30", departAt: "19:35" },
        { stopSequence: 3, arriveAt: "21:45", departAt: "21:50" },
        { stopSequence: 4, arriveAt: "22:10", departAt: null    },
      ],
    },

    // ──────────────────────────────────────────────────────
    // BDG-JKT-02: Buah Batu → Pasteur → Kuningan → Grogol
    // ──────────────────────────────────────────────────────
    {
      patternId: pBdgJkt02.id, code: "BDG-JKT-02/06:00", name: "Bandung → Jakarta 02 — 06:00",
      vehicleCode: "CM14-03", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "06:00" },
        { stopSequence: 2, arriveAt: "06:20", departAt: "06:25" },
        { stopSequence: 3, arriveAt: "08:35", departAt: "08:40" },
        { stopSequence: 4, arriveAt: "09:10", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt02.id, code: "BDG-JKT-02/10:00", name: "Bandung → Jakarta 02 — 10:00",
      vehicleCode: "CM14-04", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "10:00" },
        { stopSequence: 2, arriveAt: "10:20", departAt: "10:25" },
        { stopSequence: 3, arriveAt: "12:35", departAt: "12:40" },
        { stopSequence: 4, arriveAt: "13:10", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt02.id, code: "BDG-JKT-02/14:00", name: "Bandung → Jakarta 02 — 14:00",
      vehicleCode: "CM14-03", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "14:00" },
        { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "16:35", departAt: "16:40" },
        { stopSequence: 4, arriveAt: "17:10", departAt: null    },
      ],
    },
    {
      patternId: pBdgJkt02.id, code: "BDG-JKT-02/18:00", name: "Bandung → Jakarta 02 — 18:00",
      vehicleCode: "CM14-04", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "18:00" },
        { stopSequence: 2, arriveAt: "18:20", departAt: "18:25" },
        { stopSequence: 3, arriveAt: "20:35", departAt: "20:40" },
        { stopSequence: 4, arriveAt: "21:10", departAt: null    },
      ],
    },

    // ──────────────────────────────────────────────────────
    // JKT-SMG-01: CemPut → Tebet → Jatiwaringin → Karangayu → Majapahit
    // Durasi total ~6 jam. Dalam kota JKT ~50 menit. Tol ~5 jam. Dalam kota SMG ~20 menit.
    // ──────────────────────────────────────────────────────
    {
      patternId: pJktSmg01.id, code: "JKT-SMG-01/07:00", name: "Jakarta → Semarang 01 — 07:00",
      vehicleCode: "PR14-01", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "07:00" },
        { stopSequence: 2, arriveAt: "07:20", departAt: "07:25" },
        { stopSequence: 3, arriveAt: "07:50", departAt: "07:55" },
        { stopSequence: 4, arriveAt: "13:00", departAt: "13:05" },
        { stopSequence: 5, arriveAt: "13:25", departAt: null    },
      ],
    },
    {
      patternId: pJktSmg01.id, code: "JKT-SMG-01/13:00", name: "Jakarta → Semarang 01 — 13:00",
      vehicleCode: "PR14-02", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "13:00" },
        { stopSequence: 2, arriveAt: "13:20", departAt: "13:25" },
        { stopSequence: 3, arriveAt: "13:50", departAt: "13:55" },
        { stopSequence: 4, arriveAt: "19:00", departAt: "19:05" },
        { stopSequence: 5, arriveAt: "19:25", departAt: null    },
      ],
    },
    {
      patternId: pJktSmg01.id, code: "JKT-SMG-01/20:00", name: "Jakarta → Semarang 01 — 20:00",
      vehicleCode: "PR14-01", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "20:00" },
        { stopSequence: 2, arriveAt: "20:20", departAt: "20:25" },
        { stopSequence: 3, arriveAt: "20:50", departAt: "20:55" },
        { stopSequence: 4, arriveAt: "02:00", departAt: "02:05" },
        { stopSequence: 5, arriveAt: "02:25", departAt: null    },
      ],
    },

    // ──────────────────────────────────────────────────────
    // SMG-JKT-01: Karangayu → Majapahit → Jatiwaringin → Tebet → CemPut
    // ──────────────────────────────────────────────────────
    {
      patternId: pSmgJkt01.id, code: "SMG-JKT-01/06:00", name: "Semarang → Jakarta 01 — 06:00",
      vehicleCode: "PR14-03", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "06:00" },
        { stopSequence: 2, arriveAt: "06:20", departAt: "06:25" },
        { stopSequence: 3, arriveAt: "11:30", departAt: "11:35" },
        { stopSequence: 4, arriveAt: "12:00", departAt: "12:05" },
        { stopSequence: 5, arriveAt: "12:25", departAt: null    },
      ],
    },
    {
      patternId: pSmgJkt01.id, code: "SMG-JKT-01/14:00", name: "Semarang → Jakarta 01 — 14:00",
      vehicleCode: "PR14-04", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "14:00" },
        { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "19:30", departAt: "19:35" },
        { stopSequence: 4, arriveAt: "20:00", departAt: "20:05" },
        { stopSequence: 5, arriveAt: "20:25", departAt: null    },
      ],
    },
    {
      patternId: pSmgJkt01.id, code: "SMG-JKT-01/21:00", name: "Semarang → Jakarta 01 — 21:00",
      vehicleCode: "PR14-03", layoutId: layoutPremio14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "21:00" },
        { stopSequence: 2, arriveAt: "21:20", departAt: "21:25" },
        { stopSequence: 3, arriveAt: "02:30", departAt: "02:35" },
        { stopSequence: 4, arriveAt: "03:00", departAt: "03:05" },
        { stopSequence: 5, arriveAt: "03:25", departAt: null    },
      ],
    },

    // ──────────────────────────────────────────────────────
    // SMG-YGY-01: Karangayu → Majapahit → Jombor → Gading → Seturan
    // Durasi total ~3.5 jam. Dalam kota SMG ~20 menit. Jalan ~2.5 jam. Dalam kota YGY ~30 menit.
    // ──────────────────────────────────────────────────────
    {
      patternId: pSmgYgy01.id, code: "SMG-YGY-01/06:00", name: "Semarang → Yogyakarta 01 — 06:00",
      vehicleCode: "CM14-05", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "06:00" },
        { stopSequence: 2, arriveAt: "06:20", departAt: "06:25" },
        { stopSequence: 3, arriveAt: "09:00", departAt: "09:05" },
        { stopSequence: 4, arriveAt: "09:25", departAt: "09:30" },
        { stopSequence: 5, arriveAt: "09:45", departAt: null    },
      ],
    },
    {
      patternId: pSmgYgy01.id, code: "SMG-YGY-01/10:00", name: "Semarang → Yogyakarta 01 — 10:00",
      vehicleCode: "CM14-06", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "10:00" },
        { stopSequence: 2, arriveAt: "10:20", departAt: "10:25" },
        { stopSequence: 3, arriveAt: "13:00", departAt: "13:05" },
        { stopSequence: 4, arriveAt: "13:25", departAt: "13:30" },
        { stopSequence: 5, arriveAt: "13:45", departAt: null    },
      ],
    },
    {
      patternId: pSmgYgy01.id, code: "SMG-YGY-01/14:00", name: "Semarang → Yogyakarta 01 — 14:00",
      vehicleCode: "CM14-05", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "14:00" },
        { stopSequence: 2, arriveAt: "14:20", departAt: "14:25" },
        { stopSequence: 3, arriveAt: "17:00", departAt: "17:05" },
        { stopSequence: 4, arriveAt: "17:25", departAt: "17:30" },
        { stopSequence: 5, arriveAt: "17:45", departAt: null    },
      ],
    },
    {
      patternId: pSmgYgy01.id, code: "SMG-YGY-01/18:00", name: "Semarang → Yogyakarta 01 — 18:00",
      vehicleCode: "CM14-06", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "18:00" },
        { stopSequence: 2, arriveAt: "18:20", departAt: "18:25" },
        { stopSequence: 3, arriveAt: "21:00", departAt: "21:05" },
        { stopSequence: 4, arriveAt: "21:25", departAt: "21:30" },
        { stopSequence: 5, arriveAt: "21:45", departAt: null    },
      ],
    },

    // ──────────────────────────────────────────────────────
    // YGY-SMG-01: Seturan → Gading → Jombor → Majapahit → Karangayu
    // ──────────────────────────────────────────────────────
    {
      patternId: pYgySmg01.id, code: "YGY-SMG-01/05:00", name: "Yogyakarta → Semarang 01 — 05:00",
      vehicleCode: "CM14-05", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "05:00" },
        { stopSequence: 2, arriveAt: "05:15", departAt: "05:20" },
        { stopSequence: 3, arriveAt: "05:35", departAt: "05:40" },
        { stopSequence: 4, arriveAt: "08:20", departAt: "08:25" },
        { stopSequence: 5, arriveAt: "08:45", departAt: null    },
      ],
    },
    {
      patternId: pYgySmg01.id, code: "YGY-SMG-01/09:00", name: "Yogyakarta → Semarang 01 — 09:00",
      vehicleCode: "CM14-06", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "09:00" },
        { stopSequence: 2, arriveAt: "09:15", departAt: "09:20" },
        { stopSequence: 3, arriveAt: "09:35", departAt: "09:40" },
        { stopSequence: 4, arriveAt: "12:20", departAt: "12:25" },
        { stopSequence: 5, arriveAt: "12:45", departAt: null    },
      ],
    },
    {
      patternId: pYgySmg01.id, code: "YGY-SMG-01/13:00", name: "Yogyakarta → Semarang 01 — 13:00",
      vehicleCode: "CM14-05", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "13:00" },
        { stopSequence: 2, arriveAt: "13:15", departAt: "13:20" },
        { stopSequence: 3, arriveAt: "13:35", departAt: "13:40" },
        { stopSequence: 4, arriveAt: "16:20", departAt: "16:25" },
        { stopSequence: 5, arriveAt: "16:45", departAt: null    },
      ],
    },
    {
      patternId: pYgySmg01.id, code: "YGY-SMG-01/17:00", name: "Yogyakarta → Semarang 01 — 17:00",
      vehicleCode: "CM14-06", layoutId: layoutCommuter14.id, capacity: 14,
      defaultStopTimes: [
        { stopSequence: 1, arriveAt: null,    departAt: "17:00" },
        { stopSequence: 2, arriveAt: "17:15", departAt: "17:20" },
        { stopSequence: 3, arriveAt: "17:35", departAt: "17:40" },
        { stopSequence: 4, arriveAt: "20:20", departAt: "20:25" },
        { stopSequence: 5, arriveAt: "20:45", departAt: null    },
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
      defaultVehicleId: vehicles[def.vehicleCode].id,
      capacity: def.capacity,
      channelFlags: channelAll,
      defaultStopTimes: def.defaultStopTimes,
    });
    createdBases.push(base);
  }

  console.log(`  ✓ ${createdBases.length} trip bases`);
  console.log("    JKT↔BDG-01: 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 (×2 arah = 12)");
  console.log("    JKT↔BDG-02: 07:00, 11:00, 15:00, 19:00 / 06:00, 10:00, 14:00, 18:00 (8)");
  console.log("    JKT↔SMG:    07:00, 13:00, 20:00 / 06:00, 14:00, 21:00 (6)");
  console.log("    SMG↔YGY:    06:00, 10:00, 14:00, 18:00 / 05:00, 09:00, 13:00, 17:00 (8)");

  // ════════════════════════════════════════════════════════════════
  // 9. CARGO TYPES
  // ════════════════════════════════════════════════════════════════
  console.log("\n[9/11] Creating cargo types...");

  const ctDokumen    = await storage.createCargoType({ code: "DOK",      name: "Dokumen",             description: "Surat, berkas, dan dokumen penting.",             maxWeightKg: "1.00",  isActive: true });
  const ctPaketMini  = await storage.createCargoType({ code: "PKT-MINI", name: "Paket Mini",          description: "Aksesoris, kosmetik, barang kecil.",              maxWeightKg: "2.00",  isActive: true });
  const ctPaketKecil = await storage.createCargoType({ code: "PKT-S",    name: "Paket Kecil",         description: "Pakaian, buku, barang ringan.",                   maxWeightKg: "5.00",  isActive: true });
  const ctPaketSedang= await storage.createCargoType({ code: "PKT-M",    name: "Paket Sedang",        description: "Sepatu, tas, barang rumah tangga kecil.",         maxWeightKg: "10.00", isActive: true });
  const ctPaketBesar = await storage.createCargoType({ code: "PKT-L",    name: "Paket Besar",         description: "Peralatan rumah tangga, barang bervolume.",       maxWeightKg: "20.00", isActive: true });
  const ctElektronik = await storage.createCargoType({ code: "ELEK",     name: "Elektronik",          description: "Handphone, laptop, elektronik. Penanganan hati.",maxWeightKg: "10.00", isActive: true });
  const ctMakanan    = await storage.createCargoType({ code: "MKNN",     name: "Makanan & Minuman",   description: "Makanan, minuman, oleh-oleh. Prioritas cepat.",   maxWeightKg: "5.00",  isActive: true });

  console.log("  ✓ 7 jenis kargo: DOK, PKT-MINI, PKT-S, PKT-M, PKT-L, ELEK, MKNN");

  // ════════════════════════════════════════════════════════════════
  // 10. CARGO RATES
  // ════════════════════════════════════════════════════════════════
  console.log("\n[10/11] Creating cargo rates...");

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
    await storage.createCargoRate({
      cargoTypeId: r.type.id, scope: "global", scopeRefId: null,
      originStopId: null, destinationStopId: null,
      pricePerKg: r.pricePerKg, pricePerLeg: "0", minCharge: r.minCharge, isActive: true,
    });
  }

  console.log("  ✓ 7 tarif global kargo");

  // ════════════════════════════════════════════════════════════════
  // 11. MATERIALIZE TRIPS (30 hari ke depan)
  // ════════════════════════════════════════════════════════════════
  console.log("\n[11/11] Materializing trips for next 30 days...");

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
        if (err instanceof Error && err.message !== 'base-not-eligible') {
          console.warn(`  ! Failed to materialize ${base.code} on ${serviceDate}:`, err.message);
          errorCount++;
        }
      }
    }
    process.stdout.write(`  ✓ ${base.code}: trips materialized\n`);
  }

  console.log(`  ✓ ${tripCount} trips dibuat (${errorCount} error)`);

  // ════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════
  const stopCount   = await db.execute(sql`SELECT COUNT(*) as c FROM stops`);
  const tripCountDB = await db.execute(sql`SELECT COUNT(*) as c FROM trips`);
  const invCount    = await db.execute(sql`SELECT COUNT(*) as c FROM seat_inventory`);
  const cityList    = await db.execute(sql`SELECT DISTINCT city FROM stops ORDER BY city`);

  console.log("\n═══════════════════════════════════════════");
  console.log("  SEED SELESAI");
  console.log("═══════════════════════════════════════════");
  console.log(`  Kota        : ${(cityList.rows as any[]).map((r: any) => r.city).join(', ')}`);
  console.log(`  Stops       : ${(stopCount.rows[0] as any).c}`);
  console.log(`  Patterns    : 8 (JKT↔BDG ×2, JKT↔SMG ×1, SMG↔YGY ×1)`);
  console.log(`  Trip Bases  : ${createdBases.length}`);
  console.log(`  Trips       : ${(tripCountDB.rows[0] as any).c} (${serviceDates.length} hari)`);
  console.log(`  Seat Inv    : ${(invCount.rows[0] as any).c} baris`);
  console.log(`  Kargo Types : 7`);
  console.log("═══════════════════════════════════════════\n");

  await seedRbac();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedData().catch(console.error).finally(() => process.exit(0));
}
