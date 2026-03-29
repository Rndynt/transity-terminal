# Audit Checklist — TransityTerminal

Sumber: `plan/audit-report.md` (Tanggal audit: 2026-03-21)
Terakhir diperbarui: 2026-03-29 (Sprint 3+4 selesai)

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
| B7 | Float comparison untuk payment validation (`> 0.01`) | ✅ SELESAI | Sprint 2: Diganti `Math.round()` comparison — cocok untuk IDR yang tanpa desimal |
| B8 | WebSocket `initialize` bisa dipanggil multiple kali saat hot reload | ✅ SELESAI | Sprint 2: Guard `if (this.io) return` ditambahkan di awal `initialize()` |

---

## 2. Bug & Potensi Bug — Frontend

### KRITIS

| # | Masalah | Status | Catatan |
|---|---------|--------|---------|
| F1 | Missing query invalidation — `deriveLegsMutation` dan `precomputeSeatInventoryMutation` tidak invalidate `['/api/trips']` | ✅ SELESAI | `TripsManager.tsx` L156, L165: `queryClient.invalidateQueries({ queryKey: ['/api/trips'] })` sudah ada di `onSuccess` kedua mutation |
| F2 | `parseInt('')` = NaN — capacity diinisialisasi sebagai string kosong | ✅ SELESAI | `TripsManager.tsx` L184: sekarang pakai `parseInt(formData.capacity, 10) \|\| 0` dengan fallback |
| F3 | Mobile: `avgRating.toFixed()` crash jika undefined | ✅ SELESAI | Sprint 2: Diganti `Number(trip.reviews?.avgRating ?? 0).toFixed(1)` |

### SEDANG

| # | Masalah | Status | Catatan |
|---|---------|--------|---------|
| F4 | Loading state hilang — beberapa query tanpa loading indicator | ✅ SELESAI | Sprint 3/4: `TripsManager.tsx` query patterns/vehicles/layouts/drivers sekarang destructure `isLoading`. `LoadingState`/`EmptyState` sudah ada di `components/ui/` |
| F5 | `setTimeout` tanpa cleanup — tidak di-clearTimeout saat unmount | ✅ SELESAI | Sprint 4: `RouteTimeline.tsx` useEffect setTimeout sekarang return `clearTimeout`. `useWebSocket.ts` reconnect timer pakai ref + cleanup di `disconnect()`. SeatMap refetch timeouts di event handlers (bukan effect) — aman |
| F6 | Error state tidak ditangani — `SeatMap` tidak ada recovery path jika `isError` | ✅ SELESAI | SeatMap L397-406 sudah punya error state dengan retry button |
| F7 | Type `any` di sorting — `RouteTimeline.tsx` pakai `(a: any, b: any)` | ✅ SELESAI | Sprint 4: `EffectiveStopTime` type ditambahkan, semua `any` di RouteTimeline dihapus (sort, find, findIndex, map) |
| F8 | Passengers sebagai `any[]` — `useBookingFlow.ts` handle passengers tanpa type | ✅ SELESAI | Sprint 4: `Passenger` type diimport, `BookingOverrides`/`BookingResult` type aliases ditambah, semua 7+ `any` dihapus |

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
| UI-8 | Dua implementasi dialog berbeda: `dialog.tsx` (Radix) vs `base-dialog.tsx` (Portal custom) | ⚠️ TIDAK RELEVAN | `base-dialog.tsx` tidak diimpor di mana pun — hanya `dialog.tsx` (Radix) yang aktif dipakai |

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
| R-7 | Loading & Empty State: perlu komponen shared | Multiple files | ✅ SELESAI | `LoadingState` dan `EmptyState` tersedia di `components/ui/` dan dipakai di `AllBookingsPage` dll |

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
| S-4 | Tambah error boundary | ✅ SELESAI | Sprint 4: `ErrorBoundary` component di `shared/ErrorBoundary.tsx`, wraps `Router` di `App.tsx` |
| S-5 | Fix missing query invalidation (derive legs, precompute) | ✅ SELESAI | Sudah ada di `onSuccess` callback |

### Prioritas Sedang

| # | Saran | Status | Catatan |
|---|-------|--------|---------|
| S-6 | Buat komponen `EmptyState` dan `LoadingState` shared | ✅ SELESAI | Sudah ada di `components/ui/loading-state.tsx` dan `components/ui/empty-state.tsx` |
| S-7 | Ganti `CustomDatePicker` dengan `date-picker.tsx` | ⏳ BELUM | R-6 |
| S-8 | Gabungkan 2 sistem dialog | ⚠️ TIDAK RELEVAN | UI-8 — `base-dialog.tsx` tidak dipakai, hanya `dialog.tsx` (Radix) yang aktif |
| S-9 | Perkuat type safety — ganti `any` | ✅ SELESAI | Sprint 4: F7 (RouteTimeline) dan F8 (useBookingFlow) semua `any` dihapus |
| S-10 | Cleanup setTimeout | ✅ SELESAI | Sprint 4: RouteTimeline + useWebSocket timer cleanup |

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
| H-03 | JWT expiry terlalu panjang (30 hari) | ⚠️ TIDAK RELEVAN | Bukan JWT — session-based auth dengan expiry 7 hari, sudah wajar |
| H-08 | React Query `staleTime: Infinity` | ✅ SELESAI | Sprint 2: Diubah dari `Infinity` ke `5 * 60 * 1000` (5 menit) |
| C-03 | Idempotency key placeholder | ⏳ BELUM | Belum diimplementasi |

---

## Ringkasan Status

```
Total item unik:  ~65 item (audit report) + ~15 item (Blink AI tambahan) = ~80 item

✅ SELESAI:         35 item
⏳ BELUM:           27 item
⚠️ TIDAK RELEVAN:    8 item

Breakdown BELUM per kategori:
├── UI inkonsistensi:     7 (UI-1 s.d. UI-7)
├── Komponen reuse:       4 (R-3 s.d. R-6)
├── Kelengkapan fitur:    8 (EP-1..4, DB-1..4)
├── Saran peningkatan:    5 (S-3, S-7, S-11..S-13)
├── Blink AI sisa:        1 (C-03 idempotency)
└── Total:               27
```

### Sprint Completed

**Sprint 0 — Security Hotfixes (8 item):** C-01, C-04, C-05, C-06, C-10, H-04, H-05, H-16
**Sprint 1 — Data Integrity (5 item):** C-02/B1, H-02/B4, H-06, H-09, H-11
**Sprint 2 — Quick Wins & Safety (4 item):** B7, B8, F3, H-08
**Sprint 3+4 — UI/UX & Type Safety (9 item):** F4, F5, F6, F7, F8, S-4, S-6, S-9, S-10, R-7, UI-8, S-8

### Prioritas Selanjutnya

**Sprint 5 — UI Consistency (Kosmetik):**
- UI-1 s.d. UI-7: Standardisasi border radius dan height
- R-3 s.d. R-5: Migrasi Card/Badge/Table ke shadcn (risiko regresi tinggi)
- R-6/S-7: Ganti CustomDatePicker (punya Indonesian locale — risky)
- S-3: Full standardisasi komponen UI

**Sprint 6 — Idempotency:**
- C-03: Idempotency key server-side enforcement

**Backlog — Fitur Baru (Prioritas Rendah):**
- EP-1..4: UI untuk endpoint yang sudah tersedia
- DB-1: Fitur peta (lat/lng)
- DB-2: Trip pattern tags
- DB-3: Kalkulasi tarif volumetrik kargo
- DB-4: Background print job processing
