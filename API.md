# TransityTerminal — Dokumentasi API Lengkap

Dokumentasi ini mencakup **seluruh endpoint** yang tersedia di TransityTerminal, termasuk level autentikasi, parameter, request body, dan contoh response.

---

## Daftar Isi

- [Model Autentikasi](#model-autentikasi)
- [Base URL & Headers](#base-url--headers)
- [Kode Error Standar](#kode-error-standar)
- [1. Health Check](#1-health-check)
- [2. Setup & Onboarding](#2-setup--onboarding)
- [3. Auth — Realmio Proxy](#3-auth--realmio-proxy)
- [4. Mobile B2C API (`/api/app/*`)](#4-mobile-b2c-api-apiapp)
- [5. Permissions](#5-permissions)
- [6. Master Data — Stops](#6-master-data--stops)
- [7. Master Data — Outlets](#7-master-data--outlets)
- [8. Master Data — Vehicles](#8-master-data--vehicles)
- [9. Master Data — Drivers](#9-master-data--drivers)
- [10. Master Data — Layouts](#10-master-data--layouts)
- [11. Master Data — Trip Patterns](#11-master-data--trip-patterns)
- [12. Master Data — Trip Bases](#12-master-data--trip-bases)
- [13. Trips (Instance Perjalanan)](#13-trips-instance-perjalanan)
- [14. Seat Map & Inventaris Kursi](#14-seat-map--inventaris-kursi)
- [15. Holds (Reservasi Kursi Sementara)](#15-holds-reservasi-kursi-sementara)
- [16. Booking — Sekali Jalan](#16-booking--sekali-jalan)
- [17. Booking — Pulang Pergi (Round-Trip)](#17-booking--pulang-pergi-round-trip)
- [18. Passenger Management](#18-passenger-management)
- [19. Pembayaran](#19-pembayaran)
- [20. Kargo](#20-kargo)
- [21. SPJ (Surat Perintah Jalan)](#21-spj-surat-perintah-jalan)
- [22. Promo & Voucher](#22-promo--voucher)
- [23. Pricing](#23-pricing)
- [24. Manifest](#24-manifest)
- [25. Scheduler (Manajemen Kalender)](#25-scheduler-manajemen-kalender)
- [26. Laporan](#26-laporan)
- [27. Dashboard](#27-dashboard)
- [28. Kasir](#28-kasir)
- [29. Refund](#29-refund)
- [30. Pelanggan (CRM)](#30-pelanggan-crm)
- [31. Notifikasi](#31-notifikasi)
- [32. Finance — Cost Templates](#32-finance--cost-templates)
- [33. Maintenance Kendaraan](#33-maintenance-kendaraan)
- [34. Settings Operator](#34-settings-operator)
- [35. Admin — Staff & RBAC](#35-admin--staff--rbac)
- [36. Dev-Only Endpoints](#36-dev-only-endpoints)

---

## Model Autentikasi

TransityTerminal menggunakan tiga model auth yang berbeda:

| Model | Cara | Digunakan Oleh |
|-------|------|----------------|
| **Realmio Session** | Cookie sesi dari Realmio (set otomatis saat login) | Seluruh dashboard admin terminal |
| **Mobile JWT** | `Authorization: Bearer <token>` | Aplikasi mobile B2C |
| **Service Key** | Header `X-Service-Key: <key>` | Sistem eksternal / platform pusat |
| **HMAC Signature** | Header `X-Webhook-Signature: <sha256-hex>` | Payment gateway webhook |

### Global Auth Hook

Semua request ke `/api/*` **kecuali** `/api/auth/*` dan `/api/app/*` wajib menyertakan Realmio session cookie yang valid. Tanpa itu, server mengembalikan `401 Unauthorized`.

### Feature Flags

Di atas Realmio session, banyak endpoint memerlukan **feature flag** spesifik. Flag diperiksa via `preHandler` di setiap route. Jika flag tidak aktif untuk role user, server mengembalikan `403 Forbidden`.

---

## Base URL & Headers

```
# Development
http://localhost:5000

# Production
https://<subdomain>.transity.web.id
```

### Headers Umum

```http
Content-Type: application/json
Cookie: <realmio-session-cookie>          # Untuk admin dashboard
Authorization: Bearer <jwt-token>          # Untuk mobile app
X-Service-Key: <terminal-service-key>      # Untuk sistem eksternal
X-Webhook-Signature: sha256=<hmac-hex>    # Untuk payment webhook
```

---

## Kode Error Standar

| HTTP Status | Arti |
|-------------|------|
| `400` | Request tidak valid (body/param salah) |
| `401` | Tidak terautentikasi |
| `403` | Terautentikasi tapi tidak punya izin (flag tidak aktif) |
| `404` | Resource tidak ditemukan |
| `409` | Konflik (duplikat, status tidak valid, dll) |
| `422` | Validasi Zod gagal atau business logic error |
| `429` | Rate limit terlampaui |
| `500` | Internal server error |
| `502` | Auth service (Realmio) tidak dapat dijangkau |

---

## 1. Health Check

### `GET /api/health`

**Auth:** Tidak perlu. Jika header `X-Service-Key` dikirim, divalidasi terhadap `TERMINAL_SERVICE_KEY`.

**Response `200`:**
```json
{ "status": "ok" }
```

**Response `401`** (jika service key salah):
```json
{ "error": "Unauthorized" }
```

---

## 2. Setup & Onboarding

Digunakan untuk inisialisasi pertama kali terminal baru sebelum ada staff.

### `GET /api/setup/status`

**Auth:** Realmio session (perlu login ke Realmio dulu, belum perlu staff record).

Cek apakah terminal sudah pernah disetup.

**Response `200`:**
```json
{ "needsSetup": true }
```

---

### `POST /api/setup/init`

**Auth:** Realmio session. **Rate limit:** 5 request/menit.

Membuat akun owner pertama. **Diblokir jika sudah ada staff_members di database.**

**Request Body:**
```json
{
  "name": "Admin Owner",
  "email": "owner@perusahaan.id",
  "password": "minimal8karakter"
}
```

**Response `201`:**
```json
{
  "staff": {
    "id": "uuid",
    "userId": "uuid",
    "roleId": "owner",
    "isActive": true
  },
  "message": "Akun owner berhasil dibuat. Silakan login."
}
```

**Response `403`:** Setup sudah pernah dilakukan.

---

## 3. Auth — Realmio Proxy

Endpoint auth adalah **proxy** ke Realmio. Semua endpoint di bawah ini **tidak** memerlukan sesi aktif sebelumnya (bypass global auth hook).

### `POST /api/auth/sign-in/email`

**Auth:** Tidak perlu. **Rate limit:** 10 request/menit.

**Request Body:**
```json
{
  "email": "cso@perusahaan.id",
  "password": "password123"
}
```

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "cso@perusahaan.id",
    "name": "Nama CSO"
  },
  "session": {
    "id": "session-id",
    "token": "token-string",
    "userId": "uuid",
    "expiresAt": "2026-04-10T00:00:00.000Z"
  }
}
```

Cookie sesi di-set otomatis oleh server.

---

### `POST /api/auth/sign-up/email`

**Auth:** Tidak perlu. **Rate limit:** 5 request/menit.

**Request Body:**
```json
{
  "name": "Nama User",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Sama seperti sign-in.

---

### `POST /api/auth/sign-out`

**Auth:** Tidak perlu. Menghapus semua cookie sesi di browser.

**Response `200`:**
```json
{ "success": true }
```

---

### `GET /api/auth/session`

**Auth:** Tidak perlu (validasi cookie ke Realmio secara internal).

**Response `200`** (sesi valid):
```json
{
  "user": { "id": "uuid", "email": "...", "name": "..." },
  "session": { "id": "...", "expiresAt": "..." }
}
```

**Response `200`** (tidak ada sesi):
```json
{ "user": null, "session": null }
```

---

### `GET /api/auth/me`

**Auth:** Tidak perlu (validasi cookie ke Realmio secara internal).

**Response `200`:**
```json
{
  "user": { "id": "uuid", "email": "...", "name": "..." },
  "tenant": { "id": "transity", "slug": "transity" }
}
```

**Response `401`:** Sesi tidak valid.

---

## 4. Mobile B2C API (`/api/app/*`)

API ini diakses oleh aplikasi mobile (Expo React Native) dan sistem eksternal. CORS dikonfigurasi via env `APP_CORS_ORIGINS`.

---

### 4.1 Auth Mobile

#### `POST /api/app/auth/register`

**Auth:** Tidak perlu. **Rate limit:** 5 request/menit.

**Request Body:**
```json
{
  "name": "Nama Penumpang",
  "email": "penumpang@gmail.com",
  "phone": "081234567890",
  "password": "password123"
}
```

**Response `201`:**
```json
{
  "user": { "id": "uuid", "name": "...", "email": "..." },
  "token": "jwt-bearer-token"
}
```

---

#### `POST /api/app/auth/login`

**Auth:** Tidak perlu. **Rate limit:** 10 request/menit.

**Request Body:**
```json
{
  "email": "penumpang@gmail.com",
  "password": "password123"
}
```

**Response `200`:**
```json
{
  "user": { "id": "uuid", "name": "...", "email": "..." },
  "token": "jwt-bearer-token"
}
```

---

#### `GET /api/app/auth/me`

**Auth:** 📱 JWT Bearer token.

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "Nama Penumpang",
  "email": "penumpang@gmail.com",
  "phone": "081234567890"
}
```

---

### 4.2 Profil Mobile

#### `GET /api/app/profile`

**Auth:** 📱 JWT Bearer token.

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "Nama",
  "email": "email@example.com",
  "phone": "08xxx",
  "bookingCount": 5
}
```

---

#### `PATCH /api/app/profile`

**Auth:** 📱 JWT Bearer token.

**Request Body:**
```json
{
  "name": "Nama Baru",
  "phone": "08xxx"
}
```

---

### 4.3 Data Operator & Rute (Service Key)

#### `GET /api/app/operator-info`

**Auth:** 🔐 Service Key.

Info operator terminal (nama, logo, kota, dll).

---

#### `GET /api/app/cities`

**Auth:** 🔐 Service Key.

Daftar kota/stop yang tersedia.

---

#### `GET /api/app/service-lines`

**Auth:** 🔐 Service Key.

Daftar layanan/rute aktif.

---

#### `GET /api/app/trips/search`

**Auth:** 🔐 Service Key.

**Query Parameters:**
```
originStopId=uuid
destinationStopId=uuid
serviceDate=YYYY-MM-DD
passengers=1
```

**Response `200`:**
```json
[
  {
    "tripId": "uuid",
    "baseId": "uuid",
    "isVirtual": false,
    "serviceDate": "2026-04-10",
    "departureTime": "10:00",
    "arrivalTime": "14:00",
    "availableSeats": 15,
    "fare": 85000,
    "originStop": { "id": "uuid", "name": "Terminal A" },
    "destinationStop": { "id": "uuid", "name": "Terminal B" }
  }
]
```

---

#### `GET /api/app/trips/:id`

**Auth:** 🔐 Service Key.

Detail trip beserta stop times.

---

#### `GET /api/app/trips/:id/seatmap`

**Auth:** 🔐 Service Key.

Peta kursi trip untuk segmen tertentu.

**Query Parameters:**
```
originSeq=1
destinationSeq=3
```

---

#### `GET /api/app/trips/:tripId/reviews`

**Auth:** 🔐 Service Key.

Ulasan penumpang untuk trip.

---

### 4.4 Booking Mobile

#### `POST /api/app/bookings`

**Auth:** 🔐📱 Service Key ATAU JWT Bearer token.

Membuat booking dari aplikasi mobile atau sistem eksternal.

**Request Body:**
```json
{
  "tripId": "uuid",
  "originStopId": "uuid",
  "destinationStopId": "uuid",
  "passengers": [
    { "name": "Nama Penumpang", "seatNo": "A1", "idNumber": "3201..." }
  ],
  "paymentMethod": "qris",
  "promoCode": "PROMO10"
}
```

**Response `201`:**
```json
{
  "bookingCode": "TRN-20260410-001",
  "totalFare": 85000,
  "status": "pending",
  "paymentUrl": "https://payment-gateway.com/pay/..."
}
```

---

#### `GET /api/app/bookings`

**Auth:** 📱 JWT. Menampilkan booking milik user yang sedang login.

---

#### `GET /api/app/bookings/:id`

**Auth:** 📱 JWT.

---

#### `GET /api/app/bookings/:id/payment-status`

**Auth:** 📱 JWT.

**Response `200`:**
```json
{
  "bookingId": "uuid",
  "status": "paid",
  "paidAt": "2026-04-10T08:30:00Z",
  "amount": 85000
}
```

---

#### `POST /api/app/bookings/:id/cancel`

**Auth:** 📱 JWT.

---

### 4.5 Payment Webhook

#### `POST /api/app/payments/webhook`

**Auth:** ✅ HMAC-SHA256. Header `X-Webhook-Signature: sha256=<hex>`.

Dikirim oleh payment gateway saat status pembayaran berubah.

**Request Body:**
```json
{
  "providerRef": "PAYMENT-REF-123",
  "status": "success",
  "amount": 85000,
  "paidAt": "2026-04-10T08:30:00Z"
}
```

**Response `200`:**
```json
{ "received": true }
```

**Response `401`:** Signature tidak valid atau `PAYMENT_WEBHOOK_SECRET` tidak dikonfigurasi.

---

### 4.6 Kargo Mobile

#### `GET /api/app/cargo/track/:waybillNumber`

**Auth:** 🔐 Service Key.

Track pengiriman kargo by nomor waybill.

**Response `200`:**
```json
{
  "waybillNumber": "TRN-20260410-00001",
  "status": "in_transit",
  "sender": "PT ABC",
  "receiver": "Budi",
  "origin": "Jakarta",
  "destination": "Bandung",
  "weight": 5.5,
  "events": [...]
}
```

---

#### `GET /api/app/cargo/:waybillNumber`

**Auth:** 🔐 Service Key. Alias dari endpoint di atas.

---

#### `POST /api/app/cargo`

**Auth:** 📱 JWT.

Buat pengiriman kargo dari aplikasi mobile.

---

### 4.7 Ulasan

#### `POST /api/app/reviews`

**Auth:** 📱 JWT.

**Request Body:**
```json
{
  "tripId": "uuid",
  "bookingId": "uuid",
  "rating": 5,
  "comment": "Pelayanan memuaskan"
}
```

---

## 5. Permissions

### `GET /api/permissions/me`

**Auth:** 🔑 Realmio session.

Mendapatkan flags, role, dan outlet scope user yang sedang login.

**Response `200`:**
```json
{
  "flags": ["page.cso", "action.booking.create", "action.payment.create"],
  "role": "cso",
  "outletId": "uuid-outlet"
}
```

---

## 6. Master Data — Stops

### `GET /api/stops`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Terminal Kampung Rambutan",
    "code": "KR",
    "city": "Jakarta",
    "lat": -6.2908,
    "lng": 106.8783,
    "isOutletStop": true
  }
]
```

---

### `GET /api/stops/:id`

**Auth:** 🔑 Realmio session.

---

### `POST /api/stops`

**Auth:** 🏷️ Flag `master.stops`.

**Request Body:**
```json
{
  "name": "Nama Stop",
  "code": "NS",
  "city": "Bandung",
  "lat": -6.9147,
  "lng": 107.6098,
  "isOutletStop": false
}
```

---

### `PUT /api/stops/:id`

**Auth:** 🏷️ Flag `master.stops`.

---

### `DELETE /api/stops/:id`

**Auth:** 🏷️ Flag `master.stops`.

---

### `GET /api/stops/:id/impact`

**Auth:** 🔑 Realmio session.

Cek dampak perubahan stop terhadap booking/trip aktif sebelum melakukan perubahan.

**Response `200`:**
```json
{
  "affectedTrips": 3,
  "affectedBookings": 12,
  "details": [...]
}
```

---

## 7. Master Data — Outlets

### `GET /api/outlets`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Loket Utama",
    "stopId": "uuid",
    "printerConfig": { "type": "thermal", "width": 80 }
  }
]
```

---

### `GET /api/outlets/:id`

**Auth:** 🔑 Realmio session.

---

### `POST /api/outlets`

**Auth:** 🏷️ Flag `master.outlets`.

**Request Body:**
```json
{
  "name": "Loket Baru",
  "stopId": "uuid",
  "printerConfig": {}
}
```

---

### `PUT /api/outlets/:id`

**Auth:** 🏷️ Flag `master.outlets`.

---

### `DELETE /api/outlets/:id`

**Auth:** 🏷️ Flag `master.outlets`.

---

## 8. Master Data — Vehicles

### `GET /api/vehicles`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "plateNumber": "B 1234 XY",
    "name": "Bus Eksekutif A",
    "layoutId": "uuid",
    "capacity": 40,
    "status": "active"
  }
]
```

---

### `GET /api/vehicles/:id`

**Auth:** 🔑 Realmio session.

---

### `POST /api/vehicles`

**Auth:** 🏷️ Flag `master.vehicles`.

**Request Body:**
```json
{
  "plateNumber": "B 9999 ZZ",
  "name": "Bus Baru",
  "layoutId": "uuid",
  "capacity": 40
}
```

---

### `PUT /api/vehicles/:id`

**Auth:** 🏷️ Flag `master.vehicles`.

---

### `DELETE /api/vehicles/:id`

**Auth:** 🏷️ Flag `master.vehicles`.

---

## 9. Master Data — Drivers

### `GET /api/drivers`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Budi Santoso",
    "licenseNumber": "SIM-12345",
    "phone": "081234567890",
    "status": "active"
  }
]
```

---

### `GET /api/drivers/:id`

**Auth:** 🔑 Realmio session.

---

### `GET /api/drivers/:id/performance`

**Auth:** 🔑 Realmio session.

Statistik performa driver (jumlah trip, ketepatan waktu, dll).

---

### `POST /api/drivers`

**Auth:** 🏷️ Flag `master.drivers`.

**Request Body:**
```json
{
  "name": "Nama Driver",
  "licenseNumber": "SIM-XXXXX",
  "phone": "08xxx",
  "licenseExpiry": "2027-12-31"
}
```

---

### `PUT /api/drivers/:id`

**Auth:** 🏷️ Flag `master.drivers`.

---

### `DELETE /api/drivers/:id`

**Auth:** 🏷️ Flag `master.drivers`.

---

## 10. Master Data — Layouts

### `GET /api/layouts`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Layout 40 Kursi",
    "rows": 10,
    "columns": 4,
    "seats": [
      { "seatNo": "A1", "row": 1, "col": 1, "type": "regular" }
    ]
  }
]
```

---

### `GET /api/layouts/:id`

**Auth:** 🔑 Realmio session.

---

### `POST /api/layouts`

**Auth:** 🏷️ Flag `master.layouts`.

---

### `PUT /api/layouts/:id`

**Auth:** 🏷️ Flag `master.layouts`.

---

### `DELETE /api/layouts/:id`

**Auth:** 🏷️ Flag `master.layouts`.

---

## 11. Master Data — Trip Patterns

Pola rute (template urutan stop).

### `GET /api/trip-patterns`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "JKT - PWK - BDG",
    "stops": [
      { "seq": 1, "stopId": "uuid", "stopName": "Jakarta", "boardingAllowed": true, "alightingAllowed": false },
      { "seq": 2, "stopId": "uuid", "stopName": "Purwakarta", "boardingAllowed": true, "alightingAllowed": true },
      { "seq": 3, "stopId": "uuid", "stopName": "Bandung", "boardingAllowed": false, "alightingAllowed": true }
    ]
  }
]
```

---

### `GET /api/trip-patterns/:id`

**Auth:** 🔑 Realmio session.

---

### `GET /api/trip-patterns/:id/impact`

**Auth:** 🔑 Realmio session.

Cek dampak perubahan pattern terhadap trip aktif.

---

### `POST /api/trip-patterns`

**Auth:** 🏷️ Flag `master.trip_patterns`.

---

### `PUT /api/trip-patterns/:id`

**Auth:** 🏷️ Flag `master.trip_patterns`.

---

### `DELETE /api/trip-patterns/:id`

**Auth:** 🏷️ Flag `master.trip_patterns`.

---

### `GET /api/trip-patterns/:patternId/stops`

**Auth:** 🔑 Realmio session.

---

### `POST /api/pattern-stops`

**Auth:** 🏷️ Flag `master.trip_patterns`.

Tambah stop individual ke pattern.

**Request Body:**
```json
{
  "patternId": "uuid",
  "stopId": "uuid",
  "seq": 2,
  "boardingAllowed": true,
  "alightingAllowed": true,
  "defaultDuration": 5
}
```

---

### `PUT /api/pattern-stops/:id`

**Auth:** 🏷️ Flag `master.trip_patterns`.

---

### `DELETE /api/pattern-stops/:id`

**Auth:** 🏷️ Flag `master.trip_patterns`.

---

### `POST /api/trip-patterns/:patternId/stops/bulk-replace`

**Auth:** 🏷️ Flag `master.trip_patterns`.

Ganti seluruh stop pattern sekaligus (atomic).

**Request Body:**
```json
{
  "stops": [
    { "stopId": "uuid", "seq": 1, "boardingAllowed": true, "alightingAllowed": false },
    { "stopId": "uuid", "seq": 2, "boardingAllowed": true, "alightingAllowed": true }
  ]
}
```

---

## 12. Master Data — Trip Bases

Template penjadwalan virtual. Trip nyata dimaterialize dari sini saat CSO pertama kali booking.

### `GET /api/trip-bases`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "patternId": "uuid",
    "vehicleId": "uuid",
    "daysOfWeek": [1, 2, 3, 4, 5],
    "departureTime": "10:00",
    "validFrom": "2026-01-01",
    "validTo": "2026-12-31",
    "defaultStopTimes": [
      { "seq": 1, "arrivalOffset": 0, "departureOffset": 5 }
    ]
  }
]
```

---

### `GET /api/trip-bases/:id`

**Auth:** 🔑 Realmio session.

---

### `POST /api/trip-bases`

**Auth:** 🏷️ Flag `master.trips`.

---

### `PUT /api/trip-bases/:id`

**Auth:** 🏷️ Flag `master.trips`.

---

### `DELETE /api/trip-bases/:id`

**Auth:** 🏷️ Flag `master.trips`.

---

### `POST /api/cso/materialize-trip`

**Auth:** 🏷️ Flag `action.trip.materialize`.

Materialize virtual trip menjadi trip nyata di database saat CSO memilih tanggal.

**Request Body:**
```json
{
  "baseId": "uuid",
  "serviceDate": "2026-04-10"
}
```

**Response `200`:**
```json
{
  "tripId": "uuid",
  "serviceDate": "2026-04-10",
  "status": "scheduled",
  "materialized": true
}
```

---

## 13. Trips (Instance Perjalanan)

### `GET /api/trips`

**Auth:** 🔑 Realmio session + outlet scope.

**Query Parameters:**
```
date=YYYY-MM-DD
status=scheduled|in_progress|closed|cancelled
patternId=uuid
```

---

### `GET /api/trips/:id`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
{
  "id": "uuid",
  "baseId": "uuid",
  "patternId": "uuid",
  "vehicleId": "uuid",
  "driverId": "uuid",
  "serviceDate": "2026-04-10",
  "status": "scheduled",
  "stopTimes": [...],
  "legs": [...]
}
```

---

### `POST /api/trips`

**Auth:** 🏷️ Flag `master.trips`.

Buat trip manual (bukan dari base).

---

### `PUT /api/trips/:id`

**Auth:** 🏷️ Flag `master.trips`.

---

### `DELETE /api/trips/:id`

**Auth:** 🏷️ Flag `master.trips`.

---

### `GET /api/cso/available-trips`

**Auth:** 🔑 Realmio session + outlet scope.

Gabungan trip real dan virtual yang tersedia untuk CSO.

**Query Parameters:**
```
serviceDate=YYYY-MM-DD
outletId=uuid
```

**Response `200`:**
```json
[
  {
    "tripId": "uuid",
    "baseId": "uuid",
    "isVirtual": false,
    "serviceDate": "2026-04-10",
    "patternName": "JKT - BDG",
    "departureTime": "10:00",
    "status": "scheduled",
    "totalSeats": 40,
    "availableSeats": 25
  }
]
```

---

### `GET /api/trips/:id/active-passengers`

**Auth:** 🏷️ Flag `action.trip.close` atau `action.trip.batch_reschedule`.

Daftar penumpang aktif (confirmed) di trip, digunakan sebelum menutup trip.

---

### `POST /api/trips/:id/close`

**Auth:** 🏷️ Flag `action.trip.close`.

Tutup trip. Semua seat hold yang belum dikonfirmasi dilepas.

**Response `200`:**
```json
{ "tripId": "uuid", "status": "closed", "holdsReleased": 3 }
```

---

### `POST /api/trips/:id/close-with-reschedule`

**Auth:** 🏷️ Flag `action.trip.close` + `action.trip.batch_reschedule`.

Tutup trip sekaligus batch reschedule semua penumpang aktif ke trip lain.

**Request Body:**
```json
{
  "targetTripId": "uuid",
  "reason": "Alasan penutupan trip"
}
```

---

### Trip Stop Times

#### `GET /api/trips/:tripId/stop-times`

**Auth:** 🔑 Realmio session.

---

#### `GET /api/trips/:tripId/stop-times/effective`

**Auth:** 🔑 Realmio session.

Stop times dengan flag effective (sudah dihitung leg-nya).

---

#### `POST /api/trips/:tripId/stop-times/bulk-upsert`

**Auth:** 🏷️ Flag `master.trips`.

Upsert jadwal stop times sekaligus.

**Request Body:**
```json
{
  "stopTimes": [
    { "stopId": "uuid", "seq": 1, "arrivalTime": "10:00", "departureTime": "10:05" }
  ]
}
```

---

#### `POST /api/trips/:tripId/stop-times/sync-from-pattern`

**Auth:** 🏷️ Flag `master.trips`.

Sinkronkan stop times dari defaultStopTimes di trip base.

---

#### `POST /api/trips/:tripId/derive-legs`

**Auth:** 🏷️ Flag `master.trips`.

Derive trip legs dari stop times.

---

#### `POST /api/trips/:tripId/precompute-seat-inventory`

**Auth:** 🏷️ Flag `master.trips`.

Precompute seat inventory untuk semua legs.

---

#### `POST /api/trip-stop-times`

**Auth:** 🏷️ Flag `master.trips`.

Tambah stop time individual.

---

#### `PUT /api/trip-stop-times/:id`

**Auth:** 🏷️ Flag `master.trips`.

---

#### `DELETE /api/trip-stop-times/:id`

**Auth:** 🏷️ Flag `master.trips`.

---

## 14. Seat Map & Inventaris Kursi

### `GET /api/trips/:id/seatmap`

**Auth:** 🔑 Realmio session.

Peta kursi untuk segmen tertentu (origin → destination).

**Query Parameters:**
```
originSeq=1
destinationSeq=3
```

**Response `200`:**
```json
{
  "tripId": "uuid",
  "layout": {
    "rows": 10,
    "columns": 4
  },
  "seats": [
    {
      "seatNo": "A1",
      "row": 1,
      "col": 1,
      "status": "available",
      "holdRef": null,
      "passengerName": null
    },
    {
      "seatNo": "A2",
      "row": 1,
      "col": 2,
      "status": "booked",
      "passengerName": "Budi"
    }
  ]
}
```

Status seat: `available` | `held` | `booked` | `blocked`.

---

### `GET /api/trips/:tripId/seats/:seatNo/passenger-details`

**Auth:** 🏷️ Flag `page.cso`.

Detail penumpang yang menempati kursi tertentu.

**Response `200`:**
```json
{
  "passengerId": "uuid",
  "name": "Budi Santoso",
  "bookingCode": "TRN-20260410-001",
  "origin": "Jakarta",
  "destination": "Bandung",
  "seatNo": "A2",
  "status": "confirmed"
}
```

---

### `GET /api/trips/:id/unseated-passengers`

**Auth:** 🏷️ Flag `page.cso`.

Penumpang yang belum mendapatkan kursi (perlu assign seat).

---

## 15. Holds (Reservasi Kursi Sementara)

Hold adalah mekanisme kunci kursi sementara dengan TTL. Short TTL (300 detik) digunakan saat memilih kursi, Long TTL (1800 detik) saat mengisi form penumpang.

### `POST /api/holds`

**Auth:** 🔑 Realmio session.

Buat hold kursi.

**Request Body:**
```json
{
  "tripId": "uuid",
  "seatNo": "A1",
  "originSeq": 1,
  "destinationSeq": 3,
  "ttl": "short"
}
```

`ttl`: `"short"` (300 detik) | `"long"` (1800 detik)

**Response `200`:**
```json
{
  "holdRef": "HOLD-uuid",
  "seatNo": "A1",
  "expiresAt": "2026-04-10T08:35:00Z"
}
```

**Response `409`:** Kursi sudah di-hold atau dipesan.

---

### `DELETE /api/holds/:holdRef`

**Auth:** 🔑 Realmio session.

Release hold kursi sebelum TTL habis.

**Response `200`:**
```json
{ "released": true }
```

---

## 16. Booking — Sekali Jalan

### `GET /api/bookings`

**Auth:** 🔑 Realmio session + outlet scope.

**Query Parameters:**
```
date=YYYY-MM-DD
status=pending|confirmed|cancelled
outletId=uuid
tripId=uuid
page=1
limit=50
```

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "bookingCode": "TRN-20260410-001",
    "tripId": "uuid",
    "outletId": "uuid",
    "passengerCount": 2,
    "totalFare": 170000,
    "status": "confirmed",
    "createdAt": "2026-04-10T08:00:00Z"
  }
]
```

---

### `GET /api/bookings/:id`

**Auth:** 🔑 Realmio session.

Detail lengkap booking beserta penumpang dan pembayaran.

**Response `200`:**
```json
{
  "id": "uuid",
  "bookingCode": "TRN-20260410-001",
  "tripId": "uuid",
  "outletId": "uuid",
  "status": "confirmed",
  "totalFare": 170000,
  "discount": 10000,
  "passengers": [
    {
      "id": "uuid",
      "name": "Budi",
      "seatNo": "A1",
      "originStop": "Jakarta",
      "destinationStop": "Bandung",
      "fare": 85000,
      "status": "confirmed"
    }
  ],
  "payments": [...],
  "createdAt": "2026-04-10T08:00:00Z"
}
```

---

### `GET /api/bookings/by-code/:code`

**Auth:** 🔑 Realmio session.

Cari booking berdasarkan kode booking.

---

### `GET /api/bookings/search`

**Auth:** 🔑 Realmio session.

**Query Parameters:**
```
q=TRN-20260410        # Pencarian kode booking (untuk autocomplete refund)
```

---

### `GET /api/bookings/:bookingId/history`

**Auth:** 🔑 Realmio session.

Audit trail: semua perubahan (unseat, reschedule, cancel, dll).

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "action": "reschedule",
    "performedBy": "Nama Staff",
    "reason": "Permintaan penumpang",
    "oldTripId": "uuid",
    "newTripId": "uuid",
    "createdAt": "2026-04-10T09:00:00Z"
  }
]
```

---

### `POST /api/bookings`

**Auth:** 🏷️ Flag `action.booking.create`.

Buat booking sekali jalan dari terminal CSO.

**Request Body:**
```json
{
  "tripId": "uuid",
  "outletId": "uuid",
  "originStopId": "uuid",
  "destinationStopId": "uuid",
  "passengers": [
    {
      "name": "Budi Santoso",
      "seatNo": "A1",
      "idNumber": "320101xxxxxxxx",
      "phone": "08xxx",
      "originSeq": 1,
      "destinationSeq": 3,
      "holdRef": "HOLD-uuid"
    }
  ],
  "paymentMethod": "cash",
  "promoCode": "DISKON10",
  "channelType": "counter"
}
```

**Response `201`:**
```json
{
  "bookingId": "uuid",
  "bookingCode": "TRN-20260410-001",
  "totalFare": 85000,
  "discount": 8500,
  "netFare": 76500,
  "status": "confirmed",
  "printPayload": { ... }
}
```

---

### Pending Bookings (Draft)

#### `POST /api/bookings/pending`

**Auth:** 🏷️ Flag `action.booking.create`.

Simpan booking sebagai draft pending.

---

#### `GET /api/bookings/pending`

**Auth:** 🔑 Realmio session.

---

#### `DELETE /api/bookings/pending/:id`

**Auth:** 🔑 Realmio session.

---

### `GET /api/tickets/:ticketNumber`

**Auth:** 🔑 Realmio session.

Ambil data tiket berdasarkan nomor tiket untuk keperluan print ulang.

---

## 17. Booking — Pulang Pergi (Round-Trip)

### `POST /api/bookings/round-trip`

**Auth:** 🏷️ Flag `action.booking.create`.

Membuat dua booking (outbound + return) dalam **satu transaksi atomik**. Kedua booking dihubungkan via `booking_groups`.

**Request Body:**
```json
{
  "outbound": {
    "tripId": "uuid",
    "originStopId": "uuid",
    "destinationStopId": "uuid",
    "passengers": [
      {
        "name": "Budi",
        "seatNo": "A1",
        "originSeq": 1,
        "destinationSeq": 3,
        "holdRef": "HOLD-outbound-uuid"
      }
    ]
  },
  "return": {
    "tripId": "uuid",
    "originStopId": "uuid",
    "destinationStopId": "uuid",
    "passengers": [
      {
        "name": "Budi",
        "seatNo": "B2",
        "originSeq": 3,
        "destinationSeq": 1,
        "holdRef": "HOLD-return-uuid"
      }
    ]
  },
  "outletId": "uuid",
  "paymentMethod": "cash",
  "promoCode": null,
  "channelType": "counter"
}
```

> Jumlah penumpang outbound dan return harus sama. Kedua `holdRef` harus aktif.

**Response `201`:**
```json
{
  "groupCode": "PP-uuid",
  "outboundBookingCode": "TRN-20260410-001",
  "returnBookingCode": "TRN-20260410-002",
  "outboundBookingId": "uuid",
  "returnBookingId": "uuid",
  "totalFare": 170000,
  "printPayload": { ... }
}
```

---

### `GET /api/booking-groups/:groupCode`

**Auth:** 🔑 Realmio session.

Detail grup booking PP beserta dua booking di dalamnya.

**Response `200`:**
```json
{
  "groupCode": "PP-uuid",
  "outboundBooking": { ... },
  "returnBooking": { ... },
  "createdAt": "2026-04-10T08:00:00Z"
}
```

---

## 18. Passenger Management

### `POST /api/passengers/:passengerId/unseat`

**Auth:** 🏷️ Flag `action.passenger.unseat`.

Copot penumpang dari kursinya (kursi jadi available kembali, penumpang jadi unseated).

**Request Body:**
```json
{
  "reason": "Permintaan penumpang — pindah ke trip lain"
}
```

---

### `POST /api/passengers/:passengerId/assign-seat`

**Auth:** 🏷️ Flag `action.passenger.assign_seat`.

Assign kursi ke penumpang yang sedang unseated.

**Request Body:**
```json
{
  "seatNo": "B3"
}
```

---

### `POST /api/passengers/:passengerId/reschedule`

**Auth:** 🏷️ Flag `action.passenger.reschedule`.

Pindahkan penumpang ke trip lain (reschedule).

**Request Body:**
```json
{
  "newTripId": "uuid",
  "newSeatNo": "C1",
  "reason": "Permintaan penumpang"
}
```

---

### `POST /api/bookings/:bookingId/unseat-all`

**Auth:** 🏷️ Flag `action.passenger.unseat`.

Unseat semua penumpang dalam satu booking sekaligus.

**Request Body:**
```json
{
  "reason": "Trip dibatalkan"
}
```

---

### `PATCH /api/passengers/:id/cancel`

**Auth:** 🏷️ Flag `action.booking.cancel`.

Batalkan penumpang.

**Request Body:**
```json
{
  "reason": "Penumpang batal berangkat"
}
```

---

## 19. Pembayaran

### `GET /api/bookings/:bookingId/payments`

**Auth:** 🔑 Realmio session.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "amount": 85000,
    "method": "cash",
    "status": "paid",
    "paidAt": "2026-04-10T08:30:00Z",
    "receivedBy": "Nama Kasir"
  }
]
```

---

### `POST /api/payments`

**Auth:** 🏷️ Flag `action.payment.create`.

Catat pembayaran untuk booking.

**Request Body:**
```json
{
  "bookingId": "uuid",
  "amount": 85000,
  "method": "cash",
  "referenceNumber": "REF-001"
}
```

**Response `201`:**
```json
{
  "paymentId": "uuid",
  "status": "paid",
  "paidAt": "2026-04-10T08:30:00Z"
}
```

---

## 20. Kargo

### Master Kargo

#### `GET /api/cargo-types`

**Auth:** 🔑 Realmio session.

#### `GET /api/cargo-types/:id`

**Auth:** 🔑 Realmio session.

#### `POST /api/cargo-types`

**Auth:** 🏷️ Flag `master.cargo_types`.

#### `PUT /api/cargo-types/:id`

**Auth:** 🏷️ Flag `master.cargo_types`.

#### `DELETE /api/cargo-types/:id`

**Auth:** 🏷️ Flag `master.cargo_types`.

---

#### `GET /api/cargo-rates`

**Auth:** 🔑 Realmio session.

#### `GET /api/cargo-rates/:id`

**Auth:** 🔑 Realmio session.

#### `POST /api/cargo-rates`

**Auth:** 🏷️ Flag `master.cargo_rates`.

#### `PUT /api/cargo-rates/:id`

**Auth:** 🏷️ Flag `master.cargo_rates`.

#### `DELETE /api/cargo-rates/:id`

**Auth:** 🏷️ Flag `master.cargo_rates`.

---

### Operasional Kargo

#### `GET /api/cargo/available-trips`

**Auth:** 🔑 Realmio session.

Trip yang tersedia untuk pengiriman kargo.

**Query Parameters:**
```
serviceDate=YYYY-MM-DD
originStopId=uuid
destinationStopId=uuid
```

---

#### `GET /api/cargo/quote-tariff`

**Auth:** 🔑 Realmio session.

Hitung estimasi tarif kargo.

**Query Parameters:**
```
cargoTypeId=uuid
originStopId=uuid
destinationStopId=uuid
weight=5.5
```

**Response `200`:**
```json
{
  "baseTariff": 15000,
  "weightCharge": 27500,
  "total": 42500
}
```

---

#### `GET /api/cargo`

**Auth:** 🔑 Realmio session + outlet scope.

**Query Parameters:**
```
date=YYYY-MM-DD
status=pending|in_transit|delivered
waybillNumber=TRN-xxx
```

---

#### `GET /api/cargo/waybill/:waybillNumber`

**Auth:** 🔑 Realmio session.

---

#### `GET /api/cargo/:id`

**Auth:** 🔑 Realmio session.

---

#### `POST /api/cargo`

**Auth:** 🏷️ Flag `action.cargo.create` + outlet scope.

Buat pengiriman kargo baru. Nomor waybill digenerate otomatis (`TRN-YYYYMMDD-XXXXX`).

**Request Body:**
```json
{
  "tripId": "uuid",
  "outletId": "uuid",
  "cargoTypeId": "uuid",
  "senderName": "PT ABC",
  "receiverName": "Budi Santoso",
  "receiverPhone": "08xxx",
  "originStopId": "uuid",
  "destinationStopId": "uuid",
  "weight": 5.5,
  "description": "Barang elektronik",
  "paymentMethod": "cash"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "waybillNumber": "TRN-20260410-00001",
  "tariff": 42500,
  "status": "pending"
}
```

---

#### `PUT /api/cargo/:id`

**Auth:** 🏷️ Flag `action.cargo.manage`.

---

#### `PATCH /api/cargo/:id/status`

**Auth:** 🏷️ Flag `action.cargo.manage`.

Update status pengiriman.

**Request Body:**
```json
{
  "status": "in_transit",
  "notes": "Diberangkatkan dengan bus B 1234 XY"
}
```

Status: `pending` → `in_transit` → `delivered` | `returned`.

---

## 21. SPJ (Surat Perintah Jalan)

### `GET /api/spj`

**Auth:** 🔑 Realmio session.

**Query Parameters:**
```
tripId=uuid
date=YYYY-MM-DD
status=draft|issued|settled
```

---

### `GET /api/spj/:id`

**Auth:** 🔑 Realmio session.

Detail SPJ beserta cost lines.

---

### `GET /api/spj/trip/:tripId`

**Auth:** 🔑 Realmio session.

SPJ milik trip tertentu.

---

### `GET /api/spj/trip/:tripId/profit`

**Auth:** 🔑 Realmio session.

Kalkulasi laba rugi trip: pendapatan tiket + kargo - biaya SPJ.

**Response `200`:**
```json
{
  "revenue": { "tickets": 3400000, "cargo": 250000, "total": 3650000 },
  "costs": { "driver": 500000, "fuel": 800000, "toll": 200000, "total": 1500000 },
  "profit": 2150000,
  "margin": 58.9
}
```

---

### `POST /api/spj`

**Auth:** 🏷️ Flag `action.spj.create`.

**Request Body:**
```json
{
  "tripId": "uuid",
  "driverId": "uuid",
  "vehicleId": "uuid",
  "notes": "Catatan SPJ"
}
```

---

### `PATCH /api/spj/:id/issue`

**Auth:** 🏷️ Flag `action.spj.issue`.

Terbitkan SPJ (ubah status draft → issued).

---

### `PATCH /api/spj/:id/settle`

**Auth:** 🏷️ Flag `action.spj.settle`.

Selesaikan SPJ setelah trip selesai (issued → settled).

---

### `PATCH /api/spj/:id/notes`

**Auth:** 🏷️ Flag `action.spj.create`.

Update catatan SPJ.

---

### `DELETE /api/spj/:id`

**Auth:** 🏷️ Flag `action.spj.create`.

Hapus SPJ (hanya status draft).

---

### Cost Lines SPJ

#### `POST /api/spj/:spjId/cost-lines`

**Auth:** 🏷️ Flag `action.spj.create`.

**Request Body:**
```json
{
  "category": "fuel",
  "description": "BBM Solar 40 liter",
  "amount": 400000,
  "receiptNumber": "STR-001"
}
```

---

#### `PATCH /api/spj/cost-lines/:id`

**Auth:** 🏷️ Flag `action.spj.create`.

---

#### `DELETE /api/spj/cost-lines/:id`

**Auth:** 🏷️ Flag `action.spj.create`.

---

## 22. Promo & Voucher

### `GET /api/promotions`

**Auth:** 🔑 Realmio session.

---

### `GET /api/promotions/:id`

**Auth:** 🔑 Realmio session.

---

### `POST /api/promotions`

**Auth:** 🏷️ Flag `master.promos`.

**Request Body:**
```json
{
  "code": "LEBARAN25",
  "name": "Promo Lebaran 2026",
  "type": "percentage",
  "value": 25,
  "maxDiscount": 50000,
  "minFare": 100000,
  "validFrom": "2026-03-25",
  "validTo": "2026-04-10",
  "usageLimit": 500,
  "scope": "pattern",
  "patternId": "uuid"
}
```

---

### `PATCH /api/promotions/:id`

**Auth:** 🏷️ Flag `master.promos`.

---

### `DELETE /api/promotions/:id`

**Auth:** 🏷️ Flag `master.promos`.

---

### `GET /api/vouchers`

**Auth:** 🔑 Realmio session.

**Query Parameters:**
```
promotionId=uuid
status=active|used|revoked
```

---

### `POST /api/vouchers/generate`

**Auth:** 🏷️ Flag `master.promos`.

Generate batch voucher untuk promo tertentu.

**Request Body:**
```json
{
  "promotionId": "uuid",
  "quantity": 100,
  "prefix": "LEBARAN"
}
```

---

### `PATCH /api/vouchers/:id/revoke`

**Auth:** 🏷️ Flag `master.promos`.

Cabut voucher.

---

### `DELETE /api/vouchers/:id`

**Auth:** 🏷️ Flag `master.promos`.

---

### `POST /api/promos/validate`

**Auth:** 🔑 Realmio session.

Validasi kode promo/voucher sebelum booking.

**Request Body:**
```json
{
  "code": "LEBARAN25",
  "tripId": "uuid",
  "fare": 85000
}
```

**Response `200`:**
```json
{
  "valid": true,
  "discountType": "percentage",
  "discountValue": 25,
  "discountAmount": 21250,
  "netFare": 63750
}
```

---

## 23. Pricing

### `GET /api/pricing/quote-fare`

**Auth:** 🔑 Realmio session.

Hitung tarif untuk segmen tertentu.

**Query Parameters:**
```
tripId=uuid
originSeq=1
destinationSeq=3
```

**Response `200`:**
```json
{
  "fare": 85000,
  "breakdown": [
    { "legFrom": "Jakarta", "legTo": "Purwakarta", "fare": 40000 },
    { "legFrom": "Purwakarta", "legTo": "Bandung", "fare": 45000 }
  ],
  "mode": "per_leg"
}
```

---

### `GET /api/price-rules`

**Auth:** 🔑 Realmio session.

---

### `POST /api/price-rules`

**Auth:** 🔑 Realmio session (atau flag khusus).

**Request Body:**
```json
{
  "scope": "pattern",
  "patternId": "uuid",
  "mode": "per_leg",
  "legPrices": [
    { "fromSeq": 1, "toSeq": 2, "price": 40000 },
    { "fromSeq": 2, "toSeq": 3, "price": 45000 }
  ]
}
```

---

### `PUT /api/price-rules/:id`

**Auth:** 🔑 Realmio session.

---

### `DELETE /api/price-rules/:id`

**Auth:** 🔑 Realmio session.

---

## 24. Manifest

### `GET /api/trips/:id/manifest`

**Auth:** 🏷️ Flag `page.manifest`.

Data manifest perjalanan (semua penumpang).

**Response `200`:**
```json
{
  "tripId": "uuid",
  "serviceDate": "2026-04-10",
  "route": "Jakarta → Bandung",
  "vehicle": "B 1234 XY",
  "driver": "Budi",
  "passengers": [
    {
      "seatNo": "A1",
      "name": "Penumpang A",
      "origin": "Jakarta",
      "destination": "Bandung",
      "idNumber": "320101xxx"
    }
  ],
  "totalPassengers": 35
}
```

---

### `POST /api/trips/:id/manifest/print`

**Auth:** 🏷️ Flag `page.manifest`.

Generate print payload manifest untuk thermal printer 80mm.

**Response `200`:**
```json
{
  "printPayload": { ... },
  "printJobId": "uuid"
}
```

---

## 25. Scheduler (Manajemen Kalender)

### `GET /api/scheduler/calendar`

**Auth:** 🔑 Realmio session.

Kalender jadwal trip berdasarkan trip bases.

**Query Parameters:**
```
month=2026-04
patternId=uuid
```

---

### `GET /api/scheduler/pattern-stop-map`

**Auth:** 🔑 Realmio session.

Mapping pattern → stops untuk keperluan UI scheduler.

---

### `GET /api/scheduler/stop-exceptions`

**Auth:** 🔑 Realmio session.

Pengecualian stop tertentu pada tanggal tertentu.

---

### `POST /api/scheduler/exceptions`

**Auth:** 🏷️ Flag `action.trip.close`.

Tambah pengecualian jadwal (trip tidak jalan di tanggal tertentu).

**Request Body:**
```json
{
  "baseId": "uuid",
  "exceptionDate": "2026-04-10",
  "reason": "Libur nasional"
}
```

---

### `DELETE /api/scheduler/exceptions/:id`

**Auth:** 🏷️ Flag `action.trip.close`.

---

### `POST /api/scheduler/stop-exceptions`

**Auth:** 🏷️ Flag `action.trip.close`.

Stop tertentu tidak dilayani pada tanggal tertentu.

---

### `DELETE /api/scheduler/stop-exceptions/:id`

**Auth:** 🏷️ Flag `action.trip.close`.

---

### `PATCH /api/scheduler/trips/:id/assign`

**Auth:** 🏷️ Flag `action.trip.close`.

Assign driver dan kendaraan ke trip.

**Request Body:**
```json
{
  "driverId": "uuid",
  "vehicleId": "uuid"
}
```

---

## 26. Laporan

Semua laporan mendukung query parameter berikut:

```
dateFrom=YYYY-MM-DD
dateTo=YYYY-MM-DD
dateMode=departure|paid|created    # Kolom tanggal yang digunakan
outletId=uuid                       # Filter per outlet
patternId=uuid                      # Filter per rute
channelType=counter|mobile|agent
```

Khusus `trip-profitability` dan `load-factor` selalu menggunakan `dateMode=departure`.

---

### `GET /api/reports/filter-options`

**Auth:** 🏷️ Salah satu flag report (revenue / sales / dll).

Opsi filter (outlet, pattern, channel) untuk UI laporan.

---

### `GET /api/reports/revenue`

**Auth:** 🏷️ Flag `report.revenue`.

**Response `200`:**
```json
{
  "summary": {
    "totalRevenue": 125000000,
    "ticketRevenue": 110000000,
    "cargoRevenue": 15000000,
    "totalBookings": 1450
  },
  "byDate": [
    { "date": "2026-04-01", "revenue": 4500000, "bookings": 52 }
  ]
}
```

---

### `GET /api/reports/sales`

**Auth:** 🏷️ Flag `report.sales`.

---

### `GET /api/reports/trip-profitability`

**Auth:** 🏷️ Flag `report.trip_profitability`.

Laba rugi per trip.

---

### `GET /api/reports/load-factor`

**Auth:** 🏷️ Flag `report.load_factor`.

Tingkat pengisian kursi (load factor) per trip/rute.

---

### `GET /api/reports/cancellations`

**Auth:** 🏷️ Flag `report.cancellations`.

Laporan pembatalan booking.

---

### `GET /api/reports/cargo`

**Auth:** 🏷️ Flag `report.cargo`.

Laporan pengiriman kargo.

---

### `GET /api/reports/payments`

**Auth:** 🏷️ Flag `report.payments`.

Laporan pembayaran per metode.

---

### `GET /api/reports/commercial-fee`

**Auth:** 🏷️ Flag `report.commercial_fee`.

Laporan biaya komersial (fee agen, komisi, dll).

---

## 27. Dashboard

### `GET /api/dashboard/today`

**Auth:** 🏷️ Flag `page.dashboard`.

Ringkasan operasional hari ini.

**Response `200`:**
```json
{
  "date": "2026-04-10",
  "summary": {
    "totalTrips": 8,
    "totalBookings": 145,
    "totalRevenue": 12325000,
    "totalCargo": 23,
    "avgLoadFactor": 78.5
  },
  "alerts": [
    { "type": "low_load", "tripId": "uuid", "message": "Load factor < 50%" }
  ],
  "recentBookings": [
    {
      "bookingCode": "TRN-20260410-145",
      "passengerName": "Siti",
      "route": "JKT → BDG",
      "amount": 85000,
      "createdAt": "2026-04-10T09:45:00Z"
    }
  ]
}
```

---

## 28. Kasir

### `GET /api/cashier/active`

**Auth:** 🏷️ Flag `page.cashier`.

Sesi kasir aktif milik user yang sedang login.

---

### `GET /api/cashier/active/summary`

**Auth:** 🏷️ Flag `page.cashier`.

Ringkasan transaksi sesi kasir aktif (auto-refresh 30 detik di frontend).

**Response `200`:**
```json
{
  "sessionId": "uuid",
  "openedAt": "2026-04-10T07:00:00Z",
  "transactions": {
    "bookings": { "count": 45, "total": 3825000 },
    "cargo": { "count": 8, "total": 340000 },
    "refunds": { "count": 1, "total": -85000 }
  },
  "byMethod": {
    "cash": 3200000,
    "qris": 580000,
    "transfer": 300000
  },
  "netTotal": 4080000
}
```

---

### `GET /api/cashier/history`

**Auth:** 🏷️ Flag `page.cashier`.

Riwayat sesi kasir.

---

### `GET /api/cashier/:id/detail`

**Auth:** 🏷️ Flag `page.cashier`.

Detail lengkap sesi kasir beserta seluruh transaksi.

---

### `POST /api/cashier/open`

**Auth:** 🏷️ Flag `page.cashier`.

Buka sesi kasir baru.

**Request Body:**
```json
{
  "outletId": "uuid",
  "openingCash": 500000
}
```

**Response `201`:**
```json
{
  "sessionId": "uuid",
  "status": "open",
  "openedAt": "2026-04-10T07:00:00Z"
}
```

---

### `POST /api/cashier/close`

**Auth:** 🏷️ Flag `page.cashier`.

Ajukan penutupan sesi kasir (status → closing, menunggu approval).

**Request Body:**
```json
{
  "closingCash": 4580000,
  "notes": "Selesai shift pagi"
}
```

---

### `PATCH /api/cashier/:id/approve`

**Auth:** 🏷️ Flag `page.cashier`.

Approve penutupan sesi kasir (oleh supervisor/manager). Status → closed.

---

## 29. Refund

### `GET /api/refunds`

**Auth:** 🏷️ Flag `page.refunds`.

**Query Parameters:**
```
status=pending|approved|processed|rejected
bookingCode=TRN-xxx
dateFrom=YYYY-MM-DD
dateTo=YYYY-MM-DD
```

---

### `GET /api/refunds/:id`

**Auth:** 🏷️ Flag `page.refunds`.

---

### `POST /api/refunds`

**Auth:** 🏷️ Flag `action.refund.create`.

Buat permintaan refund. Biasanya dilakukan oleh CSO.

**Request Body:**
```json
{
  "bookingId": "uuid",
  "passengerId": "uuid",
  "amount": 85000,
  "reason": "Penumpang sakit, tidak bisa berangkat",
  "refundMethod": "cash"
}
```

**Response `201`:**
```json
{
  "refundId": "uuid",
  "status": "pending",
  "amount": 85000,
  "createdAt": "2026-04-10T10:00:00Z"
}
```

---

### `PATCH /api/refunds/:id/approve`

**Auth:** 🏷️ Flag `action.refund.approve`.

Approve refund (oleh manager/finance).

---

### `PATCH /api/refunds/:id/process`

**Auth:** 🏷️ Flag `action.refund.process`.

Proses/bayarkan refund ke penumpang (status → processed).

**Request Body:**
```json
{
  "processedAmount": 85000,
  "processedMethod": "cash",
  "notes": "Dikembalikan tunai"
}
```

---

### `PATCH /api/refunds/:id/reject`

**Auth:** 🏷️ Flag `action.refund.approve`.

Tolak permintaan refund.

**Request Body:**
```json
{
  "reason": "Tidak memenuhi syarat refund"
}
```

---

## 30. Pelanggan (CRM)

### `GET /api/customers`

**Auth:** 🏷️ Flag `page.customers`.

**Query Parameters:**
```
tag=regular|vip|frequent|blacklist
search=nama atau phone
page=1
limit=50
```

---

### `GET /api/customers/search`

**Auth:** 🏷️ Flag `page.customers`.

**Query Parameters:**
```
q=nama atau nomor telepon
```

---

### `GET /api/customers/:id`

**Auth:** 🏷️ Flag `page.customers`.

Detail pelanggan beserta riwayat booking.

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "Budi Santoso",
  "phone": "081234567890",
  "email": "budi@gmail.com",
  "tag": "vip",
  "totalBookings": 24,
  "totalSpent": 2040000,
  "lastBooking": "2026-04-05",
  "bookingHistory": [...]
}
```

---

### `POST /api/customers`

**Auth:** 🏷️ Flag `page.customers`.

**Request Body:**
```json
{
  "name": "Nama Pelanggan",
  "phone": "08xxx",
  "email": "email@example.com",
  "tag": "regular"
}
```

---

### `PATCH /api/customers/:id`

**Auth:** 🏷️ Flag `page.customers`.

Update data / tag pelanggan.

**Request Body:**
```json
{
  "tag": "vip",
  "notes": "Pelanggan loyal 2 tahun"
}
```

---

## 31. Notifikasi

### `GET /api/notifications`

**Auth:** 🔑 Realmio session.

Notifikasi untuk user yang sedang login.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "type": "refund_approved",
    "title": "Refund Disetujui",
    "message": "Refund TRN-20260410-001 telah disetujui oleh Manager",
    "isRead": false,
    "createdAt": "2026-04-10T10:30:00Z"
  }
]
```

---

### `PATCH /api/notifications/read-all`

**Auth:** 🔑 Realmio session.

Tandai semua notifikasi sebagai dibaca.

---

### `DELETE /api/notifications/:id`

**Auth:** 🔑 Realmio session.

Hapus notifikasi.

---

## 32. Finance — Cost Templates

### `GET /api/cost-templates`

**Auth:** 🔑 Realmio session.

---

### `GET /api/cost-templates/:id`

**Auth:** 🔑 Realmio session.

---

### `GET /api/cost-templates/:templateId/items`

**Auth:** 🔑 Realmio session.

---

### `POST /api/cost-templates`

**Auth:** 🏷️ Flag `master.cost_templates`.

**Request Body:**
```json
{
  "name": "Template Biaya Bus Eksekutif",
  "description": "Template biaya operasional standar"
}
```

---

### `PUT /api/cost-templates/:id`

**Auth:** 🏷️ Flag `master.cost_templates`.

---

### `DELETE /api/cost-templates/:id`

**Auth:** 🏷️ Flag `master.cost_templates`.

---

### `POST /api/cost-templates/:templateId/items`

**Auth:** 🏷️ Flag `master.cost_templates`.

Tambah item biaya ke template.

**Request Body:**
```json
{
  "category": "driver",
  "name": "Uang jalan driver",
  "defaultAmount": 350000
}
```

---

### `PUT /api/cost-items/:id`

**Auth:** 🏷️ Flag `master.cost_templates`.

---

### `DELETE /api/cost-items/:id`

**Auth:** 🏷️ Flag `master.cost_templates`.

---

## 33. Maintenance Kendaraan

### `GET /api/maintenance/alerts`

**Auth:** 🔑 Realmio session.

Alert kendaraan yang mendekati jadwal servis.

**Response `200`:**
```json
[
  {
    "vehicleId": "uuid",
    "plateNumber": "B 1234 XY",
    "alertType": "service_due",
    "message": "Servis berkala jatuh tempo dalam 3 hari",
    "dueDate": "2026-04-13"
  }
]
```

---

### `GET /api/vehicles/:vehicleId/maintenance`

**Auth:** 🔑 Realmio session.

Riwayat servis kendaraan.

---

### `POST /api/vehicles/:vehicleId/maintenance`

**Auth:** 🏷️ Flag `master.vehicles`.

Catat servis kendaraan baru.

**Request Body:**
```json
{
  "type": "service",
  "description": "Servis berkala 10.000 km",
  "cost": 1500000,
  "serviceDate": "2026-04-10",
  "nextServiceDate": "2026-07-10",
  "odometer": 85000,
  "workshopName": "Bengkel Maju Jaya"
}
```

---

### `PATCH /api/maintenance/:id`

**Auth:** 🏷️ Flag `master.vehicles`.

---

### `DELETE /api/maintenance/:id`

**Auth:** 🏷️ Flag `master.vehicles`.

---

## 34. Settings Operator

### `GET /api/settings`

**Auth:** 🔑 Realmio session.

Baca pengaturan branding operator (nama perusahaan, logo, warna, dll).

**Response `200`:**
```json
{
  "companyName": "PT Transity Nusantara",
  "logoUrl": "https://...",
  "primaryColor": "#1E40AF",
  "address": "Jl. Terminal No. 1",
  "phone": "021-12345678",
  "tagline": "Aman, Nyaman, Tepat Waktu"
}
```

---

### `PUT /api/settings`

**Auth:** 🏷️ Flag `admin.flags.manage`.

Update pengaturan branding.

---

### `POST /api/settings/logo`

**Auth:** 🏷️ Flag `admin.flags.manage`.

Upload logo operator (multipart form).

---

## 35. Admin — Staff & RBAC

### `GET /api/admin/roles`

**Auth:** 🏷️ Flag `admin.flags.manage` atau `admin.staff.manage`.

Daftar semua role yang tersedia.

**Response `200`:**
```json
[
  { "id": "owner", "name": "Owner" },
  { "id": "manager", "name": "Manager" },
  { "id": "finance", "name": "Finance" },
  { "id": "cso", "name": "Customer Service Officer" }
]
```

---

### `GET /api/admin/role-flags`

**Auth:** 🏷️ Flag `admin.flags.manage`.

Semua flag dan status enable/disable per role.

---

### `PUT /api/admin/role-flags/:roleId/:flagId`

**Auth:** 🏷️ Flag `admin.flags.manage`.

Toggle flag untuk role tertentu.

**Request Body:**
```json
{ "enabled": true }
```

---

### `GET /api/admin/staff`

**Auth:** 🏷️ Flag `admin.staff.manage`.

Daftar semua staff.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "Nama Staff",
    "email": "staff@perusahaan.id",
    "roleId": "cso",
    "outletId": "uuid",
    "isActive": true
  }
]
```

---

### `POST /api/admin/staff`

**Auth:** 🏷️ Flag `admin.staff.manage`.

Tambah staff baru.

**Request Body:**
```json
{
  "name": "Nama Staff Baru",
  "email": "staff@perusahaan.id",
  "password": "password123",
  "roleId": "cso",
  "outletId": "uuid"
}
```

---

## 36. Dev-Only Endpoints

Endpoint berikut **diblokir total di production** (`NODE_ENV === 'production'`). Di development, memerlukan flag `admin.flags.manage`.

### `POST /api/seed`

Isi database dengan data dummy untuk testing.

### `POST /api/seed/rbac`

Isi database dengan data RBAC default (roles, flags, role_flags).

---

## Appendix — Daftar Feature Flags

| Flag | Deskripsi | Role Default |
|------|-----------|--------------|
| `page.cso` | Akses halaman CSO | cso, spv_cso, manager, owner |
| `page.cargo` | Akses halaman Kargo | cso, spv_cso, operations, manager, owner |
| `page.manifest` | Akses halaman Manifest | spv_operations, operations, manager, owner |
| `page.schedule.closed` | Lihat trip closed di Jadwal | spv_operations, manager, owner |
| `page.cso.view_closed` | Lihat trip closed di CSO | spv_cso, manager, owner |
| `page.dashboard` | Akses Dashboard | semua role |
| `page.cashier` | Akses Kasir | cso, spv_cso, manager, owner |
| `page.refunds` | Akses Refund | cso, finance, manager, owner |
| `page.customers` | Akses CRM Pelanggan | spv_cso, manager, owner |
| `action.booking.create` | Buat booking | cso, spv_cso, manager, owner |
| `action.booking.cancel` | Batalkan booking | spv_cso, manager, owner |
| `action.passenger.unseat` | Unseat penumpang | spv_cso, manager, owner |
| `action.passenger.assign_seat` | Assign kursi | spv_cso, manager, owner |
| `action.passenger.reschedule` | Reschedule penumpang | spv_cso, manager, owner |
| `action.payment.create` | Catat pembayaran | cso, spv_cso, manager, owner |
| `action.cargo.create` | Buat kargo | cso, spv_cso, operations, manager, owner |
| `action.cargo.manage` | Kelola status kargo | operations, spv_operations, manager, owner |
| `action.trip.materialize` | Materialize virtual trip | cso, spv_cso, manager, owner |
| `action.trip.close` | Tutup trip | spv_operations, manager, owner |
| `action.trip.batch_reschedule` | Batch reschedule saat close | spv_operations, manager, owner |
| `action.spj.create` | Buat SPJ | spv_operations, manager, owner |
| `action.spj.issue` | Terbitkan SPJ | spv_operations, manager, owner |
| `action.spj.settle` | Selesaikan SPJ | finance, manager, owner |
| `action.refund.create` | Buat refund | cso, spv_cso, manager, owner |
| `action.refund.approve` | Approve/tolak refund | finance, manager, owner |
| `action.refund.process` | Proses bayar refund | finance, manager, owner |
| `master.stops` | CRUD Stops | manager, owner |
| `master.outlets` | CRUD Outlets | manager, owner |
| `master.vehicles` | CRUD Kendaraan | spv_operations, manager, owner |
| `master.drivers` | CRUD Driver | spv_operations, manager, owner |
| `master.layouts` | CRUD Layout Kursi | manager, owner |
| `master.trip_patterns` | CRUD Trip Patterns | manager, owner |
| `master.trips` | CRUD Trip Bases & Trips | manager, owner |
| `master.promos` | CRUD Promo & Voucher | manager, owner |
| `master.cargo_types` | CRUD Tipe Kargo | manager, owner |
| `master.cargo_rates` | CRUD Tarif Kargo | manager, owner |
| `master.cost_templates` | CRUD Cost Templates | finance, manager, owner |
| `report.revenue` | Laporan Pendapatan | finance, manager, owner |
| `report.sales` | Laporan Penjualan | finance, manager, owner |
| `report.trip_profitability` | Laporan Laba Rugi Trip | finance, manager, owner |
| `report.load_factor` | Laporan Load Factor | spv_operations, manager, owner |
| `report.cancellations` | Laporan Pembatalan | finance, manager, owner |
| `report.cargo` | Laporan Kargo | finance, manager, owner |
| `report.payments` | Laporan Pembayaran | finance, manager, owner |
| `report.commercial_fee` | Laporan Biaya Komersial | finance, manager, owner |
| `admin.staff.manage` | Kelola Staff | manager, owner |
| `admin.flags.manage` | Kelola Feature Flags & Settings | owner |

---

## Appendix — WebSocket Events

Koneksi WebSocket via Socket.IO di endpoint yang sama dengan HTTP server.

### Rooms

| Room | Pattern | Subscribe Kapan |
|------|---------|-----------------|
| Trip | `trip:{tripId}` | Saat CSO membuka seatmap trip |
| Base | `base:{baseId}` | Saat melihat jadwal trip base |
| CSO | `cso:{outletId}:{serviceDate}` | Saat CSO membuka halaman pilih trip |

### Events (Server → Client)

| Event | Payload | Trigger |
|-------|---------|---------|
| `INVENTORY_UPDATED` | `{ tripId }` | Setelah hold/release/booking |
| `TRIP_STATUS_CHANGED` | `{ tripId, status }` | Trip close/cancel |
| `HOLDS_RELEASED` | `{ tripId }` | Batch release expired holds |
| `TRIP_MATERIALIZED` | `{ tripId, baseId, serviceDate }` | Virtual trip dimaterialize |
| `TRIP_CANCELED` | `{ tripId }` | Trip dibatalkan |
