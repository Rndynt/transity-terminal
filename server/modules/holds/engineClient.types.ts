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

export type EngineErrorCode =
  | "SEAT_CONFLICT"
  | "INCOMPLETE_INVENTORY"
  | "HOLD_NOT_FOUND"
  | "HOLD_EXPIRED"
  | "BOOKING_NOT_FOUND"
  | "INVALID_SIGNATURE"
  | "INTERNAL"
  | "UNKNOWN";

export interface EngineErrorBody {
  reason?: EngineErrorCode | string;
  conflict_seats?: string[];
  message?: string;
  [k: string]: unknown;
}
