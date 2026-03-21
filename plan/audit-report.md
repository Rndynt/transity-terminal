# Audit Report — Transity Codebase

Tanggal: 2026-03-21

---

## Daftar Isi

1. [Bug & Potensi Bug — Backend](#1-bug--potensi-bug--backend)
2. [Bug & Potensi Bug — Frontend](#2-bug--potensi-bug--frontend)
3. [Inkonsistensi Desain UI](#3-inkonsistensi-desain-ui)
4. [Komponen yang Harus Di-reuse](#4-komponen-yang-harus-di-reuse)
5. [Kelengkapan Fitur](#5-kelengkapan-fitur)
6. [Saran Peningkatan](#6-saran-peningkatan)
7. [Ringkasan Prioritas](#7-ringkasan-prioritas)

---

## 1. Bug & Potensi Bug — Backend

### KRITIS

| # | Masalah | File | Dampak |
|---|---------|------|--------|
| B1 | **Booking tanpa transaksi DB** — `createBooking` menulis ke 3 tabel (bookings, passengers, payments) tanpa `db.transaction()`. Jika payment gagal di tengah, booking "paid" tanpa payment record. | `bookings.service.ts` L157-208 | Data inkonsisten |
| B2 | **In-memory holds vs DB** — `HoldsService` menyimpan holds di `Map` in-memory DAN database. Di environment multi-instance, state bisa divergen → 2 CSO bisa hold kursi yang sama. | `holds.service.ts` | Double booking |
| B3 | **Error di-swallow saat update inventory** — `try-catch` di holds service log error tapi tetap emit WebSocket event seolah berhasil. Frontend percaya hold sukses padahal gagal di DB. | `holds.service.ts` L103-115 | Phantom holds |

### SEDANG

| # | Masalah | File | Dampak |
|---|---------|------|--------|
| B4 | **Seat inventory release tanpa transaksi** — `releasePendingBooking` dan `cleanupExpiredPendingBookings` update seat_inventory per passenger dalam loop tanpa transaction. Partial release bisa terjadi. | `bookings.service.ts` L434-480 | Kursi "zombie" |
| B5 | **tripId dari query tanpa guard** — `req.query.tripId` di-cast ke `string` tanpa cek undefined. | `bookings.controller.ts` L66 | Potential crash |
| B6 | **Waybill retry limit terlalu kecil** — Hardcoded 5 retry untuk generate waybill. Volume tinggi bisa gagal. | `cargo.service.ts` L97-110 | Gagal buat resi |

### RENDAH

| # | Masalah | File | Dampak |
|---|---------|------|--------|
| B7 | Float comparison untuk payment validation (`> 0.01`). IDR tidak pakai desimal, threshold bisa diperkecil. | `bookings.service.ts` | Edge case rounding |
| B8 | WebSocket `initialize` bisa dipanggil multiple kali saat hot reload → listener duplikat. | `ws.ts` | Memory leak dev |

---

## 2. Bug & Potensi Bug — Frontend

### KRITIS

| # | Masalah | File | Dampak |
|---|---------|------|--------|
| F1 | **Missing query invalidation** — `deriveLegsMutation` dan `precomputeSeatInventoryMutation` tidak invalidate query `['/api/trips']`. UI tidak update sampai refresh manual. | `TripsManager.tsx` L226-232 | Stale UI |
| F2 | **`parseInt('')` = NaN** — Capacity field diinisialisasi sebagai string kosong, `parseInt('', 10)` menghasilkan NaN yang dikirim ke server. | `TripsManager.tsx` L250 | Kirim NaN ke server |
| F3 | **Mobile: `avgRating.toFixed()` crash** — Jika `avgRating` undefined, `Number(undefined).toFixed(1)` = `"NaN"` yang ditampilkan ke user. | `apps/mobile/trip-detail.tsx` L97 | Crash/tampil NaN |

### SEDANG

| # | Masalah | File | Dampak |
|---|---------|------|--------|
| F4 | **Loading state hilang** — Beberapa query tidak menampilkan loading indicator: outlets/stops di TripSelector, stops/cargoTypes di CargoForm, patterns/vehicles/layouts di TripsManager. Dropdown kosong tanpa feedback. | Multiple files | UX buruk |
| F5 | **setTimeout tanpa cleanup** — `setTimeout` di `searchable-select.tsx`, `TripSelector.tsx`, `TripPatternsManager.tsx` tidak di-clearTimeout saat unmount. | Multiple files | Memory leak kecil |
| F6 | **Error state tidak ditangani** — `SeatMap` menampilkan spinner saat loading tapi tidak ada recovery path jika `isError`. | `SeatMap.tsx` | Dead end UI |
| F7 | **Type `any` di sorting** — `RouteTimeline.tsx` pakai `(a: any, b: any)` untuk sorting, bypass type safety. | `RouteTimeline.tsx` L61 | Runtime error risk |
| F8 | **Passengers sebagai `any[]`** — `useBookingFlow.ts` handle passengers tanpa type, bisa crash jika field berubah. | `useBookingFlow.ts` L78 | Runtime error risk |

---

## 3. Inkonsistensi Desain UI

### Border Radius

| Komponen | Standar (ui/) | Yang Dipakai | File |
|----------|---------------|-------------|------|
| Input | `rounded-xl` | `rounded-lg` | `CargoForm.tsx`, `PassengerForm.tsx` |
| Select | `rounded-xl` | `rounded-lg` | `CargoForm.tsx` |
| Button | `rounded-xl` | `rounded-lg` | `PassengerForm.tsx` (payment method) |
| Dialog | `rounded-xl` (dialog.tsx) | `rounded-lg` (base-dialog.tsx) | Dua sistem dialog berbeda |
| Card | `rounded-lg` (card.tsx) | `rounded-xl` | `PassengerForm.tsx`, `CargoForm.tsx` |

### Ukuran (Height)

| Komponen | Standar | Yang Dipakai | File |
|----------|---------|-------------|------|
| Input | `h-10` | `h-8` | `CargoForm.tsx`, `PassengerForm.tsx` |
| Select | `h-10` | `h-9` | `CargoForm.tsx` |

### Sistem Dialog Ganda

Ada 2 implementasi dialog yang saling bertentangan:
1. **`dialog.tsx`** (Radix-based) — pakai `rounded-xl`, padding `p-6`
2. **`base-dialog.tsx`** (Portal custom) — pakai `rounded-lg`, sticky header/footer

File yang pakai masing-masing:
- `ManifestDialog.tsx` → `dialog.tsx` (max-w-5xl)
- `PassengerDetailModal.tsx` → `dialog.tsx` (max-w-2xl, p-0)
- `MasterFormDialog.tsx` → wrapper `dialog.tsx` (px-5)

---

## 4. Komponen yang Harus Di-reuse

### Input — Harus Pakai `components/ui/input.tsx`

| File | Baris | Sekarang |
|------|-------|----------|
| `PassengerForm.tsx` | 197-230 | Raw `<input>` dengan styling manual |
| `CargoForm.tsx` | 223-280, 309-400 | Raw `<input>` dengan styling manual |
| `TripSelector.tsx` | 120-122 | Raw `<input>` untuk search |

### Select — Harus Pakai `components/ui/select.tsx`

| File | Baris | Sekarang |
|------|-------|----------|
| `CargoForm.tsx` | 186-210, 295-306 | Native `<select>` HTML |

### Card — Harus Pakai `components/ui/card.tsx`

| File | Baris | Sekarang |
|------|-------|----------|
| `AllBookingsPage.tsx` | 138-199, 203-248 | Custom `div` dengan border/padding manual |
| `ManifestDialog.tsx` | 221-284, 386-403 | Custom `div` dengan `bg-muted/40` |

### Badge — Harus Pakai `components/ui/badge.tsx`

| File | Baris | Sekarang |
|------|-------|----------|
| `AllBookingsPage.tsx` | 63-70 | Custom `StatusBadge` span |
| `ManifestDialog.tsx` | 53-63 | Custom `TicketStatusBadge` span |
| `AllBookingsPage.tsx` | 383-428 | Custom filter pills |

### Table — Harus Pakai `components/ui/table.tsx`

| File | Baris | Sekarang |
|------|-------|----------|
| `AllBookingsPage.tsx` | 451-528 | Raw `<table>` |
| `ManifestDialog.tsx` | 300-377 | Raw `<table>` untuk penumpang & kargo |

### DatePicker — Sudah Ada `components/ui/date-picker.tsx`

| File | Baris | Sekarang |
|------|-------|----------|
| `TripSelector.tsx` | 168-318 | `CustomDatePicker` dibuat dari nol (150 baris!) |

### Loading & Empty State — Perlu Komponen Shared

| File | Baris | Pola |
|------|-------|------|
| `AllBookingsPage.tsx` | 125-129 | Manual `Loader2` div |
| `RouteTimeline.tsx` | 72-79 | Custom loading |
| `AllBookingsPage.tsx` | 437-449 | Custom empty state icon |
| `TripSelector.tsx` | 618-621 | Custom loading spinner |
| `CargoListPage.tsx` | Various | Custom loading/empty |

---

## 5. Kelengkapan Fitur

### Lengkap & Berfungsi

| Fitur | Status |
|-------|--------|
| CRUD Master Data (Stops, Outlets, Vehicles, Layouts, Patterns, Drivers) | ✅ |
| Penjadwalan Virtual (Trip Bases) | ✅ |
| Materialisasi Trip | ✅ |
| Reservasi CSO (seat hold → booking → payment) | ✅ |
| Pricing Rules | ✅ |
| Kargo (types, rates, shipments, waybill) | ✅ |
| Manifest (view + thermal print) | ✅ |
| Trip Cost Templates | ✅ |
| WebSocket real-time seat updates | ✅ |

### Endpoint Tersedia tapi Belum Dipakai di Frontend

| Endpoint | Fungsi |
|----------|--------|
| `GET /api/drivers/:id` | Detail driver individual |
| `PATCH /api/passengers/:id/cancel` | Batalkan penumpang individual |
| `GET /api/tickets/:ticketNumber` | Cari tiket by nomor |
| `GET /api/bookings/:bookingId/payments` | Riwayat pembayaran per booking |

### Kolom DB Ada tapi Belum Dimanfaatkan

| Kolom | Tabel | Catatan |
|-------|-------|---------|
| `lat`, `lng` | stops | Untuk fitur peta (belum ada) |
| `tags` | trip_patterns | Untuk tagging/filter (belum ada UI) |
| `length_cm`, `width_cm`, `height_cm` | cargo_shipments | Ditangkap di form tapi tidak masuk kalkulasi tarif |
| `attempts`, `lastError` | print_jobs | Untuk background printing (belum aktif) |

---

## 6. Saran Peningkatan

### Prioritas Tinggi

1. **Bungkus booking dalam `db.transaction()`** — Semua operasi yang menulis ke multiple tabel harus atomik
2. **Hapus in-memory hold Map** — Gunakan hanya database dengan `FOR UPDATE` lock untuk konsistensi
3. **Standardisasi komponen UI** — Buat design system kecil: semua input, select, card, badge, table pakai komponen shadcn
4. **Tambah error boundary** — Tangkap error di level komponen agar satu crash tidak menjatuhkan seluruh halaman
5. **Fix missing query invalidation** — Setelah derive legs dan precompute inventory, invalidate query trips

### Prioritas Sedang

6. **Buat komponen `EmptyState` dan `LoadingState` shared** — Konsistensi loading/empty di seluruh app
7. **Ganti `CustomDatePicker` dengan date-picker.tsx** — Hapus 150 baris duplikat
8. **Gabungkan 2 sistem dialog** — Pilih satu (Radix `Dialog` atau `BaseDialog`), jangan dua-duanya
9. **Perkuat type safety** — Ganti `any` dengan proper types di `RouteTimeline`, `useBookingFlow`, passengers
10. **Cleanup setTimeout** — Tambahkan `clearTimeout` di semua useEffect yang pakai setTimeout

### Prioritas Rendah

11. Manfaatkan dimensi kargo (panjang/lebar/tinggi) dalam kalkulasi tarif volumetrik
12. Buat UI untuk endpoint yang sudah ada (cancel passenger, ticket lookup, payment history)
13. Tambah fitur peta menggunakan koordinat `lat`/`lng` yang sudah tersimpan
14. Tingkatkan retry limit waybill generation untuk volume tinggi

---

## 7. Ringkasan Prioritas

```
KRITIS (harus diperbaiki):
├── B1: Booking tanpa transaction → data korupsi
├── B2: In-memory holds → double booking di multi-instance
├── B3: Error di-swallow → phantom holds
├── F1: Missing query invalidation → stale UI
└── F2: parseInt('') = NaN → kirim data invalid

PENTING (sebaiknya segera):
├── Standardisasi UI components (Input, Select, Card, Badge, Table)
├── Gabungkan sistem Dialog
├── F4: Missing loading states
└── B4: Seat release tanpa transaction

DESIRABLE (tingkatkan kualitas):
├── Shared EmptyState/LoadingState components
├── Ganti CustomDatePicker
├── Type safety improvements
└── Fitur baru (peta, volumetrik kargo)
```
