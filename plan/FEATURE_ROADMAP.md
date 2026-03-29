# TransityTerminal — Feature Roadmap

> Dokumen ini adalah breakdown lengkap dari 11 fitur baru yang direncanakan.
> Setiap fitur sudah dianalisis terhadap fitur existing untuk menghindari duplikasi.
> Terakhir diperbarui: 29 Maret 2026

---

## Daftar Fitur

| # | Fitur | Kategori | Prioritas | Estimasi |
|---|-------|----------|-----------|----------|
| F01 | Dashboard Ringkasan Harian | Operasional | Tinggi | Besar |
| F02 | Notifikasi & Alert System | Operasional | Tinggi | Besar |
| F03 | Cetak Tiket, Resi & Struk | Operasional | Tinggi | Sedang |
| F04 | Rekonsiliasi Pembayaran & Tutup Kasir | Keuangan | Tinggi | Besar |
| F05 | Refund Management | Keuangan | Tinggi | Sedang |
| F06 | Export Laporan (Excel/PDF) | Laporan | Sedang | Sedang |
| F07 | Maintenance & Kondisi Kendaraan | Fleet | Sedang | Sedang |
| F08 | Tracking & Performa Driver | Fleet | Sedang | Sedang |
| F09 | Database Pelanggan (CRM Sederhana) | Customer | Sedang | Sedang |
| F10 | Integrasi Channel & Kuota Kursi | Channel | Rendah | Besar |
| F11 | Penjadwalan Lanjutan | Operasional | Sedang | Sedang |

---

## Analisis Duplikasi

Sebelum breakdown, berikut hasil analisis terhadap fitur existing untuk memastikan tidak ada duplikasi:

### Sudah Ada (TIDAK perlu dibuat ulang)
- **Cetak E-Tiket**: `PrintPreview.tsx` — sudah bisa cetak tiket booking status paid
- **Cetak Resi Kargo**: `CargoWaybillPreview.tsx` — sudah bisa cetak waybill kargo
- **Cetak Manifest**: `ManifestDialog.tsx` + `ThermalManifest` — sudah bisa cetak manifest thermal
- **Laporan Pembayaran dasar**: `PaymentsReportPage.tsx` — sudah ada breakdown per metode/outlet
- **Schedule Exception**: Scheduler sudah support buka/tutup trip dan stop per tanggal
- **Driver Assignment per trip**: Sudah ada di SchedulePage dan SchedulerPage
- **SPJ Settlement**: Sudah ada flow Draft → Issued → Settled dengan biaya perjalanan

### Konsolidasi yang Dilakukan
- **F03 (Cetak)** difokuskan hanya pada hal yang BELUM ada: cetak struk pembayaran dan batch print
- **F04 (Rekonsiliasi)** TIDAK duplikasi PaymentsReportPage — report menampilkan data historis, rekonsiliasi adalah proses operasional kasir harian
- **F08 (Driver)** TIDAK duplikasi SPJ — SPJ tracking biaya trip, F08 tracking performa dan jam kerja driver lintas trip

---

## F01: Dashboard Ringkasan Harian

### Deskripsi
Halaman utama yang memberikan overview real-time operasional hari ini. Operator buka aplikasi pagi hari dan langsung tahu kondisi bisnis tanpa harus buka halaman satu per satu.

### Status Sekarang
- Tidak ada halaman dashboard. Landing page langsung ke CSO Reservasi.
- Data yang dibutuhkan sudah tersedia dari API existing (trips, bookings, cargo, SPJ).

### Yang Harus Dibuat

#### Backend
- [ ] `GET /api/dashboard/today` — Endpoint agregasi data hari ini:
  - Total trip hari ini (scheduled, departed, completed)
  - Total penumpang (booked, checked-in, canceled)
  - Total pendapatan hari ini (dari payments)
  - Total kargo hari ini (shipments count, total weight, revenue)
  - Trip tanpa driver/kendaraan (alert)
  - Booking pending > 30 menit (alert)
  - SPJ belum di-settle > 3 hari (alert)
  - Load factor rata-rata hari ini

