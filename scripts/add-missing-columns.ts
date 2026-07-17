import "../server/lib/loadEnv";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      `ALTER TABLE trip_patterns ADD COLUMN IF NOT EXISTS allow_intra_city_booking boolean NOT NULL DEFAULT false`
    );
    console.log("✓ allow_intra_city_booking column ensured on trip_patterns");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
