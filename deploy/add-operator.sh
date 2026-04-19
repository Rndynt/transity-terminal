#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Bootstrap Terminal whitelabel untuk operator baru.
#
# Yang whitelabel HANYA Terminal. App & Console di-share (1 instance
# untuk semua operator), jadi script ini tidak menyentuh App/Console.
#
# USAGE:
#   bash deploy/add-operator.sh <slug> <domain-base> <terminal-port>
#
# ARGUMEN:
#   <slug>           Nama unik operator (huruf kecil, no spasi). Dipakai
#                    untuk: nama folder, nama container, subdomain,
#                    nama database. Contoh: nusa, buskita, trans.
#   <domain-base>    Domain induk. Subdomain Terminal akan jadi
#                    "terminal-<slug>.<domain-base>".
#                    Contoh: transity.web.id
#   <terminal-port>  Port host yang dipakai container Terminal ini.
#                    Konvensi: 5000, 5010, 5020, 5030, 5040, ...
#                    (kelipatan 10, biar ga bentrok antar operator)
#
# ENV VAR (opsional):
#   BASE_DIR              Folder induk untuk install. Default: /srv/transity
#                         Folder Terminal akan jadi $BASE_DIR/<slug>-terminal
#   TERMINAL_REPO_URL     Git URL repo Transity Terminal
#   NGINX_CONF_DIR        Folder Nginx conf.d. Default: /etc/nginx/conf.d
#
# CONTOH:
#   # Default lokasi (/srv/transity/<slug>-terminal)
#   bash deploy/add-operator.sh nusa transity.web.id 5000
#
#   # Custom lokasi (mis. /home/admin/transity/<slug>-terminal)
#   BASE_DIR=/home/admin/transity \
#     bash deploy/add-operator.sh buskita transity.web.id 5010
# ─────────────────────────────────────────────────────────────
set -euo pipefail

if [ "$#" -lt 3 ]; then
  cat <<USAGE
Usage: $0 <slug> <domain-base> <terminal-port>

Contoh:
  bash deploy/add-operator.sh nusa     transity.web.id 5000
  bash deploy/add-operator.sh buskita  transity.web.id 5010

Env opsional:
  BASE_DIR=/srv/transity            # folder induk install (default)
  TERMINAL_REPO_URL=git@...         # repo Terminal
  NGINX_CONF_DIR=/etc/nginx/conf.d  # folder Nginx vhost
USAGE
  exit 1
fi

SLUG="$1"
DOMAIN="$2"
TERMINAL_PORT="$3"

BASE_DIR="${BASE_DIR:-/srv/transity}"
NGINX_CONF_DIR="${NGINX_CONF_DIR:-/etc/nginx/conf.d}"
TERMINAL_REPO="${TERMINAL_REPO_URL:-git@github.com:your-org/TransityTerminal.git}"

TERMINAL_DIR="${BASE_DIR}/${SLUG}-terminal"
NGINX_CONF="${NGINX_CONF_DIR}/terminal-${SLUG}.conf"

echo "==> Operator Terminal baru: ${SLUG}"
echo "    Folder    : ${TERMINAL_DIR}"
echo "    Subdomain : terminal-${SLUG}.${DOMAIN}"
echo "    Port host : 127.0.0.1:${TERMINAL_PORT}"
echo "    Nginx conf: ${NGINX_CONF}"
echo

mkdir -p "${BASE_DIR}"

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
# WAJIB diedit: DATABASE_URL
NODE_ENV=production
PORT=5000
OPERATOR_SLUG=${SLUG}
TERMINAL_PORT=${TERMINAL_PORT}

# TODO: ganti dengan DATABASE_URL operator ini
DATABASE_URL=postgresql://USER:PASS@HOST/${SLUG}_terminal?sslmode=require

REALMIO_BASE_URL=https://transity.realmio.web.id
REALMIO_TENANT_ID=${SLUG}-shuttle

JWT_SECRET=${JWT_SECRET}
TERMINAL_SERVICE_KEY=${SERVICE_KEY}

CORS_ORIGINS=https://terminal-${SLUG}.${DOMAIN},https://console.${DOMAIN}

HOLD_TTL_SHORT_SECONDS=300
HOLD_TTL_LONG_SECONDS=1800
PENDING_BOOKING_AUTO_RELEASE=true
EOF

# 3. Generate Nginx vhost
TEMPLATE="${TERMINAL_DIR}/deploy/nginx/_template-operator.conf"
if [ -f "$TEMPLATE" ]; then
  sed -e "s/__OPERATOR__/${SLUG}/g" \
      -e "s/__DOMAIN__/${DOMAIN}/g" \
      -e "s/__TERMINAL_PORT__/${TERMINAL_PORT}/g" \
      "$TEMPLATE" > "$NGINX_CONF"
  echo "==> Nginx vhost dibuat: $NGINX_CONF"
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

4. Insert operator di Console DB (1x, Console DB shared):
   psql \$CONSOLE_DB_URL -c "INSERT INTO operators
     (slug, name, api_url, service_key, tenant_id) VALUES
     ('${SLUG}', '${SLUG^} Shuttle',
      'https://terminal-${SLUG}.${DOMAIN}',
      '${SERVICE_KEY}',
      '${SLUG}-shuttle');"

5. Generate SSL cert (Terminal subdomain saja):
   certbot certonly --standalone -d terminal-${SLUG}.${DOMAIN}

6. Build & start container Terminal:
   cd ${TERMINAL_DIR} && docker compose up -d --build

7. Reload Nginx:
   nginx -t && systemctl reload nginx

8. Verifikasi:
   curl -s https://terminal-${SLUG}.${DOMAIN}/api/health
==========================================================

SERVICE KEY '${SLUG}' (catat — masukkan ke kolom
operators.service_key di Console DB):

${SERVICE_KEY}
EOF
