import { storage } from "@server/storage";

/**
 * NOTE: this root-level seeds/ directory (01-stops.ts..09-rbac.ts) is not
 * wired into server/seeds/index.ts (which only ever loads the ./nusa or
 * ./buskita variants) — it predates the multi-tenant split and is not
 * currently invoked by anything. Kept compiling (types only) rather than
 * removed, since that split is out of scope here. Cargo OD-matrix rates
 * need a pattern to attach to (cargo has no global tier — see
 * CARGO_OD_MATRIX_IMPLEMENTATION_REPORT.md), so actual rate-seeding lives
 * in the per-operator variants (server/seeds/{nusa,buskita}/07-cargo.ts)
 * which DO receive pattern context.
 */
export async function seedCargo() {
  console.log("\n[9] Creating cargo types...");

  await storage.createCargoType({ code: "DOK", name: "Dokumen", description: "Surat, berkas, dan dokumen penting.", maxWeightKg: "1.00", minCharge: "10000", isActive: true });
  await storage.createCargoType({ code: "PKT-MINI", name: "Paket Mini", description: "Aksesoris, kosmetik, barang kecil.", maxWeightKg: "2.00", minCharge: "15000", isActive: true });
  await storage.createCargoType({ code: "PKT-S", name: "Paket Kecil", description: "Pakaian, buku, barang ringan.", maxWeightKg: "5.00", minCharge: "20000", isActive: true });
  await storage.createCargoType({ code: "PKT-M", name: "Paket Sedang", description: "Sepatu, tas, barang rumah tangga kecil.", maxWeightKg: "10.00", minCharge: "35000", isActive: true });
  await storage.createCargoType({ code: "PKT-L", name: "Paket Besar", description: "Peralatan rumah tangga, barang bervolume.", maxWeightKg: "20.00", minCharge: "50000", isActive: true });
  await storage.createCargoType({ code: "ELEK", name: "Elektronik", description: "Handphone, laptop, elektronik. Penanganan hati.", maxWeightKg: "10.00", minCharge: "30000", isActive: true });
  await storage.createCargoType({ code: "MKNN", name: "Makanan & Minuman", description: "Makanan, minuman, oleh-oleh. Prioritas cepat.", maxWeightKg: "5.00", minCharge: "20000", isActive: true });

  console.log("  ✓ 7 jenis kargo: DOK, PKT-MINI, PKT-S, PKT-M, PKT-L, ELEK, MKNN");
  console.log("  (Tarif OD-matrix per pola tidak dibuat di sini — lihat seeds/{nusa,buskita}/07-cargo.ts)");
}
