# TransityConsole → TransityTerminal Integration Guide

Dokumen ini adalah panduan teknis untuk tim **TransityConsole** agar dapat melakukan agregasi booking dari **TransityApp** ke operator shuttle yang menggunakan **TransityTerminal**.

---

## Arsitektur

```
TransityApp (end-user OTA)
    ↓ request
TransityConsole (gateway aggregator)
    ↓ forward + X-Service-Key
TransityTerminal (per-operator whitelabel)
```

TransityConsole bertindak sebagai gateway aggregator — menerima request dari TransityApp, meneruskan ke instance TransityTerminal milik masing-masing operator shuttle.

---

## Konfigurasi Awal

### 1. Dapatkan Service Key

Setiap operator shuttle yang menggunakan TransityTerminal memiliki `TERMINAL_SERVICE_KEY` di environment mereka. Minta key ini dari admin operator.

### 2. Simpan Base URL per Operator

Setiap operator memiliki base URL sendiri, contoh:
```
https://busmania.transity.web.id
https://nusa-shuttle.transity.web.id
```

### 3. Header Wajib

Semua request ke TransityTerminal harus menyertakan:
```http
X-Service-Key: <service-key-operator>
```

---

## Daftar Endpoint yang Dibutuhkan

### Endpoint Read (GET) — Referensi Data

| # | Endpoint | Kegunaan |
|---|----------|----------|
| 1 | `GET /api/app/operator-info` | Info brand operator (nama, logo, warna) |
| 2 | `GET /api/app/cities` | Daftar kota yang dilayani |
| 3 | `GET /api/app/service-lines` | Daftar rute/layanan aktif |
| 4 | `GET /api/app/trips/search` | Cari trip berdasarkan kota asal, tujuan, tanggal |
| 5 | `GET /api/app/trips/:id` | Detail satu trip |
| 6 | `GET /api/app/trips/:id/seatmap` | Peta kursi + ketersediaan |
| 7 | `GET /api/app/trips/:tripId/reviews` | Ulasan penumpang |

### Endpoint Booking (GET/POST) — Manajemen Booking

| # | Endpoint | Kegunaan |
|---|----------|----------|
| 8 | `GET /api/app/bookings` | Daftar booking dengan filter (status, tanggal, pagination) |
| 9 | `GET /api/app/bookings/:id` | Detail lengkap satu booking |

### Endpoint Write (POST) — Transaksi

| # | Endpoint | Kegunaan |
|---|----------|----------|
| 10 | `POST /api/app/trips/materialize` | Materialize trip virtual → trip nyata (wajib sebelum seatmap untuk virtual trip) |
| 11 | `POST /api/app/bookings` | Buat booking baru (tanpa atau dengan pembayaran langsung) |
| 12 | `POST /api/app/bookings/:id/pay` | Bayar booking yang ditahan (held) — pilih metode pembayaran + voucher opsional |
| 13 | `POST /api/app/bookings/:id/cancel` | Batalkan booking (pending atau confirmed) |
| 14 | `GET /api/app/payments/methods` | Daftar metode pembayaran yang tersedia |
| 15 | `POST /api/app/vouchers/validate` | Validasi kode voucher + hitung diskon |
| 16 | `POST /api/app/payments/webhook` | Konfirmasi pembayaran (dari payment gateway) |

---

## Alur Lengkap: Pencarian → Booking → Pembayaran

### Step 1: Cari Trip

```http
GET /api/app/trips/search?originCity=Jakarta&destinationCity=Bandung&date=2026-04-10&passengers=2
X-Service-Key: sk_live_xxx
```

**Response penting yang harus disimpan per-trip:**

