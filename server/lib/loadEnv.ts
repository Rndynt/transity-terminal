/**
 * Side-effect-only module yang load `.env` ke `process.env` SEBELUM
 * import lain di-evaluate.
 *
 * **Kenapa file terpisah?** ESM hoist semua `import` declarations ke
 * top-of-module dan evaluate dalam source order — siblings dieksekusi
 * depth-first sesuai urutan deklarasi. Kalau env loading ditaruh
 * inline di body `server/index.ts`, ia jalan SETELAH semua import
 * dievaluasi (termasuk `observability/sentry` yang transitively
 * load `lib/logger.ts`). Akibatnya `pino({ level: process.env.LOG_LEVEL ... })`
 * dipanggil saat `process.env.LOG_LEVEL` masih kosong → silently
 * default.
 *
 * Solusinya: file ini dipanggil sebagai `import "./lib/loadEnv";`
 * paling awal di `index.ts`. Top-level code di file ini langsung
 * eksekusi saat module di-evaluate, sehingga `process.env`
 * sudah ter-populate sebelum import berikutnya (sentry → logger)
 * dijalankan.
 *
 * Format: line-based KEY=VALUE, support quoted values dan komentar `#`.
 * Tidak pakai `dotenv` package supaya zero-dep dan boot-fast.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
