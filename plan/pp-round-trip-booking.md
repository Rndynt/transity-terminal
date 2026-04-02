# Feature Plan: Pemesanan Pulang Pergi (PP) — CSO Terminal

**Tanggal:** 2 April 2026  
**Status:** Draft — Approved  
**Pendekatan:** Booking Group  

---

## 1. Ringkasan

Feature ini menambahkan kemampuan pemesanan **Pulang Pergi (PP)** melalui CSO Terminal untuk penumpang offline (walk-in). Dua booking independen (pergi + pulang) diikat oleh satu entitas grup (`booking_groups`), sehingga transaksi PP bisa dilacak, dilaporkan, dan dikelola sebagai satu kesatuan — tanpa mengubah logika booking yang sudah ada.

---

## 2. Arsitektur: Booking Group

```
booking_groups
  ├── id
  ├── group_code       "PP-20260402-ABCDE"   ← kode yang dipegang pelanggan
  ├── type             'round_trip'
  ├── total_amount     380000
  ├── channel          'CSO'
  ├── outlet_id        → outlets.id
  ├── created_by       → staff id
  └── created_at

bookings (pergi)                    bookings (pulang)
  ├── id: TRV-...-FGHIJ               ├── id: TRV-...-KLMNO
  ├── group_id ──────────────────────→├── group_id ──────────┐
  ├── leg_type: 'outbound'            ├── leg_type: 'return'  │
  ├── trip_id: [trip pergi]           ├── trip_id: [pulang]   │
  ├── origin: Dipatiukur              ├── origin: Atrium Senen│
  ├── destination: Atrium Senen       ├── destination: DipaT. │
  └── passengers: [...]               └── passengers: [...]   │
                                                              │
                              booking_groups ←────────────────┘
```

- Booking pergi & pulang masing-masing tetap berdiri sendiri di tabel `bookings`
- Keduanya dihubungkan via `group_id` → `booking_groups.id`
- Field `leg_type` membedakan pergi (`outbound`) dari pulang (`return`)
- Booking tunggal biasa tetap `group_id = null` dan `leg_type = 'single'` (default)

---

## 3. Perubahan Schema

### 3.1 Tabel Baru: `booking_groups`

```typescript
// shared/schema/booking.ts

export const bookingGroups = pgTable("booking_groups", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupCode:   text("group_code").notNull().unique(),
  type:        text("type").notNull().default("round_trip"),
  channel:     bookingChannelEnum("channel").notNull().default("CSO"),
  totalAmount: integer("total_amount").notNull(),
  outletId:    uuid("outlet_id").references(() => outlets.id),
  createdBy:   text("created_by"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertBookingGroupSchema = createInsertSchema(bookingGroups).omit({
  id: true, createdAt: true,
});
export type BookingGroup    = typeof bookingGroups.$inferSelect;
export type InsertBookingGroup = z.infer<typeof insertBookingGroupSchema>;
```

### 3.2 Tambahan Kolom di `bookings`

```typescript
// Tambah pada tabel bookings yang sudah ada:

groupId:  uuid("group_id")
            .references(() => bookingGroups.id)
            .default(sql`NULL`),

legType:  text("leg_type").notNull().default("single"),
          // nilai: 'single' | 'outbound' | 'return'
```

### 3.3 Kode Grup

Format kode grup konsisten dengan kode booking yang sudah ada:

```
PP-YYYYMMDD-XXXXX
│  │         └── 5 karakter random (charset tanpa huruf/angka ambigu)
│  └── tanggal pergi
└── prefix PP (Pulang Pergi)
```

Contoh: `PP-20260402-BDG7K`

---

## 4. UX Flow CSO

### 4.1 Entry Point — Toggle PP

Di bagian atas TripSelector, tambahkan toggle mode:

```
╔══════════════════════════════════╗
║  ○ Sekali Jalan   ● Pulang Pergi ║
╚══════════════════════════════════╝
```

Saat mode PP aktif, progress stepper muncul di atas form:

```
● ───── ◌ ───── ◌ ───── ◌ ───── ◌
Pergi  Pulang  Penumpang  Bayar  Selesai
```

---

### 4.2 Step 1 — Pilih Jadwal & Kursi Pergi

Identik dengan flow booking biasa saat ini. CSO memilih:
- Outlet keberangkatan
- Tanggal
- Jadwal (trip)
- Kursi per penumpang

---

### 4.3 Step 2 — Pilih Jadwal & Kursi Pulang

Setelah kursi pergi dikunci (hold), muncul step pilih jadwal pulang:

- **Outlet otomatis dibalik**: destinasi pergi → jadi origin pulang
- **Filter rute**: hanya tampilkan rute kebalikan dari pergi
- **Tanggal**: default hari yang sama, bisa diubah
- **Jumlah kursi**: harus sama dengan jumlah penumpang pergi

