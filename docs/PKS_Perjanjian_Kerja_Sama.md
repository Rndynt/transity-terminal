# PERJANJIAN KERJA SAMA (PKS)
## PENGGUNAAN SISTEM MANAJEMEN TRANSPORTASI TRANSITY

---

**Nomor: PKS/TRANSITY/____/____**

Pada hari ini, tanggal __________, bertempat di __________, telah ditandatangani Perjanjian Kerja Sama (selanjutnya disebut **"Perjanjian"**) oleh dan antara:

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

PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut **"PARA PIHAK"** dan masing-masing disebut **"PIHAK"**.

---

## PASAL 1 — LATAR BELAKANG

1. PIHAK PERTAMA adalah perusahaan penyedia layanan sistem manajemen transportasi berbasis teknologi dengan nama dagang **"Transity"**, yang menyediakan fitur pengelolaan reservasi, penjadwalan trip, manajemen kursi, kargo, pembayaran, pelaporan, dan fitur operasional lainnya.
2. PIHAK KEDUA adalah perusahaan yang bergerak di bidang transportasi darat (bus/travel) yang membutuhkan sistem pengelolaan operasional secara digital.
3. PARA PIHAK sepakat untuk bekerja sama dalam penggunaan Sistem Transity dengan ketentuan dan syarat-syarat yang diatur dalam Perjanjian ini.

---

## PASAL 2 — RUANG LINGKUP KERJA SAMA

### 2.1 Objek Kerja Sama
PIHAK PERTAMA menyediakan akses penuh terhadap Sistem Transity kepada PIHAK KEDUA dalam model **Software as a Service (SaaS)**, yang mencakup namun tidak terbatas pada:
   - a. Terminal Reservasi (CSO) dengan peta kursi real-time
   - b. Penjadwalan Trip dan Manajemen Rute
   - c. Manajemen Kursi dan Inventori Tempat Duduk
   - d. Pengelolaan Kargo dan Pengiriman Barang
   - e. Aturan Harga dan Promosi
   - f. Surat Perintah Jalan (SPJ) dan Manifest
   - g. Laporan Keuangan dan Operasional
   - h. Manajemen Pengguna dan Hak Akses (RBAC)
   - i. Fitur-fitur tambahan yang dikembangkan selama masa perjanjian

### 2.2 Kewajiban PIHAK PERTAMA
PIHAK PERTAMA bertanggung jawab atas:
   - a. Penyediaan, pemeliharaan, dan pengembangan Sistem Transity
   - b. Ketersediaan server dan infrastruktur teknologi sesuai SLA (Pasal 5)
   - c. Dukungan teknis dan pelatihan penggunaan sistem (Pasal 8)
   - d. Keamanan data dan backup berkala (Pasal 10)
   - e. Pembaruan (update) dan perbaikan bug secara berkala

### 2.3 Kewajiban PIHAK KEDUA
PIHAK KEDUA bertanggung jawab atas:
   - a. Keakuratan data yang diinput ke dalam sistem
   - b. Pengelolaan akun pengguna internal
   - c. Pembayaran Commercial Fee sesuai ketentuan di Pasal 4
   - d. Menjaga kerahasiaan akses dan akun sistem
   - e. Tidak menduplikasi, merekayasa balik (reverse engineer), atau mendistribusikan Sistem Transity

---

## PASAL 3 — MODEL BISNIS

1. PIHAK KEDUA mendapatkan akses penuh terhadap Sistem Transity **tanpa biaya berlangganan bulanan tetap (subscription fee)** dan **tanpa biaya setup/implementasi (onboarding fee)**.
2. Sebagai kompensasi, PIHAK KEDUA dikenakan **Commercial Fee** sebagaimana diatur dalam Pasal 4 dan Perjanjian Commercial Fee yang merupakan bagian tidak terpisahkan dari Perjanjian ini.
3. Model ini dirancang agar biaya operasional PIHAK KEDUA berbanding lurus dengan pendapatan, sehingga bersifat **win-win** bagi kedua belah pihak.

