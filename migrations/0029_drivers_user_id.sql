-- Tambah kolom user_id di drivers: menghubungkan record driver ke akun
-- users (Realmio) yang login, agar server bisa resolve "siapa driver yang
-- sedang login" (prasyarat untuk scoping "my assigned trips" di driver
-- app). Nullable + unique: satu user paling banyak terhubung ke satu
-- driver, dan driver lama (belum onboarding ke akun user) tetap valid.
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_drivers_user_id" ON "drivers" ("user_id") WHERE "user_id" IS NOT NULL;
