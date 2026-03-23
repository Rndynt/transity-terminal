# PERJANJIAN COMMERCIAL FEE
## SISTEM MANAJEMEN TRANSPORTASI TRANSITY

---

**Nomor: CF/TRANSITY/____/____**

**Lampiran dari PKS Nomor: PKS/TRANSITY/____/____**

Pada hari ini, tanggal __________, bertempat di __________, telah ditandatangani Perjanjian Commercial Fee (selanjutnya disebut **"Perjanjian"**) oleh dan antara:

---

### PIHAK PERTAMA

| | |
|---|---|
| **Nama** | PT Transity Teknologi Indonesia |
| **Alamat** | ________________________________ |
| **NPWP** | ________________________________ |
| **Diwakili oleh** | ________________________________ |
| **Jabatan** | Direktur Utama |

Selanjutnya disebut **"PIHAK PERTAMA"** atau **"TRANSITY"**

### PIHAK KEDUA

| | |
|---|---|
| **Nama Perusahaan** | ________________________________ |
| **Alamat** | ________________________________ |
| **NPWP** | ________________________________ |
| **Diwakili oleh** | ________________________________ |
| **Jabatan** | ________________________________ |

Selanjutnya disebut **"PIHAK KEDUA"** atau **"OPERATOR"**

---

## PASAL 1 — DEFINISI

Dalam Perjanjian ini yang dimaksud dengan:

1. **"Sistem Transity"** adalah platform manajemen transportasi berbasis web yang disediakan oleh PIHAK PERTAMA, mencakup modul reservasi, penjadwalan, kargo, pembayaran, dan pelaporan.

2. **"Transaksi"** adalah setiap aktivitas penjualan yang berhasil diproses dan dibayar (berstatus **paid**) melalui Sistem Transity, meliputi:
   - a. Penjualan tiket penumpang (booking)
   - b. Pengiriman kargo (cargo shipment)

3. **"Nilai Transaksi"** adalah jumlah total pembayaran yang diterima dari pelanggan untuk setiap Transaksi, sebelum dikurangi potongan atau diskon apapun (**gross amount**).

4. **"Commercial Fee"** adalah biaya layanan yang dikenakan kepada PIHAK KEDUA sebesar persentase tertentu dari Nilai Transaksi sebagai kompensasi atas penggunaan Sistem Transity.

5. **"Periode Penagihan"** adalah periode waktu yang digunakan sebagai dasar perhitungan dan penagihan Commercial Fee, yaitu per **bulan kalender** (tanggal 1 s/d akhir bulan).

6. **"Rekonsiliasi"** adalah proses pencocokan data transaksi antara PIHAK PERTAMA dan PIHAK KEDUA untuk memastikan keakuratan perhitungan Commercial Fee.

---

## PASAL 2 — BESARAN COMMERCIAL FEE

1. PIHAK KEDUA dikenakan Commercial Fee sebesar **3% (tiga persen)** dari Nilai Transaksi untuk setiap Transaksi yang berhasil diproses melalui Sistem Transity.

2. Besaran persentase ini sudah termasuk:
   - a. Biaya penggunaan seluruh fitur Sistem Transity tanpa batasan
   - b. Biaya pemeliharaan dan hosting server
   - c. Biaya dukungan teknis standar (jam kerja)
   - d. Biaya pembaruan dan pengembangan fitur

3. Besaran persentase ini **belum termasuk**:
   - a. Pajak Pertambahan Nilai (PPN) sebesar 11% yang dikenakan atas Commercial Fee, yang menjadi beban PIHAK KEDUA
   - b. Biaya pelatihan on-site (jika diminta secara khusus)
   - c. Biaya pengembangan fitur kustom (jika ada)

---

## PASAL 3 — CONTOH PERHITUNGAN

Untuk memberikan kejelasan, berikut contoh perhitungan Commercial Fee:

