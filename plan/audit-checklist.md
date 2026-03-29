# Audit Checklist — TransityTerminal

Sumber: `plan/audit-report.md` (Tanggal audit: 2026-03-21)
Terakhir diperbarui: 2026-03-29

Status:
- ✅ SELESAI — sudah diperbaiki
- ⏳ BELUM — belum dikerjakan
- ⚠️ TIDAK RELEVAN — sudah tidak berlaku atau sudah tertangani secara tidak langsung
- 🔄 SEBAGIAN — fix parsial, masih ada sisa

---

## 1. Bug & Potensi Bug — Backend

### KRITIS

| # | Masalah | Status | Catatan |
|---|---------|--------|---------|
| B1 | Booking tanpa transaksi DB — `createBooking` menulis ke 3 tabel tanpa `db.transaction()` | ✅ SELESAI | Sprint 1 C-02: `createBooking` & `createPendingBooking` sekarang pakai `tx.insert()` langsung dalam satu `db.transaction()` |
| B2 | In-memory holds vs DB — `HoldsService` simpan di `Map` in-memory DAN database | ✅ SELESAI | In-memory `Map` sudah dihapus. `HoldsService.createSeatHold()` sekarang 100% DB-based dengan `db.transaction()` + `SELECT` + `INSERT` + `UPDATE` dalam satu tx |
| B3 | Error di-swallow saat update inventory — catch block log error tapi tetap emit WS event | ✅ SELESAI | `createSeatHold` sekarang cek `result.ok` sebelum emit WS event (L132-134). Error case return `{ ok: false, reason: 'internal-error' }` tanpa emit |

### SEDANG

| # | Masalah | Status | Catatan |
|---|---------|--------|---------|
| B4 | Seat inventory release tanpa transaksi — `releasePendingBooking` dan `cleanupExpiredPendingBookings` tanpa tx | ✅ SELESAI | Sprint 1 H-02: Kedua method sekarang update `seatInventory` + `bookings.status` dalam satu `db.transaction()`. WS emit setelah commit |
| B5 | `req.query.tripId` tanpa guard — cast ke `string` tanpa cek undefined | ✅ SELESAI | `bookings.controller.ts` L90: sudah pakai `typeof req.query.tripId === 'string' ? req.query.tripId : undefined` |
| B6 | Waybill retry limit terlalu kecil — hardcoded 5 retry | ⚠️ TIDAK RELEVAN | Kode waybill generation saat ini (`cargo.service.ts`) menggunakan `generateWaybillNumber()` yang deterministik (timestamp-based), bukan random retry. Tidak ada retry loop |
| B7 | Float comparison untuk payment validation (`> 0.01`) | ⏳ BELUM | `bookings.service.ts` L177: masih pakai `Math.abs(paymentAmount - expectedTotal) > 0.01`. Untuk IDR bisa diperkecil atau dibulatkan dulu |
| B8 | WebSocket `initialize` bisa dipanggil multiple kali saat hot reload | ⏳ BELUM | Hanya terjadi di development (hot reload). Dampak minimal. Bisa ditambah guard `if (this.io) return` |

---

## 2. Bug & Potensi Bug — Frontend

### KRITIS

| # | Masalah | Status | Catatan |
|---|---------|--------|---------|
| F1 | Missing query invalidation — `deriveLegsMutation` dan `precomputeSeatInventoryMutation` tidak invalidate `['/api/trips']` | ✅ SELESAI | `TripsManager.tsx` L156, L165: `queryClient.invalidateQueries({ queryKey: ['/api/trips'] })` sudah ada di `onSuccess` kedua mutation |
| F2 | `parseInt('')` = NaN — capacity diinisialisasi sebagai string kosong | ✅ SELESAI | `TripsManager.tsx` L184: sekarang pakai `parseInt(formData.capacity, 10) \|\| 0` dengan fallback |
| F3 | Mobile: `avgRating.toFixed()` crash jika undefined | ⏳ BELUM | `apps/mobile/app/trip-detail.tsx` L97: masih `Number(trip.reviews.avgRating).toFixed(1)`. Perlu guard `(trip.reviews?.avgRating ?? 0)` |

### SEDANG

