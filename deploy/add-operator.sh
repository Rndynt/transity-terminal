#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Bootstrap operator Terminal baru (whitelabel)
#
# Yang whitelabel HANYA Terminal. App & Console di-share (1 instance
# untuk semua operator), jadi script ini tidak menyentuh App/Console.
#
# Usage:
#   bash deploy/add-operator.sh <slug> <domain-base> <terminal-port>
# Contoh:
#   bash deploy/add-operator.sh nusa     transity.web.id 5000
#   bash deploy/add-operator.sh buskita  transity.web.id 5010
#   bash deploy/add-operator.sh trans    transity.web.id 5020
#   bash deploy/add-operator.sh prima    transity.web.id 5030
#   bash deploy/add-operator.sh cepat    transity.web.id 5040
#
# Yang dilakukan:
#   1. Clone Terminal repo ke /opt/<slug>-terminal
#   2. Generate .env template (wajib edit DATABASE_URL setelahnya)
#   3. Generate Nginx vhost ke /etc/nginx/conf.d/terminal-<slug>.conf
#
# Yang TIDAK dilakukan otomatis (manual):
#   - Edit .env (DATABASE_URL operator, REALMIO_TENANT_ID)
#   - Buat database Postgres baru
#   - Insert row operator di Console DB (tenant_id, service_key, api_url)
#   - Daftar tenant baru di Realmio
#   - Generate SSL cert (certbot)
#   - docker compose build & up
# ─────────────────────────────────────────────────────────────
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <slug> <domain-base> <terminal-port>"
  echo "Example: $0 nusa transity.web.id 5000"
  exit 1
fi

SLUG="$1"
DOMAIN="$2"
TERMINAL_PORT="$3"

TERMINAL_DIR="/opt/${SLUG}-terminal"
NGINX_CONF="/etc/nginx/conf.d/terminal-${SLUG}.conf"

TERMINAL_REPO="${TERMINAL_REPO_URL:-git@github.com:your-org/TransityTerminal.git}"

echo "==> Operator Terminal: ${SLUG}"
echo "    Domain  : terminal-${SLUG}.${DOMAIN}"
echo "    Port    : 127.0.0.1:${TERMINAL_PORT}"
echo "    Dir     : ${TERMINAL_DIR}"
echo

# 1. Clone repo
if [ ! -d "$TERMINAL_DIR" ]; then
  echo "==> Cloning Terminal → $TERMINAL_DIR"
  git clone "$TERMINAL_REPO" "$TERMINAL_DIR"
else
  echo "==> $TERMINAL_DIR sudah ada, skip clone"
fi

# 2. Generate .env
SERVICE_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -base64 32)

cat > "${TERMINAL_DIR}/.env" <<EOF
# Auto-generated for operator: ${SLUG}
# WAJIB diedit: DATABASE_URL, REALMIO_TENANT_ID
NODE_ENV=production
PORT=5000
OPERATOR_SLUG=${SLUG}
TERMINAL_PORT=${TERMINAL_PORT}

# TODO: ganti dengan DB asli operator ini
DATABASE_URL=postgresql://USER:PASS@HOST/${SLUG}_terminal?sslmode=require

REALMIO_BASE_URL=https://transity.realmio.web.id
REALMIO_TENANT_ID=${SLUG}-shuttle

JWT_SECRET=${JWT_SECRET}
TERMINAL_SERVICE_KEY=${SERVICE_KEY}

# CORS: domain Terminal sendiri + Console (yang akan call dengan service key)
CORS_ORIGINS=https://terminal-${SLUG}.${DOMAIN},https://console.${DOMAIN}

HOLD_TTL_SHORT_SECONDS=300
HOLD_TTL_LONG_SECONDS=1800
PENDING_BOOKING_AUTO_RELEASE=true
EOF

# 3. Generate Nginx config
TEMPLATE="${TERMINAL_DIR}/deploy/nginx/_template-operator.conf"
if [ -f "$TEMPLATE" ]; then
  sed -e "s/__OPERATOR__/${SLUG}/g" \
      -e "s/__DOMAIN__/${DOMAIN}/g" \
      -e "s/__TERMINAL_PORT__/${TERMINAL_PORT}/g" \
      "$TEMPLATE" > "$NGINX_CONF"
  echo "==> Nginx config dibuat: $NGINX_CONF"
else
  echo "WARN: template $TEMPLATE tidak ada, skip Nginx config"
fi

cat <<EOF

==========================================================
Operator '${SLUG}' bootstrap selesai.

LANGKAH BERIKUTNYA (manual):

1. Edit env Terminal:
   nano ${TERMINAL_DIR}/.env       # set DATABASE_URL asli

2. Buat database Postgres untuk operator ini:
   createdb ${SLUG}_terminal

3. Daftar tenant baru di Realmio:
   curl -X POST https://transity.realmio.web.id/admin/tenants ...

4. Insert operator di Console DB (1x, di Console DB shared):
   psql \$CONSOLE_DB_URL -c "INSERT INTO operators
     (slug, name, api_url, service_key, tenant_id) VALUES
     ('${SLUG}', '${SLUG^} Shuttle',
      'https://terminal-${SLUG}.${DOMAIN}',
      '${SERVICE_KEY}',
      '${SLUG}-shuttle');"

5. Generate SSL cert (Terminal saja — App/Console sudah ada):
   certbot certonly --standalone -d terminal-${SLUG}.${DOMAIN}

6. Build & start container Terminal:
   cd ${TERMINAL_DIR} && docker compose up -d --build

7. Reload Nginx:
   nginx -t && systemctl reload nginx

8. Verifikasi:
   curl -s https://terminal-${SLUG}.${DOMAIN}/api/health
==========================================================

SERVICE KEY untuk operator '${SLUG}' (catat — masuk ke kolom
operators.service_key di Console DB):

${SERVICE_KEY}
EOF
