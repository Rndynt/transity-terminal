-- Tambah kolom destination_outlet_id di cargo_shipments: outlet tujuan
-- tempat kargo diambil/dikirim, dipilih CSO setelah trip dipilih (bisa >1
-- outlet per stop tujuan). Nullable untuk kompatibilitas data lama.
ALTER TABLE "cargo_shipments" ADD COLUMN IF NOT EXISTS "destination_outlet_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cargo_shipments_destination_outlet_id_outlets_id_fk'
  ) THEN
    ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_destination_outlet_id_outlets_id_fk" FOREIGN KEY ("destination_outlet_id") REFERENCES "public"."outlets"("id");
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cargo_destination_outlet_id" ON "cargo_shipments" ("destination_outlet_id");
