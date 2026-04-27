-- §3.8 + §3.9: align currency type + close schema invariant holes.
--
-- Background:
--   * §3.8: bookings.total_amount is numeric(12,2), but booking_groups.
--     total_amount was integer. Round-trip code casts via Math.round which
--     loses precision the moment commission/discount fractions appear.
--   * §3.9: bookings.booking_code and status were nullable, promo_id had
--     no FK. Insert paths always set both columns and the FK is desirable
--     to prevent dangling references when a promotion is hard-deleted.
--
-- Defensive backfill: we may have legacy rows with NULLs (data from db:push
-- era before notNull was enforced). Backfill before adding constraints.
-- Idempotent: subsequent runs are no-ops because there are no more NULLs.

------------------------------------------------------------
-- §3.8 booking_groups.total_amount: integer → numeric(12,2)
------------------------------------------------------------
ALTER TABLE "booking_groups"
  ALTER COLUMN "total_amount" TYPE numeric(12, 2) USING "total_amount"::numeric(12, 2);

------------------------------------------------------------
-- §3.9a booking_code NOT NULL (after defensive backfill)
------------------------------------------------------------
-- If any historic row has a NULL booking_code, fabricate a stable
-- placeholder using the row's id so the unique constraint stays valid.
UPDATE "bookings"
   SET "booking_code" = 'BACKFILL-' || UPPER(SUBSTR(REPLACE("id"::text, '-', ''), 1, 12))
 WHERE "booking_code" IS NULL;

ALTER TABLE "bookings"
  ALTER COLUMN "booking_code" SET NOT NULL;

------------------------------------------------------------
-- §3.9a status NOT NULL (with default 'pending' kept)
------------------------------------------------------------
UPDATE "bookings"
   SET "status" = 'pending'
 WHERE "status" IS NULL;

ALTER TABLE "bookings"
  ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "bookings"
  ALTER COLUMN "status" SET DEFAULT 'pending';

------------------------------------------------------------
-- §3.9b promo_id FK to promotions(id) ON DELETE SET NULL
------------------------------------------------------------
-- Cleanup dangling promoIds before adding the FK. Set to NULL because the
-- snapshot data needed for finance reports is on the booking row itself
-- (discount_amount, voucher_code) — losing the promo ref is acceptable.
UPDATE "bookings"
   SET "promo_id" = NULL
 WHERE "promo_id" IS NOT NULL
   AND "promo_id" NOT IN (SELECT "id" FROM "promotions");

-- DO block: idempotent constraint add (pg_constraint check before ALTER).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bookings_promo_id_fkey'
       AND conrelid = '"bookings"'::regclass
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_promo_id_fkey"
      FOREIGN KEY ("promo_id") REFERENCES "promotions"("id") ON DELETE SET NULL;
  END IF;
END $$;
