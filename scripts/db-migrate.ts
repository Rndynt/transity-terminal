#!/usr/bin/env tsx
/**
 * S3-08: standalone migration runner.
 *
 * Dipakai di pipeline deploy supaya migrasi DB dijalankan SATU KALI sebelum
 * app instance baru start. Tujuan: di blue/green deployment dengan
 * `RUN_MIGRATIONS_ON_BOOT=false`, kita tidak mau dua node race menjalankan
 * `runSchemaMigrations()` paralel — cukup CI/CD yang panggil script ini.
 *
 * Flow blue/green:
 *   1. Deploy script tarik image baru.
 *   2. `pnpm tsx scripts/db-migrate.ts` — jalan sekali, exit 0 kalau OK.
 *   3. Bring up node BLUE baru (dengan `RUN_MIGRATIONS_ON_BOOT=false`).
 *   4. Healthcheck pass → switch nginx upstream → drain GREEN.
 *
 * Exit code: 0 sukses, 1 gagal (CI harus stop deploy).
 */
import "../server/lib/loadEnv";
import { runSchemaMigrations } from "../server/migrator";
import { runMigrations } from "../server/migrate";
import { pool } from "../server/db";

async function main() {
  const t0 = Date.now();
  console.log(`[db-migrate] start at ${new Date().toISOString()}`);

  try {
    console.log("[db-migrate] Step 1/2 — runSchemaMigrations (Drizzle migrate)");
    await runSchemaMigrations();

    console.log("[db-migrate] Step 2/2 — runMigrations (safety-net ALTER TABLE)");
    await runMigrations();

    const elapsedMs = Date.now() - t0;
    console.log(`[db-migrate] OK in ${elapsedMs}ms`);
    await pool.end();
    process.exit(0);
  } catch (err) {
    const elapsedMs = Date.now() - t0;
    console.error(`[db-migrate] FAIL after ${elapsedMs}ms:`, err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  }
}

main();
