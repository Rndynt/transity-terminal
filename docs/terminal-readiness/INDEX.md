# TransityTerminal Production Readiness — Index

**Tanggal analisis:** 24 April 2026
**Branch:** `feat/reservation-engine-adapter` (HEAD `d42fb86`)
**Scope:** TransityTerminal + Reservation Engine sidecar (Rust)

---

## Cara Membaca Dokumen

| Dokumen | Audience | Kapan dibaca |
|---|---|---|
| `00-TERMINAL-OVERVIEW.md` | Tech lead, PM | First read — peta arsitektur & headlines |
| `01-TERMINAL-SECURITY.md` | Tech lead, security officer | Sebelum merencanakan sprint security |
| `02-TERMINAL-BUGS-AND-CONTRACTS.md` | Senior dev, integrator | Daily reference saat coding fix |
| `03-TERMINAL-PERFORMANCE.md` | Senior dev | Saat plan performance work |
| `04-TERMINAL-DEVOPS.md` | DevOps, senior dev | Setup CI/CD, monitoring, deploy |
| `05-TERMINAL-ROADMAP.md` | PM, tech lead | Sprint planning |
| `06-TERMINAL-GO-LIVE-GATE.md` | Semua | Daily — checklist sebelum launch |

---

## Status Headlines

> **Update 2026-04-24 (after Sprint 1 + 2):** semua CRITICAL & sebagian
> besar HIGH sudah resolved. Lihat `SPRINT1-PROGRESS.md` &
> `SPRINT2-PROGRESS.md` untuk commit hash per item.

### 🚨 3 CRITICAL (Block launch) — ✅ ALL RESOLVED
1. ~~Refund approval tidak release seat~~ — ✅ S1-01 (`4d25f54`)
2. ~~Cashier session tidak per-staff~~ — ✅ S1-02 (`925e782`) + migration 0010
3. ~~0 test untuk modul kritis~~ — ✅ Sprint 1 + 2: 37 sprint2 + 5 sprint1 = 42 test

### 🟠 6 HIGH (Fix sebelum public launch)
4. ~~Cargo waybill PII publik~~ — ✅ S1-06 (`e68098b`) + cleanup S2-followup `#4` (`tracking_secret` NOT NULL no-default)
5. **No CI/CD pipeline** — 🔄 Sprint 3 (S3-01)
6. **No Sentry / structured logging** — 🔄 Sprint 3 (S3-03 + S3-04)
7. ~~No helmet (security headers)~~ — ✅ S1-08 (`d3a74c2`)
8. **Drivers/Vehicles tidak cek RBAC di service layer** — ⏭️ deferred ke project task `#2` (in-progress)
9. **Engine idempotency in-memory only (lost on restart)** — ⚠️ partial: compensation queue persist DB (S2-04), idempotency key store masih in-memory; defer ke Sprint 4

### 🟡 ~14 MEDIUM (Sprint 2-3)
Sprint 2 selesai semua 11 item — lihat `SPRINT2-PROGRESS.md`. Sisa
medium pindah ke Sprint 3-4.

### 🟢 LOW (Backlog)
Detail di docs.

---

## Estimasi Timeline

```
Sprint 1 (1 minggu)  — Stop the bleed (3 critical bugs)
Sprint 2 (1 minggu)  — Engine integration polish + Console contracts
Sprint 3 (1 minggu)  — CI/CD + Observability
Sprint 4 (1 minggu)  — Performance + UX polish
Sprint 5 (1 minggu)  — Soak + audit + go-live prep

TOTAL: ~5 minggu kalender (2 dev: 1 senior + 1 mid-level)
```

## Komponen yang Dianalisis

```
Workspace ini (TransityTerminal):
├── server/ (32 modul)
├── client/ (30 pages)
├── shared/schema/ (24 schema files)
├── migrations/ (10 migrations, latest 0009)
└── docs/

External (dianalisis di .local/ecosystem-analysis/):
└── TransityTerminal_ResvCoreEngine/ (Rust engine v1.0.1, optional sidecar)
```

---

## Folder _legacy/

Berisi 6 dokumen analisis ekosistem 3-product sebelumnya (TransityApp + Console + Terminal). 
Sudah obsolete untuk keperluan saat ini — disimpan untuk referensi historis.

Dokumen aktif (00-06 dengan prefix `TERMINAL-`) adalah single source of truth.
