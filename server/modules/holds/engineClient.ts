// HTTP client for the Rust Reservation Engine sidecar.
//
// Spec: engine/docs/TRANSITY_TERMINAL_INTEGRATION.md §3 (HMAC) and §4 (client).
// Verified against engine/crates/engine-server/src/routes.rs (payload shapes)
// and engine/crates/engine-server/src/middleware/auth.rs (signing scheme).
//
// Signing: HMAC-SHA256 over `${ts}.${method}.${path}.${rawBody}`
//   ts          = unix seconds (Math.floor(Date.now()/1000))
//   method      = uppercase HTTP verb
//   path        = request path including leading slash, no host, no query
//   rawBody     = exact JSON string sent (or "" for GET/DELETE without body)
//
// Headers sent on every request:
//   X-Service-Id:       terminal
//   X-Signature:        <hex sha256>
//   X-Timestamp:        <ts>
//   Idempotency-Key:    <uuid>   (for POSTs only; engine caches 24h)
//   Content-Type:       application/json (only when body present)

import { createHash, createHmac, randomUUID } from "node:crypto";
import type {
  HoldRequest,
  HoldOk,
  ConfirmRequest,
  ConfirmOk,
  CancelSeatRequest,
  CancelSeatOk,
  InventorySnapshot,
  EngineErrorBody,
  EngineErrorCode,
} from "./engineClient.types";

const ENGINE_BASE_URL =
  process.env.RESERVATION_ENGINE_URL?.replace(/\/+$/, "") ??
  "http://engine:8000";

function getSecret(): string {
  const s = process.env.RESERVATION_ENGINE_HMAC_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "RESERVATION_ENGINE_HMAC_SECRET must be set (>=16 chars) when " +
        "RESERVATION_ENGINE_ENABLED=true",
    );
  }
  return s;
}

export class EngineError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: EngineErrorCode,
    message: string,
    public readonly details?: EngineErrorBody,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

function sign(ts: number, method: string, path: string, rawBody: string): string {
  const secret = getSecret();
  const bodySha = createHash("sha256").update(rawBody).digest("hex");
  const h = createHmac("sha256", secret);
  h.update(`${ts}.${method.toUpperCase()}.${path}.${bodySha}`);
  return h.digest("hex");
}

async function call<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  idemKey?: string,
): Promise<T> {
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const sig = sign(ts, method, path, rawBody);

  const headers: Record<string, string> = {
    "X-Signature": sig,
    "X-Timestamp": String(ts),
    "X-Service-Id": process.env.RESERVATION_ENGINE_SERVICE_ID ?? "terminal",
  };
  if (rawBody.length > 0) headers["Content-Type"] = "application/json";
  if (method === "POST") {
    headers["Idempotency-Key"] = idemKey ?? randomUUID();
  }

  const url = `${ENGINE_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: rawBody.length > 0 ? rawBody : undefined,
    });
  } catch (e) {
    throw new EngineError(0, "INTERNAL", `Engine unreachable at ${url}: ${(e as Error).message}`);
  }

  // 204 No Content — release/delete success path
  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // non-JSON error body; keep as text below
    }
  }

  if (res.ok) {
    return (parsed as T) ?? (undefined as unknown as T);
  }

  const body409 = (parsed as EngineErrorBody) ?? {};
  const code = (body409.reason as EngineErrorCode) ?? "UNKNOWN";
  const msg = body409.message ?? text ?? `Engine ${res.status}`;
  throw new EngineError(res.status, code, msg, body409);
}

export const engineClient = {
  /** §3.1 — atomic seat hold. 201 on success, 409 SEAT_CONFLICT, 422 INCOMPLETE_INVENTORY. */
  hold: (req: HoldRequest, idemKey?: string) =>
    call<HoldOk>("POST", "/api/v1/holds", req, idemKey),

  /** §3.2 — release a hold by ref. 204 on success, 404 if already gone. */
  release: (holdRef: string) =>
    call<void>("DELETE", `/api/v1/holds/${encodeURIComponent(holdRef)}`),

  /** §3.3 — confirm hold → booking. Sets booked=true, links booking_id.
   *
   * Engine v1.1 returns HTTP 409 on failure (hold expired or already
   * consumed) so the base `call()` helper throws naturally. Engine v1.0
   * returned HTTP 200 with `{success:false, conflict: "..."}` — silently
   * accepting that would produce a ghost booking (see
   * `TransityTerminal-code-review.md §10.1`), so we defensively inspect
   * the body here and raise an `EngineError(409, ...)` to match the
   * v1.1 behavior regardless of which engine version is deployed.
   */
  confirm: async (holdRef: string, body: ConfirmRequest, idemKey?: string): Promise<ConfirmOk> => {
    const res = await call<Record<string, unknown>>(
      "POST",
      `/api/v1/holds/${encodeURIComponent(holdRef)}/confirm`,
      body,
      idemKey,
    );
    if (res && res.success === false) {
      const reason =
        (typeof res.reason === "string" && res.reason) ||
        (typeof res.conflict === "string" && res.conflict) ||
        "HOLD_EXPIRED_OR_MISSING";
      throw new EngineError(
        409,
        reason as EngineErrorCode,
        `Engine confirm returned success=false (reason=${reason})`,
        res as EngineErrorBody,
      );
    }
    // Engine v1.1 success path returns `{success: true, hold_ref, booking_id}`;
    // engine v1.0 returned `{confirmed: true, seat_no, leg_indexes}`.
    // Callers don't depend on the shape (they only care that no throw
    // happened), so we cast to the typed ConfirmOk for the legacy clients
    // that do.
    return res as unknown as ConfirmOk;
  },

  /** §3.4 — cancel ONE booked seat. Per-seat (not batched). */
  cancelSeats: (req: CancelSeatRequest, idemKey?: string) =>
    call<CancelSeatOk>("POST", "/api/v1/cancel-seats", req, idemKey),

  /** §3.5 — read-only inventory snapshot for a trip. */
  inventory: (tripId: string) =>
    call<InventorySnapshot>("GET", `/api/v1/inventory/${encodeURIComponent(tripId)}`),

  /** Liveness probe. */
  health: () => call<{ service: string; status: string }>("GET", "/api/v1/healthz"),
};
