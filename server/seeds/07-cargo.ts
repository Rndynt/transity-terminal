import { storage } from "../storage";

export async function seedCargo() {
  console.log("\n[9] Creating cargo types...");

  const ctDokumen = await storage.createCargoType({ code: "DOK", name: "Dokumen", description: "Surat, berkas, dan dokumen penting.", maxWeightKg: "1.00", isActive: true });
  const ctPaketMini = await storage.createCargoType({ code: "PKT-MINI", name: "Paket Mini", description: "Aksesoris, kosmetik, barang kecil.", maxWeightKg: "2.00", isActive: true });
  const ctPaketKecil = await storage.createCargoType({ code: "PKT-S", name: "Paket Kecil", description: "Pakaian, buku, barang ringan.", maxWeightKg: "5.00", isActive: true });
  const ctPaketSedang = await storage.createCargoType({ code: "PKT-M", name: "Paket Sedang", description: "Sepatu, tas, barang rumah tangga kecil.", maxWeightKg: "10.00", isActive: true });
  const ctPaketBesar = await storage.createCargoType({ code: "PKT-L", name: "Paket Besar", description: "Peralatan rumah tangga, barang bervolume.", maxWeightKg: "20.00", isActive: true });
  const ctElektronik = await storage.createCargoType({ code: "ELEK", name: "Elektronik", description: "Handphone, laptop, elektronik. Penanganan hati.", maxWeightKg: "10.00", isActive: true });
  const ctMakanan = await storage.createCargoType({ code: "MKNN", name: "Makanan & Minuman", description: "Makanan, minuman, oleh-oleh. Prioritas cepat.", maxWeightKg: "5.00", isActive: true });

  console.log("  ✓ 7 jenis kargo: DOK, PKT-MINI, PKT-S, PKT-M, PKT-L, ELEK, MKNN");

  console.log("\n[10] Creating cargo rates...");

  const globalRates = [
    { type: ctDokumen, pricePerKg: "15000", minCharge: "10000" },
    { type: ctPaketMini, pricePerKg: "12000", minCharge: "15000" },
    { type: ctPaketKecil, pricePerKg: "10000", minCharge: "20000" },
    { type: ctPaketSedang, pricePerKg: "8000", minCharge: "35000" },
    { type: ctPaketBesar, pricePerKg: "7000", minCharge: "50000" },
    { type: ctElektronik, pricePerKg: "20000", minCharge: "30000" },
    { type: ctMakanan, pricePerKg: "10000", minCharge: "20000" },
  ];

  for (const r of globalRates) {
    await storage.createCargoRate({
      cargoTypeId: r.type.id, scope: "global", scopeRefId: null,
      originStopId: null, destinationStopId: null,
      pricePerKg: r.pricePerKg, pricePerLeg: "0", minCharge: r.minCharge, isActive: true,
    });
  }

  console.log("  ✓ 7 tarif global kargo");
}