| Field | Digunakan Untuk |
|-------|----------------|
| `tripId` | Parameter booking — bisa `UUID` (real trip) atau `virtual-<uuid>` (jadwal berkala) |
| `serviceDate` | Parameter booking — **wajib** untuk virtual trip |
| `origin.stopId` | Parameter booking sebagai `originStopId` |
| `destination.stopId` | Parameter booking sebagai `destinationStopId` |
| `origin.sequence` | Parameter booking & seatmap sebagai `originSeq` |
| `destination.sequence` | Parameter booking & seatmap sebagai `destinationSeq` |
| `farePerPerson` | Tampilkan ke user (integer, dalam Rupiah) |
| `availableSeats` | Tampilkan ke user |
| `isVirtual` | Jika `true`, trip belum ada di DB — akan otomatis dibuat saat booking pertama |

**Catatan Virtual Trip:**
- `tripId` berformat `virtual-<uuid>` artinya trip berasal dari jadwal berkala dan belum dimaterialize ke database
- **Materialize wajib sebelum seatmap** — trip virtual tidak punya data di database, sehingga seatmap endpoint akan error `Trip not found`
- Setelah dimaterialize, trip selanjutnya akan muncul sebagai real trip di pencarian berikutnya
- **Concurrent materialize aman** — jika dua request materialize masuk bersamaan untuk base+tanggal yang sama, sistem menggunakan database unique constraint untuk memastikan trip hanya dibuat sekali
- **Trip ID dari response materialize selalu berupa UUID real** (bukan `virtual-*` lagi) — gunakan UUID ini untuk semua request selanjutnya

### Step 2: Materialize Trip Virtual (Jika `isVirtual: true`)

Langkah ini **wajib** jika trip yang dipilih user berstatus virtual. Jika trip sudah real (`isVirtual: false`), langkah ini dilewati.

```http
POST /api/app/trips/materialize
X-Service-Key: sk_live_xxx
Content-Type: application/json

{
  "baseId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceDate": "2026-04-10"
}
```

**Cara mendapatkan `baseId`:** Hapus prefix `virtual-` dari `tripId` hasil pencarian.
```
tripId = "virtual-550e8400-e29b-41d4-a716-446655440000"
baseId = "550e8400-e29b-41d4-a716-446655440000"
```

**Response:**
```json
{
  "tripId": "9f3a7b2e-1c4d-4e5f-8a6b-0d9e8f7c6b5a"
}
```

Simpan `tripId` dari response — ini adalah UUID trip nyata. Gunakan untuk seatmap dan booking.

**Endpoint ini idempoten** — memanggil ulang dengan `baseId` + `serviceDate` yang sama akan mengembalikan `tripId` yang sudah ada.

**Error `422`:** Base trip tidak eligible untuk tanggal ini (jadwal tidak berlaku, ada exception libur/maintenance).

### Step 3: Ambil Seatmap

```http
GET /api/app/trips/{realTripId}/seatmap?originSeq={originSeq}&destinationSeq={destinationSeq}
X-Service-Key: sk_live_xxx
```

> **Penting:** Gunakan `tripId` nyata (UUID). Untuk trip yang awalnya virtual, gunakan `tripId` dari response materialize di Step 2.

**Status kursi:**

| `available` | `held` | Arti | Warna UI |
|-------------|--------|------|----------|
| `true` | `false` | Tersedia | Hijau |
| `false` | `false` | Sudah dipesan | Merah |
| `false` | `true` | Sedang diproses orang lain | Kuning |

### Step 4: Buat Booking (Tanpa Pembayaran)

Booking dibuat **tanpa `paymentMethod`** — kursi di-hold 15 menit sementara user memilih metode pembayaran.

```http
POST /api/app/bookings
X-Service-Key: sk_live_xxx
Content-Type: application/json
```

> **Penting:** Gunakan `tripId` nyata (UUID) dari response materialize atau dari pencarian (jika trip sudah real). Jangan kirim `tripId` berformat `virtual-*`.

**Request Body:**