---

## PASAL 4 — COMMERCIAL FEE

1. PIHAK KEDUA dikenakan **Commercial Fee** dari setiap nilai transaksi yang berhasil diproses melalui Sistem Transity, dengan ketentuan sebagai berikut:

| Volume Transaksi Bulanan (Gross) | Tarif Commercial Fee |
|---|---|
| Hingga Rp 200.000.000 | 3,0% |
| Rp 200.000.001 — Rp 500.000.000 | 2,75% |
| Rp 500.000.001 — Rp 1.000.000.000 | 2,5% |
| Di atas Rp 1.000.000.000 | 2,25% |

2. Definisi **"Transaksi"** meliputi:
   - a. Penjualan tiket penumpang (booking dengan status **paid**)
   - b. Pengiriman kargo (shipment dengan status **paid**)
3. Tarif progresif ini berlaku secara keseluruhan (bukan per tier) berdasarkan total volume transaksi dalam satu bulan kalender.
4. Ketentuan detail mengenai mekanisme perhitungan, penagihan, dan pembayaran Commercial Fee diatur dalam dokumen **Perjanjian Commercial Fee** terpisah.

---

## PASAL 5 — SERVICE LEVEL AGREEMENT (SLA)

### 5.1 Ketersediaan Sistem (Uptime)
1. PIHAK PERTAMA menjamin ketersediaan Sistem Transity minimal **99,5% (sembilan puluh sembilan koma lima persen)** per bulan kalender, dihitung di luar waktu maintenance terjadwal.
2. Perhitungan uptime: `Uptime% = ((Total Menit dalam Sebulan - Menit Downtime Non-Terjadwal) / Total Menit dalam Sebulan) × 100%`

### 5.2 Waktu Respon Dukungan Teknis

| Kategori Masalah | Deskripsi | Waktu Respon | Target Penyelesaian |
|---|---|---|---|
| **Kritis** | Sistem tidak dapat diakses sama sekali, transaksi tidak bisa diproses | ≤ 1 jam | ≤ 4 jam |
| **Tinggi** | Fitur utama tidak berfungsi (reservasi, pembayaran), tetapi sistem masih bisa diakses | ≤ 2 jam | ≤ 8 jam |
| **Sedang** | Fitur pendukung tidak berfungsi (laporan, cetak manifest) | ≤ 4 jam | ≤ 24 jam |
| **Rendah** | Pertanyaan umum, permintaan informasi, saran fitur | ≤ 1 hari kerja | ≤ 3 hari kerja |

### 5.3 Penalti Downtime
1. Apabila uptime bulanan di bawah 99,5%, PIHAK PERTAMA memberikan kompensasi berupa **kredit Commercial Fee** sebagai berikut:

| Uptime Bulanan | Kredit Commercial Fee |
|---|---|
| 99,0% — 99,4% | 5% dari Commercial Fee bulan tersebut |
| 98,0% — 98,9% | 10% dari Commercial Fee bulan tersebut |
| 95,0% — 97,9% | 25% dari Commercial Fee bulan tersebut |
| Di bawah 95,0% | 50% dari Commercial Fee bulan tersebut |

2. Kredit akan diperhitungkan pada invoice periode berikutnya.
3. Penalti ini tidak berlaku apabila downtime disebabkan oleh Force Majeure (Pasal 12) atau tindakan/kelalaian PIHAK KEDUA.

### 5.4 Maintenance Terjadwal
1. PIHAK PERTAMA berhak melakukan maintenance terjadwal di luar jam operasional puncak (direkomendasikan pukul 00:00–05:00 WIB).
2. Pemberitahuan maintenance terjadwal diberikan minimal **24 (dua puluh empat) jam** sebelumnya melalui email dan/atau notifikasi sistem.
3. Maintenance terjadwal tidak dihitung sebagai downtime dalam perhitungan SLA.

---

## PASAL 6 — JANGKA WAKTU PERJANJIAN

