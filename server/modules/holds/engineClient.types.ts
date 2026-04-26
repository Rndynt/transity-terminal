// Reservation Engine HTTP client types.
// Mirrors engine/crates/engine-server/src/routes.rs request/response shapes.
// Do not import from this file outside the holds module.

export type TtlClass = "short" | "long";

export interface HoldRequest {
  trip_id: string;
  seat_no: string;
  leg_indexes: number[];
  operator_id: string;
  ttl_class: TtlClass;
}

export interface HoldOk {
  hold_ref: string;     // lowercase UUID
  expires_at: string;   // ISO-8601 UTC
}

export interface ConfirmRequest {
  booking_id: string;
}

export interface ConfirmOk {
  confirmed: true;
  seat_no: string;
  leg_indexes: number[];
}

export interface CancelSeatRequest {
  trip_id: string;
  seat_no: string;
  leg_indexes: number[];
}

export interface CancelSeatOk {
  success: boolean;
}

export interface InventorySnapshot {
  trip_id: string;
  seats: Array<{
    seat_no: string;
    leg_index: number;
    booked: boolean;
    hold_ref: string | null;
  }>;
}

// §10.5 parity: bentuk error body engine sekarang seragam ke
// `{ success: false, reason, message, details? }` (engine PR #4).
// EngineErrorCode di-sync dengan engine/crates/engine-server/src/error.rs
// dan engine/crates/engine-core/src/error.rs.
export type EngineErrorCode =
  | "SEAT_CONFLICT"
  | "INCOMPLETE_INVENTORY"
  | "HOLD_NOT_FOUND"
  | "HOLD_EXPIRED"
  | "HOLD_EXPIRED_OR_MISSING"
  | "HOLD_ALREADY_CONSUMED"
  | "BOOKING_NOT_FOUND"
  | "INVALID_SIGNATURE"
  | "INTERNAL"
  | "UNKNOWN";

// §10.5: standard error body fields. `success` di-include karena engine
// confirm endpoint masih return 200 dengan {success:false} di legacy
// path (engine v1.0); engineClient.confirm inspect field ini sebelum
// route ke EngineError(409).
export interface EngineErrorBody {
  success?: boolean;
  reason?: EngineErrorCode | string;
  message?: string;
  details?: Record<string, unknown>;
  conflict_seats?: string[];
  conflict?: string;
  [k: string]: unknown;
}