```json
{
  "tripId": "9f3a7b2e-1c4d-4e5f-8a6b-0d9e8f7c6b5a",
  "serviceDate": "2026-04-10",
  "originStopId": "a579d349-5434-4a52-a562-e0a82cca26d6",
  "destinationStopId": "5313225b-6ecd-4cbf-9245-3965075db961",
  "originSeq": 1,
  "destinationSeq": 6,
  "passengers": [
    {
      "fullName": "Budi Santoso",
      "phone": "081234567890",
      "idNumber": "3201010101010001",
      "seatNo": "2A"
    },
    {
      "fullName": "Siti Rahayu",
      "phone": "089987654321",
      "idNumber": "3201010101010002",
      "seatNo": "2B"
    }
  ]
}
```

> **Catatan:** `paymentMethod` **tidak dikirim** agar booking dalam status held/pending. Pembayaran akan dilakukan di Step 5.

**Field Detail:**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `tripId` | `string` | ✅ | UUID atau `virtual-<uuid>` dari search result |
| `serviceDate` | `string` | ✅* | `YYYY-MM-DD` — **wajib jika virtual trip**, disarankan selalu kirim |
| `originStopId` | `string (uuid)` | ✅ | `origin.stopId` dari search result |
| `destinationStopId` | `string (uuid)` | ✅ | `destination.stopId` dari search result |
| `originSeq` | `integer` | ✅ | `origin.sequence` dari search result |
| `destinationSeq` | `integer` | ✅ | `destination.sequence` dari search result |
| `passengers` | `array` | ✅ | Minimal 1 penumpang |
| `passengers[].fullName` | `string` | ✅ | Nama lengkap |
| `passengers[].phone` | `string` | ❌ | Nomor telepon |
| `passengers[].idNumber` | `string` | ❌ | NIK / nomor identitas |
| `passengers[].seatNo` | `string` | ✅ | Nomor kursi dari seatmap (contoh: `"1A"`, `"2B"`) |
| `paymentMethod` | `string` | ❌ | `"qr"` / `"ewallet"` / `"bank"`. Jika tidak dikirim, booking dibuat tanpa payment record |

**Response yang harus disimpan:**

| Field | Kegunaan |
|-------|----------|
| `id` | Booking ID — simpan untuk tracking dan pembayaran |
| `status` | Selalu `"pending"` saat baru dibuat |
| `totalAmount` | Jumlah yang harus dibayar (string, dalam Rupiah) |
| `holdExpiresAt` | Batas waktu pembayaran (ISO 8601 UTC) — tampilkan countdown ke user |
| `qrData[].qrToken` | Kode pendek untuk verifikasi manual |
| `qrData[].qrPayload` | JSON string untuk generate QR code e-tiket |
| `passengers[].id` | Passenger ID per penumpang |
| `passengers[].fareAmount` | Tarif per penumpang (string) |

### Step 4.5: Validasi Voucher (Opsional)

Jika user memiliki kode voucher, validasi sebelum pembayaran:

```http
POST /api/app/vouchers/validate
X-Service-Key: sk_live_xxx
Content-Type: application/json

{
  "code": "DISKON10",
  "amount": 170000
}
```

**Response:**
```json
{
  "valid": true,
  "code": "DISKON10",
  "discountType": "percentage",
  "discountValue": "10",
  "minPurchase": "50000",
  "maxDiscount": "25000",
  "calculatedDiscount": 17000
}
```

Tampilkan informasi diskon ke user sebelum lanjut ke pembayaran:
- `calculatedDiscount` → jumlah potongan harga
- `discountType` → tipe diskon (`percentage` atau `fixed`)
- `minPurchase` → minimal pembelian (validasi di sisi UI)

### Step 4.6: Ambil Metode Pembayaran

Ambil daftar metode pembayaran yang tersedia:

```http
GET /api/app/payments/methods
X-Service-Key: sk_live_xxx
```

**Response:**
```json
[
  { "code": "qr", "name": "QRIS", "description": "Pembayaran via QRIS", "active": true },
  { "code": "ewallet", "name": "E-Wallet", "description": "Pembayaran via e-wallet (GoPay, OVO, DANA)", "active": true },
  { "code": "bank", "name": "Bank Transfer", "description": "Transfer bank (VA)", "active": true }
]
```

