# Panduan Deploy Transity Terminal ke VPS

Dokumentasi ini menjelaskan cara deploy Transity Terminal sebagai whitelabel untuk masing-masing operator shuttle.

---

## Arsitektur

```
Realmio (Auth Terpusat)
  ├── tenant: nusa-shuttle         ← semua user milik Nusa Shuttle
  ├── tenant: buskita-shuttle      ← semua user milik BusKita
  └── tenant: transity-ota         ← user Transity OTA (nanti)

VPS
  ├── nusa-terminal.transity.web.id     → Terminal instance Nusa Shuttle
  │     ├── Fastify backend (port 5000)
  │     ├── React frontend (built)
  │     └── PostgreSQL database (sendiri)
  │
  └── buskita-terminal.transity.web.id  → Terminal instance BusKita
        ├── Fastify backend (port 5001)
        ├── React frontend (built)
        └── PostgreSQL database (sendiri)
```

Setiap operator mendapatkan:
- **1 instance terminal** (backend + frontend)
- **1 database PostgreSQL** sendiri
- **1 tenant ID** di Realmio
- **1 subdomain** di bawah transity.web.id

---

## Prasyarat VPS

- Node.js 20+
- PostgreSQL 15+
- Nginx (reverse proxy)
- PM2 (process manager)
- Domain sudah di-pointing ke IP VPS

---

## Langkah Deploy (Per Operator)

### 1. Buat Database

```bash
sudo -u postgres psql
CREATE DATABASE nusa_terminal;
CREATE USER nusa_user WITH PASSWORD 'password_aman_disini';
GRANT ALL PRIVILEGES ON DATABASE nusa_terminal TO nusa_user;
\q
```

### 2. Daftarkan Tenant di Realmio

Hubungi admin Realmio untuk mendaftarkan tenant baru. Info yang didapat:

| Info | Contoh Nusa Shuttle |
|---|---|
| `AUTHCORE_TENANT_ID` | `nusa-shuttle` |
| `AUTHCORE_BASE_URL` | `https://transity.realmio.web.id` |

Minta juga admin Realmio menambahkan domain `nusa-terminal.transity.web.id` ke `TRUSTED_ORIGINS`.

### 3. Clone & Setup Project

```bash
cd /opt
git clone <repo-url> nusa-terminal
cd nusa-terminal

npm install
```

### 4. Buat File Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# === DATABASE ===
DATABASE_URL=postgresql://nusa_user:password_aman_disini@localhost:5432/nusa_terminal

# === AUTH (Realmio) ===
AUTHCORE_BASE_URL=https://transity.realmio.web.id
AUTHCORE_TENANT_ID=nusa-shuttle

# === SERVER ===
NODE_ENV=production
PORT=5000

# === OPSIONAL ===
# DEV_BYPASS_AUTH=false   (jangan aktifkan di production!)
```

### 5. Build Frontend & Push Schema

```bash
npm run build
npm run db:push --force
```

### 6. Seed Data Awal (Opsional)

Buat user owner pertama via Realmio:

```bash
curl -X POST https://transity.realmio.web.id/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: nusa-shuttle" \
  -d '{
    "email": "admin@nusashuttle.com",
    "password": "PasswordAman123!",
    "name": "Admin Nusa"
  }'
