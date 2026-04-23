# Reservation Engine — deploy guide

Engine adalah Rust sidecar yang opsional untuk operator besar (>1.000
booking/hari atau >10 CSO konkuren). Operator kecil tinggal biarkan
`RESERVATION_ENGINE_ENABLED=false` — TT pakai jalur Node lama, byte-identical.

## Arsitektur per VPS operator

```
[VPS Operator]
  network: transity-terminals-net
  ├── transity-terminal-<slug>   (Node, exposed via Nginx)
  └── transity-engine-<slug>     (Rust, internal-only, port 8000)
        ↓ keduanya ke
        DATABASE_URL  (Neon project operator)
```

Engine tidak pernah terekspos ke internet. Hanya container `terminal` yang
bisa hit `http://engine:8000` lewat docker network internal.

---

## Setup awal per VPS (sekali saja)

```bash
# 1. Pastikan docker network shared sudah ada
docker network create transity-terminals-net 2>/dev/null || true

# 2. Login ke GHCR supaya bisa pull image engine (kalau image private)
echo "$GITHUB_PAT" | docker login ghcr.io -u <github-username> --password-stdin
# PAT cukup scope: read:packages

# 3. Append var engine ke .env operator
cat deploy/engine/.env.engine.example >> .env
# Lalu edit .env, isi:
#   RESERVATION_ENGINE_HMAC_SECRET (openssl rand -hex 32)
#   ENGINE_IMAGE_TAG               (mis. v1.0.0)
```

---

## Deploy / update

Cukup `./deploy.sh` di root TT seperti biasa. Script otomatis stack overlay
engine kalau `RESERVATION_ENGINE_ENABLED` ada di `.env`. Engine container akan
boot, jalankan migrasi, dan probe schema fail-fast.

```bash
./deploy.sh
```

Cek engine sehat dari dalam network:
```bash
docker compose exec terminal wget -qO- http://engine:8000/api/v1/healthz
# Harus: {"status":"ok",...}
```

---

## Cutover flag (per operator, tanpa rebuild)

Engine soak idle dulu 1–3 hari sambil flag `false`. Saat siap cutover:

```bash
# edit .env operator
sed -i 's/^RESERVATION_ENGINE_ENABLED=false/RESERVATION_ENGINE_ENABLED=true/' .env

# restart TT saja (~2 detik), engine tetap jalan
docker compose -f docker-compose.yml -f deploy/engine/docker-compose.engine.yml \
  restart terminal
```

Rollback = balik ke `false` + restart terminal. Hold yang sedang aktif tetap
valid karena tabel `seat_holds` sama-sama dipakai kedua mode.

---

## Smoke test post-deploy

```bash
ENGINE_BASE_URL=http://127.0.0.1:8000 \
ENGINE_HMAC_SECRET="$(grep RESERVATION_ENGINE_HMAC_SECRET .env | cut -d= -f2)" \
TRIP_ID=<trip-uuid> SEAT_NO=1A OPERATOR_ID=<operator-uuid> \
  docker compose exec engine /usr/bin/env bash -lc \
  "$(cat scripts/engine-smoke-test.sh)"
```

Exit non-zero = gagal. Cek `docker compose logs engine` untuk detail.

---

## Operasional

- **Memori**: idle ~15 MB, peak ~50–80 MB.
- **Compensation queue**: kalau engine drop tepat saat TT post-commit, baris
  masuk `engine_compensation_queue`. Scheduler retry tiap menit. Audit:
  ```sql
  SELECT * FROM engine_compensation_queue WHERE attempts >= 50;
  ```
- **Logs**: `docker compose logs -f engine` (structured JSON).
- **Ganti image**: edit `ENGINE_IMAGE_TAG` di `.env`, lalu `./deploy.sh`.