Tampilkan opsi yang `active: true` ke user. Gunakan field `code` sebagai nilai `paymentMethod` di Step 5.

### Step 5: Bayar Booking

Setelah user memilih metode pembayaran (dan opsional voucher):

```http
POST /api/app/bookings/{bookingId}/pay
X-Service-Key: sk_live_xxx
Content-Type: application/json

{
  "paymentMethod": "qr",
  "voucherCode": "DISKON10"
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `paymentMethod` | `string` | ✅ | `"qr"` / `"ewallet"` / `"bank"` (dari response payment methods) |
| `voucherCode` | `string` | ❌ | Kode voucher (sudah divalidasi di Step 4.5) |

**Response:**
```json
{
  "bookingId": "booking-uuid-123",
  "status": "confirmed",
  "totalAmount": "170000",
  "discountAmount": "17000",
  "finalAmount": "153000",
  "paymentIntent": {
    "paymentId": "payment-uuid-1",
    "providerRef": "PAY-ABC123DEF456GHI7890ABCD",
    "method": "qr",
    "amount": "153000"
  }
}
```

**Response yang harus disimpan:**

| Field | Kegunaan |
|-------|----------|
| `status` | `"confirmed"` = booking berhasil dibayar |
| `finalAmount` | Jumlah yang dibayarkan setelah diskon |
| `discountAmount` | Besaran diskon yang diterapkan |
| `paymentIntent.providerRef` | Referensi pembayaran (`PAY-XXXX`) — simpan untuk rekonsiliasi |

**Efek pada sistem:**
- Booking → `confirmed`
- Kursi → `booked = true` (terkunci permanen)
- Payment record dibuat dengan status `success`
- Seat holds dihapus
- Voucher ditandai sebagai `used` (jika digunakan)

> **Catatan:** Berbeda dengan alur webhook, endpoint `/pay` langsung mengkonfirmasi booking dalam satu langkah tanpa perlu webhook terpisah.

### Step 5 (Alternatif): Alur Webhook

Jika TransityConsole menggunakan payment gateway eksternal (bukan pembayaran langsung), alur alternatif:

1. Buat booking **dengan `paymentMethod`** di Step 4 → mendapat `paymentIntent.providerRef`
2. Arahkan user ke payment gateway
3. Payment gateway mengirim webhook ke TransityTerminal:

```http
POST /api/app/payments/webhook
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-hex>

