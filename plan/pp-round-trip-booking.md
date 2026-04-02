# Feature Plan: Pemesanan Pulang Pergi (PP) — CSO Terminal

**Tanggal:** 2 April 2026  
**Status:** Draft  
**Author:** Transity Engineering

---

## 1. Ringkasan

Saat ini sistem hanya mendukung pemesanan satu arah per transaksi. Feature ini menambahkan kemampuan pemesanan **Pulang Pergi (PP)** melalui CSO Terminal, di mana penumpang offline dapat memesan dua tiket (pergi + pulang) dalam **satu sesi transaksi** dengan **satu kode booking** yang menyatukan keduanya.

---

## 2. Definisi & Scope

| Aspek | Keterangan |
|---|---|
| Channel | CSO Terminal (offline walk-in) |
| Penumpang | Bisa 1 atau lebih (group PP) |
| Tiket | 2 tiket per penumpang (pergi + pulang) |
| Kode Booking | 1 kode grup yang menaungi kedua arah |
| Pembayaran | 1 transaksi pembayaran total |
| Print | 2 struk/tiket fisik (pergi & pulang) |

---

## 3. Analisis Masalah Saat Ini

### 3.1 Skema Booking Saat Ini
```
bookings
  ├── id (UUID)
  ├── booking_code         -- 1 kode per pemesanan
  ├── trip_id              -- 1 trip per booking
  ├── origin_stop_id
  ├── destination_stop_id
  └── passengers[]
        └── ticket_number  -- 1 tiket per penumpang
```

Satu booking = satu trip. Tidak ada konsep "linked" atau "grup" antar dua arah.

### 3.2 Gap yang Perlu Ditutup
1. Tidak ada cara menghubungkan booking pergi dengan booking pulang
2. UX CSO tidak memiliki flow multi-step untuk PP
3. Seat hold tidak bisa dilakukan untuk dua trip sekaligus secara aman
4. Struk/print tidak mendukung format PP
5. Tidak ada diskon otomatis untuk PP (opsional)

---

## 4. Desain Solusi

### 4.1 Pendekatan: Booking Group

Pendekatan yang dipilih adalah **Booking Group** — satu entitas grup yang menaungi dua booking independent yang sudah ada. Ini meminimalkan perubahan pada schema booking yang sudah mature.

```
booking_groups
  ├── id (UUID)
  ├── group_code           -- "PP-20260402-ABCDE" (kode yang dilihat pelanggan)
  ├── type                 -- 'round_trip'
  ├── channel              -- 'CSO'
  ├── total_amount         -- sum kedua booking
  ├── outlet_id            -- outlet CSO yang memproses
  ├── created_by           -- staff CSO
  └── created_at

bookings (tambah kolom)
  ├── group_id             -- FK → booking_groups.id (nullable)
  └── leg_type             -- 'single' | 'outbound' | 'return' (default: 'single')
```

Tiap booking tetap berdiri sendiri (bisa dicancel/reschedule independen), tapi terhubung lewat `group_id`.

### 4.2 Kode Booking
```
Kode Grup  :  PP-20260402-ABCDE       ← yang diberikan ke pelanggan
Booking 1  :  TRV-20260402-FGHIJ      ← tiket pergi (internal)
Booking 2  :  TRV-20260402-KLMNO      ← tiket pulang (internal)
```

Struk/tiket menampilkan **kode grup** sebagai referensi utama, dengan nomor tiket individual di bawahnya.

---

## 5. UX Flow CSO

### 5.1 Entry Point
Pada panel pemilihan jadwal (TripSelector), tambahkan toggle di atas:

```
┌─────────────────────────────────────┐
│  ○ Sekali Jalan    ● Pulang Pergi   │
└─────────────────────────────────────┘
```

Toggle ini mengaktifkan mode PP. Setelah diaktifkan, flow berubah menjadi multi-step.

### 5.2 Flow Multi-Step PP

