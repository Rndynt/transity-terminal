# TransityConsole API Requirements — Payment & Voucher

Dokumen ini berisi requirement API baru yang dibutuhkan oleh TransityApp (frontend) untuk mendukung fitur pemilihan metode pembayaran, booking hold (unpaid), dan voucher/promo pada flow pemesanan tiket.

---

## Flow Pemesanan (Baru)

```
1. User isi data penumpang (BookingConfirmPage)
2. Klik "Pilih Pembayaran" →
   POST /api/gateway/bookings (tanpa paymentMethod) →
   Booking dibuat dengan status "held" + holdExpiresAt
3. User masuk PaymentPage → lihat countdown timer
4. Pesanan muncul di "Pesanan Saya" dengan status "Menunggu Pembayaran"
5. User pilih metode bayar, input voucher (opsional)
6. Klik "Bayar" →
   POST /api/gateway/bookings/{bookingId}/pay
7. Booking berubah ke status "confirmed"
8. Jika timer habis → booking otomatis expired/cancelled oleh backend
```

---

## 1. Update POST /api/gateway/bookings (Hold/Unpaid)

Endpoint booking yang sudah ada sekarang digunakan untuk **membuat booking tanpa pembayaran** (hold). Field `paymentMethod` menjadi opsional — jika tidak dikirim, booking dibuat dengan status `held`.

### Request

```
POST /api/gateway/bookings
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "tripId": "nusa-shuttle:abc-123",
  "serviceDate": "2026-04-08",
  "originStopId": "...",
  "destinationStopId": "...",
  "originSeq": 1,
  "destinationSeq": 5,
  "passengers": [
    {
      "fullName": "Rendy",
      "phone": "083139882231",
      "seatNo": "5A"
    }
  ]
}
```

### Perubahan

| Field           | Type   | Required | Keterangan                                                                  |
|-----------------|--------|----------|-----------------------------------------------------------------------------|
| `paymentMethod` | string | **Tidak** (sebelumnya wajib) | Jika tidak dikirim → booking dibuat sebagai held/unpaid        |

### Response — 201 Created

```json
{
  "bookingId": "bk_abc123",
  "status": "held",
  "totalAmount": "95000",
  "holdExpiresAt": "2026-04-08T10:30:00Z",
  "paymentIntent": null,
  "qrData": [],
  "passengers": [...],
  "tripId": "nusa-shuttle:abc-123"
}
```

### Catatan

- `holdExpiresAt` wajib diisi — ini adalah deadline pembayaran. Rekomendasi: 15-30 menit dari waktu booking.
- Saat status `held`, kursi harus sudah ter-reserve di Terminal sehingga tidak bisa dipesan orang lain.
- QR data tidak perlu digenerate sampai booking dibayar (`confirmed`).
- Jika waktu hold habis (`holdExpiresAt` terlewat), backend harus otomatis:
  1. Ubah status booking ke `expired` atau `cancelled`
  2. Lepaskan kursi yang di-hold di Terminal
- Terminal sudah support fitur booking tanpa pembayaran — Console perlu meneruskan ke Terminal tanpa mengirim payment info.

---

## 2. POST /api/gateway/bookings/{bookingId}/pay (BARU)

Endpoint baru untuk membayar booking yang sudah di-hold.

### Request

```
POST /api/gateway/bookings/{bookingId}/pay
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "paymentMethod": "qris",
  "voucherCode": "DISKON10"
}
```

| Field           | Type   | Required | Keterangan                                                             |
|-----------------|--------|----------|------------------------------------------------------------------------|
| `paymentMethod` | string | Ya       | ID metode pembayaran (dari `GET /api/gateway/payments/methods`)        |
| `voucherCode`   | string | Tidak    | Kode voucher yang sudah divalidasi (opsional)                          |

### Response — 200 OK

```json
{
  "bookingId": "bk_abc123",
  "status": "confirmed",
  "totalAmount": "85000",
  "holdExpiresAt": null,
  "paymentIntent": {
    "paymentId": "pay_xyz",
    "method": "qris",
    "amount": "85000"
  },
  "qrData": [
    {
      "passengerId": "p1",
      "seatNo": "5A",
      "fullName": "Rendy",
      "qrToken": "...",
      "qrPayload": "..."
    }
  ],
  "passengers": [...],
  "tripId": "nusa-shuttle:abc-123"
}
```

