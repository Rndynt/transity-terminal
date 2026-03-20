# Pricing Enforcement Plan

## Masalah

`PricingService.quoteFare()` menggunakan hardcode fallback `25.000 IDR per leg` ketika tidak ada price rule yang ditemukan. Ini berbahaya karena:

- Tiket bisa diterbitkan dengan harga yang salah
- Operator tidak sadar bahwa trip belum dikonfigurasi harganya
- Tidak ada mekanisme blokir pemesanan untuk trip tanpa harga

## Aturan Baru

1. **Harga harus bersumber dari price rule** — tidak boleh ada hardcode fallback
2. **Harga 0 diperbolehkan** — yang penting record price rule-nya ada
3. **Trip tanpa price rule tidak boleh muncul di reservasi CSO**
4. **Operator harus diberi tahu** mana trip yang belum punya harga

---

## Perubahan yang Dilakukan

### Backend

#### `server/modules/pricing/pricing.service.ts`
- **Hapus** hardcode `basePricePerLeg = 25000`
- Cari price rule berdasarkan prioritas: trip-specific → pattern → global
- Jika tidak ada rule → throw `Error('NO_PRICE_RULE')`
- Hitung harga: `basePricePerLeg × multiplier × jumlah_leg`

#### `server/routes.ts` (IStorage interface)
- Tambah method `getPriceRulesForTrip(tripId: string, patternId: string): Promise<PriceRule[]>`

#### `server/storage.ts`
- Implementasi `getPriceRulesForTrip` — query rules dengan filter `tripId` atau `patternId`
- Tambah subquery `hasPriceRule` di `getRealTripsForCso` menggunakan SQL EXISTS
- Tambah `hasPriceRule` di `getVirtualTripsForCso` berdasarkan patternId

#### `shared/schema.ts`
- Tambah field `hasPriceRule: boolean` di tipe `CsoAvailableTrip`

#### `server/modules/bookings/bookings.service.ts`
- Tangkap error `NO_PRICE_RULE` dari `quoteFare` dan lempar ulang dengan pesan jelas dalam bahasa yang bisa ditampilkan ke CSO

#### `server/modules/pricing/pricing.controller.ts`
- Tangkap error `NO_PRICE_RULE` dan kembalikan response 422 dengan `code: 'NO_PRICE_RULE'`

### Frontend

#### `client/src/components/cso/TripSelector.tsx`
- Trip dengan `hasPriceRule: false` ditampilkan dengan badge peringatan "Belum Ada Harga"
- Trip tersebut tidak bisa diklik/dipilih
- Tooltip menjelaskan bahwa trip ini belum dapat dipesan karena belum ada aturan harga

---

## Alur Lookup Price Rule

```
quoteFare(tripId, originSeq, destSeq)
  └─ getPriceRulesForTrip(tripId, patternId)
       ├─ scope='trip'    AND trip_id    = tripId     → prioritas tertinggi
       ├─ scope='pattern' AND pattern_id = patternId  → fallback ke pola
       └─ scope='global'                              → fallback global
       
  Tidak ada rule → throw Error('NO_PRICE_RULE')
  Ada rule       → basePricePerLeg × multiplier × legs
```

---

## Cara Konfigurasi Harga Trip

1. Masuk ke menu **Masters → Aturan Harga**
2. Klik **Tambah Aturan**
3. Pilih scope:
   - **Pola** (`pattern`) → berlaku untuk semua trip dari pola tersebut
   - **Trip** (`trip`) → berlaku khusus satu trip tertentu
4. Isi **Harga Dasar per Leg** (boleh 0)
5. Simpan

Setelah aturan harga ditambahkan, trip akan otomatis muncul di reservasi CSO.
