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
    // Realmio may create the users table without name/image columns.
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS name text,
        ADD COLUMN IF NOT EXISTS image text;
    `);
    console.log("[migrate] users: ensured name/image columns exist");

  } catch (err) {
    console.error("[migrate] Failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