### Error Responses

| Status | Kode              | Keterangan                                      |
|--------|-------------------|-------------------------------------------------|
| 400    | `HOLD_EXPIRED`    | Waktu hold sudah habis, kursi sudah dilepas     |
| 400    | `ALREADY_PAID`    | Booking ini sudah dibayar                       |
| 404    | `BOOKING_NOT_FOUND`| Booking ID tidak ditemukan                     |
| 400    | `INVALID_METHOD`  | Metode pembayaran tidak valid/tidak aktif        |
| 400    | `VOUCHER_INVALID` | Kode voucher tidak valid atau sudah kadaluarsa   |

### Catatan

- Endpoint harus memvalidasi bahwa `holdExpiresAt` belum terlewat sebelum memproses pembayaran.
- Jika `voucherCode` dikirim, validasi dan terapkan diskon ke `totalAmount`.
- Setelah berhasil bayar:
  1. Ubah status ke `confirmed`
  2. Generate QR data untuk setiap penumpang
  3. Set `holdExpiresAt` ke `null` (tidak lagi perlu countdown)
  4. Konfirmasi pembayaran ke Terminal

---

## 3. GET /api/gateway/payments/methods

Mengembalikan daftar metode pembayaran yang tersedia dan aktif.

### Request

```
GET /api/gateway/payments/methods
Authorization: Bearer <token>   (opsional — bisa public atau per-user)
```

Tidak ada query parameter.

### Response — 200 OK

```json
{
  "methods": [
    {
      "id": "qris",
      "name": "QRIS",
      "type": "qris",
      "icon": "https://cdn.example.com/icons/qris.png",
      "description": "Scan QR dari e-wallet atau m-banking",
      "enabled": true
    },
    {
      "id": "ewallet_gopay",
      "name": "GoPay",
      "type": "ewallet",
      "icon": "https://cdn.example.com/icons/gopay.png",
      "description": "Bayar via GoPay",
      "enabled": true
    },
    {
      "id": "va_bca",
      "name": "Virtual Account BCA",
      "type": "virtual_account",
      "icon": null,
      "description": "Pembayaran via VA BCA",
      "enabled": true
    }
  ]
}
```

### Field per Method

| Field         | Type    | Required | Keterangan                                                                                       |
|---------------|---------|----------|--------------------------------------------------------------------------------------------------|
| `id`          | string  | Ya       | ID unik, akan dikirim sebagai `paymentMethod` saat pay booking                                  |
| `name`        | string  | Ya       | Nama tampil (contoh: "GoPay", "Transfer BCA")                                                   |
| `type`        | string  | Ya       | Kategori: `qris`, `ewallet`, `bank_transfer`, `virtual_account`, `other`                        |
| `icon`        | string? | Tidak    | URL ikon/logo (jika null, frontend pakai ikon default per type)                                  |
| `description` | string? | Tidak    | Deskripsi singkat (ditampilkan di bawah nama)                                                    |
| `enabled`     | boolean | Ya       | Apakah method ini aktif. Frontend hanya tampilkan yang `enabled: true`                           |

### Alternatif Response Format

Frontend juga mendukung format array langsung:

```json
[
  { "id": "qris", "name": "QRIS", ... },
  { "id": "ewallet_gopay", "name": "GoPay", ... }
]
```

Atau format `{ "data": [...] }`.

### Catatan

- Jika endpoint ini belum tersedia, TransityApp akan menggunakan daftar default (QRIS, GoPay, OVO, DANA, ShopeePay, VA BCA/Mandiri/BNI, Transfer Bank).
- Nilai `id` dari method akan dikirimkan sebagai `paymentMethod` pada `POST /api/gateway/bookings/{id}/pay`.
- Urutan tampil di frontend dikelompokkan berdasarkan `type` dengan urutan: QRIS → E-Wallet → Virtual Account → Transfer Bank → Lainnya.

---

## 4. POST /api/gateway/vouchers/validate

Validasi kode voucher/promo sebelum pembayaran dilakukan. Mengembalikan apakah voucher valid dan berapa diskon yang didapat.

### Request

```
POST /api/gateway/vouchers/validate
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "code": "DISKON10",
  "tripId": "bk_abc123",
  "amount": 95000
}
```