```
Step 1: Pilih Trip Pergi
    ↓ (pilih jadwal, rute, kursi)

Step 2: Isi Data Penumpang (Pergi)
    ↓ (nama, kursi, harga)

Step 3: Pilih Trip Pulang
    ↓ (otomatis filter: rute kebalikan dari trip pergi)
    ↓ (outlet asal = destinasi pergi, destinasi = asal pergi)

Step 4: Pilih Kursi Pulang
    ↓ (penumpang sama dari step 2, tinggal pilih kursi)

Step 5: Review & Konfirmasi
    ┌──────────────────────────────────┐
    │  PERGI    : BDG → JKT  09:00   │
    │  PULANG   : JKT → BDG  18:00   │
    │  Penumpang: 2 orang             │
    │  Total    : Rp 380.000          │
    │  [BAYAR]                        │
    └──────────────────────────────────┘

Step 6: Pembayaran (1 transaksi)

Step 7: Print (2 struk: pergi + pulang)
    → Struk 1: Trip Pergi  (kode PP-xxx + kode tiket)
    → Struk 2: Trip Pulang (kode PP-xxx + kode tiket)
```

### 5.3 Navigasi Antar Step

```
[← Kembali]   Step 3 dari 5   [Lanjut →]

Progress bar visual:
  ●───●───◌───◌───◌
  Pergi  Pulang  Konfirm  Bayar  Print
```

### 5.4 Indikator Visual di Struk

```
╔══════════════════════════════════╗
║     TIKET PULANG PERGI (PP)      ║
║  Kode: PP-20260402-ABCDE         ║
╠══════════════════════════════════╣
║  [1/2] PERGI                     ║
║  Dipatiukur → Atrium Senen       ║
║  Sabtu, 4 Apr 2026  |  09:00     ║
║  Kursi: 5A  |  PR14-01           ║
║  Tiket: TRV-20260402-FGHIJ       ║
╠══════════════════════════════════╣
║  [2/2] PULANG                    ║
║  Atrium Senen → Dipatiukur       ║
║  Sabtu, 4 Apr 2026  |  18:00     ║
║  Kursi: 3B  |  PR14-02           ║
║  Tiket: TRV-20260402-KLMNO       ║
╠══════════════════════════════════╣
║  Total: Rp 190.000               ║
╚══════════════════════════════════╝
```

---

## 6. Mekanisme Backend

### 6.1 API Baru

```
POST /api/bookings/round-trip
```

**Request body:**
```json
{
  "outbound": {
    "tripId": "...",
    "originStopId": "...",
    "destinationStopId": "...",
    "passengers": [
      { "name": "Budi", "seatNo": "5A", "fareAmount": 95000 }
    ],
    "holdRef": "HOLD-ABC"
  },
  "return": {
    "tripId": "...",
    "originStopId": "...",
    "destinationStopId": "...",
    "passengers": [
      { "name": "Budi", "seatNo": "3B", "fareAmount": 95000 }
    ],
    "holdRef": "HOLD-XYZ"
  },
  "payment": {
    "method": "cash",
    "amountPaid": 190000
  }
}
```

**Proses (dalam 1 DB transaction):**
1. Generate `group_code` (PP-YYYYMMDD-XXXXX)
2. Insert `booking_groups` record
3. Insert booking pergi (`leg_type: 'outbound'`, `group_id`)
4. Insert passengers pergi
5. Insert booking pulang (`leg_type: 'return'`, `group_id`)
6. Insert passengers pulang
7. Update seat_inventory kedua trip
8. Delete kedua hold
9. Insert payment record (total)
10. Queue 2 print_jobs (1 struk PP dengan kedua tiket)
11. Emit WebSocket events kedua trip

### 6.2 Hold Management untuk PP

Seat hold dilakukan secara terpisah untuk masing-masing trip (seperti biasa), tapi keduanya harus aktif sebelum commit:

```
POST /api/holds   → holdRef pergi
POST /api/holds   → holdRef pulang
POST /api/bookings/round-trip  (dengan kedua holdRef)
```

Jika salah satu hold sudah expired saat commit → rollback total, user harus ulangi pilih kursi yang expired.