```

Catat `user.id` dari response, lalu assign role owner di database terminal:

```sql
-- Jalankan di database nusa_terminal
INSERT INTO staff_members (user_id, role_id, outlet_id)
VALUES ('<user-id-dari-realmio>', '<role-id-owner>', NULL);
```

### 7. Jalankan dengan PM2

```bash
pm2 start npm --name "nusa-terminal" -- run start
pm2 save
pm2 startup
```

Atau buat `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: "nusa-terminal",
    script: "npm",
    args: "run start",
    cwd: "/opt/nusa-terminal",
    env: {
      NODE_ENV: "production",
      PORT: 5000,
    },
  }],
};
```

### 8. Setup Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name nusa-terminal.transity.web.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nusa-terminal.transity.web.id;

    ssl_certificate     /etc/letsencrypt/live/nusa-terminal.transity.web.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nusa-terminal.transity.web.id/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Generate SSL:
```bash
sudo certbot --nginx -d nusa-terminal.transity.web.id
```

---

## Environment Variables Reference

| Variable | Wajib | Default | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | Ya | - | Connection string PostgreSQL |
| `AUTHCORE_BASE_URL` | Ya (prod) | `""` | URL Realmio |
| `AUTHCORE_TENANT_ID` | Ya (prod) | `transity` | Tenant ID di Realmio |
| `NODE_ENV` | Ya | `development` | Set `production` untuk deploy |
| `PORT` | Tidak | `5000` | Port Fastify server |
| `DEV_BYPASS_AUTH` | Tidak | `false` | `true` = skip auth (dev only!) |

---

## Alur Autentikasi

```
Browser (CSO Operator)
  │
  ├─► POST /api/auth/sign-in/email
  │     └─► Terminal proxy ke Realmio dengan X-Tenant-Id
  │           └─► Realmio validasi, return session + set cookie
  │
  ├─► GET /api/auth/session
  │     └─► Terminal proxy ke Realmio get-session
  │           └─► Realmio cek cookie/token, return user data
  │
  └─► GET /api/bookings (dst.)
        └─► Terminal middleware: requireAuth
              └─► Verifikasi session via Realmio
              └─► Attach RBAC permissions dari database lokal
              └─► Execute business logic
```

### Pembagian Role

| Role | Bisa Login Di | Keterangan |
|---|---|---|
| `staff` | Terminal (CSO) | Karyawan operator: CSO, kasir, admin |
| `user` | Mobile app / OTA | End-user/penumpang |
| `owner` | Terminal (CSO) | Pemilik operator, full access |

Role disimpan di Realmio. Terminal hanya memeriksa role saat login — `staff` dan `owner` boleh akses, `user` ditolak.

---

## Multi-Operator: Checklist Deploy Operator Baru

Untuk setiap operator baru, ulangi langkah berikut:

- [ ] Buat database PostgreSQL baru
- [ ] Daftarkan tenant baru di Realmio
- [ ] Tambahkan domain ke TRUSTED_ORIGINS di Realmio
- [ ] Clone project ke directory baru (`/opt/<nama>-terminal`)
- [ ] Set environment variables (`.env`)
- [ ] Build frontend & push schema
- [ ] Buat user owner pertama via Realmio sign-up
- [ ] Assign role owner di database terminal
- [ ] Setup PM2 process
- [ ] Setup Nginx reverse proxy + SSL
- [ ] Kustomisasi brand via halaman Pengaturan (`/admin/settings`)

---

## Kustomisasi Brand Per Operator

Setelah deploy, operator bisa kustomisasi tampilan terminal via halaman **Pengaturan** (`/admin/settings`):

- Nama brand (muncul di sidebar)
- Tagline
- Logo (URL)
- Warna utama, sekunder, aksen

Pengaturan ini disimpan di tabel `operator_settings` di database masing-masing operator.

---

## Contoh Setup 2 Operator di 1 VPS

```
/opt/nusa-terminal/     → PORT=5000, DB=nusa_terminal,   TENANT=nusa-shuttle
/opt/buskita-terminal/  → PORT=5001, DB=buskita_terminal, TENANT=buskita-shuttle
```

Nginx:
```
nusa-terminal.transity.web.id    → proxy_pass http://127.0.0.1:5000
buskita-terminal.transity.web.id → proxy_pass http://127.0.0.1:5001
```

Setiap instance punya database sendiri, tenant Realmio sendiri, dan kustomisasi brand sendiri. Data antar operator sepenuhnya terisolasi.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Login gagal / 502 | Cek `AUTHCORE_BASE_URL` benar dan Realmio bisa diakses dari VPS |
| CORS error di browser | Pastikan domain sudah terdaftar di TRUSTED_ORIGINS Realmio |
| Sidebar tetap "Transity" | Ubah via `/admin/settings`, atau cek tabel `operator_settings` |
| Auth bypass di production | Pastikan `DEV_BYPASS_AUTH` tidak di-set atau `false` |
| Database connection error | Cek `DATABASE_URL` dan pastikan PostgreSQL berjalan |