#### Frontend
- [ ] Halaman `/dashboard` dengan route dan sidebar entry
- [ ] Summary Cards (4 kartu utama): Pendapatan, Penumpang, Trip, Kargo
- [ ] Section "Perlu Perhatian" (alert cards):
  - Trip tanpa driver
  - Booking pending lama
  - SPJ belum settle
- [ ] Section "Trip Hari Ini" — mini timeline trip dengan status
- [ ] Section "Aktivitas Terkini" — 10 transaksi terakhir (booking + kargo)
- [ ] Auto-refresh setiap 60 detik atau manual refresh button
- [ ] Responsive: card grid 1 kolom mobile, 2-4 kolom desktop

#### Dependensi
- Tidak ada dependensi ke fitur lain
- Data bisa diambil dari tabel existing: trips, bookings, payments, cargo_shipments, spj

---

## F02: Notifikasi & Alert System

### Deskripsi
Sistem notifikasi internal (in-app) yang memberi tahu staff tentang event penting secara real-time tanpa harus manual cek.

### Status Sekarang
- Tidak ada sistem notifikasi sama sekali
- Socket.io sudah terpasang (digunakan untuk seat update real-time di CSO)

### Yang Harus Dibuat

#### Database
- [ ] Tabel `notifications`:
  - id, type (booking_pending, trip_no_driver, spj_overdue, capacity_alert, dll)
  - title, message, severity (info, warning, critical)
  - target_user_id (nullable = broadcast), target_outlet_id
  - is_read, read_at
  - related_entity_type (booking, trip, spj, cargo), related_entity_id
  - created_at, expires_at

#### Backend
- [ ] `GET /api/notifications` — List notifikasi user (paginasi, filter read/unread)
- [ ] `PATCH /api/notifications/:id/read` — Tandai sudah dibaca
- [ ] `PATCH /api/notifications/read-all` — Tandai semua sudah dibaca
- [ ] `DELETE /api/notifications/:id` — Hapus notifikasi
- [ ] Service `NotificationService`:
  - `create(type, title, message, target)` — buat notifikasi + emit via Socket.io
  - Trigger otomatis dari:
    - Booking created tanpa bayar > 30 menit → alert ke CSO outlet
    - Trip H-1 tanpa driver/kendaraan → alert ke admin
    - SPJ belum settle > 3 hari → alert ke admin
    - Load factor trip > 85% → info ke CSO outlet
    - Kargo status berubah → info ke outlet pengirim

#### Frontend
- [ ] Bell icon di header AppLayout dengan unread count badge
- [ ] Dropdown panel notifikasi (klik bell):
  - List notifikasi dengan icon severity
  - Klik notifikasi → navigate ke halaman terkait
  - Tombol "Tandai semua dibaca"
- [ ] Socket.io listener untuk real-time notification push
- [ ] Toast popup untuk notifikasi critical

#### Dependensi
- Socket.io sudah terpasang, bisa langsung digunakan
- Trigger dari modul booking, trip, SPJ, cargo

---

## F03: Cetak Tiket, Resi & Struk (Enhancement)

### Deskripsi
Melengkapi fitur cetak yang BELUM ada. Cetak tiket dan resi kargo sudah ada, yang kurang: cetak struk pembayaran dan kemampuan batch print.

### Status Sekarang (Sudah Ada)
- ✅ Cetak E-Tiket (PrintPreview.tsx) — untuk booking paid
- ✅ Cetak Resi Kargo (CargoWaybillPreview.tsx) — waybill setelah buat kargo
- ✅ Cetak Manifest (ThermalManifest) — manifest thermal 80mm

### Yang BELUM Ada & Harus Dibuat

#### Frontend
- [ ] **Cetak Struk Pembayaran** — komponen `PaymentReceiptPreview.tsx`:
  - Format thermal 80mm
  - Info: outlet, tanggal, kode booking, detail penumpang/kargo
  - Rincian pembayaran: subtotal, diskon, total, metode bayar
  - Auto-trigger setelah pembayaran sukses (opsional, toggle di setting)
