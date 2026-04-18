import * as bookingsRepo from "../bookings/bookings.repository.js";
import * as operatorsRepo from "../operators/operators.repository.js";

const TERMINAL_TIMEOUT_MS = 8000;
const RECONCILE_INTERVAL_MS = 5_000;
const MAX_UNCERTAIN_AGE_SECONDS = 10;

function applyOperatorOverride<T extends { apiUrl: string }>(op: T): T {
  const override = process.env["OPERATOR_TERMINAL_URL_OVERRIDE"];
  if (override && override.trim()) {
    return { ...op, apiUrl: override.replace(/\/+$/, "") };
  }
  return op;
}

let reconcilerTimer: ReturnType<typeof setInterval> | null = null;

async function expireExpiredPendingBookings(): Promise<void> {
  let expired: Awaited<ReturnType<typeof bookingsRepo.findExpiredPendingBookings>>;
  try {
    expired = await bookingsRepo.findExpiredPendingBookings();
  } catch (e) {
    console.error("[reconciler] Failed to query expired pending bookings:", e);
    return;
  }

  if (expired.length === 0) return;
  console.info(`[reconciler] Expiring ${expired.length} pending booking(s) past holdExpiresAt`);

  const { rows: operators } = await operatorsRepo.findAll({ active: true }, { limit: 100, offset: 0 });
  const operatorMap = new Map(operators.map((o) => [o.id, applyOperatorOverride(o)]));

  for (const booking of expired) {
    const updated = await bookingsRepo.updateStatusConditional(booking.id, "expired", ["pending"]);
    if (!updated) continue;

    console.info(`[reconciler] Booking ${booking.id} expired (hold deadline passed)`);

    const operator = operatorMap.get(booking.operatorId);
    if (operator && booking.externalBookingId) {
      try {
        const res = await fetch(
          `${operator.apiUrl}/api/app/bookings/${encodeURIComponent(booking.externalBookingId)}/cancel`,
          {
            method: "POST",
            signal: AbortSignal.timeout(TERMINAL_TIMEOUT_MS),
            headers: { "X-Service-Key": operator.serviceKey, "Content-Type": "application/json" },
          }
        );
        if (res.ok || res.status === 404) {
          await bookingsRepo.markTerminalNotified(booking.operatorId, booking.externalBookingId);
          console.info(`[reconciler] Booking ${booking.id} expired + terminal seats released`);
        }
      } catch (err) {
        console.warn(
          `[reconciler] Failed to release expired seats at terminal for booking ${booking.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    } else {
      await bookingsRepo.markTerminalNotified(booking.operatorId, booking.externalBookingId ?? booking.id);
      console.info(`[reconciler] Booking ${booking.id} expired (no terminal booking to release)`);
    }
  }
}

// Reconcile booking uncertain: cek ke terminal apakah booking berhasil dibuat
async function reconcileUncertainBookings(): Promise<void> {
  let uncertain: Awaited<ReturnType<typeof bookingsRepo.findUncertainBookings>>;
  try {
    uncertain = await bookingsRepo.findUncertainBookings(MAX_UNCERTAIN_AGE_SECONDS);
  } catch (e) {
    console.error("[reconciler] Failed to query uncertain bookings:", e);
    return;
  }

  if (uncertain.length === 0) return;
  console.info(`[reconciler] Checking ${uncertain.length} uncertain booking(s)`);

  const { rows: operators } = await operatorsRepo.findAll({ active: true }, { limit: 100, offset: 0 });
  const operatorMap = new Map(operators.map((o) => [o.id, applyOperatorOverride(o)]));

  for (const booking of uncertain) {
    const operator = operatorMap.get(booking.operatorId);
    if (!operator) {
      console.warn(`[reconciler] Operator not found for booking ${booking.id}, cancelling`);
      await bookingsRepo.updateStatus(booking.id, "cancelled");
      continue;
    }

    if (booking.externalBookingId) {
      // Terminal sempat menerima booking — cek statusnya
      try {
        const res = await fetch(
          `${operator.apiUrl}/api/app/bookings/${encodeURIComponent(booking.externalBookingId)}`,
          {
            signal: AbortSignal.timeout(TERMINAL_TIMEOUT_MS),
            headers: { "X-Service-Key": operator.serviceKey },
          }
        );

        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const terminalStatus = String(data["status"] ?? "");
          const totalAmount = data["totalAmount"] ? String(data["totalAmount"]) : String(booking.totalAmount);
          const holdExpiresAt = data["holdExpiresAt"] ? new Date(String(data["holdExpiresAt"])) : null;

          // Terminal punya booking → reconcile ke pending
          await bookingsRepo.updateFromTerminalSuccess(booking.id, {
            externalBookingId: booking.externalBookingId,
            totalAmount,
            commissionAmount: String(booking.commissionAmount ?? "0"),
            holdExpiresAt,
            status: "pending",
          });

          console.info(`[reconciler] Booking ${booking.id} reconciled: uncertain → pending (terminal: ${terminalStatus})`);
        } else if (res.status === 404) {
          // Terminal tidak punya booking → batalkan
          await bookingsRepo.updateStatus(booking.id, "cancelled");
          console.info(`[reconciler] Booking ${booking.id} not found at terminal → cancelled`);
        }
        // Jika terminal masih error (5xx) → biarkan uncertain, coba lagi cycle berikutnya
      } catch {
        console.warn(`[reconciler] Terminal unreachable for booking ${booking.id}, will retry next cycle`);
      }
    } else {
      const colonIdx = booking.tripId.indexOf(":");
      const originalTripId = colonIdx !== -1 ? booking.tripId.slice(colonIdx + 1) : booking.tripId;
      const seatsParam = booking.seatNumbers.join(",");
      let resolved = false;

      try {
        const findRes = await fetch(
          `${operator.apiUrl}/api/app/bookings/find-ota?tripId=${encodeURIComponent(originalTripId)}&seats=${encodeURIComponent(seatsParam)}`,
          {
            signal: AbortSignal.timeout(TERMINAL_TIMEOUT_MS),
            headers: { "X-Service-Key": operator.serviceKey },
          }
        );
        if (findRes.ok) {
          const item = await findRes.json() as Record<string, unknown>;
          const extId = String(item["id"] ?? "");
          if (extId) {
            const totalAmount = item["totalAmount"] ? String(item["totalAmount"]) : String(booking.totalAmount);
            const holdExpiresAt = item["holdExpiresAt"] ? new Date(String(item["holdExpiresAt"])) : null;
            await bookingsRepo.updateFromTerminalSuccess(booking.id, {
              externalBookingId: extId,
              totalAmount,
              commissionAmount: String(booking.commissionAmount ?? "0"),
              holdExpiresAt,
              status: "pending",
            });
            console.info(`[reconciler] Booking ${booking.id} resolved: uncertain → pending (externalBookingId=${extId})`);
            resolved = true;
          }
        }
      } catch {
        console.warn(`[reconciler] Terminal unreachable for booking ${booking.id}, will retry next cycle`);
        continue;
      }

      if (!resolved) {
        const ageMs = Date.now() - booking.createdAt.getTime();
        if (ageMs > 5 * 60 * 1000) {
          await bookingsRepo.updateStatus(booking.id, "cancelled");
          console.info(`[reconciler] Booking ${booking.id} not found at terminal after ${Math.round(ageMs / 1000)}s → cancelled`);
        } else {
          console.info(`[reconciler] Booking ${booking.id} not found at terminal yet, will retry (age: ${Math.round(ageMs / 1000)}s)`);
        }
      }
    }
  }
}

async function retryFailedTerminalNotifications(): Promise<void> {
  let unnotified: Awaited<ReturnType<typeof bookingsRepo.findUnnotifiedConfirmedBookings>>;
  try {
    unnotified = await bookingsRepo.findUnnotifiedConfirmedBookings();
  } catch (e) {
    console.error("[reconciler] Failed to query unnotified bookings:", e);
    return;
  }

  if (unnotified.length === 0) return;
  console.info(`[reconciler] Retrying terminal notification for ${unnotified.length} confirmed booking(s)`);

  const { rows: operators } = await operatorsRepo.findAll({ active: true }, { limit: 100, offset: 0 });
  const operatorMap = new Map(operators.map((o) => [o.id, applyOperatorOverride(o)]));

  for (const booking of unnotified) {
    // Terminal hanya butuh providerRef untuk re-konfirmasi; paymentMethod tidak
    // dikirim karena Terminal tidak menyimpan/mengelola pilihan metode pembayaran.
    if (!booking.providerRef) continue;

    const operator = operatorMap.get(booking.operatorId);
    if (!operator) continue;

    let extId = booking.externalBookingId;

    if (!extId) {
      try {
        const colonIdx = booking.tripId.indexOf(":");
        const originalTripId = colonIdx !== -1 ? booking.tripId.slice(colonIdx + 1) : booking.tripId;
        const seatsParam = booking.seatNumbers.join(",");
        const findRes = await fetch(
          `${operator.apiUrl}/api/app/bookings/find-ota?tripId=${encodeURIComponent(originalTripId)}&seats=${encodeURIComponent(seatsParam)}`,
          {
            signal: AbortSignal.timeout(TERMINAL_TIMEOUT_MS),
            headers: { "X-Service-Key": operator.serviceKey },
          }
        );
        if (findRes.ok) {
          const item = await findRes.json() as Record<string, unknown>;
          extId = String(item["id"] ?? "");
          if (extId) {
            await bookingsRepo.setExternalBookingId(booking.id, extId);
            console.info(`[reconciler] Resolved externalBookingId for booking ${booking.id} → ${extId}`);
          }
        }
      } catch (err) {
        console.warn(`[reconciler] Failed to resolve externalBookingId for booking ${booking.id}:`, err instanceof Error ? err.message : err);
      }

      if (!extId) {
        console.warn(`[reconciler] Skipping booking ${booking.id}: no externalBookingId and could not resolve`);
        continue;
      }
    }

    try {
      const res = await fetch(
        `${operator.apiUrl}/api/app/bookings/${encodeURIComponent(extId)}/confirm-paid`,
        {
          method: "POST",
          signal: AbortSignal.timeout(TERMINAL_TIMEOUT_MS),
          headers: {
            "X-Service-Key": operator.serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            providerRef: booking.providerRef,
          }),
        }
      );

      if (res.ok) {
        await bookingsRepo.markTerminalNotified(booking.operatorId, extId);
        console.info(`[reconciler] Terminal notified for booking ${booking.id}`);
      } else if (res.status === 400) {
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
        const errMsg = String(errBody["error"] ?? "");
        if (errMsg.includes("already") || errMsg.includes("confirmed")) {
          await bookingsRepo.markTerminalNotified(booking.operatorId, extId);
          console.info(`[reconciler] Terminal already confirmed for booking ${booking.id}`);
        } else {
          console.warn(`[reconciler] Terminal rejected confirm for booking ${booking.id}: ${errMsg}`);
        }
      }
    } catch (err) {
      console.warn(
        `[reconciler] Retry notification failed for booking ${booking.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

export function startReconciler(): void {
  if (reconcilerTimer) return;

  setTimeout(() => {
    expireExpiredPendingBookings().catch(console.error);
    reconcileUncertainBookings().catch(console.error);
    retryFailedTerminalNotifications().catch(console.error);
  }, 15_000);

  reconcilerTimer = setInterval(() => {
    expireExpiredPendingBookings().catch(console.error);
    reconcileUncertainBookings().catch(console.error);
    retryFailedTerminalNotifications().catch(console.error);
  }, RECONCILE_INTERVAL_MS);

  console.info("[reconciler] Started — interval: 15s (expire pending + reconcile uncertain + retry notifications)");
}

export function stopReconciler(): void {
  if (reconcilerTimer) {
    clearInterval(reconcilerTimer);
    reconcilerTimer = null;
  }
}
