# Reservation Engine — deploy guide

Engine = Rust sidecar opsional untuk operator besar. Operator kecil biarkan
`RESERVATION_ENGINE_ENABLED=false` — TT pakai jalur Node lama, identik perilaku.

**Penting**: `deploy.sh` di root TT TIDAK menyentuh engine. Engine punya
command-nya sendiri di bawah supaya rebuild/restart TT sehari-hari tetap
secepat sebelumnya tanpa risiko nyentuh engine.

---

## Arsitektur per VPS operator

```
[VPS]
  network: transity-terminals-net
  ├── transity-terminal-<slug>   (Node, dikelola oleh ./deploy.sh seperti biasa)
  └── transity-engine-<slug>     (Rust, image dari GHCR, dikelola manual via command di bawah)
        ↓ keduanya ke
        DATABASE_URL  (Neon project operator)
```

Engine port 8000 internal-only, gak terekspos ke host.

---

## Setup awal per VPS (sekali doang)

```bash
cd /path/to/TransityTerminal
git pull   # ambil deploy/engine/

# 1. Network shared (idempotent)
docker network create transity-terminals-net 2>/dev/null || true

# 2. Login GHCR (kalau image private — skip kalau public)
echo "$READONLY_PAT" | docker login ghcr.io -u <github-user> --password-stdin

# 3. Append var engine ke .env operator yang sudah ada
cat deploy/engine/.env.engine.example >> .env
nano .env
#   isi RESERVATION_ENGINE_HMAC_SECRET (openssl rand -hex 32)
#   isi ENGINE_IMAGE_TAG=v1.0.0
#   biarkan RESERVATION_ENGINE_ENABLED=false dulu
```

---

## Workflow harian (TT vs engine, terpisah)

### Restart / rebuild TT seperti biasa

```bash
./deploy.sh
```

Identik dengan sebelumnya: pull git → rebuild image TT → up -d. Engine
container TIDAK disentuh sama sekali.

### Bring up engine sidecar (sekali, atau saat ENGINE_IMAGE_TAG berubah)

```bash
docker compose \
  -f docker-compose.yml \
  -f deploy/engine/docker-compose.engine.yml \
  pull engine

docker compose \
  -f docker-compose.yml \
  -f deploy/engine/docker-compose.engine.yml \
  up -d engine
```

`pull engine` ambil image baru dari GHCR. `up -d engine` cuma recreate engine.
TT tidak ke-restart.

### Restart engine doang (mis. setelah ganti env engine)

```bash
docker compose \
  -f docker-compose.yml \
  -f deploy/engine/docker-compose.engine.yml \
  restart engine
```

### Cek log / status engine

```bash
docker compose -f docker-compose.yml -f deploy/engine/docker-compose.engine.yml logs -f engine
docker compose -f docker-compose.yml -f deploy/engine/docker-compose.engine.yml ps engine
```

### Stop engine total (rollback ke TT-only)

```bash
docker compose -f docker-compose.yml -f deploy/engine/docker-compose.engine.yml stop engine
docker compose -f docker-compose.yml -f deploy/engine/docker-compose.engine.yml rm -f engine
```

TT tetap jalan tanpa terganggu. Set `RESERVATION_ENGINE_ENABLED=false` di
`.env`, lalu `./deploy.sh` untuk restart TT supaya kembali ke jalur Node.

---

## Cutover flag (per operator)

Engine soak idle 1–3 hari dulu sambil flag `false`. Saat siap cutover:

```bash
sed -i 's/^RESERVATION_ENGINE_ENABLED=false/RESERVATION_ENGINE_ENABLED=true/' .env
./deploy.sh    # restart TT supaya baca .env baru — engine TIDAK disentuh
```

Rollback = balik ke `false`, `./deploy.sh` lagi. Hold yang aktif tetap valid.

---

## Smoke test

```bash
ENGINE_BASE_URL=http://127.0.0.1:8000 \
ENGINE_HMAC_SECRET="$(grep RESERVATION_ENGINE_HMAC_SECRET .env | cut -d= -f2)" \
TRIP_ID=<trip-uuid> SEAT_NO=1A OPERATOR_ID=<op-uuid> \
  bash scripts/engine-smoke-test.sh
```

---

## Operasional

- **Memory**: idle ~15 MB, peak ~80 MB.
- **Compensation queue audit**:
  ```sql
  SELECT * FROM engine_compensation_queue WHERE attempts >= 50;
  ```
- **Update image**: edit `ENGINE_IMAGE_TAG` di `.env`, lalu jalankan blok
  "Bring up engine sidecar" di atas.
