# Plan: Manifest, SPJ & Biaya Perjalanan
**Tanggal:** 2026-03-19  
**Status:** APPROVED — Siap Eksekusi  
**Scope:** Tiga modul baru + roadmap role management

---

## Konteks Sistem

Sistem sudah memiliki:
- `trips` — data perjalanan yang sudah terealisasi
- `bookings` + `passengers` — data penumpang per trip
- `cargo_shipments` — data kargo per trip
- `drivers` + `vehicles` — data armada
- `trip_patterns` — template rute (digunakan sebagai basis master biaya)

Tiga modul baru ini dibangun di atas data yang sudah ada, tanpa mengubah struktur booking/trip yang existing.

---

## Urutan Pembangunan

```
[ Fase 1 ] Master Biaya Perjalanan
      ↓
[ Fase 2 ] Manifest Perjalanan
      ↓
[ Fase 3 ] SPJ & Settlement Biaya
```

Urutan ini mengikuti dependensi: SPJ membutuhkan Master Biaya, Manifest menjadi lampiran SPJ.

---

## Fase 1 — Master Biaya Perjalanan

### Tujuan
Menyediakan template komponen biaya per rute sehingga SPJ bisa auto-fill estimasi biaya saat dibuat.

### Schema Baru

**Tabel `trip_cost_templates`**
```
id              uuid PK
pattern_id      → trip_patterns.id  (rute yang direferensikan)
name            varchar             (nama template, misal "Std Jakarta-Bandung")
is_active       boolean default true
created_at      timestamp
```

**Tabel `trip_cost_items`**
```
id              uuid PK
template_id     → trip_cost_templates.id
category        enum: 'bbm' | 'tol' | 'makan' | 'parkir' | 'lainnya'
label           varchar             (nama bebas, misal "Makan Siang Driver")
amount          numeric(12,2)       (estimasi nominal)
is_advance      boolean             (true = bagian uang muka, false = reimbursable)
notes           text nullable
```

### API Routes
```
GET    /api/cost-templates              — list semua template
POST   /api/cost-templates              — buat template baru
GET    /api/cost-templates/:id          — detail template + items
PUT    /api/cost-templates/:id          — update template
DELETE /api/cost-templates/:id          — hapus template

GET    /api/cost-templates/:id/items    — list item biaya
POST   /api/cost-templates/:id/items    — tambah item
PUT    /api/cost-items/:id              — update item
DELETE /api/cost-items/:id              — hapus item
```

### UI
- Halaman Masters → tab baru **"Biaya Perjalanan"**
- List template per rute (trip_pattern)
- Form tambah/edit template
- Sub-tabel item biaya per template (inline editable)
- Toggle `is_advance` untuk menandai mana yang uang muka vs reimbursable

---

## Fase 2 — Manifest Perjalanan

### Tujuan
Dokumen resmi daftar penumpang dan kargo per trip. Auto-generated dari data yang sudah ada.

### Tidak Ada Tabel Baru
Manifest bukan entitas yang disimpan — ia di-generate on-demand dari data existing:
- Penumpang: query `passengers` JOIN `bookings` WHERE `trip_id`
- Kargo: query `cargo_shipments` WHERE `trip_id`
- Header: dari `trips` JOIN `vehicles` JOIN `drivers` (via SPJ)

### API Routes
```
GET  /api/trips/:tripId/manifest        — generate manifest JSON
GET  /api/trips/:tripId/manifest/pdf    — export manifest sebagai PDF
```

### Konten Manifest
**Header:**
- Nomor Manifest (auto: MNF-{tripId}-{date})
- Nama perusahaan / outlet keberangkatan
- Rute (asal → tujuan)
- Tanggal & jam keberangkatan
- Kendaraan (plat nomor, tipe)
- Driver (nama, no. SIM)

**Bagian A — Daftar Penumpang:**

| No | Nama | No. Tiket | No. Kursi | Naik Di | Turun Di | No. HP |
|----|------|-----------|-----------|---------|----------|--------|

**Bagian B — Daftar Kargo:**

| No | No. Resi | Pengirim | Penerima | Berat | Keterangan |
|----|----------|----------|----------|-------|------------|