- [ ] **Batch Print dari All Bookings**:
  - Checkbox multi-select di tabel All Bookings
  - Tombol "Cetak Tiket Terpilih" — print semua tiket sekaligus
- [ ] **Batch Print dari Manifest**:
  - Tombol "Cetak Semua Tiket Trip" di ManifestDialog
  - Generate semua tiket penumpang dalam 1 trip sekaligus
- [ ] **Reprint dari Detail Booking**:
  - Tombol "Cetak Ulang Tiket" dan "Cetak Ulang Struk" di BookingDetailModal

#### Backend
- [ ] `GET /api/bookings/:id/receipt` — Data struk pembayaran (booking + payments + outlet info)

#### Dependensi
- Komponen PrintPreview.tsx dan CargoWaybillPreview.tsx sudah ada sebagai referensi style

---

## F04: Rekonsiliasi Pembayaran & Tutup Kasir

### Deskripsi
Proses operasional harian di setiap outlet: CSO menghitung uang di akhir shift, sistem mencocokkan dengan transaksi tercatat, supervisor approve. BERBEDA dari PaymentsReportPage yang hanya menampilkan data historis.

### Status Sekarang
- PaymentsReportPage ada tapi hanya reporting, bukan proses operasional
- Tidak ada flow kasir / shift closing
- Tidak ada tracking piutang (booking belum lunas)

### Yang Harus Dibuat

#### Database
- [ ] Tabel `cashier_sessions`:
  - id, outlet_id, staff_id (kasir)
  - opened_at, closed_at
  - opening_balance (saldo awal kas)
  - status (open, closing, closed, approved)
  - approved_by, approved_at
  - notes
- [ ] Tabel `cashier_settlements`:
  - id, session_id
  - payment_method (cash, transfer, qris, dll)
  - system_amount (total dari sistem)
  - actual_amount (jumlah fisik yang dihitung kasir)
  - difference (selisih)
  - notes

#### Backend
- [ ] `POST /api/cashier/open` — Buka sesi kasir (set opening balance)
- [ ] `GET /api/cashier/active` — Cek sesi kasir aktif untuk outlet
- [ ] `POST /api/cashier/close` — Tutup kasir:
  - Hitung otomatis semua transaksi dalam sesi
  - Kasir input jumlah fisik per metode bayar
  - Hitung selisih
- [ ] `PATCH /api/cashier/:id/approve` — Supervisor approve closing
- [ ] `GET /api/cashier/history` — Riwayat sesi kasir per outlet
- [ ] `GET /api/cashier/:id/detail` — Detail sesi: semua transaksi + settlement

#### Frontend
- [ ] Halaman `/cashier` — Kasir Management
- [ ] Flow buka kasir: input saldo awal → mulai sesi
- [ ] Indicator "Kasir Aktif" di header/toolbar saat ada sesi terbuka
- [ ] Flow tutup kasir:
  - Summary otomatis: total cash, transfer, QRIS dari sistem
  - Input field untuk jumlah fisik per metode
  - Tampilkan selisih (hijau jika cocok, merah jika selisih)
  - Tombol submit → status closing
- [ ] Supervisor approval flow
- [ ] Riwayat tutup kasir dengan filter tanggal dan outlet
- [ ] Sidebar entry di bawah "Operasional"

#### Dependensi
- Tabel payments sudah ada dan sudah tracking metode bayar
- Perlu link session kasir ke setiap payment yang dibuat saat sesi aktif

---

## F05: Refund Management

### Deskripsi
Alur pengelolaan pengembalian dana saat booking dibatalkan. Saat ini pembatalan hanya mengubah status, belum ada tracking apakah uang sudah dikembalikan.

### Status Sekarang
- Pembatalan penumpang sudah ada (unseat, cancel) dengan reason
- Booking history tracking perubahan status
- TIDAK ada tracking refund (apakah uang dikembalikan, berapa, kapan)

