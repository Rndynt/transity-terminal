import crypto from "node:crypto";
import fs from "node:fs";
import { pool } from "./db";
import { db } from "./db";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Menjalankan migrasi database dengan aman untuk dua skenario:
 *
 * Skenario A — Fresh DB (VPS baru, database kosong):
 *   Tidak ada tabel sama sekali. Drizzle migrate menjalankan semua SQL
 *   migration files secara berurutan sehingga semua tabel terbentuk.
 *   Tidak ada tabel yang diperlakukan spesial — users, bookings, stops, dll
 *   semua dibuat dari migration files yang sama.
 *
 * Skenario B — DB sudah ada (setup via db:push):
 *   Tabel sudah ada tapi tracking table Drizzle kosong/tidak ada.
 *   Drizzle menggunakan `created_at` timestamp untuk menentukan migration mana
 *   yang harus dijalankan (bukan hash). Kita seed tracking table dengan
 *   timestamp migration lama, sehingga Drizzle hanya menjalankan yang baru.
 */
export async function runSchemaMigrations(migrationsFolder = "./migrations") {
  const client = await pool.connect();
  try {
    // Cek apakah tabel aplikasi sudah ada (indikasi DB sudah di-setup via db:push)
    const { rows: existingTables } = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('bookings', 'trips', 'stops', 'roles', 'staff_members')
    `);
    const existingTableCount = parseInt(existingTables[0].count, 10);

    if (existingTableCount >= 3) {
      // Pastikan schema drizzle dan tracking table ada
      await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);

      // Cek apakah tracking table sudah punya entri
      const { rows: migRows } = await client.query(
        `SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`
      );
      const migrationCount = parseInt(migRows[0].count, 10);

      if (migrationCount === 0) {
        // Skenario B: DB sudah ada tapi tracking table kosong.
        // Baca journal dan seed semua migration lama (idx < NEW_MIGRATION_IDX).
        // Drizzle cek: jika folderMillis migration <= max(created_at) di tabel → skip.
        // Jadi kita perlu insert migration 0005 (idx 5) sebagai yang paling akhir.
        console.log("[migrator] DB sudah ada. Inisialisasi migration tracking...");

        const journalPath = `${migrationsFolder}/meta/_journal.json`;
        const journal = JSON.parse(fs.readFileSync(journalPath).toString()) as { entries: Array<{ idx: number; tag: string; when: number; breakpoints?: boolean }> };

        // Semua migration sampai sebelum idx 7 dianggap sudah diterapkan
        const NEW_MIGRATION_IDX = 7;
        const existingEntries = journal.entries.filter((e) => e.idx < NEW_MIGRATION_IDX);

        for (const entry of existingEntries) {
          const sqlPath = `${migrationsFolder}/${entry.tag}.sql`;
          if (!fs.existsSync(sqlPath)) continue;

          const sqlContent = fs.readFileSync(sqlPath).toString();
          const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");

          await client.query(
            `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
            [hash, entry.when]
          );
        }

        console.log(`[migrator] ${existingEntries.length} migration lama ditandai sudah diterapkan.`);
      }
    }

  } finally {
    client.release();
  }

  // Panggil migrate() — hanya migration baru yang folderMillis-nya lebih tinggi
  // dari entri terakhir di tracking table yang akan dijalankan.
  await migrate(db, { migrationsFolder });

  // Q5: pastikan sequence untuk waybill cargo ada (deterministic, anti-collision).
  // Sequence di-reset per-hari oleh aplikasi via padding date prefix sehingga
  // satu sequence cukup untuk seumur hidup app.
  const seqClient = await pool.connect();
  try {
    await seqClient.query(`CREATE SEQUENCE IF NOT EXISTS cargo_waybill_seq START 1`);
  } finally {
    seqClient.release();
  }

  console.log("[migrator] Schema database sudah up-to-date.");
}
