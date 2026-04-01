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
  } catch (err) {
    console.error("[migrate] Failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
