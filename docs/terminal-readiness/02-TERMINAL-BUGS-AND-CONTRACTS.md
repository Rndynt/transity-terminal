# TransityTerminal — Bugs Aktif & Kontrak Integrasi

**Status indikator**:
- ✅ Confirmed (verified in code)
- ⚠ Suspected (needs verification)
- 🔧 Has fix proposed
- 🚧 Work-in-progress (code path baru)

---

## A. Bug Kritis Aktif — Fix Sebelum Launch

### A1. 🔴 CRITICAL — Refund approval tidak release seat
**Status**: ✅ Confirmed
**File**: `server/modules/refunds/refunds.service.ts:63`

**Skenario**:
1. Customer beli tiket → seat status `booked` di `seat_inventory`
2. Customer minta refund → ticket admin approve (`PATCH /api/refunds/:id/approve`)
3. **Status `refund.status = 'approved'` saja yang di-set**
4. Booking tetap `confirmed`, passenger tetap aktif, seat tetap `booked` di engine + DB
5. Trip departed → kursi kosong tapi tidak terjual lagi

**Bisnis impact**: Hilang revenue per refund × jumlah refund/hari. Plus data inconsistency: customer berpikir refunded, sistem berpikir confirmed.

**Fix Sketch** (1-2 hari):
```typescript
// refunds.service.ts approve()
return await db.transaction(async (tx) => {
  // 1. Lock & update refund
  const refund = await tx
    .update(refunds)
    .set({ status: 'approved', approvedAt: now, approvedBy: staffId })
    .where(eq(refunds.id, refundId))
    .returning();

  // 2. Update booking & passengers
  await tx
    .update(bookings)
    .set({ status: 'refunded', refundedAt: now })
    .where(eq(bookings.id, refund[0].bookingId));

  await tx
    .update(passengers)
    .set({ status: 'refunded' })
    .where(eq(passengers.bookingId, refund[0].bookingId));

  // 3. Release seats
  // - via engine if RESERVATION_ENGINE_ENABLED
  // - else via local atomicHold.cancelSeats
  const seatsToRelease = await tx
    .select()
    .from(passengers)
    .where(eq(passengers.bookingId, refund[0].bookingId));

  await holdsAdapter.cancelSeats({
    tripId: booking.tripId,
    seats: seatsToRelease.map(p => ({ seatNo: p.seatNo, legIndexes: p.legIndexes })),
    reason: `refund_approved:${refund[0].id}`,
  });

  // 4. Release promo applications usage count
  await tx
    .update(promotions)
    .set({ usageCount: sql`usage_count - 1` })
    .where(/* matching applications */);

  // 5. Emit WS for CSO seatmap real-time update (after tx commit)
  return refund[0];
});

// After transaction
emitTripUpdate({ tripId, seatsReleased });
```

**Test scenarios** (must add):
1. Approve refund → seat available di seatmap dalam 2s
2. Approve refund yang sudah refunded → idempotent, no double-release
3. Approve refund saat trip sudah departed → reject (rule)
4. Concurrent approve race → only 1 wins (FOR UPDATE)

---

### A2. 🔴 CRITICAL — Cashier session tidak isolate per-staff
**Status**: ✅ Confirmed
**File**: `server/modules/cashier/cashier.service.ts:15`

(Lihat `01-TERMINAL-SECURITY.md` A4 untuk detail lengkap)

**Tambahan untuk integrasi reports**: setelah fix, reports cash drawer harus group by `(outletId, staffId)`, bukan hanya `outletId`.

---

### A3. 🟠 HIGH — Promo `usageCount` tidak di-decrement saat booking cancel/refund
**Status**: ⚠ Suspected (perlu cek `bookings.service.ts` cancel path)

**Risk**: Promo dengan `usageLimit=100` bisa "habis" karena counter naik dari booking yang akhirnya dibatalkan/refunded.

**Fix**: Di transaction cancel/refund, decrement promo usage:
```typescript
const applications = await tx.select().from(bookingPromoApplications)
  .where(eq(bookingPromoApplications.bookingId, bookingId));
for (const app of applications) {
  await tx.update(promotions)
    .set({ usageCount: sql`usage_count - 1` })
    .where(eq(promotions.id, app.promotionId));
}
```

---