### Yang Harus Dibuat

#### Database
- [ ] Tabel `refunds`:
  - id, booking_id, passenger_id (nullable)
  - original_amount, refund_amount, admin_fee
  - reason, refund_method (cash, transfer)
  - status (pending, approved, processed, rejected)
  - requested_by, requested_at
  - approved_by, approved_at
  - processed_by, processed_at
  - bank_account, bank_name (untuk transfer)
  - notes

#### Backend
- [ ] `POST /api/refunds` — Ajukan refund (otomatis saat cancel, atau manual)
- [ ] `GET /api/refunds` — List refund (filter: status, outlet, tanggal)
- [ ] `GET /api/refunds/:id` — Detail refund
- [ ] `PATCH /api/refunds/:id/approve` — Approve refund (supervisor)
- [ ] `PATCH /api/refunds/:id/process` — Proses refund (tandai uang sudah dikembalikan)
- [ ] `PATCH /api/refunds/:id/reject` — Tolak refund
- [ ] Konfigurasi: persentase potongan admin default (misal 10%)

#### Frontend
- [ ] Halaman `/refunds` — Daftar Refund
  - Filter: status (pending/approved/processed/rejected), tanggal, outlet
  - Tabel: kode booking, penumpang, jumlah asli, jumlah refund, status, tanggal
- [ ] Dialog detail refund:
  - Info booking dan penumpang
  - Breakdown: harga asli, potongan admin, jumlah refund
  - Action buttons: Approve / Reject / Process
  - Form input rekening bank (untuk refund transfer)
- [ ] Integrasi di CancellationsReportPage:
  - Kolom tambahan "Status Refund" di tabel pembatalan
- [ ] Integrasi di BookingDetailModal:
  - Tombol "Ajukan Refund" saat status canceled
  - Status refund ditampilkan jika ada
- [ ] Sidebar entry di bawah "Operasional" atau "Keuangan"

#### Dependensi
- Tabel bookings, passengers, payments sudah ada
- Perlu hook ke flow cancel passenger yang existing

---

## F06: Export Laporan (Excel/PDF)

### Deskripsi
Tambahkan kemampuan export data dari SEMUA halaman laporan ke format Excel (.xlsx) dan PDF.

### Status Sekarang
- 8 halaman laporan sudah ada dengan data lengkap
- TIDAK ada satupun yang punya tombol export
- Komponen ReportPageLayout sudah jadi wrapper standard semua report

### Yang Harus Dibuat

#### Backend
- [ ] Utility `ExportService`:
  - `generateExcel(title, headers, rows)` → buffer .xlsx
  - `generatePdf(title, headers, rows, summary)` → buffer .pdf
- [ ] Endpoint generic: `POST /api/reports/:reportType/export`
  - Body: { format: 'xlsx' | 'pdf', filters: {...} }
  - Reuse query logic yang sudah ada di setiap report route
  - Return file download

#### Frontend
- [ ] Komponen `ExportButtons` — tombol "Export Excel" dan "Export PDF"
- [ ] Integrasi ke `ReportPageLayout` sebagai prop `exportConfig`:
  - reportType, current filters
  - Otomatis muncul di semua 8 halaman laporan tanpa edit satu per satu
- [ ] Loading state saat generate file
- [ ] Auto-download file setelah generate

#### Halaman yang ter-cover (8 halaman, 1 implementasi):
- [ ] Laporan Pendapatan
- [ ] Laporan Penjualan
- [ ] Laba Rugi Trip
- [ ] Load Factor
- [ ] Laporan Pembatalan
- [ ] Laporan Kargo
- [ ] Laporan Pembayaran
- [ ] Commercial Fee

#### Dependensi
- Install library: `exceljs` (Excel) + `pdfkit` atau `jspdf` (PDF)
- Query logic backend sudah ada, tinggal reuse

---

## F07: Maintenance & Kondisi Kendaraan

