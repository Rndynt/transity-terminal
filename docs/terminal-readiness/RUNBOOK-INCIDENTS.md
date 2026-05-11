# Incident Runbook — TransityTerminal

**Audience:** on-call ops / senior engineer.
**Tujuan:** prosedur step-by-step untuk 5 skenario insiden paling
mungkin terjadi di TransityTerminal (TT) production. Setiap skenario
ada *detection* → *triage* → *mitigation* → *postmortem hint*.

> **Sebelum mulai:** pastikan punya akses (SSH ke VPS, Console DB read,
> Sentry/Grafana dashboard). Telpon dulu dev-on-call jika menyentuh DB
> write atau cutover deploy.

---

## Skenario 1 — Reservation Engine DOWN

### Detection
- `/api/health/deep` `checks.engine.status = "fail"`.
- Spike error log `[engine] fetch failed` atau `EAI_AGAIN`.
- Booking flow menampilkan toast `"Engine timeout"` atau seat
  langsung lepas tanpa konfirmasi.

### Triage (5 menit)
1. SSH ke VPS engine: `systemctl status transity-engine`.
2. Cek `/api/v1/healthz` dari TT host:
   ```bash
   curl -fsS -m 3 "$RESERVATION_ENGINE_URL/api/v1/healthz" || echo "DOWN"
   ```
3. Cek HMAC clock skew di TT: `curl -s $TT_URL/api/health/clock`
   bandingkan dengan `date -u` di engine VPS. Drift > 60s = HMAC reject.

### Mitigation
**Opsi A — engine recoverable (<5 min):**
1. `systemctl restart transity-engine` di engine VPS.
2. Pantau `/api/health/deep` sampai `engine.status="ok"`.
3. Cek `compensationQueue.detail` — kalau `dlq>0`, jalankan `scripts/cq-replay.ts` (lihat S2-04 audit).

**Opsi B — engine tidak recoverable cepat:**
1. Set ENV `RESERVATION_ENGINE_ENABLED=false` di TT (Replit Secrets atau `.env`).
2. Restart TT workflow → traffic balik ke jalur legacy (DB hold).
3. Comm ops: ada degradation hold-window 10 menit (legacy default), bukan engine 30 detik.

### Postmortem hint
- Cek apa yang trigger crash engine: log `journalctl -u transity-engine -n 200`.
- Jika OOM: bump VPS RAM; jika DB pool exhaustion: tune `max_connections`.
- Apakah ada race condition di compensation queue replay? Lihat
  AUDIT-S2-03-RESCHEDULE-CHAOS.md.

---

## Skenario 2 — Database (Postgres) DOWN

### Detection
- `/api/health/deep` `checks.db.status="fail"`.
- Spike 503 di semua route, log `Connection terminated unexpectedly`
  atau `password authentication failed`.

### Triage (3 menit)
1. Cek host DB: `psql $DATABASE_URL -c "SELECT 1"`.
2. Replit-managed DB: cek dashboard Replit → Database → status hijau?
3. Self-hosted: `systemctl status postgresql; df -h` (penuh disk?).

### Mitigation
**Read-only mode (degradation):**
1. Belum ada flag global read-only — workaround: set rate limit
   sangat ketat (`RATE_LIMIT_MAX=10`) supaya tidak memperburuk DB.
2. Comm ops: TT down 5-15 menit, booking digital tertunda.

**Restore:**
1. Replit-managed: tunggu auto-recovery. Tidak bisa intervensi langsung.
2. Self-hosted: `systemctl restart postgresql`. Kalau corrupt, restore
   dari snapshot terakhir (lihat `S5-03 backup restore drill`).

### Postmortem hint
- Apakah ada query lambat yang lock-up DB? Cek `pg_stat_activity WHERE state='active'`.
- Migration boot blocking? Set `RUN_MIGRATIONS_ON_BOOT=false` (S3-08) +
  pisahkan ke script.
- Connection pool exhausted? Tune `pg.Pool` config (lihat S4-04).

---

## Skenario 3 — Realmio (auth provider) DOWN

### Detection
- `/api/health/deep` `checks.realmio.status="fail"` atau timeout 3s.
- Login operator gagal massal: `[realmio] auth failed: ECONNREFUSED`.
- `/api/auth/session` return 502/504.

### Triage (5 menit)
1. Curl Realmio dari TT: `curl -m 5 $REALMIO_BASE_URL/health`.
2. Cek Realmio status page (atau telpon Realmio team).
3. Cek apakah API key sudah expired: log `[realmio] 401 unauthorized`.

### Mitigation
**Sesi yang sudah aktif tetap jalan** (token JWT TT lokal valid 24 jam).
Yang kena hanya login baru / refresh.

