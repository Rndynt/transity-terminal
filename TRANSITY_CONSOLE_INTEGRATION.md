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
| 8 | `POST /api/app/bookings` | Buat booking baru |
| 9 | `POST /api/app/payments/webhook` | Konfirmasi pembayaran (dari payment gateway) |

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
- `tripId` berformat `virtual-<uuid>` artinya trip berasal dari jadwal berkala dan belum pernah ada booking
- Saat booking, kirim `tripId` apa adanya (termasuk prefix `virtual-`) bersama `serviceDate`
- Sistem otomatis membuat trip nyata (materialize) saat booking pertama untuk tanggal tersebut
- Setelah dimaterialize, trip selanjutnya akan muncul sebagai real trip di pencarian

### Step 2: Ambil Seatmap

```http
GET /api/app/trips/{tripId}/seatmap?originSeq={originSeq}&destinationSeq={destinationSeq}
X-Service-Key: sk_live_xxx
```

**Catatan tentang Virtual Trip dan Seatmap:**
Virtual trip (`tripId` berformat `virtual-*`) belum dimaterialize ke database, sehingga seatmap endpoint akan mengembalikan error `Trip not found`. Untuk mengatasi ini, TransityConsole harus:

1. **Gunakan layout standar** — ambil daftar kursi dari layout berdasarkan `vehicleClass` (contoh: `premio-14` = 14 kursi). TransityConsole bisa menyimpan mapping `vehicleClass → seatNos` secara statis (misal `["1A","1B","2A","2B","2C",...]`)
2. **Semua kursi dianggap tersedia** untuk virtual trip (karena belum ada booking)
3. **`seatNo` tetap wajib** di request booking — sistem tidak auto-assign kursi

Untuk real trip (UUID biasa), seatmap endpoint berfungsi normal dan wajib dipanggil sebelum booking.

**Status kursi:**

| `available` | `held` | Arti | Warna UI |
|-------------|--------|------|----------|
| `true` | `false` | Tersedia | Hijau |
| `false` | `false` | Sudah dipesan | Merah |
| `false` | `true` | Sedang diproses orang lain | Kuning |

### Step 3: Buat Booking

```http
POST /api/app/bookings
X-Service-Key: sk_live_xxx
Content-Type: application/json
```

**Request Body:**

```json
{
  "tripId": "8fae9980-dc4c-4807-a098-bd5433c1f51e",
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

### Step 4: Proses Pembayaran

Setelah booking berhasil:
1. Simpan `paymentIntent.providerRef`
2. Arahkan user ke payment gateway TransityConsole
3. Saat payment selesai, kirim webhook ke TransityTerminal

### Step 5: Konfirmasi via Webhook

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
| `404` | `Trip not found` | `tripId` tidak valid |
| `404` | `Trip has no layout` | Trip belum dikonfigurasi seatmap oleh operator |
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

  const searchRes = await fetch(
    `${operatorBaseUrl}/api/app/trips/search?originCity=${origin}&destinationCity=${destination}&date=${date}`,
    { headers }
  );
  const { data: trips } = await searchRes.json();
  const selectedTrip = trips[0];

  const seatmapRes = await fetch(
    `${operatorBaseUrl}/api/app/trips/${selectedTrip.tripId}/seatmap?originSeq=${selectedTrip.origin.sequence}&destinationSeq=${selectedTrip.destination.sequence}`,
    { headers }
  );
  const seatmap = await seatmapRes.json();
  const availableSeats = Object.entries(seatmap.seatAvailability)
    .filter(([_, v]) => v.available)
    .map(([k]) => k);

  const bookingRes = await fetch(`${operatorBaseUrl}/api/app/bookings`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripId: selectedTrip.tripId,
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

  return {
    bookingId: booking.id,
    totalAmount: booking.totalAmount,
    providerRef: booking.paymentIntent.providerRef,
    holdExpiresAt: booking.holdExpiresAt,
    qrData: booking.qrData,
  };
}
```
