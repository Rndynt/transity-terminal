# Bug Analysis & Fix Report - TransityCore

**Analysis Date:** 2026-02-22
**Status:** FIXED

---

## STATUS PERBAIKAN

| Bug ID | Status | Keterangan |
|--------|--------|------------|
| BUG-001 | FIXED | Trip bases date range sekarang menggunakan tahun berjalan (2026-01-01 s/d 2026-12-31) |
| BUG-002 | FIXED | Format waktu menggunakan colon (:) bukan titik (.) |
| BUG-003 | FIXED | Seeder sekarang membuat data yang konsisten dan benar |
| BUG-004 | FIXED | Nilai kosong string dikonversi ke null dengan benar |
| MAJOR-001 | FIXED | fromZonedHHMMToUtc sekarang mengembalikan null untuk waktu invalid |
| MAJOR-002 | FIXED | getDayInTZ menggunakan jam 12:00 untuk menghindari DST edge cases |
| MAJOR-003 | FIXED | Validasi format waktu lebih ketat |
| MAJOR-004 | FIXED | computeDefaultTimestamps menggunakan normalizeTimeFormat() |
| MAJOR-005 | FIXED | Tidak ada error handling untuk invalid time format |

---

## VERIFIKASI

### Test 1: Virtual Trip dari Trip Base
```
Trip Base: JKT-BDG-08:00
Expected: JKT depart 08:00 Jakarta = 01:00 UTC
Result: departAt = 2026-02-22 01:00:00+00
Status: PASSED
```

### Test 2: Real Trip Stop Times
```
JKT: depart 01:00 UTC = 08:00 Jakarta
PWK: arrive 02:00 UTC = 09:00 Jakarta, depart 02:05 UTC = 09:05 Jakarta
BDG: arrive 03:00 UTC = 10:00 Jakarta
Status: PASSED
```

### Test 3: Time Format Normalization
```
Input: "08.30" -> Normalized: "08:30:00"
Input: "08:30" -> Normalized: "08:30:00"
Input: "08,30" -> Normalized: "08:30:00"
Status: PASSED
```

---

## Data Master Flow (ALUR PEMBUATAN DATA)

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