1. Perjanjian ini berlaku selama **2 (dua) tahun** terhitung sejak tanggal penandatanganan.
2. Perjanjian ini akan diperpanjang secara otomatis untuk periode **1 (satu) tahun** berikutnya, kecuali salah satu Pihak memberikan pemberitahuan tertulis untuk mengakhiri perjanjian selambat-lambatnya **60 (enam puluh) hari kalender** sebelum masa berlaku berakhir.
3. Peninjauan ulang terhadap ketentuan Perjanjian, termasuk tarif Commercial Fee, dapat dilakukan setiap **12 (dua belas) bulan** berdasarkan kesepakatan PARA PIHAK.

---

## PASAL 7 — HAK DAN KEWAJIBAN PIHAK PERTAMA

### Hak PIHAK PERTAMA:
1. Menerima pembayaran Commercial Fee sesuai ketentuan Pasal 4.
2. Melakukan pembaruan, perbaikan, dan pengembangan Sistem Transity.
3. Menangguhkan akses sistem apabila PIHAK KEDUA menunggak pembayaran lebih dari 30 hari kalender, dengan pemberitahuan tertulis 7 hari sebelumnya.
4. Menggunakan data agregat dan anonim (tanpa identitas individu penumpang atau data bisnis spesifik Operator) untuk keperluan peningkatan layanan dan pengembangan produk.

### Kewajiban PIHAK PERTAMA:
1. Menyediakan sistem yang berfungsi dengan baik dan aman sesuai SLA.
2. Memberikan dukungan teknis sesuai ketentuan Pasal 5 dan Pasal 8.
3. Melakukan backup data secara berkala (minimal harian) dengan retensi minimal 30 hari.
4. Memberikan notifikasi sebelum maintenance terjadwal sesuai Pasal 5.4.
5. Menjaga kerahasiaan data PIHAK KEDUA sesuai Pasal 10.

---

## PASAL 8 — HAK DAN KEWAJIBAN PIHAK KEDUA

### Hak PIHAK KEDUA:
1. Menggunakan seluruh fitur Sistem Transity tanpa batasan pengguna.
2. Mendapatkan dukungan teknis dan pelatihan sesuai ketentuan.
3. Mendapatkan laporan penggunaan dan rekap Commercial Fee secara berkala.
4. Mengajukan permintaan fitur atau penyesuaian sistem.
5. Mendapatkan ekspor data milik PIHAK KEDUA kapan saja selama Perjanjian berlaku.

### Kewajiban PIHAK KEDUA:
1. Membayar Commercial Fee tepat waktu sesuai ketentuan.
2. Menggunakan sistem sesuai dengan peruntukannya dan tidak melakukan tindakan yang merugikan sistem atau pengguna lain.
3. Tidak menduplikasi, merekayasa balik (reverse engineer), atau mendistribusikan Sistem Transity.
4. Menjaga kerahasiaan akun dan credential akses.
5. Memberitahukan PIHAK PERTAMA apabila terjadi potensi pelanggaran keamanan atau akses tidak sah.

---

## PASAL 9 — IMPLEMENTASI, PELATIHAN, DAN SKALABILITAS

### 9.1 Implementasi
1. PIHAK PERTAMA akan melakukan onboarding dan konfigurasi awal Sistem Transity untuk PIHAK KEDUA **tanpa biaya tambahan**, meliputi:
   - a. Pengaturan rute, jadwal, outlet, dan armada
   - b. Konfigurasi harga dan aturan promosi
   - c. Pembuatan akun pengguna awal
   - d. Migrasi data awal (jika diperlukan dan memungkinkan secara teknis)
2. Proses implementasi ditargetkan selesai dalam waktu **14 (empat belas) hari kerja** sejak Perjanjian ditandatangani.

### 9.2 Pelatihan
1. PIHAK PERTAMA memberikan pelatihan penggunaan sistem secara **daring (online)** kepada staf PIHAK KEDUA **tanpa biaya tambahan**, meliputi:
   - a. Pelatihan awal untuk seluruh modul (maksimal 2 sesi @ 2 jam)
   - b. Dokumentasi pengguna dan panduan operasional
   - c. Video tutorial yang dapat diakses kapan saja
