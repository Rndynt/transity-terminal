import { pool } from "./db";

/**
 * Safety-net migration untuk kompatibilitas Realmio.
 *
 * Fungsi ini dijalankan SETELAH Drizzle migrate (yang membuat semua tabel dari
 * migration SQL files). Tugasnya adalah memastikan kolom-kolom tertentu ada
 * di tabel users, untuk menangani kasus di mana Realmio membuat tabel users
 * dengan struktur minimalnya SEBELUM Drizzle migrate sempat berjalan.
 *
 * Semua perintah menggunakan DO blocks dengan pengecekan existensi tabel
 * sehingga aman dijalankan di fresh DB maupun DB yang sudah ada.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    // staff_members: hapus kolom name/email (sudah dipindah ke tabel users).
    // Dibungkus DO block agar tidak crash jika tabel belum ada.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'staff_members'
        ) THEN
          ALTER TABLE staff_members
            DROP COLUMN IF EXISTS name,
            DROP COLUMN IF EXISTS email;
        END IF;
      END $$;
    `);
    console.log("[migrate] staff_members: ensured name/email columns removed");

    // users: pastikan semua kolom yang dibutuhkan ada.
    // Dibungkus DO block agar tidak crash jika tabel belum ada.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users'
        ) THEN
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email text,
            ADD COLUMN IF NOT EXISTS name text,
            ADD COLUMN IF NOT EXISTS image text,
            ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now(),
            ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now(),
            ADD COLUMN IF NOT EXISTS role text;
        END IF;
      END $$;
    `);
    console.log("[migrate] users: ensured all required columns exist");

  } catch (err) {
    console.error("[migrate] Failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
