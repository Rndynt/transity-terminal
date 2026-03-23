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

export const pool = new Pool({ 
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});
export const db = drizzle({ client: pool, schema });
