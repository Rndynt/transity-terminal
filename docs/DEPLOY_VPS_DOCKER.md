# Deploy Transity Terminal di VPS dengan Docker + Nginx

## Daftar Isi
1. [Arsitektur Deployment](#1-arsitektur-deployment)
2. [Persiapan VPS](#2-persiapan-vps)
3. [Struktur File](#3-struktur-file)
4. [Dockerfile — Main App (Terminal)](#4-dockerfile--main-app-terminal)
5. [Dockerfile — TransityWeb (Customer Portal)](#5-dockerfile--transityweb-customer-portal)
6. [Docker Compose](#6-docker-compose)
7. [Environment Variables](#7-environment-variables)
8. [Nginx Configuration](#8-nginx-configuration)
9. [SSL dengan Certbot](#9-ssl-dengan-certbot)
10. [Langkah Deploy Step-by-Step](#10-langkah-deploy-step-by-step)
11. [Setup Multi-Operator di 1 VPS](#11-setup-multi-operator-di-1-vps)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick Reference Commands](#13-quick-reference-commands)

---

## 1. Arsitektur Deployment

### Gambaran Sistem

```
Internet (HTTPS)
      │
   Nginx (443 / 80)
      │
      ├── nusa-terminal.transity.web.id   → Main App / Terminal CSO  (port 5000)
      │     ├── Fastify API  (/api/*)
      │     ├── WebSocket    (/socket.io/*)
      │     └── React SPA    (semua route lain)
      │
      └── nusa-web.transity.web.id        → TransityWeb / Customer Portal (port 3001)
            ├── Proxy API    (/api/*  → diteruskan ke Terminal port 5000)
            └── React SPA    (booking, tiket, profil)
```

### Komponen Per Operator

Setiap operator mendapatkan **2 service** yang berjalan berdampingan:

| Service | Port | Fungsi |
|---|---|---|
| **Main App (Terminal)** | 5000 | Backend API + CSO/Admin frontend |
| **TransityWeb** | 3001 | Customer-facing booking portal |

> Dalam setup multi-operator di 1 VPS, setiap operator menggunakan port berbeda (lihat [Bagian 11](#11-setup-multi-operator-di-1-vps)).

### Integrasi Realmio (Auth Terpusat)

```
Realmio (Auth)
  ├── tenant: nusa-shuttle     → nusa-terminal.transity.web.id
  ├── tenant: buskita-shuttle  → buskita-terminal.transity.web.id
  └── ...

Terminal (setiap operator)
  └── verifikasi sesi → GET {REALMIO_BASE_URL}/me (dengan X-Tenant-Id header)
```

---

## 2. Persiapan VPS

### Install Docker

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose Plugin
apt install docker-compose-plugin -y        # Ubuntu/Debian
# atau: yum install docker-compose-plugin -y  # CentOS/AlmaLinux
```

### Install Nginx & Certbot

```bash
# Ubuntu/Debian
apt install nginx certbot python3-certbot-nginx -y

# CentOS/AlmaLinux
yum install nginx certbot python3-certbot-nginx -y

systemctl enable nginx
systemctl start nginx
```

### Persiapan Direktori

```bash
# Buat direktori per operator
mkdir -p /opt/nusa-terminal
cd /opt/nusa-terminal

# Clone repository
git clone <repo-url> .
```

---

## 3. Struktur File

```
/opt/nusa-terminal/
├── Dockerfile                      # ← Buat file ini (lihat Bagian 4)
├── .dockerignore                   # ← Buat file ini (lihat Bagian 4)
├── docker-compose.yml              # ← Buat file ini (lihat Bagian 6)
├── .env                            # ← Buat dari .env.example (TIDAK di-commit)
│
├── apps/
│   └── transityweb/
│       ├── Dockerfile              # ← Buat file ini (lihat Bagian 5)
│       ├── .dockerignore           # ← Buat file ini (lihat Bagian 5)
│       └── .env.production         # ← Buat file ini (lihat Bagian 7)
│
├── client/                         # React frontend (dibangun oleh Dockerfile root)
├── server/                         # Fastify backend
├── shared/                         # Types & schema bersama
├── migrations/                     # SQL migrations (Drizzle)
│
└── docs/
    └── DEPLOY_VPS_DOCKER.md        # 📖 Tutorial ini
```

---

## 4. Dockerfile — Main App (Terminal)

Buat file `Dockerfile` di **root project**:

```dockerfile
# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy semua source
COPY . .

# Build frontend (Vite) + backend (esbuild)
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

# Install hanya production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy hasil build
COPY --from=builder /app/dist ./dist

# Copy migrations (untuk db:push)
COPY --from=builder /app/migrations ./migrations
COPY drizzle.config.ts ./
COPY shared ./shared

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
```

Buat file `.dockerignore` di root project:

```
node_modules
dist
.env
.env.*
apps/mobile
apps/transityweb/node_modules
apps/transityweb/dist
apps/transityweb/dist-server
attached_assets
artifacts
docs
*.log
.git
```

---

## 5. Dockerfile — TransityWeb (Customer Portal)

Buat file `apps/transityweb/Dockerfile`:

```dockerfile
# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy semua source
COPY . .

# Build frontend (Vite → dist/) + server (tsc → dist-server/)
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install hanya production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy hasil build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "dist-server/index.js"]
```

Buat file `apps/transityweb/.dockerignore`:

```
node_modules
dist
dist-server
.env
.env.*
*.log
.git
```

---

## 6. Docker Compose

Buat file `docker-compose.yml` di root project:

```yaml
services:

  # ─────────────────────────────────────────
  # Main App — Terminal CSO + Backend API
  # ─────────────────────────────────────────
  terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nusa-terminal
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

  # ─────────────────────────────────────────
  # TransityWeb — Customer Booking Portal
  # ─────────────────────────────────────────
  transityweb:
    build:
      context: apps/transityweb
      dockerfile: Dockerfile
    container_name: nusa-transityweb
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    env_file:
      - apps/transityweb/.env.production
    environment:
      - NODE_ENV=production
    depends_on:
      terminal:
        condition: service_healthy
```

> Kedua service hanya listen di `127.0.0.1` (localhost) — tidak terekspos langsung ke internet. Nginx yang menjadi pintu masuk publik.

---

## 7. Environment Variables

### Main App: `.env`

```bash
# ─────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────
DATABASE_URL=postgresql://nusa_user:password_aman@localhost:5432/nusa_terminal?sslmode=require
# Jika pakai Neon:
# DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/nusa_terminal?sslmode=require

# ─────────────────────────────────────────
# SERVER
# ─────────────────────────────────────────
NODE_ENV=production
PORT=5000

# ─────────────────────────────────────────
# AUTH — Realmio
# ─────────────────────────────────────────
REALMIO_BASE_URL=https://transity.realmio.web.id
REALMIO_TENANT_ID=nusa-shuttle
# JANGAN aktifkan di production!
# DEV_BYPASS_AUTH=false

# ─────────────────────────────────────────
# AUTH — Mobile JWT
# ─────────────────────────────────────────
# Generate: openssl rand -base64 32
JWT_SECRET=<RANDOM_STRING_MINIMAL_32_KARAKTER>

# ─────────────────────────────────────────
# CORS & WEBSOCKET
# ─────────────────────────────────────────
# Domain yang boleh akses API dan WebSocket
CORS_ORIGINS=https://nusa-terminal.transity.web.id,https://nusa-web.transity.web.id

# ─────────────────────────────────────────
# SERVICE KEY — TransityConsole / TransityWeb
# ─────────────────────────────────────────
# Key wajib dikirim TransityConsole via header X-Service-Key
# Jika kosong, header X-Service-Key diabaikan (backward compatible)
# Generate: openssl rand -hex 32
TERMINAL_SERVICE_KEY=<RANDOM_HEX_32_KARAKTER>

# ─────────────────────────────────────────
# PAYMENT WEBHOOK (opsional)
# ─────────────────────────────────────────
# PAYMENT_WEBHOOK_SECRET=<secret-dari-payment-gateway>

# ─────────────────────────────────────────
# HOLD & BOOKING CONFIG
# ─────────────────────────────────────────
HOLD_TTL_SHORT_SECONDS=300      # 5 menit (hold saat pilih kursi)
HOLD_TTL_LONG_SECONDS=1800      # 30 menit (hold saat proses pembayaran)
PENDING_BOOKING_AUTO_RELEASE=true
```

> Generate JWT_SECRET: `openssl rand -base64 32`

### TransityWeb: `apps/transityweb/.env.production`

```bash
# ─────────────────────────────────────────
# SERVER
# ─────────────────────────────────────────
NODE_ENV=production
TRANSITYWEB_PORT=3001

# ─────────────────────────────────────────
# API UPSTREAM
# Arahkan ke container terminal (pakai nama service Docker)
# ─────────────────────────────────────────
API_UPSTREAM=http://terminal:5000
```

> Dalam Docker Compose, `terminal` adalah nama service — Docker otomatis resolve ke IP container yang benar.

---

## 8. Nginx Configuration

### Per Operator: `/etc/nginx/conf.d/nusa-terminal.conf`

```nginx
# ─────────────────────────────────────────────────────────────
# nusa-terminal.transity.web.id  →  Terminal CSO (port 5000)
# ─────────────────────────────────────────────────────────────
server {
    listen 80;
    server_name nusa-terminal.transity.web.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name nusa-terminal.transity.web.id;

    ssl_certificate     /etc/letsencrypt/live/nusa-terminal.transity.web.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nusa-terminal.transity.web.id/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    # ── WebSocket (Socket.io) ──────────────────────────────────
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ── API Routes ────────────────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
    }

    # ── React SPA (semua route lain) ──────────────────────────
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
    }
}
```

### TransityWeb: `/etc/nginx/conf.d/nusa-web.conf`

```nginx
# ─────────────────────────────────────────────────────────────
# nusa-web.transity.web.id  →  TransityWeb Customer Portal (port 3001)
# ─────────────────────────────────────────────────────────────
server {
    listen 80;
    server_name nusa-web.transity.web.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name nusa-web.transity.web.id;

    ssl_certificate     /etc/letsencrypt/live/nusa-web.transity.web.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nusa-web.transity.web.id/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    # ── Semua request diteruskan ke TransityWeb ───────────────
    # (TransityWeb sendiri yang proxy /api/* ke Terminal)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
    }
}
```

---

## 9. SSL dengan Certbot

```bash
# Stop Nginx sementara jika perlu (port 80 harus bebas)
systemctl stop nginx

# Generate SSL untuk Terminal
certbot certonly --standalone -d nusa-terminal.transity.web.id

# Generate SSL untuk TransityWeb
certbot certonly --standalone -d nusa-web.transity.web.id

# Start Nginx kembali
systemctl start nginx

# Verifikasi konfigurasi Nginx
nginx -t

# Reload
systemctl reload nginx

# Test auto-renew
certbot renew --dry-run
```

> Certbot auto-renew biasanya sudah dikonfigurasi melalui systemd timer. Cek dengan: `systemctl status certbot.timer`

---

## 10. Langkah Deploy Step-by-Step

### Langkah 1: Masuk ke direktori project

```bash
cd /opt/nusa-terminal
git pull origin main
```

### Langkah 2: Buat semua file konfigurasi

```bash
# Buat .env dari example
cp .env.example .env
nano .env
# Isi semua variabel (lihat Bagian 7)

# Buat .env TransityWeb
cp apps/transityweb/.env.example apps/transityweb/.env.production
nano apps/transityweb/.env.production
# Isi TRANSITYWEB_PORT dan API_UPSTREAM
```

### Langkah 3: Build semua container

```bash
# Stop container yang sedang berjalan (jika ada)
docker compose down

# Build ulang dari awal
docker compose build --no-cache

# Jalankan di background
docker compose up -d
```

### Langkah 4: Jalankan migrasi database

```bash
# Jalankan dari dalam container terminal
docker compose exec terminal npx drizzle-kit push

# Atau jika butuh --force
docker compose exec terminal npx drizzle-kit push --force
```

### Langkah 5: Konfigurasi Nginx

```bash
# Salin config Nginx
cp /opt/nusa-terminal/docs/nginx/nusa-terminal.conf /etc/nginx/conf.d/
cp /opt/nusa-terminal/docs/nginx/nusa-web.conf /etc/nginx/conf.d/

# Atau buat manual (copy-paste dari Bagian 8)
nano /etc/nginx/conf.d/nusa-terminal.conf
nano /etc/nginx/conf.d/nusa-web.conf

# Verifikasi
nginx -t

# Reload
systemctl reload nginx
```

### Langkah 6: Setup SSL

```bash
# Generate sertifikat (lihat Bagian 9)
certbot certonly --standalone -d nusa-terminal.transity.web.id
certbot certonly --standalone -d nusa-web.transity.web.id

# Reload Nginx setelah SSL siap
systemctl reload nginx
```

### Langkah 7: Daftarkan domain ke Realmio

Hubungi admin Realmio untuk menambahkan domain ke `TRUSTED_ORIGINS`:
- `https://nusa-terminal.transity.web.id`
- `https://nusa-web.transity.web.id`

### Langkah 8: Buat user owner pertama

```bash
# Sign-up via Realmio API
curl -X POST https://transity.realmio.web.id/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: nusa-shuttle" \
  -d '{
    "email": "admin@nusashuttle.com",
    "password": "PasswordAman123!",
    "name": "Admin Nusa"
  }'

# Catat user.id dari response, lalu assign role owner di database:
docker compose exec terminal psql "$DATABASE_URL" \
  -c "INSERT INTO staff_members (user_id, role_id, outlet_id) VALUES ('<user-id>', '<role-id-owner>', NULL);"
```

### Langkah 9: Verifikasi

```bash
# Cek container berjalan
docker compose ps

# Cek log
docker compose logs -f

# Cek koneksi ke Terminal
curl -s https://nusa-terminal.transity.web.id/api/health

# Cek koneksi ke TransityWeb
curl -s https://nusa-web.transity.web.id
```

---

## 11. Setup Multi-Operator di 1 VPS

Gunakan **direktori terpisah** dan **port berbeda** untuk setiap operator:

```
/opt/nusa-terminal/          PORT=5000, TRANSITYWEB_PORT=3001, DB=nusa_terminal,    TENANT=nusa-shuttle
/opt/buskita-terminal/       PORT=5001, TRANSITYWEB_PORT=3002, DB=buskita_terminal, TENANT=buskita-shuttle
/opt/transexpress-terminal/  PORT=5002, TRANSITYWEB_PORT=3003, DB=transexpress_db,  TENANT=transexpress
```

### Contoh `docker-compose.yml` untuk buskita (port berbeda):

```yaml
services:
  terminal:
    ...
    container_name: buskita-terminal
    ports:
      - "127.0.0.1:5001:5000"   # host:container

  transityweb:
    ...
    container_name: buskita-transityweb
    ports:
      - "127.0.0.1:3002:3001"   # host:container
```

### Nginx per operator:

```
nusa-terminal.transity.web.id     → proxy_pass http://127.0.0.1:5000
nusa-web.transity.web.id          → proxy_pass http://127.0.0.1:3001

buskita-terminal.transity.web.id  → proxy_pass http://127.0.0.1:5001
buskita-web.transity.web.id       → proxy_pass http://127.0.0.1:3002
```

Setiap operator punya:
- Database PostgreSQL sendiri
- Tenant Realmio sendiri
- Subdomain sendiri
- Container sendiri
- Data yang **sepenuhnya terisolasi**

---

## 12. Troubleshooting

| Masalah | Penyebab | Solusi |
|---|---|---|
| Login gagal / 401 | `REALMIO_BASE_URL` salah atau tidak bisa diakses | Cek URL dan jalankan `curl $REALMIO_BASE_URL/me` dari VPS |
| CORS error di browser | Domain belum terdaftar di Realmio `TRUSTED_ORIGINS` | Minta admin Realmio tambahkan domain |
| WebSocket disconnect terus | Header `Upgrade`/`Connection` hilang di Nginx | Pastikan config WebSocket di Nginx sudah benar (lihat Bagian 8) |
| Container `transityweb` gagal start | Nunggu `terminal` belum ready | Cek `depends_on` dan healthcheck di docker-compose.yml |
| API 502 dari TransityWeb | `API_UPSTREAM` salah atau terminal belum jalan | Cek nama service Docker (`terminal`) dan pastikan port benar |
| `DEV_BYPASS_AUTH` aktif di production | Tidak sengaja di-set | Pastikan `DEV_BYPASS_AUTH` tidak ada atau `false` di `.env` |
| Database connection error | URL salah atau SSL mode | Cek `DATABASE_URL`, gunakan `?sslmode=require` untuk Neon |
| Kursi hold tidak expire | Scheduler tidak berjalan | Cek log container: `docker compose logs terminal \| grep SCHEDULER` |
| Build gagal karena OOM | VPS RAM kurang | Gunakan swap: `fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile` |
| Kustomisasi brand tidak muncul | Cache browser atau setting belum disimpan | Buka `/admin/settings`, simpan ulang, hard refresh (Ctrl+Shift+R) |

---

## 13. Quick Reference Commands

```bash
# ─────────────────────────────────────
# Status & Monitoring
# ─────────────────────────────────────

# Cek status semua container
docker compose ps

# Log realtime semua service
docker compose logs -f

# Log satu service
docker compose logs -f terminal
docker compose logs -f transityweb

# Masuk ke shell container
docker compose exec terminal sh
docker compose exec transityweb sh

# Cek env variables di container
docker compose exec terminal printenv | grep -E "PORT|NODE_ENV|REALMIO|DATABASE"


# ─────────────────────────────────────
# Deploy & Update
# ─────────────────────────────────────

# Pull kode terbaru dan deploy ulang
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d

# Restart satu service (tanpa rebuild)
docker compose restart terminal
docker compose restart transityweb

# Restart semua
docker compose restart


# ─────────────────────────────────────
# Database
# ─────────────────────────────────────

# Push schema (migrasi)
docker compose exec terminal npx drizzle-kit push

# Masuk ke psql
docker compose exec terminal psql "$DATABASE_URL"


# ─────────────────────────────────────
# Nginx
# ─────────────────────────────────────

# Test konfigurasi Nginx
nginx -t

# Reload Nginx
systemctl reload nginx

# Lihat log Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log


# ─────────────────────────────────────
# SSL
# ─────────────────────────────────────

# Renew semua sertifikat
certbot renew

# Cek tanggal expire
certbot certificates


# ─────────────────────────────────────
# Health Check
# ─────────────────────────────────────

# Test Terminal API
curl -s https://nusa-terminal.transity.web.id/api/health

# Test TransityWeb
curl -I https://nusa-web.transity.web.id

# Test WebSocket (perlu wscat)
wscat -c wss://nusa-terminal.transity.web.id/socket.io/?EIO=4&transport=websocket
```
