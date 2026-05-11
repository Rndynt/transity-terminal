# Runbook — Aktivasi Reservation Engine di Terminal

**Audience**: Ops / DevOps yang akan mengaktifkan sidecar engine di production
**Sprint**: 2 / S2-10
**Estimated time**: 30–45 menit (termasuk smoke-test)

Engine adalah sidecar Rust yang memegang seat inventory & hold ledger.
Aktivasi memindahkan ownership dari Terminal (Node) ke engine, jadi
**urutan & verifikasi setiap step kritis**. Kalau salah urutan, seat yang
sudah di-hold di Node bisa diabaikan engine → double-booking.

---

## Pre-flight checklist

Sebelum mulai, pastikan:

- [ ] `RESERVATION_ENGINE_HMAC_SECRET` sudah di-generate (>=16 karakter, random).
      Cara: `openssl rand -hex 32`. Simpan di vault — pakai SAMA di Terminal & engine.
- [ ] Database backup terakhir < 24 jam (kalau perlu rollback).
- [ ] Maintenance window 30 menit (booking baru tetap bisa, tapi siap-siap pause kalau ada masalah).
- [ ] Akses ke server engine + Terminal (SSH atau dashboard hosting).
- [ ] `jq`, `openssl`, `python3`, `curl` ter-install di mesin yang menjalankan smoke-test.
- [ ] `TRIP_ID` & `SEAT_NO` test ready — pakai trip dummy di outlet test, BUKAN trip produksi.

## Step 1 — Konfigurasi env engine

Di mesin engine:

```bash
# /opt/transity/engine/.env (atau secret manager)
RESERVATION_ENGINE_HMAC_SECRET=<sama dengan Terminal>
HMAC_SKEW_SECS=60                         # S2-05: dinaikkan dari 30
ENGINE_DATABASE_URL=postgres://...        # database SAMA dengan TT
DB_MIN_CONN=2
DB_MAX_CONN=10
REAPER_INTERVAL_SECS=60
REDIS_URL=redis://...                     # opsional, untuk multi-instance
RUST_LOG=info
```

Verifikasi:
```bash
cd deploy/engine
docker compose -f docker-compose.engine.yml --env-file ../path/to/.env config
```

Output harus tidak ada warning "unset variable".

## Step 2 — Start engine sidecar (FLAG OFF di Terminal)

```bash
docker compose -f deploy/engine/docker-compose.engine.yml up -d engine
docker compose -f deploy/engine/docker-compose.engine.yml ps
```

Tunggu 30 detik, lalu cek health:
```bash
curl -s http://127.0.0.1:8000/api/v1/healthz
# Expected: {"service":"reservation-engine","status":"ok"}
```

Cek log error:
```bash
docker compose -f deploy/engine/docker-compose.engine.yml logs engine | tail -50
```

Cari `ERROR` atau `panic`. Kalau ada masalah connection ke DB → fix dulu sebelum lanjut.

## Step 3 — Smoke-test handshake (Terminal masih flag OFF)

Di mesin Terminal (atau jump host yang bisa reach engine):

```bash
export ENGINE_BASE_URL=http://127.0.0.1:8000   # atau IP engine
export RESERVATION_ENGINE_HMAC_SECRET=<sama dengan engine>
export TRIP_ID=<uuid trip dummy di outlet test>
export SEAT_NO=1A
export OPERATOR_ID=<uuid operator test>
export LEG_INDEXES=0

./scripts/engine-smoke-test.sh
```

**Expected output (semua PASS)**:
```
[smoke] 0/4 HEALTHZ
[smoke] healthz: {"service":"reservation-engine","status":"ok"}
[smoke] 1/4 HOLD ...
[smoke] hold_ref=...
[smoke] 2/4 CONFIRM ...
[smoke] confirm OK
[smoke] 3/4 CANCEL-SEATS
[smoke] cancel-seats OK
[smoke] 4/4 INVENTORY
[smoke] inventory OK
[smoke] PASS
```

**Kalau FAIL**:
- `401 INVALID_SIGNATURE` → secret tidak match. Cek vault sekali lagi.
- `401 TIMESTAMP_SKEW` → clock drift. Cek `/api/health/clock` di Terminal vs `date` di engine box. Skew sudah 60s (S2-05) — kalau masih fail, NTP belum sync.
- `Connection refused` → engine tidak listen. Cek docker logs.

**STOP di sini kalau smoke-test belum hijau** — jangan flip flag.

## Step 4 — Flip Terminal flag

Di Terminal:

```bash
# .env Terminal
RESERVATION_ENGINE_ENABLED=true
RESERVATION_ENGINE_URL=http://127.0.0.1:8000   # atau IP engine
RESERVATION_ENGINE_HMAC_SECRET=<sama>
RESERVATION_ENGINE_SERVICE_ID=terminal
```

Restart Terminal:
```bash
# Sesuai cara hosting: pm2 reload, systemctl restart, kubectl rollout, dst.
```

Tunggu 30 detik lalu verify:

```bash
curl -s -H "X-Service-Key: $TERMINAL_SERVICE_KEY" http://127.0.0.1:5000/api/health/deep | jq
```

**Expected**:
```json
{
  "status": "ok",
  "checks": {
    "db": {"status": "ok", "latencyMs": 10},
    "engine": {"status": "ok", "latencyMs": 15, "detail": "service=reservation-engine"},
    "compensationQueue": {"status": "ok", "detail": "dlq=0 nearCap=0"}
  }
}
```

Cek log Terminal harus include:
```
[SCHEDULER] RESERVATION_ENGINE_ENABLED=true — local hold reaper and orphan-ref cleanup are DISABLED.
```

## Step 5 — Verifikasi end-to-end via UI

1. Login CSO/operator di outlet test.
2. Buat booking baru — pilih kursi.
3. Verify booking masuk DB Terminal + seat ledger di engine inventory.
4. Cancel booking tersebut.
5. Verify seat available lagi di seatmap.

```bash
# Quick check via inventory endpoint:
./scripts/engine-smoke-test.sh   # ulang sekali lagi pasca flag-on
```

Monitor log Terminal 5 menit:
```bash
tail -f /var/log/transity-terminal.log | grep -E "ENGINE_COMP_QUEUE|ALERT|engine"
```

Cari `[ALERT]` atau `compensation queue:.*drained`. Drain count > 0 normal (cuma backlog dari fase transisi). `[ALERT]` = stop, investigate.

## Rollback

Kalau ada masalah:

```bash
# .env Terminal
RESERVATION_ENGINE_ENABLED=false

# Restart Terminal
```

Engine sidecar boleh tetap jalan — tidak akan di-call. Item yang sudah masuk
`engine_compensation_queue` boleh dibiarkan, tidak akan diproses (no-op saat
flag off). Saat flag dinyalakan lagi, queue akan di-drain otomatis.

Untuk rollback total (flush queue):
```sql
-- Jangan lakukan tanpa ijin engineering!
TRUNCATE TABLE engine_compensation_queue;
```

## Post-activation monitoring (24 jam pertama)

Tiap jam, cek:
- `/api/health/deep` → semua subsystem `ok`.
- `[ALERT] {"alert":"engine_compensation_dlq",...}` di log → 0 occurrence.
- Jumlah row di `engine_compensation_queue WHERE dead_lettered_at IS NULL AND attempts > 5` → harus stabil/turun.

Setelah 24 jam stabil, aktivasi dianggap selesai. Update incident log
internal & tutup ticket.
