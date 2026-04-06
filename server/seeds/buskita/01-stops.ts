import { storage } from "@server/storage";
import type { SeedContext } from "./context";

export async function seedStops(ctx: SeedContext) {
  console.log("\n[1] Creating stops...");

  ctx.stops.sbyDarmo = await storage.createStop({ code: "DRM", name: "Darmo Trade Center", city: "Surabaya", lat: "-7.2875", lng: "112.7378", isOutlet: true });
  ctx.stops.sbyGubeng = await storage.createStop({ code: "GBG", name: "Gubeng Station Area", city: "Surabaya", lat: "-7.2652", lng: "112.7515", isOutlet: true });
  ctx.stops.sbyMerr = await storage.createStop({ code: "MRR", name: "MERR Galaxy Mall", city: "Surabaya", lat: "-7.2789", lng: "112.7851", isOutlet: true });
  ctx.stops.sbyWaru = await storage.createStop({ code: "WRU", name: "Terminal Waru", city: "Surabaya", lat: "-7.3567", lng: "112.7268", isOutlet: true });

  ctx.stops.mlgKlojen = await storage.createStop({ code: "KLJ", name: "Klojen Town Square", city: "Malang", lat: "-7.9786", lng: "112.6325", isOutlet: true });
  ctx.stops.mlgSoekarno = await storage.createStop({ code: "SKH", name: "Soekarno Hatta Malang", city: "Malang", lat: "-7.9510", lng: "112.6150", isOutlet: true });
  ctx.stops.mlgLowokwaru = await storage.createStop({ code: "LWK", name: "Lowokwaru UB Area", city: "Malang", lat: "-7.9560", lng: "112.6155", isOutlet: true });

  ctx.stops.bliSanur = await storage.createStop({ code: "SNR", name: "Sanur Beach Hub", city: "Denpasar", lat: "-8.6876", lng: "115.2639", isOutlet: true });
  ctx.stops.bliKuta = await storage.createStop({ code: "KTA", name: "Kuta Square", city: "Denpasar", lat: "-8.7186", lng: "115.1700", isOutlet: true });
  ctx.stops.bliUbud = await storage.createStop({ code: "UBD", name: "Ubud Center", city: "Gianyar", lat: "-8.5069", lng: "115.2625", isOutlet: true });

  ctx.stops.prbLinggo = await storage.createStop({ code: "LNG", name: "Probolinggo Terminal", city: "Probolinggo", lat: "-7.7543", lng: "113.2159", isOutlet: true });

  console.log("  ✓ 11 stops (Surabaya 4, Malang 3, Denpasar 2, Gianyar 1, Probolinggo 1)");
}

export async function seedOutlets(ctx: SeedContext) {
  console.log("\n[2] Creating outlets...");

  const s = ctx.stops;
  const outletDefs = [
    { stopId: s.sbyDarmo.id, name: "Darmo Trade Center", address: "Jl. Mayjen HR. Muhammad No. 20, Darmo, Wonokromo, Surabaya 60241", phone: "031-5612-8899" },
    { stopId: s.sbyGubeng.id, name: "Gubeng Station Area", address: "Jl. Pemuda No. 31, Ketabang, Genteng, Surabaya 60271", phone: "031-5354-8899" },
    { stopId: s.sbyMerr.id, name: "MERR Galaxy Mall", address: "Jl. Dharmahusada Indah Timur, Mulyorejo, Surabaya 60115", phone: "031-5929-8899" },
    { stopId: s.sbyWaru.id, name: "Terminal Waru", address: "Terminal Purabaya, Jl. Letjen Sutoyo, Waru, Sidoarjo 61256", phone: "031-8539-8899" },
    { stopId: s.mlgKlojen.id, name: "Klojen Town Square", address: "Jl. Basuki Rahmat No. 1, Klojen, Kota Malang 65111", phone: "0341-362-8899" },
    { stopId: s.mlgSoekarno.id, name: "Soekarno Hatta Malang", address: "Jl. Soekarno Hatta No. 9, Mojolangu, Lowokwaru, Malang 65142", phone: "0341-478-8899" },
    { stopId: s.mlgLowokwaru.id, name: "Lowokwaru UB Area", address: "Jl. MT. Haryono No. 169, Dinoyo, Lowokwaru, Malang 65144", phone: "0341-553-8899" },
    { stopId: s.bliSanur.id, name: "Sanur Beach Hub", address: "Jl. Danau Tamblingan No. 89, Sanur, Denpasar Selatan 80228", phone: "0361-288-8899" },
    { stopId: s.bliKuta.id, name: "Kuta Square", address: "Jl. Kartika Plaza No. 8X, Kuta, Badung, Bali 80361", phone: "0361-752-8899" },
    { stopId: s.bliUbud.id, name: "Ubud Center", address: "Jl. Raya Ubud No. 35, Ubud, Gianyar 80571", phone: "0361-975-8899" },
    { stopId: s.prbLinggo.id, name: "Probolinggo Terminal", address: "Jl. Panglima Sudirman No. 151, Kanigaran, Probolinggo 67213", phone: "0335-421-8899" },
  ];

  for (const o of outletDefs) {
    await storage.createOutlet(o);
  }

  console.log(`  ✓ ${outletDefs.length} outlets`);
}