**Summary:**
- Total penumpang
- Total kargo (item & berat)
- Total pendapatan tiket
- Total pendapatan kargo

### UI — CSO/Admin
- Tombol **"Lihat Manifest"** di detail trip
- Tombol **"Cetak / Export PDF"**

### UI — Mobile App (Driver)
- Halaman `/manifest/:tripId` (read-only)
- Bisa diakses setelah driver di-assign ke trip via SPJ
- Menampilkan daftar penumpang per stop (grouped by naik di)

---

## Fase 3 — SPJ & Settlement Biaya

### Tujuan
Dokumen penugasan driver yang merangkum rencana biaya (uang muka) dan menjadi basis settlement setelah perjalanan.

### Schema Baru

**Tabel `spj` (Surat Perintah Jalan)**
```
id              uuid PK
spj_number      varchar UNIQUE       (auto: SPJ-{YYYYMM}-{seq})
trip_id         → trips.id           (one-to-one)
driver_id       → drivers.id
vehicle_id      → vehicles.id
issued_at       timestamp nullable
status          enum: 'draft' | 'issued' | 'on_trip' | 'settled'
notes           text nullable
created_at      timestamp
updated_at      timestamp
```

**Tabel `spj_cost_lines`** (rincian biaya per SPJ)
```
id              uuid PK
spj_id          → spj.id
category        enum: 'bbm' | 'tol' | 'makan' | 'parkir' | 'lainnya'
label           varchar
estimated_amount numeric(12,2)       (dari template, bisa di-override)
actual_amount    numeric(12,2) nullable (diisi saat/setelah perjalanan)
is_advance      boolean             (uang muka atau reimbursable)
receipt_url     text nullable       (foto struk/nota)
notes           text nullable
```

**Tabel `spj_reimbursement_claims`** (klaim biaya tak terduga)
```
id              uuid PK
spj_id          → spj.id
label           varchar             (deskripsi kejadian)
amount          numeric(12,2)
receipt_url     text nullable
status          enum: 'pending' | 'approved' | 'rejected'
created_at      timestamp
```

### Kalkulasi Otomatis (computed fields, tidak disimpan)
```
total_advance       = SUM(estimated_amount WHERE is_advance = true)
total_actual        = SUM(actual_amount WHERE NOT NULL)
total_reimbursement = SUM(reimbursement_claims WHERE status = 'approved')
selisih             = total_advance - total_actual
status_selisih      = 'LEBIH' | 'KURANG' | 'SAMA'
```

### Laporan Profit Per Trip (computed)
```
pendapatan_tiket    = SUM(bookings.total_amount WHERE trip_id)
pendapatan_kargo    = SUM(cargo_shipments.total_cost WHERE trip_id)
total_pendapatan    = pendapatan_tiket + pendapatan_kargo
total_biaya_spj     = total_actual + total_reimbursement
laba_bersih         = total_pendapatan - total_biaya_spj
```

### API Routes
```
GET    /api/spj                         — list semua SPJ
POST   /api/spj                         — buat SPJ baru (dari trip_id)
GET    /api/spj/:id                     — detail SPJ + lines + claims
PUT    /api/spj/:id                     — update SPJ (status, catatan)
POST   /api/spj/:id/issue               — ubah status → issued
POST   /api/spj/:id/settle              — ubah status → settled

PUT    /api/spj-cost-lines/:id          — update actual_amount / upload receipt
POST   /api/spj/:id/claims              — tambah reimbursement claim
PUT    /api/spj-claims/:id              — update status claim

GET    /api/trips/:tripId/profit        — kalkulasi profit per trip
```

### UI — SPJ
- Halaman baru **"SPJ"** di sidebar (di bawah Reservasi)
- List SPJ dengan filter status & tanggal
- Form buat SPJ: pilih trip → auto-assign driver & vehicle dari trip → auto-fill biaya dari template → admin bisa override
- Detail SPJ: 
  - Informasi trip, driver, kendaraan
  - Tabel biaya: estimasi vs realisasi
  - Daftar klaim reimbursement
  - Tombol "Issue SPJ" (print PDF penugasan driver)
  - Summary settlement setelah trip selesai
  - Tombol "Selesaikan SPJ" (settle)
