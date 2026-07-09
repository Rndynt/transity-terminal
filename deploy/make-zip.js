// Script untuk membuat deployment zip — jalankan via `npm run deploy:zip`
// Output: transity-api.zip (siap kirim ke VM)

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const outFile = resolve(root, "transity-api.zip");

// Pastikan dist/ ada (hasil build:api)
if (!existsSync(resolve(root, "dist/index.cjs"))) {
  console.error("❌  dist/index.cjs tidak ditemukan. Jalankan npm run build:api dulu.");
  process.exit(1);
}

// Hapus zip lama kalau ada
try { execSync(`rm -f "${outFile}"`); } catch {}

// Yang masuk zip — cukup untuk jalan di VM tanpa build tools
const includes = [
  "dist/",
  "migrations/",
  "deploy/",
  "package.json",
  "package-lock.json",
].join(" ");

console.log("📦  Membuat transity-api.zip ...");
execSync(`cd "${root}" && zip -r transity-api.zip ${includes} -x "deploy/make-zip.js"`, {
  stdio: "inherit",
});

console.log(`\n✅  Selesai: transity-api.zip`);
console.log(`\nCara kirim ke VM:`);
console.log(`  gcloud compute scp transity-api.zip NAMA_INSTANCE:/opt/ --zone=ZONE`);
console.log(`\nDi VM (tidak perlu npm ci — semua deps sudah terbundle):`);
console.log(`  cd /opt && sudo unzip -o transity-api.zip -d transity-api`);
console.log(`  sudo chown -R $USER:$USER /opt/transity-api`);
console.log(`  cd transity-api`);
console.log(`  cp deploy/env.production.example .env && nano .env`);
console.log(`  pm2 start deploy/pm2.config.js`);