2. Pelatihan **di lokasi (on-site)** dapat disediakan dengan biaya tambahan berdasarkan kesepakatan terpisah.
3. PIHAK PERTAMA menyediakan kanal dukungan melalui:
   - a. Email support
   - b. WhatsApp / Telegram grup support
   - c. Sistem tiket helpdesk (jika tersedia)

### 9.3 Skalabilitas
1. PIHAK KEDUA dapat menambah jumlah pengguna (user), outlet, rute, dan armada **tanpa biaya tambahan** selama Perjanjian berlaku.
2. Apabila kebutuhan PIHAK KEDUA memerlukan pengembangan fitur kustom yang signifikan, PARA PIHAK akan membahas biaya dan timeline secara terpisah melalui **Addendum** atau **Perjanjian Tambahan**.
3. PIHAK PERTAMA menjamin bahwa infrastruktur sistem mampu mengakomodasi pertumbuhan bisnis PIHAK KEDUA secara wajar tanpa penurunan performa.

---

## PASAL 10 — KERAHASIAAN DAN PERLINDUNGAN DATA

### 10.1 Kerahasiaan Umum
1. Masing-masing Pihak wajib menjaga kerahasiaan seluruh informasi yang diperoleh dari Pihak lainnya sehubungan dengan pelaksanaan Perjanjian ini (**"Informasi Rahasia"**).
2. Informasi Rahasia meliputi namun tidak terbatas pada: data bisnis, data operasional, data keuangan, informasi teknis, dan seluruh informasi yang secara wajar dianggap bersifat rahasia.
3. Informasi Rahasia tidak mencakup informasi yang: (a) telah diketahui publik bukan karena pelanggaran Perjanjian ini, (b) diperoleh secara sah dari pihak ketiga, atau (c) diwajibkan diungkapkan oleh hukum atau perintah pengadilan.

### 10.2 Perlindungan Data Pribadi
1. PIHAK PERTAMA wajib menjaga kerahasiaan dan keamanan data penumpang, data transaksi, dan data operasional PIHAK KEDUA sesuai dengan peraturan perundang-undangan yang berlaku, termasuk:
   - a. Undang-Undang Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)
   - b. Undang-Undang Nomor 11 Tahun 2008 jo. UU No. 19 Tahun 2016 tentang Informasi dan Transaksi Elektronik (UU ITE)
2. PIHAK PERTAMA bertindak sebagai **Prosesor Data** yang memproses data pribadi atas instruksi PIHAK KEDUA selaku **Pengendali Data**.

### 10.3 Kepemilikan Data (Data Ownership)
1. Data yang tersimpan dalam Sistem Transity yang berasal dari PIHAK KEDUA merupakan **milik PIHAK KEDUA**.
2. PIHAK PERTAMA tidak akan menggunakan data PIHAK KEDUA untuk kepentingan pihak ketiga atau keperluan komersial lainnya tanpa persetujuan tertulis.
3. PIHAK KEDUA berhak mengekspor seluruh datanya kapan saja dalam format standar (CSV/Excel/JSON).

### 10.4 Keamanan Data
1. PIHAK PERTAMA menerapkan standar keamanan yang meliputi:
   - a. Enkripsi data saat transit (TLS/SSL) dan saat disimpan (at-rest encryption)
   - b. Backup harian dengan retensi minimal 30 hari
   - c. Kontrol akses berbasis peran (RBAC) pada tingkat sistem
   - d. Log audit untuk akses dan perubahan data kritis
2. Apabila terjadi **insiden keamanan data** (data breach), PIHAK PERTAMA wajib:
   - a. Memberitahukan PIHAK KEDUA dalam waktu **1 × 24 jam** sejak insiden terdeteksi
   - b. Mengambil langkah-langkah mitigasi segera
   - c. Menyediakan laporan insiden lengkap dalam waktu **7 (tujuh) hari kerja**
   - d. Bekerja sama dengan PIHAK KEDUA dalam pelaporan kepada otoritas terkait (jika diwajibkan oleh UU PDP)