{
  "providerRef": "PAY-F23D19307890EAB97A2F9C1E",
  "status": "success"
}
```

**Cara menghitung signature:**
```
signature = HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, raw_request_body_bytes)
```

`PAYMENT_WEBHOOK_SECRET` harus sama antara TransityConsole dan TransityTerminal.

**Efek `status: "success"`:**
- Booking → `confirmed`
- Kursi → `booked = true` (terkunci permanen)
- Payment → `status = "success"`, `paidAt` diisi

**Efek `status: "failed"`:**
- Booking → `canceled`
- Kursi → dilepas kembali (tersedia untuk booking lain)
- Payment → `status = "failed"`

### Step 6: Pembatalan Booking (Opsional)

Jika user ingin membatalkan booking (sebelum atau sesudah pembayaran):

```http
POST /api/app/bookings/{bookingId}/cancel
X-Service-Key: sk_live_xxx
```

**Response:**
```json
{ "status": "cancelled" }
```

Hanya booking dengan status `pending` atau `confirmed` yang dapat dibatalkan.

### Step 7: Monitor Status Booking

Untuk monitoring dan dashboard, gunakan list endpoint:

```http
GET /api/app/bookings?status=pending&date=2026-04-10&page=1&limit=20
X-Service-Key: sk_live_xxx
```

Atau detail per booking:

```http
GET /api/app/bookings/{bookingId}
X-Service-Key: sk_live_xxx
```

Field penting di response list:
- `holdExpiresAt` → tampilkan countdown untuk booking pending
- `finalAmount` → total setelah diskon (`totalAmount - discountAmount`)

---

## Mekanisme Keamanan Kursi (Hold System)

1. Saat booking dibuat → kursi langsung di-hold **15 menit**
2. User harus bayar sebelum `holdExpiresAt`
3. Jika tidak bayar dalam 15 menit → hold expired, kursi otomatis dilepas
4. Webhook yang masuk setelah hold expired → booking otomatis dibatalkan

**Rekomendasi UI:** Tampilkan countdown timer berdasarkan `holdExpiresAt`.

---

## Error Handling

| HTTP | Error Message | Penanganan |
|------|--------------|------------|
| `400` | `Seat X is already booked` | Minta user pilih kursi lain |
| `400` | `Seat X is currently held by another user` | Minta user pilih kursi lain |
| `400` | `Seat X is no longer available` | Kursi diambil orang lain saat proses pay — minta pilih ulang |
| `400` | `Validation failed` | Cek field request body |
| `400` | `Payment not found` | `providerRef` di webhook salah |
| `400` | `Payment already processed` | Webhook duplikat — anggap sukses |
| `400` | `Seat holds have expired...` | Pembayaran terlambat — booking harus dibuat ulang |
| `400` | `Booking is not in held/pending status` | Booking sudah confirmed/canceled, tidak bisa pay |
| `400` | `Booking hold has expired` | Hold 15 menit terlewat — booking harus dibuat ulang |
| `400` | `Booking cannot be canceled` | Booking sudah dalam status yang tidak bisa dibatalkan |
| `400` | `Voucher not found or inactive` | Kode voucher salah atau sudah nonaktif |
| `400` | `Voucher has expired` | Voucher sudah melewati tanggal berlaku |
| `400` | `Promotion usage limit reached` | Kuota promo habis |
| `400` | `Minimum purchase amount is X` | Total kurang dari minimal pembelian voucher |
| `401` | `Missing X-Service-Key header` | Tambahkan header `X-Service-Key` |
| `401` | `Invalid service key` | Key salah — cek konfigurasi |
| `403` | `Unauthorized` | JWT user mengakses booking milik user lain |
| `404` | `Trip not found` | `tripId` tidak valid (atau belum dimaterialize untuk virtual trip) |
| `404` | `Trip has no layout` | Trip belum dikonfigurasi seatmap oleh operator |
| `404` | `Booking not found` | Booking ID tidak ditemukan |
| `422` | `Base trip tidak eligible...` | Materialize gagal — jadwal tidak berlaku di tanggal ini |
| `503` | `Payment webhook not configured` | `PAYMENT_WEBHOOK_SECRET` belum diset di terminal |

---

## Catatan Teknis

### Format Data
- Semua waktu dalam **UTC** (suffix `Z`). Konversi ke WIB (UTC+7) di sisi client
- Harga dalam **Rupiah** — `farePerPerson` = integer, `totalAmount`/`fareAmount` = string numerik
- Selalu parse harga dengan `parseInt()` atau `parseFloat()`

### Concurrency / Race Condition
- Sistem menggunakan **SELECT FOR UPDATE** di PostgreSQL
- Jika dua user booking kursi yang sama bersamaan, satu akan gagal
- Tangani error ini dengan minta user refresh seatmap dan pilih kursi lain

### Idempotency
- Webhook duplikat akan mendapat `400 "Payment already processed"` — ini bukan error fatal
- TransityConsole harus tangani response ini sebagai sukses

### Multi-Operator
- Setiap operator punya instance TransityTerminal sendiri
- TransityConsole harus simpan mapping: `operatorId → { baseUrl, serviceKey }`
- Request paralel ke beberapa operator saat search untuk aggregasi

### Seatmap Caching di TransityConsole

Seatmap **tidak boleh realtime** di TransityApp. Alasannya:
- CSO (Customer Service Officer) di terminal beroperasi bersamaan dan memiliki akses langsung ke sistem booking
- Jika seatmap realtime, user TransityApp bisa melihat kursi "tersedia" tapi gagal saat booking karena CSO sudah hold lebih dulu
- Ini menciptakan pengalaman buruk

**Rekomendasi implementasi di TransityConsole:**

| Aspek | Rekomendasi |
|-------|-------------|
| **TTL Cache** | 30–60 detik |
| **Cache Key** | `seatmap:{operatorId}:{tripId}:{originSeq}:{destinationSeq}` |
| **Invalidasi** | Setelah booking berhasil dibuat (POST /api/app/bookings return 201) |
| **Tampilan UI** | Tampilkan pesan "Ketersediaan kursi mungkin berubah. Pilih kursi cadangan jika memungkinkan." |
| **Fallback** | Jika seatmap error saat booking, minta user refresh dan pilih ulang |

### Error Translation Layer

TransityTerminal mengembalikan error teknis (dalam bahasa Inggris, kadang berisi UUID dan nama tabel). **TransityConsole wajib menerjemahkan** semua error sebelum diteruskan ke TransityApp.

**Jangan pernah forward raw error ke TransityApp.**

Contoh terjemahan:

| Error dari Terminal | Pesan ke TransityApp |
|---------------------|---------------------|
| `Seat 2A is already booked` | `Maaf, kursi 2A sudah dipesan. Silakan pilih kursi lain.` |
| `Seat 2A is currently held by another user` | `Kursi 2A sedang diproses penumpang lain. Silakan pilih kursi lain.` |
| `Seat 2A is no longer available` | `Kursi 2A tidak tersedia lagi. Silakan pilih kursi lain.` |
| `Seat holds have expired...` | `Waktu pembayaran habis. Booking Anda dibatalkan. Silakan pesan ulang.` |
| `Booking hold has expired` | `Waktu pembayaran habis. Silakan buat booking baru.` |
| `Booking is not in held/pending status` | `Booking ini sudah tidak bisa dibayar.` |
| `Booking cannot be canceled` | `Booking ini tidak dapat dibatalkan.` |
| `Voucher not found or inactive` | `Kode voucher tidak ditemukan atau sudah tidak berlaku.` |
| `Voucher has expired` | `Voucher sudah kedaluwarsa.` |
| `Promotion usage limit reached` | `Kuota promo sudah habis.` |
| `Minimum purchase amount is X` | `Pembelian minimal Rp X untuk menggunakan voucher ini.` |
| `Trip not found` | `Perjalanan tidak ditemukan. Silakan cari ulang.` |
| `Booking not found` | `Booking tidak ditemukan.` |
| `Base trip tidak eligible...` | `Jadwal tidak tersedia untuk tanggal ini. Silakan pilih tanggal lain.` |
| `Payment already processed` | (Anggap sukses — jangan tampilkan error) |
| `Validation failed` | `Data tidak lengkap. Silakan periksa kembali.` |
| Internal server error / 500 | `Terjadi gangguan sistem. Silakan coba beberapa saat lagi.` |

### Environment Variables yang Diperlukan di TransityTerminal

| Variable | Keterangan |
|----------|------------|
| `TERMINAL_SERVICE_KEY` | Key untuk autentikasi TransityConsole |
| `PAYMENT_WEBHOOK_SECRET` | Secret untuk verifikasi HMAC webhook |
| `JWT_SECRET` | Untuk auth user mobile (jika TransityApp akses langsung) |

---

## Contoh Implementasi TransityConsole (Pseudocode)

```typescript
async function searchAndBookFromConsole(
  operatorBaseUrl: string,
  serviceKey: string,
  origin: string,
  destination: string,
  date: string,
  passengers: PassengerInput[],
  voucherCode?: string
) {
  const headers = { 'X-Service-Key': serviceKey };

  // Step 1: Cari trip
  const searchRes = await fetch(
    `${operatorBaseUrl}/api/app/trips/search?originCity=${origin}&destinationCity=${destination}&date=${date}`,
    { headers }
  );
  const { data: trips } = await searchRes.json();
  const selectedTrip = trips[0];

  // Step 2: Materialize jika virtual
  let realTripId = selectedTrip.tripId;
  if (selectedTrip.isVirtual) {
    const baseId = selectedTrip.tripId.replace('virtual-', '');
    const matRes = await fetch(`${operatorBaseUrl}/api/app/trips/materialize`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseId, serviceDate: selectedTrip.serviceDate }),
    });
    const matData = await matRes.json();
    if (!matRes.ok) throw new Error(matData.error);
    realTripId = matData.tripId;
  }

  // Step 3: Ambil seatmap (gunakan realTripId, bukan virtual-*)
  const seatmapRes = await fetch(
    `${operatorBaseUrl}/api/app/trips/${realTripId}/seatmap?originSeq=${selectedTrip.origin.sequence}&destinationSeq=${selectedTrip.destination.sequence}`,
    { headers }
  );
  const seatmap = await seatmapRes.json();
  const availableSeats = Object.entries(seatmap.seatAvailability)
    .filter(([_, v]: any) => v.available)
    .map(([k]) => k);

  // Step 4: Buat booking TANPA paymentMethod (held booking)
  const bookingRes = await fetch(`${operatorBaseUrl}/api/app/bookings`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripId: realTripId,
      serviceDate: selectedTrip.serviceDate,
      originStopId: selectedTrip.origin.stopId,
      destinationStopId: selectedTrip.destination.stopId,
      originSeq: selectedTrip.origin.sequence,
      destinationSeq: selectedTrip.destination.sequence,
      passengers: passengers.map((p, i) => ({
        fullName: p.fullName,
        phone: p.phone,
        seatNo: availableSeats[i],
      })),
      // paymentMethod TIDAK dikirim — booking ditahan dulu
    }),
  });
  const booking = await bookingRes.json();
  if (!bookingRes.ok) throw new Error(translateError(booking.error));

  // Step 4.5 (opsional): Validasi voucher
  let discountInfo = null;
  if (voucherCode) {
    const voucherRes = await fetch(`${operatorBaseUrl}/api/app/vouchers/validate`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: voucherCode, amount: parseInt(booking.totalAmount) }),
    });
    if (voucherRes.ok) {
      discountInfo = await voucherRes.json();
    }
  }

  // Step 5: Bayar booking
  const payRes = await fetch(`${operatorBaseUrl}/api/app/bookings/${booking.id}/pay`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentMethod: 'qr',
      ...(voucherCode ? { voucherCode } : {}),
    }),
  });
  const payResult = await payRes.json();
  if (!payRes.ok) throw new Error(translateError(payResult.error));

  return {
    bookingId: booking.id,
    totalAmount: payResult.totalAmount,
    discountAmount: payResult.discountAmount,
    finalAmount: payResult.finalAmount,
    providerRef: payResult.paymentIntent.providerRef,
    holdExpiresAt: booking.holdExpiresAt,
    qrData: booking.qrData,
  };
}

