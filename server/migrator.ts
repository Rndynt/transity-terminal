import { pool } from "./db";
import { db } from "./db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createComponentLogger } from "./lib/logger";

const log = createComponentLogger("migrator");

/**
 * Menjalankan migrasi database.
 *
 * Sejak migration rewrite (drop 18 migration lama → 21 file domain-grouped),
 * skema migration jauh lebih sederhana:
 *
 * - **Fresh DB**: semua 21 file dieksekusi berurutan oleh Drizzle migrator.
 *   Tidak ada operasi spesial.
 *
 * - **DB yang masih punya tabel dari migration lama**: WAJIB drop schema
 *   `public` dulu sebelum deploy. Penjelasan lengkap di PR description.
 *   Production saat ini hanya berisi data dummy, sehingga drop+migrate aman.
 *
 * Fungsi ini juga memastikan sequence `cargo_waybill_seq` ada (deterministic,
 * anti-collision). Sequence di-reset per-hari oleh aplikasi via padding date
 * prefix sehingga satu sequence cukup untuk seumur hidup app.
 */
export async function runSchemaMigrations(migrationsFolder = "./migrations") {
  await migrate(db, { migrationsFolder });

  const seqClient = await pool.connect();
  try {
    await seqClient.query(`CREATE SEQUENCE IF NOT EXISTS cargo_waybill_seq START 1`);
  } finally {
    seqClient.release();
  }

  log.info("schema database sudah up-to-date");
}
