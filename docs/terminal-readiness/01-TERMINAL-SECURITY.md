# TransityTerminal — Security Findings (Detailed, Per-Module)

**Skala Severity:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW
**Status:** ✅ Confirmed (verified in code) · ⚠ Suspected (needs verification)

---

## A. Authentication & Authorization

### A1. 🟠 HIGH — `DEV_BYPASS_AUTH` ada path aktivasi diam-diam di production
**Status**: ✅ Confirmed
**File**: `server/modules/auth/realmio.ts:16`

**Risk**: Jika `REALMIO_BASE_URL` kosong di production env, code path development bisa secara tidak sengaja aktif (DEV_BYPASS_AUTH=true di development tanpa Realmio). Tidak ada hard fail-fast guard pada boot.

**Evidence**:
```typescript
// server/modules/auth/realmio.ts:16
const DEV_BYPASS_AUTH =
  process.env.DEV_BYPASS_AUTH === 'true' ||
  (process.env.NODE_ENV !== 'production' && !process.env.REALMIO_BASE_URL);
```

Production sudah memberikan fatal jika `REALMIO_BASE_URL` hilang (line 19), namun **DEV_BYPASS_AUTH=true secara eksplisit** belum ditolak di production.

**Fix**:
```typescript
// server/index.ts boot guard
if (process.env.NODE_ENV === 'production') {
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    throw new Error('FATAL: DEV_BYPASS_AUTH cannot be true in production');
  }
  for (const key of ['JWT_SECRET', 'REALMIO_BASE_URL', 'TERMINAL_SERVICE_KEY', 'DATABASE_URL']) {
    if (!process.env[key]) {
      throw new Error(`FATAL: ${key} required in production`);
    }
  }
}
```

---

### A2. 🟢 RESOLVED — JWT secret production guard sudah ada
**Status**: ✅ Confirmed (verified after architect feedback)
**File**: `server/modules/app/app.auth.ts:7-13`

```typescript
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is required in production");
    }
    console.warn("[app.auth] JWT_SECRET env var not set. Using development fallback...");
    return "transity-dev-" + (process.env.REPL_ID || "local-dev-only");
  }
  return secret;
}
```

**Verdict**: Production sudah throw fatal kalau `JWT_SECRET` hilang. Dev fallback aman karena scoped ke development saja.

**Action**: 
- Verifikasi di staging environment: `NODE_ENV=production` di-set walau staging? (best practice ya)
- Document di runbook: "Staging harus pakai `NODE_ENV=production` untuk prevent fallback path"

---

### A3. 🟠 HIGH — Driver/Vehicle CRUD tidak cek RBAC di service layer
**Status**: ✅ Confirmed
**Files**: `server/modules/drivers/`, `server/modules/vehicles/`

**Risk**: Proteksi hanya di route middleware. Kalau ada internal API atau code-path lain yang call service langsung (e.g. dari other module), RBAC bypass.

**Fix**: Pindahkan `requireFlag('master.drivers')` check ke **service method** (seperti pattern SPJ yang sudah dilakukan B5).

---

### A4. 🔴 CRITICAL — Cashier session tidak isolate per-staff
**Status**: ✅ Confirmed
**File**: `server/modules/cashier/cashier.service.ts:15`

**Risk**: 1 outlet → 2 kasir shift overlap → mereka share 1 session, atau kasir kedua tidak bisa buka session sama sekali.

**Evidence**:
```typescript
// cashier.service.ts:15 (paraphrase)
const existing = await db.select().from(cashierSessions)
  .where(and(eq(cashierSessions.outletId, outletId), eq(cashierSessions.status, 'open')));
// Tidak ada filter staffId
```

**Fix**:
- Constraint: `unique (outlet_id, staff_id) where status = 'open'`
- Service: cek by `(outletId, staffId)`
- Reconciliation: hitung `systemAmount` filter by `(outletId, openedAt..closedAt, staffId)`

