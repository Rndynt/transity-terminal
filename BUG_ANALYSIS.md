# Bug Analysis & Fix Report - TransityTerminal

**Analysis Date:** 2026-02-22
**Status:** ALL BUGS FIXED

---

## RINGKASAN PERBAIKAN

### Bug Kritis (KRITIS) - SEMUA DIPERBAIKI
| ID | Masalah | Status | Keterangan |
|----|---------|--------|------------|
| KRITIS-001 | Timezone conversion salah | FIXED | `fromZonedHHMMToUtc` sekarang mengembalikan null untuk input invalid |
| KRITIS-002 | Format waktu tidak konsisten | FIXED | Semua waktu menggunakan format ISO "HH:MM" dengan colon |
| KRITIS-003 | Duplikasi trip (virtual + manual) | FIXED | Seeder tidak lagi membuat trip manual |
| KRITIS-004 | Tampilan waktu di UI salah | FIXED | TripScheduleEditor menggunakan `utcToLocalDatetime()` untuk konversi ke Asia/Jakarta |
| KRITIS-005 | Form schedule menampilkan UTC bukan WIB | FIXED | Ditambahkan fungsi `utcToLocalDatetime()`, `formatTimeWIB()`, `formatDateTimeWIB()` |

### Bug Major - SEMUA DIPERBAIKI
| ID | Masalah | Status | Keterangan |
|----|---------|--------|------------|
| MAJOR-001 | `getDayInTZ` bisa salah di DST edge | FIXED | Menggunakan jam 12:00 untuk menghindari DST edge cases |
| MAJOR-002 | Tidak ada validasi format waktu | FIXED | `normalizeTimeFormat()` menangani format berbeda |
| MAJOR-003 | `computeDefaultTimestamps` error pada format salah | FIXED | Menggunakan normalisasi waktu |
| MAJOR-004 | `originDepartHHMM` tidak diisi untuk trip manual | FIXED | Trip manual tidak dibuat lagi |
| MAJOR-005 | Seeder membuat trip manual yang duplikat | FIXED | Seeder hanya membuat trip bases |

### Bug Minor - SEMUA DIPERBAIKI
| ID | Masalah | Status | Keterangan |
|----|---------|--------|------------|
| MINOR-001 | Date range trip base salah (2025) | FIXED | Menggunakan tahun berjalan (2026) |
| MINOR-002 | Format waktu "08.30" dengan titik | FIXED | Semua menggunakan colon "08:30" |
| MINOR-003 | Empty string untuk waktu | FIXED | Dikonversi ke null dengan benar |

---

## TESTING RESULTS

### Test 1: Virtual Trip Availability
```
Input: 3 Trip Bases dengan waktu berbeda
Expected: 3 virtual trips muncul di CSO
Result: 3 virtual trips muncul dengan waktu benar
Status: PASSED
```

### Test 2: Timezone Conversion
```
Input: "08:00" Asia/Jakarta on 2026-02-22
Expected UTC: 2026-02-22T01:00:00.000Z
Result: 2026-02-22T01:00:00.000Z
Status: PASSED

Input: "14:00" Asia/Jakarta on 2026-02-22
Expected UTC: 2026-02-22T07:00:00.000Z
Result: 2026-02-22T07:00:00.000Z
Status: PASSED

Input: "07:00" Asia/Jakarta on 2026-02-22
Expected UTC: 2026-02-22T00:00:00.000Z
Result: 2026-02-22T00:00:00.000Z
Status: PASSED
```

### Test 3: Trip Materialization
```
Action: Materialize trip from base JKT-BDG-08:00
Expected:
  - Trip record created with originDepartHHMM="08:00"
  - Trip stop times created with correct UTC times
  - JKT: depart 01:00 UTC = 08:00 WIB
  - PWK: arrive 02:00, depart 02:05 UTC = 09:00-09:05 WIB
  - BDG: arrive 03:00 UTC = 10:00 WIB
Result: ALL PASSED
Status: PASSED
```

