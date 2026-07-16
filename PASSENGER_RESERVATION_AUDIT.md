# Audit: Fitur Reservasi Penumpang

Scope: booking creation (CSO/App/round-trip), seat hold/confirm (Node +
Rust engine strangler-fig), reschedule, master data yang berkaitan
langsung (trip status, seat inventory, price rules) sejauh menyentuh
reservasi. **Tidak exhaustive** — diprioritaskan ke jalur paling kritis
karena batas waktu; ditandai jelas mana yang terverifikasi baca kode
langsung vs yang perlu dicek lebih lanjut.

Catatan proses: tidak ada tool sub-agent/paralel-dispatch yang tersedia di
sesi ini, jadi audit dilakukan langsung secara berurutan (bukan benar-benar
paralel) — diprioritaskan untuk kecepatan.

---

## 🔴 BUG — dampak nyata pada konfigurasi SAAT INI (engine OFF, default)

### 1. `checkSeatsAvailable()` tidak cek kadaluarsa hold → false-conflict di App
`server/modules/bookings/booking.helpers.ts:329`. Fungsi ini (dipakai
**hanya** oleh alur booking App, `app.service.ts:1139`) menganggap SETIAP
`seat_inventory.hold_ref` yang tidak null sebagai "sedang ditahan user
lain":
```ts
if (!!row.hold_ref) throw new Error(`Seat ${row.seat_no} is currently held by another user`);
```
Ini TIDAK konsisten dengan `atomicHold.service.ts`'s `isHoldActive()` yang
benar (cek `expires_at > now() OR booking_id IS NOT NULL`). Reaper hold
jalan tiap 60 detik (`server/scheduler.ts:290`), jadi ada **jendela sampai
±60 detik** setiap kali hold pendek (TTL 5 menit) kadaluarsa di mana
penumpang App melihat kursi yang SEBENARNYA sudah bebas ditolak sebagai
"sedang dipakai orang lain". Perbaikan: reuse `isHoldActive()` yang sama,
atau minimal cek `expires_at`.

### 2. `conflictSeats` bisa berisi duplikat nama kursi yang sama
`atomicHold.service.ts:122-130` — loop per-leg push `seatNo` yang sama ke
array `conflicts` untuk tiap leg yang konflik. Untuk booking multi-leg,
error message/UI yang menampilkan `conflictSeats.join(', ')` bisa
menunjukkan `"A1, A1"` bukannya `"A1"`. Kosmetik tapi user-facing.

---

## 🟠 BUG — dorman di balik `RESERVATION_ENGINE_ENABLED=false` (default), TAPI akan pecah begitu diaktifkan

### 3. Round-trip booking SAMA SEKALI tidak lewat HoldsAdapter/engine ⚠️ paling kritis
`server/modules/bookings/roundTrip.service.ts` — `createRoundTripBooking()`
langsung menulis SQL mentah ke `seat_inventory`/`seat_holds` (baris
~200-235: `tx.update(seatInventory).set({booked:true, holdRef:null})...`,
`tx.delete(seatHolds)...`). **Tidak ada** satupun pemanggilan
`holdsAdapter.confirmForBooking()` atau bahkan pengecekan
`isEngineEnabled()` di seluruh file ini — beda dengan `bookings.service.ts`
(single-trip), `app.service.ts`, dan `reschedule.service.ts` yang semuanya
konsisten gate lewat adapter.

Dampak begitu engine diaktifkan: engine tidak pernah tahu kursi round-trip
ini sudah **confirmed** — dari sudut pandang engine, itu masih sekadar
"hold" yang akan kadaluarsa sesuai TTL-nya sendiri. Setelah TTL engine
habis, engine bisa membiarkan kursi yang SAMA di-hold/di-confirm booking
LAIN, padahal database lokal TT sudah menandainya `booked=true` permanen
→ **potensi double-booking nyata**, khusus untuk kanal round-trip. Ini
harus jadi blocker tambahan sebelum `RESERVATION_ENGINE_ENABLED=true`,
sejajar/lebih kritis dari 2 bug engine yang sudah diketahui sebelumnya.

### 4. `engineClient.ts`: `fetch()` tanpa timeout (dikonfirmasi masih terbuka)
`server/modules/holds/engineClient.ts:91-95` — tidak ada `AbortController`
atau `signal`. Engine sidecar yang tidak responsif akan menggantung
SETIAP request hold/confirm/cancel/inventory tanpa batas waktu.

### 5. `InventorySnapshot` type kemungkinan tidak cocok dengan payload engine (dikonfirmasi masih terbuka)
`engineClient.types.ts:40-48` — field `seats[].leg_index: number`
(tunggal), padahal SETIAP tipe request lain di file yang sama pakai
`leg_indexes: number[]` (jamak) untuk konsep yang sama. Indikasi kuat
shape tidak sesuai. Saat ini **laten/tidak dipakai** — tidak ada satupun
pemanggil `engineClient.inventory()` di seluruh codebase, jadi belum
meledak, tapi jadi jebakan untuk fitur rekonsiliasi inventory berikutnya.

---

## 🟡 POTENSI BUG / KERAPUHAN (butuh verifikasi lanjutan atau low-severity)

