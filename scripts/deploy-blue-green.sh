#!/usr/bin/env bash
# S3-09: blue/green deploy script untuk TransityTerminal.
#
# Asumsi setup:
#   - 2 systemd unit: transity-blue.service (port 5000), transity-green.service (port 5001)
#   - nginx upstream `transity_app` punya 2 server (lihat docs/terminal-readiness/RUNBOOK-BLUE-GREEN.md)
#   - File state /etc/transity/active.color berisi 'blue' atau 'green'
#   - DB connection sama di kedua color (single DB)
#   - RUN_MIGRATIONS_ON_BOOT=false di kedua unit (migrasi via scripts/db-migrate.ts)
#
# Flow:
#   1. Baca color aktif (current).
#   2. Jalankan migrasi DB (scripts/db-migrate.ts) — exit kalau gagal.
#   3. Restart unit IDLE (next color) — bring up dengan code baru.
#   4. Tunggu /api/health di port idle return 200.
#   5. Switch nginx upstream (atomic: ganti symlink + reload).
#   6. Drain old (sleep 10s) lalu stop unit lama.
#   7. Update /etc/transity/active.color.

set -euo pipefail

LOG() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }
FAIL() { echo "[deploy FAIL] $*" >&2; exit 1; }

REPO_ROOT="${REPO_ROOT:-/opt/transity-terminal}"
ACTIVE_FILE="${ACTIVE_FILE:-/etc/transity/active.color}"
NGINX_UPSTREAM_DIR="${NGINX_UPSTREAM_DIR:-/etc/nginx/upstreams}"
NGINX_LIVE_LINK="$NGINX_UPSTREAM_DIR/transity-app.conf"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-60}"
DRAIN_SEC="${DRAIN_SEC:-10}"

# 1. Baca color aktif
[[ -f "$ACTIVE_FILE" ]] || FAIL "Active color file tidak ada: $ACTIVE_FILE"
CURRENT="$(cat "$ACTIVE_FILE" | tr -d '[:space:]')"
case "$CURRENT" in
  blue)  IDLE=green; IDLE_PORT=5001 ;;
  green) IDLE=blue;  IDLE_PORT=5000 ;;
  *)     FAIL "Active color tidak valid: '$CURRENT' (harus blue/green)" ;;
esac
LOG "Current=$CURRENT, deploying to IDLE=$IDLE (port $IDLE_PORT)"

# 2. Migrasi DB (idempotent, aman dijalankan tiap deploy)
LOG "Step 1/5 — db migrate"
cd "$REPO_ROOT"
pnpm tsx scripts/db-migrate.ts || FAIL "DB migrate gagal — STOP deploy"

# 3. Bring up unit idle dengan code baru
LOG "Step 2/5 — restart transity-${IDLE}.service"
systemctl restart "transity-${IDLE}.service"

# 4. Health check loop
LOG "Step 3/5 — wait health on port $IDLE_PORT (timeout ${HEALTH_TIMEOUT_SEC}s)"
DEADLINE=$(( $(date +%s) + HEALTH_TIMEOUT_SEC ))
while true; do
  if curl -fsS -m 3 "http://127.0.0.1:${IDLE_PORT}/api/health/clock" >/dev/null 2>&1; then
    LOG "  health OK on port $IDLE_PORT"
    break
  fi
  if (( $(date +%s) >= DEADLINE )); then
    LOG "  health FAIL after ${HEALTH_TIMEOUT_SEC}s — rolling back"
    systemctl stop "transity-${IDLE}.service" || true
    FAIL "Idle health check gagal — node lama tetap melayani trafik"
  fi
  sleep 2
done

# 5. Switch nginx upstream (atomic via symlink ganti)
LOG "Step 4/5 — switch nginx upstream → ${IDLE}"
[[ -f "${NGINX_UPSTREAM_DIR}/transity-${IDLE}.conf" ]] || \
  FAIL "Upstream conf untuk $IDLE tidak ada: ${NGINX_UPSTREAM_DIR}/transity-${IDLE}.conf"
ln -sfn "${NGINX_UPSTREAM_DIR}/transity-${IDLE}.conf" "$NGINX_LIVE_LINK"
nginx -t || FAIL "nginx config test gagal — STOP (symlink di-rollback manual)"
nginx -s reload || FAIL "nginx reload gagal"

# 6. Drain & stop lama
LOG "Step 5/5 — drain ${DRAIN_SEC}s lalu stop ${CURRENT}"
sleep "$DRAIN_SEC"
systemctl stop "transity-${CURRENT}.service" || LOG "  warn: stop ${CURRENT} gagal (mungkin sudah mati)"

# 7. Update active state
echo "$IDLE" > "$ACTIVE_FILE"
LOG "DEPLOY OK — active=$IDLE (port $IDLE_PORT)"
