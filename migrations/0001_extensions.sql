-- Postgres 13+ has gen_random_uuid() built-in via pgcrypto.
-- We CREATE EXTENSION defensively to support older versions.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
