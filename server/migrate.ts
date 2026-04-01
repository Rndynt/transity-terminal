import { pool } from "./db";

/**
 * Safety-net migration untuk kompatibilitas Realmio.
 *
 * Tabel `users` didefinisikan secara resmi di shared/schema/users.ts dan
 * dikelola oleh Drizzle (db:push). Fungsi ini hanyalah jaring pengaman
 * untuk skenario di mana Realmio membuat tabel `users` lebih dulu dengan
 * struktur minimalnya (tanpa kolom-kolom yang dibutuhkan aplikasi),
 * sehingga kolom yang hilang ditambahkan saat server startup.
 *
 * Semua perintah menggunakan IF NOT EXISTS / IF EXISTS sehingga aman
 * dijalankan berulang kali tanpa merusak data yang sudah ada.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    // staff_members: kolom name/email dipindah ke tabel users (tidak duplikat).
    await client.query(`
      ALTER TABLE staff_members
        DROP COLUMN IF EXISTS name,
        DROP COLUMN IF EXISTS email;
    `);
    console.log("[migrate] staff_members: removed name/email columns (now linked via users table)");

    // users: pastikan semua kolom yang didefinisikan di shared/schema/users.ts
    // sudah ada. Ini safety-net jika Realmio membuat tabel dengan struktur minimal.
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email text,
        ADD COLUMN IF NOT EXISTS name text,
        ADD COLUMN IF NOT EXISTS image text,
        ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS role text;
    `);
    console.log("[migrate] users: ensured all required columns exist (email, name, image, emailVerified, createdAt, updatedAt, role)");

  } catch (err) {
    console.error("[migrate] Failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
