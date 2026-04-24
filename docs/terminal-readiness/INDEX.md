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

### 🚨 3 CRITICAL (Block launch)
1. **Refund approval tidak release seat** — `refunds.service.ts:63`
2. **Cashier session tidak per-staff** — `cashier.service.ts:15`
3. **0 test untuk modul kritis** — booking, hold, payment, refund, cashier

### 🟠 6 HIGH (Fix sebelum public launch)
4. Cargo waybill PII publik — `cargo.controller.ts:41`
5. No CI/CD pipeline
6. No Sentry / structured logging
7. No helmet (security headers) — defense-in-depth
8. Drivers/Vehicles tidak cek RBAC di service layer
9. Engine idempotency in-memory only (lost on restart)

### 🟡 ~14 MEDIUM (Sprint 2-3)
Detail di `01` & `02`.

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