### 10.5 Durasi Kerahasiaan
Kewajiban kerahasiaan ini tetap berlaku selama **3 (tiga) tahun** setelah Perjanjian berakhir.

---

## PASAL 11 — HAK KEKAYAAN INTELEKTUAL (HAKI)

1. Seluruh hak kekayaan intelektual atas Sistem Transity, termasuk namun tidak terbatas pada kode sumber, desain, arsitektur, dokumentasi, logo, dan nama dagang, adalah dan tetap menjadi milik **PIHAK PERTAMA**.
2. Perjanjian ini tidak memberikan hak kepemilikan atas Sistem Transity kepada PIHAK KEDUA. PIHAK KEDUA hanya mendapatkan **hak penggunaan (lisensi non-eksklusif)** selama Perjanjian berlaku.
3. PIHAK KEDUA dilarang:
   - a. Menduplikasi, menyalin, atau mereproduksi Sistem Transity
   - b. Melakukan rekayasa balik (reverse engineering), dekompilasi, atau disassembly
   - c. Mendistribusikan, menjual kembali, atau menyewakan akses ke Sistem Transity kepada pihak ketiga
   - d. Menghilangkan atau mengubah tanda hak cipta, merek dagang, atau atribusi lain
4. Saran, masukan, atau permintaan fitur dari PIHAK KEDUA yang diimplementasikan ke dalam Sistem Transity menjadi bagian dari hak kekayaan intelektual PIHAK PERTAMA, kecuali disepakati lain secara tertulis.

---

## PASAL 12 — FORCE MAJEURE

1. Tidak ada Pihak yang bertanggung jawab atas kegagalan atau keterlambatan pelaksanaan kewajiban yang disebabkan oleh keadaan di luar kendali wajar (**"Force Majeure"**), termasuk namun tidak terbatas pada:
   - a. Bencana alam (gempa bumi, banjir, tanah longsor, letusan gunung berapi)
   - b. Perang, terorisme, huru-hara, atau kerusuhan sipil
   - c. Pandemi atau epidemi yang ditetapkan oleh otoritas berwenang
   - d. Kebijakan atau regulasi pemerintah yang secara langsung menghalangi pelaksanaan Perjanjian
   - e. Gangguan internet atau telekomunikasi massal di luar kendali PIHAK PERTAMA
   - f. Kegagalan pihak ketiga (cloud/hosting provider) yang bersifat massal dan bukan akibat kelalaian PIHAK PERTAMA
   - g. Serangan siber masif (DDoS skala besar, ransomware) yang melampaui langkah pengamanan wajar
2. Pihak yang mengalami Force Majeure wajib memberitahukan secara tertulis kepada Pihak lainnya dalam waktu **7 (tujuh) hari kalender** sejak terjadinya Force Majeure, disertai bukti pendukung.
3. Selama Force Majeure berlangsung, kewajiban yang terdampak ditangguhkan tanpa dikenakan penalti.
4. Apabila Force Majeure berlangsung lebih dari **90 (sembilan puluh) hari** secara terus-menerus, masing-masing Pihak berhak mengakhiri Perjanjian ini tanpa kewajiban ganti rugi, dengan ketentuan PIHAK KEDUA tetap wajib membayar Commercial Fee atas transaksi yang telah diproses sebelum Force Majeure.

---

## PASAL 13 — PEMBATASAN TANGGUNG JAWAB (LIMITATION OF LIABILITY)

1. **Batas maksimal ganti rugi**: Tanggung jawab kumulatif PIHAK PERTAMA atas seluruh klaim yang timbul dari atau sehubungan dengan Perjanjian ini tidak akan melebihi **jumlah total Commercial Fee yang telah dibayarkan oleh PIHAK KEDUA dalam 12 (dua belas) bulan terakhir** sebelum klaim timbul.

