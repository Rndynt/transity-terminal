# Sprint 3 — OBSERVABILITY & CI/CD — Progress Tracker

Branch: `feat/reservation-engine-adapter`
Started: 2026-04-24

| ID | Item | Severity | Status | Commit |
|---|---|---|---|---|
| S3-08 | Detach migrations dari boot (env-gated) + script standalone | 🟠 | ⏳ | — |
| S3-06 | Deep health: tambah Redis + Realmio subsystem | 🟡 | ⏳ | — |
| S3-10 | Incident runbook 5 skenario | 🟡 | ⏳ | — |
| S3-09 | Blue/green deploy script + nginx upstream config | 🟠 | ⏳ | — |
| S3-07 | Grafana dashboard 10 panel (template JSON) | 🟡 | ⏳ | — |
| S3-01 | GitHub Actions CI (lint, typecheck, tests, security scan) | 🟠 | ⏳ | — |
| S3-04 | Pino structured logging (logger module + top modul) | 🟡 | ⏳ | — |
| S3-05 | Prometheus `/metrics` endpoint + 8 metric kustom | 🟡 | ⏳ | — |
| S3-03 | Sentry integration (gated on DSN env) | 🟠 | ⏳ | — |
| S3-02 | Husky + lint-staged pre-commit | 🟡 | ⏳ | — |

## Catatan eksekusi

Urutan dipilih: items file-only & low-risk dulu (migrate detach, runbook
markdown, deploy script, Grafana JSON, CI YAML) → install-package items
(Pino logger, Prometheus client) → integrasi eksternal (Sentry — butuh
DSN secret) → Husky last karena perlu adjust scripts/package.json.

Setiap item satu commit terpisah dengan footer alasan.

## Exit gates target

| Gate | Status |
|---|---|
| GL-10 CI passes on every PR | ⏳ S3-01 + S3-02 |
| GL-11 Sentry receives & groups errors with source-map | ⏳ S3-03 |
| GL-12 Grafana shows live metrics from staging | ⏳ S3-05 + S3-07 |
| GL-13 Blue/green deploy 0-downtime cutover | ⏳ S3-08 + S3-09 |
| GL-14 Incident runbooks reviewed | ⏳ S3-10 |
