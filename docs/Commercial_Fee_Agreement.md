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
| **Nama** | PT. Dari Sini Ke Sana |
| **Alamat** | ________________________________ |
| **NPWP** | ________________________________ |
| **Diwakili oleh** | Rendyanta Maulana |
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

1. **"Sistem Transity"** adalah platform manajemen transportasi berbasis web yang disediakan oleh PIHAK PERTAMA dalam model SaaS (Software as a Service), mencakup modul reservasi, penjadwalan, kargo, pembayaran, dan pelaporan.

2. **"Transaksi"** adalah setiap aktivitas penjualan yang berhasil diproses dan dibayar (berstatus **paid**) melalui Sistem Transity, meliputi:
   - a. Penjualan tiket penumpang (booking)
   - b. Pengiriman kargo (cargo shipment)

3. **"Nilai Transaksi"** adalah jumlah total pembayaran yang diterima dari pelanggan untuk setiap Transaksi, sebelum dikurangi potongan atau diskon apapun (**gross amount**).

4. **"Commercial Fee"** adalah biaya layanan yang dikenakan kepada PIHAK KEDUA sebesar persentase tertentu dari Nilai Transaksi sebagai kompensasi atas penggunaan Sistem Transity.

5. **"Periode Penagihan"** adalah periode waktu yang digunakan sebagai dasar perhitungan dan penagihan Commercial Fee, yaitu per **bulan kalender** (tanggal 1 s/d akhir bulan).

6. **"Rekonsiliasi"** adalah proses pencocokan data transaksi antara PIHAK PERTAMA dan PIHAK KEDUA untuk memastikan keakuratan perhitungan Commercial Fee.

---

## PASAL 2 — BESARAN COMMERCIAL FEE

### 2.1 Tarif Progresif
PIHAK KEDUA dikenakan Commercial Fee berdasarkan **total volume transaksi bulanan** dengan tarif progresif sebagai berikut:

| Tier | Volume Transaksi Bulanan (Gross) | Tarif Commercial Fee |
|---|---|---|
| **Tier 1** | Hingga Rp 200.000.000 | 3,0% |
| **Tier 2** | Rp 200.000.001 — Rp 500.000.000 | 2,75% |
| **Tier 3** | Rp 500.000.001 — Rp 1.000.000.000 | 2,5% |
| **Tier 4** | Di atas Rp 1.000.000.000 | 2,25% |

Tarif diterapkan secara **keseluruhan** (flat rate) berdasarkan total volume transaksi bulan tersebut, bukan secara bertingkat per tier.

### 2.2 Yang Termasuk dalam Commercial Fee
Besaran persentase ini sudah termasuk:
   - a. Biaya penggunaan seluruh fitur Sistem Transity tanpa batasan
   - b. Biaya pemeliharaan dan hosting server
   - c. Biaya dukungan teknis standar (sesuai SLA dalam PKS)
   - d. Biaya pembaruan dan pengembangan fitur standar
   - e. Biaya backup dan keamanan data

### 2.3 Yang Tidak Termasuk dalam Commercial Fee
Besaran persentase ini **belum termasuk**:
   - a. Pajak Pertambahan Nilai (PPN) sebesar 11% yang dikenakan atas Commercial Fee, yang menjadi beban PIHAK KEDUA
   - b. Biaya pelatihan on-site (jika diminta secara khusus)
   - c. Biaya pengembangan fitur kustom (custom development) yang diminta secara khusus

### 2.4 Rasionalisasi Model Win-Win
Model commercial fee ini dirancang agar:
   - a. **Untuk Operator (PIHAK KEDUA)**: Tidak ada biaya tetap di muka — biaya hanya timbul saat ada pendapatan. Tarif progresif menurun seiring pertumbuhan volume, memberikan insentif untuk menggunakan Sistem secara maksimal.
   - b. **Untuk Transity (PIHAK PERTAMA)**: Pendapatan tumbuh seiring pertumbuhan bisnis Operator, menciptakan keselarasan kepentingan (aligned incentives) untuk terus meningkatkan kualitas sistem.

---

## PASAL 3 — CONTOH PERHITUNGAN

Untuk memberikan kejelasan, berikut contoh perhitungan Commercial Fee:

### Contoh 1: Transaksi Tiket Penumpang (Tier 1)
| Keterangan | Jumlah |
|---|---|
| Harga tiket | Rp 250.000 |
| Diskon/Voucher | Rp 25.000 |
| Jumlah dibayar pelanggan | Rp 225.000 |
| **Nilai Transaksi (basis perhitungan = gross)** | **Rp 250.000** |
| Commercial Fee (3,0%) | Rp 7.500 |
| PPN 11% atas Commercial Fee | Rp 825 |
| **Total tagihan ke Operator** | **Rp 8.325** |

### Contoh 2: Transaksi Kargo (Tier 1)
| Keterangan | Jumlah |
|---|---|
| Biaya kirim | Rp 150.000 |
| **Nilai Transaksi** | **Rp 150.000** |
| Commercial Fee (3,0%) | Rp 4.500 |
| PPN 11% atas Commercial Fee | Rp 495 |
| **Total tagihan ke Operator** | **Rp 4.995** |

### Contoh 3: Rekap Bulanan — Operator Kecil (Tier 1)
| Keterangan | Jumlah |
|---|---|
| Total transaksi tiket bulan ini | Rp 120.000.000 |
| Total transaksi kargo bulan ini | Rp 15.000.000 |
| **Total Nilai Transaksi** | **Rp 135.000.000** |
| Tier yang berlaku | **Tier 1 (3,0%)** |
| Commercial Fee | Rp 4.050.000 |
| PPN 11% | Rp 445.500 |
| **Total tagihan bulan ini** | **Rp 4.495.500** |

### Contoh 4: Rekap Bulanan — Operator Besar (Tier 3)
| Keterangan | Jumlah |
|---|---|
| Total transaksi tiket bulan ini | Rp 650.000.000 |
| Total transaksi kargo bulan ini | Rp 80.000.000 |
| **Total Nilai Transaksi** | **Rp 730.000.000** |
| Tier yang berlaku | **Tier 3 (2,5%)** |
| Commercial Fee | Rp 18.250.000 |
| PPN 11% | Rp 2.007.500 |
| **Total tagihan bulan ini** | **Rp 20.257.500** |

### Contoh 5: Perbandingan Tarif per Tier
| Volume Transaksi | Tarif | Commercial Fee | PPN 11% | Total Tagihan | Efektif % dari Gross |
|---|---|---|---|---|---|
| Rp 150.000.000 | 3,0% | Rp 4.500.000 | Rp 495.000 | Rp 4.995.000 | 3,33% |
| Rp 350.000.000 | 2,75% | Rp 9.625.000 | Rp 1.058.750 | Rp 10.683.750 | 3,05% |
| Rp 750.000.000 | 2,5% | Rp 18.750.000 | Rp 2.062.500 | Rp 20.812.500 | 2,78% |
| Rp 1.500.000.000 | 2,25% | Rp 33.750.000 | Rp 3.712.500 | Rp 37.462.500 | 2,50% |

---

## PASAL 4 — TRANSAKSI YANG DIKENAKAN FEE

### 4.1 Transaksi yang Dikenakan Commercial Fee:
1. Booking tiket penumpang dengan status **paid** atau **confirmed** yang telah dilunasi.
2. Pengiriman kargo dengan status **paid**.
3. Pembayaran tambahan yang diproses melalui Sistem (misalnya: upgrade kursi, bagasi tambahan) — apabila fitur tersebut tersedia.

### 4.2 Transaksi yang TIDAK Dikenakan Commercial Fee:
1. Booking yang dibatalkan (**canceled**) sebelum pembayaran.
2. Booking yang di-refund penuh — Commercial Fee yang sudah dihitung akan dikreditkan ke tagihan periode berikutnya.
3. Booking dalam status **pending** yang belum dibayar.
4. Pemindahan kursi (seat reassign) atau reschedule yang tidak menghasilkan pembayaran baru.
5. Transaksi uji coba (test transaction) yang disepakati bersama.
6. Transaksi yang dilakukan selama **Grace Period** (Pasal 10).