- Lampiran Manifest bisa dibuka langsung dari halaman SPJ

### UI — Halaman Trip (Enhancement)
- Tambah tombol "Buat SPJ" di detail trip
- Tambah tombol "Lihat Manifest" di detail trip
- Tambah section "Profit Trip" di detail trip

---

## Roadmap — Fitur Lanjutan (Belum Dieksekusi)

### Role Management
**Prioritas: Tinggi — dikerjakan setelah Fase 1-3 selesai**

Tabel yang dibutuhkan:
- `users` — akun internal (beda dengan `app_users` yang untuk penumpang)
- `roles` — Admin, Manajer, Kasir, Driver
- `user_roles` — many-to-many

Permission matrix yang direncanakan:
| Fitur | Admin | Manajer | Kasir | Driver |
|-------|-------|---------|-------|--------|
| Master Data | CRUD | Read | Read | - |
| Booking/CSO | CRUD | Read | CRUD | - |
| SPJ — Buat | ✓ | - | - | - |
| SPJ — Approve | - | ✓ | - | - |
| SPJ — Lihat | ✓ | ✓ | - | ✓ (milik sendiri) |
| Manifest | ✓ | ✓ | ✓ | ✓ (assigned trip) |
| Settlement | ✓ | ✓ | ✓ | - |
| Laporan Profit | ✓ | ✓ | - | - |

### SPJ Approval Flow (Opsi B)
**Prioritas: Sedang — setelah Role Management selesai**

- Status tambahan: `draft` → `pending_approval` → `approved` / `rejected` → `issued`
- Manajer mendapat notifikasi saat ada SPJ menunggu approval
- Email/notifikasi ke admin jika SPJ disetujui atau ditolak

### Tanda Tangan Digital (Opsi C)
**Prioritas: Rendah**

- Driver tanda tangan digital di mobile app saat menerima SPJ
- Tersimpan sebagai image di SPJ record
- Digunakan sebagai bukti bahwa driver sudah menerima penugasan dan uang muka

### Upload & Manajemen Struk
**Prioritas: Sedang — bisa paralel dengan Fase 3**

- Integrasi storage (Replit Object Storage atau S3-compatible)
- Driver upload foto struk dari mobile app
- Admin verifikasi dari dashboard web
- Preview thumbnail struk di tabel biaya SPJ

---

## Definisi Selesai (Definition of Done)

### Fase 1 ✓ ketika:
- [x] Tabel `trip_cost_templates` dan `trip_cost_items` terbuat di DB
- [x] API CRUD semua endpoint berfungsi
- [x] UI Master Biaya bisa tambah/edit/hapus template dan item
- [x] Template bisa dilink ke trip_pattern

### Fase 2 ✓ ketika:
- [x] API `/manifest` mengembalikan data lengkap (penumpang + kargo)
- [x] Manifest bisa dibuka untuk semua trip berstatus 'scheduled' (meski belum ada leg)
- [x] Tombol "Cetak Manifest" mencatat waktu cetak pertama (`manifest_first_printed_at`) ke DB
- [x] Waktu cetak pertama ditampilkan di dialog manifest (badge hijau jika sudah, amber jika belum)
- [x] Format cetak thermal printer (80mm roll paper, monospace, plain text layout)
- [x] API `POST /api/trips/:id/manifest/print` — idempotent, hanya set waktu pertama sekali
- [ ] Halaman manifest tersedia di mobile app (driver) — ditunda, mobile adalah app end-user terpisah

### Fase 3 ✓ ketika:
- [ ] SPJ bisa dibuat dari trip, auto-fill dari template biaya
- [ ] Admin bisa override estimasi biaya per-line
- [ ] Actual cost bisa diinput (manual + upload struk placeholder)
- [ ] Klaim reimbursement bisa diajukan dan diupdate statusnya
- [ ] Settlement menghitung selisih uang muka vs realisasi
- [ ] Laporan profit per trip tampil di halaman trip
- [ ] SPJ bisa diexport sebagai PDF (format penugasan resmi)
