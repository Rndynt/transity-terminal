# Deploy Transity Stack di VPS Docker + Nginx

Panduan deploy 3 service Transity (Terminal, Console, App) di **1 VPS** menggunakan Docker + Nginx reverse proxy. Tujuan utama: realtime Socket.IO **tidak putus** di production.

---

## 1. Arsitektur

```
                          Internet (HTTPS)
                                │
                       ┌────────┴────────┐
                       │  Nginx (host)   │  443/80
                       └────┬─────┬─────┬┘
                            │     │     │
            terminal.x.com  │     │     │  app.x.com
              (CSO + WS)    │     │     │  (customer)
                            ▼     │     ▼
                    ┌─────────┐   │   ┌─────────┐
                    │Terminal │   │   │  App    │
                    │  :5000  │   │   │  :3001  │
                    │ (WS srv)│   │   │ (proxy) │
                    └────┬────┘   │   └────┬────┘
                         │        │        │
                         │   console.x.com │
                         │        ▼        │
                         │   ┌─────────┐   │
                         │   │ Console │◄──┘  (App proxy /api/* ke Console)
                         │   │  :8080  │
                         │   └────┬────┘
                         │        │
                         └────────┴──── Console proxy ke Terminal (X-Service-Key)
                                          via Docker network `transity-net`

                         ┌─────────────────────────┐
                         │  PostgreSQL (Neon/RDS)  │  external managed DB
                         └─────────────────────────┘
```

**Aturan flow:**
- Browser **CSO** → `terminal.x.com` (langsung ke Terminal, dapat Socket.IO realtime)
- Browser **customer** → `app.x.com` → App proxy semua `/api/*` ke Console → Console gateway ke Terminal
- App **TIDAK PERNAH** akses Terminal langsung
- Komunikasi internal antar container lewat shared Docker network `transity-net` (alamat: `http://terminal:5000`, `http://transity-console:8080`)

---

## 2. Prasyarat VPS

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin nginx certbot python3-certbot-nginx

systemctl enable --now docker nginx
```

---

## 3. Layout Direktori

Clone 3 repo terpisah ke `/opt`:

```
/opt/
├── transity-terminal/   ← repo TransityTerminal (root project)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── deploy/
│   │   ├── README.md            ← file ini
│   │   ├── setup-network.sh
│   │   └── nginx/
│   │       ├── terminal.conf
│   │       ├── console.conf
│   │       └── app.conf
│   └── .env                     ← buat manual (lihat §5)
│
├── transity-console/    ← repo TransityConsole
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env                     ← buat manual
│
└── transity-app/        ← repo TransityApp
    ├── Dockerfile
    ├── docker-compose.yml
    └── .env                     ← buat manual
```

```bash
mkdir -p /opt && cd /opt
git clone <terminal-repo-url> transity-terminal
git clone <console-repo-url>  transity-console
git clone <app-repo-url>      transity-app
```

---

## 4. Buat Shared Docker Network (sekali saja)

```bash
cd /opt/transity-terminal
bash deploy/setup-network.sh
```

Network `transity-net` ini dipakai bersama oleh ketiga `docker-compose.yml`. Tanpa ini, container gak bisa saling resolve via nama service.

---

## 5. Environment Variables

### `/opt/transity-terminal/.env`

```bash
NODE_ENV=production
PORT=5000

# Database (Neon / RDS / managed PG)
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# Auth (Realmio atau bypass dev)
REALMIO_BASE_URL=https://transity.realmio.web.id
REALMIO_TENANT_ID=nusa-shuttle
# DEV_BYPASS_AUTH=false  ← JANGAN aktifkan di prod

# JWT untuk mobile/app
JWT_SECRET=<openssl rand -base64 32>

# CORS: domain yang boleh akses Terminal langsung (CSO + Console subdomain)
CORS_ORIGINS=https://terminal.example.com,https://console.example.com

# Service key — Console wajib kirim header X-Service-Key ini saat call Terminal
TERMINAL_SERVICE_KEY=<openssl rand -hex 32>

# Hold timing
HOLD_TTL_SHORT_SECONDS=300
HOLD_TTL_LONG_SECONDS=1800
PENDING_BOOKING_AUTO_RELEASE=true
```

### `/opt/transity-console/.env`

```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://user:pass@host/console_db?sslmode=require

# URL public Terminal (dipakai untuk callback / link absolut)
# Komunikasi internal antar container pakai alamat Docker (`http://terminal:5000`)
# tapi kalau Console scheduler/proxy butuh URL public, isi di sini.
TERMINAL_PUBLIC_URL=https://terminal.example.com

# Override URL Terminal untuk komunikasi internal proxy
# (gateway.proxy.ts respect var ini; gateway.aggregator.ts BELUM)
OPERATOR_TERMINAL_URL_OVERRIDE=http://terminal:5000

# Auth Realmio (sama tenant dengan Terminal)
REALMIO_BASE_URL=https://transity.realmio.web.id
REALMIO_TENANT_ID=nusa-shuttle

# Service key — HARUS sama dengan TERMINAL_SERVICE_KEY di Terminal
TERMINAL_SERVICE_KEY=<value-yang-sama-dengan-Terminal>
```

> **Catatan operator DB:** kolom `operators.api_url` di Console DB harus diisi `https://terminal.example.com` (URL public Terminal). Override env hanya berlaku untuk gateway.proxy.ts. Aggregator (search/seatmap) tetap baca dari kolom DB, jadi pastikan kolom itu benar di production.

### `/opt/transity-app/.env`