### Test 4: Deduplication
```
Before: Virtual trip + manual trip dengan waktu sama = duplikat
After: Hanya virtual trips (tanpa duplikat)
Result: 3 virtual trips, 0 duplicates
Status: PASSED
```

---

## DATA MASTER FLOW (ALUR PEMBUATAN DATA)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ALUR PEMBUATAN DATA MASTER                        │
└─────────────────────────────────────────────────────────────────────────┘

1. STOPS (Lokasi/Titik Pemberhentian)
   └─► isOutlet: true → Bisa membuat OUTLET
   
2. OUTLETS (Tempat Penjualan Tiket)
   └─► Terhubung ke STOP dengan stopId
   
3. LAYOUTS (Konfigurasi Kursi)
   └─► seatMap: Array posisi kursi
   
4. VEHICLES (Kendaraan)
   └─► Terhubung ke LAYOUT dengan layoutId
   └─► capacity: Jumlah kursi
   
5. TRIP PATTERNS (Pola Rute)
   └─► defaultLayoutId: Layout default
   └─► PATTERN STOPS: Urutan stop dengan:
       ├─ stopSequence: Urutan
       ├─ boardingAllowed: Bisa naik?
       └─ alightingAllowed: Bisa turun?
   
6. TRIP BASES (Template Virtual Scheduling)
   └─► patternId: Pola rute
   └─► defaultVehicleId: Kendaraan default
   └─► defaultLayoutId: Layout default
   └─► DOW (mon-sun): Hari operasi
   └─► validFrom/validTo: Periode berlaku
   └─► defaultStopTimes: Waktu per stop
       └─► format: "HH:MM" (local time)
   
7. TRIPS (Perjalanan Aktual)
   └─► Dibuat manual ATAU dari TRIP BASE
   └─► TRIP STOP TIMES: Waktu aktual per stop
   └─► TRIP LEGS: Segment antar stop
   └─► SEAT INVENTORY: Ketersediaan kursi per leg
   
8. BOOKINGS (Pemesanan)
   └─► PASSANGERS: Data penumpang
   └─► PAYMENTS: Pembayaran
   └─► PRINT JOBS: Antrian cetak tiket

┌─────────────────────────────────────────────────────────────────────────┐
│                     VIRTUAL SCHEDULING FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

1. CSO memilih tanggal → Sistem query TRIP BASES yang eligible:
   ├─ active = true
   ├─ DOW cocok dengan hari di tanggal
   └─ validFrom <= tanggal <= validTo

2. Virtual Trip muncul di UI dengan badge "Virtual"

3. CSO memilih virtual trip → Sistem materialize:
   ├─ Buat record TRIPS baru
   ├─ Buat TRIP STOP TIMES dari defaultStopTimes
   ├─ Derive TRIP LEGS
   ├─ Precompute SEAT INVENTORY
   └─ Emit WebSocket event TRIP_MATERIALIZED

4. Virtual trip berubah menjadi Real trip dengan badge "Real"

┌─────────────────────────────────────────────────────────────────────────┐
│                     TIMEZONE HANDLING                                    │
└─────────────────────────────────────────────────────────────────────────┘

Penyimpanan:
├─ defaultStopTimes: "HH:MM" (local time string, tanpa date)
├─ trip_stop_times.arrive_at/depart_at: timestamptz (UTC)
└─ timezone disimpan di TRIP BASE

Konversi:
├─ Input: "10:00" + "Asia/Jakarta" + "2026-02-22"
├─ Process: fromZonedHHMMToUtc()
└─ Output: 2026-02-22 03:00:00 UTC

Display:
├─ Backend mengirim UTC timestamp
├─ Frontend convert ke Asia/Jakarta: toLocaleTimeString('id-ID', {timeZone: 'Asia/Jakarta'})
└─ 03:00 UTC → 10:00 WIB

⚠️ PENTING:
- Indonesia memakai WIB (UTC+7), tidak ada DST
- Pastikan konsisten menggunakan timezone yang sama
- Validasi format waktu HARUS "HH:MM" atau "HH:MM:SS"
