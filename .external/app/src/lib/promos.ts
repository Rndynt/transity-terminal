export interface PromoItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  discount: string;
  discountLabel: string;
  code: string;
  validUntil: string;
  image: string;
  badge: string;
  routes: string;
  terms: string[];
  howToUse: string[];
}

export const PROMOS: PromoItem[] = [
  {
    id: 'promo-1',
    title: 'Flash Sale Weekend',
    subtitle: 'Diskon spesial setiap akhir pekan untuk rute Jakarta – Bandung.',
    description: 'Nikmati potongan harga 30% untuk setiap pembelian tiket rute Jakarta – Bandung yang berlaku di hari Sabtu dan Minggu. Promo berlaku untuk semua kelas dan semua operator yang tersedia di Transity.',
    discount: '30%',
    discountLabel: 'Diskon hingga',
    code: 'WEEKEND30',
    validUntil: '30 Apr 2026',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&h=500&fit=crop&q=80',
    badge: 'Flash Sale',
    routes: 'Jakarta ↔ Bandung',
    terms: [
      'Berlaku setiap hari Sabtu & Minggu',
      'Maksimal diskon Rp 50.000 per transaksi',
      'Berlaku untuk semua kelas dan operator',
      'Tidak dapat digabung dengan promo lainnya',
      'Berlaku hingga 30 April 2026',
    ],
    howToUse: [
      'Pilih rute Jakarta – Bandung atau sebaliknya',
      'Pilih tanggal keberangkatan di hari Sabtu atau Minggu',
      'Masukkan kode promo WEEKEND30 di halaman pembayaran',
      'Diskon akan otomatis terpotong dari total harga',
    ],
  },
  {
    id: 'promo-2',
    title: 'Hemat Perjalanan Jauh',
    subtitle: 'Potongan Rp 50.000 untuk semua rute antar provinsi.',
    description: 'Dapatkan potongan langsung Rp 50.000 untuk setiap pembelian tiket rute antar provinsi. Makin jauh perjalananmu, makin besar hematnya! Berlaku untuk semua operator dan kelas.',
    discount: 'Rp50rb',
    discountLabel: 'Potongan langsung',
    code: 'JAUH50K',
    validUntil: '15 Mei 2026',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=500&fit=crop&q=80',
    badge: 'Best Deal',
    routes: 'Semua rute antar provinsi',
    terms: [
      'Berlaku untuk rute antar provinsi saja',
      'Minimal pembelian Rp 100.000',
      'Berlaku 1x per akun per hari',
      'Tidak dapat digabung dengan promo lainnya',
      'Berlaku hingga 15 Mei 2026',
    ],
    howToUse: [
      'Pilih rute perjalanan antar provinsi',
      'Pilih tanggal dan jumlah penumpang',
      'Masukkan kode promo JAUH50K di halaman pembayaran',
      'Potongan Rp 50.000 langsung teraplikasi',
    ],
  },
  {
    id: 'promo-3',
    title: 'Promo Pengguna Baru',
    subtitle: 'Diskon Rp 25.000 untuk perjalanan pertamamu.',
    description: 'Khusus pengguna baru Transity! Daftar akun dan langsung dapatkan potongan Rp 25.000 untuk perjalanan pertamamu. Berlaku untuk semua rute dan semua operator.',
    discount: 'Rp25rb',
    discountLabel: 'Diskon untuk kamu',
    code: 'NEWUSER',
    validUntil: '31 Mei 2026',
    image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&h=500&fit=crop&q=80',
    badge: 'New User',
    routes: 'Semua rute',
    terms: [
      'Khusus pengguna baru yang baru mendaftar',
      'Berlaku untuk pembelian tiket pertama',
      'Berlaku untuk semua rute dan operator',
      'Hanya bisa digunakan 1x per akun',
      'Berlaku hingga 31 Mei 2026',
    ],
    howToUse: [
      'Daftar akun baru di Transity',
      'Pilih rute dan jadwal perjalanan',
      'Masukkan kode promo NEWUSER di halaman pembayaran',
      'Diskon Rp 25.000 otomatis terpotong',
    ],
  },
  {
    id: 'promo-4',
    title: 'Mudik Lebih Hemat',
    subtitle: 'Diskon 20% untuk semua rute, khusus bulan ini.',
    description: 'Rayakan momen spesial dengan diskon 20% untuk semua rute dan semua operator di Transity. Pesan sekarang dan hemat lebih banyak untuk perjalananmu bersama keluarga!',
    discount: '20%',
    discountLabel: 'Diskon hingga',
    code: 'HEMAT20',
    validUntil: '20 Mei 2026',
    image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&h=500&fit=crop&q=80',
    badge: 'Spesial',
    routes: 'Semua rute',
    terms: [
      'Berlaku untuk semua rute dan operator',
      'Maksimal diskon Rp 75.000 per transaksi',
      'Berlaku 2x per akun selama periode promo',
      'Tidak dapat digabung dengan promo lainnya',
      'Berlaku hingga 20 Mei 2026',
    ],
    howToUse: [
      'Pilih rute dan jadwal perjalanan',
      'Masukkan kode promo HEMAT20 di halaman pembayaran',
      'Diskon 20% langsung terpotong (maks. Rp 75.000)',
      'Selesaikan pembayaran seperti biasa',
    ],
  },
];
