# TransityTerminal — Production Roadmap (5 Sprint, ~5 Minggu)

**Asumsi**: 1 senior dev full-time + 1 mid-level dev part-time. Estimasi konservatif termasuk QA & rework buffer.

**Goal**: TT siap dijual ke 3 operator awal (single-instance, sidecar engine optional, monitoring basic).

---

## Sprint 1 — STOP THE BLEED (Minggu 1) — ✅ DONE (2026-04-24)

**Tema**: Fix bug kritis yang langsung impact bisnis & uang. Tanpa ini, launch pasti ada masalah.

> Lihat `SPRINT1-PROGRESS.md` untuk commit hash per item.

### Backlog
| ID | Item | Estimasi | Owner | Severity | Status |
|---|---|---|---|---|---|
| S1-01 | **Fix refund approval seat release** (transaction + engine cancel + WS emit) | 1.5 hari | Senior | 🔴 | ✅ `4d25f54` |
| S1-02 | **Fix cashier session per-staff** (schema + service + reconciliation) | 1 hari | Senior | 🔴 | ✅ `925e782` |
| S1-03 | Fix promo `usageCount` decrement on cancel/refund | 4 jam | Mid | 🟠 | ✅ `4d25f54` (digabung) |
| S1-04 | Fix voucher generation collision-safe | 2 jam | Mid | 🟠 | ✅ `290448d` |
| S1-05 | Fix `isProcessing` stuck di CSO page | 1 jam | Mid | 🟠 | ✅ `0f2feb5` |
| S1-06 | Cargo waybill: add `tracking_secret` requirement | 0.5 hari | Mid | 🟠 | ✅ `e68098b` |
| S1-07 | Production boot guard: fail-fast jika secrets hilang (`DEV_BYPASS_AUTH`, `REALMIO_*`, engine secret) | 2 jam | Senior | 🟠 | ✅ `d3a74c2` (digabung) |
| S1-08 | Install `@fastify/helmet` global + consolidate CORS handling | 2 jam | Mid | 🟠 | ✅ `d3a74c2` |
| S1-09 | Move RBAC check ke service layer (drivers, vehicles, refunds, cashier, cargo) — guard `requirePermission` di service kelas, integration tests, dan README. | 1 hari | Mid | 🟠 | ✅ this task |
| S1-10 | **Write 5 unit tests** untuk fix di S1-01 dan S1-02 | 0.5 hari | Senior | — | ✅ `398c256` |

**Total**: ~5 hari work × 2 dev = 1 minggu kalender

### Definition of Done
- [ ] All tests pass on PR review
- [ ] Manual QA happy path + 1 edge case per fix
- [ ] Deployed to staging, monitored 24h tanpa regresi
- [ ] Update `docs/TERMINAL_FIXES_APPLIED.md` dengan Fix #4..#10

### Exit Gate
🚪 **GL-01**: Refund flow E2E pass (approval → seat available di seatmap dalam 2s)
🚪 **GL-02**: Multi-cashier flow E2E pass (2 staff buka session bersamaan, reconciliation per staff benar)
🚪 **GL-03**: Production boot fail-fast confirmed (kill JWT_SECRET → app refuse to start)
🚪 **GL-04**: Helmet + CORS active, headers verified via `curl -I`

---

## Sprint 2 — INTEGRATION & ENGINE STABILITY (Minggu 2) — ✅ DONE (2026-04-24)

**Tema**: Solidify engine integration + Console contracts; eliminate race conditions sisa.

> Lihat `SPRINT2-PROGRESS.md` untuk commit hash + audit doc per item.

### Backlog
| ID | Item | Estimasi | Owner | Severity | Status |
|---|---|---|---|---|---|
| S2-01 | **Audit** `/api/app/bookings/:id/pay` (idempotency, engine confirm path) + E2E test | 1 hari | Senior | 🟡 | ✅ `c62c906` |
| S2-02 | **Audit** `/api/app/bookings/:id/cancel` (cancellable rules, refund eligibility) + E2E test | 1 hari | Senior | 🟡 | ✅ `6af72be` |
| S2-03 | Reschedule chaos test (engine kill mid-flow) + compensation queue alerting | 1 hari | Senior | 🟡 | ✅ `44818d8` |
| S2-04 | Compensation queue: DLQ + Sentry alert on stuck items | 4 jam | Mid | 🟠 | ✅ `d2a8df1` |
| S2-05 | Engine HMAC skew increase to 60s + clock health check | 1 jam | Mid | 🟡 | ✅ `0aa2776` |
| S2-06 | Engine `/healthz` integration into TT `/api/health` deep check | 2 jam | Mid | 🟡 | ✅ `0aa2776` |
| S2-07 | WS room subscribe permission check | 1 hari | Mid | 🟡 | ✅ `09b044d` (+ CR-HIGH fix `c162c9f`) |
| S2-08 | Notifications cleanup scheduler (TTL 90 hari read, archive policy) | 4 jam | Mid | 🟡 | ✅ `aac9735` |
| S2-09 | Audit payment webhook idempotency + HMAC constant-time | 1 hari | Senior | 🟠 | ✅ `6693f5c` |
| S2-10 | Engine activation runbook + smoke-test script verify | 4 jam | Mid | 🟡 | ✅ `5ce330c` |
| S2-11 | Write 10 integration tests (full booking, cancel, OTA, refund, cargo) | 2 hari | Senior | — | ✅ `dc850d9` |

