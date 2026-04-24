/**
 * Shared transactional helper: decrement promo usage count and revert
 * voucher state for every `booking_promo_applications` row tied to a
 * booking that is being cancelled / refunded.
 *
 * Extracted (P2 §5) from four identical inline blocks in
 *   - `unseat.service.ts`       (cancelPassengerTicket, all-inactive branch)
 *   - `bookings.service.ts`     (cancelBooking)
 *   - `bookings.service.ts`     (webhook-failed cancel path)
 *   - `refunds.service.ts`      (approveRefund, all-inactive branch)
 *
 * Keeping the logic in one place avoids the drift we've already seen
 * between call-sites (e.g. some used `COALESCE(... , 0) + 1` on the
 * increment side while revert sites all used `GREATEST(0, n - 1)`), and
 * makes any future change to the revert semantics a single-file edit.
 *
 * Semantics:
 *   - `GREATEST(0, usage_count - 1)` — never drives the counter negative
 *     even under concurrent cancellation races.
 *   - Voucher flipped back to `'active'` with `used_at` and
 *     `used_by_booking_id` cleared so it can be applied to a different
 *     booking later.
 *   - Must be called INSIDE an existing transaction so decrement +
 *     voucher-revert commit atomically with the booking/passenger state
 *     change that triggered the revert.
 */

import { sql, eq } from "drizzle-orm";
import { db } from "@server/db";
import {
  promotions as promotionsTable,
  vouchers as vouchersTable,
  bookingPromoApplications as bpaTable,
} from "@shared/schema";

// Transaction type derived from the drizzle handle itself; stays in sync
// with whatever dialect `server/db.ts` is wired to (currently node-postgres).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function revertPromoApplicationsForBooking(
  tx: Tx,
  bookingId: string,
): Promise<void> {
  const apps = await tx
    .select()
    .from(bpaTable)
    .where(eq(bpaTable.bookingId, bookingId));

  for (const app of apps) {
    await tx
      .update(promotionsTable)
      .set({ usageCount: sql`GREATEST(0, ${promotionsTable.usageCount} - 1)` })
      .where(eq(promotionsTable.id, app.promoId));

    if (app.voucherId) {
      await tx
        .update(vouchersTable)
        .set({ status: 'active', usedAt: null, usedByBookingId: null })
        .where(eq(vouchersTable.id, app.voucherId));
    }
  }
}