### Deskripsi
Tracking jadwal perawatan, riwayat perbaikan, dan status kesiapan setiap kendaraan.

### Status Sekarang
- Tabel vehicles ada (plate, code, capacity, layout, status active/inactive)
- TIDAK ada tracking maintenance, KM, atau jadwal service

### Yang Harus Dibuat

#### Database
- [ ] Tabel `vehicle_maintenance`:
  - id, vehicle_id
  - type (routine_service, repair, inspection, tire_change, oil_change)
  - description
  - scheduled_date, completed_date
  - odometer_km (KM saat maintenance)
  - cost, vendor_name
  - status (scheduled, in_progress, completed, overdue)
  - next_service_km, next_service_date
  - created_by, notes

#### Backend
- [ ] CRUD `/api/vehicles/:id/maintenance` — List, create, update, delete maintenance
- [ ] `GET /api/vehicles/maintenance/alerts` — Kendaraan yang overdue atau mendekati jadwal service
- [ ] Update status kendaraan otomatis: jika ada maintenance in_progress → vehicle status = maintenance

#### Frontend
- [ ] Tab baru "Maintenance" di Master Data → Kendaraan, atau halaman terpisah
- [ ] Per kendaraan: riwayat maintenance (timeline), jadwal upcoming
- [ ] Form tambah maintenance: jenis, tanggal, KM, biaya, vendor
- [ ] Alert badge di vehicle list: "Service Overdue" (merah), "Service Segera" (kuning)
- [ ] Integrasi di Dashboard (F01): kendaraan yang perlu maintenance

#### Dependensi
- Tabel vehicles sudah ada
- Bisa berdiri sendiri tanpa fitur lain

---

## F08: Tracking & Performa Driver

### Deskripsi
Melihat riwayat perjalanan, akumulasi jam kerja, dan performa setiap driver. BERBEDA dari SPJ yang tracking biaya per trip — ini tracking driver lintas semua trip.

### Status Sekarang
- Tabel drivers ada (name, phone, license, status)
- SPJ sudah tracking trip per driver tapi dari sisi biaya
- TIDAK ada aggregasi performa driver

### Yang Harus Dibuat

#### Backend
- [ ] `GET /api/drivers/:id/performance` — Agregasi performa:
  - Total trip dalam periode
  - Total jam kerja (dari departure - arrival trip)
  - Total KM (jika odometer ditracking di F07)
  - Total pendapatan trip yang di-handle
  - Rata-rata load factor trip yang di-handle
  - Jumlah complain/insiden (future)
- [ ] `GET /api/drivers/:id/trip-history` — List trip yang pernah di-handle (paginasi)
- [ ] `GET /api/drivers/leaderboard` — Ranking driver berdasarkan jumlah trip/load factor

#### Frontend
- [ ] Tab baru "Performa" di Master Data → Driver
- [ ] Per driver: summary cards (total trip, jam kerja, rata-rata load factor)
- [ ] Tabel riwayat trip: tanggal, rute, kendaraan, penumpang, pendapatan
- [ ] Grafik trend trip per bulan (simple bar chart)
- [ ] Filter periode (7 hari, 30 hari, custom)

#### Dependensi
- Data sudah ada dari tabel trips (driver_id) dan SPJ
- Hanya perlu query agregasi, tidak perlu tabel baru

---

## F09: Database Pelanggan (CRM Sederhana)

### Deskripsi
Memanfaatkan data pelanggan yang sudah terekam dari booking untuk memberikan layanan lebih baik: quick-book, riwayat perjalanan, identifikasi pelanggan frequent.

### Status Sekarang
- Tabel `app_users` ada tapi belum terintegrasi ke CSO
- Data penumpang (passengers) punya nama, telepon, email tapi tidak di-aggregate per pelanggan
- Setiap booking baru, CSO harus isi ulang data penumpang dari awal

### Yang Harus Dibuat

