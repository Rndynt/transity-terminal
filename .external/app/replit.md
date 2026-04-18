# TransityApp (transityweb)

Aplikasi web B2C untuk pelanggan Transity — memungkinkan pengguna mencari jadwal, memilih kursi, dan memesan tiket bus. Merupakan bagian dari ekosistem Transity yang terdiri dari tiga komponen: **TransityApp** (aplikasi ini), **TransityConsole** (gateway & admin), dan **TransityTerminal** (backend per-operator).

## Stack

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend/Server**: Fastify (proxy semua API ke TransityConsole gateway)
- **Language**: TypeScript (ESM)

## Struktur

```
src/           # Frontend React (pages, components, lib)
server/        # Fastify server (proxy ke Console + serve Vite dev)
public/        # Static assets
```

## Arsitektur Ekosistem

```
TransityApp (ini)
     │
     └─ /api/* ──▶ TransityConsole (CONSOLE_URL)
                       └─ /api/gateway/* (auth, trips, seatmap, bookings, operators)
```

Semua API request diarahkan ke Console Gateway. Auth terpusat di Console — satu akun berlaku untuk semua operator.

## Environment Variables

| Variable | Default | Keterangan |
|---|---|---|
| `PORT` | `5000` | Port server |
| `CONSOLE_URL` | _(kosong)_ | TransityConsole gateway — semua API lewat sini |
| `API_UPSTREAM` | `https://nusa-terminal.transity.web.id` | Fallback jika CONSOLE_URL kosong |
| `NODE_ENV` | `development` | Mode aplikasi |

## Scripts

- `npm run dev` — Jalankan server development (tsx + vite)
- `npm run build` — Build frontend (vite) + server (tsc)
- `npm start` — Jalankan production build

## Fitur

### Onboarding
- Halaman onboarding 3 slide untuk pengguna baru (swipeable)
- Disimpan di `localStorage` (`t_onboarding_done`) — hanya muncul sekali
- File: `src/pages/OnboardingPage.tsx`

### Authentication (Console Gateway)
- Login dengan email ATAU nomor telepon (`POST /api/gateway/auth/login`)
- Registrasi customer baru (`POST /api/gateway/auth/register`) — semua field wajib (fullName, email, phone, password)
- Get profil (`GET /api/gateway/auth/me`)
- Update profil — nama dan/atau telepon (`PUT /api/gateway/auth/profile`)
- Ubah password (`POST /api/gateway/auth/change-password`)
- JWT token berlaku 30 hari, disimpan di localStorage

### Trip Search & Booking Flow
1. HomePage → pilih kota, tanggal (riwayat kota terakhir tersimpan di localStorage)
2. SearchResultsPage → daftar jadwal dari semua operator + **date strip 7 hari** untuk ganti tanggal langsung
3. SelectStopsPage → pilih titik naik/turun (filter pakai `boardingAllowed`/`alightingAllowed`), timeline UI, tombol "Lanjut Pilih Titik Turun" setelah pickup
4. **Materialize** — trip virtual di-materialize lewat `POST /api/gateway/trips/materialize`
5. SelectSeatsPage → pilih kursi dari seatmap + isi data penumpang (nama & HP) langsung di halaman ini → klik "Lanjut Bayar" → **bottom sheet konfirmasi** → booking dibuat (`POST /api/gateway/bookings`) → status `held` → langsung ke PaymentPage
6. PaymentPage → countdown timer `holdExpiresAt`, pilih metode bayar, voucher → "Bayar" → `POST /api/gateway/bookings/{id}/pay`
7. BookingDetailPage → detail pesanan setelah berhasil dibayar