### A4. 🟠 HIGH — Voucher generation tanpa collision check (rely on DB unique)
**Status**: ✅ Confirmed
**File**: `server/modules/promos/promos.service.ts:92` (`generateVouchers`)

**Risk**: Bulk generate 10K voucher random 8-char → 1-2 collision pasti, error 500 ke admin.

**Fix**:
```typescript
async generateVouchers(count: number, ...) {
  const codes: string[] = [];
  let attempts = 0;
  while (codes.length < count && attempts < count * 3) {
    attempts++;
    const code = generateCode(); // existing
    try {
      await db.insert(vouchers).values({ code, ...meta });
      codes.push(code);
    } catch (err: any) {
      if (err.code === '23505') continue; // duplicate, retry
      throw err;
    }
  }
  if (codes.length < count) {
    throw new Error(`Could only generate ${codes.length}/${count} unique vouchers`);
  }
  return codes;
}
```

Atau pakai 12-char alphanumeric (62^12 = 3.2e21 → collision negligible).

---

### A5. 🟠 HIGH — `markApplicationsUsed` N+1 update di promo
**Status**: ✅ Confirmed
**File**: `server/modules/promos/promos.service.ts:361`

**Risk**: Booking dengan 5 promo stacked → 5+5 update queries (promo + voucher). Slow under load.

**Fix**: Batch UPDATE dengan `WHERE id IN (...)`:
```typescript
const promoIds = applications.map(a => a.promotionId);
await tx.update(promotions)
  .set({ usageCount: sql`usage_count + 1` })
  .where(inArray(promotions.id, promoIds));
```

---

### A6. 🟠 HIGH — Decimal precision: `Math.round` mixed dengan `numeric(12,2)`
**Status**: ✅ Confirmed
**File**: `server/modules/promos/promos.service.ts` (kalkulasi diskon)

**Risk**: Selisih Rp 1-50 antara DB stored value vs reported value untuk transaksi besar (Rp >10jt).

**Fix**: Standardize semua kalkulasi monetary:
- Pakai library `decimal.js` atau `currency.js`, jangan `Math.round`
- Atau pastikan semua compute di SQL dengan `numeric` type
- Konsisten round-up vs round-down (UU bisnis: pajak round-up, diskon round-down)

---

### A7. 🟡 MEDIUM — Hold TTL inkonsistensi `.replit` vs `.env.example`
**Status**: ✅ Confirmed
**File**: `.replit:84-86` vs `.env.example`

**Detail**:
- `.replit`: `HOLD_TTL_LONG_SECONDS=1200`
- `.env.example`: comment 1800 default

**Action**: Single source of truth — pakai `1200s` (20 min, sudah jadi standard OTA), update `.env.example` comment.

---

