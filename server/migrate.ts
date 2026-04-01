import { pool } from "./db";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE staff_members
        DROP COLUMN IF EXISTS name,
        DROP COLUMN IF EXISTS email;
    `);
    console.log("[migrate] staff_members: removed name/email columns (now linked via users table)");

    // Ensure users table has all columns our app expects.
    // Realmio may create the users table with a minimal structure (only id + credentials),
    // so we add every column the application depends on if it doesn't already exist.
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
