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

export async function emitToConsole(payload: WebhookPayload): Promise<void> {
  const url = process.env.CONSOLE_URL;
  const slug = process.env.CONSOLE_OPERATOR_SLUG;
  const secret = process.env.CONSOLE_WEBHOOK_SECRET;

  if (!url || !slug || !secret) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[consoleWebhook] skip — missing CONSOLE_URL/CONSOLE_OPERATOR_SLUG/CONSOLE_WEBHOOK_SECRET"
      );
    }
    return;
  }

  if (payload.event !== "schedule.snapshot" && payload.event !== "schedule.deleted") {
    if (payload.trip.channels.length === 0) {
      return;
    }
  }
  if (payload.event === "schedule.snapshot") {
    payload = { ...payload, trips: payload.trips.filter((t) => t.channels.length > 0) };
    if (payload.trips.length === 0) return;
  }

  const body = JSON.stringify(payload);
  const signature = sign(body, secret);
  const endpoint = `${url.replace(/\/$/, "")}/api/webhooks/operators/${slug}/schedules`;

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
    }
  } catch (err) {
    console.warn(`[consoleWebhook] ${payload.event} failed:`, (err as Error).message);
  }
}

export function fireAndForget(payload: WebhookPayload): void {
  void emitToConsole(payload);
}
