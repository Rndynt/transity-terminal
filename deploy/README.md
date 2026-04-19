# Deploy Transity Stack di VPS Docker + Nginx

Panduan deploy stack Transity di VPS pakai Docker + Nginx reverse proxy.

**Arsitektur whitelabel:**
- **Console** = 1 instance shared (multi-tenant, semua operator pakai sama)
- **App** = 1 instance shared (customer-facing, multi-tenant routing)
- **Terminal** = **N instance**, 1 per operator (whitelabel — tiap mitra punya brand, DB, subdomain sendiri)

---

## 1. Arsitektur

```
                            Internet (HTTPS)
                                  │
                         ┌────────┴────────┐
                         │  Nginx (host)   │
                         └─┬──┬──┬─────┬───┘
                           │  │  │     │
            app.x.com ─────┘  │  │     └──── console.x.com
            (1 shared)        │  │           (1 shared backoffice)
                              │  │
            terminal-nusa.x  ◄┘  └► terminal-buskita.x ... (N operator)
            terminal-trans.x      terminal-prima.x
            terminal-cepat.x      ...

   ┌─────────┐    ┌──────────┐    ┌──────────────────────────┐
   │  App    │    │ Console  │    │ Terminal (per operator)  │
   │  :3001  │───►│  :8080   │───►│ :5000  nusa-terminal     │
   │ (proxy) │    │ (gateway)│    │ :5010  buskita-terminal  │
   └─────────┘    └──────────┘    │ :5020  trans-terminal    │
                                  │ :5030  prima-terminal    │
                                  │ :5040  cepat-terminal    │
                                  └──────────────────────────┘
                                       │
   ┌──────────────────────┐            │
   │ PostgreSQL (managed) │ ◄──────────┘
   │  - console_db        │   1 DB Console + N DB Terminal
   │  - nusa_terminal     │   (data tiap operator terisolasi)
   │  - buskita_terminal  │
   │  - ...               │
   └──────────────────────┘
```

**Aturan flow:**
- Browser **CSO operator X** → `terminal-X.domain.com` (langsung ke Terminal X, dapat Socket.IO realtime instance itu)
- Browser **customer** → `app.domain.com` → App proxy `/api/*` ke Console → Console route ke Terminal yang sesuai berdasarkan kolom `operators.api_url` (atau slug di URL)
- App **TIDAK PERNAH** akses Terminal langsung
- Console pilih Terminal mana berdasarkan `operator_id` di request (tabel `operators` di Console DB)
- Komunikasi internal antar container lewat shared Docker network `transity-net`

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

Folder induk bebas — **tidak harus `/opt/`**. Pilih sesuai konvensi server kamu. Beberapa pilihan umum:

| Folder induk | Cocok untuk |
|---|---|
| `/srv/transity/` | Konvensi modern Linux untuk service data |
| `/opt/` | Konvensi software optional/3rd-party |
| `/home/admin/apps/` | Kalau server pakai user non-root |
| `/var/www/transity/` | Konvensi lama (kayak Nginx default) |

Di panduan ini saya pakai `/srv/transity/` sebagai contoh — **ganti aja sesuai preferensi kamu** (semua command tinggal sesuaikan path-nya).

Layout yang disarankan:

```
/srv/transity/
├── shared-app/                 ← repo TransityApp (1× shared, port 3001)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env
│
├── shared-console/             ← repo TransityConsole (1× shared, port 8080)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env
│
├── <slug>-terminal/            ← repo TransityTerminal (N× per operator)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── deploy/                 ← folder ini cuma ada di Terminal repo
│   │   ├── README.md           ← file yang lagi kamu baca
│   │   ├── setup-network.sh
│   │   ├── add-operator.sh
│   │   └── nginx/
│   │       ├── terminal.conf
│   │       ├── console.conf
│   │       ├── app.conf
│   │       └── _template-operator.conf
│   └── .env
└── <slug-lain>-terminal/       ← Terminal mitra lain
    └── ...
```

