# TransityTerminal — Performance Audit

Analisa mendalam performa sistem saat banyak CSO dari berbagai outlet mengakses satu instance operator secara bersamaan.

---

## Skenario Beban Tinggi

Satu operator shuttle dengan:
- 8+ rute aktif, masing-masing 3-5 trip per hari
- 5-10 outlet tersebar di beberapa kota
- 2-3 CSO per outlet beroperasi bersamaan
- 20-30 concurrent CSO users + App booking

---

## Critical Path Analysis

### 🔴 Prioritas KRITIS

#### 1. N+1 Query di Trip Search (`app.service.ts` — searchRealTrips)

**Masalah:** Setiap trip dari search result diproses dalam loop — per-trip menjalankan 3 query tambahan: stop times, seat availability, dan fare quote.

```
10 trip ditemukan → 30 extra queries (stop_times + inventory + pricing per trip)
```

**Dampak:** Endpoint paling sering dipanggil. Dengan 6 virtual + 4 real trip, satu pencarian = ~40 queries. Jika 10 CSO + 5 App user cari bersamaan = 600+ queries per detik.

**Lokasi:** `app.service.ts` line 411-461 (`searchRealTrips`), line 524-604 (`searchVirtualTrips`)

**Fix:** Batch fetch semua stop times dalam satu query pakai `WHERE trip_id IN (...)`, batch fetch semua seat inventory per trip, dan batch price rules per pattern.

---

#### 2. N+1 Query di Scheduler Cleanup (`scheduler.ts`)

**Masalah:** `cleanupExpiredHolds` menjalankan UPDATE per-hold di dalam transaksi:

```typescript
for (const hold of expiredHolds) {
  await tx.update(seatInventory).set({ holdRef: null })
    .where(eq(seatInventory.holdRef, hold.holdRef));
}
```

Jika 50 hold expired bersamaan → 50 UPDATE queries di satu transaksi, mengunci banyak baris `seat_inventory`.

**Dampak:** Berjalan setiap 60 detik. Saat busy period (banyak hold dibuat/expired), bisa lock out CSO yang sedang booking.

**Lokasi:** `server/scheduler.ts` line 33-38

**Fix:** Ganti loop UPDATE jadi satu bulk query: `UPDATE seat_inventory SET hold_ref = NULL WHERE hold_ref IN (SELECT hold_ref FROM seat_holds WHERE expires_at < NOW())`.

---

#### 3. Orphan Cleanup Full Table Scan (`scheduler.ts` — cleanupOrphanHoldRefs)

**Masalah:** Query `NOT IN (SELECT hold_ref FROM seat_holds)` di `seat_inventory` = full subquery scan.

```typescript
const validHoldRefs = db.select({ holdRef: seatHolds.holdRef }).from(seatHolds);
await db.update(seatInventory).set({ holdRef: null })
  .where(and(isNotNull(seatInventory.holdRef), notInArray(seatInventory.holdRef, validHoldRefs)));
```

**Dampak:** Scan seluruh `seat_inventory` yang punya holdRef, lalu cross-check dengan semua `seat_holds`. Jika ada 30 trip × 14 seat × 5 leg = 2100 baris seat_inventory per trip, total bisa 63.000+ baris yang di-scan setiap menit.

**Lokasi:** `server/scheduler.ts` line 53-63

**Fix:** Gunakan `LEFT JOIN ... WHERE seat_holds.hold_ref IS NULL` sebagai subquery, atau gunakan `NOT EXISTS` yang lebih efisien. Index `seat_inventory(hold_ref)` juga diperlukan.

---

#### 4. Duplicate Cleanup Scheduler (30s + 60s)

**Masalah:** Ada **dua** cleanup scheduler yang berjalan bersamaan:
- `server/scheduler.ts` — `cleanupExpiredHolds` setiap 60 detik
- `server/modules/holds/holds.service.ts` — `cleanupExpiredHolds` setiap 30 detik (di constructor `HoldsService`)

Keduanya query + delete dari tabel yang sama (`seat_holds`), saling race condition.

**Dampak:** Double query load, potential deadlock jika dua proses mengambil hold yang sama.

**Fix:** Hapus cleanup di `HoldsService` — biarkan `scheduler.ts` saja yang menangani.

---

#### 5. WebSocket Emit di Dalam Transaksi (`atomicHold.service.ts`)

**Masalah:** `releaseHoldByRef` memanggil `webSocketService.emitInventoryUpdated` dan `emitHoldsReleased` **di dalam** `db.transaction()`.

**Dampak:** Jika WebSocket emit lambat (network latency), transaksi DB tetap terbuka dan mengunci baris. Juga bisa mengirim event sebelum commit, yang artinya client menerima update untuk data yang belum final.

**Lokasi:** `server/modules/bookings/atomicHold.service.ts` line 130-135 (di dalam `db.transaction`)

**Fix:** Simpan data yang perlu di-emit, emit **setelah** transaksi berhasil.

---

### 🟡 Prioritas TINGGI

#### 6. N+1 di confirmSeatsBooked dan createSeatHoldsForBooking

**Masalah:** Loop per-seat untuk UPDATE inventory dan DELETE holds:

```typescript
for (const seatNo of seatNos) {
  await tx.update(seatInventory)...  // per seat
  await tx.delete(seatHolds)...      // per seat
}
```

Booking 4 penumpang = 8 queries di dalam transaksi.

**Lokasi:** `booking.helpers.ts` line 188-205 (`confirmSeatsBooked`), line 241-259 (`createSeatHoldsForBooking`)

