/**
 * One-off fix for the `price_rule_scope` enum drift documented in
 * migrations/0028_fix_price_rule_scope_enum.sql — run this once against
 * the live DB, then it's safe to delete or keep as a reference.
 *
 * Usage: npx tsx scripts/fix-price-rule-scope-enum.ts
 */
import "../server/lib/loadEnv";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set (check your .env)");
  }
  const useSSL = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");
  const pool = new Pool({ connectionString, ssl: useSSL ? { rejectUnauthorized: false } : false });

  try {
    const before = await pool.query(
      `SELECT enumlabel FROM pg_enum
       WHERE enumtypid = 'price_rule_scope'::regtype
       ORDER BY enumsortorder`
    );
    console.log("price_rule_scope labels BEFORE:", before.rows.map(r => r.enumlabel));

    await pool.query(`ALTER TYPE "price_rule_scope" ADD VALUE IF NOT EXISTS 'global'`);

    const after = await pool.query(
      `SELECT enumlabel FROM pg_enum
       WHERE enumtypid = 'price_rule_scope'::regtype
       ORDER BY enumsortorder`
    );
    console.log("price_rule_scope labels AFTER: ", after.rows.map(r => r.enumlabel));
    console.log("\n✅ Fix applied. Retry GET /api/app/trips/search — it should no longer 500.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Failed to apply fix:", err);
  process.exit(1);
});