### Booking & Payment Flow (Hold-first)
- **Booking dibuat di SelectSeatsPage** (bukan halaman terpisah) — kursi di-hold + data penumpang diisi di halaman yang sama
- SelectSeatsPage: bottom sheet konfirmasi "Lanjut Pesan" → create booking → navigasi ke PaymentPage dengan `bookingId` + `holdExpiresAt`
- BookingConfirmPage masih ada sebagai fallback (auth redirect) tapi flow utama tidak melewatinya
- PaymentPage **hanya menangani pembayaran** (booking sudah ada)
- Jika user klik back di PaymentPage → **bottom sheet konfirmasi keluar** ("Keluar" / "Lanjut Transaksi")
- Jika keluar → diarahkan ke "Pesanan Saya" (booking unpaid tetap muncul)
- Countdown timer dari `holdExpiresAt`, tombol bayar disabled jika waktu habis
- Pesanan `held` muncul di "Pesanan Saya" (MyTripsPage) dengan countdown timer
- BookingDetailPage: tombol "Bayar Sekarang" untuk resume payment pesanan held
- Status detection menggunakan multi-signal `hasPaid`: cek `paymentMethod`, `payments[].paidAt`, `paymentIntent.status`, dan `qrData` — bukan hanya `holdExpiresAt`
- Normalizer (`normalizeBookingDetail` & `normalizeBookingListItem`) mengekstrak `paymentMethod` dari field alternatif API (`payment_method`, `payments[0].method` jika paid)
- Metode pembayaran diambil dari `GET /api/gateway/payments/methods` — data dinormalisasi (type mapping + default enabled)
- Input voucher/promo dengan validasi via `POST /api/gateway/vouchers/validate`
- Console API requirements didokumentasikan di `docs/console-api-requirements.md`

### Komponen Baru
- `ConfirmSheet` — bottom sheet konfirmasi reusable (title, description, icon, confirm/cancel, loading, error, variant default/warning)

### Profile
- Info akun (nama, email, HP, tanggal bergabung)
- Edit profil (nama & no HP) via bottom sheet
- Ubah password via bottom sheet
- Menu navigasi ke help/notif/about
- Logout dengan konfirmasi

### PWA (Progressive Web App)
- Manifest di `public/manifest.json` — `display: standalone`, orientation portrait
- Service worker di `public/sw.js` — network-first, offline fallback untuk cached assets
- Ikon: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `icon.svg` di `/public`
- Zoom dinonaktifkan via viewport meta (`user-scalable=no`) + CSS `touch-action: manipulation`
- Bisa di-install ke homescreen (Android & iOS)
- Service worker hanya aktif di production (`import.meta.env.PROD`)

### Halaman Tambahan
- **HelpPage** — FAQ accordion dengan search
- **NotificationsPage** — Daftar notifikasi (placeholder)
- **AboutPage** — Info versi app

### Komponen Penting
- `PageHeader` — header halaman reusable (title, subtitle, back button, rightContent, children, sticky, className). Digunakan di semua halaman.
- `OperatorBottomSheet` — filter operator (reusable, searchable)
- `OperatorLogo` — logo operator dengan fallback initial+color
- `CityBottomSheet` — pilih kota (tanpa auto-focus keyboard)

### Promo Berlangsung (HomePage)
- Section promo dengan horizontal scroll cards di bawah search form
- Data promo sementara dummy (di `src/lib/promos.ts`) — nanti akan diganti dengan data dari Console API
- Card menampilkan: foto background, badge, countdown, judul, subtitle, diskon, kode promo
- Warna konsisten menggunakan brand palette (teal/emerald)
- Tap card → navigasi ke PromoDetailPage
- "Lihat semua" → navigasi ke PromoListPage
- Dot indicator mengikuti scroll position
- File: `src/components/PromoSection.tsx`, `src/lib/promos.ts`

### Promo Detail & List Pages
- **PromoDetailPage** (`src/pages/PromoDetailPage.tsx`) — detail promo lengkap: hero image, diskon, countdown, kode promo (salin), deskripsi, cara menggunakan, syarat & ketentuan, sticky bottom CTA
- **PromoListPage** (`src/pages/PromoListPage.tsx`) — daftar semua promo dengan card vertikal
- Bottom nav disembunyikan di kedua halaman

### Upcoming Trips (HomePage)
- Menampilkan max 3 perjalanan terdekat (status `confirmed` atau `held`, `serviceDate >= today`)
- Hanya tampil jika user sudah login dan punya booking aktif
- Card menampilkan: rute (origin → destination), tanggal relatif (Hari ini/Besok/Rab, 15 Apr), jam berangkat, nama operator
- Booking `held` menampilkan badge "Bayar" dan icon jam kuning
- Tap card → navigasi ke BookingDetailPage
- Data dari `bookingsApi.list()`