1. Comm ops: minta operator JANGAN logout. Sesi aktif tetap bisa pakai.
2. Kalau Realmio down >1 jam: switch ke `DEV_BYPASS_AUTH` HARAM di
   production (boot guard tolak). Tunggu Realmio recovery atau pakai
   service-key fallback untuk emergency CSO.
3. Update status page TT ke "auth degraded".

### Postmortem hint
- Cache token JWT lebih panjang? Saat ini 24h — bisa naik ke 7 hari
  dengan refresh-grace-period.
- Tambah secondary auth path (local-only fallback admin)? Decision
  pending product team.

---

## Skenario 4 — Compensation Queue STUCK (DLQ growing)

### Detection
- `/api/health/deep` `checks.compensationQueue.detail` menunjukkan
  `dlq>0` atau `nearCap>0`.
- Sentry alert: `[cq][CRITICAL] item dead-lettered after 5 attempts`.

### Triage (10 menit)
1. Query DB: `SELECT id, action, attempts, last_error FROM engine_compensation_queue WHERE status='dead_lettered' ORDER BY updated_at DESC LIMIT 20;`.
2. Group by `last_error` — common cluster:
   - `engine 5xx` → engine downstream rusak; lihat Skenario 1.
   - `HMAC verify failed` → clock skew; lihat clock health.
   - `booking not found` → race state; perlu manual reconcile.

### Mitigation
**Per-item retry manual (after engine recovered):**
1. `scripts/cq-replay.ts <queue_id>` — reset `attempts=0`, `status='pending'`.
2. Pantau `/api/health/deep` → `dlq` turun.

**Bulk retry (>20 item):**
1. Pause writes baru: rate limit ketat.
2. SQL: `UPDATE engine_compensation_queue SET status='pending', attempts=0, last_error=NULL WHERE status='dead_lettered' AND created_at > NOW() - INTERVAL '1 day';`
3. Trigger scheduler manual: `scripts/cq-tick.ts`.

### Postmortem hint
- Apakah trigger awal sudah resolved? Jangan replay sebelum cause root fixed.
- Kalau >100 item DLQ: investigasi compensation logic — bisa jadi bug
  service yang push item invalid.

---

## Skenario 5 — Payment Webhook MISSED (provider retry diabaikan)

### Detection
- Booking status stuck di `pending_payment` lebih dari 1 jam padahal
  user sudah bayar (cek payment provider dashboard).
- Sentry alert: `[webhook] HMAC verify failed` spike, atau
  `[webhook] processed=0` saat trafik tinggi.

### Triage (5 menit)
1. Cek log: `grep -E "POST /api/payments/webhook" /var/log/...`. Ada
   request masuk tapi 401? = HMAC misconfig.
2. Cek payment provider replay attempts. Provider biasanya retry 3-5×
   dengan exponential backoff.
3. Cek kontrak idempotent: replay yang masuk sebelumnya harus return
   `{"idempotent":true}` (S2-09), BUKAN 500. Kalau 500, ada bug.

### Mitigation
**Manual reconcile (per-booking):**
1. Ambil `providerRef` dari payment provider dashboard.
2. Trigger replay: `curl -X POST $TT_URL/api/payments/webhook -H "X-Signature: ..." -d '{"providerRef":"...","status":"success"}'`.
3. Pantau `bookings.status` jadi `confirmed`.

**HMAC misconfig:**
1. Cek env `PAYMENT_WEBHOOK_HMAC_SECRET` sama di TT dan provider.
2. Cek clock skew (S2-05) — kalau drift > skew, tolak HMAC.

### Postmortem hint
- Apakah idempotent kontrak betul-betul aman? Lihat AUDIT-S2-09.
- Provider retry policy: dokumentasikan di RUNBOOK-PROVIDER-PAYMENTS.md
  (per-provider — Midtrans, Xendit, dll).

---

## Quick Reference — Healthcheck

```bash
# Liveness (no auth)
curl -fsS $TT_URL/api/health/clock | jq

# Deep (gated, butuh service key)
curl -fsS -H "X-Service-Key: $TERMINAL_SERVICE_KEY" \
     "$TT_URL/api/health/deep" | jq

# Per-subsystem field:
#   .checks.db          { status: "ok"|"fail"|"skip", latencyMs }
#   .checks.engine
#   .checks.compensationQueue
#   .checks.redis       (S3-06)
#   .checks.realmio     (S3-06)
```

## Eskalasi

| Severity | Response Time | Eskalasi |
|---|---|---|
| 🚨 CRITICAL — TT total down | <5 menit | Telpon dev-on-call + tech lead |
| 🟠 HIGH — 1 modul down (booking, payment) | <15 menit | Slack #incident + dev-on-call |
| 🟡 MED — degradation tanpa data loss | <1 jam | Slack #incident |
| 🟢 LOW — UX glitch | next business day | Issue tracker |
