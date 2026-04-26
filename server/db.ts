import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL.replace(/^[\u2018\u2019'"]+|[\u2018\u2019'"]+$/g, '');
const useSSL = connectionString.includes('sslmode=require') || connectionString.includes('neon.tech');

// Pool size tunable via PG_POOL_MAX. Default = 20 (vs node-postgres default 10),
// karena Fastify single-process di-leverage oleh booking flows yang punya
// 5-8 concurrent queries (snapshots + boarding + fare + history). Overshoot
// boleh: idle koneksi auto-released setelah idleTimeoutMillis.
const poolMax = Number(process.env.PG_POOL_MAX) || 20;
const idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS) || 30000;
const connectionTimeoutMillis = Number(process.env.PG_CONNECT_TIMEOUT_MS) || 10000;

export const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: poolMax,
  idleTimeoutMillis,
  connectionTimeoutMillis,
});
export const db = drizzle({ client: pool, schema });