// Daftar booking dengan filter
async function listBookings(
  operatorBaseUrl: string,
  serviceKey: string,
  filters: { status?: string; date?: string; page?: number; limit?: number }
) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.date) params.set('date', filters.date);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());

  const res = await fetch(
    `${operatorBaseUrl}/api/app/bookings?${params}`,
    { headers: { 'X-Service-Key': serviceKey } }
  );
  return res.json();
  // Response: { data: [...], total, page, limit, hasMore }
}

// Batalkan booking
async function cancelBooking(
  operatorBaseUrl: string,
  serviceKey: string,
  bookingId: string
) {
  const res = await fetch(`${operatorBaseUrl}/api/app/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: { 'X-Service-Key': serviceKey },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(translateError(err.error));
  }
  return res.json(); // { status: "cancelled" }
}

// Error translator — WAJIB sebelum forward ke TransityApp
function translateError(error: string): string {
  if (error.includes('already booked')) return 'Kursi sudah dipesan. Silakan pilih kursi lain.';
  if (error.includes('currently held')) return 'Kursi sedang diproses penumpang lain. Silakan pilih kursi lain.';
  if (error.includes('no longer available')) return 'Kursi tidak tersedia lagi. Silakan pilih kursi lain.';
  if (error.includes('holds have expired')) return 'Waktu pembayaran habis. Silakan pesan ulang.';
  if (error.includes('hold has expired')) return 'Waktu pembayaran habis. Silakan buat booking baru.';
  if (error.includes('not in held/pending')) return 'Booking ini sudah tidak bisa dibayar.';
  if (error.includes('cannot be canceled')) return 'Booking ini tidak dapat dibatalkan.';
  if (error.includes('Voucher not found')) return 'Kode voucher tidak ditemukan atau sudah tidak berlaku.';
  if (error.includes('Voucher has expired')) return 'Voucher sudah kedaluwarsa.';
  if (error.includes('usage limit')) return 'Kuota promo sudah habis.';
  if (error.includes('Minimum purchase')) return error.replace('Minimum purchase amount is', 'Pembelian minimal Rp');
  if (error.includes('Booking not found')) return 'Booking tidak ditemukan.';
  if (error.includes('not found')) return 'Data tidak ditemukan. Silakan cari ulang.';
  if (error.includes('tidak eligible')) return 'Jadwal tidak tersedia untuk tanggal ini.';
  if (error.includes('already processed')) return 'Pembayaran sudah dikonfirmasi sebelumnya.';
  return 'Terjadi gangguan sistem. Silakan coba beberapa saat lagi.';
}
```

---

## Diagram Alur Lengkap

```
TransityApp                    TransityConsole                    TransityTerminal
    |                               |                                    |
    |--- Cari trip --------------->|                                    |
    |                               |--- GET /trips/search ----------->|
    |                               |<-- trips[] (real + virtual) ------|
    |<-- Tampilkan hasil ----------|                                    |
    |                               |                                    |
    |--- Pilih trip (virtual) ---->|                                    |
    |                               |--- POST /trips/materialize ----->|
    |                               |<-- { tripId: "real-uuid" } ------|
    |                               |                                    |
    |--- Minta seatmap ----------->|                                    |
    |                               |--- GET /trips/{id}/seatmap ----->|
    |                               |<-- layout + availability ---------|
    |                               |    (cache 30-60 detik)           |
    |<-- Tampilkan seatmap --------|                                    |
    |                               |                                    |
    |--- Pilih kursi + booking --->|                                    |
    |                               |--- POST /bookings -------------->|
    |                               |<-- booking (held, no payment) ---|
    |                               |    (invalidasi cache seatmap)    |
    |<-- Tampilkan countdown ------|                                    |
    |                               |                                    |
    |--- Input voucher (opsional)->|                                    |
    |                               |--- POST /vouchers/validate ----->|
    |                               |<-- { valid, calculatedDiscount } |
    |<-- Tampilkan info diskon ----|                                    |
    |                               |                                    |
    |--- Pilih metode bayar ------>|                                    |
    |                               |--- GET /payments/methods ------->|
    |                               |<-- [{ code, name, active }] -----|
    |<-- Tampilkan opsi pembayaran |                                    |
    |                               |                                    |
    |--- Konfirmasi pembayaran --->|                                    |
    |                               |--- POST /bookings/{id}/pay ---->|
    |                               |<-- { status: "confirmed" } ------|
    |<-- Tampilkan e-tiket --------|                                    |
    |                               |                                    |
    |--- [opsional] Batalkan ----->|                                    |
    |                               |--- POST /bookings/{id}/cancel -->|
    |                               |<-- { status: "cancelled" } ------|
    |<-- Konfirmasi pembatalan ----|                                    |
    |                               |                                    |
    |--- [monitoring] List ------->|                                    |
    |                               |--- GET /bookings?status=... ---->|
    |                               |<-- { data, total, hasMore } -----|
    |<-- Tampilkan dashboard ------|                                    |
```