### 6. `getHoldsAdapter()` singleton — dead code, dan gate tidak konsisten
`holdsAdapter.ts:547-551` — factory singleton di-export tapi **tidak
pernah dipanggil di manapun**. Semua call site (bookings.service.ts,
reschedule.service.ts ×6, unseat.service.ts ×3, refunds.service.ts,
app.service.ts) melakukan `new HoldsAdapter(new AtomicHoldService(storage))`
inline berulang-ulang — termasuk 6× di dalam class yang sama di
`reschedule.service.ts`. Tidak salah secara fungsional (storage adalah
singleton per-proses), tapi ini dead code + pola tidak konsisten
(`bookings.service.ts` sendiri sudah benar: instansiasi sekali di
constructor, reuse `this.holdsAdapter`).

### 7. `createSeatHoldsForBooking()`: holdRef deterministik + N update sekuensial
`booking.helpers.ts:350-381`. `holdRef` dibentuk sebagai
`` `app-hold:${bookingId}:${seatNo}` `` (bukan UUID random) — kalau ada
retry request (mis. network retry di App) sebelum tx sebelumnya commit,
ini bergantung penuh pada constraint unique `seat_holds.hold_ref` di DB
untuk gagal-aman; perlu dikonfirmasi constraint itu benar ada. Selain itu,
loop `for (const seatNo of seatNos) await tx.update(...)` melakukan N
round-trip DB per kursi, padahal pola bulk (`inArray`) sudah dipakai
konsisten di tempat lain (lih. komentar eksplisit di `insertPassengerRows`
soal ini).

### 8. Idempotency-race recovery cocokkan nama constraint sebagai string
`bookings.service.ts:284-286` — `dbErr.constraint === 'uniq_bookings_idempotency_key'`.
Kalau migration masa depan mengganti nama constraint ini, recovery
graceful (return booking existing) diam-diam gagal dan jatuh ke error 500
generik alih-alih idempotent-return yang dimaksud.

### 9. Progress bar hold TTL di SeatMap hardcode 300 detik
`client/src/components/cso/SeatMap.tsx:633`:
`width: (minTTL / 300) * 100 + '%'`. CSO memang selalu `createHold(...,
300)` (short TTL) di file yang sama saat ini, jadi konsisten — tapi kalau
suatu saat CSO butuh hold 'long' (1800 dtk) di alur yang sama, progress
bar ini diam-diam salah hitung (bisa >100%).

### 10. Perlu dicek lebih lanjut (belum sempat ditelusuri tuntas)
Apakah alur confirm booking App (setelah `checkSeatsAvailable`) benar-benar
re-lock & re-verify kepemilikan `seat_holds` di bawah transaksi yang sama
seperti `confirmSeatsBooked()` (CSO path) lakukan — kalau tidak, ini
memperbesar dampak temuan #1 di atas dari sekadar false-conflict jadi
potensi race nyata.

---

## 🔵 KETIDAKSESUAIAN STRUKTUR DATA

### 11. Tidak ada dimensi kelas-kursi dalam tarif
`booking.helpers.ts:404` — `subtotal = fareQuote.total * passengerCount`:
SEMUA penumpang dalam satu booking dikenakan tarif OD yang identik,
apapun nomor kursinya. Bukan bug terhadap requirement saat ini, tapi
model data tidak punya tempat untuk tarif berbeda per kelas kursi (VIP vs
Reguler) dalam SATU trip yang sama — satu-satunya jalan keluar sekarang
adalah bikin pattern/price rule terpisah untuk itu.

### 12. `InventorySnapshot` — lihat temuan #5 di atas (dobel kategori: bug dorman + data-shape mismatch).

---

## 🟢 UX/UI — hanya yang benar-benar terverifikasi dari kode

Waktu tidak cukup untuk review menyeluruh `CsoPage.tsx` (1398 baris),
`SeatMap.tsx`, `PassengerForm.tsx`, `TripSelector.tsx` (total >3600
baris) baris-per-baris. Yang sempat diverifikasi:

- **Sudah bagus, jangan diubah**: countdown hold TTL di SeatMap SUDAH ada
  dan sudah dirender (per-kursi + minimum keseluruhan, dengan progress
  bar) — sempat dicurigai tidak ada, ternyata ada setelah dicek langsung.
- Temuan #2 dan #9 di atas keduanya juga berdampak UX (pesan error kursi
  duplikat; progress bar berpotensi salah render).
- Disarankan follow-up terpisah (di luar sisa waktu sesi ini) untuk audit
  UX menyeluruh `PassengerForm.tsx`/`TripSelector.tsx`/`PassengerDetailModal.tsx`
  yang belum sempat dibuka sama sekali.

---

## Ringkasan prioritas

1. **#3 (round-trip bypass engine)** — perbaiki SEBELUM `RESERVATION_ENGINE_ENABLED=true` pernah dinyalakan untuk round-trip di produksi manapun.
2. **#1 (checkSeatsAvailable stale-hold)** — quick fix, langsung mengurangi keluhan "kursi habis padahal kosong" di App.
3. **#4, #5** — sudah diketahui sebelumnya, dikonfirmasi ulang masih terbuka.
4. Sisanya (#2, #6-#9, #11) — kualitas/maintainability, tidak urgent tapi murah untuk dibereskan sekalian.
