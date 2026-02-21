# 🐛 Analisis Bug & Masalah TransityCore

**Tanggal Analisis:** 2026-02-22  
**Versi:** Current Development Build

---

## 📋 Ringkasan Eksekutif

Ditemukan **12 masalah** yang terbagi menjadi:
- 🔴 **Kritis**: 4 bug
- 🟠 **Major**: 5 bug  
- 🟡 **Minor**: 3 bug

---

## 🔴 Bug Kritis

### BUG-001: Trip Bases Date Range Tidak Update untuk Tahun 2026

**Lokasi:** `server/seed.ts` line 150-220

**Deskripsi:**  
Semua trip bases dibuat dengan `valid_from: "2025-01-01"` dan `valid_to: "2025-12-31"`, sehingga untuk tahun 2026, 3 dari 4 trip bases sudah **EXPIRED** dan tidak akan muncul di CSO.

**Data Saat Ini:**
```
10:00-SLOT-2 | 2025-01-01 | 2025-12-31 | EXPIRED ❌
13:00-SLOT-1 | 2025-01-01 | 2025-12-31 | EXPIRED ❌
07:00-REG    | 2025-01-01 | 2025-12-31 | EXPIRED ❌
10:00-SLOT-1 | 2025-01-01 | 2026-12-31 | ACTIVE ✅
```

**Dampak:**  
CSO tidak akan melihat trip virtual untuk tanggal 2026 kecuali "10:00-SLOT-1".

**Solusi:**
```typescript
// Ganti di seed.ts
validFrom: "2025-01-01",
validTo: "2027-12-31", // atau dinamis: new Date().getFullYear() + 1
```

---

### BUG-002: Format Waktu Tidak Konsisten (Titik vs Colon)

**Lokasi:** `server/seed.ts` line 212

**Deskripsi:**  
Trip base "07:00-REG" menggunakan format waktu `"08.20"` (titik) bukan `"08:20"` (colon).

**Code Bermasalah:**
```typescript
// seed.ts line 212
{ stopSequence: 2, arriveAt: "08.20", departAt: "08:40" },
//                               ^^^^^ titik seharusnya colon
```

**Dampak:**  
Time parsing akan gagal atau menghasilkan waktu yang salah. Regex validasi di `tripBases.service.ts` hanya menerima format `HH:MM` atau `HH:MM:SS`:
```typescript
if (stopTime.arriveAt && !/^\d{2}:\d{2}(:\d{2})?$/.test(stopTime.arriveAt)) {
  throw new Error(`Invalid arriveAt format: ${stopTime.arriveAt}`);
}
```

**Solusi:**
```typescript
{ stopSequence: 2, arriveAt: "08:20", departAt: "08:40" },
```

---

### BUG-003: Jam Real Trip Tidak Sesuai dengan Trip Base

**Lokasi:** `server/seed.ts` line 140-160

**Deskripsi:**  
User membuat trip base dengan jam 10:00, tapi real trip yang di-seed menggunakan jam 08:30.

**Real Trip (dari seed.ts):**
```typescript
// seed.ts lines 140-160
const jakartaDepartAt = fromZonedHHMMToUtc(today, "08:30", "Asia/Jakarta");
//                                            ^^^^^ seharusnya "10:00"?
```

**Data Database:**
```
Trip ID: b8f5d837-3680-436b-aa54-c60b69e565c5
Jakarta (JKT) depart: 2026-02-21 01:30:00+00 UTC = 08:30 WIB
```

**Trip Base "10:00-SLOT-1":**
```
Jakarta depart: 10:00 WIB (virtual)
```

**Dampak:**  
Kebingungan user - mengapa ada trip jam 08:30 padahal trip base dibuat jam 10:00?

**Solusi:**  
Seeder harus konsisten - jika membuat trip base jam 10:00, maka real trip demo juga sebaiknya jam 10:00, atau buat trip base dengan jam yang berbeda.

---

### BUG-004: Nilai Kosong String ("") pada defaultStopTimes

**Lokasi:** `server/seed.ts` dan Database

**Deskripsi:**  
Trip base "10:00-SLOT-1" memiliki nilai `arriveAt: ""` (string kosong) bukan `null`.

**Data Database:**
```json
{
  "stopSequence": 1,
  "arriveAt": "",      // ❌ Seharusnya null
  "departAt": "10:00"
}
```

**Dampak:**  
- Inkosistensi data
- Potensi bug saat parsing atau validasi
- Bandingkan dengan trip base lain yang menggunakan `null`:

```json
// 10:00-SLOT-2 (BENAR)
{
  "stopSequence": 1,
  "arriveAt": null,    // ✅ Benar
  "departAt": "10:00"
}
```

**Solusi:**
```typescript
// Di TripBasesManager.tsx atau seed.ts
{ stopSequence: 1, arriveAt: null, departAt: "10:00" }
```

---

## 🟠 Bug Major

### BUG-005: Frontend Tidak Menampilkan Informasi Waktu dengan Jelas

**Lokasi:** `client/src/components/cso/TripSelector.tsx`

**Deskripsi:**  
Waktu ditampilkan dalam UTC di API response, tapi frontend menampilkan dengan `toLocaleTimeString` tanpa penjelasan timezone.

**Code:**
```typescript
new Date(trip.departAtAtOutlet).toLocaleTimeString('id-ID', { 
  hour: '2-digit', 
  minute: '2-digit', 
  hour12: false, 
  timeZone: 'Asia/Jakarta' 
})
```