**Fix:** Gunakan `inArray(seatInventory.seatNo, seatNos)` untuk satu UPDATE yang mencakup semua kursi.

---

#### 7. N+1 di cleanupExpiredPendingBookings

**Masalah:** Per-booking menjalankan transaksi terpisah, dan di dalam transaksi per-passenger menjalankan UPDATE terpisah.

**Lokasi:** `bookings.service.ts` line 356-392

**Fix:** Batch update seat_inventory per booking (semua passenger sekaligus), dan jika memungkinkan batch multiple bookings dalam satu transaksi.

---

#### 8. Sequential Validation di createBooking

**Masalah:** Empat langkah validasi berjalan berurutan padahal bisa paralel:

```typescript
await validateBoardingAlighting(...)  // step 1
await validateHoldOwnership(...)       // step 2
const { fareQuote, total } = await calculateBookingTotal(...)  // step 3
const snapshots = await fetchBookingSnapshots(...)              // step 4
```

**Lokasi:** `bookings.service.ts` line 99-117

**Fix:** Jalankan semua dengan `Promise.all` — tidak ada dependency antara keempatnya.

---

#### 9. Round Trip Booking Deadlock Risk

**Masalah:** `createRoundTripBooking` mengunci seat_inventory di dua trip berbeda secara berurutan (outbound lalu return). Jika User A booking Trip1→Trip2 dan User B booking Trip2→Trip1, bisa deadlock.

**Lokasi:** `server/modules/bookings/roundTrip.service.ts`

**Fix:** Selalu lock trip dengan ID yang lebih kecil duluan (consistent ordering), atau gunakan advisory lock berdasarkan sorted trip pair.

---

### 🟢 Prioritas SEDANG

#### 10. Missing Database Indexes

| Tabel | Kolom | Alasan |
|-------|-------|--------|
| `seat_inventory` | `hold_ref` | Digunakan scheduler cleanup + release by holdRef |
| `seat_holds` | `booking_id` | Digunakan getBookingDetail + cleanup |
| `payments` | `provider_ref` | Digunakan webhook lookup (saat ini full scan) |
| `payments` | `paid_at` | Digunakan di semua laporan revenue |
| `cashier_sessions` | `outlet_id, status` | Filter session per outlet |
| `cashier_sessions` | `staff_id` | Filter session per staff |
| `print_jobs` | `booking_id` | Lookup print job saat booking |
| `booking_groups` | `outbound_booking_id` | Lookup round trip pair |
| `booking_groups` | `return_booking_id` | Lookup round trip pair |

---

#### 11. getBookingById — Waterfall Queries

**Masalah:** Dua `Promise.all` berurutan — yang kedua bisa dimasukkan ke yang pertama karena data yang dibutuhkan (`originStopId`, `destinationStopId`, `outletId`) sudah tersedia di booking object.

**Lokasi:** `bookings.service.ts` line 46-58

**Fix:** Gabung kedua `Promise.all` jadi satu.

---

#### 12. getUserBookings N+1 (`app.service.ts`)

**Masalah:** Per-booking menjalankan `getStopById` × 2 + `getPassengers`:

```typescript
result.map(async (b) => {
  const origin = await this.storage.getStopById(b.originStopId);     // N
  const dest = await this.storage.getStopById(b.destinationStopId);  // N
  const pax = await this.storage.getPassengers(b.id);                // N
})
```

10 booking history = 30 queries.

**Fix:** Batch `getStopsByIds` dan `getPassengersByBookingIds`.

---

#### 13. Virtual Trip Seatmap untuk App Booking

**Masalah:** Virtual trip belum dimaterialize → seatmap endpoint return `404`. App/Console harus hardcode layout.

**Fix:** Tambah endpoint atau logic di `getSeatmap` yang bisa return default layout dari trip base tanpa materialize.

---

## Ringkasan Prioritas Fix

| # | Masalah | Impact | Effort | Fix |
|---|---------|--------|--------|-----|
| 1 | Trip search N+1 | 🔴 Kritis | Medium | Batch fetch stops + inventory + pricing |
| 2 | Scheduler loop UPDATE | 🔴 Kritis | Low | Bulk SQL |
| 3 | Orphan cleanup full scan | 🔴 Kritis | Low | NOT EXISTS + index |
| 4 | Duplicate scheduler | 🔴 Kritis | Low | Hapus HoldsService cleanup |
| 5 | WS emit in transaction | 🔴 Kritis | Low | Move emit after commit |
| 6 | confirmSeatsBooked N+1 | 🟡 Tinggi | Low | Bulk update |
| 7 | Pending cleanup N+1 | 🟡 Tinggi | Low | Batch per-booking |
| 8 | Sequential validation | 🟡 Tinggi | Low | Promise.all |
| 9 | Round trip deadlock | 🟡 Tinggi | Medium | Consistent lock order |
| 10 | Missing indexes | 🟢 Sedang | Low | Tambah index |
| 11 | getBookingById waterfall | 🟢 Sedang | Low | Merge Promise.all |
| 12 | getUserBookings N+1 | 🟢 Sedang | Low | Batch stops + pax |
| 13 | Virtual trip seatmap | 🟢 Sedang | Medium | Default layout response |

---

## Estimasi Peningkatan

Jika fix #1-#8 diimplementasi:
- Trip search: dari ~40 queries → ~6 queries per pencarian
- Booking creation: dari sequential → 30-40% latency reduction
- Scheduler: dari N updates → 1 bulk update, eliminasi lock contention
- Overall: **50-70% pengurangan database query load** pada skenario 20-30 concurrent user