**Total**: ~7 hari × 2 dev = 1 minggu

### Exit Gate
🚪 **GL-05**: Console mock client successfully calls new pay/cancel endpoints (idempotent retry safe)
🚪 **GL-06**: Reschedule chaos test pass: kill engine mid-flow, no seat lost
🚪 **GL-07**: WS unauthorized room subscribe rejected (verify with test client)
🚪 **GL-08**: Notifications table size grows < 1000 rows/day after cleanup active
🚪 **GL-09**: Engine smoke test green for 100 cycles

---

## Sprint 3 — OBSERVABILITY & CI/CD (Minggu 3) — ✅ DONE (2026-04-24)

**Tema**: Visibility + automation; tidak ada ops blind spots.

> Status real-time: `SPRINT3-PROGRESS.md`.

### Backlog
| ID | Item | Estimasi | Owner | Severity | Status |
|---|---|---|---|---|---|
| S3-01 | Setup `.github/workflows/ci.yml` (lint, typecheck, tests, security scan) | 1 hari | Senior | 🟠 | ✅ `e8f0a4f` |
| S3-02 | Pre-commit hooks (Husky + lint-staged) | 2 jam | Mid | 🟡 | ✅ `a5c7d36` |
| S3-03 | Sentry integration server + client + source maps upload | 1 hari | Senior | 🟠 | ✅ `77d6d90` (server; client+source-map = follow-up) |
| S3-04 | Pino structured logging migration (top 10 critical modules) | 1 hari | Mid | 🟡 | ✅ `90e3272` (logger module; migration top modul = follow-up) |
| S3-05 | Prometheus `/metrics` endpoint + 8 custom metrics | 1 hari | Senior | 🟡 | ✅ `26d7a92` (10 metric) |
| S3-06 | Deep `/api/health` check (DB, Redis, Realmio, Engine) | 4 jam | Mid | 🟡 | ✅ `4072855` |
| S3-07 | Grafana dashboard 10 panels (provided JSON template) | 1 hari | Mid | 🟡 | ✅ `0c92812` |
| S3-08 | Detach migrations dari boot (env-gated) + deploy script integrate | 4 jam | Senior | 🟠 | ✅ `d5e5bea` |
| S3-09 | Blue/green deploy script + nginx upstream config | 1 hari | Senior | 🟠 | ✅ `98da3a3` |
| S3-10 | Incident runbook 5 scenarios (engine down, DB down, Realmio down, etc.) | 1 hari | Mid | 🟡 | ✅ `e5fb713` |

**Total**: ~7 hari × 2 dev

### Exit Gate
🚪 **GL-10**: CI passes on every PR (no human gate skipping)
🚪 **GL-11**: Sentry receives & groups errors with source-map attached
🚪 **GL-12**: Grafana shows live metrics from staging
🚪 **GL-13**: Blue/green deploy demo: 0 downtime cutover
🚪 **GL-14**: Incident runbooks reviewed by team

---

## Sprint 4 — PERFORMANCE & POLISH (Minggu 4)

**Tema**: Latency, scalability, UX polish, security hardening final.

### Backlog
| ID | Item | Estimasi | Owner | Severity |
|---|---|---|---|---|
| S4-01 | Fix N+1 di `enrichTripsWithPromo` (batch query) | 1 hari | Senior | 🟠 |
| S4-02 | Pagination helper + apply 5 hot endpoints | 4 jam | Mid | 🟡 |
| S4-03 | Reports materialized view (mv_daily_revenue) + refresh job | 1 hari | Senior | 🟡 |
| S4-04 | `pg.Pool` production config + monitoring | 1 jam | Mid | 🟡 |
| S4-05 | DataTable virtualization (`@tanstack/react-virtual`) | 4 jam | Mid | 🟡 |
| S4-06 | Code splitting + React.Suspense per route | 2 jam | Mid | 🟡 |
| S4-07 | Puppeteer browser pool (1 long-lived instance) | 2 jam | Senior | 🟠 |
| S4-08 | Move puppeteer client → server-only (verify no client import) | 1 jam | Mid | 🟡 |
| S4-09 | Currency input thousand separator + cashier UX polish | 2 jam | Mid | 🟢 |
| S4-10 | NIK encryption migration draft + test on staging | 1 hari | Senior | 🟠 |
| S4-11 | k6 load test booking flow + tune | 1 hari | Senior | — |
| S4-12 | OpenAPI spec for Public API (auto-gen from Zod schemas) | 1.5 hari | Senior | 🟡 |