### Contoh 1: Transaksi Tiket Penumpang
| Keterangan | Jumlah |
|---|---|
| Harga tiket | Rp 250.000 |
| Diskon/Voucher | Rp 25.000 |
| Jumlah dibayar pelanggan | Rp 225.000 |
| **Nilai Transaksi (basis perhitungan)** | **Rp 250.000** |
| Commercial Fee (3%) | Rp 7.500 |
| PPN 11% atas Commercial Fee | Rp 825 |
| **Total tagihan ke Operator** | **Rp 8.325** |

### Contoh 2: Transaksi Kargo
| Keterangan | Jumlah |
|---|---|
| Biaya kirim | Rp 150.000 |
| **Nilai Transaksi** | **Rp 150.000** |
| Commercial Fee (3%) | Rp 4.500 |
| PPN 11% atas Commercial Fee | Rp 495 |
| **Total tagihan ke Operator** | **Rp 4.995** |

### Contoh 3: Rekap Bulanan
| Keterangan | Jumlah |
|---|---|
| Total transaksi tiket bulan ini | Rp 150.000.000 |
| Total transaksi kargo bulan ini | Rp 25.000.000 |
| **Total Nilai Transaksi** | **Rp 175.000.000** |
| Commercial Fee (3%) | Rp 5.250.000 |
| PPN 11% | Rp 577.500 |
| **Total tagihan bulan ini** | **Rp 5.827.500** |

---

## PASAL 4 — TRANSAKSI YANG DIKENAKAN FEE

### 4.1 Transaksi yang Dikenakan Commercial Fee:
1. Booking tiket penumpang dengan status **paid** atau **confirmed** yang telah dilunasi.
2. Pengiriman kargo dengan status **paid**.

### 4.2 Transaksi yang TIDAK Dikenakan Commercial Fee:
1. Booking yang dibatalkan (**canceled**) sebelum pembayaran.
2. Booking yang di-refund penuh — Commercial Fee yang sudah dibayarkan akan dikreditkan ke tagihan periode berikutnya.
3. Booking dalam status **pending** yang belum dibayar.
4. Pemindahan kursi (seat reassign) atau reschedule yang tidak menghasilkan pembayaran baru.
5. Transaksi uji coba (test transaction) yang disepakati bersama.

### 4.3 Ketentuan Refund dan Pembatalan:
1. Apabila terjadi **refund penuh**, Commercial Fee yang telah dihitung akan dikreditkan ke tagihan periode berikutnya.
2. Apabila terjadi **refund sebagian (partial refund)**, Commercial Fee dihitung ulang berdasarkan Nilai Transaksi setelah refund.
3. Reschedule tanpa perubahan harga tidak menghasilkan Commercial Fee tambahan.
4. Reschedule dengan kenaikan harga dikenakan Commercial Fee atas selisih kenaikan.

---

## PASAL 5 — MEKANISME PERHITUNGAN DAN PENAGIHAN

### 5.1 Periode Perhitungan
1. Commercial Fee dihitung per **bulan kalender** (tanggal 1 sampai dengan akhir bulan).
2. Dasar perhitungan menggunakan tanggal **paid_at** (tanggal pembayaran diterima) dari setiap Transaksi.

### 5.2 Laporan dan Rekonsiliasi
1. PIHAK PERTAMA akan menyediakan **Laporan Commercial Fee** secara otomatis melalui Sistem Transity, yang dapat diakses oleh PIHAK KEDUA melalui menu Laporan.
2. Laporan mencakup:
   - a. Rincian setiap transaksi (nomor booking, tanggal, rute, jumlah)
   - b. Total Nilai Transaksi per kategori (tiket dan kargo)
   - c. Total Commercial Fee yang dikenakan
   - d. PPN yang dikenakan
3. PIHAK KEDUA memiliki waktu **5 (lima) hari kerja** sejak laporan tersedia untuk mengajukan keberatan atau koreksi. Setelah lewat waktu tersebut, laporan dianggap disetujui.