### 6.3 Validasi Tambahan

- Tanggal pulang ≥ tanggal pergi
- Rute pulang = kebalikan rute pergi (origin ↔ destination)
- Penumpang pergi dan pulang harus sama (jumlah)
- Kedua hold masih aktif saat commit

---

## 7. Perubahan Schema Database

### 7.1 Tabel Baru: `booking_groups`

```typescript
export const bookingGroups = pgTable("booking_groups", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupCode:   text("group_code").notNull().unique(),
  type:        text("type").notNull().default('round_trip'),
  channel:     text("channel").notNull().default('CSO'),
  totalAmount: integer("total_amount").notNull(),
  outletId:    uuid("outlet_id").references(() => outlets.id),
  createdBy:   text("created_by"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

### 7.2 Tambahan Kolom di `bookings`

```typescript
// Tambah di tabel bookings yang sudah ada:
groupId:  uuid("group_id").references(() => bookingGroups.id),
legType:  text("leg_type").default('single'),  // 'single' | 'outbound' | 'return'
```

---

## 8. Perubahan Print/Struk

Struk PP harus menampilkan keduanya dalam 1 struk (atau 2 struk terpisah dengan header yang jelas). Format yang direkomendasikan: **1 struk per arah** dengan kode grup di header, agar masing-masing mudah dipegang saat boarding.

Sistem `print_jobs` perlu mendukung tipe baru: `round_trip_ticket` yang menghasilkan 2 print job sekaligus.

---

## 9. Cancellation & Reschedule PP

### Cancellation
- **Cancel grup penuh**: cancel kedua booking sekaligus, refund total
- **Cancel satu arah**: misalnya hanya cancel pulang, booking pergi tetap aktif. Group tetap ada tapi `total_amount` diupdate.

### Reschedule
- Reschedule dilakukan per-tiket (sama seperti sekarang)
- Jika reschedule mengubah rute, validasi PP-consistency tidak perlu ketat (sudah boleh beda rute)

---

## 10. Rencana Implementasi (Tahapan)

| Tahap | Pekerjaan | Estimasi |
|---|---|---|
| **T1** | Schema: tabel `booking_groups` + kolom di `bookings` | 0.5 hari |
| **T2** | Backend: API `POST /api/bookings/round-trip` | 1 hari |
| **T3** | Backend: API `GET /api/booking-groups/:code` (cari by kode PP) | 0.5 hari |
| **T4** | Frontend: Toggle PP di TripSelector | 0.5 hari |
| **T5** | Frontend: Multi-step flow (step 3 & 4 baru untuk pulang) | 1.5 hari |
| **T6** | Frontend: Review screen PP | 0.5 hari |
| **T7** | Print: Format struk PP | 0.5 hari |
| **T8** | Cancel/Refund: Support partial cancel PP | 0.5 hari |
| **T9** | Testing end-to-end | 1 hari |
| **Total** | | **~6.5 hari** |

---

## 11. Edge Cases & Risiko

| Skenario | Penanganan |
|---|---|
| Hold pergi berhasil, hold pulang gagal (kursi penuh) | Rollback hold pergi, tampilkan pesan "Kursi pulang tidak tersedia" |
| Hold expire di tengah pengisian data penumpang | Deteksi saat step konfirmasi, minta pilih ulang kursi yang expire |
| Pengguna ingin beda penumpang di tiket pulang | Tidak didukung di fase 1 — penumpang harus sama |
| Trip pulang tidak tersedia di tanggal yang sama | Izinkan pilih tanggal berbeda untuk pulang |
| Promo hanya berlaku untuk satu arah | Apply promo per-booking secara independent |
| Koneksi internet putus saat commit | Gunakan idempotency key — retry aman karena transaksi atomic |

---

## 12. Metrik Keberhasilan

- CSO dapat menyelesaikan booking PP dalam < 3 menit
- 0 kasus double-booking karena race condition
- Struk PP terbaca jelas dan tidak membingungkan penumpang
- Dapat di-cancel satu arah tanpa mempengaruhi arah lainnya
