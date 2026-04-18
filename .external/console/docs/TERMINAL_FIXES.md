# Perbaikan yang Diperlukan di TransityTerminal

## Konteks

TransityConsole (gateway/BFF) meneruskan booking dari TransityApp ke TransityTerminal.
Setelah perbaikan di Console, ada satu masalah kritis yang harus diperbaiki di Terminal
agar seluruh flow booking OTA berjalan tanpa race condition.

---

## 1. KRITIS: Terminal Jangan Auto-Cancel Booking OTA

### Masalah

File: `server/modules/bookings/bookings.service.ts` → `cleanupExpiredPendingBookings()`
File: `server/scheduler.ts` → Scheduler menjalankan cleanup setiap 60 detik

Scheduler Terminal membatalkan **semua** booking `pending` yang `pendingExpiresAt`-nya
sudah lewat — termasuk booking channel `OTA`. Ini menyebabkan race condition:

```
Timeline:
0:00  - Customer booking via App → Console → Terminal (status: pending, hold 20 menit)
18:00 - Customer pilih metode bayar, mulai proses pembayaran
20:00 - Terminal scheduler: "Hold expired!" → Auto-cancel booking
20:05 - Payment gateway callback ke Console: "Pembayaran berhasil!"
20:06 - Console kirim confirmOtaPaid ke Terminal → ERROR: "status: cancelled"
```

**Hasilnya:** Customer sudah bayar, tapi kursi dilepas. Uang sudah masuk tapi tiket tidak valid.

### Solusi

Di `cleanupExpiredPendingBookings()`, **skip booking channel OTA**. Console yang
mengelola lifecycle booking OTA (termasuk expiry dan pembatalan).

```typescript
// server/modules/bookings/bookings.service.ts

async cleanupExpiredPendingBookings(): Promise<void> {
  const now = new Date();

  const expiredPendingBookings = await db
    .select()
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.status, 'pending'),
      lt(bookingsTable.pendingExpiresAt, now),
      // TAMBAHKAN: Jangan cancel booking OTA — Console yang kelola
      not(eq(bookingsTable.channel, 'OTA'))
    ));

  // ... sisanya tetap sama
}
```

**Kenapa Console yang harus kelola:**
- Console tahu status pembayaran (payment gateway callback masuk ke Console)
- Console punya reconciler yang secara aktif mengecek dan meng-expire booking
- Kalau Terminal cancel duluan, Console tidak tahu dan customer yang sudah bayar
  akan kehilangan kursinya

---

## 2. DIREKOMENDASIKAN: Endpoint "Cari Booking OTA by Criteria"

### Masalah

Saat Console timeout saat membuat booking, Console tidak punya `externalBookingId`
(ID booking Terminal). Untuk menemukan booking tersebut, Console harus:

1. Request `GET /api/app/bookings?status=pending&limit=50`
2. Loop semua booking pending
3. Match berdasarkan `tripId` + `channel=OTA` + daftar `seatNo`

Ini tidak efisien dan bisa gagal kalau ada >50 booking pending.

### Solusi

Tambahkan endpoint baru di Terminal:

```
GET /api/app/bookings/find-ota?tripId={tripId}&seats={seatNo1,seatNo2}
```

```typescript
// server/modules/app/app.controller.ts

async findOtaBooking(req: FastifyRequest, reply: FastifyReply) {
  const { tripId, seats } = req.query as { tripId: string; seats: string };
  const seatList = seats.split(',').map(s => s.trim());

  const booking = await this.service.findOtaBookingByCriteria(tripId, seatList);
  if (!booking) return reply.code(404).send({ error: 'Not found' });

  reply.send(booking);
}
```

```typescript
// server/modules/app/app.service.ts

async findOtaBookingByCriteria(tripId: string, seatNos: string[]): Promise<BookingDetailResponse | null> {
  // Cari booking OTA untuk trip dan kursi tertentu
  const results = await db
    .select()
    .from(bookings)
    .where(and(
      eq(bookings.tripId, tripId),
      eq(bookings.channel, 'OTA'),
      inArray(bookings.status, ['pending', 'confirmed'])
    ));

  for (const booking of results) {
    const pax = await this.storage.getPassengers(booking.id);
    const bookingSeats = new Set(pax.map(p => p.seatNo));
    if (seatNos.length === bookingSeats.size && seatNos.every(s => bookingSeats.has(s))) {
      return this.getBookingDetail(booking.id);
    }
  }

  return null;
}
```

Register route:
```typescript
// server/modules/app/app.controller.ts — di registerRoutes()
fastify.get('/api/app/bookings/find-ota', { preHandler: [serviceKeyAuth] }, (req, reply) => this.findOtaBooking(req, reply));
```

---

## 3. OPSIONAL: Grace Period untuk confirmOtaPayment

### Masalah

Jika fix #1 belum diterapkan dan Terminal sudah auto-cancel booking OTA,
`confirmOtaPayment` akan reject dengan "Current status: cancelled".

### Solusi (sementara, sampai fix #1 diterapkan)

Di `confirmOtaPayment`, kalau booking status `cancelled` dan channel `OTA`,
cek apakah cancellation baru terjadi (<5 menit). Jika ya, re-confirm:

```typescript
async confirmOtaPayment(bookingId: string, providerRef: string, paymentMethod = 'online') {
  const booking = await this.storage.getBookingById(bookingId);
  if (!booking) throw new Error("Booking not found");

  if (booking.status === 'confirmed') {
    return { status: 'confirmed', bookingId: booking.id };
  }

  // TAMBAHKAN: Grace period untuk OTA booking yang baru di-cancel oleh scheduler
  if (booking.status === 'cancelled' && booking.channel === 'OTA') {
    const cancelledRecently = booking.updatedAt &&
      (Date.now() - new Date(booking.updatedAt).getTime()) < 5 * 60 * 1000;
    if (cancelledRecently) {
      // Re-activate: set kembali ke pending lalu lanjut konfirmasi
      await db.update(bookings)
        .set({ status: 'pending' })
        .where(eq(bookings.id, bookingId));
      // Lanjut ke flow konfirmasi di bawah...
    } else {
      throw new Error(`Booking cannot be confirmed. Current status: ${booking.status}`);
    }
  }

  if (booking.status !== 'pending') {
    throw new Error(`Booking cannot be confirmed. Current status: ${booking.status}`);
  }

  // ... sisanya tetap sama
}
```

---

## Prioritas Implementasi

| # | Fix | Prioritas | Dampak |
|---|-----|-----------|--------|
| 1 | Jangan auto-cancel OTA bookings | **KRITIS** | Menghilangkan race condition utama |
| 2 | Endpoint find-ota | Direkomendasikan | Membuat recovery lebih reliable |
| 3 | Grace period confirmOtaPayment | Opsional | Workaround sementara kalau #1 belum diterapkan |

---

## Catatan

Setelah fix #1 diterapkan, flow booking OTA menjadi:

```
Customer booking → Console → Terminal (booking created, status: pending)
                                      ↓
                    Terminal TIDAK auto-cancel (Console yang kelola)
                                      ↓
Customer bayar → Console update confirmed → Console kirim confirmOtaPaid ke Terminal
                                      ↓
                    Terminal: pending → confirmed ✅ (kursi locked permanent)
                                      ↓
                    Console expire: Kalau customer tidak bayar dalam 20 menit,
                    Console yang cancel dan notify Terminal untuk release seats
```
