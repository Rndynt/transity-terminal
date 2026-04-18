# TransityConsole Gateway API — Dokumentasi Request & Response

Dokumentasi ini mencatat semua endpoint yang diakses oleh TransityWeb melalui proxy ke TransityConsole (`https://console.transity.web.id`).

Diuji pada: **5 April 2026**

---

## 1. GET /api/gateway/cities

Mengambil daftar kota yang tersedia dari semua operator terdaftar.

**Request:**
```
GET http://localhost:5000/api/gateway/cities
```

**Response:** `200 OK`
```json
{
  "cities": [
    { "city": "Bandung", "stopCount": 4 },
    { "city": "Jakarta", "stopCount": 6 },
    { "city": "Semarang", "stopCount": 2 },
    { "city": "Yogyakarta", "stopCount": 3 }
  ],
  "byOperator": [
    {
      "operatorSlug": "nusa-shuttle",
      "cities": [
        { "city": "Bandung", "stopCount": 4 },
        { "city": "Jakarta", "stopCount": 6 },
        { "city": "Semarang", "stopCount": 2 },
        { "city": "Yogyakarta", "stopCount": 3 }
      ]
    }
  ]
}
```

**Catatan:** Field `cities` berisi array of objects `{city, stopCount}`, bukan array of strings.

---

## 2. GET /api/gateway/trips/search

Mencari perjalanan berdasarkan kota asal, tujuan, dan tanggal.

### 2a. Jakarta → Bandung (5 April 2026) — BERHASIL

**Request:**
```
GET /api/gateway/trips/search?originCity=Jakarta&destinationCity=Bandung&date=2026-04-05
```

**Response:** `200 OK` — 2 trip ditemukan
```json
{
  "trips": [
    {
      "tripId": "nusa-shuttle:virtual-316a4a38-eb22-4ff7-b3c6-87ee4fe40bec",
      "operatorId": "5c472abb-a6e8-45c4-aff8-1aaf92d1299f",
      "operatorName": "Nusa Shuttle",
      "operatorSlug": "nusa-shuttle",
      "operatorLogo": null,
      "operatorColor": "#134E4A",
      "serviceDate": "2026-04-05",
      "origin": {
        "stopId": "7584bc05-7f7b-4e5a-a93b-2fd5acf75259",
        "cityName": "",
        "stopName": "Daan Mogot Grogol",
        "sequence": 1,
        "departureTime": "",
        "arrivalTime": null
      },
      "destination": {
        "stopId": "e2bd6dda-5ef2-4bcb-b74c-d92cb6d37340",
        "cityName": "",
        "stopName": "Buah Batu",
        "sequence": 4,
        "departureTime": null,
        "arrivalTime": ""
      },
      "farePerPerson": 80000,
      "availableSeats": 14,
      "isVirtual": true,
      "vehicleClass": "commuter-14",
      "raw": {
        "tripId": "virtual-316a4a38-eb22-4ff7-b3c6-87ee4fe40bec",
        "serviceDate": "2026-04-05",
        "patternCode": "JKT-BDG-02",
        "patternName": "Jakarta → Bandung · via Grogol — Pasteur — Buah Batu",
        "vehicleClass": "commuter-14",
        "origin": {
          "stopId": "7584bc05-7f7b-4e5a-a93b-2fd5acf75259",
          "name": "Daan Mogot Grogol",
          "code": "GRG",
          "sequence": 1,
          "departAt": "2026-04-05T12:00:00.000Z",
          "arriveAt": null
        },
        "destination": {
          "stopId": "e2bd6dda-5ef2-4bcb-b74c-d92cb6d37340",
          "name": "Buah Batu",
          "code": "BBT",
          "sequence": 4,
          "departAt": null,
          "arriveAt": "2026-04-05T15:10:00.000Z"
        },
        "availableSeats": 14,
        "farePerPerson": 80000,
        "stops": [
          { "stopId": "...", "name": "Daan Mogot Grogol", "code": "GRG", "city": "Jakarta", "sequence": 1, "departAt": "2026-04-05T12:00:00.000Z", "arriveAt": null },
          { "stopId": "...", "name": "Rasuna Said Kuningan", "code": "KNN", "city": "Jakarta", "sequence": 2, "departAt": "2026-04-05T12:35:00.000Z", "arriveAt": "2026-04-05T12:30:00.000Z" },
          { "stopId": "...", "name": "Pasteur", "code": "PST", "city": "Bandung", "sequence": 3, "departAt": "2026-04-05T14:50:00.000Z", "arriveAt": "2026-04-05T14:45:00.000Z" },
          { "stopId": "...", "name": "Buah Batu", "code": "BBT", "city": "Bandung", "sequence": 4, "departAt": null, "arriveAt": "2026-04-05T15:10:00.000Z" }
        ],
        "isVirtual": true
      }
    },
    {
      "tripId": "nusa-shuttle:virtual-5f8e...",
      "operatorName": "Nusa Shuttle",
      "serviceDate": "2026-04-05",
      "origin": { "stopName": "Cempaka Putih", "sequence": 1 },
      "destination": { "stopName": "Dipatiukur", "sequence": 6 },
      "farePerPerson": 85000,
      "availableSeats": 14,
      "isVirtual": true,
      "vehicleClass": "premio-14",
      "raw": {
        "patternCode": "JKT-BDG-01",
        "patternName": "Jakarta → Bandung · via Tebet — Cihampelas — Dipatiukur",
        "stops": [
          { "name": "Cempaka Putih", "code": "CPT", "city": "Jakarta", "sequence": 1 },
          { "name": "MT Haryono Tebet", "code": "TBT", "city": "Jakarta", "sequence": 2 },
          { "name": "Jatiwaringin", "code": "JTW", "city": "Jakarta", "sequence": 3 },
          { "name": "Pasteur", "code": "PST", "city": "Bandung", "sequence": 4 },
          { "name": "Cihampelas", "code": "CHP", "city": "Bandung", "sequence": 5 },
          { "name": "Dipatiukur", "code": "DPU", "city": "Bandung", "sequence": 6 }
        ]
      }
    }
  ],
  "errors": [],
  "totalOperators": 1,
  "respondedOperators": 1
}
```

