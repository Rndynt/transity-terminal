#!/usr/bin/env node
/**
 * Jalankan semua pending migrations ke database.
 * 
 * Usage dari VPS:
 *   cd ~/.openclaw/workspace/TransityConsole
 *   DATABASE_URL=postgresql://... node packages/db/migrate.mjs
 * 
 * Atau dari dalam Docker container:
 *   docker compose exec app node packages/db/migrate.mjs
 *   
 * Atau via pnpm dari packages/db:
 *   cd packages/db && DATABASE_URL=... pnpm migrate
 */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const db = drizzle(client);
const migrationsFolder = path.join(__dirname, 'migrations');

console.log('🔄  Running migrations from:', migrationsFolder);
await migrate(db, { migrationsFolder });
console.log('✅  All migrations applied successfully');

await client.end();
