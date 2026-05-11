#!/usr/bin/env bash
# engine-smoke-test.sh — post-deploy reservation-engine sanity check.
# S2-10: aligned dengan engineClient.ts (HMAC headers + path).
#
# Hits the live engine sidecar end-to-end: hold → confirm → cancel-seats.
# Exits non-zero on any failure so it can be wired into a deploy gate.
#
# Required env:
#   ENGINE_BASE_URL    e.g. http://127.0.0.1:8000
#   RESERVATION_ENGINE_HMAC_SECRET (>=16 chars; same as engine config)
#   TRIP_ID            an existing trip uuid in this operator's DB
#   SEAT_NO            a real seat label for that trip (e.g. "1A")
#   OPERATOR_ID        the operator uuid this engine is bound to
#
# Optional env:
#   LEG_INDEXES        comma-separated leg indexes (default: "0")
#   SERVICE_ID         X-Service-Id header (default: "terminal")
#
# Usage:
#   ENGINE_BASE_URL=http://127.0.0.1:8000 \
#   RESERVATION_ENGINE_HMAC_SECRET=... \
#   TRIP_ID=... SEAT_NO=1A OPERATOR_ID=... \
#   ./scripts/engine-smoke-test.sh

set -euo pipefail

: "${ENGINE_BASE_URL:?must be set}"
: "${RESERVATION_ENGINE_HMAC_SECRET:?must be set}"
: "${TRIP_ID:?must be set}"
: "${SEAT_NO:?must be set}"
: "${OPERATOR_ID:?must be set}"
LEG_INDEXES="${LEG_INDEXES:-0}"
SERVICE_ID="${SERVICE_ID:-terminal}"

if [ "${#RESERVATION_ENGINE_HMAC_SECRET}" -lt 16 ]; then
  echo "[smoke] FAIL: RESERVATION_ENGINE_HMAC_SECRET harus >= 16 karakter" >&2
  exit 2
fi

# Build legIndexes JSON array dari env comma-separated.
legs_json=$(python3 -c "import json,os;print(json.dumps([int(x) for x in os.environ['LEG_INDEXES'].split(',') if x.strip()]))")

# HMAC scheme harus IDENTIK dengan engineClient.ts:
#   payload = "<ts>.<METHOD>.<path>.<sha256(rawBody) HEX>"
# Header: X-Signature, X-Timestamp, X-Service-Id, Idempotency-Key (POST).
sign_and_call() {
  local method="$1" path="$2" body="${3:-}"
  local ts; ts=$(date +%s)
  local body_sha
  body_sha=$(printf '%s' "$body" | openssl dgst -sha256 -binary | xxd -p -c 256)
  local payload="${ts}.${method}.${path}.${body_sha}"
  local sig
  sig=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$RESERVATION_ENGINE_HMAC_SECRET" -binary | xxd -p -c 256)
  local args=(-sS -X "$method" "${ENGINE_BASE_URL}${path}"
              -H "X-Signature: $sig"
              -H "X-Timestamp: $ts"
              -H "X-Service-Id: $SERVICE_ID"
              --fail-with-body)
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi
  if [ "$method" = "POST" ]; then
    local idem; idem=$(python3 -c "import uuid;print(uuid.uuid4())")
    args+=(-H "Idempotency-Key: $idem")
  fi
  curl "${args[@]}"
}

echo "[smoke] 0/4 HEALTHZ"
health=$(sign_and_call GET /api/v1/healthz "")
echo "[smoke] healthz: $health"

echo "[smoke] 1/4 HOLD trip=$TRIP_ID seat=$SEAT_NO"
hold_body=$(jq -nc --arg t "$TRIP_ID" --arg s "$SEAT_NO" --arg o "$OPERATOR_ID" \
  --argjson legs "$legs_json" \
  '{trip_id:$t, seat_no:$s, leg_indexes:$legs, operator_id:$o, ttl_class:"ota"}')
hold_resp=$(sign_and_call POST /api/v1/holds "$hold_body")
hold_ref=$(printf '%s' "$hold_resp" | jq -r '.hold_ref')
if [ -z "$hold_ref" ] || [ "$hold_ref" = "null" ]; then
  echo "[smoke] FAIL: hold_ref kosong, response: $hold_resp" >&2
  exit 3
fi
echo "[smoke] hold_ref=$hold_ref"

booking_id=$(python3 -c "import uuid;print(uuid.uuid4())")
echo "[smoke] 2/4 CONFIRM booking_id=$booking_id"
confirm_body=$(jq -nc --arg b "$booking_id" '{booking_id:$b}')
sign_and_call POST "/api/v1/holds/$hold_ref/confirm" "$confirm_body" >/dev/null
echo "[smoke] confirm OK"

echo "[smoke] 3/4 CANCEL-SEATS"
cancel_body=$(jq -nc --arg t "$TRIP_ID" --arg s "$SEAT_NO" --argjson legs "$legs_json" \
  '{trip_id:$t, seat_no:$s, leg_indexes:$legs}')
sign_and_call POST /api/v1/cancel-seats "$cancel_body" >/dev/null
echo "[smoke] cancel-seats OK"

echo "[smoke] 4/4 INVENTORY"
sign_and_call GET "/api/v1/inventory/$TRIP_ID" "" >/dev/null
echo "[smoke] inventory OK"

echo "[smoke] PASS"
