#!/usr/bin/env bash
# engine-smoke-test.sh — post-deploy reservation-engine sanity check.
#
# Hits the live engine sidecar end-to-end: hold → confirm → cancel-seats.
# Exits non-zero on any failure so it can be wired into a deploy gate.
#
# Required env:
#   ENGINE_BASE_URL    e.g. http://127.0.0.1:8000
#   ENGINE_HMAC_SECRET shared with the engine config
#   TRIP_ID            an existing trip uuid in this operator's DB
#   SEAT_NO            a real seat label for that trip (e.g. "1A")
#   OPERATOR_ID        the operator uuid this engine is bound to
#
# Optional env:
#   LEG_INDEXES        comma-separated leg indexes (default: "0")

set -euo pipefail

: "${ENGINE_BASE_URL:?must be set}"
: "${ENGINE_HMAC_SECRET:?must be set}"
: "${TRIP_ID:?must be set}"
: "${SEAT_NO:?must be set}"
: "${OPERATOR_ID:?must be set}"
LEG_INDEXES="${LEG_INDEXES:-0}"

# Build legIndexes JSON array from comma-separated env.
legs_json=$(python3 -c "import json,os,sys; print(json.dumps([int(x) for x in os.environ['LEG_INDEXES'].split(',') if x.strip()]))")

sign_and_call() {
  local method="$1" path="$2" body="$3"
  local ts; ts=$(date +%s)
  # Engine HMAC contract: HMAC-SHA256 over "<ts>.<method>.<path>.<body>"
  local sig
  sig=$(printf '%s.%s.%s.%s' "$ts" "$method" "$path" "$body" \
        | openssl dgst -sha256 -hmac "$ENGINE_HMAC_SECRET" -binary \
        | xxd -p -c 256)
  curl -sS -X "$method" "${ENGINE_BASE_URL}${path}" \
       -H "Content-Type: application/json" \
       -H "X-Engine-Timestamp: $ts" \
       -H "X-Engine-Signature: $sig" \
       --fail-with-body \
       --data "$body"
}

echo "[smoke] HOLD trip=$TRIP_ID seat=$SEAT_NO"
hold_body=$(jq -nc --arg t "$TRIP_ID" --arg s "$SEAT_NO" --arg o "$OPERATOR_ID" \
  --argjson legs "$legs_json" \
  '{trip_id:$t, seat_no:$s, leg_indexes:$legs, operator_id:$o, ttl_class:"ota"}')
hold_resp=$(sign_and_call POST /v1/holds "$hold_body")
hold_ref=$(printf '%s' "$hold_resp" | jq -r '.hold_ref')
echo "[smoke] hold_ref=$hold_ref"

booking_id=$(python3 -c "import uuid;print(uuid.uuid4())")
echo "[smoke] CONFIRM booking_id=$booking_id"
confirm_body=$(jq -nc --arg b "$booking_id" '{booking_id:$b}')
sign_and_call POST "/v1/holds/$hold_ref/confirm" "$confirm_body" >/dev/null
echo "[smoke] confirm OK"

echo "[smoke] CANCEL-SEATS"
cancel_body=$(jq -nc --arg t "$TRIP_ID" --arg s "$SEAT_NO" --argjson legs "$legs_json" \
  '{trip_id:$t, seat_no:$s, leg_indexes:$legs}')
sign_and_call POST /v1/seats/cancel "$cancel_body" >/dev/null
echo "[smoke] cancel-seats OK"

echo "[smoke] PASS"