```
┌─────────────────────────────────────────────────────┐
│  PILIH JADWAL PULANG                                │
│  Rute: Atrium Senen → Dipatiukur                    │
│                                                     │
│  Tanggal: [Sabtu, 4 Apr 2026  ▼]                   │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ JKT-BDG-01   18:00 → 21:35   PR14-02  14/14 │  │
│  │ JKT-BDG-01   21:00 → 00:30   TBD      14/14 │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  [← Kembali ke Step 1]          [Lanjut →]         │
└─────────────────────────────────────────────────────┘
```

---

### 4.4 Step 3 — Isi Data Penumpang

Satu form untuk **semua penumpang**, data berlaku untuk kedua tiket (pergi + pulang):

```
┌─────────────────────────────────────────────────────┐
│  PERGI : Dipatiukur → Atrium Senen  │  09:00        │
│  Kursi : 5A, 5B                     │  PR14-01      │
│                                     │               │
│  PULANG: Atrium Senen → Dipatiukur  │  18:00        │
│  Kursi : 3A, 3B                     │  PR14-02      │
├─────────────────────────────────────────────────────┤
│  Penumpang 1                                        │
│  Nama: [________________________]                   │
│  Penumpang 2                                        │
│  Nama: [________________________]                   │
└─────────────────────────────────────────────────────┘
```

---

### 4.5 Step 4 — Review & Pembayaran

Ringkasan lengkap sebelum bayar:

```
┌─────────────────────────────────────────────────────┐
│  PULANG PERGI — RINGKASAN                           │
│  Kode PP: PP-20260402-BDG7K                         │
├─────────────────────────────────────────────────────┤
│  PERGI                                              │
│  Dipatiukur → Atrium Senen                          │
│  Sabtu, 4 Apr 2026 | 09:00                          │
│  Budi · Kursi 5A          Rp  95.000                │
│  Ani  · Kursi 5B          Rp  95.000                │
│                                                     │
│  PULANG                                             │
│  Atrium Senen → Dipatiukur                          │
│  Sabtu, 4 Apr 2026 | 18:00                          │
│  Budi · Kursi 3A          Rp  95.000                │
│  Ani  · Kursi 3B          Rp  95.000                │
├─────────────────────────────────────────────────────┤
│  TOTAL                            Rp 380.000        │
│  Tunai / Transfer / Debit                           │
│                   [KONFIRMASI & BAYAR]              │
└─────────────────────────────────────────────────────┘
```

---

### 4.6 Step 5 — Selesai & Print

Dua struk dicetak berurutan:

**Struk 1/2 — Tiket Pergi**
```
══════════════════════════════════
  TIKET PERGI          [1 / 2]
  PP: PP-20260402-BDG7K
  Tiket: TRV-20260402-FGHIJ
──────────────────────────────────
  Dipatiukur → Atrium Senen
  Sabtu, 4 Apr 2026 | 09:00
  PR14-01 | Kursi 5A | Budi
══════════════════════════════════
```

**Struk 2/2 — Tiket Pulang**
```
══════════════════════════════════
  TIKET PULANG         [2 / 2]
  PP: PP-20260402-BDG7K
  Tiket: TRV-20260402-KLMNO
──────────────────────────────────
  Atrium Senen → Dipatiukur
  Sabtu, 4 Apr 2026 | 18:00
  PR14-02 | Kursi 3A | Budi
══════════════════════════════════
```

---

## 5. Mekanisme Backend

### 5.1 Endpoint Baru

```
POST /api/bookings/round-trip
GET  /api/booking-groups/:groupCode     ← cari PP by kode grup
```

### 5.2 Request Body

```typescript
{
  outbound: {
    tripId: string,
    originStopId: string,
    destinationStopId: string,
    holdRef: string,
    passengers: Array<{
      name: string,
      seatNo: string,
      fareAmount: number
    }>
  },
  return: {
    tripId: string,
    originStopId: string,
    destinationStopId: string,
    holdRef: string,
    passengers: Array<{
      name: string,
      seatNo: string,
      fareAmount: number
    }>
  },
  payment: {
    method: "cash" | "transfer" | "debit",
    amountPaid: number
  }
}
```

### 5.3 Proses (1 DB Transaction)

```
1. Validasi kedua hold masih aktif
2. Hitung total_amount = sum semua fare kedua booking
3. Generate group_code (PP-YYYYMMDD-XXXXX)
4. INSERT booking_groups → dapat group_id
5. INSERT bookings (pergi, leg_type='outbound', group_id)
6. INSERT passengers pergi
7. INSERT bookings (pulang, leg_type='return', group_id)
8. INSERT passengers pulang
9. UPDATE seat_inventory trip pergi (booked = true)
10. UPDATE seat_inventory trip pulang (booked = true)
11. DELETE seat_holds pergi & pulang
12. INSERT payment (total, ref ke booking_group)
13. Queue 2 print_jobs
14. Emit WebSocket: trip_pergi + trip_pulang inventory updated
```