### A8. 🟡 MEDIUM — Scheduler skip OTA filter live verification
**Status**: ⚠ Suspected (per `TERMINAL_FIXES_APPLIED.md` Fix #1)
**File**: `server/modules/bookings/bookings.service.ts` `cleanupExpiredPendingBookings`

**Action**: Verify di code:
```bash
grep -n "channel" server/modules/bookings/bookings.service.ts
```
Harus terlihat `not(eq(bookingsTable.channel, 'OTA'))`.

Test integration:
1. Create OTA booking dengan `pendingExpiresAt = NOW() + 1 second`
2. Wait 65s (scheduler interval)
3. Assert booking masih `pending`, NOT `cancelled`

---

### A9. 🟡 MEDIUM — Reschedule via engine: residual compensation backlog risk
**Status**: ✅ Confirmed (after re-verification — flow sudah aman)
**File**: `server/modules/bookings/reschedule.service.ts:334-358, 458-485`

**Flow aktual (verified)**:
1. **Engine mode**: pre-generate split booking ID, **confirm NEW seat di engine FIRST** (line 343)
2. Local DB transaction: update DB seat inventory, passengers, bookings (line 358+)
3. **AFTER tx commit**, cancel OLD seat di engine (line 461)
4. Kalau cancel OLD gagal → **compensation queue enqueue** (line 471), reschedule tetap success

**Risiko residual** (operational, bukan correctness):
- Compensation queue backlog kalau engine flapping → old seats stuck booked sampai retry success
- Kalau engine confirm NEW success tapi local DB tx fail → ada compensation untuk cancel NEW (line 472, source `batchReschedule.compensation`) — verified ada path-nya

**Action** (residual):
- Monitor `engine_compensation_queue` depth & oldest age (Sentry alert pada threshold)
- Chaos test: kill engine container saat reschedule batch besar → assert compensation drains correct on engine recovery
- Document operational SLA: berapa lama "old seat stuck" acceptable

**Verdict**: Reframe dari CORE BUG ke MONITORING/SLO concern. Engineering kerjakan: comprehensive test (1 hari) + alerting (4 jam).

---

### A10. 🟡 MEDIUM — WS subscribe tanpa permission check
**Status**: ✅ Confirmed
**File**: `server/realtime/ws.ts`

**Risk**: Connected client (any authenticated session) bisa subscribe ke `cso:other-outlet:date` dan terima real-time data outlet lain.

**Fix**:
```typescript
io.on('connection', (socket) => {
  // Require auth handshake (cookie or query token)
  const session = await verifySession(socket.handshake);
  if (!session) return socket.disconnect();
  socket.data.session = session;

  socket.on('subscribe', async ({ room }) => {
    if (room.startsWith('cso:')) {
      const [, outletId] = room.split(':');
      if (!session.allowedOutlets.includes(outletId)) {
        return socket.emit('error', { code: 'forbidden' });
      }
    }
    // similar checks for trip:* base:*
    socket.join(room);
  });
});
```

---

### A11. 🟡 MEDIUM — `isProcessing` state stuck on error in CSO
**Status**: ✅ Confirmed
**File**: `client/src/pages/CsoPage.tsx:215`

**Code comment**: `// Should be false but task said setIsProcessing(true)`

**Risk**: Tombol disabled selamanya kalau error tertentu, user harus refresh page.

**Fix**: `try { setIsProcessing(true); await action(); } finally { setIsProcessing(false); }`

---

## B. Kontrak Integrasi: Terminal ↔ Console

### B1. 🟠 HIGH — Terminal Public API harus jadi OpenAPI (machine-readable)
**Status**: ✅ Confirmed
**File**: `PUBLIC_API.md` (62KB plain text)

**Risk**: Console pakai endpoint Terminal `/api/app/*` dan `/api/console/*`. Tanpa OpenAPI spec, drift kontrak tidak terdeteksi sampai customer komplain.

**Fix Plan**:
1. Convert `PUBLIC_API.md` → `docs/openapi.yaml` (manual atau pakai `tsoa` annotations)
2. Spec endpoint per route handler dengan Zod → OpenAPI generator
3. CI gate: `spectral lint docs/openapi.yaml`
4. Sinkronisasi ke Console via `pnpm --filter @workspace/api-spec` import

**Endpoint kritis untuk specced** (Terminal-side):
```
POST /api/app/bookings              ← Console gateway calls
GET  /api/app/bookings/find-ota     ← recovery flow
POST /api/app/bookings/:id/confirm-ota-paid
POST /api/app/bookings/:id/cancel    ← if implemented
POST /api/app/trips/materialize      ← virtual trip → real
POST /api/console/schedules/snapshot ← reverse direction (TT → Console)
GET  /api/health
```

---

### B2. 🟢 RESOLVED — Endpoint Console gateway sudah tersedia
**Status**: ✅ Confirmed (verified after architect feedback)
**File**: `server/modules/app/app.routes.ts:104-106`

```typescript
app.get('/api/app/bookings/:id/payment-status', { preHandler: [bookingAuthMiddleware] }, ...);
app.post('/api/app/bookings/:id/pay',           { preHandler: [bookingAuthMiddleware] }, ...);
app.post('/api/app/bookings/:id/cancel',        { preHandler: [bookingAuthMiddleware] }, ...);
```

**Action terkini** (re-scoped dari "implement" ke "audit & test"):
- ✅ Endpoint exist
- ⏳ Audit idempotency: pakai `Idempotency-Key` header + DB unique constraint?
- ⏳ Audit cancel rules: cancellable timeline, refund eligibility computation
- ⏳ Audit pay → engine confirm path (kalau RESERVATION_ENGINE_ENABLED)
- ⏳ E2E integration test from Console mock client
- ⏳ Document spec di OpenAPI (B1)

**Estimasi**: 1 hari audit + 1 hari test (turun dari 2 hari implementation).

---

### B3. 🟡 MEDIUM — Schedule snapshot push: kemungkinan drift dengan Console cache
**Status**: ⚠ Suspected
**File**: `server/modules/console/console.service.ts` (assumed)

**Action**: Per `docs/REQ_UPDATE_CONSOLE_SEATMAP_CACHE.md`, Console sekarang cache seatmap 30-60s. Verify Terminal push WS update `seat:hold` & `seat:released` dengan low latency supaya cache invalidation cepat.

---

## C. Kontrak Integrasi: Terminal ↔ Reservation Engine

### C1. ✅ Solid — Engine API spec sudah jelas
- HMAC dengan `{ts}.{METHOD}.{path}.{sha256(body)}`
- Idempotency-Key 24h window
- Error codes mapped: `SEAT_CONFLICT`, `HOLD_EXPIRED`, `INCOMPLETE_INVENTORY`

### C2. 🟡 MEDIUM — Adapter fallback jika engine down
**Status**: ✅ Confirmed (no fallback to local — by design)

**Pertanyaan strategis**: Kalau engine crash 5 menit, semua booking gagal di operator yang aktifkan engine. Apakah ada SLA/runbook?

**Recommendation**:
- Monitor engine `/healthz` setiap 10s; alert jika 3 consecutive fail
- Quick rollback procedure: set `RESERVATION_ENGINE_ENABLED=false` + restart TT (downtime ~30s)
- Document di `docs/RUNBOOK_ENGINE_INCIDENT.md`

### C3. 🟡 MEDIUM — Compensation queue: visibility & alerting
**Status**: ⚠ No alerting yet

**Action**:
- Metric: `engine_compensation_queue_depth` (Prometheus gauge)
- Alert: depth > 100 atau oldest item > 10 minutes
- Dashboard panel di Grafana

### C4. 🟢 LOW — Engine `/inventory` snapshot use case
**Status**: ✅ Confirmed (read-only diagnostic)
**Action**: Document — bukan untuk production read-path (TT pakai Drizzle query langsung).

---

## D. Documentation Gaps

| Doc | Saat Ini | Recommended |
|---|---|---|
| `README.md` | 60K, lengkap | Tambahkan section "Engine integration mode (toggle on/off)" |
| `PUBLIC_API.md` | 62K plain text | Migrate to OpenAPI (B1 above) |
| `REALMIO_INTEGRATION.md` | OK | OK |
| `TRANSITY_CONSOLE_INTEGRATION.md` | OK 30K | Add Terminal-side endpoint additions B2 |
| `docs/FEATURES.md` | OK | Update dengan multi-promo, strike pricing, OTA channel |
| `docs/DEPLOY_VPS_DOCKER.md` | OK | Add engine sidecar overlay setup |
| `docs/REQ_UPDATE_CONSOLE_SEATMAP_CACHE.md` | OK | Verify Console implementation done |
| `docs/TERMINAL_FIXES_APPLIED.md` | OK | Add Fix #4: refund seat release; Fix #5: cashier per-staff |
| `docs/RUNBOOK_*.md` | ❌ Tidak ada | **Create**: incident scenarios (engine down, DB exhausted, Realmio down, payment provider down, scheduler stuck) |
| `engine/docs/TT_HOLDS_ADAPTER_INSTRUCTIONS.md` | ✅ Sudah dipakai | OK |

---

## E. Sequence Fix Plan

### Sprint 1 (1 minggu) — Bugs Kritis
1. **A1** Refund seat release (1.5 hari + tests)
2. **A2** Cashier per-staff (1 hari + migration + tests)
3. **A8** Verify scheduler OTA skip (0.5 hari)
4. **A11** isProcessing fix (1 jam)
5. **A4** Voucher generation collision-safe (2 jam)
6. **A3** Promo usageCount decrement on cancel/refund (4 jam)

### Sprint 2 (1 minggu) — Integrasi & Adapter
7. **B2** Implement `POST /api/app/bookings/:id/pay` & `/cancel` (3 hari)
8. **A9** Reschedule rollback safety + chaos test (2 hari)
9. **C2** Engine incident runbook (4 jam)
10. **A10** WS room permission check (1 hari)

### Sprint 3 (1 minggu) — Kontrak & Polish
11. **B1** OpenAPI for Terminal Public API (3 hari)
12. **A5, A6** Promo batch update + decimal precision (1 hari)
13. **A7** Hold TTL alignment (1 jam)
14. **B3** Console cache invalidation verify (1 hari)
