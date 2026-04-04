# TransityTerminal — Public API (Service Key)

Dokumentasi ini ditujukan untuk **pengembang third-party** yang mengintegrasikan sistem mereka dengan TransityTerminal via `X-Service-Key`. Ini adalah satu-satunya bagian API yang tersedia untuk konsumsi eksternal tanpa Realmio session.

---

## Daftar Isi

- [Ringkasan](#ringkasan)
- [Autentikasi](#autentikasi)
- [Base URL](#base-url)
- [Format Error](#format-error)
- [Endpoint Referensi (Read-only)](#endpoint-referensi-read-only)
  - [GET /api/app/operator-info](#get-apiappoperator-info)
  - [GET /api/app/cities](#get-apiappcities)
  - [GET /api/app/service-lines](#get-apiappservice-lines)
- [Pencarian Trip](#pencarian-trip)
  - [GET /api/app/trips/search](#get-apiapptripssearch)
  - [GET /api/app/trips/:id](#get-apiapptripsid)
  - [GET /api/app/trips/:id/seatmap](#get-apiapptripsidseatmap)
  - [GET /api/app/trips/:tripId/reviews](#get-apiapptripstripidreviews)
- [Pembuatan Booking](#pembuatan-booking)
  - [POST /api/app/bookings](#post-apiappbookings)
- [Kargo](#kargo)
  - [GET /api/app/cargo/track/:waybillNumber](#get-apiappcargotracknomor-waybill)
  - [GET /api/app/cargo/:waybillNumber](#get-apiappcargonomor-waybill)
- [Payment Webhook](#payment-webhook)
  - [POST /api/app/payments/webhook](#post-apiapppaymentwebhook)
- [Alur Booking Lengkap (Tutorial)](#alur-booking-lengkap-tutorial)
- [Kode Error Referensi](#kode-error-referensi)
- [Catatan Integrasi](#catatan-integrasi)

---

## Ringkasan

Public API TransityTerminal memungkinkan sistem eksternal (platform agregator tiket, website operator, aplikasi pihak ketiga) untuk:

- Mencari jadwal dan ketersediaan kursi
- Membuat booking atas nama penumpang
- Melacak pengiriman kargo
- Menerima notifikasi status pembayaran via webhook

Semua endpoint berada di jalur `/api/app/*` dan tidak memerlukan login Realmio.

---

## Autentikasi

### Service Key

Setiap request harus menyertakan header:

```http
X-Service-Key: <service-key-anda>
```

Service key diperoleh dari admin terminal setelah pendaftaran sebagai mitra integrasi. Key disimpan di `TERMINAL_SERVICE_KEY` pada environment terminal.

### Aturan Service Key

| Kondisi | Hasil |
|---------|-------|
| Header `X-Service-Key` tidak ada | `401 Unauthorized` |
| Header `X-Service-Key` ada tapi salah | `401 Unauthorized` |
| Header `X-Service-Key` benar | Request diproses |

### Contoh Request dengan Service Key

```http
GET /api/app/trips/search?originCity=Jakarta&destinationCity=Bandung&date=2026-04-10
Host: terminal.perusahaan.id
X-Service-Key: sk_live_abcdefghijklmnop1234567890
```

---

## Base URL

```
https://<subdomain-terminal>.transity.web.id
```

Contoh:
```
https://busmania.transity.web.id
```

Semua tanggal menggunakan format **ISO 8601** (`YYYY-MM-DD`).  
Semua waktu menggunakan **ISO 8601 UTC** (`2026-04-10T08:00:00.000Z`).  
Semua harga dalam satuan **Rupiah (IDR)** sebagai bilangan bulat atau string numerik.

---

## Format Error

Semua error mengembalikan JSON dengan format konsisten:

```json
{
  "error": "Pesan error yang dapat dibaca",
  "code": "ERROR_CODE_OPSIONAL",
  "details": { }
}
```

Error validasi Zod menyertakan field `details`:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "date": ["Invalid date format. Use YYYY-MM-DD"],
      "originCity": ["Required"]
    },
    "formErrors": []
  }
}
```

---

## Endpoint Referensi (Read-only)

### `GET /api/app/operator-info`

Informasi identitas operator terminal — nama brand, logo, warna, tagline. Digunakan untuk white-label atau display di aplikasi mitra.

**Auth:** `X-Service-Key`

**Request:**
```http
GET /api/app/operator-info
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
{
  "tenantId": "busmania",
  "brandName": "Bus Mania Ekspres",
  "tagline": "Aman, Nyaman, Tepat Waktu",
  "logoUrl": "https://cdn.transity.web.id/logos/busmania.png",
  "primaryColor": "#1E40AF",
  "secondaryColor": "#3B82F6",
  "accentColor": "#FBBF24"
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `tenantId` | `string` | Identifier unik tenant dari env `REALMIO_TENANT_ID` |
| `brandName` | `string \| null` | Nama brand operator |
| `tagline` | `string \| null` | Tagline perusahaan |
| `logoUrl` | `string \| null` | URL logo publik |
| `primaryColor` | `string \| null` | Hex warna primer |
| `secondaryColor` | `string \| null` | Hex warna sekunder |
| `accentColor` | `string \| null` | Hex warna aksen |

---

### `GET /api/app/cities`

Daftar kota yang memiliki stop aktif. Digunakan untuk mengisi dropdown asal/tujuan di UI pencarian.

**Auth:** `X-Service-Key`

**Request:**
```http
GET /api/app/cities
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
[
  { "city": "Bandung", "stopCount": 3 },
  { "city": "Bogor", "stopCount": 1 },
  { "city": "Jakarta", "stopCount": 4 },
  { "city": "Purwakarta", "stopCount": 2 }
]
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `city` | `string` | Nama kota |
| `stopCount` | `number` | Jumlah stop aktif di kota ini |

---

### `GET /api/app/service-lines`

Daftar layanan/rute aktif yang disediakan oleh operator shuttle yang menggunakan TransityTerminal. Setiap item mewakili satu **rute layanan** yang dioperasikan (misalnya Jakarta — Bandung Eksekutif, Jakarta — Bandung Bisnis, dll). Gunakan endpoint ini untuk menampilkan pilihan layanan yang tersedia kepada calon penumpang.

**Auth:** `X-Service-Key`

**Request:**
```http
GET /api/app/service-lines
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "JKT-BDG-EKS",
    "name": "Jakarta — Bandung Eksekutif",
    "vehicleClass": "Eksekutif",
    "active": true
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "code": "JKT-BDG-BIS",
    "name": "Jakarta — Bandung Bisnis",
    "vehicleClass": "Bisnis",
    "active": true
  }
]
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `id` | `string (uuid)` | ID layanan/rute (dapat digunakan sebagai filter tambahan di pencarian trip) |
| `code` | `string` | Kode singkat layanan (contoh: `JKT-BDG-EKS`) |
| `name` | `string` | Nama lengkap layanan (contoh: `Jakarta — Bandung Eksekutif`) |
| `vehicleClass` | `string \| null` | Kelas armada: `Eksekutif`, `Bisnis`, `Ekonomi`, dll |
| `active` | `boolean` | `true` = layanan sedang aktif beroperasi |

---

## Pencarian Trip

### `GET /api/app/trips/search`

Cari jadwal perjalanan berdasarkan kota asal, kota tujuan, dan tanggal. Menggabungkan trip nyata (sudah ada di database) dan trip virtual (dari jadwal berkala yang belum dimaterialize).

**Auth:** `X-Service-Key`

**Query Parameters:**

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `originCity` | `string` | ✅ | Nama kota asal (harus sesuai data di `/api/app/cities`) |
| `destinationCity` | `string` | ✅ | Nama kota tujuan |
| `date` | `string` | ✅ | Tanggal perjalanan format `YYYY-MM-DD` |
| `passengers` | `integer ≥ 1` | ❌ | Jumlah penumpang (default: 1, belum difilter ketersediaan) |
| `page` | `integer ≥ 1` | ❌ | Nomor halaman (default: 1) |
| `limit` | `integer 1-50` | ❌ | Jumlah hasil per halaman (default: 20, maks: 50) |

**Request:**
```http
GET /api/app/trips/search?originCity=Jakarta&destinationCity=Bandung&date=2026-04-10&passengers=2&page=1&limit=20
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
{
  "data": [
    {
      "tripId": "550e8400-e29b-41d4-a716-446655440000",
      "serviceDate": "2026-04-10",
      "patternCode": "JKT-BDG-EKS",
      "patternName": "Jakarta — Bandung Eksekutif",
      "vehicleCode": "BUS-001",
      "vehicleClass": "Eksekutif",
      "operatorName": "Jakarta — Bandung Eksekutif",
      "operatorLogo": null,
      "origin": {
        "stopId": "550e8400-e29b-41d4-a716-111111111111",
        "name": "Terminal Kampung Rambutan",
        "code": "KR",
        "sequence": 1,
        "departAt": "2026-04-10T03:00:00.000Z",
        "arriveAt": null
      },
      "destination": {
        "stopId": "550e8400-e29b-41d4-a716-222222222222",
        "name": "Terminal Leuwipanjang",
        "code": "LWP",
        "sequence": 3,
        "departAt": null,
        "arriveAt": "2026-04-10T07:00:00.000Z"
      },
      "availableSeats": 25,
      "farePerPerson": 85000,
      "stops": [
        {
          "stopId": "550e8400-e29b-41d4-a716-111111111111",
          "name": "Terminal Kampung Rambutan",
          "code": "KR",
          "city": "Jakarta",
          "sequence": 1,
          "departAt": "2026-04-10T03:00:00.000Z",
          "arriveAt": null
        },
        {
          "stopId": "550e8400-e29b-41d4-a716-333333333333",
          "name": "Terminal Purwakarta",
          "code": "PWK",
          "city": "Purwakarta",
          "sequence": 2,
          "departAt": "2026-04-10T04:30:00.000Z",
          "arriveAt": "2026-04-10T04:25:00.000Z"
        },
        {
          "stopId": "550e8400-e29b-41d4-a716-222222222222",
          "name": "Terminal Leuwipanjang",
          "code": "LWP",
          "city": "Bandung",
          "sequence": 3,
          "departAt": null,
          "arriveAt": "2026-04-10T07:00:00.000Z"
        }
      ],
      "isVirtual": false
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

**Penjelasan Field Response:**

| Field | Tipe | Keterangan |
|-------|------|------------|
| `tripId` | `string` | UUID trip nyata, atau `"virtual-<baseId>"` untuk trip virtual |
| `serviceDate` | `string` | Tanggal layanan format `YYYY-MM-DD` |
| `patternCode` | `string` | Kode rute |
| `patternName` | `string` | Nama rute |
| `vehicleCode` | `string \| null` | Kode kendaraan (null untuk trip virtual) |
| `vehicleClass` | `string \| null` | Kelas kendaraan |
| `operatorName` | `string` | Nama operator/layanan |
| `origin.stopId` | `string (uuid)` | ID stop asal |
| `origin.name` | `string` | Nama stop asal |
| `origin.code` | `string` | Kode stop asal |
| `origin.sequence` | `integer` | Nomor urut stop di rute (`originSeq` untuk booking) |
| `origin.departAt` | `string \| null` | Waktu keberangkatan (ISO 8601 UTC) |
| `destination.sequence` | `integer` | Nomor urut stop tujuan (`destinationSeq` untuk booking) |
| `destination.arriveAt` | `string \| null` | Waktu kedatangan (ISO 8601 UTC) |
| `availableSeats` | `integer` | Kursi tersedia untuk segmen ini |
| `farePerPerson` | `integer` | Tarif per penumpang dalam Rupiah |
| `stops` | `array` | Seluruh stop dalam rute (bukan hanya asal-tujuan) |
| `isVirtual` | `boolean` | `true` = trip belum ada di DB, akan dimaterialize saat booking |
| `total` | `integer` | Total hasil (semua halaman) |
| `hasMore` | `boolean` | Masih ada halaman berikutnya |

> **Penting tentang `tripId` virtual:** Trip dengan `tripId` berformat `"virtual-<uuid>"` adalah trip yang dijadwalkan tapi belum diinput ke database. Saat `POST /api/app/bookings` dikirim dengan `tripId` ini, sistem akan otomatis mematerialize trip tersebut. Gunakan nilai `tripId` dari response pencarian **apa adanya** ke request booking.

> **Penting tentang `originSeq` dan `destinationSeq`:** Simpan nilai `origin.sequence` dan `destination.sequence` dari hasil pencarian. Kedua nilai ini **wajib** disertakan saat membuat booking dan mengambil seatmap.

---

### `GET /api/app/trips/:id`

Detail lengkap satu trip termasuk semua stop, status, ketersediaan kursi, dan statistik ulasan.

**Auth:** `X-Service-Key`

**Path Parameter:**
| Parameter | Keterangan |
|-----------|------------|
| `id` | UUID trip atau `virtual-<uuid>` (dari hasil pencarian `tripId`) |

**Query Parameters:**

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `serviceDate` | `string` | ⚠️ | Format `YYYY-MM-DD`. **Wajib jika `id` berformat `virtual-*`** |

**Request:**
```http
GET /api/app/trips/550e8400-e29b-41d4-a716-446655440000
X-Service-Key: sk_live_xxx
```

Untuk trip virtual:
```http
GET /api/app/trips/virtual-550e8400-e29b-41d4-a716-446655440000?serviceDate=2026-04-10
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceDate": "2026-04-10",
  "patternCode": "JKT-BDG-EKS",
  "patternName": "Jakarta — Bandung Eksekutif",
  "vehicleClass": "Eksekutif",
  "operatorName": "Jakarta — Bandung Eksekutif",
  "operatorLogo": null,
  "capacity": 40,
  "status": "scheduled",
  "seatAvailability": {
    "total": 40,
    "sold": 15,
    "available": 25
  },
  "stops": [
    {
      "stopId": "550e8400-e29b-41d4-a716-111111111111",
      "name": "Terminal Kampung Rambutan",
      "code": "KR",
      "city": "Jakarta",
      "sequence": 1,
      "arriveAt": null,
      "departAt": "2026-04-10T03:00:00.000Z",
      "boardingAllowed": true,
      "alightingAllowed": false
    },
    {
      "stopId": "550e8400-e29b-41d4-a716-333333333333",
      "name": "Terminal Purwakarta",
      "code": "PWK",
      "city": "Purwakarta",
      "sequence": 2,
      "arriveAt": "2026-04-10T04:25:00.000Z",
      "departAt": "2026-04-10T04:30:00.000Z",
      "boardingAllowed": true,
      "alightingAllowed": true
    },
    {
      "stopId": "550e8400-e29b-41d4-a716-222222222222",
      "name": "Terminal Leuwipanjang",
      "code": "LWP",
      "city": "Bandung",
      "sequence": 3,
      "arriveAt": "2026-04-10T07:00:00.000Z",
      "departAt": null,
      "boardingAllowed": false,
      "alightingAllowed": true
    }
  ],
  "reviews": {
    "count": 24,
    "avgRating": 4.3
  }
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `status` | `string` | `scheduled` \| `in_progress` \| `closed` \| `cancelled` |
| `capacity` | `integer \| null` | Total kapasitas kendaraan |
| `seatAvailability.total` | `integer` | Total kursi |
| `seatAvailability.sold` | `integer` | Kursi sudah terjual |
| `seatAvailability.available` | `integer` | Kursi tersisa (total - sold) |
| `stops[].boardingAllowed` | `boolean` | Penumpang boleh naik di stop ini |
| `stops[].alightingAllowed` | `boolean` | Penumpang boleh turun di stop ini |
| `reviews.count` | `integer` | Total ulasan |
| `reviews.avgRating` | `number` | Rata-rata rating (1.0 - 5.0) |

**Response `404`:**
```json
{ "error": "Trip not found" }
```

---

### `GET /api/app/trips/:id/seatmap`

Peta kursi untuk segmen perjalanan tertentu (origin stop → destination stop). Menampilkan status setiap kursi: tersedia, ditahan, atau sudah dipesan.

**Auth:** `X-Service-Key`

**Path Parameter:**
| Parameter | Keterangan |
|-----------|------------|
| `id` | UUID trip |

**Query Parameters:**

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `originSeq` | `integer` | ✅ | Nomor urut stop asal (dari `origin.sequence` di hasil pencarian) |
| `destinationSeq` | `integer` | ✅ | Nomor urut stop tujuan (dari `destination.sequence` di hasil pencarian) |

**Request:**
```http
GET /api/app/trips/550e8400-e29b-41d4-a716-446655440000/seatmap?originSeq=1&destinationSeq=3
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
{
  "layout": {
    "rows": 10,
    "cols": 4,
    "seatMap": [
      { "seat_no": "A1", "row": 1, "col": 1, "type": "regular" },
      { "seat_no": "A2", "row": 1, "col": 2, "type": "regular" },
      { "seat_no": "B1", "row": 2, "col": 1, "type": "regular" },
      { "seat_no": "B2", "row": 2, "col": 2, "type": "regular" }
    ]
  },
  "seatAvailability": {
    "A1": { "available": true,  "held": false },
    "A2": { "available": false, "held": false },
    "B1": { "available": false, "held": true  },
    "B2": { "available": true,  "held": false }
  }
}
```

**Penjelasan `seatAvailability`:**

| Kondisi | `available` | `held` | Artinya |
|---------|-------------|--------|---------|
| Kursi kosong | `true` | `false` | Dapat dipesan |
| Sudah dipesan (confirmed) | `false` | `false` | Tidak tersedia |
| Sedang di-hold user lain | `false` | `true` | Mungkin tersedia kembali saat hold expired |

**Penjelasan `layout.seatMap`:**

Setiap item dalam array `seatMap` adalah satu kursi fisik:

| Field | Tipe | Keterangan |
|-------|------|------------|
| `seat_no` | `string` | Nomor kursi (gunakan nilai ini di request booking) |
| `row` | `integer` | Baris kursi dalam bus |
| `col` | `integer` | Kolom kursi dalam bus |
| `type` | `string` | Tipe kursi (`regular`, `priority`, dll) |

**Response `400`:**
```json
{ "error": "originSeq and destinationSeq required" }
```

**Response `404`:**
```json
{ "error": "Trip not found" }
```
atau
```json
{ "error": "Trip has no layout" }
```

---

### `GET /api/app/trips/:tripId/reviews`

Daftar ulasan penumpang untuk trip tertentu.

**Auth:** `X-Service-Key`

**Path Parameter:**
| Parameter | Keterangan |
|-----------|------------|
| `tripId` | UUID trip |

**Request:**
```http
GET /api/app/trips/550e8400-e29b-41d4-a716-446655440000/reviews
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-999999999999",
    "rating": 5,
    "comment": "Pelayanan sangat memuaskan, tepat waktu dan supir ramah.",
    "createdAt": "2026-04-05T14:32:00.000Z",
    "userName": "Budi S.",
    "userAvatar": null
  },
  {
    "id": "550e8400-e29b-41d4-a716-888888888888",
    "rating": 4,
    "comment": "AC sejuk, kursi nyaman. Sedikit terlambat 15 menit.",
    "createdAt": "2026-04-03T09:15:00.000Z",
    "userName": "Siti R.",
    "userAvatar": "https://cdn.transity.web.id/avatars/abc.jpg"
  }
]
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `id` | `string (uuid)` | ID ulasan |
| `rating` | `integer 1-5` | Rating bintang |
| `comment` | `string \| null` | Komentar teks |
| `createdAt` | `string (ISO 8601)` | Waktu ulasan dibuat |
| `userName` | `string` | Nama display pengguna |
| `userAvatar` | `string \| null` | URL foto profil |

---

## Pembuatan Booking

### `POST /api/app/bookings`

Membuat booking perjalanan. Endpoint ini dapat diakses dengan **Service Key** (untuk sistem eksternal) atau **JWT Bearer token** (untuk pengguna mobile). Jika menggunakan Service Key, booking akan dibuat tanpa `userId` (anonim dari sisi platform).

**Auth:** `X-Service-Key` ATAU `Authorization: Bearer <jwt-token>`

**Mekanisme Keamanan Kursi:**

Setelah booking dibuat:
1. Kursi langsung di-hold selama **15 menit** (`holdExpiresAt`)
2. Sistem membuat payment intent dengan `providerRef` unik
3. Jika payment tidak terkonfirmasi dalam 15 menit, hold otomatis expired dan kursi dilepas kembali
4. Konfirmasi pembayaran masuk via [Payment Webhook](#post-apiapppaymentwebhook)

**Request Body:**

```json
{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceDate": "2026-04-10",
  "originStopId": "550e8400-e29b-41d4-a716-111111111111",
  "destinationStopId": "550e8400-e29b-41d4-a716-222222222222",
  "originSeq": 1,
  "destinationSeq": 3,
  "passengers": [
    {
      "fullName": "Budi Santoso",
      "phone": "081234567890",
      "idNumber": "3201010101010001",
      "seatNo": "A1"
    },
    {
      "fullName": "Siti Rahayu",
      "phone": "089987654321",
      "idNumber": "3201010101010002",
      "seatNo": "A2"
    }
  ],
  "paymentMethod": "qr"
}
```

> **Catatan `serviceDate`:** Field ini **wajib** jika `tripId` berformat `virtual-<uuid>`. Sistem akan otomatis mematerialize trip untuk tanggal tersebut sebelum memproses booking. Untuk trip biasa (UUID standar), field ini opsional.

**Skema Validasi Request Body:**

| Field | Tipe | Wajib | Validasi |
|-------|------|-------|---------|
| `tripId` | `string` | ✅ | UUID valid atau `virtual-<uuid>` dari hasil pencarian |
| `serviceDate` | `string` | ⚠️ | Tanggal layanan format `YYYY-MM-DD`. **Wajib jika `tripId` berformat `virtual-*`** |
| `originStopId` | `string` | ✅ | UUID valid — ID stop asal |
| `destinationStopId` | `string` | ✅ | UUID valid — ID stop tujuan |
| `originSeq` | `integer` | ✅ | `≥ 1` — Nomor urut stop asal |
| `destinationSeq` | `integer` | ✅ | `≥ 2` — Nomor urut stop tujuan (harus > originSeq) |
| `passengers` | `array` | ✅ | Minimal 1 elemen |
| `passengers[].fullName` | `string` | ✅ | Minimal 1 karakter |
| `passengers[].phone` | `string` | ❌ | Nomor telepon penumpang |
| `passengers[].idNumber` | `string` | ❌ | NIK / nomor identitas |
| `passengers[].seatNo` | `string` | ✅ | Minimal 1 karakter — harus sesuai `seat_no` dari seatmap |
| `paymentMethod` | `string` | ✅ | Hanya: `"qr"` \| `"ewallet"` \| `"bank"` |

**Response `201` (Booking Berhasil Dibuat):**

```json
{
  "id": "booking-uuid-123",
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceDate": "2026-04-10",
  "patternCode": "JKT-BDG-EKS",
  "patternName": "Jakarta — Bandung Eksekutif",
  "origin": {
    "stopId": "550e8400-e29b-41d4-a716-111111111111",
    "name": "Terminal Kampung Rambutan",
    "code": "KR",
    "city": "Jakarta"
  },
  "destination": {
    "stopId": "550e8400-e29b-41d4-a716-222222222222",
    "name": "Terminal Leuwipanjang",
    "code": "LWP",
    "city": "Bandung"
  },
  "departAt": "2026-04-10T03:00:00.000Z",
  "arriveAt": "2026-04-10T07:00:00.000Z",
  "status": "pending",
  "totalAmount": "170000",
  "channel": "APP",
  "holdExpiresAt": "2026-04-10T00:15:00.000Z",
  "passengers": [
    {
      "id": "pax-uuid-1",
      "fullName": "Budi Santoso",
      "phone": "081234567890",
      "seatNo": "A1",
      "fareAmount": "85000"
    },
    {
      "id": "pax-uuid-2",
      "fullName": "Siti Rahayu",
      "phone": "089987654321",
      "seatNo": "A2",
      "fareAmount": "85000"
    }
  ],
  "qrData": [
    {
      "passengerId": "pax-uuid-1",
      "seatNo": "A1",
      "fullName": "Budi Santoso",
      "qrToken": "TRN-K-00000123-A1",
      "qrPayload": "{\"bookingId\":\"booking-uuid-123\",\"passengerId\":\"pax-uuid-1\",\"seatNo\":\"A1\",\"tripId\":\"550e8400-e29b-41d4-a716-446655440000\",\"serviceDate\":\"2026-04-10\"}"
    },
    {
      "passengerId": "pax-uuid-2",
      "seatNo": "A2",
      "fullName": "Siti Rahayu",
      "qrToken": "TRN-K-00000123-A2",
      "qrPayload": "{\"bookingId\":\"booking-uuid-123\",\"passengerId\":\"pax-uuid-2\",\"seatNo\":\"A2\",\"tripId\":\"550e8400-e29b-41d4-a716-446655440000\",\"serviceDate\":\"2026-04-10\"}"
    }
  ],
  "payments": [
    {
      "id": "payment-uuid-1",
      "method": "qr",
      "amount": "170000",
      "status": "pending",
      "paidAt": null
    }
  ],
  "paymentIntent": {
    "paymentId": "payment-uuid-1",
    "method": "qr",
    "amount": "170000",
    "status": "pending",
    "providerRef": "PAY-ABC123DEF456GHI7",
    "expiresAt": "2026-04-10T00:15:00.000Z"
  },
  "createdAt": "2026-04-10T00:00:00.000Z"
}
```

**Penjelasan Field Response Booking:**

| Field | Tipe | Keterangan |
|-------|------|------------|
| `id` | `string (uuid)` | ID booking — simpan ini untuk referensi berikutnya |
| `status` | `string` | `pending` = menunggu pembayaran |
| `totalAmount` | `string` | Total tarif semua penumpang (string numerik, dalam Rupiah) |
| `holdExpiresAt` | `string (ISO 8601)` | Batas waktu pembayaran — kursi dilepas jika terlewat |
| `qrData[].qrToken` | `string` | Kode QR pendek untuk validasi di loket |
| `qrData[].qrPayload` | `string` | JSON string untuk generate QR code gambar |
| `paymentIntent.providerRef` | `string` | Referensi unik (`PAY-XXXX`) — gunakan ini untuk notifikasi payment gateway |
| `payments[].status` | `string` | `pending` \| `success` \| `failed` |

**Response `400` — Kursi sudah dipesan:**
```json
{ "error": "Seat A1 is already booked" }
```

**Response `400` — Kursi sedang di-hold:**
```json
{ "error": "Seat A1 is currently held by another user" }
```

**Response `400` — Trip tidak valid atau virtual gagal dimaterialize:**
```json
{ "error": "Trip not found" }
```

**Response `401` — Tanpa auth:**
```json
{ "error": "Unauthorized" }
```

---

## Kargo

### `GET /api/app/cargo/track/:waybillNumber`

Lacak status pengiriman kargo berdasarkan nomor waybill.

**Auth:** `X-Service-Key`

**Path Parameter:**
| Parameter | Keterangan |
|-----------|------------|
| `waybillNumber` | Nomor waybill kargo (format: `TRN-YYYYMMDD-XXXXX`) |

**Request:**
```http
GET /api/app/cargo/track/TRN-20260410-00023
X-Service-Key: sk_live_xxx
```

**Response `200`:**
```json
{
  "waybillNumber": "TRN-20260410-00023",
  "status": "in_transit",
  "origin": {
    "name": "Terminal Kampung Rambutan",
    "code": "KR",
    "city": "Jakarta"
  },
  "destination": {
    "name": "Terminal Leuwipanjang",
    "code": "LWP",
    "city": "Bandung"
  },
  "serviceDate": "2026-04-10",
  "patternName": "Jakarta — Bandung Eksekutif",
  "senderName": "PT Maju Mundur",
  "recipientName": "Agus Hermawan",
  "itemDescription": "Komponen elektronik",
  "weightKg": "5.50",
  "totalAmount": "82500",
  "createdAt": "2026-04-10T01:00:00.000Z"
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `waybillNumber` | `string` | Nomor resi pengiriman |
| `status` | `string` | Status: `pending` \| `in_transit` \| `delivered` \| `returned` |
| `origin` | `object \| null` | Stop asal pengiriman |
| `destination` | `object \| null` | Stop tujuan pengiriman |
| `serviceDate` | `string \| null` | Tanggal keberangkatan bus |
| `patternName` | `string \| null` | Nama rute bus |
| `senderName` | `string` | Nama pengirim |
| `recipientName` | `string` | Nama penerima |
| `itemDescription` | `string \| null` | Deskripsi barang |
| `weightKg` | `string \| null` | Berat dalam kg (string numerik) |
| `totalAmount` | `string \| null` | Total biaya pengiriman dalam Rupiah |

**Response `404`:**
```json
{ "error": "Shipment not found" }
```

---

### `GET /api/app/cargo/:waybillNumber`

Alias dari `/api/app/cargo/track/:waybillNumber`. Response identik.

**Auth:** `X-Service-Key`

```http
GET /api/app/cargo/TRN-20260410-00023
X-Service-Key: sk_live_xxx
```

---

## Payment Webhook

### `POST /api/app/payments/webhook`

Endpoint ini dipanggil oleh **payment gateway** Anda saat status pembayaran berubah. Tidak menggunakan `X-Service-Key` — menggunakan **HMAC-SHA256 signature** untuk verifikasi integritas.

**Auth:** Header `X-Webhook-Signature` berisi HMAC-SHA256 hex dari raw request body.

**Cara Menghitung Signature (sisi payment gateway Anda):**
```
signature = HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, raw_request_body_bytes)
header = X-Webhook-Signature: <hex_string>
```

> **Penting:** Nilai `PAYMENT_WEBHOOK_SECRET` harus sama antara konfigurasi payment gateway dan environment TransityTerminal.

**Request:**
```http
POST /api/app/payments/webhook
Content-Type: application/json
X-Webhook-Signature: a3f5c2b1d4e6789012345678901234567890abcdef1234567890abcdef123456

{
  "providerRef": "PAY-ABC123DEF456GHI7",
  "status": "success"
}
```

**Request Body:**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `providerRef` | `string` | ✅ | Nilai `paymentIntent.providerRef` dari response booking |
| `status` | `string` | ✅ | Hanya: `"success"` atau `"failed"` |

**Response `200` — Pembayaran berhasil:**
```json
{ "status": "success", "bookingId": "booking-uuid-123" }
```

**Response `200` — Pembayaran gagal:**
```json
{ "status": "failed", "bookingId": "booking-uuid-123" }
```

**Efek pada Sistem Saat `status: "success"`:**

1. Payment record diupdate: `status = "success"`, `paidAt = now()`
2. Booking diupdate: `status = "confirmed"`
3. Semua kursi penumpang di-mark `booked = true`
4. Seat holds dihapus

**Efek pada Sistem Saat `status: "failed"`:**

1. Payment record diupdate: `status = "failed"`
2. Booking diupdate: `status = "canceled"`
3. Seat inventory direset: `booked = false`, `holdRef = null`
4. Seat holds dihapus → kursi tersedia kembali untuk penumpang lain

**Response `401` — Signature tidak ada:**
```json
{ "error": "Missing webhook signature" }
```

**Response `401` — Signature tidak valid:**
```json
{ "error": "Invalid webhook signature" }
```

**Response `400` — Payload tidak valid:**
```json
{ "error": "Invalid webhook payload: providerRef and status (success|failed) required" }
```

**Response `400` — providerRef tidak ditemukan:**
```json
{ "error": "Payment not found" }
```

**Response `400` — Hold expired sebelum konfirmasi:**
```json
{ "error": "Seat holds have expired. Booking cannot be confirmed." }
```

**Response `503` — Server tidak terkonfigurasi:**
```json
{ "error": "Payment webhook not configured" }
```

---

## Alur Booking Lengkap (Tutorial)

Berikut adalah alur lengkap dari pencarian hingga konfirmasi pembayaran.

### Langkah 1 — Tampilkan Kota Asal & Tujuan

```http
GET /api/app/cities
X-Service-Key: sk_live_xxx
```

Gunakan response untuk mengisi dropdown di UI pencarian.

---

### Langkah 2 — Cari Trip yang Tersedia

```http
GET /api/app/trips/search?originCity=Jakarta&destinationCity=Bandung&date=2026-04-10&passengers=2
X-Service-Key: sk_live_xxx
```

Dari response, simpan untuk setiap trip yang ingin dibooking:
- `tripId`
- `origin.stopId` → akan menjadi `originStopId`
- `destination.stopId` → akan menjadi `destinationStopId`
- `origin.sequence` → akan menjadi `originSeq`
- `destination.sequence` → akan menjadi `destinationSeq`
- `farePerPerson` → tampilkan ke user

---

### Langkah 3 — Tampilkan Peta Kursi

```http
GET /api/app/trips/550e8400-e29b-41d4-a716-446655440000/seatmap?originSeq=1&destinationSeq=3
X-Service-Key: sk_live_xxx
```

Render layout kursi berdasarkan `layout.seatMap`. Tandai kursi berdasarkan `seatAvailability`:
- `available: true, held: false` → tampilkan hijau (dapat dipilih)
- `available: false, held: false` → tampilkan merah (sudah dipesan)
- `available: false, held: true` → tampilkan kuning (sedang diproses orang lain)

---

### Langkah 4 — Buat Booking

Setelah pengguna memilih kursi dan mengisi data penumpang:

```http
POST /api/app/bookings
X-Service-Key: sk_live_xxx
Content-Type: application/json

{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceDate": "2026-04-10",
  "originStopId": "550e8400-e29b-41d4-a716-111111111111",
  "destinationStopId": "550e8400-e29b-41d4-a716-222222222222",
  "originSeq": 1,
  "destinationSeq": 3,
  "passengers": [
    { "fullName": "Budi Santoso", "seatNo": "A1", "phone": "081234567890" },
    { "fullName": "Siti Rahayu",  "seatNo": "A2", "phone": "089987654321" }
  ],
  "paymentMethod": "qr"
}
```

Dari response, simpan:
- `id` (bookingId)
- `paymentIntent.providerRef` → kirim ke payment gateway sebagai referensi eksternal
- `paymentIntent.expiresAt` → tampilkan countdown ke user
- `totalAmount` → jumlah yang harus dibayar

---

### Langkah 5 — Proses Pembayaran

Arahkan pengguna ke payment gateway Anda. Kirim `providerRef` dari langkah 4 sebagai referensi order di sisi payment gateway.

Payment gateway akan memanggil `/api/app/payments/webhook` saat pembayaran selesai.

---

### Langkah 6 — Terima Konfirmasi Webhook

Payment gateway mengirim POST ke `/api/app/payments/webhook`:

```http
POST /api/app/payments/webhook
X-Webhook-Signature: <hmac-hex>

{
  "providerRef": "PAY-ABC123DEF456GHI7",
  "status": "success"
}
```

Saat webhook berhasil diproses, booking otomatis berubah status menjadi `"confirmed"` dan kursi terkunci permanen.

---

### Langkah 7 — Tampilkan E-Tiket

Gunakan `qrData` dari response booking untuk generate e-tiket:

- `qrToken` → kode pendek untuk verifikasi manual di loket
- `qrPayload` → JSON string untuk generate gambar QR code (gunakan library QR code di sisi klien)

Tiket berlaku sebagai bukti perjalanan. Petugas di bus/terminal dapat memindai QR code atau memasukkan `qrToken` secara manual.

---

## Kode Error Referensi

| HTTP Status | Error | Kapan Terjadi |
|-------------|-------|---------------|
| `400` | `"Validation failed"` | Body/query param tidak sesuai skema |
| `400` | `"Seat X is already booked"` | Kursi sudah dipesan orang lain |
| `400` | `"Seat X is currently held by another user"` | Kursi sedang di-hold (coba kursi lain) |
| `400` | `"Payment not found"` | `providerRef` di webhook tidak dikenali |
| `400` | `"Payment already processed"` | Webhook duplikat untuk payment yang sama |
| `400` | `"Seat holds have expired. Booking cannot be confirmed."` | Pembayaran melebihi 15 menit |
| `401` | `"Unauthorized"` | Service key tidak ada atau salah |
| `401` | `"Missing webhook signature"` | Webhook tanpa header signature |
| `401` | `"Invalid webhook signature"` | Signature webhook tidak cocok |
| `404` | `"Trip not found"` | `tripId` tidak ada di database |
| `404` | `"Trip has no layout"` | Trip belum dikonfigurasi layout kursi |
| `404` | `"Shipment not found"` | Nomor waybill tidak ditemukan |
| `503` | `"Payment webhook not configured"` | `PAYMENT_WEBHOOK_SECRET` belum diset di server |

---

## Catatan Integrasi

### Tentang Trip Virtual

Trip virtual (`tripId` berformat `"virtual-<uuid>"`) adalah trip yang ada di jadwal berkala tapi belum pernah ada booking sebelumnya. Saat Anda membuat booking pertama untuk trip virtual, sistem secara otomatis **mematerialize** trip tersebut menjadi trip nyata di database. Proses ini transparan — Anda tidak perlu melakukan apa pun selain mengirim `tripId` dari hasil pencarian.

### Race Condition pada Pemilihan Kursi

TransityTerminal menggunakan **SELECT FOR UPDATE** di level PostgreSQL untuk menangani race condition saat dua pengguna memilih kursi yang sama bersamaan. Hanya satu yang akan berhasil, yang lain mendapat error `409`. Tangani error ini di sisi klien dengan meminta pengguna memilih kursi lain.

### Hold TTL (15 Menit)

Kursi di-hold 15 menit setelah booking dibuat. Jika webhook konfirmasi pembayaran tidak masuk sebelum `holdExpiresAt`:
- Seat hold expired otomatis (oleh cron/cleanup job di server)
- Booking tetap ada di database dengan status `pending` tapi kursi sudah tidak dikunci
- Webhook yang masuk **setelah** hold expired akan mendapat error dan booking dibatalkan otomatis

Implementasikan countdown timer di UI Anda menggunakan nilai `holdExpiresAt`.

### Idempotency Webhook

Jika payment gateway mengirim webhook duplikat (retry), server akan mengembalikan `400 "Payment already processed"`. Ini bukan error fatal — berarti payment sudah dikonfirmasi sebelumnya. Tangani error ini sebagai sukses di sisi payment gateway.

### Format Harga

Semua field harga (seperti `totalAmount`, `fareAmount`, `farePerPerson`) dikembalikan sebagai **string** atau **integer** tergantung endpoint:
- `farePerPerson` di search results → `number` (integer)
- `totalAmount`, `fareAmount` di booking detail → `string` numerik

Selalu parse dengan `parseInt()` atau `parseFloat()` sebelum operasi aritmetika.

### Timezone

Semua waktu dikembalikan dalam **UTC** (suffix `Z`). Konversi ke WIB (UTC+7) atau WITA/WIT sesuai kebutuhan tampilan di sisi klien:
- WIB = UTC + 7 jam
- WITA = UTC + 8 jam  
- WIT = UTC + 9 jam

### Rate Limiting

Endpoint mobile auth (`/api/app/auth/register`, `/api/app/auth/login`) memiliki rate limit:
- Register: 5 request/menit per IP
- Login: 10 request/menit per IP

Endpoint Service Key tidak memiliki rate limit eksplisit tapi tetap tunduk pada infrastruktur rate limiting server.