Jika salah satu step gagal → seluruh transaksi di-rollback.

### 5.4 Hold Strategy

Hold tetap dilakukan per-trip secara terpisah (sama seperti sekarang):

```
POST /api/holds  { tripId: [pergi], seats: [...] }  → holdRef_A
POST /api/holds  { tripId: [pulang], seats: [...] }  → holdRef_B

POST /api/bookings/round-trip  { holdRef_A, holdRef_B, ... }
```

---

## 6. Laporan & Query

Dengan `booking_groups`, query PP menjadi bersih:

```sql
-- Semua transaksi PP hari ini
SELECT bg.group_code, bg.total_amount, bg.created_at
FROM booking_groups bg
WHERE bg.type = 'round_trip'
  AND DATE(bg.created_at) = CURRENT_DATE;

-- Detail booking dalam satu grup PP
SELECT b.id, b.leg_type, b.trip_id, b.origin_stop_id, b.destination_stop_id
FROM bookings b
WHERE b.group_id = '...group_id...';

-- Revenue PP vs sekali jalan
SELECT
  CASE WHEN b.group_id IS NULL THEN 'single' ELSE 'round_trip' END AS type,
  COUNT(*) AS jumlah_booking,
  SUM(b.total_amount) AS total_revenue
FROM bookings b
GROUP BY 1;
```

---

## 7. Cancellation

| Skenario | Handling |
|---|---|
| Cancel tiket pergi saja | Cancel booking pergi; booking pulang & grup tetap aktif |
| Cancel tiket pulang saja | Cancel booking pulang; booking pergi & grup tetap aktif |
| Cancel seluruh PP | Cancel kedua booking via `group_id`; update status grup |
| Reschedule satu arah | Proses reschedule per-booking seperti biasa (sudah ada) |

Tombol **"Cancel PP (keduanya)"** bisa ditambahkan di halaman detail booking grup sebagai shortcut, tapi secara backend tetap memanggil cancel per-booking secara berurutan dalam satu transaksi.

---

## 8. Validasi

| Kondisi | Pesan Error |
|---|---|
| Salah satu hold expire saat commit | "Kursi [pergi/pulang] sudah tidak tersedia. Silakan pilih ulang kursi." |
| Jumlah penumpang pergi ≠ pulang | "Jumlah kursi pergi dan pulang harus sama." |
| Tanggal pulang < tanggal pergi | "Tanggal pulang tidak boleh sebelum tanggal pergi." |
| Rute pulang bukan kebalikan pergi | Warning (tidak diblokir keras, karena bisa intentional) |

---

## 9. Tahapan Implementasi

| # | Pekerjaan | File Utama | Estimasi |
|---|---|---|---|
| **T1** | Schema: tabel `booking_groups` + kolom `group_id`, `leg_type` di `bookings` | `shared/schema/booking.ts` | 0.5 hari |
| **T2** | `db:push` + update IStorage interface | `server/storage.ts` | 0.5 hari |
| **T3** | Backend: `POST /api/bookings/round-trip` | `server/modules/bookings/` | 1 hari |
| **T4** | Backend: `GET /api/booking-groups/:code` | `server/modules/bookings/` | 0.5 hari |
| **T5** | Frontend: toggle PP + step 2 pilih jadwal pulang | `client/src/components/cso/TripSelector.tsx` | 1 hari |
| **T6** | Frontend: step 3 form penumpang gabungan + step 4 review PP | `client/src/components/cso/PassengerForm.tsx` | 1 hari |
| **T7** | Frontend: step 5 print 2 struk PP | `client/src/components/cso/` | 0.5 hari |
| **T8** | Testing end-to-end + edge cases | — | 0.5 hari |
| **Total** | | | **~5.5 hari** |

---

## 10. Edge Cases & Risiko

| Skenario | Mitigasi |
|---|---|
| Hold pergi ok, hold pulang penuh | Rollback hold pergi; tampilkan error; minta pilih ulang kursi pulang |
| Koneksi putus saat commit | Idempotency key pada request; cek duplikat group_code sebelum insert |
| CSO lupa pilih kursi pulang | Disable tombol "Lanjut" di step 2 sampai semua kursi dipilih |
| Trip pulang tidak ada di tanggal yang sama | Izinkan pilih tanggal berbeda (common case: berangkat pagi, pulang besoknya) |
| PP dengan lebih dari 2 penumpang | Supported — jumlah kursi & passengers bisa bebas, asal pergi = pulang |