> **`<slug>`** adalah placeholder untuk nama operator (huruf kecil, no spasi). Contoh slug: `nusa`, `buskita`, `trans`, `prima`, `cepat`. Tiap operator punya folder, container, DB, subdomain sendiri. Detail di §11.

Clone awal:

```bash
# Pilih base directory (sesuaikan)
BASE=/srv/transity
mkdir -p "$BASE" && cd "$BASE"

# 2 service shared (1 instance untuk semua operator)
git clone <console-repo-url>  shared-console
git clone <app-repo-url>      shared-app

# Terminal pertama (1 folder per operator, ganti `nusa` dengan slug operatormu)
git clone <terminal-repo-url> nusa-terminal
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

> Catatan path: di bawah ini saya pakai `/srv/transity/...` — kalau base directory kamu beda, sesuaikan saja.

### `<base>/<slug>-terminal/.env`  (contoh: `/srv/transity/nusa-terminal/.env`)

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

### `<base>/shared-console/.env`

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

### `<base>/shared-app/.env`

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

Urutan: **Terminal (operator pertama) → Console → App**.

Ganti `BASE` dengan folder induk pilihanmu:

```bash
BASE=/srv/transity     # atau /opt, /home/admin/apps, dll

# 1. Terminal pertama (mis. operator nusa)
cd $BASE/nusa-terminal
docker compose up -d --build
docker compose logs -f

# 2. Console (shared)
cd $BASE/shared-console
docker compose up -d --build
docker compose logs -f

# 3. App (shared)
cd $BASE/shared-app
docker compose up -d --build
docker compose logs -f
```

Cek semua running dan healthy:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Test internal connectivity (ganti `nusa-terminal` dengan nama container Terminal):

```bash
# Dari Console container, harus bisa hit Terminal
docker exec transity-console wget -qO- http://nusa-terminal:5000/api/health

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

Per service, dari direktorinya masing-masing:

```bash
cd <base>/<folder-service>     # mis. /srv/transity/nusa-terminal
git pull
docker compose up -d --build
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

## 11. Multi-Operator (Whitelabel) — Tambah Operator Baru

Tiap mitra operator dapat **Terminal sendiri** (container, DB, subdomain, port unik). Console & App tetap shared (1 instance saja, melayani semua operator).

### Konvensi penamaan

| Item | Pola | Contoh (operator slug = `nusa`) |
|---|---|---|
| Slug operator | `<slug>` (huruf kecil, tanpa spasi) | `nusa` |
| Folder Terminal | `<base>/<slug>-terminal/` | `/srv/transity/nusa-terminal/` |
| Nama container | `<slug>-terminal` | `nusa-terminal` |
| Port host | `<terminal-port>` (kelipatan 10) | `5000` |
| Subdomain Terminal | `terminal-<slug>.<domain>` | `terminal-nusa.transity.web.id` |
| Database Postgres | `<slug>_terminal` | `nusa_terminal` |
| Tenant Realmio | `<slug>-shuttle` | `nusa-shuttle` |
| Nginx vhost | `/etc/nginx/conf.d/terminal-<slug>.conf` | `terminal-nusa.conf` |

> `<base>` = folder induk pilihanmu (lihat §3). Bisa `/srv/transity`, `/opt`, `/home/admin/apps`, dll.

### Pola folder kalau ada banyak operator

Misal kamu punya 5 mitra dengan slug masing-masing `<slug-1>` … `<slug-5>`:

```
<base>/
├── shared-console/             ← 1× shared (port 8080)
├── shared-app/                 ← 1× shared (port 3001)
│
├── <slug-1>-terminal/          ← port 5000
├── <slug-2>-terminal/          ← port 5010
├── <slug-3>-terminal/          ← port 5020
├── <slug-4>-terminal/          ← port 5030
└── <slug-5>-terminal/          ← port 5040
```

Konvensi port: kelipatan 10 per operator — gampang diingat dan tidak bentrok.

### Cara cepat — pakai script otomatis

```bash
# Set base directory & repo URL sekali
export BASE_DIR=/srv/transity
export TERMINAL_REPO_URL=git@github.com:your-org/TransityTerminal.git