### 4.3 Ketentuan Refund dan Pembatalan:
1. Apabila terjadi **refund penuh**, Commercial Fee yang telah dihitung akan dikreditkan ke tagihan periode berikutnya.
2. Apabila terjadi **refund sebagian (partial refund)**, Commercial Fee dihitung ulang berdasarkan Nilai Transaksi setelah refund. Selisih dikreditkan ke tagihan periode berikutnya.
3. Reschedule tanpa perubahan harga tidak menghasilkan Commercial Fee tambahan.
4. Reschedule dengan kenaikan harga dikenakan Commercial Fee atas selisih kenaikan saja.
5. Reschedule dengan penurunan harga — selisih Commercial Fee dikreditkan ke tagihan periode berikutnya.

---

## PASAL 5 — MEKANISME PERHITUNGAN DAN PENAGIHAN

### 5.1 Periode Perhitungan
1. Commercial Fee dihitung per **bulan kalender** (tanggal 1 sampai dengan akhir bulan).
2. Dasar perhitungan menggunakan tanggal **paid_at** (tanggal pembayaran diterima) dari setiap Transaksi.
3. Penentuan tier tarif berdasarkan **akumulasi total Nilai Transaksi** dalam satu bulan kalender.

### 5.2 Laporan dan Rekonsiliasi
1. PIHAK PERTAMA akan menyediakan **Laporan Commercial Fee** secara otomatis melalui Sistem Transity, yang dapat diakses oleh PIHAK KEDUA melalui menu Laporan.
2. Laporan mencakup:
   - a. Rincian setiap transaksi (nomor booking/shipment, tanggal, rute, jumlah)
   - b. Total Nilai Transaksi per kategori (tiket dan kargo)
   - c. Tier tarif yang berlaku berdasarkan volume bulan tersebut
   - d. Total Commercial Fee yang dikenakan
   - e. Kredit dari refund atau koreksi periode sebelumnya (jika ada)
   - f. PPN yang dikenakan
   - g. **Total tagihan bersih**
3. PIHAK KEDUA memiliki waktu **5 (lima) hari kerja** sejak laporan tersedia untuk mengajukan keberatan atau koreksi. Setelah lewat waktu tersebut, laporan dianggap disetujui.
4. Keberatan disampaikan secara tertulis melalui email disertai data pendukung.

### 5.3 Penerbitan Invoice
1. PIHAK PERTAMA akan menerbitkan **invoice** paling lambat tanggal **5 (lima)** bulan berikutnya.
2. Invoice dikirimkan melalui email dan tersedia di dalam Sistem Transity.
3. Invoice mencantumkan: Periode, Jumlah Transaksi, Total Nilai Transaksi, Tier yang Berlaku, Commercial Fee, Kredit (jika ada), PPN, dan Total Tagihan.
4. Invoice disertai Faktur Pajak sesuai ketentuan perpajakan yang berlaku.

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
| **Atas Nama** | PT. Dari Sini Ke Sana |

### 6.3 Bukti Pembayaran
1. PIHAK KEDUA wajib mengirimkan bukti transfer kepada PIHAK PERTAMA melalui email atau kanal komunikasi yang disepakati dalam waktu **2 (dua) hari kerja** setelah pembayaran dilakukan.
2. PIHAK PERTAMA akan menerbitkan kwitansi/tanda terima dalam waktu **3 (tiga) hari kerja** setelah pembayaran diterima dan terverifikasi.

### 6.4 Keterlambatan Pembayaran
1. Keterlambatan pembayaran dikenakan **denda 0,5% (nol koma lima persen) per hari** dari total tagihan yang belum dibayar, dengan akumulasi maksimal **10% (sepuluh persen)** dari total tagihan.
2. Apabila pembayaran terlambat lebih dari **30 (tiga puluh) hari kalender**, PIHAK PERTAMA berhak:
   - a. Menangguhkan akses PIHAK KEDUA ke Sistem Transity dengan pemberitahuan tertulis 7 hari sebelumnya.
   - b. Selama penangguhan, data PIHAK KEDUA tetap tersimpan dan aman, namun akses operasional dihentikan.