| Field    | Type   | Required | Keterangan                                                      |
|----------|--------|----------|-----------------------------------------------------------------|
| `code`   | string | Ya       | Kode voucher yang dimasukkan user                               |
| `tripId` | string | Ya       | Booking ID (digunakan untuk validasi scope voucher)              |
| `amount` | number | Ya       | Total harga sebelum diskon (untuk voucher berbasis persentase)   |

### Response — 200 OK (Valid)

```json
{
  "valid": true,
  "discount": 10000,
  "message": "Voucher berhasil diterapkan"
}
```

### Response — 200 OK (Tidak Valid)

```json
{
  "valid": false,
  "discount": 0,
  "message": "Kode voucher sudah kadaluarsa"
}
```

### Response — 400 / 404 (Error)

```json
{
  "error": "Kode voucher tidak ditemukan",
  "code": "VOUCHER_NOT_FOUND"
}
```

| Field      | Type    | Keterangan                                                   |
|------------|---------|--------------------------------------------------------------|
| `valid`    | boolean | Apakah voucher bisa dipakai                                  |
| `discount` | number  | Jumlah potongan dalam Rupiah (0 jika tidak valid)            |
| `message`  | string? | Pesan untuk ditampilkan ke user                              |

### Catatan

- Jika endpoint ini belum tersedia, frontend akan menampilkan error "Kode voucher tidak valid" untuk semua input.
- Validasi bersifat read-only (tidak mengunci voucher). Voucher baru di-redeem saat pembayaran berhasil.
- Scope voucher bisa per-operator, per-rute, atau global — tergantung implementasi Console.

---

## 5. GET /api/gateway/bookings (List — UPDATE DIBUTUHKAN)

### Masalah Saat Ini

Response saat ini dari Console:
```json
{
  "data": [
    {
      "bookingId": "49f340ac-...",
      "externalBookingId": null,
      "operatorId": "5c472abb-...",
      "operatorName": "Nusa Shuttle",
      "tripId": "nusa-shuttle:3145ae85-...",
      "status": "cancelled",
      "passengerName": "Anta",
      "passengerPhone": "083139882231",
      "seatNumbers": ["4C"],
      "totalAmount": "0.00",
      "discountAmount": null,
      "finalAmount": "0.00",
      "paymentMethod": null,
      "holdExpiresAt": null,
      "serviceDate": "2026-04-08",
      "createdAt": "2026-04-07T20:49:48.211Z"
    }
  ]
}
```

**Yang kurang / harus diperbaiki:**
1. **Tidak ada info rute** — customer tidak tahu dari mana ke mana perjalanannya
2. **Tidak ada nama rute** — `patternName` seperti "Jakarta → Bandung" tidak ada
3. **`totalAmount` = "0.00"** — harga seharusnya terisi dari fare saat booking dibuat
4. **Tidak ada `holdExpiresAt`** — untuk booking held, harus ada deadline pembayaran
5. **Tidak ada waktu keberangkatan** — customer butuh tahu jam berapa berangkat

### Response yang Dibutuhkan

Setiap item di list booking HARUS mengandung field berikut agar customer bisa memahami pesanannya:

```json
{
  "data": [
    {
      "bookingId": "49f340ac-...",
      "tripId": "nusa-shuttle:3145ae85-...",
      "serviceDate": "2026-04-08",
      "status": "held",

      "operatorName": "Nusa Shuttle",
      "patternName": "Jakarta → Bandung",

      "origin": {
        "name": "Cawang",
        "city": "Jakarta",
        "departAt": "2026-04-08T05:00:00Z"
      },
      "destination": {
        "name": "Pasteur",
        "city": "Bandung",
        "arriveAt": "2026-04-08T08:00:00Z"
      },

      "passengerCount": 1,
      "seatNumbers": ["4C"],

      "totalAmount": "95000",
      "finalAmount": "95000",

      "holdExpiresAt": "2026-04-08T05:30:00Z",
      "createdAt": "2026-04-07T20:49:48.211Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

### Field Wajib per Item

| Field            | Type     | Wajib | Keterangan                                                                    |
|------------------|----------|-------|-------------------------------------------------------------------------------|
| `bookingId`      | string   | Ya    | ID unik booking                                                              |
| `tripId`         | string   | Ya    | ID trip (format `operator:id`)                                                |
| `serviceDate`    | string   | Ya    | Tanggal perjalanan (YYYY-MM-DD)                                               |
| `status`         | string   | Ya    | `held` / `confirmed` / `completed` / `cancelled` / `expired`                 |
| `operatorName`   | string   | Ya    | Nama operator (contoh: "Nusa Shuttle")                                        |
| `patternName`    | string   | Ya    | Nama rute yang mudah dipahami customer (contoh: "Jakarta → Bandung")          |
| `origin`         | object   | **Ya** | `{ name, city, departAt }` — titik keberangkatan + jam berangkat             |
| `destination`    | object   | **Ya** | `{ name, city, arriveAt }` — titik tujuan + jam tiba                         |
| `passengerCount` | number   | Ya    | Jumlah penumpang                                                              |
| `seatNumbers`    | string[] | Ya    | Array nomor kursi                                                             |
| `totalAmount`    | string   | **Ya** | Harga total sebelum diskon. **HARUS > 0** untuk booking normal                |
| `finalAmount`    | string   | Ya    | Harga setelah diskon (sama dengan totalAmount jika tidak ada diskon)           |
| `holdExpiresAt`  | string?  | **Ya** | ISO datetime deadline pembayaran. `null` jika sudah dibayar/expired           |
| `createdAt`      | string   | Ya    | ISO datetime pembuatan booking                                                |

### Perbaikan yang Dibutuhkan di Console

1. **Tambahkan `origin` dan `destination` object** — ambil dari data trip/stops yang sudah tersimpan saat booking dibuat
2. **Tambahkan `patternName`** — ambil dari pattern trip (sudah ada di trip search response)
3. **Fix `totalAmount`** — harus berisi harga fare × jumlah penumpang, bukan "0.00"
4. **Tambahkan `holdExpiresAt`** — untuk booking berstatus `held`, set deadline 15-30 menit dari waktu pembuatan
5. **Tambahkan `passengerCount`** — bisa dihitung dari `seatNumbers.length`

---

## 6. GET /api/gateway/bookings/{bookingId} (Detail — UPDATE DIBUTUHKAN)

### Masalah Saat Ini

Response detail saat ini mengandung masalah yang sama dengan list — field penting tidak tersedia. Customer yang membuka detail pesanan harus bisa melihat semua info perjalanannya.

### Response yang Dibutuhkan

```json
{
  "bookingId": "49f340ac-...",
  "tripId": "nusa-shuttle:3145ae85-...",
  "serviceDate": "2026-04-08",
  "status": "held",

  "operatorName": "Nusa Shuttle",
  "operatorSlug": "nusa-shuttle",
  "patternCode": "JKT-BDG-02",
  "patternName": "Jakarta → Bandung · via Grogol — Pasteur",

  "origin": {
    "stopId": "7584bc05-...",
    "name": "Daan Mogot Grogol",
    "city": "Jakarta",
    "departAt": "2026-04-08T05:00:00Z"
  },
  "destination": {
    "stopId": "e2bd6dda-...",
    "name": "Buah Batu",
    "city": "Bandung",
    "arriveAt": "2026-04-08T08:10:00Z"
  },

  "passengers": [
    {
      "id": "p1",
      "fullName": "Rendy",
      "phone": "083139882231",
      "seatNo": "4B",
      "fareAmount": "95000"
    }
  ],

  "totalAmount": "95000",
  "discountAmount": "0",
  "finalAmount": "95000",

  "holdExpiresAt": "2026-04-08T05:30:00Z",

  "paymentMethod": null,
  "payments": [],
  "paymentIntent": null,

  "qrData": [],

  "createdAt": "2026-04-07T20:49:48.211Z"
}
```

### Field Wajib untuk Detail

Semua field dari list booking **PLUS** tambahan berikut:

| Field            | Type      | Wajib  | Keterangan                                                                   |
|------------------|-----------|--------|------------------------------------------------------------------------------|
| `origin.stopId`  | string    | Ya     | ID stop keberangkatan (untuk navigasi ke payment jika resume)                |
| `origin.departAt`| string    | **Ya** | ISO datetime jam keberangkatan                                                |
| `destination.stopId` | string | Ya    | ID stop tujuan                                                                |
| `destination.arriveAt` | string | **Ya** | ISO datetime jam tiba                                                      |
| `passengers`     | array     | **Ya** | Array penumpang dengan `{ id, fullName, phone, seatNo, fareAmount }`         |
| `passengers[].fareAmount` | string | Ya | Harga per penumpang                                                     |
| `holdExpiresAt`  | string?   | **Ya** | Deadline pembayaran. **WAJIB ADA** untuk status `held`                       |
| `patternCode`    | string    | Ya     | Kode rute (contoh: "JKT-BDG-02")                                             |
| `patternName`    | string    | **Ya** | Nama rute lengkap                                                             |
| `operatorName`   | string    | Ya     | Nama operator                                                                 |
| `totalAmount`    | string    | **Ya** | Harga asli (**bukan "0.00"**)                                                 |
| `finalAmount`    | string    | Ya     | Harga setelah diskon                                                          |
| `qrData`         | array     | Ya     | QR tiket digital (kosong jika belum dibayar, terisi setelah confirmed)        |
| `payments`       | array     | Ya     | Riwayat pembayaran                                                            |
| `paymentIntent`  | object?   | Ya     | Info payment intent aktif (null jika belum bayar)                             |

### Sumber Data

Semua field ini seharusnya sudah tersedia di Console karena:
- `origin`, `destination`, `patternName`, `patternCode` → dari data trip/stops yang dipilih saat booking
- `totalAmount` → dari `farePerPerson × jumlah penumpang` (farePerPerson ada di trip search)
- `holdExpiresAt` → di-set saat booking dibuat (15-30 menit dari sekarang)
- `passengers` → dari request body POST /api/gateway/bookings
- `departAt`, `arriveAt` → dari stops data trip

Console harus menyimpan snapshot data trip (rute, stops, waktu) saat booking dibuat, supaya data tetap bisa ditampilkan meskipun trip sudah lewat atau berubah.

---

## Ringkasan Endpoint

| Endpoint                              | Method | Status     | Prioritas |
|---------------------------------------|--------|------------|-----------|
| `/api/gateway/bookings`              | POST   | **Update** | Tinggi    |
| `/api/gateway/bookings/{id}/pay`     | POST   | **Baru**   | Tinggi    |
| `/api/gateway/bookings`             | GET    | **Update** | **Kritis** |
| `/api/gateway/bookings/{id}`        | GET    | **Update** | **Kritis** |
| `/api/gateway/payments/methods`      | GET    | **Baru**   | Tinggi    |
| `/api/gateway/vouchers/validate`     | POST   | **Baru**   | Sedang    |

### Prioritas Implementasi

1. **Kritis** — Fix `GET /api/gateway/bookings` (list) dan `GET /api/gateway/bookings/{id}` (detail):
   - Tambahkan `origin`, `destination` (nama, kota, waktu berangkat/tiba)
   - Tambahkan `patternName` (nama rute)
   - Fix `totalAmount` (harus > 0, hitung dari fare × penumpang)
   - Tambahkan `holdExpiresAt` untuk booking berstatus `held`
   - Tambahkan `passengers` array lengkap di detail
2. **Tinggi** — Update `POST /api/gateway/bookings` untuk support hold tanpa payment + `POST /api/gateway/bookings/{id}/pay` untuk bayar.
3. **Tinggi** — `GET /api/gateway/payments/methods`.
4. **Sedang** — `POST /api/gateway/vouchers/validate`. Fitur voucher bisa ditunda.

### Backend Requirement: Hold Expiry Cleanup

Console perlu mekanisme untuk otomatis mengubah status `held` → `expired` setelah `holdExpiresAt` terlewat:
- **Option A**: Cron job / scheduler yang cek setiap menit
- **Option B**: Lazy evaluation — cek saat ada request ke booking tersebut
- **Option C**: Kombinasi A + B

Yang penting: kursi harus dilepas kembali ke Terminal saat hold expired, supaya bisa dipesan user lain.

### Backend Requirement: Simpan Snapshot Trip Data

Saat booking dibuat, Console **HARUS** menyimpan snapshot data trip berikut ke tabel booking:
- `patternName`, `patternCode` — dari trip search / materialize
- `origin` (stopId, name, city, departAt) — dari stop yang dipilih user
- `destination` (stopId, name, city, arriveAt) — dari stop yang dipilih user
- `farePerPerson` — dari trip search
- `totalAmount` = farePerPerson × jumlah penumpang

Data ini tidak boleh bergantung pada trip yang masih aktif — harus tersimpan permanen di booking, karena trip bisa berubah atau dihapus setelah tanggal keberangkatan lewat.