### 5.3 Penerbitan Invoice
1. PIHAK PERTAMA akan menerbitkan **invoice** paling lambat tanggal **5 (lima)** bulan berikutnya.
2. Invoice dikirimkan melalui email dan tersedia di dalam Sistem Transity.
3. Invoice mencantumkan: Periode, Jumlah Transaksi, Total Nilai Transaksi, Commercial Fee, PPN, dan Total Tagihan.

---

## PASAL 6 — PEMBAYARAN

### 6.1 Jatuh Tempo
1. Pembayaran Commercial Fee jatuh tempo **14 (empat belas) hari kalender** setelah tanggal invoice.
2. Contoh: Invoice tertanggal 5 Januari 2026, jatuh tempo pembayaran tanggal 19 Januari 2026.

### 6.2 Metode Pembayaran
Pembayaran dilakukan melalui transfer bank ke rekening PIHAK PERTAMA:

| | |
|---|---|
| **Bank** | ________________________________ |
| **Nomor Rekening** | ________________________________ |
| **Atas Nama** | PT Transity Teknologi Indonesia |

### 6.3 Bukti Pembayaran
1. PIHAK KEDUA wajib mengirimkan bukti transfer kepada PIHAK PERTAMA melalui email atau kanal komunikasi yang disepakati.
2. PIHAK PERTAMA akan menerbitkan kwitansi/tanda terima dalam waktu **3 (tiga) hari kerja** setelah pembayaran diterima.

### 6.4 Keterlambatan Pembayaran
1. Keterlambatan pembayaran dikenakan **denda 0,5% (nol koma lima persen) per hari** dari total tagihan yang belum dibayar, dengan akumulasi maksimal **10% (sepuluh persen)**.
2. Apabila pembayaran terlambat lebih dari **30 (tiga puluh) hari kalender**, PIHAK PERTAMA berhak menangguhkan akses PIHAK KEDUA ke Sistem Transity dengan pemberitahuan tertulis 7 hari sebelumnya.
3. Apabila pembayaran terlambat lebih dari **60 (enam puluh) hari kalender**, PIHAK PERTAMA berhak mengakhiri Perjanjian secara sepihak sesuai ketentuan dalam PKS.

---

## PASAL 7 — PAJAK

1. Seluruh pajak yang timbul sehubungan dengan Perjanjian ini menjadi tanggung jawab masing-masing Pihak sesuai dengan peraturan perpajakan yang berlaku.
2. PPN atas Commercial Fee dibebankan kepada PIHAK KEDUA dan akan dicantumkan dalam invoice.
3. PIHAK PERTAMA akan menerbitkan Faktur Pajak sesuai ketentuan perpajakan yang berlaku.
4. Apabila PIHAK KEDUA merupakan pemotong pajak (withholding tax), maka bukti potong harus diserahkan kepada PIHAK PERTAMA paling lambat akhir bulan berikutnya.

---

## PASAL 8 — PENYESUAIAN TARIF

1. Besaran Commercial Fee sebagaimana diatur dalam Pasal 2 berlaku selama **12 (dua belas) bulan** pertama sejak Perjanjian ini ditandatangani.
2. Setelah periode tersebut, PIHAK PERTAMA berhak mengusulkan penyesuaian tarif dengan pemberitahuan tertulis **60 (enam puluh) hari kalender** sebelum tarif baru berlaku.
3. Penyesuaian tarif harus mendapat persetujuan tertulis dari PIHAK KEDUA. Apabila tidak tercapai kesepakatan, tarif lama tetap berlaku sampai:
   - a. Tercapai kesepakatan baru, atau
   - b. Salah satu Pihak mengakhiri Perjanjian sesuai ketentuan PKS
4. Penyesuaian tarif maksimal **1% (satu persen)** per tahun dari tarif sebelumnya.

---

## PASAL 9 — PROGRAM INSENTIF

1. PIHAK PERTAMA dapat memberikan **diskon Commercial Fee** berdasarkan volume transaksi bulanan PIHAK KEDUA, sebagai berikut:

| Volume Transaksi Bulanan | Diskon Commercial Fee |
|---|---|
| < Rp 100.000.000 | 0% (tarif normal 3%) |
| Rp 100.000.000 - Rp 500.000.000 | 5% dari fee (efektif 2,85%) |
| Rp 500.000.000 - Rp 1.000.000.000 | 10% dari fee (efektif 2,70%) |
| > Rp 1.000.000.000 | 15% dari fee (efektif 2,55%) |

2. Diskon dihitung secara otomatis pada akhir periode penagihan dan diterapkan pada invoice bulan berjalan.
3. PIHAK PERTAMA berhak meninjau dan mengubah skema insentif ini dengan pemberitahuan tertulis **30 hari** sebelum perubahan berlaku.

---

## PASAL 10 — AUDIT

1. Masing-masing Pihak berhak melakukan audit atas data transaksi yang menjadi dasar perhitungan Commercial Fee.
2. Permintaan audit harus disampaikan secara tertulis dengan waktu pemberitahuan minimal **14 (empat belas) hari**.
3. Biaya audit ditanggung oleh Pihak yang meminta, kecuali ditemukan selisih lebih dari **5% (lima persen)** dari total tagihan, maka biaya audit ditanggung oleh Pihak yang melakukan kesalahan perhitungan.
4. Apabila ditemukan kelebihan pembayaran, kelebihan tersebut akan dikreditkan ke tagihan periode berikutnya. Apabila ditemukan kekurangan pembayaran, PIHAK KEDUA wajib melunasi dalam waktu **14 (empat belas) hari kerja**.

---

## PASAL 11 — MASA PERCOBAAN (GRACE PERIOD)

1. Selama **30 (tiga puluh) hari pertama** sejak PIHAK KEDUA mulai menggunakan Sistem Transity secara aktif, PIHAK KEDUA mendapatkan **grace period** di mana tidak dikenakan Commercial Fee.
2. Grace period dimaksudkan untuk memberikan waktu kepada PIHAK KEDUA melakukan migrasi data, pelatihan staf, dan penyesuaian operasional.
3. Transaksi yang dilakukan selama grace period tetap tercatat dalam sistem, namun tidak diperhitungkan dalam penagihan Commercial Fee.
4. Perpanjangan grace period hanya dapat dilakukan berdasarkan persetujuan tertulis PIHAK PERTAMA.

---

## PASAL 12 — KETENTUAN PERALIHAN

1. Apabila Perjanjian ini berakhir atau diakhiri:
   - a. PIHAK KEDUA tetap wajib membayar seluruh Commercial Fee atas transaksi yang telah diproses hingga tanggal efektif pengakhiran.
   - b. Invoice terakhir akan diterbitkan paling lambat **15 (lima belas) hari** setelah tanggal efektif pengakhiran.
   - c. Pembayaran invoice terakhir mengikuti ketentuan jatuh tempo yang sama.

---

## PASAL 13 — KETENTUAN PENUTUP

1. Perjanjian ini merupakan lampiran dan bagian tidak terpisahkan dari Perjanjian Kerja Sama (PKS) Nomor PKS/TRANSITY/____/____.
2. Hal-hal yang tidak diatur dalam Perjanjian ini mengacu pada ketentuan dalam PKS.
3. Perjanjian ini dibuat dalam rangkap 2 (dua), masing-masing bermaterai cukup dan mempunyai kekuatan hukum yang sama.

---

Demikian Perjanjian ini dibuat dan ditandatangani oleh PARA PIHAK pada tanggal dan tempat tersebut di atas.

&nbsp;

| **PIHAK PERTAMA** | **PIHAK KEDUA** |
|---|---|
| PT Transity Teknologi Indonesia | ________________________________ |
| | |
| | |
| | |
| | |
| ________________________________ | ________________________________ |
| Nama: | Nama: |
| Jabatan: Direktur Utama | Jabatan: |
| Tanggal: | Tanggal: |

&nbsp;

**Saksi-saksi:**

| **Saksi 1** | **Saksi 2** |
|---|---|
| | |
| | |
| ________________________________ | ________________________________ |
| Nama: | Nama: |
