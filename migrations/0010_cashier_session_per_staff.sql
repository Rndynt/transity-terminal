-- Sprint 1 / S1-02: cashier sessions per (outlet, staff) instead of per-outlet.
--
-- Sebelum patch ini, kode aplikasi memblokir openSession kalau ada SESI
-- 'open' di outlet yang sama (tanpa peduli staff_id). Akibatnya 2 kasir
-- yang shift di outlet sama tidak bisa buka sesi paralel. Patch ini:
--
--   1. Mengizinkan beberapa sesi 'open' per outlet selama staff_id berbeda.
--   2. Menambah UNIQUE INDEX partial supaya RACE CONDITION (dua request
--      paralel dari staff yang sama) tetap tertolak di level DB.
--
-- Backfill: tidak diperlukan. Constraint baru hanya akan menolak baris
-- 'open' yang melanggar invariant ke depan.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cashier_sessions_outlet_staff_open
  ON cashier_sessions (outlet_id, staff_id)
  WHERE status = 'open';
