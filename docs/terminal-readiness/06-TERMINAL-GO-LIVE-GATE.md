# TransityTerminal — Go-Live Hard Gate Checklist

**Cara pakai**: Reference harian. **Tidak boleh launch** sebelum semua gate ✅. Setiap gate punya owner, evidence requirement, dan blocker explicit.

---

## Phase Map

```
Wave A — Critical Bugs (Sprint 1)        →  Gates GL-01..GL-04
Wave B — Integration & Engine (Sprint 2)  →  Gates GL-05..GL-09
Wave C — Observability (Sprint 3)        →  Gates GL-10..GL-14
Wave D — Performance (Sprint 4)           →  Gates GL-15..GL-20
Wave E — Final Soak & Audit (Sprint 5)    →  Gates GL-21..GL-34
```

---

## WAVE A — Critical Bugs (Block all)

### 🚪 GL-01: Refund seat release E2E
- **Test**: Approve refund → assert seat tersedia di seatmap dalam 2 detik
- **Test**: Approve refund booking dengan 4 passenger → semua kursi released
- **Test**: Approve refund 2x (idempotency) → no double release, no error
- **Test**: Approve refund untuk trip yang sudah departed → reject dengan error message clear
- **Evidence**: Test artifact + screen recording staging
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-02: Multi-cashier session
- **Test**: Outlet A, Staff X buka sesi → success
- **Test**: Outlet A, Staff Y buka sesi (paralel) → success (sebelumnya: tidak bisa)
- **Test**: Settle Staff X → reconciliation hanya transaksi Staff X dalam window
- **Test**: Migration up & down work
- **Evidence**: Migration applied to staging, manual QA recording
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-03: Production boot fail-fast
- **Test**: Unset `JWT_SECRET` → boot fails dengan clear error
- **Test**: Set `DEV_BYPASS_AUTH=true` di production → boot fails
- **Test**: Unset `REALMIO_BASE_URL` → boot fails
- **Test**: Unset `RESERVATION_ENGINE_HMAC_SECRET` saat `RESERVATION_ENGINE_ENABLED=true` → boot fails
- **Evidence**: Boot log captures, test script
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-04: Security headers verified
- **Test**: `curl -I https://staging.terminal.../api/health` returns:
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy: ...` (production)
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Test**: CORS preflight `OPTIONS` returns proper `Access-Control-Allow-*` headers untuk whitelisted origin only
- **Evidence**: curl log
- **Owner**: Mid Dev
- **Status**: ☐

---

## WAVE B — Integration & Engine

### 🚪 GL-05: Console gateway pay/cancel endpoints work
- **Test**: Mock client POST `/api/app/bookings/:externalId/pay` → booking transitions paid → seats confirmed in engine
- **Test**: Same call dengan `Idempotency-Key` retry → returns same result (no duplicate payment record)
- **Test**: POST `/api/app/bookings/:externalId/cancel` → booking cancelled → seats released
- **Test**: Cancel for already-cancelled → idempotent return cached result
- **Evidence**: API integration test pass + Postman collection
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-06: Reschedule rollback safety (Chaos)
- **Test**: Reschedule booking, kill engine container at moment between "release old" and "confirm new"
- **Assert**: Original booking still valid (old seat re-confirmed) OR clean rollback dengan customer notification
- **Test**: Compensation queue drains successfully when engine restored
- **Evidence**: Chaos test recording + log analysis
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-07: WS room permission enforced
- **Test**: Connect as user with outlets [A], try `subscribe cso:B:date` → rejected
- **Test**: Connect as admin → subscribe any room → success
- **Test**: Connect anonymous → cannot subscribe at all
- **Evidence**: WS test client log
- **Owner**: Mid Dev
- **Status**: ☐

### 🚪 GL-08: Notifications cleanup active
- **Test**: Run scheduler manually → old notifications deleted as per policy
- **Test**: Verify `(read=true AND created_at < NOW() - 30d)` removed
- **Test**: Verify `(read=false AND created_at < NOW() - 90d)` removed
- **Evidence**: SQL count before/after
- **Owner**: Mid Dev
- **Status**: ☐

### 🚪 GL-09: Engine smoke test 100 cycles green
- **Test**: `bash scripts/engine-smoke-test.sh --iterations 100` exits 0
- **Test**: Engine `/healthz` from TT `/api/health` returns ok
- **Test**: HMAC validation: tamper signature → reject 401; replay timestamp +60s → reject 403
- **Evidence**: CI run log
- **Owner**: Mid Dev
- **Status**: ☐

---

## WAVE C — Observability & CI/CD

### 🚪 GL-10: CI passes on every PR
- **Test**: Open PR with intentional type error → CI fails
- **Test**: Open PR with security secret in code → gitleaks fails
- **Test**: Open PR breaking test → tests fail
- **Evidence**: GitHub Actions run history
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-11: Sentry capturing errors with context
- **Test**: Trigger 500 in staging → Sentry receives event
- **Test**: Event includes user, request URL, source-mapped stack trace
- **Test**: Sensitive data redacted (no `Authorization` header, no `password`)
- **Evidence**: Sentry dashboard screenshot
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-12: Grafana dashboard live
- **Required panels**:
  - Request rate by endpoint
  - p50/p95/p99 latency
  - Error rate (5xx)
  - DB pool utilization
  - Compensation queue depth + age oldest
  - Engine request success rate
  - Active WS connections
  - Memory & CPU per instance
  - Booking conversion rate (search → confirmed)
  - Payment success rate
- **Evidence**: Dashboard URL + screenshot
- **Owner**: Mid Dev
- **Status**: ☐

### 🚪 GL-13: Blue/green deploy demo
- **Test**: Deploy v1 → traffic stable
- **Test**: Deploy v2 dengan rolling — measure downtime (target 0)
- **Test**: Rollback v1 → success in < 2 menit
- **Evidence**: Deploy log + uptime monitoring
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-14: Incident runbooks reviewed
- **Required runbooks** (in `docs/runbooks/`):
  - `engine-down.md`
  - `db-exhausted-connections.md`
  - `realmio-outage.md`
  - `payment-provider-outage.md`
  - `scheduler-stuck.md`
  - `compensation-queue-buildup.md`
- **Each runbook contains**: Detection signals, immediate mitigation, escalation, root cause investigation steps, post-mortem template
- **Evidence**: Team review meeting notes
- **Owner**: Mid Dev + DevOps
- **Status**: ☐

---

## WAVE D — Performance & Polish

### 🚪 GL-15: Search + seatmap p95 < 800ms (50 concurrent)
- **Test**: k6 scenario `trip_search_50vu_5min` → assert p95 latency
- **Evidence**: k6 report
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-16: Reports load < 2s for 30-day window
- **Test**: Open daily revenue report 30 hari di staging dengan 100K bookings → assert < 2s
- **Test**: Verify materialized view refreshes successfully on schedule
- **Evidence**: Browser DevTools waterfall + MV refresh log
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-17: Frontend bundle size < 500KB initial gzipped
- **Test**: `npm run build && du -sh dist/public/assets/*.js | sort -h`
- **Assert**: Initial chunk (entry) < 500KB after gzip
- **Test**: Verify Puppeteer NOT in client bundle
- **Evidence**: Bundle analyzer output
- **Owner**: Mid Dev
- **Status**: ☐

### 🚪 GL-18: PDF generation < 1s after warm
- **Test**: Cetak ticket pertama (cold start) → measure
- **Test**: Cetak 50 ticket consecutive → assert avg < 1s
- **Evidence**: Timing log
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-19: Load test 100 concurrent bookings, 0 errors
- **Test**: k6 booking flow 100 VU 10 menit → 0 errors, 0 double-bookings (verify via SQL count of duplicate seat assignments)
- **Test**: Engine load test: 200 concurrent holds 60s → 0 conflict miss, p99 < 50ms
- **Evidence**: k6 report + SQL audit query
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-20: NIK pseudonymization
- **Test**: Verify `id_number_hash` populated for existing customers
- **Test**: Encrypted `id_number_encrypted` column accessible via decryption helper only
- **Test**: Plain `id_number` column dropped (or marked deprecated)
- **Test**: UI staff masks NIK display (kecuali dengan permission)
- **Evidence**: SQL audit + UI screenshot
- **Owner**: Senior Dev
- **Status**: ☐

---

## WAVE E — Final Audit & Go-Live

### 🚪 GL-21: Backup restore drill
- **Test**: Take staging DB snapshot, drop staging DB, restore from snapshot → app boots, sample queries return correct data
- **Test**: Document restore time (RTO compliance)
- **Evidence**: Procedure log + timing
- **Owner**: DevOps
- **Status**: ☐

### 🚪 GL-22: Engine HMAC secret rotation procedure (with downtime)
- **State aktual**: Engine config `RESERVATION_ENGINE_HMAC_SECRET` single-secret only (`engine-server/src/config.rs:40-41`). Dual-secret rotation BELUM didukung di engine.
- **Procedure (single-secret, with brief downtime)**:
  1. Schedule maintenance window (5-10 menit)
  2. Generate new secret: `openssl rand -base64 32`
  3. Update engine `.env` + restart engine
  4. Update TT `.env` + restart TT
  5. Verify smoke test
- **Test**: Run procedure di staging, measure downtime
- **Future enhancement** (post-launch): patch engine to support `HMAC_SECRET_NEXT` for zero-downtime rotation
- **Evidence**: Procedure log + measured downtime
- **Owner**: Senior Dev + DevOps
- **Status**: ☐

### 🚪 GL-23: Penetration test pass
- **Test**: External vendor or OWASP ZAP scan
- **Findings**: All Critical & High remediated; Medium documented dengan timeline
- **Evidence**: Pen test report
- **Owner**: Security vendor
- **Status**: ☐

### 🚪 GL-24: Soak test 7 hari
- **Test**: Realistic shadow traffic to staging selama 1 minggu
- **Assert**: No memory leak (RSS stable), no DB connection exhaustion, no error spike
- **Evidence**: Grafana 7-day chart
- **Owner**: Mid Dev (monitoring)
- **Status**: ☐

### 🚪 GL-25: OpenAPI spec validated
- **Test**: `spectral lint docs/openapi.yaml` zero errors
- **Test**: Sample OpenAPI tested via `prism mock` matches actual API responses
- **Evidence**: Lint report + API contract test
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-26: Console integration verified
- **Test**: Console staging point ke TT staging via `TERMINAL_BASE_URL`
- **Test**: Full flow E2E from B2C app → Console → TT booking → payment → confirmation
- **Test**: Cancel & refund flow E2E
- **Evidence**: E2E test recording
- **Owner**: Senior Dev (cross-team)
- **Status**: ☐

### 🚪 GL-27: User training material delivered
- **Required**:
  - CSO operator manual (PDF, 20-30 hal, dengan screenshot)
  - Cashier manual (sesi open/close, refund request)
  - Admin manual (RBAC, promotions setup, reports)
  - Quick reference card (1 hal printable per role)
- **Evidence**: Sign-off dari operator pilot
- **Owner**: PM + Mid Dev
- **Status**: ☐

### 🚪 GL-28: Realmio production tenant verified
- **Test**: Realmio production has tenant + users for pilot operator
- **Test**: Login from production TT → success
- **Test**: Logout & token revocation work
- **Evidence**: Test log
- **Owner**: Senior Dev
- **Status**: ☐

### 🚪 GL-29: Payment provider production credentials configured
- **Test**: Webhook endpoint registered di provider dashboard
- **Test**: Test payment small amount Rp 1000 → webhook received → booking confirmed
- **Test**: Refund test → success
- **Evidence**: Test transaction screenshot
- **Owner**: Senior Dev + Finance
- **Status**: ☐

### 🚪 GL-30: Database production sized correctly
- **Test**: Capacity planning: estimate 1 tahun growth (bookings, payments, notifications)
- **Test**: Provisioned size handles peak with 2x headroom
- **Test**: Auto-scaling policy configured (Neon) atau manual scaling runbook documented
- **Evidence**: Capacity doc
- **Owner**: DevOps
- **Status**: ☐

### 🚪 GL-31: Operator data migration tested
- **Test**: Operator existing data (stops, vehicles, drivers, layouts, patterns) imported via CSV/Excel
- **Test**: All FK references valid
- **Test**: Sample trip generation success
- **Evidence**: Import script + audit log
- **Owner**: Mid Dev + Operator
- **Status**: ☐

### 🚪 GL-32: DPIA (Data Protection Impact Assessment) completed
- **Required**: UU PDP compliance documentation
  - Data inventory (apa data customer disimpan)
  - Legal basis for processing
  - Retention policy
  - Customer rights process (akses, hapus, koreksi)
  - Data breach notification procedure
- **Evidence**: DPIA document signed
- **Owner**: Legal + Senior Dev
- **Status**: ☐

### 🚪 GL-33: Status page & on-call rotation
- **Test**: Public status page (statuspage.io atau open source) reflects real health
- **Test**: PagerDuty/Opsgenie alert rules wired (Sentry critical → page on-call)
- **Test**: On-call rotation schedule defined for first 30 hari post-launch
- **Evidence**: Status page URL + alert configuration
- **Owner**: DevOps + PM
- **Status**: ☐

### 🚪 GL-34: Go-Live readiness review
- **Format**: Review meeting dengan tech lead, PM, operator representative
- **Required attendance**: All gate owners
- **Output**:
  - Sign-off pada all 33 gates atau explicit risk acceptance
  - Launch date confirmed
  - Rollback plan reviewed
  - Communication plan untuk pilot operator
- **Evidence**: Meeting minutes + sign-off email
- **Owner**: PM
- **Status**: ☐

---

## Day-of-Launch Runbook

### T-24h
- [ ] Final smoke test on production
- [ ] Engine sidecar deployed (idle, `RESERVATION_ENGINE_ENABLED=false` initially)
- [ ] Database backup taken (named snapshot)
- [ ] All env secrets verified
- [ ] Status page set to "scheduled maintenance" jika perlu

### T-1h
- [ ] On-call team assembled
- [ ] Communication channels open (Slack/WA war-room)
- [ ] Monitoring dashboards open (Grafana, Sentry, status page)

### T-0
- [ ] DNS cutover or traffic routing
- [ ] Verify health checks all green within 5 menit
- [ ] First test booking from operator side
- [ ] Verify booking visible in Console
- [ ] Verify payment webhook end-to-end

### T+1h
- [ ] Review error rate (target < 0.1% 5xx)
- [ ] Review p95 latency
- [ ] Review compensation queue (should be 0)
- [ ] Operator confirms can perform daily operations

### T+24h
- [ ] Daily traffic processed without incident
- [ ] No critical Sentry alerts
- [ ] Backup verified
- [ ] Soak monitoring continues
- [ ] **Decision point**: Enable engine for high-volume operator? (gradual)

### T+7 days
- [ ] Post-launch retrospective
- [ ] Address any critical issues found
- [ ] Plan engine activation for additional operators
- [ ] Plan next sprint priorities

---

## Rollback Triggers (Auto-Halt Launch)

Jika **salah satu** terjadi dalam 1 jam pertama:
- Error rate > 5%
- p95 latency > 5x baseline
- Database errors (connection refused, deadlock storm)
- Engine integration failures > 10/menit
- Customer payment double-charge reported
- Data loss confirmed

→ **Rollback procedure**:
1. Switch DNS / load balancer back to previous version
2. Verify rollback healthy
3. Keep engine running (safe by design — no shadow conflicts)
4. Initiate root cause investigation
5. Notify operator with ETA
6. Post-mortem within 48h

---

## Sign-off Block

```
Tech Lead:        ____________________   Date: ________
PM:               ____________________   Date: ________
DevOps Lead:      ____________________   Date: ________
Security Officer: ____________________   Date: ________
Operator Rep:     ____________________   Date: ________
```

**ALL 34 GATES MUST BE ✅ BEFORE GO-LIVE.**

Risk acceptance untuk gate yang skip: WRITTEN justification + business owner signature.