#### Database
- [ ] Tabel `customer_profiles` (atau enhance app_users):
  - id, full_name, phone, email, id_number
  - total_trips, total_spent
  - first_trip_date, last_trip_date
  - preferred_seat, preferred_route
  - tags (vip, frequent, blacklist)
  - notes, created_at, updated_at
- [ ] Index unique di phone untuk cepat lookup

#### Backend
- [ ] `GET /api/customers` — List pelanggan (search by name/phone)
- [ ] `GET /api/customers/:id` — Detail + riwayat booking
- [ ] `POST /api/customers` — Tambah manual
- [ ] Auto-create/update customer profile saat booking selesai:
  - Match by phone number
  - Update total_trips, total_spent, last_trip_date
- [ ] `GET /api/customers/search?phone=08xx` — Quick search untuk auto-fill di CSO

#### Frontend
- [ ] Halaman `/customers` — Daftar Pelanggan
  - Search by nama/telepon
  - Tabel: nama, telepon, total trip, total spending, terakhir perjalanan
  - Sort by frequent (total trip) atau spending
- [ ] Detail pelanggan:
  - Summary cards: total trip, total spending, sejak kapan
  - Riwayat booking (list)
  - Tag management (VIP, frequent)
- [ ] Integrasi CSO — Auto-fill di PassengerForm:
  - Saat CSO ketik nomor telepon penumpang, suggest data pelanggan
  - Klik suggestion → auto-fill nama, email, ID
  - Hemat waktu CSO dan kurangi typo
- [ ] Sidebar entry di bawah "Operasional"

#### Dependensi
- Data passengers dari bookings sudah ada
- Bisa di-seed dari data existing saat pertama kali deploy

---

## F10: Integrasi Channel & Kuota Kursi

### Deskripsi
Manajemen distribusi kursi antar channel penjualan (CSO, Web, App, OTA) dan API gateway untuk partner.

### Status Sekarang
- Channel sudah ada di booking (CSO, WEB, APP, OTA)
- Tidak ada pembatasan kuota per channel
- Tidak ada API khusus untuk partner/OTA

### Yang Harus Dibuat

#### Database
- [ ] Tabel `channel_quotas`:
  - id, trip_base_id (atau pattern_id)
  - channel, quota_type (fixed_count, percentage)
  - quota_value (misal: 10 kursi atau 20%)
  - is_active
- [ ] Tabel `api_keys`:
  - id, partner_name, api_key (hashed), channel
  - rate_limit, is_active
  - created_at, expires_at

#### Backend
- [ ] CRUD `/api/channel-quotas` — Kelola kuota per channel per trip
- [ ] Validasi saat booking: cek kuota tersisa untuk channel tersebut
- [ ] API Partner Gateway:
  - `GET /api/partner/trips` — List trip available
  - `GET /api/partner/trips/:id/seats` — Ketersediaan kursi
  - `POST /api/partner/bookings` — Buat booking dari partner
  - `GET /api/partner/bookings/:code` — Cek status booking
  - Autentikasi via API key header
- [ ] Webhook system:
  - `POST /api/webhooks/register` — Partner daftar webhook URL
  - Emit event saat: booking confirmed, canceled, rescheduled
- [ ] Rate limiting per API key

#### Frontend
- [ ] Tab "Channel & Kuota" di Master Data atau halaman terpisah
- [ ] Per trip pattern: setting kuota per channel
- [ ] Visualisasi: bar chart ketersediaan per channel
- [ ] Halaman "API Partners": list partner, generate API key, monitor usage
- [ ] Laporan booking per channel dengan kuota tracking

#### Dependensi
- Fitur ini paling kompleks dan bisa ditunda
- Channel field di bookings sudah ada

---

## F11: Penjadwalan Lanjutan

### Deskripsi
Fitur tambahan untuk mempercepat proses penjadwalan yang saat ini masih manual satu per satu.

