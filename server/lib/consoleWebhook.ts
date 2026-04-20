import crypto from "crypto";

export type ChannelFlags = { CSO?: boolean; WEB?: boolean; APP?: boolean; OTA?: boolean };

export type SchedulePayloadTrip = {
  externalTripId: string;
  externalBaseId: string | null;
  routeName: string;
  originCity: string;
  originStop: string | null;
  destinationCity: string;
  destinationStop: string | null;
  serviceDate: string;
  departureTime: string | null;
  arrivalTime: string | null;
  vehicleClass: string | null;
  farePerPerson: number;
  capacity: number;
  availableSeats: number;
  channels: Array<"ota" | "app">;
  status: "active" | "cancelled" | "sold_out" | "draft";
  raw?: Record<string, unknown>;
};

export type WebhookEvent =
  | "schedule.created"
  | "schedule.updated"
  | "schedule.deleted"
  | "schedule.snapshot";

export type WebhookSinglePayload = {
  event: Exclude<WebhookEvent, "schedule.snapshot">;
  trip: SchedulePayloadTrip;
  emittedAt: string;
};

export type WebhookSnapshotPayload = {
  event: "schedule.snapshot";
  trips: SchedulePayloadTrip[];
  emittedAt: string;
};

export type WebhookPayload = WebhookSinglePayload | WebhookSnapshotPayload;

function sign(rawBody: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function deriveChannels(flags: ChannelFlags | null | undefined): Array<"ota" | "app"> {
  const out: Array<"ota" | "app"> = [];
  if (flags?.OTA) out.push("ota");
  if (flags?.APP) out.push("app");
  return out;
}

export function mapTripStatus(
  s: string | null | undefined
): "active" | "cancelled" | "sold_out" | "draft" {
  switch (s) {
    case "cancelled":
      return "cancelled";
    case "closed":
      return "sold_out";
    case "scheduled":
      return "active";
    default:
      return "active";
  }
}

export type EmitResult =
  | { ok: true }
  | { ok: false; reason: "skip" }
  | { ok: false; reason: "transport"; error: string }
  | { ok: false; reason: "http"; status: number; body: string };

// ---------------------------------------------------------------------------
// Health tracking — records the most recent success/failure so operators can
// see if Terminal is actually reaching Console without tailing server logs.
// ---------------------------------------------------------------------------

type HealthError =
  | { reason: "transport"; error: string }
  | { reason: "http"; status: number; body: string };

type HealthState = {
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  lastSuccessEvent: WebhookEvent | null;
  lastErrorAt: number | null;
  lastError: (HealthError & { event: WebhookEvent }) | null;
  consecutiveFailures: number;
};

const health: HealthState = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastSuccessEvent: null,
  lastErrorAt: null,
  lastError: null,
  consecutiveFailures: 0,
};

function recordResult(payload: WebhookPayload, result: EmitResult): void {
  if (!result.ok && result.reason === "skip") return;
  const now = Date.now();
  health.lastAttemptAt = now;
  if (result.ok) {
    health.lastSuccessAt = now;
    health.lastSuccessEvent = payload.event;
    health.consecutiveFailures = 0;
    return;
  }
  health.lastErrorAt = now;
  health.consecutiveFailures += 1;
  if (result.reason === "transport") {
    health.lastError = { event: payload.event, reason: "transport", error: result.error };
  } else if (result.reason === "http") {
    health.lastError = {
      event: payload.event,
      reason: "http",
      status: result.status,
      body: result.body,
    };
  }
}

export type ConsoleHealth = {
  configured: boolean;
  missing: string[];
  url: string | null;
  operatorSlug: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastSuccessEvent: WebhookEvent | null;
  lastErrorAt: string | null;
  lastError:
    | { event: WebhookEvent; reason: "transport"; error: string }
    | { event: WebhookEvent; reason: "http"; status: number; body: string }
    | null;
  consecutiveFailures: number;
  retryQueueSize: number;
};