3. Apabila pembayaran terlambat lebih dari **60 (enam puluh) hari kalender**, PIHAK PERTAMA berhak mengakhiri Perjanjian secara sepihak sesuai ketentuan dalam PKS.
4. Pembayaran kembali setelah penangguhan akan mengaktifkan kembali akses dalam waktu **1 × 24 jam** setelah pembayaran diterima.

---

## PASAL 7 — PAJAK

1. Seluruh pajak yang timbul sehubungan dengan Perjanjian ini menjadi tanggung jawab masing-masing Pihak sesuai dengan peraturan perpajakan yang berlaku di Indonesia.
2. PPN atas Commercial Fee dibebankan kepada PIHAK KEDUA dan akan dicantumkan dalam invoice.
3. PIHAK PERTAMA akan menerbitkan **Faktur Pajak** sesuai ketentuan perpajakan yang berlaku, termasuk e-Faktur apabila diwajibkan.
4. Apabila PIHAK KEDUA merupakan pemotong pajak (withholding tax agent), maka:
   - a. Pemotongan pajak (PPh Pasal 23 sebesar 2%) dapat dilakukan atas Commercial Fee.
   - b. Bukti potong harus diserahkan kepada PIHAK PERTAMA paling lambat **akhir bulan berikutnya**.
   - c. Apabila bukti potong tidak diserahkan tepat waktu, PIHAK PERTAMA berhak menagihkan jumlah penuh tanpa pemotongan.

---

## PASAL 8 — PENYESUAIAN TARIF

1. Besaran tarif Commercial Fee sebagaimana diatur dalam Pasal 2 berlaku selama **12 (dua belas) bulan pertama** sejak Perjanjian ini ditandatangani.
2. Setelah periode tersebut, PIHAK PERTAMA dapat mengusulkan penyesuaian tarif dengan pemberitahuan tertulis **60 (enam puluh) hari kalender** sebelum tarif baru berlaku.
3. Penyesuaian tarif harus mendapat persetujuan tertulis dari PIHAK KEDUA. Apabila tidak tercapai kesepakatan dalam waktu **30 (tiga puluh) hari** sejak usulan, tarif lama tetap berlaku sampai:
   - a. Tercapai kesepakatan baru, atau
   - b. Salah satu Pihak mengakhiri Perjanjian sesuai ketentuan PKS
4. Penyesuaian tarif naik maksimal **0,5% (nol koma lima persen)** per tahun dari tarif sebelumnya.
5. Penyesuaian tarif turun dapat dilakukan tanpa batasan, berdasarkan negosiasi atau pencapaian target volume tertentu.

---

## PASAL 9 — PROGRAM INSENTIF DAN LOYALTY

### 9.1 Diskon Volume Otomatis
Tarif progresif sebagaimana Pasal 2 sudah merupakan bentuk insentif volume — semakin besar volume transaksi, semakin rendah tarif Commercial Fee yang berlaku.

### 9.2 Early Payment Discount
PIHAK KEDUA mendapatkan **diskon 2% dari total Commercial Fee** apabila pembayaran dilakukan dalam waktu **7 (tujuh) hari kalender** setelah tanggal invoice (sebelum jatuh tempo).

### 9.3 Insentif Pertumbuhan (Growth Bonus)
1. Apabila PIHAK KEDUA berhasil meningkatkan volume transaksi bulanan sebesar **≥ 50%** dibandingkan rata-rata 3 bulan sebelumnya, PIHAK KEDUA mendapatkan **diskon tambahan 0,1%** dari tarif yang berlaku untuk bulan tersebut.
2. Growth Bonus dihitung otomatis dan diterapkan pada invoice bulan berjalan.

### 9.4 Peninjauan Insentif
PIHAK PERTAMA berhak meninjau dan mengubah skema insentif (Pasal 9.2 dan 9.3) dengan pemberitahuan tertulis **30 hari** sebelum perubahan berlaku. Perubahan tidak berlaku retroaktif.

---

## PASAL 10 — MASA PERCOBAAN (GRACE PERIOD)