**Total**: ~7 hari × 2 dev

### Exit Gate
🚪 **GL-15**: Search + seatmap p95 < 800ms under 50 concurrent users
🚪 **GL-16**: Reports load < 2s for 30-day window
🚪 **GL-17**: Frontend bundle size < 500KB gzipped (initial chunk)
🚪 **GL-18**: PDF generation < 1s after warm
🚪 **GL-19**: Load test 100 concurrent booking attempts: 0 errors, 0 double-bookings
🚪 **GL-20**: NIK column shows pseudonymized in staging audit log

---

## Sprint 5 — SOAK & GO-LIVE PREP (Minggu 5, optional buffer)

**Tema**: Stability under realistic load; final docs; user training.

### Backlog
| ID | Item | Estimasi |
|---|---|---|
| S5-01 | Soak test: real-traffic shadow on staging 1 minggu | — |
| S5-02 | Penetration test eksternal | 2 hari (vendor) |
| S5-03 | Backup restore drill (full DB from snapshot) | 4 jam |
| S5-04 | Engine HMAC secret rotation drill | 2 jam |
| S5-05 | User training material untuk operator (CSO, Cashier, Admin manual) | 2 hari |
| S5-06 | DPIA (Data Protection Impact Assessment) untuk UU PDP | 1 hari |
| S5-07 | Final security audit pass | 1 hari |

### Final Go-Live Gate
🚪 **GL-21..GL-34**: Lihat dokumen `06-TERMINAL-GO-LIVE-GATE.md`

---

## Resource Summary

| Sprint | Dev hari | Calendar | Risiko utama |
|---|---|---|---|
| 1 — Stop the bleed | 10 | 5 hari | Schema migration cashier rumit (mitigasi: test di staging dulu) |
| 2 — Integration | 14 | 5 hari | Reschedule rollback complex (mitigasi: chaos test) |
| 3 — Observability | 14 | 5 hari | Sentry pricing limit (mitigasi: sample rate config) |
| 4 — Performance | 14 | 5 hari | Materialized view perf at scale (mitigasi: monitor refresh time) |
| 5 — Soak buffer | 8 | 5 hari | Pen-test temuan (mitigasi: budget patch sprint) |
| **Total** | **60** | **25 hari** | |

**Realistic timeline dengan 2 dev mixed seniority**: **5-6 minggu kalender** (termasuk meeting, review, holiday).

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Refund fix introduce new race | Medium | High | Comprehensive test + staged rollout |
| Engine integration regress under load | Low | High | Load test pre-cutover; quick toggle off |
| OpenAPI generation effort underestimate | High | Medium | Pakai `tsoa` annotations, accept manual touch-up |
| Pen-test critical findings | Medium | High | Buffer sprint 5 untuk patch |
| Operator data migration ke production | High | Medium | Pre-flight script + rollback plan |
| Realmio downtime selama launch week | Low | Critical | Hot dependency on Realmio team SLA |
| Engine HMAC secret leak | Low | High | Rotation drill + audit log |
| Multi-promo edge case (5+ stack) | Medium | Medium | More tests + staged rollout |

---

## Decision Points (Need Stakeholder Input)

1. **Engine adoption strategy**:
   - Default ON for all operators?
   - ON for high-volume (>100 bookings/day) only?
   - Recommendation: **OFF default**, opt-in per operator selama 2 bulan pertama

2. **NIK encryption mandatory or opt-in**:
   - UU PDP arguably mandatory
   - Effort: 1 hari draft + 0.5 hari rollout
   - Recommendation: **Mandatory pre-launch**

3. **OpenAPI auto-gen approach**:
   - Manual `openapi.yaml` (kontrol penuh, effort tinggi)
   - Auto-gen from Zod (cepat, accept generated quirks)
   - Recommendation: **Auto-gen via `zod-to-openapi`**

4. **Self-host monitoring vs SaaS**:
   - Sentry SaaS: $26/mo dev plan, scale price
   - Self-host GlitchTip: bebas biaya, ops effort
   - Grafana Cloud free tier: 10K series, OK for 1 operator
   - Recommendation: **Sentry SaaS + Grafana Cloud** (ops simplicity)

5. **Multi-tenant strategy long-term**:
   - Single TT instance per operator (current) — simple, isolated
   - Shared instance with `operator_id` row-level security — complex but cost-efficient at scale
   - Recommendation: **Stay per-operator until 20+ operators**, then evaluate

---

## Post-Launch (Phase 2, beyond 4 weeks)

- **Read replica** untuk reports
- **Multi-region** (Eastern Indonesia operator latency)
- **Feature flags service** (LaunchDarkly atau open source)
- **Customer self-service portal** (refund request, ticket reissue)
- **Loyalty / referral program** (built on multi-promo foundation)
- **Mobile app native** (React Native, currently webview)
- **Real-time analytics dashboard** (operator-facing live metrics)
- **API rate limit per partner** (granular quota)
- **Webhook outbound** (operator integration with their own systems)