| # | Masalah | Status | Catatan |
|---|---------|--------|---------|
| F4 | Loading state hilang — beberapa query tanpa loading indicator | ⏳ BELUM | Multiple file: `TripSelector`, `TripsManager`, dll. Perlu tambah loading skeleton/spinner |
| F5 | `setTimeout` tanpa cleanup — tidak di-clearTimeout saat unmount | 🔄 SEBAGIAN | `searchable-select.tsx` dan `TripSelector.tsx` sudah punya cleanup. `TripPatternsManager.tsx` L386 masih tanpa cleanup. Beberapa `setTimeout(() => refetch(), 100)` di `SeatMap.tsx` tanpa cleanup tapi karena refetch idempoten, dampak minimal |
| F6 | Error state tidak ditangani — `SeatMap` tidak ada recovery path jika `isError` | ⏳ BELUM | `SeatMap.tsx` hanya tangani loading, tidak ada error UI. Perlu tambah error boundary atau retry button |
| F7 | Type `any` di sorting — `RouteTimeline.tsx` pakai `(a: any, b: any)` | ⏳ BELUM | `RouteTimeline.tsx` L91: masih `(a: any, b: any) => a.stopSequence - b.stopSequence` |
| F8 | Passengers sebagai `any[]` — `useBookingFlow.ts` handle passengers tanpa type | ⏳ BELUM | `useBookingFlow.ts` punya 7+ penggunaan `any` untuk passengers. Perlu buat proper interface |

---

## 3. Inkonsistensi Desain UI

### Border Radius

| # | Komponen | Status | Catatan |
|---|----------|--------|---------|
| UI-1 | Input: standar `rounded-xl`, dipakai `rounded-lg` di CargoForm, PassengerForm | ⏳ BELUM | Perlu seragamkan |
| UI-2 | Select: standar `rounded-xl`, dipakai `rounded-lg` di CargoForm | ⏳ BELUM | Perlu seragamkan |
| UI-3 | Button: standar `rounded-xl`, dipakai `rounded-lg` di PassengerForm | ⏳ BELUM | Perlu seragamkan |
| UI-4 | Dialog: `dialog.tsx` pakai `rounded-xl`, `base-dialog.tsx` pakai `rounded-lg` | ⏳ BELUM | Dua sistem dialog bertentangan |
| UI-5 | Card: standar `rounded-lg`, dipakai `rounded-xl` di PassengerForm, CargoForm | ⏳ BELUM | Perlu seragamkan |

### Ukuran (Height)

| # | Komponen | Status | Catatan |
|---|----------|--------|---------|
| UI-6 | Input: standar `h-10`, dipakai `h-8` di CargoForm, PassengerForm | ⏳ BELUM | Perlu seragamkan |
| UI-7 | Select: standar `h-10`, dipakai `h-9` di CargoForm | ⏳ BELUM | Perlu seragamkan |

### Sistem Dialog Ganda

| # | Komponen | Status | Catatan |
|---|----------|--------|---------|
| UI-8 | Dua implementasi dialog berbeda: `dialog.tsx` (Radix) vs `base-dialog.tsx` (Portal custom) | ⏳ BELUM | Perlu pilih satu dan konsolidasikan. `base-dialog.tsx` masih dipakai |

---

## 4. Komponen yang Harus Di-reuse

| # | Komponen | File Target | Status | Catatan |
|---|----------|-------------|--------|---------|
| R-1 | Input: harus pakai `components/ui/input.tsx` | PassengerForm, CargoForm, TripSelector | ⚠️ TIDAK RELEVAN | `PassengerForm` dan `TripSelector` sudah tidak pakai raw `<input>`. CargoForm sudah dihapus/refactor |
| R-2 | Select: harus pakai `components/ui/select.tsx` | CargoForm | ⚠️ TIDAK RELEVAN | CargoForm sudah direfactor |
| R-3 | Card: harus pakai `components/ui/card.tsx` | AllBookingsPage, ManifestDialog | ⏳ BELUM | Masih pakai custom div |
| R-4 | Badge: harus pakai `components/ui/badge.tsx` | AllBookingsPage, ManifestDialog | ⏳ BELUM | Masih pakai custom StatusBadge span |
| R-5 | Table: harus pakai `components/ui/table.tsx` | AllBookingsPage, ManifestDialog | ⏳ BELUM | Masih pakai raw `<table>` |
| R-6 | DatePicker: harus pakai `components/ui/date-picker.tsx` | TripSelector | ⏳ BELUM | `TripSelector.tsx` L174: masih pakai `CustomDatePicker` (150+ baris) padahal `date-picker.tsx` sudah ada |
| R-7 | Loading & Empty State: perlu komponen shared | Multiple files | ⏳ BELUM | Setiap file buat spinner/empty state sendiri |

---

## 5. Kelengkapan Fitur