# Format: bash deploy/add-operator.sh <slug> <domain-base> <terminal-port>
bash deploy/add-operator.sh <slug-1> <domain-base> 5000
bash deploy/add-operator.sh <slug-2> <domain-base> 5010
bash deploy/add-operator.sh <slug-3> <domain-base> 5020
# ... dst, sebanyak operator yang kamu punya
```

Contoh konkret:

```bash
export BASE_DIR=/srv/transity
export TERMINAL_REPO_URL=git@github.com:your-org/TransityTerminal.git

bash deploy/add-operator.sh nusa     transity.web.id 5000   # → /srv/transity/nusa-terminal/
bash deploy/add-operator.sh buskita  transity.web.id 5010   # → /srv/transity/buskita-terminal/
bash deploy/add-operator.sh trans    transity.web.id 5020   # → /srv/transity/trans-terminal/
```

Script otomatis bikin (sesuai slug yang kamu masukin):
1. Folder `<BASE_DIR>/<slug>-terminal/` dengan repo Terminal di-clone
2. File `.env` dengan `TERMINAL_PORT`, `TERMINAL_SERVICE_KEY` (random), `JWT_SECRET` (random)
3. Nginx vhost `<NGINX_CONF_DIR>/terminal-<slug>.conf` dari template

Setelah script jalan, kamu **tetap manual** untuk tiap operator:
1. Edit `.env` — set `DATABASE_URL` asli operator
2. `createdb <slug>_terminal` di Postgres
3. Insert row tabel `operators` di Console DB (slug, api_url, service_key dari output script, tenant_id)
4. Daftar tenant baru di Realmio
5. `certbot --standalone -d terminal-<slug>.<domain>`
6. `cd <BASE_DIR>/<slug>-terminal && docker compose up -d --build`
7. `nginx -t && systemctl reload nginx`

### Kenapa Terminal pakai container_name + port dari env

`docker-compose.yml` Terminal sudah pakai variabel:

```yaml
container_name: ${OPERATOR_SLUG:-default}-terminal
ports:
  - "127.0.0.1:${TERMINAL_PORT:-5000}:5000"
```

Jadi **1 Dockerfile + 1 docker-compose** bisa di-deploy berkali-kali dengan `.env` berbeda per operator. **Tanpa fork repo per operator.**

### Verifikasi semua Terminal jalan

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep terminal

# Contoh hasil (ganti <slug-N> dengan nama operatormu):
# <slug-1>-terminal  Up 2h (healthy)   127.0.0.1:5000->5000/tcp
# <slug-2>-terminal  Up 1h (healthy)   127.0.0.1:5010->5000/tcp
# <slug-3>-terminal  Up 30m (healthy)  127.0.0.1:5020->5000/tcp
```

### Update / redeploy 1 operator saja

Operator lain tetap jalan tanpa terganggu:

```bash
cd <BASE_DIR>/<slug>-terminal      # mis. /srv/transity/buskita-terminal
git pull
docker compose up -d --build
```

### Pisah VPS per operator (kalau load besar)

Pola yang sama tetap dipakai — pindahin folder `<BASE_DIR>/<slug>-terminal/` ke VPS baru, sesuaikan DNS subdomain, set `OPERATOR_TERMINAL_URL_OVERRIDE` di Console kalau perlu reach via internal IP.

Untuk skala besar kalau perlu scale Terminal horizontal di 1 operator:
- Tambah Redis adapter di Terminal Socket.IO supaya event antar instance ter-sync
- Itu task code terpisah — saat ini setup valid untuk 1 instance per Terminal

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
