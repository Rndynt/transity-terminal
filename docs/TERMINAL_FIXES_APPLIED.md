# Terminal Fixes Applied (dari TransityConsole TERMINAL_FIXES.md)

Tanggal: 2026-04-15

---

## Ringkasan

Tiga perbaikan diterapkan untuk menyelesaikan race condition pada flow booking OTA
antara TransityConsole (gateway/BFF) dan TransityTerminal.

---

## Fix #1: KRITIS — Scheduler Tidak Lagi Auto-Cancel Booking OTA

### File Diubah
- `server/modules/bookings/bookings.service.ts`

### Perubahan
Method `cleanupExpiredPendingBookings()` sekarang menambahkan filter:
```typescript
not(eq(bookingsTable.channel, 'OTA'))
```

### Alasan
Sebelumnya, scheduler Terminal membatalkan **semua** booking pending yang `pendingExpiresAt`-nya
sudah lewat — termasuk booking OTA. Ini menyebabkan race condition:

1. Customer booking via App → Console → Terminal (status: pending)
2. Customer mulai proses pembayaran (menit 18)
3. Terminal scheduler: hold expired → auto-cancel booking (menit 20)
4. Payment gateway callback: pembayaran berhasil (menit 20:05)
5. Console kirim `confirmOtaPaid` → ERROR: status sudah `cancelled`

**Hasilnya:** Customer sudah bayar tapi kursi dilepas.

### Solusi
Console yang mengelola lifecycle booking OTA, termasuk expiry dan pembatalan.
Terminal hanya meng-cancel booking non-OTA (CSO, APP).

### Flow Baru
```
Customer booking → Console → Terminal (pending)
                              ↓
              Terminal TIDAK auto-cancel OTA
                              ↓
Customer bayar → Console update → Console kirim confirmOtaPaid ke Terminal
                              ↓
              Terminal: pending → confirmed ✓ (kursi locked permanen)
                              ↓
              Console: Kalau customer tidak bayar, Console yang cancel
              dan notify Terminal untuk release seats
```

---

## Fix #2: DIREKOMENDASIKAN — Endpoint Find OTA Booking by Criteria

### File Diubah
- `server/modules/app/app.service.ts` — method `findOtaBookingByCriteria()`
- `server/modules/app/app.controller.ts` — method `findOtaBooking()`
- `server/modules/app/app.routes.ts` — registrasi route

### Endpoint
```
GET /api/app/bookings/find-ota?tripId={tripId}&seats={seatNo1,seatNo2}
```

### Auth
- Header: `X-Service-Key` (service key middleware)

### Query Parameters
| Parameter | Type   | Required | Deskripsi |
|-----------|--------|----------|-----------|
| tripId    | UUID   | Ya       | ID trip yang dicari |
| seats     | string | Ya       | Daftar nomor kursi, dipisahkan koma (contoh: `1A,2A`) |

### Response Sukses (200)
Sama dengan format `BookingDetailResponse`:
```json
{
  "id": "uuid",
  "bookingCode": "BK-XXXXXX",
  "tripId": "uuid",
  "serviceDate": "2026-04-15",
  "patternCode": "BDG-JKT",
  "patternName": "Bandung - Jakarta",
  "origin": { "stopId": "uuid", "name": "Dipatiukur", "code": "DPT", "city": "Bandung" },
  "destination": { "stopId": "uuid", "name": "Gambir", "code": "GMB", "city": "Jakarta" },
  "departAt": "2026-04-15T08:00:00.000Z",
  "arriveAt": "2026-04-15T11:00:00.000Z",
  "status": "pending",
  "totalAmount": "150000.00",
  "channel": "OTA",
  "holdExpiresAt": "2026-04-15T08:30:00.000Z",
  "qrData": [...],
  "passengers": [...],
  "payments": [...],
  "paymentIntent": null,
  "createdAt": "2026-04-15T07:50:00.000Z"
}
```

### Response Error
| Code | Body | Kondisi |
|------|------|---------|
| 400  | `{ "error": "tripId and seats query parameters are required" }` | Parameter tidak lengkap |
| 400  | `{ "error": "At least one seat number is required" }` | Seats kosong |
| 404  | `{ "error": "No matching OTA booking found" }` | Tidak ada booking OTA yang cocok |

### Use Case
Saat Console timeout saat membuat booking, Console tidak punya `externalBookingId`.
Endpoint ini memungkinkan Console untuk menemukan booking yang sudah dibuat berdasarkan
`tripId` + daftar `seatNo`, tanpa harus loop semua booking pending.

---

## Fix #3: OPSIONAL — Grace Period pada confirmOtaPayment

### File Diubah
- `server/modules/app/app.service.ts` — method `confirmOtaPayment()`

### Perubahan
Jika booking OTA berstatus `cancelled` tetapi `pendingExpiresAt` masih dalam
window 5 menit terakhir, sistem akan:

1. Mengecek apakah kursi-kursi masih tersedia (belum dipesan orang lain)
2. Jika tersedia, re-activate booking dan langsung confirm + lock kursi
3. Jika kursi sudah dipesan orang lain, throw error dengan pesan jelas

