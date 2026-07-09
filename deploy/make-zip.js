// Script untuk membuat deployment zip — jalankan via `npm run deploy:zip`
// Output: transity-api.zip (siap kirim ke VM)

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const outFile = resolve(root, "transity-api.zip");

// Pastikan dist/ ada (hasil build:api)
if (!existsSync(resolve(root, "dist/index.js"))) {
  console.error("❌  dist/index.js tidak ditemukan. Jalankan npm run build:api dulu.");
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
console.log(`\nDi VM:`);
console.log(`  cd /opt && unzip transity-api.zip -d transity-api`);
console.log(`  cd transity-api`);
console.log(`  npm ci --omit=dev`);
console.log(`  cp deploy/env.production.example .env && nano .env`);
console.log(`  pm2 start deploy/pm2.config.js`);
