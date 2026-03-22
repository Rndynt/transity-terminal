# TransityTerminal — Report System Plan

## Arsitektur

### Komponen Reusable (Shared)
- `ReportFilters` — Filter tanggal range (dari-sampai) + preset (Hari Ini, 7 Hari, 30 Hari, Bulan Ini) + outlet/channel/rute selector
- `SummaryCards` — Kartu angka ringkasan (icon + label + value + subtitle) + grid wrapper
- `ReportPageLayout` — Layout halaman report (header + icon + loading state + content area)
- Reuse: `fmtCurrency`, `fmtDate` dari `lib/constants.ts`
- Reuse: semua badge dari `components/shared/StatusBadges.tsx`
- Reuse: Recharts (sudah installed) untuk chart/grafik

### Backend Pattern
- Semua endpoint report di `server/modules/reports/`
- Satu controller: `reports.controller.ts`
- Satu service: `reports.service.ts`
- Query aggregate langsung ke DB via `sql.raw()`
- Satu endpoint filter options: `/api/reports/filter-options`

### Routing
- `/reports/revenue` — Pendapatan
- `/reports/sales` — Penjualan Harian
- `/reports/trip-profitability` — Laba Rugi per Trip
- `/reports/load-factor` — Occupancy / Load Factor
- `/reports/cancellations` — Pembatalan & Unseat
- `/reports/cargo` — Kargo
- `/reports/payments` — Pembayaran
- `/reports/promos` — Promo & Voucher
- `/reports/drivers` — Performa Supir
- `/reports/outlets` — Performa Outlet
- `/reports/operational-costs` — Biaya Operasional (SPJ)
- `/reports/daily-manifest` — Rekap Manifest

---

## Checklist Laporan

### Prioritas 1 — DONE
- [x] **Komponen Reusable Report** (ReportFilters, SummaryCards, ReportPageLayout)
- [x] **Backend Report Module** (controller + service + routes registered)
- [x] **Sidebar "LAPORAN" section** (4 menu items)
- [x] **Frontend routing** (4 report pages in App.tsx)
- [x] **Laporan Pendapatan (Revenue)**
  - [x] Backend: aggregate bookings+payments by date range, outlet, channel, rute
  - [x] Frontend: summary cards (total revenue, jumlah booking, rata-rata per booking, jumlah trip) + chart tren harian + breakdown per channel (bar chart) + tabel per rute + tabel per outlet
- [x] **Laporan Penjualan Harian**
  - [x] Backend: bookings per tanggal, breakdown per outlet/channel/status
  - [x] Frontend: summary cards + stacked bar chart (paid vs canceled) + tabel per status (dengan badge) + tabel per channel + tabel per outlet + tabel 100 booking terbaru
- [x] **Laporan Laba Rugi per Trip**
  - [x] Backend: revenue (tiket+kargo) vs biaya SPJ per trip
  - [x] Frontend: summary cards (revenue, biaya, laba, margin%) + top 10 chart horizontal + tabel detail per trip
- [x] **Laporan Load Factor / Occupancy**
  - [x] Backend: kapasitas vs terisi per trip
  - [x] Frontend: summary cards (avg LF%, total pax, total kapasitas) + tren harian line chart + bar chart per rute + tabel detail per trip dengan warna badge

### Prioritas 2 — DONE
- [x] **Laporan Pembatalan & Unseat**
  - [x] Backend: aggregate booking_history by action type, daily, by route, recent 100
  - [x] Frontend: summary cards (total/canceled/unseated/reschedule) + stacked bar chart harian + tabel per aksi + per rute + riwayat terbaru dengan alasan
- [x] **Laporan Kargo**
  - [x] Backend: aggregate cargo_shipments by date, status, rute
  - [x] Frontend: summary cards (kiriman/revenue/berat/terkirim) + chart harian + tabel per status + per rute + kiriman terbaru
- [x] **Laporan Pembayaran**
  - [x] Backend: aggregate payments by method, status, outlet, daily
  - [x] Frontend: summary cards + tren harian chart + pie chart metode bayar + tabel per metode + per status + per outlet + transaksi terbaru

### Prioritas 3 — Enhancement
- [ ] **Laporan Promo & Voucher**
  - [ ] Penggunaan promo, total diskon, efektivitas
- [ ] **Laporan Performa Supir**
  - [ ] Trip per supir, revenue per supir, biaya per supir
- [ ] **Laporan Performa Outlet**
  - [ ] Ranking outlet, jumlah booking, revenue per outlet
- [ ] **Laporan Biaya Operasional (SPJ)**
  - [ ] Estimasi vs aktual, breakdown per kategori
- [ ] **Laporan Rekap Manifest Harian**
  - [ ] Ringkasan semua keberangkatan + penumpang + revenue per hari