2. **Pengecualian kerugian tidak langsung**: Tidak ada Pihak yang bertanggung jawab atas kerugian tidak langsung (indirect), insidental, konsekuensial, khusus, atau punitif, termasuk namun tidak terbatas pada:
   - a. Kehilangan keuntungan atau pendapatan yang diharapkan
   - b. Kehilangan pelanggan atau peluang bisnis
   - c. Kehilangan data (sepanjang PIHAK PERTAMA telah menjalankan kewajiban backup sesuai Pasal 10)
   - d. Kerugian reputasi

3. **Pengecualian pembatasan**: Pembatasan tanggung jawab ini TIDAK berlaku untuk:
   - a. Pelanggaran kewajiban kerahasiaan dan perlindungan data (Pasal 10) yang disebabkan oleh kelalaian berat atau kesengajaan
   - b. Pelanggaran hak kekayaan intelektual (Pasal 11)
   - c. Kewajiban pembayaran Commercial Fee oleh PIHAK KEDUA

4. Masing-masing Pihak wajib mengambil langkah-langkah wajar untuk **memitigasi** kerugian yang timbul.

---

## PASAL 14 — PENYELESAIAN PERSELISIHAN

1. Setiap perselisihan yang timbul sehubungan dengan Perjanjian ini akan diselesaikan secara **musyawarah** untuk mencapai mufakat.
2. Apabila musyawarah tidak menghasilkan kesepakatan dalam waktu **30 (tiga puluh) hari kalender**, maka PARA PIHAK sepakat untuk menempuh **mediasi** yang difasilitasi oleh mediator independen yang disepakati bersama.
3. Apabila mediasi tidak berhasil dalam waktu **30 (tiga puluh) hari kalender**, PARA PIHAK sepakat untuk menyelesaikan perselisihan melalui **Badan Arbitrase Nasional Indonesia (BANI)** yang putusannya bersifat **final dan mengikat**.
4. Selama proses penyelesaian perselisihan berlangsung, PARA PIHAK tetap melaksanakan kewajiban masing-masing berdasarkan Perjanjian ini, kecuali kewajiban yang menjadi pokok perselisihan.

---

## PASAL 15 — PENGAKHIRAN PERJANJIAN

### 15.1 Pengakhiran oleh Kesepakatan
Perjanjian ini dapat diakhiri sewaktu-waktu berdasarkan kesepakatan tertulis PARA PIHAK.

### 15.2 Pengakhiran oleh Salah Satu Pihak
1. Masing-masing Pihak dapat mengakhiri Perjanjian ini dengan pemberitahuan tertulis **60 (enam puluh) hari kalender** sebelumnya.
2. Pemberitahuan pengakhiran dikirimkan melalui email resmi dan/atau surat tercatat.

### 15.3 Pengakhiran Sepihak oleh PIHAK PERTAMA
PIHAK PERTAMA berhak mengakhiri Perjanjian secara sepihak apabila PIHAK KEDUA:
   - a. Menunggak pembayaran Commercial Fee lebih dari **60 (enam puluh) hari kalender** setelah somasi tertulis.
   - b. Melakukan pelanggaran material terhadap ketentuan Perjanjian ini yang tidak diperbaiki dalam waktu **30 (tiga puluh) hari** setelah pemberitahuan tertulis.
   - c. Melakukan tindakan ilegal menggunakan Sistem Transity.
   - d. Dinyatakan pailit atau dalam proses likuidasi.

### 15.4 Pengakhiran Sepihak oleh PIHAK KEDUA
PIHAK KEDUA berhak mengakhiri Perjanjian secara sepihak apabila PIHAK PERTAMA:
   - a. Gagal memenuhi SLA (uptime di bawah 95%) selama **3 (tiga) bulan berturut-turut**.
   - b. Melakukan pelanggaran material terhadap kewajiban kerahasiaan dan perlindungan data yang tidak diperbaiki dalam waktu **30 (tiga puluh) hari** setelah pemberitahuan tertulis.

