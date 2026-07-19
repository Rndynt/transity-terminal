# TransityCore — Dokumentasi Fitur Lengkap

Dokumen ini menjelaskan seluruh fitur yang telah dibangun di sistem TransityCore, termasuk teknologi yang digunakan, cara kerja, dan logika perhitungan.

---

## Daftar Isi

### Phase 1 — Core
1. [Arsitektur & Teknologi](#1-arsitektur--teknologi)
2. [Terminal CSO (Reservasi)](#2-terminal-cso-reservasi)
3. [Manajemen Kursi & Seat Hold](#3-manajemen-kursi--seat-hold)
4. [Penjadwalan & Virtual Trip](#4-penjadwalan--virtual-trip)
5. [Perhitungan Harga & Pricing Engine](#5-perhitungan-harga--pricing-engine)
6. [Promo & Voucher](#6-promo--voucher)
7. [Alur Booking (Pemesanan)](#7-alur-booking-pemesanan)
8. [Kargo & Pengiriman Barang](#8-kargo--pengiriman-barang)
9. [SPJ (Surat Perintah Jalan)](#9-spj-surat-perintah-jalan)
10. [Manifest Perjalanan](#10-manifest-perjalanan)
11. [RBAC (Kontrol Akses Berbasis Peran)](#11-rbac-kontrol-akses-berbasis-peran)
12. [Real-time WebSocket](#12-real-time-websocket)
13. [Laporan & Analitik](#13-laporan--analitik)
14. [Unseat, Reschedule & Riwayat Booking](#14-unseat-reschedule--riwayat-booking)
15. [Aplikasi Mobile (B2C)](#15-aplikasi-mobile-b2c)
16. [Optimasi Performa](#16-optimasi-performa)
17. [Database & Skema](#17-database--skema)
18. [Data Integrity — Snapshot System](#18-data-integrity--snapshot-system)
19. [Security](#19-security)

### Phase 2 — Operasional & Keuangan
20. [Dashboard Ringkasan Harian (F01)](#20-dashboard-ringkasan-harian-f01)
21. [Notifikasi & Alert System (F02)](#21-notifikasi--alert-system-f02)
22. [Rekonsiliasi Pembayaran & Tutup Kasir (F04)](#22-rekonsiliasi-pembayaran--tutup-kasir-f04)
23. [Refund Management (F05)](#23-refund-management-f05)
24. [Database Pelanggan / CRM Sederhana (F09)](#24-database-pelanggan--crm-sederhana-f09)
25. [Fitur RBAC Tambahan — Cross-Outlet CSO](#25-fitur-rbac-tambahan--cross-outlet-cso-phase-2)
26. [Dev Staff Seed](#26-dev-staff-seed-development-only)

---

## 1. Arsitektur & Teknologi

### Stack Teknologi

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| Frontend Web | React 18 + TypeScript + Vite | Single Page Application |
| UI Framework | Tailwind CSS + shadcn/ui | Komponen UI modern dan responsif |
| State Management | TanStack Query (React Query) | Server state, caching, auto-refetch |
| Routing | wouter | Lightweight client-side routing |
| Backend | Fastify 5 + TypeScript | HTTP server, async-first |
| ORM | Drizzle ORM | Type-safe SQL query builder |
| Database | PostgreSQL (Neon) | Relational database |
| Real-time | Socket.IO | WebSocket untuk update kursi real-time |
| Mobile | Expo React Native | Aplikasi B2C untuk pelanggan |
| Auth | Realmio (OpenID Connect) | Autentikasi multi-tenant |

### Pola Arsitektur

```
Client (React) ←→ Fastify API Server ←→ PostgreSQL
                        ↕
                   Socket.IO (Real-time)
```

- **Route → Controller → Service → Repository Pattern**: Setiap modul memiliki routes (endpoint registration + preHandler), controller (HTTP handler), service (business logic), dan repository (database query).
- **Decentralized Route Registration**: Setiap module mendaftarkan route sendiri via `registerXxxRoutes(app)`, di-orchestrate dari `server/routes.ts`.
- **Repository Pattern**: Data access dipecah ke 6 domain repositories (`server/repositories/`), diakses via thin facade `storage.ts` (IStorage interface).
- **Domain-Split Schema**: Drizzle schema dipecah per domain di `shared/schema/` (13 file), di-re-export dari `shared/schema/index.ts`.
- **Fastify preHandler**: Middleware autentikasi dan RBAC menggunakan hook `preHandler` Fastify.
- **Modular Structure**: 20+ modul di `server/modules/`, masing-masing mandiri.

### File Utama

| File | Fungsi |
|------|--------|
| `server/index.ts` | Bootstrap Fastify, dekorasi request, error handler |
| `server/routes.ts` | Route orchestrator — delegates ke `registerXxxRoutes()` per module |
| `server/storage.interface.ts` | IStorage interface + manifest types |
| `server/storage.ts` | Thin facade — delegasi ke 6 domain repositories |
| `server/repositories/*.ts` | Domain-specific data access (fleet, network, scheduling, booking, cargo, finance) |
| `server/realtime/ws.ts` | WebSocket server (Socket.IO) |
| `shared/schema/index.ts` | Re-exports 13 domain schema files (Drizzle tables + Zod schemas) |
| `client/src/pages/cso/CsoPage.tsx` | Halaman utama terminal CSO |

---

## 2. Terminal CSO (Reservasi)

Terminal CSO (Customer Service Officer) adalah antarmuka utama untuk staf melakukan reservasi tiket bus.

### Alur Kerja

```
Pilih Outlet → Pilih Trip → Pilih Rute (Naik/Turun) → Pilih Kursi → Isi Data Penumpang → Bayar
```

### Komponen Utama

| Komponen | File | Fungsi |
|----------|------|--------|
| CsoPage | `client/src/pages/cso/CsoPage.tsx` | Halaman utama, state management |
| TripSelector | `client/src/components/cso/TripSelector.tsx` | Pilih outlet, tanggal, dan trip |
| RouteTimeline | `client/src/components/cso/RouteTimeline.tsx` | Visualisasi rute, pilih naik/turun |
| SeatMap | `client/src/components/cso/SeatMap.tsx` | Peta kursi interaktif |
| PassengerForm | `client/src/components/cso/PassengerForm.tsx` | Form data penumpang + pembayaran |

### Fitur Detail

- **2 Fase Layout**: Fase "Select" (pilih trip/rute/kursi) dan fase "Book" (isi data & bayar)
- **Deep-Link**: Bisa buka CSO dari halaman All Bookings dengan parameter URL (`?tripId=&outletId=&date=&originStopId=&destinationStopId=`), semua auto-terisi
- **Mobile Responsive**: Layout 2 panel di desktop, tab-based di mobile
- **Auto Proceed**: Setelah pilih origin + destination, otomatis tampil seat map

### Teknologi

- **State**: `useBookingFlow` custom hook mengelola seluruh state reservasi
- **Caching**: TanStack Query dengan `staleTime: 5000ms` untuk seat map
- **Debounce**: Kalkulasi harga di-debounce 300ms untuk mencegah API call berlebihan

---

## 3. Manajemen Kursi & Seat Hold

### Cara Kerja Seat Map

Seat map menampilkan layout kursi bus secara visual dengan status real-time per kursi.

#### Layout Kursi

Layout disimpan di tabel `layouts` sebagai JSON:

```json
{
  "seatMap": [
    { "col": 1, "row": 1, "class": "eksekutif", "seat_no": "1A" },
    { "col": 3, "row": 1, "class": "eksekutif", "seat_no": "1B" },
    { "col": 4, "row": 1, "class": "eksekutif", "seat_no": "1C" }
  ]
}
```

- Layout 1+2: Kolom A (kiri) — lorong — Kolom B+C (kanan)
- Grid di-render menggunakan CSS Grid, otomatis center berdasarkan `minCol`/`maxCol` aktual

#### Status Kursi

| Status | Warna | Keterangan |
|--------|-------|------------|
| `available` | Putih | Tersedia untuk dipilih |
| `selected` | Biru | Sudah dipilih (di-hold) oleh CSO ini |
| `held` | Kuning | Di-hold oleh CSO lain |
| `booked` | Merah | Sudah dibooking |
| `assign-available` | Hijau | Mode assign (untuk unseated passenger) |
| `reschedule-available` | Ungu | Mode reschedule |

### Mekanisme Seat Hold

Seat hold adalah mekanisme temporary lock saat CSO memilih kursi, mencegah double-booking.

```
CSO klik kursi → POST /api/holds → seatHolds record + seatInventory.holdRef update → WebSocket broadcast
```

#### Hold TTL (Time To Live)

- **Short hold**: TTL default 5 menit (300 detik, konfigurasi via `HOLD_TTL_SHORT_SECONDS`)
- **Long hold**: TTL default 30 menit (1800 detik, konfigurasi via `HOLD_TTL_LONG_SECONDS`), dikonversi saat proses booking dimulai
- **Auto-cleanup**: Scheduler berjalan setiap 1 menit, menghapus hold yang expired
- **Timer visual**: Countdown timer di UI menunjukkan sisa waktu hold

#### Tabel Terkait

| Tabel | Fungsi |
|-------|--------|
| `seat_inventory` | Pre-computed: 1 row per kursi per leg, field `booked` dan `holdRef` |
| `seat_holds` | Record hold aktif: `tripId`, `seatNo`, `legIndexes`, `expiresAt`, `operatorId` |

#### Perhitungan Leg Index

Untuk trip multi-stop, 1 kursi bisa memiliki beberapa leg:

```
Stop A (seq 1) → Stop B (seq 2) → Stop C (seq 3)

Booking dari A ke C:
  leg 1 = seq 1→2 (A→B)
  leg 2 = seq 2→3 (B→C)
  legIndexes = [1, 2]
```

Kursi dianggap `available` hanya jika SEMUA leg yang diminta belum `booked` dan tidak di-`hold`.

#### Precompute Inventory

Saat trip dibuat, `precomputeInventory` membuat record `seat_inventory` untuk setiap kombinasi kursi × leg:

```
24 kursi × 2 legs = 48 record seat_inventory
```

---

## 4. Penjadwalan & Virtual Trip

### Konsep Virtual vs Real Trip

| Jenis | Tabel | Keterangan |
|-------|-------|------------|
| Trip Base | `trip_bases` | Template jadwal: pattern + hari operasi + waktu default |
| Virtual Trip | (tidak di DB) | Muncul di CSO berdasarkan Trip Base, belum ada record |
| Real Trip | `trips` | Sudah di-materialize dengan stop times, legs, seat inventory |

### Cara Kerja

1. Admin membuat **Trip Base** (template): pilih pattern (rute), hari operasi (Senin-Minggu), waktu berangkat
2. Saat CSO buka tanggal tertentu, sistem mencocokkan Trip Base dengan hari tersebut → ditampilkan sebagai **Virtual Trip**
3. Saat CSO klik virtual trip → `POST /api/cso/materialize-trip` → Trip Base di-materialize menjadi **Real Trip**:
   - Record `trips` dibuat
   - `trip_stop_times` dibuat dari pattern stops + waktu default
   - `trip_legs` dibuat untuk setiap segmen
   - `seat_inventory` di-precompute
4. Virtual trip hanya bisa di-materialize 1x per tanggal (unique constraint `base_id + service_date`)

### Tabel Terkait

| Tabel | Keterangan |
|-------|------------|
| `trip_patterns` | Definisi rute (nama, kode) |
| `pattern_stops` | Urutan stop dalam pattern (sequence, boarding/alighting rules) |
| `trip_bases` | Template jadwal (pattern, hari operasi, waktu, valid period) |
| `trips` | Instance trip aktual (tanggal, status, kendaraan, driver) |
| `trip_stop_times` | Waktu tiba/berangkat per stop per trip |
| `trip_legs` | Segmen perjalanan antar stop |

---

## 5. Perhitungan Harga & Pricing Engine

### Model: OD-Matrix (bukan flat/per-leg)

Harga penumpang ditentukan per **pasangan asal-tujuan (OD pair)**, bukan satu harga rata untuk seluruh pola atau harga linear per-segmen. Ini krusial untuk pola 3+ kota di mana harga antar kota tidak proporsional terhadap jarak/jumlah leg (mis. Jakarta-Bandung Rp 95.000, Bandung-Jogja Rp 100.000, tapi Jakarta-Jogja Rp 200.000 — bukan hasil penjumlahan).

Setiap baris `price_rules` menyimpan sebuah **matrix**: objek JSON berisi harga per pasangan stop, di-key dengan `"<originStopId>|<destinationStopId>"`. Sel yang kosong atau bernilai 0 berarti "harga belum diset" untuk pasangan itu.

### Precedence Resolusi

Untuk satu OD tertentu pada satu trip, harga dicari lewat `resolvePassengerCell()` (`server/modules/priceRules/priceRules.resolver.ts`) dengan urutan:

```
1. price_rule_exceptions — override khusus SATU trip untuk OD ini (mis. promo satu hari)
2. price_rules scope='pattern' — template musiman (kind='seasonal') yang jendela
   valid_from/valid_to-nya mencakup tanggal trip; kalau tidak ada yang aktif,
   pakai template reguler (kind='regular') pola tersebut
3. price_rules scope='global' — fallback lintas-pola (jarang dipakai)
4. Kalau tidak ada satupun yang mengisi harga > 0 → 0 ("harga belum diset")
```

### Struktur `price_rules.matrix` (jsonb)

```json
{
  "version": 1,
  "cells": {
    "<stopIdJakarta>|<stopIdBandung>": { "price": 95000 },
    "<stopIdBandung>|<stopIdJogja>": { "price": 100000 },
    "<stopIdJakarta>|<stopIdJogja>": { "price": 200000 }
  }
}
```

### Validasi

- Trip tanpa harga sama sekali untuk outlet asal yang dipilih: disabled di CSO, tidak bisa dipilih, tampil badge "Belum Ada Harga".
- Trip dengan SEBAGIAN OD sudah diisi harga tetap bisa dipilih (OD-aware selectability) — hanya kombinasi asal-tujuan yang harganya 0 yang diblokir saat CSO memilih rute spesifik.
- Kalau OD yang diminta tetap resolve ke harga 0, API mengembalikan error `NO_PRICE_RULE` (HTTP 422) — baik dari `/api/pricing/quote-fare` maupun dari pembuatan booking (`POST /api/bookings`, `POST /api/bookings/pending`).
- Rute pendek dalam kota (mis. dua stop yang sama-sama di kota Bandung pada pola Jakarta-Bandung-Jogja) otomatis tersembunyi dari grid harga kalau pola belum mengaktifkan `allow_intra_city_booking` — lihat bagian Pola Perjalanan.

### `pricedMatrix` — OD-aware priced matrix per trip

Selain `resolvePassengerCell` (satu OD) dan `listPricedDestinationsFromOrigin` (pattern+global saja, dipakai untuk pre-selection cepat yang TIDAK butuh akurasi trip-exception), resolver menyediakan `buildPricedMatrix()`: matrix harga sparse per-trip yang exception-accurate (trip-exception > pattern > global, presis sama dengan precedence `resolvePassengerCell`) DAN sudah difilter oleh 3 syarat kelayakan booking (boarding diizinkan di asal, alighting diizinkan di tujuan, tidak diblokir aturan dalam-kota) — jadi setiap pasangan yang muncul di hasilnya dijamin bisa langsung dibooking.

Bentuk: `{ [originStopId]: { [destinationStopId]: price } }`. Origin tanpa tujuan yang priced+bookable tidak muncul sama sekali (sparse).

Dua konsumen:
- **App API**: `GET /api/app/trips/:id` mengembalikan field `pricedMatrix` ini di response (bukan di `GET /api/app/trips/search`, yang cuma satu OD per baris hasil pencarian — lihat komentar di `TripSearchResult` pada `app.service.ts`). Konsumen eksternal (Console/OTA) yang ingin menawarkan pemilihan naik/turun selain pasangan default hasil pencarian WAJIB validasi pasangan asal→tujuan pilihannya lewat `pricedMatrix[origin]?.[destination]` sebelum memanggil `POST /api/app/bookings` — bukan lewat flag boolean per-stop.
- **CSO**: `GET /api/pricing/trip-matrix/:tripId` (endpoint baru, module `priceRules`) memberi data yang sama untuk panel "Pilih Rute" (`RouteTimeline.tsx`) supaya tombol Naik/Turun untuk kombinasi yang tidak priced otomatis di-grey-out dengan badge "Belum Ada Harga", sebelum CSO sempat memicu 422 dari booking.

⚠️ Jangan pakai `listPricedDestinationsFromOrigin`/`hasAnyPricedDestinationFromOrigin` untuk gating booking baru — keduanya sengaja skip trip-exception dan hanya cocok untuk pre-selection ringan yang sudah ada.

### File Terkait

| File | Fungsi |
|------|--------|
| `server/modules/priceRules/pricing.service.ts` | `quoteFare()` — perhitungan harga untuk satu booking |
| `server/modules/priceRules/pricing.controller.ts` | API endpoint `/api/pricing/quote-fare` |
| `server/modules/priceRules/priceRules.resolver.ts` | `resolvePassengerCell()`, `buildPricedMatrix()` — resolver precedence, helper matrix/grid (domain-agnostic, dipakai juga oleh cargo pricing) |
| `server/modules/priceRules/priceRules.service.ts` | CRUD `price_rules`/`price_rule_exceptions`, sync status, template musiman, `getPricedMatrixForTrip()` |
| `server/modules/priceRules/priceRules.controller.ts` | API endpoint `/api/pricing/priced-destinations`, `/api/pricing/trip-matrix/:tripId` |
| `server/modules/app/app.service.ts` | `getTripDetail()` — menyisipkan `pricedMatrix` ke response App API |
| `client/src/components/cso/RouteTimeline.tsx` | Panel "Pilih Rute" CSO — OD-aware gating pakai `pricedMatrix` |
| `shared/schema/pricing.ts` (`priceRules`, `priceRuleExceptions`) | Definisi tabel |
| `client/src/components/masters/PriceRulesManager.tsx` | UI Master Data "Aturan Harga" |

---

## 6. Promo & Voucher

### Jenis Promo

| Tipe | Keterangan |
|------|------------|
| `percentage` | Diskon persentase dari subtotal, ada batas max diskon |
| `fixed` | Diskon nominal tetap |

### Cara Kerja

```
1. User masukkan kode promo di form pembayaran
2. Validasi:
   - Kode valid? (cek promotions atau vouchers)
   - Masih aktif? (tanggal valid_from/valid_to)
   - Belum melebihi usage limit?
   - Memenuhi min purchase?
   - Channel sesuai? (CSO/WEB/APP)
   - Scope sesuai? (global/trip-specific/pattern-specific)
3. Hitung diskon:
   - Percentage: subtotal × discountValue / 100, cap by maxDiscount
   - Fixed: discountValue langsung
4. Final total = subtotal - diskon
```

### Voucher

- Voucher adalah kode unik yang di-generate dari promo
- 1 promo bisa punya banyak voucher
- Status voucher: `active`, `used`, `revoked`
- Voucher di-redeem sekali pakai

### Tabel Terkait

| Tabel | Field Kunci |
|-------|-------------|
| `promotions` | code, type, discountValue, maxDiscount, scope, usageLimit |
| `vouchers` | code, promoId, status, redeemedAt |
| `bookings` | discountAmount, promoId, voucherCode |

---

## 7. Alur Booking (Pemesanan)

### Flow Lengkap

```
Pilih Kursi → Hold Seat → Isi Data Penumpang → Bayar → Booking Created
     ↓              ↓              ↓                ↓           ↓
  UI click    POST /api/holds   Form input    Validasi     DB Transaction
                                              pembayaran
```

### Proses Booking (`BookingsService.createBooking`)

```
1. VALIDASI
   ├── Cek boarding/alighting rules (boleh naik/turun di stop ini?)
   ├── Verifikasi hold aktif (seat di-hold oleh operator ini? belum expired?)
   └── Validasi data penumpang

2. PRICING
   ├── Hitung tarif per penumpang via PricingService.quoteFare()
   ├── Terapkan promo/voucher jika ada
   └── Hitung total akhir (subtotal - diskon)

3. PAYMENT VALIDATION
   └── Cocokkan jumlah bayar client dengan expected total

4. DATABASE TRANSACTION (atomic)
   ├── Insert booking record (status: 'paid' atau 'pending')
   ├── Insert passenger records (dengan ticketNumber unik)
   ├── Update seat_inventory (booked = true, holdRef = null)
   ├── Hapus seat_holds records
   ├── Insert payment record
   └── Insert print_jobs record

5. BROADCAST
   └── WebSocket: emit INVENTORY_UPDATED ke semua client
```

### Booking Status

| Status | Keterangan |
|--------|------------|
| `paid` | Sudah dibayar, tiket aktif |
| `pending` | Menunggu pembayaran (auto-cancel jika expired) |
| `canceled` | Dibatalkan |
| `completed` | Trip selesai |

### Pending Booking Auto-Cleanup

- Booking pending punya `pendingExpiresAt` timestamp
- Scheduler berjalan setiap 1 menit
- Jika expired: status diubah ke `canceled`, kursi dilepas kembali ke inventory

### Concurrency Control

`DeterministicBookingService` menggunakan `SELECT ... FOR UPDATE` (row-level lock di PostgreSQL) untuk mencegah race condition saat beberapa CSO booking kursi yang sama bersamaan.

---

## 8. Kargo & Pengiriman Barang

### Fitur

- Pemesanan pengiriman barang di terminal CSO
- Waybill otomatis (format: `TRN-YYYYMMDD-XXXXX`)
- Perhitungan tarif otomatis
- Tracking status pengiriman
- Integrasi dengan manifest trip

### Perhitungan Tarif Kargo

```
1. Cari rate berdasarkan: cargoTypeId + originStopId + destinationStopId
   Prioritas: Trip-specific > Pattern-specific > Global

2. Hitung:
   weightCost = pricePerKg × weightKg
   legCost    = pricePerLeg × jumlahLeg

3. Total = MAX(weightCost + legCost, minCharge)
```

### Contoh

```
Rate: pricePerKg=5000, pricePerLeg=10000, minCharge=25000
Barang: 3 kg, 2 legs

weightCost = 5000 × 3 = 15.000
legCost    = 10.000 × 2 = 20.000
subtotal   = 35.000
Total      = MAX(35.000, 25.000) = Rp 35.000
```

### Status Lifecycle Kargo

```
pending → received → loaded → in_transit → arrived → delivered
                                                  ↘ returned
                                         canceled ↙
```

Transisi dijaga oleh `ALLOWED_TRANSITIONS` — tidak bisa loncat status.

### Tabel Terkait

| Tabel | Keterangan |
|-------|------------|
| `cargo_types` | Jenis barang (General, Fragile, Document, dll) |
| `cargo_rates` | Tarif per jenis + rute |
| `cargo_shipments` | Record pengiriman (waybill, pengirim, penerima, status) |

---

## 9. SPJ (Surat Perintah Jalan)

SPJ adalah dokumen operasional yang mencatat biaya perjalanan dan penugasan driver/kendaraan.

### Alur Kerja

```
Buat SPJ → Isi Biaya Estimasi → Terbitkan SPJ → Trip Berjalan → Isi Biaya Aktual → Settlement
```

### Status SPJ

| Status | Keterangan |
|--------|------------|
| `draft` | Baru dibuat, bisa diedit |
| `issued` | Sudah diterbitkan, driver bawa SPJ |
| `on_trip` | Trip sedang berjalan |
| `settled` | Biaya aktual sudah diisi dan diselesaikan |

### Perhitungan Profitabilitas Trip

```
Revenue    = Total tiket penumpang + Total kargo
Costs      = Σ actual cost lines (BBM, tol, uang jalan, parkir, dll)
Profit     = Revenue - Costs
Settlement = Advance - Σ actual costs (sisa uang muka yang harus dikembalikan)
```

### Komponen Biaya (Cost Lines)

| Kategori | Contoh |
|----------|--------|
| `fuel` | BBM / bahan bakar |
| `toll` | Biaya tol |
| `driver_allowance` | Uang jalan driver |
| `parking` | Biaya parkir |
| `meals` | Uang makan |
| `maintenance` | Perbaikan mendadak |
| `other` | Biaya lain-lain |

### Tabel Terkait

| Tabel | Keterangan |
|-------|------------|
| `spj` | Header SPJ (nomor, trip, driver, vehicle, status) |
| `spj_cost_lines` | Detail biaya (kategori, estimasi, aktual, is_advance) |
| `trip_cost_templates` | Template biaya default |
| `trip_cost_items` | Item biaya dalam template |

---

## 10. Manifest Perjalanan

### Fitur

- Daftar lengkap penumpang per trip (nama, tiket, kursi, rute)
- Daftar kargo yang dimuat
- Informasi trip (rute, kendaraan, driver, tanggal)
- Ringkasan revenue (tiket + kargo)
- Support cetak thermal printer 80mm
- Tracking timestamp cetak pertama

### Cara Kerja

```
GET /api/trips/:id/manifest → Aggregasi data → JSON response
```

Data yang diagregasi:
- Header trip (rute, tanggal, kendaraan, driver)
- Daftar penumpang (dari tabel `passengers` + `bookings`)
- Daftar kargo (dari tabel `cargo_shipments`)
- Total revenue dan jumlah item
- Penumpang unseated dikecualikan dari manifest

### Pencetakan

```
POST /api/trips/:id/manifest/print → Record timestamp cetak pertama
```

- `ThermalManifest` component: format optimized untuk printer thermal 80mm
- `ManifestDialog`: dialog preview sebelum cetak

---

## 11. RBAC (Kontrol Akses Berbasis Peran)

### Arsitektur

```
User → Staff Member (role + outlet) → Role → Feature Flags → Akses
```

### Roles yang Tersedia

| Role | Deskripsi | Level Akses |
|------|-----------|-------------|
| `owner` | Pemilik | Akses penuh ke semua fitur |
| `manager` | Manajer | Operasional penuh + semua laporan |
| `finance` | Keuangan | Laporan keuangan + lihat booking (read-only) |
| `spv_operations` | SPV Operasional | Jadwal, SPJ, manifest, kargo |
| `operations` | Staf Operasional | Operasional harian terbatas |
| `spv_cso` | SPV CSO | CSO + unseat/reschedule |
| `cso` | CSO | Booking dan transaksi harian |

### Kategori Feature Flag

| Prefix | Keterangan | Contoh |
|--------|------------|--------|
| `page.*` | Akses halaman | `page.cso`, `page.cargo`, `page.reports`, `page.schedule.closed`, `page.cso.view_closed` |
| `action.*` | Aksi spesifik | `action.booking.cancel`, `action.passenger.unseat`, `action.trip.batch_reschedule` |
| `report.*` | Akses laporan | `report.revenue`, `report.load_factor`, `report.commercial_fee` |
| `master.*` | Kelola master data | `master.stops`, `master.vehicles` |
| `admin.*` | Administrasi | `admin.staff.manage`, `admin.flags.manage` |

### Implementasi

**Server-side (Middleware)**:
```
Route: GET /api/stops
preHandler: [requireFlag('master.stops')]
→ Cek user punya flag 'master.stops' → Allow/Deny
```

**Client-side (Komponen)**:
```
<RequireFlag flag="page.cso">
  <CsoPage />
</RequireFlag>
→ Render hanya jika user punya flag 'page.cso'
```

**Outlet Scoping**:
- Staff di-assign ke outlet tertentu
- `requireOutletScope` middleware membatasi data sesuai outlet user
- CSO hanya bisa lihat trip yang berangkat dari outlet-nya

### Admin UI

- `/admin/staff` — CRUD staff: assign user ke role + outlet
- `/admin/flags` — Toggle feature flag per role (matrix UI)

---

## 12. Real-time WebSocket

### Teknologi

Socket.IO dengan arsitektur room-based pub/sub.

### Room Structure

| Room | Format | Subscriber |
|------|--------|------------|
| Trip Room | `trip:{tripId}` | CSO yang sedang melihat trip ini |
| Base Room | `base:{baseId}` | CSO yang melihat trip dari base ini |
| CSO Room | `cso:{outletId}:{date}` | CSO pada outlet + tanggal tertentu |

### Event Types

| Event | Trigger | Efek |
|-------|---------|------|
| `INVENTORY_UPDATED` | Booking/hold/release/unseat | Refetch seat map |
| `TRIP_STATUS_CHANGED` | Status trip berubah | Refetch trip list |
| `HOLDS_RELEASED` | Hold expired/released | Refetch seat map |
| `TRIP_MATERIALIZED` | Virtual trip dimaterialize | Refetch trip list |
| `TRIP_CANCELED` | Trip dibatalkan | Refetch trip list |

### Alur Kerja

```
CSO buka trip → subscribeToTrip(tripId) → masuk room trip:{tripId}
                                                    ↓
CSO lain booking kursi → Server emit INVENTORY_UPDATED ke room
                                                    ↓
SeatMap component terima event → refetch() data kursi terbaru
```

### Fallback Polling

Jika WebSocket terputus, otomatis fallback ke polling 30 detik:
```typescript
refetchInterval: isConnected ? false : 30000
```

---

## 13. Laporan & Analitik

### Jenis Laporan

| Laporan | Endpoint | Metrik Utama |
|---------|----------|-------------|
| Revenue | `/api/reports/revenue` | Total pendapatan, per channel, per outlet, per rute |
| Sales | `/api/reports/sales` | Jumlah booking, distribusi status, tren harian |
| Load Factor | `/api/reports/load-factor` | Okupansi kursi (%), rata-rata per rute |
| Trip Profitability | `/api/reports/trip-profitability` | Profit per trip (revenue - cost SPJ) |
| Cancellations | `/api/reports/cancellations` | Pembatalan, reschedule, unseat |
| Cargo | `/api/reports/cargo` | Jumlah kiriman, total berat, revenue kargo |
| Payments | `/api/reports/payments` | Analisis metode pembayaran, status payment |
| Commercial Fee | `/api/reports/commercial-fee` | Biaya komersial 3% gross + 11% PPN, volume discount |

### Data Historis (Snapshot System)

Semua laporan menggunakan **snapshot columns** untuk menjaga akurasi historis:

```
COALESCE(booking.snap_origin_stop_name, stop.name) AS origin_stop_name
```

Snapshot disimpan saat:
- **Trip dimaterialisasi**: `snap_route_name`, `snap_route_code`
- **Booking dibuat**: `snap_origin_stop_name`, `snap_destination_stop_name`, `snap_departure_hhmm`, `snap_outlet_name`
- **Driver/kendaraan di-assign**: `snap_driver_name`, `snap_vehicle_plate`

Dengan pola COALESCE, data lama tanpa snapshot tetap bisa tampil (fallback ke data master terkini).

### Per-Report Permission Flags

Setiap laporan dilindungi permission flag tersendiri:

| Flag | Laporan |
|------|---------|
| `report.revenue` | Pendapatan |
| `report.sales` | Penjualan |
| `report.trip_profitability` | Laba Rugi Trip |
| `report.load_factor` | Load Factor |
| `report.cancellations` | Pembatalan |
| `report.cargo` | Kargo |
| `report.payments` | Pembayaran |
| `report.commercial_fee` | Biaya Komersial |

### Cara Perhitungan

**Revenue Report**:
```
Total Revenue = SUM(bookings.totalAmount) WHERE status IN ('paid', 'completed')
Per Channel   = GROUP BY bookings.channel
Per Outlet    = GROUP BY bookings.outletId
Daily Trend   = GROUP BY DATE(bookings.createdAt)
```

**Load Factor**:
```
Load Factor (%) = (jumlah penumpang aktif / kapasitas trip) × 100
Rata-rata       = AVG(load factor) per pattern (rute)
```

**Trip Profitability**:
```
Revenue = ticket revenue + cargo revenue
Costs   = SUM(spj_cost_lines.actualAmount)
Profit  = Revenue - Costs
Margin  = (Profit / Revenue) × 100
```

### Filter & Opsi

Semua laporan mendukung:
- Filter tanggal (range + preset: hari ini, minggu ini, bulan ini)
- Filter outlet
- Filter channel (CSO, WEB, APP, OTA)
- Filter rute (pattern)
- Export data

### Mode Tanggal (dateMode)

Laporan keuangan (Revenue, Sales, Payments, Cancellations, Cargo) mendukung toggle `dateMode`:

| dateMode | Kolom Filter | Keterangan |
|----------|-------------|------------|
| `paid` | `payments.paid_at` / `cargo_shipments.paid_at` | Filter berdasarkan tanggal pembayaran |
| `created` | `bookings.created_at` / `cargo_shipments.created_at` | Filter berdasarkan tanggal transaksi/kirim |
| `departure` | `trips.service_date` | Filter berdasarkan tanggal keberangkatan |

Default per laporan: Revenue & Payments → `paid`, Sales & Cargo → `created`, Cancellations → `paid` (tanggal batal).
Laba Rugi Trip dan Load Factor selalu menggunakan `departure` (tanpa toggle dateMode).

---

## 14. Unseat, Reschedule & Riwayat Booking

### Unseat (Lepas Kursi)

Melepas penumpang dari kursi tanpa membatalkan booking.

```
Klik kursi terisi → Lihat detail → "Unseat" → Isi alasan → Konfirmasi
```

- Kursi dilepas di `seat_inventory` (booked = false)
- Status penumpang berubah ke `unseated`
- Record di `booking_history` (action: 'unseated', reason)
- WebSocket broadcast INVENTORY_UPDATED

### Assign Kursi Baru

Untuk penumpang yang sudah di-unseat:

```
Panel "Penumpang Tanpa Kursi" → Klik "Assign" → Mode assign aktif (kursi hijau) → Klik kursi
```

- Timer 60 detik otomatis cancel mode assign
- Bisa assign ke kursi mana pun yang tersedia

### Reschedule (Pindah Trip/Kursi)

```
Detail penumpang → "Reschedule" → Isi alasan → Pilih trip baru → Pilih kursi baru
```

- Kursi lama dilepas
- Penumpang dipindah ke trip + kursi baru
- Record di `booking_history` (action: 'rescheduled', reason, previousTripId)

### Cancel Tiket

```
Detail penumpang → "Batalkan Tiket" → Isi alasan → Konfirmasi
```

- Status penumpang → `canceled`
- Kursi dilepas di seat_inventory
- Jika semua penumpang canceled → status booking → `canceled`
- Record di booking_history

### Batch Reschedule (Close Trip)

Saat menutup trip yang masih memiliki penumpang aktif, CSO dapat melakukan batch reschedule:

```
Close Trip → Cek penumpang aktif → Tampilkan BatchRescheduleDialog
    → Pilih trip tujuan → Reschedule semua penumpang sekaligus → Trip closed
```

**Endpoint**:
- `GET /api/trips/:id/active-passengers` — Daftar penumpang aktif
- `POST /api/trips/:id/close-with-reschedule` — Close trip + batch reschedule

**Permission Flags**:
- `action.trip.close` — Izin menutup trip
- `action.trip.batch_reschedule` — Izin batch reschedule penumpang
- `page.schedule.closed` — Izin melihat closed trips di halaman jadwal
- `page.cso.view_closed` — Izin melihat closed trips di halaman CSO

**Komponen Frontend**: `BatchRescheduleDialog`
- Menampilkan daftar penumpang aktif + kursi
- Selector trip tujuan (trip yang masih scheduled pada rute yang sama)
- Konfirmasi batch reschedule sebelum close

### Riwayat Booking

`GET /api/bookings/:id/history` → timeline semua perubahan:
- Siapa yang melakukan
- Kapan
- Aksi apa (unseat/reschedule/cancel/status_change)
- Alasan
- Data sebelumnya (kursi/trip lama)

---

## 15. Aplikasi Mobile (B2C)

Aplikasi React Native (Expo) untuk pelanggan langsung.

### Fitur

| Fitur | Screen | Keterangan |
|-------|--------|------------|
| Auth | Login/Register | Autentikasi pelanggan |
| Cari Trip | Search Results | Pencarian berdasarkan tanggal, asal, tujuan |
| Pilih Kursi | Select Seats | Seat map interaktif |
| Booking | Booking Confirm | Konfirmasi + pembayaran |
| E-Ticket | E-Ticket | Tiket digital dengan QR code |
| Kargo | Cargo | Tracking pengiriman barang |

### API Khusus Mobile

Endpoint mobile di `/api/app/`:
- `POST /api/app/auth/login` — Login pelanggan
- `GET /api/app/trips` — Cari trip tersedia
- `POST /api/app/bookings` — Buat booking

---

## 16. Optimasi Performa

### Database Index (33+)

| Index | Tabel | Fungsi |
|-------|-------|--------|
| `idx_trips_service_date` | trips | Query trip per tanggal |
| `idx_seat_inv_trip_seat` | seat_inventory | Lookup seatmap |
| `idx_bookings_pending_expiry` | bookings | Cleanup expired pending (partial) |
| `trip_stop_times(trip_id, stop_id)` | trip_stop_times | CSO trip queries |
| `bookings(trip_id, status)` | bookings | Available seat counts |
| `seat_inventory(trip_id, leg_index)` | seat_inventory | Seatmap leg lookups |

### Perbaikan N+1 Query

| Query | Sebelum | Sesudah |
|-------|---------|---------|
| getSeatmap | 1 query per booking untuk passengers | Batch via `getPassengersByBookingIds()` |
| getSeatPassengerDetails | 4 sequential queries | `Promise.all` + Maps |
| getVirtualTripsForCso | 1 query per pattern | Batch semua patterns sekaligus |
| cleanupExpiredHolds | Loop per hold | Bulk UPDATE + DELETE |

### Paralelisasi Query

- `getSeatmap`: layout + inventory + bookings + stopTimes via `Promise.all`
- `getCsoAvailableTrips`: real trips + virtual trips via `Promise.all`
- `precomputeInventory`: layout + legs + bookings via `Promise.all`

### Query Optimization

- `getRealTripsForCso`: 4 correlated subqueries → 2 LATERAL JOINs

### Frontend

- React.lazy code splitting untuk semua halaman
- WebSocket menggantikan polling saat connected
- Seat grid di-memoize dengan `useMemo`
- Kalkulasi harga di-debounce 300ms

### Caching

- Master data: `Cache-Control: private, max-age=60, stale-while-revalidate=120`
- Pagination: backward-compatible (`?page=1&pageSize=50`)

---

## 17. Database & Skema

### Tabel Utama

#### Core Transit

| Tabel | Keterangan |
|-------|------------|
| `drivers` | Data driver (kode, nama, SIM, status) |
| `stops` | Lokasi pemberhentian |
| `outlets` | Loket penjualan, linked ke stop |
| `layouts` | Konfigurasi kursi kendaraan (JSON seat map) |
| `vehicles` | Data kendaraan, linked ke layout |
| `trip_patterns` | Template rute (urutan stop) |
| `pattern_stops` | Junction: pattern ↔ stop (sequence, boarding/alighting) |
| `trip_bases` | Template jadwal virtual (pattern + hari operasi) |
| `trips` | Instance trip aktual (tanggal, status, vehicle, driver) |
| `trip_stop_times` | Waktu tiba/berangkat per stop per trip |
| `trip_legs` | Segmen perjalanan antar stop |

#### Booking & Passengers

| Tabel | Keterangan |
|-------|------------|
| `bookings` | Record pemesanan (status, trip, stops, channel, total) |
| `passengers` | Data penumpang (ticket number, kursi, tarif) |
| `payments` | Transaksi pembayaran |
| `booking_history` | Audit trail perubahan booking |
| `seat_inventory` | Ketersediaan kursi per leg (pre-computed) |
| `seat_holds` | Hold sementara saat proses booking |
| `print_jobs` | Antrian cetak tiket/manifest |

#### Kargo

| Tabel | Keterangan |
|-------|------------|
| `cargo_types` | Jenis barang |
| `cargo_rates` | Tarif per jenis + rute |
| `cargo_shipments` | Record pengiriman (waybill, status, pengirim/penerima) |

#### SPJ & Finansial

| Tabel | Keterangan |
|-------|------------|
| `spj` | Header Surat Perintah Jalan |
| `spj_cost_lines` | Detail biaya trip (estimasi + aktual) |
| `trip_cost_templates` | Template biaya default |
| `trip_cost_items` | Item dalam template biaya |
| `price_rules` | Aturan harga tiket |

#### Marketing

| Tabel | Keterangan |
|-------|------------|
| `promotions` | Kampanye diskon |
| `vouchers` | Kode voucher individual |
| `app_users` | Pelanggan mobile (B2C) |
| `reviews` | Rating & komentar trip |

#### RBAC & Identity

| Tabel | Keterangan |
|-------|------------|
| `roles` | Definisi peran sistem |
| `feature_flags` | Definisi permission/fitur |
| `role_flags` | Mapping role ↔ flag |
| `staff_members` | Link user ↔ role ↔ outlet |

---

## 18. Data Integrity — Snapshot System

### Mengapa Perlu Snapshot?

Data master (nama halte, nama rute, plat kendaraan) bisa berubah kapan saja. Tanpa snapshot, laporan historis akan menampilkan data terbaru — bukan data pada saat transaksi terjadi. Ini menyebabkan inkonsistensi laporan.

### Snapshot Columns

**Tabel `trips`**:
| Kolom | Sumber | Kapan Diisi |
|-------|--------|-------------|
| `snap_route_name` | Trip pattern name | Saat trip dimaterialisasi |
| `snap_route_code` | Trip pattern code | Saat trip dimaterialisasi |
| `snap_driver_name` | Driver name | Saat driver di-assign |
| `snap_vehicle_plate` | Vehicle plate number | Saat vehicle di-assign |

**Tabel `bookings`**:
| Kolom | Sumber | Kapan Diisi |
|-------|--------|-------------|
| `snap_origin_stop_name` | Origin stop name | Saat booking dibuat |
| `snap_destination_stop_name` | Destination stop name | Saat booking dibuat |
| `snap_departure_hhmm` | Departure time (HH:MM) | Saat booking dibuat |
| `snap_outlet_name` | Outlet name | Saat booking dibuat |

### Pola Query

```sql
COALESCE(b.snap_origin_stop_name, s.name) AS origin_stop_name
```

- Pakai snapshot jika tersedia
- Fallback ke data master terkini (backward compatible untuk data lama)

### Impact Check

Sebelum mengubah data master, sistem dapat mengecek berapa banyak trip/booking yang terdampak:

- `GET /api/stops/:id/impact` — Jumlah trip dan booking aktif yang menggunakan stop ini
- `GET /api/trip-patterns/:id/impact` — Jumlah trip aktif yang menggunakan pattern ini

### Backfill

Untuk data existing yang belum punya snapshot, jalankan:
```bash
npx tsx server/scripts/backfill-snapshots.ts
```

---

## 19. Security

### Rate Limiting

`@fastify/rate-limit` dengan konfigurasi per-route:
- Login: 10 request/menit
- Register: 5 request/menit

### Input Validation

| Domain | Metode |
|--------|--------|
| Booking | Custom Zod schema + cross-field validation |
| Cargo | Drizzle-Zod insert schemas |
| SPJ cost-line | Zod schema (category, label, amount, notes) |
| Reports | `reportFiltersSchema` untuk query params |
| Trips | Zod schema untuk seatmap query coercion |

### Webhook Security

Payment webhook menggunakan HMAC-SHA256:
```
signature = HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, requestBody)
x-webhook-signature header = signature
```
Verifikasi menggunakan `crypto.timingSafeEqual` untuk mencegah timing attacks.

### Production Guards

- `DEV_BYPASS_AUTH` di-hardcode ke `!IS_PRODUCTION` — mustahil aktif di production
- `JWT_SECRET` wajib di production (fatal error jika kosong)
- Seed endpoints (`/api/seed`, `/api/seed/rbac`) diblokir total di production
- Response logging me-redact semua data sensitif (token, password, session)

---

## 20. Dashboard Ringkasan Harian (F01)

Halaman utama yang memberikan overview real-time operasional hari ini.

### Komponen

| Komponen | Fungsi |
|----------|--------|
| DashboardPage | Halaman `/dashboard` — landing page default |
| Summary Cards | 4 kartu utama: Pendapatan, Penumpang, Trip, Kargo |
| Alerts Section | "Perlu Perhatian" — trip tanpa driver, booking pending lama, SPJ belum settle |
| Trip Timeline | Mini timeline trip hari ini dengan status |
| Aktivitas Terkini | 10 transaksi terakhir (booking + kargo) |

### Endpoint

- `GET /api/dashboard/today` — Agregasi data hari ini (trip count, penumpang, pendapatan, kargo, alerts, load factor)

### Fitur

- Auto-refresh setiap 60 detik
- Responsive: 1 kolom mobile, 2-4 kolom desktop
- Data diambil dari tabel existing: trips, bookings, payments, cargo_shipments, spj

---

## 21. Notifikasi & Alert System (F02)

Sistem notifikasi internal (in-app) untuk staff.

### Database

Tabel `notifications`:
- `id`, `type`, `title`, `message`, `severity` (info/warning/critical)
- `target_user_id` (nullable = broadcast), `target_outlet_id`
- `is_read`, `read_at`
- `related_entity_type`, `related_entity_id`
- `created_at`, `expires_at`

### Endpoint

| Endpoint | Fungsi |
|----------|--------|
| `GET /api/notifications` | List notifikasi (paginasi, filter read/unread) |
| `PATCH /api/notifications/:id/read` | Tandai sudah dibaca |
| `PATCH /api/notifications/read-all` | Tandai semua sudah dibaca |
| `DELETE /api/notifications/:id` | Hapus notifikasi |

### Frontend

- Bell icon di header AppLayout dengan unread count badge
- Dropdown panel notifikasi (list, klik → navigate ke halaman terkait)
- Tombol "Tandai semua dibaca"

---

## 22. Rekonsiliasi Pembayaran & Tutup Kasir (F04)

Proses operasional harian di setiap outlet: CSO menghitung uang di akhir shift, sistem mencocokkan dengan transaksi tercatat, supervisor approve.

### Alur Kerja

```
Buka Sesi → Transaksi Berjalan → Lihat Summary Real-time → Tutup Sesi → Supervisor Approve
```

### Database

| Tabel | Keterangan |
|-------|------------|
| `cashier_sessions` | id, outlet_id, staff_id, opened_at, closed_at, opening_balance, status (open/closing/approved), approved_by |
| `cashier_settlements` | id, session_id, payment_method, system_amount, actual_amount, difference |

### Endpoint

| Endpoint | Fungsi |
|----------|--------|
| `GET /api/cashier/active` | Cek sesi kasir aktif untuk outlet |
| `GET /api/cashier/active/summary` | Ringkasan transaksi real-time per metode bayar + daftar transaksi (filter by outlet) |
| `POST /api/cashier/open` | Buka sesi kasir (set opening balance) |
| `POST /api/cashier/close` | Tutup kasir (system auto-calc + kasir input aktual per metode) |
| `PATCH /api/cashier/:id/approve` | Supervisor approve closing |
| `GET /api/cashier/history` | Riwayat sesi kasir per outlet |
| `GET /api/cashier/:id/detail` | Detail sesi: transaksi + settlement (filter by outlet) |

### Mekanisme Penting

- **Transaksi otomatis terhitung**: Sistem JOIN `payments` dengan `bookings` untuk filter by outlet dan rentang waktu sesi
- **Kolom `system_amount` dihitung otomatis** dari total pembayaran per metode bayar selama sesi aktif — tidak perlu input manual
- **Kasir hanya input `actual_amount`** (jumlah fisik yang dihitung manual), sistem hitung selisih
- **Auto-refresh** setiap 30 detik selama sesi aktif — transaksi baru langsung muncul
- **RBAC**: Dilindungi flag `page.cashier`

---

## 23. Refund Management (F05)

Alur pengelolaan pengembalian dana saat booking dibatalkan.

### Alur Kerja

```
CSO Ajukan Refund → Pending → Manager/Finance Approve → Proses (uang dikembalikan) → Selesai
                                         ↘ Reject
```

### Database

Tabel `refunds`:
- `id`, `booking_id`, `passenger_id` (nullable)
- `original_amount`, `refund_amount`, `admin_fee`
- `reason`, `refund_method` (cash/transfer)
- `status` (pending/approved/processed/rejected)
- `requested_by`, `approved_by`, `processed_by` + timestamps
- `bank_account`, `bank_name` (untuk transfer)
- `notes`

### Endpoint

| Endpoint | Fungsi |
|----------|--------|
| `POST /api/refunds` | Ajukan refund (dengan booking search untuk pilih penumpang) |
| `GET /api/refunds` | List refund (filter: status, tanggal) |
| `GET /api/refunds/:id` | Detail refund |
| `PATCH /api/refunds/:id/approve` | Approve refund (supervisor/finance) |
| `PATCH /api/refunds/:id/process` | Proses refund (tandai uang dikembalikan) |
| `PATCH /api/refunds/:id/reject` | Tolak refund |

### Frontend

- Halaman `/refunds` — daftar refund dengan filter status
- Dialog create: search booking → pilih penumpang → lihat detail fare → set admin fee
- Dialog detail: breakdown harga, action buttons (approve/reject/process)
- URL pre-fill: `/refunds?bookingId=X&bookingCode=Y`
- Permission: CSO bisa *create*; hanya manager/finance bisa approve/process/reject

---

## 24. Database Pelanggan / CRM Sederhana (F09)

Memanfaatkan data penumpang yang sudah terekam dari booking untuk layanan lebih baik.

### Database

Tabel `customer_profiles`:
- `id`, `full_name`, `phone` (unique index), `email`, `id_number`
- `total_trips`, `total_spent`
- `first_trip_date`, `last_trip_date`
- `preferred_seat`, `preferred_route`
- `tags` (vip, frequent, blacklist)
- `notes`, `created_at`, `updated_at`

### Endpoint

| Endpoint | Fungsi |
|----------|--------|
| `GET /api/customers` | List pelanggan (search by name/phone) |
| `GET /api/customers/:id` | Detail + riwayat booking |
| `POST /api/customers` | Tambah manual |
| `GET /api/customers/search?phone=08xx` | Quick search untuk auto-fill |

### Frontend

- Halaman `/customers` — daftar pelanggan dengan search
- Detail pelanggan: summary cards, riwayat booking, tag management
- Auto-create/update customer profile saat booking selesai (match by phone)

---

## 25. Fitur RBAC Tambahan — Cross-Outlet CSO (Phase 2)

### Flag `action.cso.cross_outlet`

| Role | Nilai Default | Perilaku |
|------|--------------|----------|
| owner, manager | `true` | Bisa pilih outlet mana saja di CSO |
| spv_cso, cso | `false` | Terkunci ke outlet yang di-assign |

- Saat flag aktif: semua outlet tampil di dropdown, outlet user di-select sebagai default
- Saat flag tidak aktif: outlet dropdown hidden, otomatis pakai outlet user

---

## 26. Dev Staff Seed (Development Only)

### Mekanisme

- `POST /api/seed/rbac` — seed user dev (`dev-user-001`) sebagai staff owner @ outlet Dipatiukur (DPU)
- Menggunakan `ON CONFLICT DO UPDATE` untuk idempotent
- Hanya aktif di non-production environment
- Tidak auto-run saat startup — harus dipanggil manual

---

## 27. TransityConsole Schedule Sync

### Konteks

TransityConsole adalah gateway/BFF terpusat yang dipakai mobile App, web booking, dan
mitra OTA pihak ketiga. Console butuh snapshot jadwal **terkini** dari semua operator
agar pencarian trip cepat tanpa harus selalu hit Terminal. Schedule sync menjamin
Console punya data trip yang sinkron dengan Terminal dalam window detik–menit.

### Mode Sinkronisasi

**1. Webhook event (real-time)** — di-trigger setiap kali jadwal berubah di Terminal:
- Buat trip base baru → `schedule.created`
- Edit jadwal / pattern / pricing → `schedule.updated`
- Hapus / cancel trip base → `schedule.deleted`

Payload di-sign HMAC-SHA256 dengan `CONSOLE_WEBHOOK_SECRET`, dikirim via header
`X-Webhook-Signature`. Console verifikasi signature sebelum apply update.

**2. Snapshot rutin (interval)** — setiap `CONSOLE_SNAPSHOT_INTERVAL_MS` (default 10
menit), scheduler push full snapshot trip untuk N hari ke depan
(`CONSOLE_SNAPSHOT_DAYS_AHEAD`, default 7) sebagai safety net jika ada webhook yang
hilang. Snapshot di-batch maks `CONSOLE_SNAPSHOT_MAX_TRIPS` per HTTP request untuk
hindari `413 Payload Too Large`.

**3. Manual trigger** — operator bisa klik tombol "Push snapshot now" di
`/admin/settings` atau Console hit endpoint `POST /api/admin/console/snapshot/push`.

### Auto-Recovery

Scheduler menyimpan status koneksi terakhir (`healthy` / `degraded` / `down`) dan
counter retry. Jika Console down lalu kembali healthy, scheduler **otomatis** men-trigger
full snapshot push tanpa intervensi operator. Detail:

- HTTP error / timeout → mark `degraded`, retry exponential backoff
- 3 kegagalan beruntun → mark `down`
- Health check berhasil setelah `down` → trigger recovery snapshot

### Past-Trip Filter

Snapshot otomatis men-skip trip yang berangkat lebih dari `SCHEDULE_SNAPSHOT_GRACE_MINUTES`
(default 60) menit yang lalu (relative ke `OPERATOR_TZ`). Tujuannya: tidak mengirim trip
yang sudah berlalu dan tidak bisa lagi dibooking — menghemat bandwidth & menghindari
Console menampilkan trip "kadaluarsa" di hasil pencarian.

### Snapshot Guard (Conditional Push)

Scheduler menghitung hash dari payload snapshot. Jika hash sama dengan push terakhir,
HTTP request di-skip — menghindari noise di Console. Hanya snapshot rutin yang
mendapat guard ini; webhook event dan manual push selalu dikirim.

### Status di UI

Halaman `/admin/settings` (tab "Integrations / Console") menampilkan:
- Status koneksi: `Healthy` (hijau) / `Degraded` (kuning) / `Down` (merah)
- Timestamp push terakhir + jumlah trip dikirim
- Tombol "Push snapshot now" untuk manual trigger
- Auto-refresh setiap 30 detik

### File Terkait
- `server/lib/consoleWebhook.ts` — HMAC sign + HTTP push
- `server/lib/scheduleSnapshot.ts` — generator payload snapshot + past-trip filter
- `server/scheduler.ts` — interval scheduler + auto-recovery
- `server/modules/admin/console.controller.ts` — endpoint manual push + status
- `client/src/pages/admin/SettingsPage.tsx` — UI status

### Env Vars Terkait
`CONSOLE_URL`, `CONSOLE_OPERATOR_SLUG`, `CONSOLE_WEBHOOK_SECRET`,
`CONSOLE_SNAPSHOT_INTERVAL_MS`, `CONSOLE_SNAPSHOT_DAYS_AHEAD`,
`CONSOLE_SNAPSHOT_MAX_TRIPS`, `SCHEDULE_SNAPSHOT_GRACE_MINUTES`, `OPERATOR_TZ`

> Bila `CONSOLE_URL` kosong, semua mode sync menjadi no-op (aman untuk dev environment).

---

## 28. Whitelabel Docker Deployment

### Konsep

Satu codebase, satu file `docker-compose.yml`, banyak operator. Container, volume, dan
subdomain di-parameterize via dua env vars utama:

| Variable | Contoh | Dipakai untuk |
|----------|--------|---------------|
| `OPERATOR_SLUG` | `nusa`, `buskita`, `armada` | `container_name`, label, subdomain Nginx |
| `HOST_PORT` | `5000`, `5010`, `5020` | Port host yang di-bind ke `127.0.0.1` |

### Stack per VPS

```
┌─────────────────────── 1 VPS ───────────────────────┐
│                                                      │
│  Nginx (host)                                        │
│   ├── nusa-terminal.transity.web.id → 127.0.0.1:5000 │
│   ├── buskita-terminal.transity...   → 127.0.0.1:5010│
│   └── armada-terminal.transity...    → 127.0.0.1:5020│
│                                                      │
│  Docker network: transity-terminals-net              │
│   ├── container: ${OPERATOR_SLUG}-terminal           │
│   └── container: ${OPERATOR_SLUG}-transityweb        │
└──────────────────────────────────────────────────────┘
```

### Script Deploy

`./deploy.sh` di root project melakukan:
1. Validasi `.env` — cek key wajib ada
2. `git pull` — yang men-trigger hook `scripts/post-merge.sh`
3. `scripts/post-merge.sh` — `npm install` + `npm run db:push` (auto-migrate schema)
4. `docker compose up -d --build --remove-orphans`
5. Prune image lebih dari 24 jam

### Multi-Operator di 1 VPS

Cukup duplikasi folder project, isi `.env` dengan `OPERATOR_SLUG` + `HOST_PORT` yang
berbeda, lalu jalankan `./deploy.sh` di masing-masing folder. Tidak perlu edit
`docker-compose.yml`.

### File Terkait
- `Dockerfile` — multi-stage build untuk main app
- `docker-compose.yml` — service definitions ter-parameter
- `deploy.sh` — script standar deploy
- `scripts/post-merge.sh` — git hook auto-install + auto-migrate
- `.env.example` — template lengkap dengan komentar berbahasa Indonesia
- `docs/DEPLOY_VPS_DOCKER.md` — panduan step-by-step (Nginx, SSL, multi-op)