### Validasi Data Integrity
- Menggunakan `SELECT ... FOR UPDATE` pada seat_inventory untuk row-level locking
- Memeriksa apakah seat sudah `booked = true` sebelum re-activate
- Seluruh operasi dalam satu database transaction (atomik)
- Jika seat sudah diambil, error: `"Grace period recovery failed: seat X is already booked by another passenger"`

### Flow
```
Skenario: Hold baru expired, customer sudah bayar

1. pendingExpiresAt = 20:00
2. Booking di-cancel (oleh proses apapun)
3. Payment berhasil di 20:03 → Console kirim confirmOtaPaid
4. Terminal cek: cancelled + OTA + (20:03 - 20:00 = 3 menit < 5 menit grace)
5. Cek seat availability → FOR UPDATE lock
6. Seats masih kosong → re-activate + confirm ✓
```

---

## API External Lengkap (untuk Console/OTA)

### Authentication
Semua endpoint external menggunakan header:
```
X-Service-Key: {TERMINAL_SERVICE_KEY}
```

### Endpoints

#### Discovery
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/app/operator-info` | Info operator (brand, logo, warna) |
| GET | `/api/app/cities` | Daftar kota yang dilayani |
| GET | `/api/app/service-lines` | Daftar rute/pola perjalanan |
| GET | `/api/app/trips/search?originCity=X&destinationCity=Y&date=YYYY-MM-DD` | Cari trip |
| GET | `/api/app/trips/:id` | Detail trip |
| GET | `/api/app/trips/:id/seatmap?originSeq=N&destinationSeq=M` | Peta kursi |
| POST | `/api/app/trips/materialize` | Materialisasi trip virtual |

#### Booking
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/app/bookings` | Buat booking (hold kursi, status: pending) |
| GET | `/api/app/bookings` | List semua booking (paginated) |
| GET | `/api/app/bookings/:id` | Detail booking |
| GET | `/api/app/bookings/find-ota?tripId=X&seats=A,B` | **BARU** — Cari booking OTA by criteria |
| POST | `/api/app/bookings/:id/confirm-paid` | Konfirmasi pembayaran OTA |
| POST | `/api/app/bookings/:id/pay` | Proses pembayaran langsung |
| POST | `/api/app/bookings/:id/cancel` | Batalkan booking |
| GET | `/api/app/bookings/:id/payment-status` | Status pembayaran |

#### Payment
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/app/payments/methods` | Daftar metode pembayaran |
| POST | `/api/app/payments/webhook` | Webhook dari payment gateway |

#### Voucher
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/app/vouchers/validate` | Validasi kode voucher |

### Flow Booking OTA Lengkap

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│ TransityApp  │────▶│ TransityConsole│────▶│ TransityTerminal │
│ (Customer)   │     │ (Gateway/BFF)  │     │ (Booking Engine) │
└─────────────┘     └──────────────┘     └──────────────────┘

STEP 1: Search & Select
  Console → Terminal: GET /api/app/trips/search
  Console → Terminal: GET /api/app/trips/:id/seatmap

STEP 2: Create Booking (Hold Seats)
  Console → Terminal: POST /api/app/bookings
    Body: { tripId, originStopId, destinationStopId, originSeq, destinationSeq, passengers }
    Response: { id, bookingCode, totalAmount, holdExpiresAt, ... }
    Seats ditandai held, booking status = "pending"

STEP 3a: Pembayaran Berhasil
  Console → Terminal: POST /api/app/bookings/:id/confirm-paid
    Body: { providerRef, paymentMethod }
    Response: { status: "confirmed", bookingId }
    Seats di-lock permanen (booked = true), hold dihapus

STEP 3b: Pembayaran Gagal / Customer Batal
  Console → Terminal: POST /api/app/bookings/:id/cancel
    Response: { status: "cancelled" }
    Seats dilepas (booked = false, holdRef = null)

RECOVERY: Timeout saat Create Booking
  Console → Terminal: GET /api/app/bookings/find-ota?tripId=X&seats=1A,2A
    Response: BookingDetailResponse (jika ditemukan)
```

### Data Integrity Guarantees

1. **Atomic Transactions**: Semua operasi booking (create, confirm, cancel) menggunakan
   database transaction untuk memastikan konsistensi data.

2. **Row-Level Locking**: `SELECT ... FOR UPDATE` digunakan pada seat_inventory untuk
   mencegah double-booking saat concurrent requests.

3. **Idempotent Confirmation**: `confirmOtaPaid` mengembalikan sukses jika booking
   sudah `confirmed`, mencegah duplikasi payment record.

4. **Grace Period Recovery**: Booking OTA yang baru di-cancel masih bisa di-recover
   dalam 5 menit, dengan pengecekan seat availability yang ketat.

5. **Channel Separation**: Scheduler Terminal hanya meng-cancel booking non-OTA.
   Console bertanggung jawab penuh atas lifecycle booking OTA.
