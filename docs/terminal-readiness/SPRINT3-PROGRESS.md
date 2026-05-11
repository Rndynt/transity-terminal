# Sprint 3 — OBSERVABILITY & CI/CD — Progress Tracker

Branch: `feat/reservation-engine-adapter`
Started: 2026-04-24
Selesai: 2026-04-24 — **10/10 item DONE**

| ID | Item | Severity | Status | Commit |
|---|---|---|---|---|
| S3-08 | Detach migrations dari boot (env-gated) + script standalone | 🟠 | ✅ | `d5e5bea` |
| S3-06 | Deep health: tambah Redis + Realmio subsystem | 🟡 | ✅ | `4072855` |
| S3-10 | Incident runbook 5 skenario | 🟡 | ✅ | `e5fb713` |
| S3-09 | Blue/green deploy script + nginx upstream config | 🟠 | ✅ | `98da3a3` |
| S3-07 | Grafana dashboard 10 panel (template JSON) | 🟡 | ✅ | `0c92812` |
| S3-01 | GitHub Actions CI (lint, typecheck, tests, security scan) | 🟠 | ✅ | `e8f0a4f` |
| S3-04 | Pino structured logging (logger module + dep install) | 🟡 | ✅ | `90e3272` |
| S3-05 | Prometheus `/api/metrics` endpoint + 10 metric kustom | 🟡 | ✅ | `26d7a92` |
| S3-03 | Sentry server-side instrumentation gated `SENTRY_DSN` | 🟠 | ✅ | `77d6d90` |
| S3-02 | Husky + lint-staged pre-commit + dev-setup runbook | 🟡 | ✅ | `a5c7d36` |

## Catatan eksekusi

Urutan dipilih: items file-only & low-risk dulu (migrate detach,
runbook markdown, deploy script, Grafana JSON, CI YAML) → install-package
items (Pino logger, Prometheus client) → integrasi eksternal (Sentry —
gated `SENTRY_DSN`, no-op kalau env tidak diset) → Husky last karena
butuh adjust hooksPath manual.

Setiap item satu commit terpisah dengan footer alasan teknis +
trade-off. Tidak ada item di-skip; beberapa di-deliver sebagai
infrastruktur siap (gated activation) karena dependensi eksternal:

- **S3-03 Sentry**: server-side capture + flush siap; aktivasi tunggu
  `SENTRY_DSN` di-provision via Replit Secrets. Client-side (browser)
  + source-map upload via CI = follow-up tail.
- **S3-02 Husky**: hook + config siap; `prepare` script di
  `package.json` butuh approval owner repo (skill agent forbid edit
  package.json). Sementara dev jalankan `npx husky` manual.
- **S3-09 blue/green**: script + nginx config siap; uji 0-downtime
  cutover butuh staging env (di luar scope sprint).

## Exit gates target

| Gate | Status |
|---|---|
| GL-10 CI passes on every PR | ✅ Infra siap (S3-01 + S3-02). Aktivasi penuh setelah ESLint config + `prepare` script. |
| GL-11 Sentry receives & groups errors with source-map | ⏸ Server siap (S3-03). Aktivasi setelah DSN provisioned + client SDK + sentry-cli upload di CI. |
| GL-12 Grafana shows live metrics from staging | ✅ Endpoint + dashboard JSON siap (S3-05 + S3-07). Aktivasi setelah Grafana scrape staging. |
| GL-13 Blue/green deploy 0-downtime cutover | ⏸ Script siap (S3-08 + S3-09). Aktivasi tunggu staging env demo. |
| GL-14 Incident runbooks reviewed | ✅ Runbook + dev setup di-deliver (S3-10 + RUNBOOK-DEV-SETUP). Tunggu team review. |

## Files baru

- `.github/workflows/ci.yml` (S3-01)
- `.husky/pre-commit` + `.lintstagedrc.json` (S3-02)
- `server/observability/sentry.ts` (S3-03)
- `server/lib/logger.ts` (S3-04)
- `server/observability/metrics.ts` (S3-05)
- `scripts/db-migrate.ts` (S3-08)
- `scripts/deploy-blue-green.sh` (S3-09)
- `docs/terminal-readiness/grafana-dashboard.json` (S3-07)
- `docs/terminal-readiness/RUNBOOK-INCIDENTS.md` (S3-10)
- `docs/terminal-readiness/RUNBOOK-DEV-SETUP.md` (S3-02)

## Files diubah

- `server/index.ts` (initSentry, flushSentry SIGTERM/SIGINT, Sentry
  forward pada setErrorHandler 5xx)
- `server/routes.ts` (`/api/metrics` endpoint dengan service-key, deep
  health gauge update)
- `server/modules/app/health.routes.ts` (Redis + Realmio subsystem)

## Next sprint

Lanjut **Sprint 4 — PERFORMANCE & POLISH** (lihat
`05-TERMINAL-ROADMAP.md` Sprint 4 backlog).
