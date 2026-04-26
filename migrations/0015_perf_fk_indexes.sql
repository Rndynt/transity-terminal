-- 0015_perf_fk_indexes
-- Tier 1 PR α-1: tambah FK index pada tabel-tabel yang queryable lewat FK-nya
-- tapi belum punya btree index. Selama hari-hari awal, ukuran tabel kecil
-- sehingga seq-scan masih murah, tapi seiring volume bertambah ini menjadi
-- bottleneck linear. Semua `CREATE INDEX IF NOT EXISTS` — aman re-run dan
-- aman di-replay dari fresh schema (drizzle inline `CREATE INDEX` di
-- shared/schema/*.ts juga sudah di-tambah supaya `drizzle-kit push` tidak
-- drop index ini).

-- staff_members.role_id — RBAC list-staff-by-role (admin panel)
CREATE INDEX IF NOT EXISTS "idx_staff_members_role_id"
  ON "staff_members" ("role_id");

-- staff_members.outlet_id — list-staff-by-outlet (CSO admin)
-- Partial: outlet_id nullable (super-admin tidak punya outlet)
CREATE INDEX IF NOT EXISTS "idx_staff_members_outlet_id"
  ON "staff_members" ("outlet_id")
  WHERE outlet_id IS NOT NULL;

-- (outlets.stop_id sudah auto-indexed lewat UNIQUE constraint, skip.)

-- vehicles.layout_id — fleet ops (bus per layout)
CREATE INDEX IF NOT EXISTS "idx_vehicles_layout_id"
  ON "vehicles" ("layout_id");

-- cargo_rates(cargo_type_id, scope, scope_ref_id, is_active) — pricing lookup di
-- findCargoRate (server/repositories/cargo.repository.ts:65). Setiap insert
-- cargo shipment hit query ini 1-3x (global / pattern / trip scope chain).
CREATE INDEX IF NOT EXISTS "idx_cargo_rates_lookup"
  ON "cargo_rates" ("cargo_type_id", "scope", "scope_ref_id", "is_active");

-- trip_cost_items.template_id — list cost items per template
CREATE INDEX IF NOT EXISTS "idx_trip_cost_items_template_id"
  ON "trip_cost_items" ("template_id");

-- spj_cost_lines.spj_id — list cost lines per SPJ + delete-cascade-by-spj
CREATE INDEX IF NOT EXISTS "idx_spj_cost_lines_spj_id"
  ON "spj_cost_lines" ("spj_id");

-- trip_patterns.default_layout_id — pattern admin (which patterns use layout X)
-- Partial: default_layout_id nullable
CREATE INDEX IF NOT EXISTS "idx_trip_patterns_default_layout_id"
  ON "trip_patterns" ("default_layout_id")
  WHERE default_layout_id IS NOT NULL;
