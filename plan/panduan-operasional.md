# Panduan Operasional Transity

Dokumen ini menjelaskan **alur lengkap** dari pembuatan data master hingga trip bisa dipesan di terminal reservasi CSO.

---

## Daftar Isi

1. [Gambaran Umum Alur](#1-gambaran-umum-alur)
2. [Langkah 1: Buat Halte (Stops)](#2-langkah-1-buat-halte-stops)
3. [Langkah 2: Buat Outlet](#3-langkah-2-buat-outlet)
4. [Langkah 3: Buat Layout Kursi](#4-langkah-3-buat-layout-kursi)
5. [Langkah 4: Buat Kendaraan (Vehicle)](#5-langkah-4-buat-kendaraan-vehicle)
6. [Langkah 5: Buat Pola Rute (Trip Pattern)](#6-langkah-5-buat-pola-rute-trip-pattern)
7. [Langkah 6: Tambahkan Halte ke Pola (Pattern Stops)](#7-langkah-6-tambahkan-halte-ke-pola-pattern-stops)
8. [Langkah 7: Buat Aturan Harga (Price Rule)](#8-langkah-7-buat-aturan-harga-price-rule)
9. [Langkah 8: Buat Jadwal Template (Trip Base)](#9-langkah-8-buat-jadwal-template-trip-base)
10. [Langkah 9: Reservasi di Terminal CSO](#10-langkah-9-reservasi-di-terminal-cso)
11. [Checklist Cepat](#11-checklist-cepat)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Gambaran Umum Alur

```
Stops → Outlets → Layouts → Vehicles → Trip Patterns → Pattern Stops → Price Rules → Trip Bases → CSO Reservasi
```

Setiap langkah bergantung pada langkah sebelumnya. Jika ada yang terlewat, trip tidak akan muncul atau tidak bisa dipesan di terminal CSO.

---

## 2. Langkah 1: Buat Halte (Stops)

**Menu**: Sidebar → Masters → **Stops**

Halte adalah titik-titik fisik yang dilalui kendaraan. Semua rute dibangun dari halte-halte ini.

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Kode | Ya | Kode unik halte (contoh: `JKT`, `BDG`, `SMG`) |
| Nama | Ya | Nama lengkap (contoh: "Terminal Lebak Bulus") |
| Kota | Tidak | Nama kota, untuk pengelompokan di dropdown CSO |
| Latitude/Longitude | Tidak | Koordinat GPS |

**Contoh**: Jika rute Jakarta → Cirebon → Semarang, buat 3 halte:
- `JKT` — Terminal Jakarta
- `CRB` — Terminal Cirebon
- `SMG` — Terminal Semarang

---

## 3. Langkah 2: Buat Outlet

**Menu**: Sidebar → Masters → **Outlets**

Outlet adalah lokasi penjualan tiket. Setiap outlet terhubung ke **satu halte**. Terminal CSO memfilter trip berdasarkan outlet yang dipilih.

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Halte (Stop) | Ya | Halte yang terkait dengan outlet ini |
| Nama | Ya | Nama outlet (contoh: "Loket Jakarta Utama") |
| Alamat | Tidak | Alamat fisik |
| Telepon | Tidak | Nomor kontak |

**Penting**: Outlet menentukan trip mana yang muncul di CSO. Jika outlet terhubung ke halte "JKT", maka hanya trip yang melewati halte "JKT" yang akan ditampilkan.

**Penting**: Satu halte hanya boleh punya satu outlet.

---

## 4. Langkah 3: Buat Layout Kursi

**Menu**: Sidebar → Masters → **Layouts**

Layout mendefinisikan susunan kursi fisik kendaraan.

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Nama | Ya | Nama layout (contoh: "Executive 2-2", "Economy 3-2") |
| Baris | Ya | Jumlah baris kursi |
| Kolom | Ya | Jumlah kolom kursi |
| Seat Map | Ya | Konfigurasi JSON per kursi (nomor, posisi, tipe) |

Layout digunakan oleh kendaraan dan menentukan bagaimana peta kursi ditampilkan di terminal CSO saat booking.

---

## 5. Langkah 4: Buat Kendaraan (Vehicle)

**Menu**: Sidebar → Masters → **Vehicles**

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Kode | Ya | Kode unik kendaraan (contoh: `BUS-001`) |
| Plat Nomor | Ya | Nomor polisi (contoh: `B 1234 XY`) |
| Layout | Ya | Layout kursi yang digunakan |
| Kapasitas | Ya | Jumlah penumpang maksimal |

Kendaraan akan di-assign ke trip (bisa default dari Trip Base, atau manual di Trip).

---

## 6. Langkah 5: Buat Pola Rute (Trip Pattern)

**Menu**: Sidebar → Masters → **Trip Patterns**

Pola rute mendefinisikan **rute perjalanan** tanpa jadwal waktu. Ini adalah "template rute" yang akan dipakai berulang kali oleh banyak jadwal.

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Kode | Ya | Kode unik pola (contoh: `JKT-SMG`, `SMG-JKT`) |
| Nama | Ya | Nama deskriptif (contoh: "Jakarta - Semarang via Cirebon") |
| Layout Default | Tidak | Layout kursi default untuk trip dari pola ini |
| Kelas Kendaraan | Tidak | Jenis kelas (executive, economy, dll) |
| Aktif | Ya | Apakah pola ini aktif |

---

## 7. Langkah 6: Tambahkan Halte ke Pola (Pattern Stops)

**Menu**: Di dalam halaman Trip Patterns → klik pola → **Edit Pattern Stops**

Setelah pola rute dibuat, tambahkan halte-halte yang dilalui beserta urutannya.

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Halte (Stop) | Ya | Halte yang dilalui |
| Urutan (Sequence) | Ya | Urutan pemberhentian (1, 2, 3, ...) |
| Boleh Naik (Boarding) | Ya | Apakah penumpang boleh naik di halte ini |
| Boleh Turun (Alighting) | Ya | Apakah penumpang boleh turun di halte ini |
| Dwell (detik) | Tidak | Waktu berhenti di halte |

**Contoh** untuk rute Jakarta → Cirebon → Semarang:

| Urutan | Halte | Naik | Turun |
|--------|-------|------|-------|
| 1 | Terminal Jakarta | Ya | Tidak |
| 2 | Terminal Cirebon | Ya | Ya |
| 3 | Terminal Semarang | Tidak | Ya |

**Aturan**:
- Halte pertama (urutan 1): biasanya hanya boleh naik
- Halte terakhir: biasanya hanya boleh turun
- Halte tengah: bisa naik dan turun (transit)

---

## 8. Langkah 7: Buat Aturan Harga (Price Rule)

**Menu**: Sidebar → Masters → **Price Rules**

**INI LANGKAH YANG SERING TERLEWAT!** Trip tanpa aturan harga akan muncul di CSO dengan badge merah "Belum Ada Harga" dan tidak bisa dipesan.

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Scope | Ya | Level penerapan aturan |
| Pola (Pattern) | Tergantung | Wajib jika scope = `pattern` |
| Trip | Tergantung | Wajib jika scope = `trip` |
| Prioritas | Ya | Angka prioritas (lebih tinggi = lebih diutamakan) |
| Aturan (Rule) | Ya | JSON berisi konfigurasi harga |
| Berlaku Dari | Tidak | Tanggal mulai berlaku |
| Berlaku Sampai | Tidak | Tanggal berakhir |

### Scope (Level Penerapan)

| Scope | Keterangan |
|-------|------------|
| `pattern` | Berlaku untuk SEMUA trip dari pola rute ini |
| `trip` | Berlaku hanya untuk SATU trip tertentu |
| `leg` | Berlaku untuk satu segmen tertentu |
| `time` | Berlaku berdasarkan waktu (peak/off-peak) |

**Rekomendasi**: Mulai dengan scope `pattern` agar semua trip dari pola tersebut langsung punya harga.

### Format Aturan (Rule JSON)

```json
{
  "basePricePerLeg": 65000,
  "currency": "IDR",
  "multiplier": 1.0
}
```

| Key | Keterangan |
|-----|------------|
| `basePricePerLeg` | Harga dasar per segmen/leg (dalam satuan mata uang) |
| `currency` | Mata uang (default: IDR) |
| `multiplier` | Pengali harga (1.0 = normal, 1.5 = 150%, 0.8 = diskon 20%) |

### Cara Hitung Harga

```
Total = basePricePerLeg × multiplier × jumlah_leg
```

**Contoh**: Rute Jakarta → Cirebon → Semarang (2 leg)
- basePricePerLeg = 65.000
- multiplier = 1.0
- Jakarta → Semarang (2 leg) = 65.000 × 1.0 × 2 = **Rp 130.000**
- Jakarta → Cirebon (1 leg) = 65.000 × 1.0 × 1 = **Rp 65.000**
- Cirebon → Semarang (1 leg) = 65.000 × 1.0 × 1 = **Rp 65.000**

**Harga 0 diperbolehkan** — yang penting record price rule-nya ada. Ini berguna untuk trip gratis atau promo.

### Prioritas

Jika ada beberapa rule yang cocok untuk satu trip, sistem mengambil yang **prioritas tertinggi**:
1. Rule dengan `scope=trip` dan `tripId` cocok → tertinggi
2. Rule dengan `scope=pattern` dan `patternId` cocok → fallback

---

## 9. Langkah 8: Buat Jadwal Template (Trip Base)

**Menu**: Sidebar → Masters → **Trips** → Tab "Trip Bases" atau langsung di halaman Trips

Trip Base adalah **jadwal template** yang menentukan kapan pola rute beroperasi. Dari sini, trip virtual akan muncul otomatis di CSO.

| Field | Wajib | Keterangan |
|-------|-------|------------|
| Nama | Ya | Nama jadwal (contoh: "Pagi Jakarta-Semarang") |
| Kode | Tidak | Kode jadwal |
| Pola Rute (Pattern) | Ya | Pola rute yang digunakan |
| Timezone | Ya | Zona waktu (default: Asia/Jakarta) |
| Hari Operasi | Ya | Centang hari yang aktif (Sen-Min) |
| Berlaku Dari | Tidak | Tanggal mulai berlaku |
| Berlaku Sampai | Tidak | Tanggal berakhir |
| Kendaraan Default | Tidak | Kendaraan yang di-assign secara default |
| Layout Default | Tidak | Layout kursi default |
| Kapasitas | Tidak | Kapasitas penumpang |
| Aktif | Ya | Harus aktif agar muncul di CSO |

### Default Stop Times (Waktu Halte Default)

Ini bagian **paling penting** dari Trip Base. Anda harus mengisi waktu keberangkatan/kedatangan untuk setiap halte dalam format **HH:MM** (waktu lokal).

**Contoh** untuk rute Jakarta → Cirebon → Semarang, berangkat pagi:

| Urutan | Halte | Berangkat | Tiba |
|--------|-------|-----------|------|
| 1 | Terminal Jakarta | 06:00 | — |
| 2 | Terminal Cirebon | 10:00 | 09:45 |
| 3 | Terminal Semarang | — | 14:00 |

**Aturan**:
- Halte pertama: hanya isi waktu **Berangkat** (departAt)
- Halte terakhir: hanya isi waktu **Tiba** (arriveAt)
- Halte tengah: isi keduanya (tiba dulu, lalu berangkat setelah jeda)

### Cara Kerja Virtual Scheduling

Setelah Trip Base dibuat dan aktif:
1. Sistem otomatis menghitung trip virtual untuk setiap hari yang aktif
2. Trip virtual muncul di CSO tanpa disimpan ke database
3. Saat CSO klik trip virtual → otomatis di-**materialize** jadi trip nyata
4. Materialisasi menciptakan: record `trips` + `trip_stop_times` + `trip_legs` + `seat_inventory`

---

## 10. Langkah 9: Reservasi di Terminal CSO

**Menu**: Sidebar → Operations → **Reservasi**

### Alur Reservasi

1. **Pilih Outlet** — dropdown menampilkan semua outlet yang terdaftar, dikelompokkan per kota
2. **Pilih Tanggal** — kalendar dengan navigasi hari/bulan
3. **Pilih Trip** — daftar trip yang tersedia untuk outlet dan tanggal tersebut

### Status Trip di CSO

| Badge | Warna | Artinya |
|-------|-------|---------|
| Aktif | Hijau | Trip aktif, bisa dipesan |
| Jadwal Virtual | Ungu | Belum di-materialize, klik untuk mengaktifkan |
| Sudah Lewat | Oranye/Abu | Waktu berangkat sudah lewat |
| Ditutup | Merah | Trip ditutup, tidak bisa dipesan |
| Belum Ada Harga | Merah + ⚠ | **Tidak ada aturan harga** — hubungi admin |

4. **Pilih Kursi** — peta kursi interaktif, pilih kursi untuk setiap penumpang
5. **Isi Data Penumpang** — nama, nomor HP
6. **Pilih Metode Pembayaran** — tunai, transfer, dll
7. **Konfirmasi & Cetak Tiket**

### Jika Trip Tidak Muncul di CSO

Periksa daftar berikut:
- [ ] Outlet sudah terhubung ke halte yang benar?
- [ ] Halte outlet ada dalam pola rute yang aktif?
- [ ] Halte outlet punya izin naik (boarding) ATAU turun (alighting)?
- [ ] Trip Base aktif dan hari ini masuk jadwal operasi?
- [ ] Tanggal hari ini dalam rentang validFrom-validTo (jika diisi)?

### Jika Trip Muncul Tapi Tidak Bisa Dipesan

- [ ] Apakah ada badge merah "Belum Ada Harga"? → Buat aturan harga untuk pola rute ini
- [ ] Apakah status "Ditutup"? → Trip sudah ditutup oleh admin
- [ ] Apakah "Sudah Lewat" + Virtual? → Tidak bisa materialize trip yang sudah lewat

---

## 11. Checklist Cepat

Gunakan checklist ini untuk memastikan semua langkah sudah dilakukan:

```
□ 1. Buat halte-halte (Stops) yang dibutuhkan
□ 2. Buat outlet untuk setiap lokasi penjualan tiket
□ 3. Buat layout kursi kendaraan
□ 4. Buat kendaraan dan assign layout
□ 5. Buat pola rute (Trip Pattern) dengan kode unik
□ 6. Tambahkan halte ke pola rute (Pattern Stops) dengan urutan benar
□ 7. ★ Buat aturan harga (Price Rule) untuk pola rute — JANGAN LEWATKAN!
□ 8. Buat jadwal template (Trip Base) dengan waktu halte default
□ 9. Pastikan Trip Base aktif dan hari operasi sesuai
□ 10. Buka Reservasi → pilih outlet → pilih tanggal → trip harus muncul
```

---

## 12. Troubleshooting

### "Belum Ada Harga" muncul di trip
**Penyebab**: Tidak ada record di tabel `price_rules` untuk pola rute ini.
**Solusi**: Buka menu **Price Rules** → buat aturan harga dengan scope `pattern` → pilih pola rute yang sesuai.

### Trip tidak muncul sama sekali di CSO
**Penyebab kemungkinan**:
1. Outlet tidak terhubung ke halte yang dilalui trip
2. Trip Base tidak aktif
3. Hari ini bukan hari operasi Trip Base
4. Tanggal di luar rentang validFrom/validTo
5. Halte outlet tidak punya izin naik atau turun di pola rute

**Solusi**: Cek satu per satu sesuai checklist di atas.

### Trip virtual muncul tapi gagal di-materialize
**Penyebab kemungkinan**:
1. Trip virtual sudah lewat waktunya (tidak bisa di-materialize trip yang sudah lewat)
2. Kendaraan atau layout belum di-assign

### Harga tidak sesuai
**Solusi**: Cek aturan harga yang berlaku:
- Apakah ada rule dengan scope `trip` yang override rule `pattern`?
- Cek nilai `multiplier` (mungkin bukan 1.0)
- Hitung manual: basePricePerLeg × multiplier × jumlah leg

### Kursi tidak muncul di peta kursi
**Penyebab**: Layout belum dikonfigurasi dengan benar atau seat inventory belum di-generate.
**Solusi**: Pastikan kendaraan memiliki layout yang valid dengan seat map yang benar.
