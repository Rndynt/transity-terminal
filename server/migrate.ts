import { pool } from "./db";
import { createComponentLogger } from "./lib/logger";

const log = createComponentLogger("migrate");

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
    log.info("staff_members: ensured name/email columns removed");

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
    log.info("users: ensured all required columns exist");

    // price_rule_scope: PR#pricing-swap drift fix (see
    // migrations/0028_fix_price_rule_scope_enum.sql for the full root-cause
    // writeup). The type was originally created by 0002_enums.sql with the
    // OLD flat-pricing labels; when the OD-matrix redesign tried to
    // recreate it with 'global'+'pattern', a swallowed duplicate_object
    // exception meant that never applied. Any DB whose history predates
    // that redesign is left with 'global' missing from the live enum,
    // which throws "invalid input value for enum price_rule_scope: global"
    // — surfacing as a 500 on booking/fare-quote endpoints that fall
    // through to the global pricing tier. Adding an enum label is a fast,
    // lock-free metadata-only change, safe to run unconditionally on every
    // boot (IF NOT EXISTS makes it a no-op once fixed).
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'price_rule_scope'
        ) THEN
          ALTER TYPE "price_rule_scope" ADD VALUE IF NOT EXISTS 'global';
        END IF;
      END $$;
    `);
    log.info("price_rule_scope: ensured 'global' enum label exists");

    // drivers: pastikan kolom user_id ada (link ke users.id, prasyarat
    // "my assigned trips" scoping di driver app). Net ini hanya menjamin
    // keberadaan kolom — UNIQUE + FK constraint dimiliki oleh migration
    // 0029_drivers_user_id.sql, tidak diulang di sini.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'drivers'
        ) THEN
          ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id text;
        END IF;
      END $$;
    `);
    log.info("drivers: ensured user_id column exists");

  } catch (err) {
    log.error({ err }, "safety-net migration failed");
    throw err;
  } finally {
    client.release();
  }
}