**Bisnis impact**: Kasir tidak bisa kerja paralel; reconciliation cash drawer salah perhitungan.

---

### A5. 🟠 HIGH — Customer JWT TTL terlalu panjang untuk B2C app (kalau dipakai TT app langsung)
**Status**: ⚠ Suspected (tergantung apakah customer login langsung ke TT atau via Console)
**File**: `server/modules/app/app.auth.ts`

**Action**: Kalau customer auth via Console only, ini OK (Console handle JWT). Verifikasi di flow `/api/app/auth/login` di Terminal — siapa user-nya?

---

## B. Data Privacy & Exposure

### B1. 🟠 HIGH — Cargo waybill PII publik
**Status**: ✅ Confirmed
**File**: `server/modules/cargo/cargo.controller.ts:41`

**Risk**: Endpoint `GET /api/.../by-waybill/:waybill` (atau equivalent) tidak verifikasi otorisasi. Format waybill `WB-YYMMDD-ID` mudah enumerasi. Attacker bisa scrape:
- Nama pengirim & penerima
- Nomor HP
- Alamat
- Isi paket

**Fix**:
- Wajibkan auth (RBAC `cargo.tracking` flag) ATAU
- Tambah `tracking_secret` (random 8-char) di waybill: `WB-YYMMDD-ID-XXXX`, hanya pemilik yang punya
- Rate limit: 10/menit per IP untuk endpoint ini

---

### B2. 🟡 MEDIUM (🟠 HIGH kalau audit regulasi) — NIK / ID Number plaintext
**Status**: ✅ Confirmed
**File**: `shared/schema/customers.ts:11` (`customer_profiles.id_number`)

**Risk**: Kalau DB di-leak, NIK 16 digit semua customer terbuka. UU PDP Indonesia mensyaratkan enkripsi data sensitif at-rest.

**Fix Options**:
1. **Pseudonymization**: simpan hash `sha256(nik || global_salt)` di kolom `id_number_hash`, plain text dipindah ke encrypted column dengan pgcrypto:
   ```sql
   ALTER TABLE customer_profiles ADD COLUMN id_number_encrypted bytea;
   UPDATE customer_profiles SET id_number_encrypted = pgp_sym_encrypt(id_number, $key);
   ALTER TABLE customer_profiles DROP COLUMN id_number;
   ```
2. **Application-level encryption** dengan KMS (AWS KMS, GCP KMS, atau libsodium).
3. **Minimal**: redact di logs, mask di UI staff (hanya show 6-digit awal: `1234XX••••••XXXX`).

---

### B3. 🟡 MEDIUM — Notifications table tanpa TTL/cleanup
**Status**: ✅ Confirmed
**File**: `server/modules/notifications/`, `shared/schema/notifications.ts`

**Risk**: Setiap booking, payment, status change spawn notification. Tabel bloat, query jadi lambat.

**Fix**:
- Scheduler job `cleanupOldNotifications()`:
  ```sql
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND read = true;
  ```
- Read+unread retention berbeda (read 30 hari, unread 90 hari).
- Add index `(created_at)` partial pada `read = true` untuk cleanup efisien.

---

### B4. 🟢 LOW — Customer ↔ App User tidak ada FK link
**Status**: ✅ Confirmed
**Risk**: Manual matching by phone bisa miss data history; reporting "lifetime value per customer" tidak akurat.
**Fix**: Add nullable `app_user_id` di `customer_profiles`, populate via merge job.

---

## C. Network & Transport Security

### C1. 🟠 HIGH — `@fastify/helmet` tidak terpasang
**Status**: ✅ Confirmed
**File**: `server/index.ts`

**Risk**: Missing security headers = lebih mudah XSS, clickjacking, MIME sniffing exploit.

**Fix**:
```typescript
import helmet from '@fastify/helmet';
await app.register(helmet, {
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // tighten if possible
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CONSOLE_BASE_URL || ''],
    },
  } : false,  // disable in dev for HMR
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
});
```

