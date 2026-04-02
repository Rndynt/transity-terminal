# Feature Plan: Pemesanan Pulang Pergi (PP) — CSO Terminal

**Tanggal:** 2 April 2026  
**Status:** Draft  
**Author:** Transity Engineering

---

## 1. Ringkasan

Feature ini menambahkan kemampuan pemesanan **Pulang Pergi (PP)** melalui CSO Terminal. Setiap arah tetap menjadi booking independen di tabel `bookings` seperti biasa — tidak ada perubahan skema besar. Satu-satunya tambahan kecil adalah sebuah field penanda pada booking pulang yang mereferensikan booking pergi.

---

## 2. Pendekatan: Linked Booking

```
bookings (pergi)                bookings (pulang)
  id: TRV-...-FGHIJ      ←──   paired_booking_id: TRV-...-FGHIJ
  trip_id: [trip pergi]           trip_id: [trip pulang]
  origin: Dipatiukur              origin: Atrium Senen
  destination: Atrium Senen       destination: Dipatiukur
  passengers: [Budi, ...]         passengers: [Budi, ...]
```

- Booking pergi: normal, seperti biasa, tidak ada perubahan
- Booking pulang: sama persis, hanya tambah `paired_booking_id` yang menunjuk ke booking pergi

---

## 3. Perubahan Schema

**Hanya satu kolom tambahan** di tabel `bookings` yang sudah ada:

```typescript
pairedBookingId: uuid("paired_booking_id")
  .references(() => bookings.id)
  .nullable()
```

Ini nullable — booking biasa (sekali jalan) tetap `null`. Booking pulang akan diisi ID dari booking pergi.

---

## 4. UX Flow CSO

### Step 1 — Pilih Jadwal Pergi
CSO memilih trip dan kursi untuk arah pergi, persis seperti booking biasa saat ini.

### Step 2 — Pilih Jadwal Pulang
Setelah kursi pergi dikonfirmasi, muncul prompt:

```
┌─────────────────────────────────────────────┐
│  Tambah tiket pulang untuk trip ini?        │
│  [+ Tambah Pulang Pergi]   [Lanjut Biasa]  │
└─────────────────────────────────────────────┘
```

Jika memilih PP:
- Sistem otomatis membuka pemilihan jadwal untuk **rute kebalikan** (origin ↔ destination dibalik)
- CSO memilih trip pulang dan kursi untuk masing-masing penumpang

### Step 3 — Isi Data Penumpang
Satu form penumpang untuk **keduanya**. Data penumpang (nama, dll.) diisi sekali dan digunakan untuk tiket pergi maupun pulang.

```
┌─────────────────────────────────────────────┐
│  PERGI : Dipatiukur → Atrium Senen  09:00  │
│  Kursi: 5A                                  │
│                                             │
│  PULANG: Atrium Senen → Dipatiukur  18:00  │
│  Kursi: 3B                                  │
│                                             │
│  Penumpang 1:  [Nama ____________]          │
│  Penumpang 2:  [Nama ____________]          │
└─────────────────────────────────────────────┘
```

### Step 4 — Review & Bayar
Satu layar ringkasan dengan total kedua tiket, satu transaksi pembayaran.

```
┌─────────────────────────────────────────────┐
│  Pergi  : 2 × Rp 95.000  =  Rp 190.000    │
│  Pulang : 2 × Rp 95.000  =  Rp 190.000    │
│  ─────────────────────────────────────────  │
│  TOTAL  :                    Rp 380.000    │
│                                             │
│              [BAYAR]                        │
└─────────────────────────────────────────────┘
```

### Step 5 — Print
Dua struk terpisah dicetak berurutan:
- **Struk 1/2** — Tiket Pergi (format normal)
- **Struk 2/2** — Tiket Pulang (ada keterangan "PP — Tiket Pulang dari [kode booking pergi]")

---

## 5. Mekanisme Backend

### API: Create Round-Trip Booking

```
POST /api/bookings/round-trip
```

**Request:**
```json
{
  "outbound": {
    "tripId": "...",
    "originStopId": "...",
    "destinationStopId": "...",
    "holdRef": "HOLD-ABC",
    "passengers": [{ "name": "Budi", "seatNo": "5A", "fareAmount": 95000 }]
  },
  "return": {
    "tripId": "...",
    "originStopId": "...",
    "destinationStopId": "...",
    "holdRef": "HOLD-XYZ",
    "passengers": [{ "name": "Budi", "seatNo": "3B", "fareAmount": 95000 }]
  },
  "payment": {
    "method": "cash",
    "amountPaid": 380000
  }
}
```

**Proses dalam 1 DB transaction:**
1. Buat booking pergi → dapat `outboundBookingId`
2. Buat booking pulang dengan `pairedBookingId = outboundBookingId`
3. Insert passengers untuk kedua booking
4. Update seat_inventory kedua trip
5. Delete kedua seat hold
6. Insert satu payment record (total keduanya)
7. Queue 2 print jobs
8. Emit WebSocket kedua trip

---

## 6. Validasi

| Kondisi | Handling |
|---|---|
| Hold pergi ok, hold pulang expire | Rollback semua, CSO pilih ulang kursi pulang |
| Tanggal pulang < tanggal pergi | Validasi di frontend + backend, tampilkan peringatan |
| Jumlah kursi pergi ≠ jumlah kursi pulang | Validasi: harus sama persis |
| Salah satu trip dibatalkan setelah booking | Cancel booking terkait independen, field `paired_booking_id` tetap ada sebagai histori |

---

## 7. Perubahan yang Dibutuhkan

| Area | Perubahan |
|---|---|
| **Schema** | Tambah kolom `paired_booking_id` nullable di `bookings` |
| **Backend** | 1 endpoint baru `POST /api/bookings/round-trip` |
| **Frontend** | Tambah toggle PP + step pilih jadwal pulang di CSO flow |
| **Print** | Tambah label "Tiket Pulang — Ref: [kode pergi]" di struk pulang |

---

## 8. Cancellation

- Cancel tiket pergi saja → booking pulang tetap aktif (tidak terkait)
- Cancel tiket pulang saja → booking pergi tetap aktif
- Cancel keduanya → CSO cancel masing-masing secara manual (atau bisa ditambah tombol "Cancel PP" yang cancel keduanya sekaligus di iterasi berikutnya)

---

## 9. Tahapan Implementasi

| # | Pekerjaan | Estimasi |
|---|---|---|
| T1 | Schema: tambah `paired_booking_id` + `db:push` | 0.5 hari |
| T2 | Backend: endpoint `POST /api/bookings/round-trip` | 1 hari |
| T3 | Frontend: toggle PP + step pilih jadwal pulang | 1 hari |
| T4 | Frontend: form penumpang & review gabungan | 1 hari |
| T5 | Print: format struk pulang dengan ref pergi | 0.5 hari |
| T6 | Testing end-to-end | 0.5 hari |
| **Total** | | **~4.5 hari** |
