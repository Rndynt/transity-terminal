import { storage } from "../storage";
import type { SeedContext } from "./context";

export async function seedStops(ctx: SeedContext) {
  console.log("\n[1] Creating stops...");

  ctx.stops.jktAtrium = await storage.createStop({ code: "ATR", name: "Atrium Senen", city: "Jakarta", lat: "-6.1745", lng: "106.8413", isOutlet: true });
  ctx.stops.jktCemput = await storage.createStop({ code: "CPT", name: "Cempaka Putih", city: "Jakarta", lat: "-6.1753", lng: "106.8688", isOutlet: true });
  ctx.stops.jktTebet = await storage.createStop({ code: "TBT", name: "MT Haryono Tebet", city: "Jakarta", lat: "-6.2297", lng: "106.8547", isOutlet: true });
  ctx.stops.jktGrogol = await storage.createStop({ code: "GRG", name: "Daan Mogot Grogol", city: "Jakarta", lat: "-6.1582", lng: "106.7863", isOutlet: true });
  ctx.stops.jktKuningan = await storage.createStop({ code: "KNN", name: "Rasuna Said Kuningan", city: "Jakarta", lat: "-6.2275", lng: "106.8318", isOutlet: true });
  ctx.stops.jktJatiwaringin = await storage.createStop({ code: "JTW", name: "Jatiwaringin", city: "Jakarta", lat: "-6.2789", lng: "106.9069", isOutlet: true });

  ctx.stops.bdgDipatiukur = await storage.createStop({ code: "DPU", name: "Dipatiukur", city: "Bandung", lat: "-6.8935", lng: "107.6162", isOutlet: true });
  ctx.stops.bdgPasteur = await storage.createStop({ code: "PST", name: "Pasteur", city: "Bandung", lat: "-6.8893", lng: "107.5896", isOutlet: true });
  ctx.stops.bdgCihampelas = await storage.createStop({ code: "CHP", name: "Cihampelas", city: "Bandung", lat: "-6.8953", lng: "107.6031", isOutlet: true });
  ctx.stops.bdgBuahBatu = await storage.createStop({ code: "BBT", name: "Buah Batu", city: "Bandung", lat: "-6.9523", lng: "107.6341", isOutlet: true });

  ctx.stops.smgKarangayu = await storage.createStop({ code: "KAY", name: "Karangayu", city: "Semarang", lat: "-6.9698", lng: "110.3852", isOutlet: true });
  ctx.stops.smgMajapahit = await storage.createStop({ code: "MJP", name: "Majapahit", city: "Semarang", lat: "-6.9933", lng: "110.4494", isOutlet: true });

  ctx.stops.ygyGading = await storage.createStop({ code: "GDG", name: "Gading Mantrijeron", city: "Yogyakarta", lat: "-7.8100", lng: "110.3630", isOutlet: true });
  ctx.stops.ygyJombor = await storage.createStop({ code: "JBR", name: "Jombor", city: "Yogyakarta", lat: "-7.7400", lng: "110.3610", isOutlet: true });
  ctx.stops.ygySeturan = await storage.createStop({ code: "STR", name: "Seturan", city: "Yogyakarta", lat: "-7.7584", lng: "110.4099", isOutlet: true });

  console.log("  ✓ 15 stops (Jakarta 6, Bandung 4, Semarang 2, Yogyakarta 3)");
}

export async function seedOutlets(ctx: SeedContext) {
  console.log("\n[2] Creating outlets...");

  const s = ctx.stops;
  const outletDefs = [
    { stopId: s.jktAtrium.id, name: "Atrium Senen", address: "Plaza Atrium Lobby Utara, Jl. Senen Raya No. 135, Jakarta Pusat 10410", phone: "021-3424-6767" },
    { stopId: s.jktCemput.id, name: "Cempaka Putih", address: "Jl. Letjend Suprapto No. 58 (Seberang Kampus YARSI), Cempaka Putih, Jakarta Pusat", phone: "021-3662-6767" },
    { stopId: s.jktTebet.id, name: "MT Haryono Tebet", address: "SPBU Coco Pertamina Kav. 18, Jl. MT. Haryono, Tebet Barat, Jakarta Selatan 12810", phone: "021-7080-6767" },
    { stopId: s.jktGrogol.id, name: "Daan Mogot Grogol", address: "SPBU Pertamina COCO Daan Mogot, Jelambar, Grogol Petamburan, Jakarta Barat", phone: "0815-804-6767" },
    { stopId: s.jktKuningan.id, name: "Rasuna Said Kuningan", address: "SPBU COCO Pertamina, Jl. HR. Rasuna Said Kav. X2/02, Kuningan Timur, Jakarta Selatan", phone: "0816-1799-6767" },
    { stopId: s.jktJatiwaringin.id, name: "Jatiwaringin", address: "Jl. Jatiwaringin Raya No. 7 (Seberang Pizza Hut), Jakarta Timur", phone: "0815-805-6767" },
    { stopId: s.bdgDipatiukur.id, name: "Dipatiukur", address: "Jl. Dipati Ukur No. 107, Lebakgede, Kec. Coblong, Kota Bandung 40132", phone: "022-7025-6767" },
    { stopId: s.bdgPasteur.id, name: "Pasteur", address: "Jl. Dr. Djunjunan No. 55B, Pajajaran, Kec. Cicendo, Kota Bandung 40173", phone: "0816-1780-6767" },
    { stopId: s.bdgCihampelas.id, name: "Cihampelas", address: "Jl. Cihampelas No. 210 (Depan SMU Pasundan 2), Bandung Wetan, Kota Bandung", phone: "022-3114-0000" },
    { stopId: s.bdgBuahBatu.id, name: "Buah Batu", address: "Jl. Terusan Buah Batu No. 298, Kujangsari, Kec. Bandung Kidul, Kota Bandung 40287", phone: "0815-8511-6767" },
    { stopId: s.smgKarangayu.id, name: "Karangayu", address: "Jl. Jend. Sudirman No. 251, Karangayu, Semarang Barat", phone: "024-7604-192" },
    { stopId: s.smgMajapahit.id, name: "Majapahit", address: "Jl. Majapahit No. 318, Perum Singatara, Palebon, Pedurungan, Semarang", phone: "0815-7535-9942" },
    { stopId: s.ygyGading.id, name: "Gading Mantrijeron", address: "Jl. MT. Haryono No. 1, Suryodiningratan, Kec. Mantrijeron, Kota Yogyakarta", phone: "0274-385-990" },
    { stopId: s.ygyJombor.id, name: "Jombor", address: "Terminal Jombor, Jl. Magelang, Jombor Lor, Sendangadi, Mlati, Sleman", phone: "0274-868-767" },
    { stopId: s.ygySeturan.id, name: "Seturan", address: "Jl. Seturan Raya, Caturtunggal, Kec. Depok, Sleman, Yogyakarta", phone: "0274-487-6767" },
  ];

  for (const o of outletDefs) {
    await storage.createOutlet(o);
  }

  console.log(`  ✓ ${outletDefs.length} outlets`);
}
