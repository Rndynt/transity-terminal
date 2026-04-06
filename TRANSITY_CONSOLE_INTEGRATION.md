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

### Endpoint Write (POST) — Transaksi

| # | Endpoint | Kegunaan |
|---|----------|----------|
| 8 | `POST /api/app/trips/materialize` | Materialize trip virtual → trip nyata (wajib sebelum seatmap untuk virtual trip) |
| 9 | `POST /api/app/bookings` | Buat booking baru |
| 10 | `POST /api/app/payments/webhook` | Konfirmasi pembayaran (dari payment gateway) |

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

### Step 4: Buat Booking

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
  ],
  "paymentMethod": "qr"
}
```

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
| `paymentMethod` | `string` | ✅ | `"qr"` / `"ewallet"` / `"bank"` |

**Response yang harus disimpan:**

| Field | Kegunaan |
|-------|----------|
| `id` | Booking ID — simpan untuk tracking |
| `status` | Selalu `"pending"` saat baru dibuat |
| `totalAmount` | Jumlah yang harus dibayar (string, dalam Rupiah) |
| `holdExpiresAt` | Batas waktu pembayaran (ISO 8601 UTC) — tampilkan countdown ke user |
| `paymentIntent.providerRef` | Kirim ke payment gateway sebagai referensi order |
| `paymentIntent.expiresAt` | Sama dengan `holdExpiresAt` |
| `qrData[].qrToken` | Kode pendek untuk verifikasi manual |
| `qrData[].qrPayload` | JSON string untuk generate QR code e-tiket |
| `passengers[].id` | Passenger ID per penumpang |
| `passengers[].fareAmount` | Tarif per penumpang (string) |

### Step 5: Proses Pembayaran

Setelah booking berhasil:
1. Simpan `paymentIntent.providerRef`
2. Arahkan user ke payment gateway TransityConsole
3. Saat payment selesai, kirim webhook ke TransityTerminal

### Step 6: Konfirmasi via Webhook

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
| `400` | `Validation failed` | Cek field request body |
| `400` | `Payment not found` | `providerRef` di webhook salah |
| `400` | `Payment already processed` | Webhook duplikat — anggap sukses |
| `400` | `Seat holds have expired...` | Pembayaran terlambat, booking dibatalkan |
| `401` | `Missing X-Service-Key header` | Tambahkan header `X-Service-Key` |
| `401` | `Invalid service key` | Key salah — cek konfigurasi |
| `404` | `Trip not found` | `tripId` tidak valid (atau belum dimaterialize untuk virtual trip) |
| `404` | `Trip has no layout` | Trip belum dikonfigurasi seatmap oleh operator |
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
| `Seat holds have expired. Booking cannot be confirmed.` | `Waktu pembayaran habis. Booking Anda dibatalkan. Silakan pesan ulang.` |
| `Trip not found` | `Perjalanan tidak ditemukan. Silakan cari ulang.` |
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
  passengers: PassengerInput[]
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

  // Step 4: Buat booking (gunakan realTripId)
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
      paymentMethod: 'qr',
    }),
  });
  const booking = await bookingRes.json();
  if (!bookingRes.ok) throw new Error(translateError(booking.error));

  return {
    bookingId: booking.id,
    totalAmount: booking.totalAmount,
    providerRef: booking.paymentIntent.providerRef,
    holdExpiresAt: booking.holdExpiresAt,
    qrData: booking.qrData,
  };
}

// Error translator — WAJIB sebelum forward ke TransityApp
function translateError(error: string): string {
  if (error.includes('already booked')) return 'Kursi sudah dipesan. Silakan pilih kursi lain.';
  if (error.includes('currently held')) return 'Kursi sedang diproses penumpang lain. Silakan pilih kursi lain.';
  if (error.includes('holds have expired')) return 'Waktu pembayaran habis. Silakan pesan ulang.';
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
    |                               |<-- booking + paymentIntent ------|
    |                               |    (invalidasi cache seatmap)    |
    |<-- Tampilkan countdown ------|                                    |
    |                               |                                    |
    |--- Bayar ------------------->|                                    |
    |                               |--- POST /payments/webhook ------>|
    |                               |<-- { status: "success" } --------|
    |<-- Tampilkan e-tiket --------|                                    |
```
