# Transity Mobile App — Dokumentasi Lengkap

Aplikasi mobile **Transity** adalah aplikasi passenger (penumpang) berbasis React Native + Expo yang terhubung ke backend TransityCore yang sama. Penumpang bisa mencari trip, pilih kursi, booking tiket, tracking kargo, dan melihat e-ticket dengan QR code.

---

## Daftar Isi

1. [Prasyarat (Prerequisites)](#1-prasyarat)
2. [Struktur Folder](#2-struktur-folder)
3. [Instalasi & Setup Awal](#3-instalasi--setup-awal)
4. [Konfigurasi Environment](#4-konfigurasi-environment)
5. [Menjalankan Aplikasi](#5-menjalankan-aplikasi)
6. [Cara Test di Device / Emulator](#6-cara-test-di-device--emulator)
7. [Fitur & Alur Halaman](#7-fitur--alur-halaman)
8. [Koneksi ke Backend](#8-koneksi-ke-backend)
9. [Build untuk Production](#9-build-untuk-production)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prasyarat

Pastikan semua tools berikut sudah terinstal di komputer lokal Anda:

| Tool | Versi Minimum | Cara Cek |
|------|---------------|----------|
| **Node.js** | 18.x atau lebih | `node -v` |
| **npm** | 9.x atau lebih | `npm -v` |
| **Expo CLI** | Terbaru | `npx expo --version` |
| **Git** | Terbaru | `git --version` |

Untuk menjalankan di perangkat fisik:
- Install aplikasi **Expo Go** dari App Store (iOS) atau Play Store (Android)

Untuk menjalankan di emulator:
- **Android:** Android Studio + Android Emulator (AVD Manager)
- **iOS:** Xcode + iOS Simulator *(hanya di macOS)*

> **Catatan:** Mobile app ini **tidak bisa dijalankan langsung di Replit**. Ia harus dijalankan dari komputer lokal Anda karena membutuhkan Expo CLI, emulator, atau perangkat fisik.

---

## 2. Struktur Folder

```
apps/mobile/
├── app/                      # Routing (Expo Router - file-based)
│   ├── _layout.tsx           # Root layout (QueryClient, Auth init)
│   ├── (tabs)/               # Navigasi tab utama
│   │   ├── _layout.tsx       # Konfigurasi bottom tab navigator
│   │   ├── index.tsx         # Beranda (Home)
│   │   ├── search.tsx        # Cari trip
│   │   ├── my-trips.tsx      # Riwayat booking penumpang
│   │   ├── cargo.tsx         # Kargo / tracking waybill
│   │   └── profile.tsx       # Profil & pengaturan akun
│   ├── (auth)/               # Alur autentikasi
│   │   ├── _layout.tsx       # Modal auth layout
│   │   ├── login.tsx         # Halaman login
│   │   └── register.tsx      # Halaman registrasi
│   ├── search-results.tsx    # Daftar hasil pencarian trip
│   ├── trip-detail.tsx       # Detail trip + ulasan
│   ├── select-seats.tsx      # Pilih kursi (seatmap interaktif)
│   ├── booking-confirm.tsx   # Konfirmasi & pembayaran booking
│   ├── booking-detail.tsx    # Detail booking + status
│   └── e-ticket.tsx          # E-Ticket dengan QR Code
├── src/
│   ├── lib/
│   │   └── api.ts            # Semua fungsi API call ke backend
│   └── store/
│       └── auth.ts           # State management autentikasi (Zustand)
├── assets/                   # Icon, gambar, splash screen
├── app.json                  # Konfigurasi Expo (nama app, bundle ID, dll)
├── package.json              # Dependencies mobile app
├── tailwind.config.ts        # Konfigurasi NativeWind (Tailwind untuk RN)
└── tsconfig.json             # Konfigurasi TypeScript
```

---

## 3. Instalasi & Setup Awal

### Langkah 1 — Clone & masuk ke folder mobile

Jika Anda sudah clone repo TransityCore, cukup masuk ke folder mobile:

```bash
cd apps/mobile
```

### Langkah 2 — Install dependencies

```bash
npm install
```

Proses ini akan menginstal semua package yang dibutuhkan termasuk Expo SDK, React Native, NativeWind, dll.

### Langkah 3 — Install Expo CLI secara global (jika belum)

```bash
npm install -g expo-cli
```

Atau gunakan `npx` tanpa install global (direkomendasikan):

```bash
npx expo --version
```

---

## 4. Konfigurasi Environment

### File `.env` (buat di dalam `apps/mobile/`)

Buat file `.env` di folder `apps/mobile/`:

```env
EXPO_PUBLIC_API_URL=https://<your-replit-domain>.replit.app
```

**Cara mendapatkan URL backend:**
- Buka project Transity di Replit
- Klik tombol **"Open in new tab"** di panel preview
- Salin URL tersebut (contoh: `https://transitycore.replit.app`)
- Gunakan URL itu sebagai nilai `EXPO_PUBLIC_API_URL`

Untuk development lokal (jika backend juga dijalankan lokal):

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:5000
```

> **Penting:** Gunakan **IP lokal** Anda (bukan `localhost`) karena emulator/perangkat fisik tidak bisa mengakses `localhost` komputer Anda. Cari IP lokal dengan `ipconfig` (Windows) atau `ifconfig` / `ip a` (Mac/Linux).

### Jika tidak menggunakan `.env`

Edit langsung di `src/lib/api.ts` baris pertama:

```typescript
const API_BASE = 'https://your-replit-domain.replit.app';
```

---

## 5. Menjalankan Aplikasi

Semua perintah dijalankan dari dalam folder `apps/mobile/`:

```bash
cd apps/mobile
```

### Jalankan development server (umum)

```bash
npm start
# atau
npx expo start
```

Setelah server berjalan, terminal akan menampilkan QR code dan menu interaktif:

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
```

### Jalankan khusus Android

```bash
npm run android
# atau
npx expo start --android
```

### Jalankan khusus iOS (hanya macOS)

```bash
npm run ios
# atau
npx expo start --ios
```

### Jalankan di Browser (web)

```bash
npm run web
# atau
npx expo start --web
```

---

## 6. Cara Test di Device / Emulator

### Opsi A — Expo Go (Paling Mudah)

1. Install **Expo Go** di smartphone Anda:
   - [Android - Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS - App Store](https://apps.apple.com/app/expo-go/id982107779)
2. Jalankan `npm start` di folder `apps/mobile/`
3. Pastikan smartphone dan komputer terhubung ke **WiFi yang sama**
4. Scan QR code yang muncul di terminal:
   - **Android:** Buka Expo Go → Scan QR code
   - **iOS:** Buka kamera bawaan → Scan QR code → Tap notifikasi

### Opsi B — Android Emulator

1. Install **Android Studio** dari [developer.android.com/studio](https://developer.android.com/studio)
2. Buka Android Studio → Virtual Device Manager → Buat emulator baru (Pixel 6, API 33+)
3. Jalankan emulator
4. Jalankan `npm run android` dari folder `apps/mobile/`

### Opsi C — iOS Simulator (macOS saja)

1. Install **Xcode** dari Mac App Store
2. Buka Xcode → Preferences → Components → Install iOS Simulator
3. Jalankan `npm run ios` dari folder `apps/mobile/`

---

## 7. Fitur & Alur Halaman

### Alur Utama Penumpang

```
Beranda (Home)
    │
    ├── Cari Trip (Search)
    │       │
    │       └── Hasil Pencarian → Detail Trip → Pilih Kursi
    │                                               │
    │                                   Konfirmasi & Pembayaran
    │                                               │
    │                                       Detail Booking
    │                                               │
    │                                          E-Ticket (QR)
    │
    ├── My Trips — Riwayat semua booking
    │
    ├── Kargo — Kirim / Track paket
    │
    └── Profil — Edit akun, logout
```

### Detail Setiap Halaman

| Halaman | Deskripsi |
|---------|-----------|
| **Beranda** | Shortcut pencarian, promo, info layanan |
| **Cari Trip** | Form pencarian (kota asal, tujuan, tanggal, jumlah penumpang) |
| **Hasil Pencarian** | List trip tersedia dengan harga & kursi tersisa |
| **Detail Trip** | Info lengkap trip, jadwal per halte, rating & ulasan |
| **Pilih Kursi** | Seatmap interaktif — tap kursi untuk pilih/batal |
| **Konfirmasi Booking** | Isi data penumpang, pilih metode bayar, konfirmasi |
| **Detail Booking** | Status booking, status pembayaran, countdown hold |
| **E-Ticket** | QR code per penumpang, info perjalanan lengkap |
| **My Trips** | Semua riwayat booking — aktif, selesai, dibatalkan |
| **Kargo** | Track waybill atau buat pengiriman kargo baru |
| **Profil** | Edit nama, nomor HP, ganti password, logout |
| **Login** | Masuk dengan email & password |
| **Register** | Daftar akun baru |

---

## 8. Koneksi ke Backend

Mobile app berkomunikasi dengan backend TransityCore melalui REST API. Semua API call terpusat di `src/lib/api.ts`.

### Endpoint yang Digunakan

| Modul | Endpoint | Keterangan |
|-------|----------|------------|
| Auth | `POST /api/app/auth/register` | Registrasi penumpang baru |
| Auth | `POST /api/app/auth/login` | Login, mendapat JWT token |
| Auth | `GET /api/app/auth/me` | Cek sesi aktif |
| Profile | `GET /api/app/profile` | Ambil profil |
| Profile | `PATCH /api/app/profile` | Update profil |
| Cities | `GET /api/app/cities` | List kota tersedia |
| Trips | `GET /api/app/trips/search` | Cari trip berdasarkan kota & tanggal |
| Trips | `GET /api/app/trips/:id` | Detail trip |
| Trips | `GET /api/app/trips/:id/seatmap` | Seatmap kursi |
| Trips | `GET /api/app/trips/:id/reviews` | Ulasan trip |
| Bookings | `POST /api/app/bookings` | Buat booking baru |
| Bookings | `GET /api/app/bookings` | List booking milik user |
| Bookings | `GET /api/app/bookings/:id` | Detail booking + e-ticket |
| Bookings | `GET /api/app/bookings/:id/payment-status` | Cek status pembayaran |
| Bookings | `POST /api/app/bookings/:id/cancel` | Batalkan booking |
| Cargo | `GET /api/app/cargo/track/:waybill` | Track kargo by waybill |
| Cargo | `POST /api/app/cargo` | Buat pengiriman kargo |
| Reviews | `POST /api/app/reviews` | Kirim ulasan trip |

### Autentikasi

- Setelah login, **JWT token** disimpan secara aman menggunakan `expo-secure-store` (terenkripsi di perangkat).
- Setiap request API otomatis menyertakan header `Authorization: Bearer <token>`.
- Token dimuat ulang saat app dibuka (`loadToken()` di root layout).

---

## 9. Build untuk Production

### Build APK/IPA dengan EAS Build (Rekomendasi)

**Expo Application Services (EAS)** adalah cara resmi untuk build app React Native ke APK (Android) atau IPA (iOS).

#### Langkah 1 — Install EAS CLI

```bash
npm install -g eas-cli
```

#### Langkah 2 — Login ke Expo

```bash
eas login
```

#### Langkah 3 — Konfigurasi EAS

Dari folder `apps/mobile/`:

```bash
eas build:configure
```

Ini akan membuat file `eas.json`.

#### Langkah 4 — Build APK Android

```bash
eas build --platform android --profile preview
```

Untuk APK yang bisa langsung diinstal (bukan AAB):

```json
// eas.json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

#### Langkah 5 — Build IPA iOS

```bash
eas build --platform ios --profile preview
```

> **Catatan:** Build iOS membutuhkan akun Apple Developer ($99/tahun).

### Set Production API URL sebelum build

Pastikan `EXPO_PUBLIC_API_URL` sudah mengarah ke URL production backend (Replit deployment URL), bukan URL development.

---

## 10. Troubleshooting

### App tidak bisa connect ke backend

**Gejala:** Error "Network request failed" atau timeout

**Solusi:**
1. Pastikan `EXPO_PUBLIC_API_URL` di `.env` sudah benar
2. Jika test dengan Expo Go, gunakan IP lokal bukan `localhost`
3. Pastikan backend Replit sedang **running** (workflow "Start application" aktif)
4. Coba akses URL backend di browser dulu untuk memastikan backend jalan

---

### Metro bundler error saat `npm start`

**Solusi:**
```bash
# Clear cache
npx expo start --clear

# Atau hapus node_modules dan install ulang
rm -rf node_modules
npm install
npx expo start
```

---

### Emulator Android tidak terdeteksi

**Solusi:**
1. Pastikan Android Studio sudah terinstal
2. Pastikan emulator sudah **running** dulu sebelum `npm run android`
3. Cek dengan `adb devices` — emulator harus muncul di list
4. Jika ADB tidak ditemukan, tambahkan ke PATH:
   ```
   export PATH=$PATH:~/Library/Android/sdk/platform-tools
   ```

---

### Expo Go versi tidak kompatibel

**Gejala:** Error "SDK version mismatch"

**Solusi:** Pastikan Expo Go yang terinstal di smartphone mendukung **Expo SDK 52**. Update Expo Go ke versi terbaru dari app store.

---

### `expo-secure-store` error di web

**Gejala:** Error saat jalankan `npm run web`

**Penjelasan:** `expo-secure-store` tidak tersedia di browser. Mode web hanya untuk testing tampilan UI, bukan fungsionalitas penuh. Gunakan Expo Go atau emulator untuk testing lengkap.

---

## Ringkasan Perintah Penting

```bash
# Masuk ke folder mobile
cd apps/mobile

# Install dependencies
npm install

# Jalankan development server
npm start

# Jalankan di Android emulator
npm run android

# Jalankan di iOS simulator (macOS only)
npm run ios

# Jalankan di browser
npm run web

# Build APK Android (dengan EAS)
eas build --platform android --profile preview

# Clear cache Metro bundler
npx expo start --clear
```