**Masalah:**
- User tidak tahu waktu ditampilkan dalam timezone Jakarta
- Tidak ada label timezone
- Potensi kebingungan jika user di timezone berbeda

**Solusi:**
Tambahkan label timezone di UI:
```jsx
<span className="text-xs text-muted-foreground">WIB</span>
```

---

### BUG-006: Tidak Ada Validasi Overlapping Trip Bases

**Lokasi:** `server/modules/tripBases/tripBases.service.ts`

**Deskripsi:**  
Sistem memungkinkan pembuatan trip bases dengan waktu yang sama untuk pattern yang sama, yang dapat menyebabkan duplikasi virtual trip.

**Contoh:**
```
10:00-SLOT-1 | Pattern AB_via_C | 10:00 WIB
10:00-SLOT-2 | Pattern AB_via_C | 10:00 WIB
```

**Dampak:**  
- Dua virtual trip dengan waktu sama muncul di CSO
- Kebingungan operator
- Potensi double booking

**Solusi:**
Tambahkan validasi uniqueness untuk (patternId, originDepartTime) atau warning di UI.

---

### BUG-007: Origin Depart Time Tidak Disimpan di Real Trip

**Lokasi:** `server/storage.ts` dan `server/modules/tripBases/tripBases.service.ts`

**Deskripsi:**  
Field `originDepartHHMM` di trips table tidak diisi dengan benar saat materialisasi trip.

**Data:**
```
Trip ID: b8f5d837... | origin_depart_hhmm: (empty)
```

**Dampak:**  
- Sorting trip berdasarkan waktu keberangkatan tidak akurat
- Laporan dan analisis tidak bisa menggunakan field ini

**Solusi:**
Di `tripBases.service.ts`:
```typescript
const originDepartHHMM = firstStopTime?.departAt ? 
  formatTimeInTZ(firstStopTime.departAt, timezone) : null;
// Pastikan nilai ini disimpan saat createTrip
```

---

### BUG-008: Seed Data Tidak Membersihkan Data Lama

**Lokasi:** `server/seed.ts`

**Deskripsi:**  
Seeder tidak melakukan cleanup data lama sebelum insert, menyebabkan duplikasi atau inkonsistensi saat re-seed.

**Dampak:**
- Data ganda setiap kali `POST /api/seed` dipanggil
- Foreign key constraint violation potensial
- Data test tidak clean

**Solusi:**
```typescript
export async function seedData() {
  // Cleanup existing data in reverse dependency order
  await db.delete(bookings);
  await db.delete(passengers);
  await db.delete(payments);
  await db.delete(printJobs);
  await db.delete(seatHolds);
  await db.delete(seatInventory);
  await db.delete(tripLegs);
  await db.delete(tripStopTimes);
  await db.delete(trips);
  await db.delete(priceRules);
  await db.delete(tripBases);
  await db.delete(patternStops);
  await db.delete(tripPatterns);
  await db.delete(vehicles);
  await db.delete(layouts);
  await db.delete(outlets);
  await db.delete(stops);
  
  console.log("✅ Old data cleaned");
  // ... rest of seed
}
```

---

### BUG-009: Pickup-Only Stop Tidak Ditandai di UI

**Lokasi:** `client/src/components/cso/RouteTimeline.tsx`

**Deskripsi:**  
Stop dengan `alightingAllowed: false` (pickup-only) tidak ditandai secara visual di timeline.

**Contoh:**  
Purwakarta adalah pickup-only stop (hanya bisa naik, tidak bisa turun), tapi user tidak diberitahu.

**Dampak:**
- User mungkin memilih Purwakarta sebagai destination
- Error saat booking dengan pesan tidak jelas

**Solusi:**
Tambahkan visual indicator:
```jsx
{!stop.alightingAllowed && (
  <Badge variant="outline" className="text-xs">
    Pickup Only
  </Badge>
)}
```

---

## 🟡 Bug Minor

### BUG-010: Log Debug Masih Aktif di Production Code

**Lokasi:** `server/storage.ts`

**Deskripsi:**  
Console.log debug statements masih ada di kode production.

**Contoh:**
```typescript
console.log(`[DEBUG] Getting pattern path for patternId: ${patternId}`);
console.log(`[DEBUG] Pattern path query result:`, result.rows);
console.log(`[DEBUG] Returning pattern path: ${patternPath}`);
```

**Solusi:**
- Hapus atau gunakan proper logging library
- Gunakan `log()` function dari `./vite.ts`

---

### BUG-011: Tidak Ada Loading State di Beberapa Komponen

**Lokasi:** Multiple components

**Deskripsi:**  
Beberapa komponen tidak memiliki loading state yang proper.

**Contoh:**  
TripBasesManager tidak menampilkan loading saat mutation sedang berjalan.

---

### BUG-012: Validasi Input Time Format Kurang Ketat

**Lokasi:** `server/modules/tripBases/tripBases.service.ts`

**Deskripsi:**  
Validasi format waktu hanya memvalidasi regex, tidak memvalidasi nilai waktu yang valid (misal 25:00 akan lolos regex).

**Solusi:**
```typescript
function validateTimeFormat(time: string): boolean {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return false;
  const [h, m, s] = time.split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60 && (s === undefined || (s >= 0 && s < 60));
}
```

---

## 📊 Diagram Alur Data Master

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