export function getConsoleHealth(): ConsoleHealth {
  const url = process.env.CONSOLE_URL ?? null;
  const slug = process.env.CONSOLE_OPERATOR_SLUG ?? null;
  const secret = process.env.CONSOLE_WEBHOOK_SECRET ?? null;
  const missing: string[] = [];
  if (!url) missing.push("CONSOLE_URL");
  if (!slug) missing.push("CONSOLE_OPERATOR_SLUG");
  if (!secret) missing.push("CONSOLE_WEBHOOK_SECRET");
  return {
    configured: missing.length === 0,
    missing,
    url,
    operatorSlug: slug,
    lastAttemptAt: health.lastAttemptAt ? new Date(health.lastAttemptAt).toISOString() : null,
    lastSuccessAt: health.lastSuccessAt ? new Date(health.lastSuccessAt).toISOString() : null,
    lastSuccessEvent: health.lastSuccessEvent,
    lastErrorAt: health.lastErrorAt ? new Date(health.lastErrorAt).toISOString() : null,
    lastError: health.lastError,
    consecutiveFailures: health.consecutiveFailures,
    retryQueueSize: queue.size,
  };
}

export async function emitToConsole(payload: WebhookPayload): Promise<EmitResult> {
  const url = process.env.CONSOLE_URL;
  const slug = process.env.CONSOLE_OPERATOR_SLUG;
  const secret = process.env.CONSOLE_WEBHOOK_SECRET;

  if (!url || !slug || !secret) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[consoleWebhook] skip — missing CONSOLE_URL/CONSOLE_OPERATOR_SLUG/CONSOLE_WEBHOOK_SECRET"
      );
    }
    return { ok: false, reason: "skip" };
  }

  if (payload.event !== "schedule.snapshot" && payload.event !== "schedule.deleted") {
    if (payload.trip.channels.length === 0) {
      return { ok: true };
    }
  }
  if (payload.event === "schedule.snapshot") {
    payload = { ...payload, trips: payload.trips.filter((t) => t.channels.length > 0) };
    if (payload.trips.length === 0) return { ok: true };
  }

  const body = JSON.stringify(payload);
  const signature = sign(body, secret);
  const endpoint = `${url.replace(/\/$/, "")}/api/webhooks/operators/${slug}/schedules`;

  let result: EmitResult;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Transity-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[consoleWebhook] ${payload.event} ${res.status}: ${text.slice(0, 200)}`
      );
      result = { ok: false, reason: "http", status: res.status, body: text.slice(0, 200) };
    } else {
      result = { ok: true };
    }
  } catch (err) {
    const message = (err as Error).message;
    console.warn(`[consoleWebhook] ${payload.event} failed:`, message);
    result = { ok: false, reason: "transport", error: message };
  }
  recordResult(payload, result);
  return result;
}

// ---------------------------------------------------------------------------
// Retry queue with exponential backoff
//
// When emitToConsole fails because the Console is unreachable (transport error
// or 5xx response), the payload is parked in an in-memory queue and retried
// with exponential backoff. Single-trip events for the same trip coalesce so
// the queue doesn't grow without bound for a noisy trip during a long outage.
// 4xx responses (other than 408/429) are treated as terminal — Console rejected
// the payload and retrying won't help.
// ---------------------------------------------------------------------------

type QueuedItem = {
  id: string;
  payload: WebhookPayload;
  attempt: number;
  nextAttemptAt: number;
};

const RETRY_BACKOFF_MS = [
  5_000, // 5s
  15_000, // 15s
  60_000, // 1m
  5 * 60_000, // 5m
  15 * 60_000, // 15m
  30 * 60_000, // 30m
  60 * 60_000, // 1h
];
const MAX_QUEUE_SIZE = 500;

const queue = new Map<string, QueuedItem>();
let timer: NodeJS.Timeout | null = null;
let timerFiresAt: number | null = null;
let draining = false;

function payloadKey(payload: WebhookPayload): string {
  if (payload.event === "schedule.snapshot") {
    // Snapshots are coalesced by service date span — for a single date the
    // newest snapshot supersedes any pending one. Fallback to emittedAt to
    // avoid collisions when the snapshot is empty.
    const dates = payload.trips
      .map((t) => t.serviceDate)
      .filter(Boolean)
      .sort();
    const span = dates.length > 0 ? `${dates[0]}..${dates[dates.length - 1]}` : payload.emittedAt;
    return `snapshot:${span}`;
  }
  return `${payload.event}:${payload.trip.externalTripId}`;
}

function isRetryable(result: EmitResult): boolean {
  if (result.ok) return false;
  if (result.reason === "skip") return false;
  if (result.reason === "transport") return true;
  // HTTP: retry 408, 429 and anything 5xx
  if (result.reason === "http") {
    return result.status === 408 || result.status === 429 || result.status >= 500;
  }
  return false;
}

function scheduleNextDrain(): void {
  if (queue.size === 0) return;
  const now = Date.now();
  let earliest = Infinity;
  for (const item of queue.values()) {
    if (item.nextAttemptAt < earliest) earliest = item.nextAttemptAt;
  }
  if (!Number.isFinite(earliest)) return;
  // If a timer is already armed but the new earliest deadline is sooner,
  // re-arm so freshly-queued items don't wait behind a stale long timer.
  if (timer && timerFiresAt !== null && earliest >= timerFiresAt) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const delay = Math.max(0, earliest - now);
  timerFiresAt = now + delay;
  timer = setTimeout(() => {
    timer = null;
    timerFiresAt = null;
    void drain();
  }, delay);
  // Don't keep the event loop alive just for retries.
  if (typeof timer.unref === "function") timer.unref();
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const now = Date.now();
    const due: QueuedItem[] = [];
    for (const item of queue.values()) {
      if (item.nextAttemptAt <= now) due.push(item);
    }
    for (const item of due) {
      // The queued item may have been replaced by a newer one with the same
      // key while we were iterating; honor whatever is currently in the queue.
      const current = queue.get(item.id);
      if (!current) continue;
      const result = await emitToConsole(current.payload);
      if (result.ok) {
        // Only delete if nothing newer slipped in for this key.
        if (queue.get(current.id) === current) queue.delete(current.id);
        continue;
      }
      if (!isRetryable(result)) {
        if (queue.get(current.id) === current) queue.delete(current.id);
        continue;
      }
      const nextAttempt = current.attempt + 1;
      if (nextAttempt > RETRY_BACKOFF_MS.length) {
        console.warn(
          `[consoleWebhook] giving up on ${current.payload.event} after ${current.attempt} attempts`
        );
        if (queue.get(current.id) === current) queue.delete(current.id);
        continue;
      }
      const backoff = RETRY_BACKOFF_MS[nextAttempt - 1];
      const updated: QueuedItem = {
        ...current,
        attempt: nextAttempt,
        nextAttemptAt: Date.now() + backoff,
      };
      queue.set(current.id, updated);
    }
  } finally {
    draining = false;
    scheduleNextDrain();
  }
}

function enqueue(payload: WebhookPayload): void {
  // Drop the oldest item if we're at capacity to preserve newer events.
  if (queue.size >= MAX_QUEUE_SIZE) {
    const firstKey = queue.keys().next().value as string | undefined;
    if (firstKey) queue.delete(firstKey);
    console.warn(`[consoleWebhook] retry queue full (${MAX_QUEUE_SIZE}); dropped oldest item`);
  }
  const id = payloadKey(payload);
  // Always replace existing entry for this key so we send the freshest state.
  const item: QueuedItem = {
    id,
    payload,
    attempt: 1,
    nextAttemptAt: Date.now() + RETRY_BACKOFF_MS[0],
  };
  queue.set(id, item);
  scheduleNextDrain();
}

export function fireAndForget(payload: WebhookPayload): void {
  void (async () => {
    const result = await emitToConsole(payload);
    if (!result.ok && isRetryable(result)) {
      enqueue(payload);
    }
  })();
}

// Sends a synthetic schedule.updated payload that operators (and Console)
// can recognise as a connection probe. We bypass the channel filter inside
// emitToConsole by tagging the trip with the "app" channel, but the
// externalTripId starts with "test:connection" so Console-side handlers can
// drop or ignore it.
export async function sendTestEvent(): Promise<EmitResult> {
  const now = new Date();
  const payload: WebhookSinglePayload = {
    event: "schedule.updated",
    emittedAt: now.toISOString(),
    trip: {
      externalTripId: `test:connection:${now.getTime()}`,
      externalBaseId: null,
      routeName: "Terminal Connection Test",
      originCity: "Terminal",
      originStop: null,
      destinationCity: "Console",
      destinationStop: null,
      serviceDate: now.toISOString().slice(0, 10),
      departureTime: null,
      arrivalTime: null,
      vehicleClass: null,
      farePerPerson: 0,
      capacity: 0,
      availableSeats: 0,
      channels: ["app"],
      status: "draft",
      raw: { test: true },
    },
  };
  return emitToConsole(payload);
}

// Test/diagnostic helpers
export function _retryQueueSize(): number {
  return queue.size;
}

export function _clearRetryQueue(): void {
  queue.clear();
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  timerFiresAt = null;
}