### 2b. Bandung → Jakarta (5 April 2026) — TIMEOUT

**Request:**
```
GET /api/gateway/trips/search?originCity=Bandung&destinationCity=Jakarta&date=2026-04-05
```

**Response:** `200 OK` — Tapi tidak ada trip karena terminal timeout
```json
{
  "trips": [],
  "errors": [
    {
      "operatorSlug": "nusa-shuttle",
      "error": "The operation was aborted due to timeout"
    }
  ],
  "totalOperators": 1,
  "respondedOperators": 0
}
```

**Masalah:** Console timeout saat memanggil terminal Nusa Shuttle untuk rute Bandung→Jakarta. Rute ini sebenarnya ada (terbukti di tanggal 6 April bisa muncul). Kemungkinan terminal lambat merespons untuk rute ini.

### 2c. Bandung → Jakarta (6 April 2026) — BERHASIL

**Request:**
```
GET /api/gateway/trips/search?originCity=Bandung&destinationCity=Jakarta&date=2026-04-06
```

**Response:** `200 OK` — Trip ditemukan (2 trip Bandung→Jakarta)
```json
{
  "trips": [
    {
      "tripId": "nusa-shuttle:virtual-...",
      "operatorName": "Nusa Shuttle",
      "serviceDate": "2026-04-06",
      "origin": { "stopName": "Buah Batu" },
      "destination": { "stopName": "Daan Mogot Grogol" },
      "farePerPerson": 80000,
      "availableSeats": 14,
      "vehicleClass": "commuter-14",
      "raw": {
        "patternCode": "BDG-JKT-02",
        "patternName": "Bandung → Jakarta · via Buah Batu — Pasteur — Grogol"
      }
    }
  ],
  "errors": [],
  "totalOperators": 1,
  "respondedOperators": 1
}
```

### 2d. Jakarta → Semarang (5 April 2026) — BERHASIL

**Request:**
```
GET /api/gateway/trips/search?originCity=Jakarta&destinationCity=Semarang&date=2026-04-05
```

**Response:** `200 OK` — 1 trip ditemukan
```json
{
  "trips": [
    {
      "tripId": "nusa-shuttle:virtual-4bd385d7-...",
      "operatorName": "Nusa Shuttle",
      "serviceDate": "2026-04-05",
      "origin": { "stopName": "Cempaka Putih", "sequence": 1 },
      "destination": { "stopName": "Majapahit", "sequence": 5 },
      "farePerPerson": 160000,
      "availableSeats": 14,
      "vehicleClass": "premio-14",
      "raw": {
        "patternCode": "JKT-SMG-01",
        "patternName": "Jakarta → Semarang · via Tebet — Karangayu",
        "stops": [
          { "name": "Cempaka Putih", "code": "CPT", "city": "Jakarta", "sequence": 1 },
          { "name": "MT Haryono Tebet", "code": "TBT", "city": "Jakarta", "sequence": 2 },
          { "name": "Jatiwaringin", "code": "JTW", "city": "Jakarta", "sequence": 3 },
          { "name": "Karangayu", "code": "KAY", "city": "Semarang", "sequence": 4 },
          { "name": "Majapahit", "code": "MJP", "city": "Semarang", "sequence": 5 }
        ]
      }
    }
  ],
  "errors": [],
  "totalOperators": 1,
  "respondedOperators": 1
}
```

