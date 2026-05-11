# Blue/Green Deploy — TransityTerminal

**Audience:** DevOps / sysadmin yang setup VPS production.
**Goal:** zero-downtime deploy via dua systemd unit (BLUE + GREEN) +
nginx upstream switch.

---

## Topologi

```
                       ┌─────────────────────────┐
       Internet ─────► │  nginx (port 80/443)    │
                       │  upstream transity_app  │
                       │   ↓ (symlink)           │
                       │  transity-app.conf      │
                       │   → blue OR green       │
                       └────────────┬────────────┘
                                    │ proxy_pass
              ┌─────────────────────┼─────────────────────┐
              ▼                                           ▼
        ┌──────────┐                              ┌──────────┐
        │ transity │                              │ transity │
        │ -blue    │                              │ -green   │
        │ :5000    │                              │ :5001    │
        └────┬─────┘                              └────┬─────┘
             └────────────────┬───────────────────────┘
                              ▼
                     ┌──────────────────┐
                     │  Postgres (1×)   │
                     └──────────────────┘
```

Hanya satu warna yang aktif (di-pointer oleh nginx symlink). Warna
satunya dimatikan untuk hemat memory.

---

## File systemd

`/etc/systemd/system/transity-blue.service`:

```ini
[Unit]
Description=TransityTerminal (BLUE)
After=network.target postgresql.service

[Service]
Type=simple
User=transity
WorkingDirectory=/opt/transity-terminal
EnvironmentFile=/etc/transity/blue.env
Environment=PORT=5000
Environment=RUN_MIGRATIONS_ON_BOOT=false
ExecStart=/usr/bin/pnpm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/transity-green.service` — sama persis tapi
`Description=...(GREEN)` dan `Environment=PORT=5001`. EnvironmentFile
boleh sama (`/etc/transity/blue.env`) kalau env identik antar warna.

> **Penting:** `RUN_MIGRATIONS_ON_BOOT=false` (S3-08) supaya dua node
> tidak race ALTER TABLE. Migrasi dijalankan SATU KALI oleh
> `scripts/db-migrate.ts` di deploy script.

---

## File nginx

`/etc/nginx/upstreams/transity-blue.conf`:

```nginx
upstream transity_app {
    server 127.0.0.1:5000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}
```

`/etc/nginx/upstreams/transity-green.conf`:

```nginx
upstream transity_app {
    server 127.0.0.1:5001 max_fails=3 fail_timeout=10s;
    keepalive 32;
}
```

Live config (symlink):

```bash
ln -sfn /etc/nginx/upstreams/transity-blue.conf /etc/nginx/upstreams/transity-app.conf
```

Server block utama include:

```nginx
include /etc/nginx/upstreams/transity-app.conf;

server {
    listen 443 ssl http2;
    server_name terminal.example.com;
    # ... ssl config ...

    location / {
        proxy_pass http://transity_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://transity_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

---

## State file

```bash
mkdir -p /etc/transity
echo "blue" > /etc/transity/active.color
chown transity:transity /etc/transity/active.color
```

---

## Cutover (deploy script)

```bash
sudo /opt/transity-terminal/scripts/deploy-blue-green.sh
```

Script (`scripts/deploy-blue-green.sh`) akan:

1. Baca warna aktif dari `/etc/transity/active.color`.
2. Jalankan `pnpm tsx scripts/db-migrate.ts` — exit kalau gagal.
3. `systemctl restart transity-<idle>.service`.
4. Loop curl `http://127.0.0.1:<idle-port>/api/health/clock` sampai 200
   (timeout 60 detik).
5. Re-symlink `/etc/nginx/upstreams/transity-app.conf` ke warna idle.
6. `nginx -t && nginx -s reload`.
7. Drain 10 detik, lalu `systemctl stop transity-<old>.service`.
8. Tulis warna baru ke `/etc/transity/active.color`.

Total downtime perceived user: 0 (nginx reload + drain bersih).

---

## Rollback

Kalau deploy baru menunjukkan error spike di Sentry/log, balik ke
warna sebelumnya:

```bash
# Manual rollback (tanpa migrasi DB — jangan revert migration!):
OLD=blue   # warna sebelum deploy gagal
NEW=green  # warna yang baru saja di-cutover

systemctl restart "transity-${OLD}.service"
# tunggu health
ln -sfn /etc/nginx/upstreams/transity-${OLD}.conf /etc/nginx/upstreams/transity-app.conf
nginx -t && nginx -s reload
sleep 10
systemctl stop "transity-${NEW}.service"
echo "$OLD" > /etc/transity/active.color
```

> **Catatan**: migration baru yang sudah jalan tetap di-keep. Pastikan
> kode lama backward-compatible dengan schema baru. Kalau migration
> introducing breaking change, tolak deploy via review.

---

## Smoke test post-deploy

```bash
# 1. Health
curl -fsS https://terminal.example.com/api/health/clock | jq .status
# expect: "ok"

# 2. Deep health
curl -fsS -H "X-Service-Key: $TERMINAL_SERVICE_KEY" \
     https://terminal.example.com/api/health/deep | jq .status
# expect: "ok" (atau "degraded" dengan checks.realmio="skip" kalau Realmio belum disetup)

# 3. WS handshake
node -e "const {io} = require('socket.io-client');
         const s = io('https://terminal.example.com', {auth: {serviceKey: process.env.TERMINAL_SERVICE_KEY}});
         s.on('connect', () => { console.log('WS OK'); s.close(); });
         s.on('connect_error', e => { console.error('WS FAIL', e.message); process.exit(1); });"

# 4. Smoke: 10 booking via Console mock
pnpm tsx scripts/engine-smoke-test.sh
```

---

## Acceptance (S3-09 + GL-13)

- [x] Script `scripts/deploy-blue-green.sh` ada + executable.
- [x] Setup ini dijalankan di staging dulu, durasi total < 90 detik.
- [x] Selama cutover, request inflight tidak gagal (drain 10s + nginx
      keepalive).
- [x] Rollback ada path manual yang documented.
