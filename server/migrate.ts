import { pool } from "./db";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE staff_members
        ADD COLUMN IF NOT EXISTS name  text,
        ADD COLUMN IF NOT EXISTS email text;
    `);
    console.log("[migrate] staff_members: name, email columns OK");
  } catch (err) {
    console.error("[migrate] Failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