### 2e. Semarang → Jakarta (5 April 2026) — BERHASIL

**Request:**
```
GET /api/gateway/trips/search?originCity=Semarang&destinationCity=Jakarta&date=2026-04-05
```

**Response:** `200 OK` — Trip ditemukan (rute kebalikan)

### 2f. Bandung → Yogyakarta (5 April 2026) — KOSONG

**Request:**
```
GET /api/gateway/trips/search?originCity=Bandung&destinationCity=Yogyakarta&date=2026-04-05
```

**Response:** `200 OK` — Tidak ada trip (rute tidak tersedia)
```json
{
  "trips": [],
  "errors": [],
  "totalOperators": 1,
  "respondedOperators": 1
}
```

### 2g. Yogyakarta → Jakarta (5 April 2026) — KOSONG

**Request:**
```
GET /api/gateway/trips/search?originCity=Yogyakarta&destinationCity=Jakarta&date=2026-04-05
```

**Response:** `200 OK` — Tidak ada trip
```json
{
  "trips": [],
  "errors": [],
  "totalOperators": 1,
  "respondedOperators": 1
}
```

---

## 3. GET /api/gateway/trips/:tripId

Mengambil detail trip berdasarkan ID.

**Request:**
```
GET /api/gateway/trips/nusa-shuttle:virtual-316a4a38-eb22-4ff7-b3c6-87ee4fe40bec
```

**Response:** `404`
```json
{
  "error": "Trip not found"
}
```

**Catatan:** Trip virtual (isVirtual: true) tidak bisa diakses via endpoint detail. Detail trip sudah termasuk dalam field `raw` di response search.

---

## 4. GET /api/gateway/trips/:tripId/seatmap

Mengambil seatmap untuk trip tertentu.

**Request:**
```
GET /api/gateway/trips/nusa-shuttle:virtual-316a4a38-eb22-4ff7-b3c6-87ee4fe40bec/seatmap?originSeq=1&destinationSeq=4
```

**Response:** `404`
```json
{
  "error": "Seatmap not found (trip may be virtual)"
}
```

**Catatan:** Seatmap tidak tersedia untuk virtual trips.

---

## 5. GET /api/app/auth/me (Terminal — Auth)

Mengambil data user yang sedang login.

**Request:**
```
GET /api/app/auth/me
(tanpa token)
```

**Response:** `401`
```json
{
  "error": "Missing or invalid authorization header"
}
```

---

## 6. GET /api/app/bookings (Terminal — Bookings)

Mengambil daftar booking user.

**Request:**
```
GET /api/app/bookings
(tanpa token)
```

**Response:** `401`
```json
{
  "error": "Missing or invalid authorization header"
}
```

---

## Ringkasan Temuan

### Rute yang Tersedia
| Rute | Status | Harga | Kelas |
|------|--------|-------|-------|
| Jakarta → Bandung | ✅ Tersedia (2 trip) | Rp 80.000 – 85.000 | commuter-14, premio-14 |
| Bandung → Jakarta | ⚠️ Timeout (5 Apr), ✅ (6 Apr) | Rp 80.000 | commuter-14 |
| Jakarta → Semarang | ✅ Tersedia (1 trip) | Rp 160.000 | premio-14 |
| Semarang → Jakarta | ✅ Tersedia | - | - |
| Bandung → Yogyakarta | ❌ Tidak ada rute | - | - |
| Yogyakarta → Jakarta | ❌ Tidak ada rute | - | - |

### Masalah Ditemukan

1. **Timeout Bandung→Jakarta (5 April):** Console timeout saat query ke terminal Nusa Shuttle. Rute ini seharusnya ada (di tanggal lain berhasil). Kemungkinan masalah performa di terminal.

2. **Virtual Trips:** Semua trip berstatus `isVirtual: true`. Trip virtual tidak bisa diakses via endpoint detail (`/trips/:id`) dan tidak punya seatmap. Detail lengkap trip sudah ada di field `raw` pada response search.

3. **Field `cityName` kosong:** Di response search, field `origin.cityName` dan `destination.cityName` selalu kosong (`""`). Nama kota hanya tersedia di `raw.stops[].city`.

4. **Field `departureTime`/`arrivalTime` kosong:** Di response search, field waktu di origin/destination kosong (`""`). Waktu hanya tersedia di `raw.origin.departAt` dan `raw.destination.arriveAt`.

5. **Cities format berubah:** Endpoint `/api/gateway/cities` mengembalikan array of objects `{city, stopCount}` bukan array of strings — sudah diperbaiki di kode TransityWeb.