### Fitur Lengkap & Berfungsi

| # | Fitur | Status |
|---|-------|--------|
| FT-1 | CRUD Master Data (Stops, Outlets, Vehicles, Layouts, Patterns, Drivers) | ✅ |
| FT-2 | Penjadwalan Virtual (Trip Bases) | ✅ |
| FT-3 | Materialisasi Trip | ✅ |
| FT-4 | Reservasi CSO (seat hold → booking → payment) | ✅ |
| FT-5 | Pricing Rules | ✅ |
| FT-6 | Kargo (types, rates, shipments, waybill) | ✅ |
| FT-7 | Manifest (view + thermal print) | ✅ |
| FT-8 | Trip Cost Templates | ✅ |
| FT-9 | WebSocket real-time seat updates | ✅ |

### Endpoint Tersedia tapi Belum Dipakai di Frontend

| # | Endpoint | Status | Catatan |
|---|----------|--------|---------|
| EP-1 | `GET /api/drivers/:id` — Detail driver individual | ⏳ BELUM | Sudah ada di backend, belum ada UI |
| EP-2 | `PATCH /api/passengers/:id/cancel` — Batalkan penumpang individual | ⏳ BELUM | Sudah ada di backend, belum ada UI |
| EP-3 | `GET /api/tickets/:ticketNumber` — Cari tiket by nomor | ⏳ BELUM | Sudah ada di backend, belum ada UI |
| EP-4 | `GET /api/bookings/:bookingId/payments` — Riwayat pembayaran per booking | ⏳ BELUM | Sudah ada di backend, belum ada UI |

### Kolom DB Ada tapi Belum Dimanfaatkan

| # | Kolom | Tabel | Status | Catatan |
|---|-------|-------|--------|---------|
| DB-1 | `lat`, `lng` | stops | ⏳ BELUM | Untuk fitur peta (belum ada) |
| DB-2 | `tags` | trip_patterns | ⏳ BELUM | Untuk tagging/filter (belum ada UI) |
| DB-3 | `length_cm`, `width_cm`, `height_cm` | cargo_shipments | ⏳ BELUM | Ditangkap tapi tidak masuk kalkulasi tarif |
| DB-4 | `attempts`, `lastError` | print_jobs | ⏳ BELUM | Untuk background printing (belum aktif) |

---

## 6. Saran Peningkatan

### Prioritas Tinggi

| # | Saran | Status | Catatan |
|---|-------|--------|---------|
| S-1 | Bungkus booking dalam `db.transaction()` | ✅ SELESAI | Sprint 1 C-02 |
| S-2 | Hapus in-memory hold Map | ✅ SELESAI | Sudah full DB-based |
| S-3 | Standardisasi komponen UI — semua pakai shadcn | ⏳ BELUM | Lihat bagian 4 (R-1 s.d. R-7) |
| S-4 | Tambah error boundary | ⏳ BELUM | Belum ada React Error Boundary |
| S-5 | Fix missing query invalidation (derive legs, precompute) | ✅ SELESAI | Sudah ada di `onSuccess` callback |

### Prioritas Sedang

| # | Saran | Status | Catatan |
|---|-------|--------|---------|
| S-6 | Buat komponen `EmptyState` dan `LoadingState` shared | ⏳ BELUM | R-7 |
| S-7 | Ganti `CustomDatePicker` dengan `date-picker.tsx` | ⏳ BELUM | R-6 |
| S-8 | Gabungkan 2 sistem dialog | ⏳ BELUM | UI-8 |
| S-9 | Perkuat type safety — ganti `any` | ⏳ BELUM | F7, F8 |
| S-10 | Cleanup setTimeout | 🔄 SEBAGIAN | F5 — sebagian sudah, sebagian belum |

### Prioritas Rendah

| # | Saran | Status | Catatan |
|---|-------|--------|---------|
| S-11 | Manfaatkan dimensi kargo dalam kalkulasi tarif volumetrik | ⏳ BELUM | DB-3 |
| S-12 | Buat UI untuk endpoint yang sudah ada | ⏳ BELUM | EP-1 s.d. EP-4 |
| S-13 | Tambah fitur peta menggunakan `lat`/`lng` | ⏳ BELUM | DB-1 |
| S-14 | Tingkatkan retry limit waybill generation | ⚠️ TIDAK RELEVAN | B6 — waybill sudah pakai metode deterministik |

---

## Item Tambahan dari Blink AI Audit (Sprint 0)