### Navigasi
- Custom stack-based navigation (bukan React Router) — managed di `NavProvider` di `App.tsx`
- Methods: `navigate` (push), `navigateReplace` (replace top), `goBack` (pop), `resetTo` (reset stack ke `[home, target]`)
- `resetTo` digunakan di transisi kritis booking flow: setelah booking dibuat, setelah pembayaran berhasil, dan saat keluar dari alur pembayaran — mencegah user kembali ke halaman yang sudah tidak relevan (select-seats, booking-confirm, dll)
- Tab "Akun" → ProfilePage (jika login) atau AuthPage (jika belum login)
- AuthPage: toggle login/register, login toggle email/no HP
- ProfilePage: edit profil, ubah password, navigasi ke sub-pages

## Gateway API Endpoints (Console)

### Auth (`/api/gateway/auth/*`)
- `POST /api/gateway/auth/register` — Registrasi (fullName, email, phone, password)
- `POST /api/gateway/auth/login` — Login (email atau phone + password)
- `GET /api/gateway/auth/me` — Profil user (perlu Bearer token)
- `PUT /api/gateway/auth/profile` — Update profil (fullName, phone)
- `POST /api/gateway/auth/change-password` — Ganti password (currentPassword, newPassword)

### Trips (`/api/gateway/trips/*`)
- `GET /api/gateway/cities` — Daftar kota
- `GET /api/gateway/trips/search` — Pencarian jadwal (originCity, destinationCity, date, passengers)
- `GET /api/gateway/trips/{tripId}` — Detail trip
- `GET /api/gateway/trips/{tripId}/seatmap` — Seatmap (originSeq, destinationSeq, serviceDate)
- `GET /api/gateway/trips/{tripId}/reviews` — Ulasan trip
- `POST /api/gateway/trips/materialize` — Materialize trip virtual

### Operators
- `GET /api/gateway/operators/{slug}/info` — Info branding operator
- `GET /api/gateway/service-lines` — Daftar rute layanan

### Bookings (`/api/gateway/bookings/*`)
- `POST /api/gateway/bookings` — Buat pemesanan
- `GET /api/gateway/bookings/{bookingId}` — Detail pesanan
- `GET /api/gateway/bookings` — Daftar pesanan
- `POST /api/gateway/bookings/{id}/cancel` — Batalkan pesanan

## Design System

### Warna Utama (Brand)
- **Header/Hero gradient**: `bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600` (via `.hero-mesh` CSS utility)
- **Page background**: `bg-[#f8fafa]` (light mint)
- **Cards**: `bg-white rounded-2xl shadow-soft` atau `shadow-card`
- **Primary CTA button**: `bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700`
- **Shadow CTA**: `shadow-lg shadow-emerald-600/15` (atau `/20`)
- **Secondary button**: `border-2 border-teal-600/20 text-teal-700`
- **BottomNav**: Floating glassmorphism bar (`bg-white/90 backdrop-blur-2xl rounded-[20px]`), margin dari edge, active tab punya pill indicator (`from-teal-600/15 to-emerald-500/15`) + icon `text-teal-700`
- **Accent price**: `text-teal-800` (large price displays) atau `text-teal-700` (inline)

### Font
- **Body**: DM Sans (`font-sans`)
- **Display/Headings**: Outfit (`font-display`)

### Decorative Patterns
- PageHeader memiliki subtle white circle patterns (`bg-white/[0.07]`) di pojok kanan atas dan kiri bawah
- Hero section HomePage juga punya pattern serupa
- Onboarding Page punya design terpisah (multi-color slides) — sengaja tidak ikut design system utama

### CSS Utilities
- `.hero-mesh` — gradient utama untuk header/hero sections
- `.hero-gradient` — alias untuk hero-mesh
- `.btn-gradient` — gradient untuk tombol (alternatif inline classes)
- `.safe-bottom` — padding bottom safe area
- `.font-display` — font Outfit

## Data Model Notes

- User model: `{ id, fullName, email, phone, avatarUrl, createdAt }` (dari Console)
- Semua trip dari search bisa virtual (`isVirtual: true`) — perlu materialize sebelum seatmap
- Stop filtering pakai `boardingAllowed`/`alightingAllowed` flags
- `tripId` format: `{operatorSlug}:{originalId}` — jangan diparsing, kirim apa adanya
- Booking status: held → confirmed → completed (atau cancelled)