**Note**: Severity diturunkan dari "CRITICAL" (architect feedback) ke "HIGH" — defense in depth, bukan exploit langsung.

---

### C2. 🟡 MEDIUM — CORS terkonfigurasi per-route, tidak konsisten
**Status**: ✅ Confirmed (verified after architect feedback)
**File**: `server/modules/app/app.routes.ts:39-59` (route `/api/app/*`), `server/realtime/ws.ts:30-49` (WebSocket)

**State aktual**:
- ✅ `/api/app/*` punya CORS handler via preHandler hook (validates against `getAppCorsOrigin`)
- ✅ WebSocket layer punya `CORS_ORIGINS` validation
- ❌ Staff routes (`/api/bookings`, `/api/cargo`, `/api/cashier`, dll) tanpa CORS preHandler
- ❌ `/api/console/*` (console-driven endpoints) tanpa CORS

**Risk**: Defense-in-depth gap, bukan exploit langsung (CSRF protected by cookie SameSite + JWT). Kalau Console & TT di-host beda domain dengan CORS di reverse proxy (nginx) sudah cukup.

**Recommended Fix** (consistency):
```typescript
// server/index.ts — global registration
import cors from '@fastify/cors';
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  hook: 'preHandler',
});
```

Lalu remove per-route CORS handler di `app.routes.ts` & `console.routes.ts` (consolidate ke global).

**Severity diturunkan dari HIGH → MEDIUM** karena exploit path tidak langsung; defense-in-depth.

---

### C3. 🟡 MEDIUM — Logout cookie SameSite=Lax
**Status**: ⚠ Suspected (perlu lihat `auth.routes.ts`)
**Fix**: `SameSite=Strict` untuk session cookies di production.

---

## D. Authentication Surface

### D1. 🟡 MEDIUM — Login rate limit per-IP saja
**Status**: ✅ Confirmed (10/min per `B11`)
**Risk**: Distributed credential stuffing dari 1000 IP tetap bypass.
**Fix**:
- Rate limit per-(IP, username) — track attempts per username juga
- Implement `argon2` jika belum (bcrypt rounds 10 OK dulu)
- Add CAPTCHA setelah N gagal per username

### D2. 🟢 LOW — Password policy tidak terlihat
**Status**: ⚠ Suspected
**Fix**: Zod schema enforce min 10 chars, mix case + digit + symbol untuk staff & app users.

### D3. 🟡 MEDIUM — No refresh token rotation untuk app JWT (24h reset = re-login frequent)
**Status**: ✅ Confirmed (B10 turunkan TTL ke 24h tapi tidak ada refresh)
**Fix**: Implement refresh token (`httpOnly` cookie, rotate on use, 30d expiry) untuk B2C UX.

---

## E. Reservation Engine Security (Sidecar)

### E1. 🟠 HIGH — Engine HMAC secret strength
**Status**: ✅ Confirmed (engine validates ≥ 16 chars)
**File**: `engine-server/src/middleware/hmac.rs`

**Risk**: Kalau secret bocor, attacker bisa drive engine inventory langsung (bypass TT business logic).

**Fix**:
- Generate 32-byte random base64: `openssl rand -base64 32`
- Rotate setiap 90 hari (engine + TT update bersamaan)
- Document di runbook

### E2. 🟡 MEDIUM — Engine idempotency in-memory only
**Status**: ✅ Confirmed (Moka cache)
**File**: `engine-server/src/middleware/idempotency.rs:9-15`

**Risk**: Engine restart → idempotency window hilang → kalau TT retry POST sama, engine treat as new request → potential double-hold.

**Mitigation tier**:
- **Now**: TT side juga track idempotency (`bookings.idempotency_key` partial unique). Kalau engine succeed first call dan TT crash, retry pasti gagal di TT karena DB constraint. Net safe.
- **Later**: Migrate engine idempotency ke Redis (sudah ada `deadpool-redis` di Cargo.toml — tinggal switch implementation).