### 15.5 Akibat Pengakhiran
Dalam hal pengakhiran Perjanjian:
   - a. PIHAK KEDUA wajib menyelesaikan seluruh kewajiban Commercial Fee yang tertunggak dalam waktu **14 (empat belas) hari** sejak pengakhiran efektif.
   - b. PIHAK PERTAMA wajib memberikan akses untuk mengekspor seluruh data PIHAK KEDUA dalam format yang dapat digunakan (CSV/Excel/JSON) selama **30 (tiga puluh) hari** setelah pengakhiran efektif.
   - c. Data PIHAK KEDUA akan dihapus dari server PIHAK PERTAMA dalam waktu **60 (enam puluh) hari** setelah pengakhiran dan setelah seluruh data berhasil diekspor, kecuali diwajibkan lain oleh peraturan perundang-undangan.
   - d. Lisensi penggunaan Sistem Transity otomatis berakhir.

---

## PASAL 16 — EXIT STRATEGY DAN MIGRASI DATA

1. Untuk memastikan kelangsungan bisnis PIHAK KEDUA, PIHAK PERTAMA menjamin proses **exit yang terstruktur** apabila Perjanjian berakhir:
   - a. **Periode transisi**: PIHAK KEDUA mendapatkan akses read-only ke Sistem Transity selama **30 (tiga puluh) hari** setelah pengakhiran efektif untuk keperluan ekspor data dan transisi operasional.
   - b. **Ekspor data**: PIHAK PERTAMA menyediakan seluruh data PIHAK KEDUA dalam format standar (CSV, Excel, atau JSON), meliputi: data penumpang, data booking, data kargo, data keuangan, data rute dan jadwal.
   - c. **Pendampingan migrasi**: PIHAK PERTAMA bersedia memberikan dukungan teknis wajar (maksimal 2 sesi konsultasi) untuk membantu PIHAK KEDUA dalam proses migrasi data ke sistem pengganti.
2. Biaya ekspor data standar **tidak dikenakan biaya tambahan**. Permintaan ekspor dalam format kustom atau bantuan migrasi intensif dapat dikenakan biaya berdasarkan kesepakatan terpisah.

---

## PASAL 17 — KETENTUAN LAIN-LAIN

1. **Keseluruhan Perjanjian**: Perjanjian ini beserta seluruh lampiran merupakan keseluruhan kesepakatan PARA PIHAK dan menggantikan seluruh perjanjian, kesepahaman, atau korespondensi sebelumnya terkait hal-hal yang diatur di sini.
2. **Perubahan (Amandemen)**: Perubahan atas Perjanjian ini hanya berlaku apabila dibuat secara tertulis dan ditandatangani oleh PARA PIHAK.
3. **Keterpisahan (Severability)**: Apabila satu atau lebih ketentuan dalam Perjanjian ini dinyatakan tidak sah atau tidak dapat dilaksanakan oleh pengadilan atau badan arbitrase yang berwenang, maka ketentuan lainnya tetap berlaku secara penuh.
4. **Pengalihan (Assignment)**: Tidak ada Pihak yang dapat mengalihkan hak atau kewajibannya berdasarkan Perjanjian ini tanpa persetujuan tertulis dari Pihak lainnya, kecuali dalam hal merger, akuisisi, atau reorganisasi perusahaan.
5. **Bahasa**: Perjanjian ini dibuat dalam bahasa Indonesia. Apabila di kemudian hari diperlukan versi terjemahan, versi bahasa Indonesia yang berlaku.
6. **Hukum yang Berlaku**: Perjanjian ini tunduk pada dan ditafsirkan berdasarkan hukum Negara Republik Indonesia.

---

## PASAL 18 — LAMPIRAN

Dokumen-dokumen berikut merupakan bagian tidak terpisahkan dari Perjanjian ini:
1. Lampiran 1: Perjanjian Commercial Fee
2. Lampiran 2: Daftar Fitur Sistem Transity
3. Lampiran 3: Formulir Berita Acara Serah Terima (BAST) Implementasi

---

Demikian Perjanjian ini dibuat dalam rangkap 2 (dua), masing-masing bermaterai cukup dan mempunyai kekuatan hukum yang sama.

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