```bash
NODE_ENV=production
PORT=3001

# App proxy semua /api/* ke Console — alamat container Docker
CONSOLE_URL=http://transity-console:8080

# Public-facing URL (untuk redirect / link absolut)
APP_PUBLIC_URL=https://app.example.com

# Realmio tenant (App share session dengan Console)
REALMIO_BASE_URL=https://transity.realmio.web.id
REALMIO_TENANT_ID=nusa-shuttle

# JANGAN aktifkan di prod
# DEV_BYPASS_AUTH=false
```

---

## 6. Build & Run

Urutan: **Terminal → Console → App** (App butuh Console up).

```bash
# 1. Terminal
cd /opt/transity-terminal
docker compose build
docker compose up -d
docker compose logs -f terminal   # tunggu sampai "ready"

# 2. Console
cd /opt/transity-console
docker compose build
docker compose up -d
docker compose logs -f

# 3. App
cd /opt/transity-app
docker compose build
docker compose up -d
docker compose logs -f
```

Cek semua running dan healthy:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Test internal connectivity:

```bash
# Dari Console container, harus bisa hit Terminal
docker exec transity-console wget -qO- http://terminal:5000/api/health

# Dari App container, harus bisa hit Console
docker exec transity-app wget -qO- http://transity-console:8080/api/healthz
```

---

## 7. Nginx Config

Salin file `deploy/nginx/*.conf` ke `/etc/nginx/conf.d/` dan ganti `*.example.com` dengan domain asli.

```bash
cd /opt/transity-terminal/deploy/nginx

# Edit dulu — ganti example.com dengan domain asli
sed -i 's/terminal.example.com/terminal.transity.web.id/g' terminal.conf
sed -i 's/console.example.com/console.transity.web.id/g'  console.conf
sed -i 's/app.example.com/app.transity.web.id/g'          app.conf

cp terminal.conf console.conf app.conf /etc/nginx/conf.d/

nginx -t && systemctl reload nginx
```

### ⚠️ Bagian PALING PENTING — Socket.IO Upgrade

File `terminal.conf` punya blok ini — **JANGAN DIHAPUS**:

```nginx
location /socket.io/ {
    proxy_pass http://terminal_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    ...
}
```

Tanpa header `Upgrade` + `Connection: upgrade`, Socket.IO **tidak bisa upgrade ke WebSocket** dan otomatis fallback ke HTTP long-polling. Akibatnya:
- Event INVENTORY_UPDATED (booking masuk / kursi paid) **delay 0–25 detik** sampai client
- Browser CSO terlihat lag berat saat ada booking dari App
- Kelihatan "tidak realtime" di production padahal di dev cepat

**Cara verifikasi WS jalan benar:**
1. Buka `https://terminal.example.com` di browser, login CSO
2. DevTools → Network → filter "WS"
3. Cari request `socket.io/?...&transport=websocket` → status harus **101 Switching Protocols** (hijau)
4. Kalau cuma terlihat `transport=polling` yang request berulang tiap beberapa detik → Nginx WS upgrade-nya gak jalan

---

## 8. SSL (Let's Encrypt)

```bash
systemctl stop nginx   # bebaskan port 80 sementara

certbot certonly --standalone -d terminal.transity.web.id
certbot certonly --standalone -d console.transity.web.id
certbot certonly --standalone -d app.transity.web.id

systemctl start nginx
nginx -t && systemctl reload nginx

# Test auto-renew
certbot renew --dry-run
```

---

## 9. Update / Redeploy

Per repo, dari direktorinya masing-masing:

```bash
cd /opt/transity-<service>
git pull
docker compose build
docker compose up -d
```

Karena ketiga service share network external `transity-net`, mereka bisa di-update independen tanpa ganggu yang lain.

---

## 10. Troubleshooting Realtime

| Gejala | Penyebab | Fix |
|---|---|---|
| CSO seatmap lambat update saat App booking (>5 detik) | Nginx tidak forward WS upgrade | Pastikan blok `/socket.io/` punya header `Upgrade` + `Connection "upgrade"` |
| WS connect terus disconnect | Cloudflare/LB di depan Nginx blokir WS | Aktifkan WebSocket di Cloudflare Network settings; cek tidak ada timeout `<60s` di LB |
| Event hanya sampai sebagian client | Multi-instance Terminal tanpa Redis adapter | Untuk single instance OK. Kalau scale horizontal, install `@socket.io/redis-adapter` + Redis (TODO terpisah) |
| App user butuh refresh manual setelah pembayaran | Wajar — App tidak listen WS Terminal langsung. Pakai polling/refetch on focus | Sudah ada di tanstack-query default |
| `transity-app` gak bisa hit `transity-console` | Kedua container belum di network `transity-net` | Cek `docker network inspect transity-net` — harus ada ke-3 container |

### Cek log realtime emit

```bash
# Lihat event yang di-emit Terminal (filter ws/socket)
docker compose -f /opt/transity-terminal/docker-compose.yml logs terminal | grep -iE "socket|ws|inventory_updated"
```

---

## 11. Single-host vs Multi-host

Setup ini **single-host** (semua container di 1 VPS, share network). Cocok untuk operator kecil-menengah.

Kalau nanti pisah host:
- Tiap service expose port publik / pakai service mesh
- Ganti `CONSOLE_URL=http://transity-console:8080` → `https://console-internal.example.com`
- Tambah Redis adapter di Terminal Socket.IO untuk multi-instance scaling

---

## 12. Quick Reference

```bash
# Restart 1 service
cd /opt/transity-terminal && docker compose restart

# Lihat resource usage
docker stats --no-stream

# Stop semua
for d in transity-terminal transity-console transity-app; do
  cd /opt/$d && docker compose down
done

# Cek Socket.IO upgrade dari shell VPS
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://terminal.example.com/socket.io/?EIO=4\&transport=websocket
# Harus dapat: HTTP/1.1 101 Switching Protocols
```