### Status Sekarang
- ✅ Scheduler calendar view (grid bulanan) sudah ada
- ✅ Exception management (tutup trip/stop per tanggal) sudah ada
- ✅ Trip materialization (virtual → active) sudah ada
- ❌ Copy jadwal antar minggu BELUM ada
- ❌ Bulk assign driver/kendaraan BELUM ada
- ❌ Template jadwal musiman BELUM ada

### Yang Harus Dibuat

#### Backend
- [ ] `POST /api/scheduler/bulk-assign` — Assign driver + kendaraan ke banyak trip sekaligus:
  - Body: { assignments: [{ tripId, driverId, vehicleId }] }
  - Validasi: driver dan kendaraan tidak bentrok jadwal
- [ ] `POST /api/scheduler/copy-week` — Copy jadwal dari minggu sumber ke minggu target:
  - Body: { sourceWeekStart, targetWeekStart, includeAssignments: boolean }
  - Logika: ambil semua trip di minggu sumber, buat trip baru di tanggal yang sama di minggu target
  - Skip jika sudah ada trip di tanggal target
- [ ] `POST /api/scheduler/templates` — Simpan konfigurasi jadwal sebagai template:
  - Nama template (misal: "Jadwal Lebaran 2026", "Jadwal Normal")
  - List trip bases yang aktif, exception rules
- [ ] `POST /api/scheduler/templates/:id/apply` — Terapkan template ke range tanggal

#### Frontend
- [ ] Toolbar di SchedulerPage:
  - Tombol "Copy Minggu" → modal pilih minggu sumber & target
  - Tombol "Bulk Assign" → modal multi-select trip + pilih driver/kendaraan
- [ ] Fitur drag-select di calendar grid untuk select multiple trips
- [ ] Dialog "Simpan Template" dan "Terapkan Template"
- [ ] Konfirmasi preview sebelum apply: "Akan membuat X trip baru di tanggal Y-Z"
- [ ] Validasi visual: highlight konflik (driver/kendaraan sudah dijadwalkan)

#### Dependensi
- Scheduler dan calendar view sudah ada
- Bisa langsung extend SchedulerPage yang existing

---

## Urutan Implementasi yang Disarankan

### Fase 1 — Fondasi Operasional (Paling Berdampak)
1. **F01** Dashboard Harian — overview cepat untuk semua operator
2. **F03** Cetak Struk Pembayaran — melengkapi flow transaksi yang sudah ada
3. **F06** Export Laporan — pemilik usaha butuh data untuk keputusan

### Fase 2 — Keuangan & Kontrol
4. **F04** Rekonsiliasi & Tutup Kasir — kontrol keuangan outlet
5. **F05** Refund Management — handle pembatalan profesional

### Fase 3 — Optimasi Operasional
6. **F11** Penjadwalan Lanjutan — hemat waktu admin harian
7. **F02** Notifikasi & Alert — proaktif vs reaktif

### Fase 4 — Growth & Performa
8. **F09** Database Pelanggan — repeat customer dan quick-book
9. **F08** Tracking Driver — evaluasi performa
10. **F07** Maintenance Kendaraan — keamanan dan compliance

### Fase 5 — Skalabilitas
11. **F10** Integrasi Channel & Kuota — ekspansi penjualan

---

## Catatan Arsitektur

### Prinsip Anti-Duplikasi
- Setiap fitur baru harus EXTEND modul existing, bukan buat modul paralel
- F04 (Kasir) link ke tabel payments yang sudah ada, bukan buat payment system baru
- F05 (Refund) hook ke flow cancel yang sudah ada, bukan buat cancel flow baru
- F08 (Driver) query dari trips + SPJ yang sudah ada, bukan tracking terpisah
- F06 (Export) reuse query backend report yang sudah ada, hanya tambah formatter

### Shared Components yang Akan Dibuat
- `ExportButtons` — reusable di semua 8 halaman laporan
- `NotificationBell` — 1 komponen di AppLayout, reusable untuk semua notifikasi
- `CustomerAutocomplete` — reusable di CSO PassengerForm dan CargoForm
- `PrintReceiptPreview` — 1 komponen cetak struk, reusable di booking dan kargo