### E3. 🟡 MEDIUM — Clock skew NTP critical
**Status**: ✅ Confirmed (HMAC reject if skew > 30s)
**Risk**: TT vs Engine container clock drift > 30s → semua request gagal.
**Fix**:
- Document hard requirement: NTP enabled di host VPS
- Add health check: `engine /healthz` return current `ts_seconds`, TT compare local time
- Increase `HMAC_SKEW_SECS` ke 60s untuk safer margin

### E4. 🟡 MEDIUM — Compensation queue insert silent failure
**Status**: ✅ Confirmed
**File**: `compensationQueue.ts:61`

**Risk**: Kalau insert ke queue gagal (DB tidak responsif), log loss; seat bisa stuck booked di engine tapi TT think released.

**Fix**:
- Wrap insert di `try/catch` dengan retry 3x
- Kalau tetap gagal, write to local file `/tmp/comp_queue_dlq.jsonl` sebagai dead letter
- Sentry alert immediately

### E5. 🟢 LOW — Inventory snapshot read-only race
**Status**: ✅ Confirmed
**Risk**: Snapshot dari memory engine, kalau admin manual SQL `UPDATE seat_inventory`, engine cache stale sampai reaper run.
**Fix**: Document "no manual seat_inventory edits" di runbook + alert pada manual UPDATE via DB trigger log.

---

## F. CSRF / SSRF / Injection

### F1. 🟢 LOW — SQL injection
**Status**: ✅ Confirmed safe — Drizzle parameterized queries
**Note**: Reports module pakai `sql.raw` di beberapa tempat — verify input sanitization di query builder.

### F2. 🟢 LOW — SSRF via `url` field di operator config (Console-side)
**Status**: N/A untuk Terminal, applies to Console.

### F3. 🟡 MEDIUM — File upload (jika ada untuk vehicles, drivers photo)
**Status**: ⚠ Suspected (perlu cek upload endpoints)
**Fix**: Validate MIME type, size limit, virus scan, store di object storage (not local fs).

---

## G. Payment Webhook Security

### G1. 🟠 HIGH — Payment webhook idempotency belum di-verify ada di code
**Status**: ⚠ Suspected
**File**: `server/modules/payments/`

**Action**: Audit. Kalau provider retry webhook:
- Check `payments.provider_id` unique constraint
- Reject duplicate atau idempotent return

### G2. 🟠 HIGH — HMAC verify constant-time untuk webhook payment
**Status**: ⚠ Suspected
**Action**: Audit semua HMAC verify (Console webhook receiver, payment provider verify, Realmio verify) — pakai `crypto.timingSafeEqual` semuanya.

---

## H. Action Plan — Sprint Security (1 Minggu)

### Day 1-2: Critical
- [ ] **A4**: Fix cashier session per-staff (1 hari + migration)
- [ ] **B1**: Cargo waybill — auth requirement + tracking_secret (0.5 hari)
- [ ] **A1, A2**: Boot guard fail-fast untuk production secrets (2 jam)
- [ ] **C1, C2**: Install helmet + cors global (2 jam)

### Day 3-4: High
- [ ] **A3**: Move RBAC check ke service layer di drivers, vehicles, dan modul lain (1 hari)
- [ ] **B2**: Plan migration NIK encryption (design + migration draft) (0.5 hari)
- [ ] **B3**: Implement notifications cleanup scheduler (2 jam)
- [ ] **G1, G2**: Audit + fix payment webhook idempotency & HMAC constant-time (1 hari)

### Day 5: Engine + Operational
- [ ] **E1**: Generate strong engine HMAC secret + document rotation runbook (1 jam)
- [ ] **E3**: Increase HMAC skew to 60s + clock health check (1 jam)
- [ ] **E4**: Compensation queue DLQ + Sentry alert (2 jam)

### Day 6-7: Refinement
- [ ] Run `gitleaks` baseline + add to CI gate
- [ ] Run `npm audit --production` + remediate critical
- [ ] Document runbook untuk security incidents