Beberapa fix berasal dari audit terpisah (Blink AI, 174 poin) yang tidak tercantum di audit report utama tapi sudah dikerjakan:

| Kode | Masalah | Status | Catatan |
|------|---------|--------|---------|
| C-01 | `.env` parsing bug (concatenated vars) | ✅ SELESAI | `.gitignore` updated |
| C-04 | Missing `await` pada `isHoldOwnedByOperator()` | ✅ SELESAI | Promise-truthiness bypass dicegah |
| C-05 | `x-operator-id` header fallback memungkinkan identity spoofing | ✅ SELESAI | 10 lokasi dihapus, semua pakai `req.user?.id ?? 'system'` |
| C-06 | `payments.status` default `'success'` seharusnya `'pending'` | ✅ SELESAI | Lifecycle payment yang benar |
| C-10 | GET fetch tidak cek `res.ok` sebelum parse JSON | ✅ SELESAI | `assertOk<T>()` helper ditambahkan |
| H-02 | WS emit di dalam/sebelum commit transaksi | ✅ SELESAI | Sprint 1 — emit setelah commit |
| H-04 | WebSocket CORS terbuka `"*"` | ✅ SELESAI | Env-configurable `CORS_ORIGINS` |
| H-05 | Hold delete tanpa validasi ownership | ✅ SELESAI | 404/403 enforcement |
| H-06 | `getPendingBookings` load semua lalu filter | ✅ SELESAI | Sprint 1 — DB-level filter |
| H-09 | Promo `markUsed` di luar transaksi | ✅ SELESAI | Sprint 1 — dalam tx + race guard |
| H-11 | `deleteTrip` tanpa cek active bookings | ✅ SELESAI | Repository sudah validate |
| H-16 | `Math.random()` di code generator | ✅ SELESAI | `crypto.randomBytes()` + rejection sampling |
| H-03 | JWT expiry terlalu panjang (30 hari) | ⏳ BELUM | Perlu review konfigurasi auth |
| H-08 | React Query `staleTime: Infinity` | ⏳ BELUM | `queryClient.ts` L50: global staleTime Infinity — data tidak pernah re-fetch otomatis |
| C-03 | Idempotency key placeholder | ⏳ BELUM | Belum diimplementasi |

---

## Ringkasan Status

```
Total item unik:  ~65 item (audit report) + ~15 item (Blink AI tambahan) = ~80 item

✅ SELESAI:         21 item (termasuk 9 fitur yang sudah lengkap)
⏳ BELUM:           42 item
🔄 SEBAGIAN:         2 item
⚠️ TIDAK RELEVAN:    4 item

Breakdown BELUM per kategori:
├── Backend bugs:         2 (B7 float comparison, B8 WS hot reload)
├── Frontend bugs:        5 (F3 mobile crash, F4 loading, F6 error, F7 type, F8 type)
├── UI inkonsistensi:     8 (UI-1 s.d. UI-8)
├── Komponen reuse:       5 (R-3 s.d. R-7)
├── Kelengkapan fitur:    8 (EP-1..4, DB-1..4)
├── Saran peningkatan:   11 (S-3, S-4, S-6..S-9, S-11..S-13 + H-03, H-08, C-03)
└── Total:               42
```

### Prioritas Selanjutnya (Saran Sprint 2+)

**Sprint 2 — Quick Wins & Safety:**
- B7: Float comparison fix (kecil, cepat)
- F3: Mobile avgRating guard (kecil, cepat)
- H-08: staleTime Infinity → pakai value yang wajar
- H-03: JWT expiry review
- B8: WS initialize guard (dev-only, kecil)

**Sprint 3 — UI/UX Consistency:**
- UI-1 s.d. UI-8: Standardisasi border radius, height, dialog system
- R-3 s.d. R-7: Migrasi ke komponen shadcn (Card, Badge, Table, DatePicker)
- S-6: Shared EmptyState/LoadingState
- F4: Loading states di query
- F6: Error state di SeatMap

**Sprint 4 — Type Safety & Code Quality:**
- F7: Type `any` di RouteTimeline
- F8: Type `any` di useBookingFlow
- S-4: React Error Boundary
- F5: setTimeout cleanup sisa
- C-03: Idempotency key

**Backlog — Fitur Baru (Prioritas Rendah):**
- EP-1..4: UI untuk endpoint yang sudah tersedia
- DB-1: Fitur peta (lat/lng)
- DB-2: Trip pattern tags
- DB-3: Kalkulasi tarif volumetrik kargo
- DB-4: Background print job processing