1. Selama **30 (tiga puluh) hari pertama** sejak PIHAK KEDUA mulai menggunakan Sistem Transity secara aktif (dibuktikan dengan Berita Acara Serah Terima Implementasi), PIHAK KEDUA mendapatkan **grace period** di mana tidak dikenakan Commercial Fee.
2. Grace period dimaksudkan untuk memberikan waktu kepada PIHAK KEDUA melakukan:
   - a. Migrasi data dari sistem sebelumnya
   - b. Pelatihan staf dan familiarisasi sistem
   - c. Penyesuaian operasional dan konfigurasi
   - d. Pengujian proses bisnis end-to-end
3. Transaksi yang dilakukan selama grace period tetap tercatat dalam sistem, namun tidak diperhitungkan dalam penagihan Commercial Fee.
4. Perpanjangan grace period hanya dapat dilakukan berdasarkan persetujuan tertulis PIHAK PERTAMA, dengan perpanjangan maksimal **15 (lima belas) hari** tambahan.

---

## PASAL 11 — AUDIT

1. Masing-masing Pihak berhak melakukan audit atas data transaksi yang menjadi dasar perhitungan Commercial Fee, **maksimal 1 (satu) kali per tahun** kecuali ditemukan indikasi ketidaksesuaian material.
2. Permintaan audit harus disampaikan secara tertulis dengan waktu pemberitahuan minimal **14 (empat belas) hari kerja**.
3. Audit dilakukan pada hari dan jam kerja, dengan durasi maksimal **5 (lima) hari kerja**.
4. Biaya audit ditanggung oleh Pihak yang meminta, kecuali ditemukan selisih lebih dari **5% (lima persen)** dari total tagihan dalam periode yang diaudit, maka biaya audit ditanggung oleh Pihak yang melakukan kesalahan perhitungan.
5. Penyelesaian selisih audit:
   - a. Kelebihan pembayaran: Dikreditkan ke tagihan periode berikutnya, atau dikembalikan dalam waktu **14 (empat belas) hari kerja** jika PIHAK KEDUA meminta pengembalian langsung.
   - b. Kekurangan pembayaran: PIHAK KEDUA wajib melunasi dalam waktu **14 (empat belas) hari kerja** sejak hasil audit disepakati.

---

## PASAL 12 — KETENTUAN PERALIHAN

1. Apabila Perjanjian ini berakhir atau diakhiri:
   - a. PIHAK KEDUA tetap wajib membayar seluruh Commercial Fee atas transaksi yang telah diproses hingga tanggal efektif pengakhiran, termasuk transaksi yang paid_at-nya jatuh pada hari terakhir.
   - b. Invoice terakhir akan diterbitkan paling lambat **15 (lima belas) hari kalender** setelah tanggal efektif pengakhiran.
   - c. Pembayaran invoice terakhir mengikuti ketentuan jatuh tempo yang sama (14 hari kalender).
   - d. Kredit yang belum digunakan (dari refund atau koreksi) akan dikembalikan kepada PIHAK KEDUA bersama dengan penyelesaian akhir.

---

## PASAL 13 — KETENTUAN PENUTUP

1. Perjanjian ini merupakan lampiran dan bagian tidak terpisahkan dari Perjanjian Kerja Sama (PKS) Nomor PKS/TRANSITY/____/____.
2. Hal-hal yang tidak diatur dalam Perjanjian ini mengacu pada ketentuan dalam PKS.
3. Apabila terdapat pertentangan antara Perjanjian ini dengan PKS, maka ketentuan dalam **Perjanjian ini** yang berlaku sepanjang terkait hal-hal yang secara khusus diatur di sini.
4. Perjanjian ini dibuat dalam rangkap 2 (dua), masing-masing bermaterai cukup dan mempunyai kekuatan hukum yang sama.

---

Demikian Perjanjian ini dibuat dan ditandatangani oleh PARA PIHAK pada tanggal dan tempat tersebut di atas.

&nbsp;

| **PIHAK PERTAMA** | **PIHAK KEDUA** |
|---|---|
| PT. Dari Sini Ke Sana | ________________________________ |
| | |
| | |
| ________________________________ | ________________________________ |
| Nama: Rendyanta Maulana | Nama: |
| Jabatan: Direktur Utama | Jabatan: |
| Tanggal: | Tanggal: |

**Saksi-saksi:**

| **Saksi 1** | **Saksi 2** |
|---|---|
| | |
| ________________________________ | ________________________________ |
| Nama: | Nama: |
