# TransityCore — Dokumentasi Fitur Lengkap

Dokumen ini menjelaskan seluruh fitur yang telah dibangun di sistem TransityCore, termasuk teknologi yang digunakan, cara kerja, dan logika perhitungan.

---

## Daftar Isi

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

### Logika Perhitungan Tarif Penumpang

Harga dihitung oleh `PricingService.quoteFare()`:

```
1. Cari price rule yang cocok (prioritas: trip-specific > pattern-specific)
2. Hitung berdasarkan mode:
   - per_leg: basePricePerLeg × jumlahLeg × multiplier
   - flat:    basePricePerLeg × multiplier (berapa pun jumlah leg)
3. Bulatkan ke integer terdekat
```

### Contoh Perhitungan

```
Price Rule: basePricePerLeg = Rp 50.000, mode = per_leg, multiplier = 1

Trip dari Stop A ke Stop C (2 legs):
  Tarif = 50.000 × 2 × 1 = Rp 100.000

Trip dari Stop A ke Stop B (1 leg):
  Tarif = 50.000 × 1 × 1 = Rp 50.000
```

### Struktur Price Rule

```json
{
  "pricingMode": "per_leg",
  "basePricePerLeg": 50000,
  "currency": "IDR",
  "multiplier": 1
}
```

### Validasi

- Trip TANPA price rule: disabled di CSO, tidak bisa dipilih, tampil badge "Belum Ada Harga"
- Jika tidak ada rule yang cocok, API mengembalikan error `NO_PRICE_RULE` (HTTP 422)

### File Terkait

| File | Fungsi |
|------|--------|
| `server/modules/pricing/pricing.service.ts` | Logika perhitungan harga |
| `server/modules/pricing/pricing.controller.ts` | API endpoint `/api/pricing/quote-fare` |
| `shared/schema.ts` (priceRules) | Definisi tabel aturan harga |

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
