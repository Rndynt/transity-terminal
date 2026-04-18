# TransityWeb & TransityConsole — Product Roadmap

## Konteks & Visi

**Transity** adalah ekosistem produk multi-layer untuk industri travel shuttle Indonesia:

```
┌──────────────────────────────────────────────────────────────────┐
│                        EKOSISTEM TRANSITY                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TransityWeb (OTA)          TransityConsole (Manajemen OTA)      │
│  ─────────────────          ───────────────────────────────      │
│  Customer booking portal    Operator registry + aggregation      │
│  Semua tiket semua operator Admin OTA dashboard & analytics      │
│  Satu akun, banyak rute     Monitoring kesehatan terminal        │
│                                                                  │
│                    ↕ via TERMINAL_SERVICE_KEY                    │
│                                                                  │
│  TransityTerminal × N (Operator-Specific)                        │
│  ────────────────────────────────────────                        │
│  Nusa Shuttle Terminal     → nusa-terminal.transity.web.id       │
│  BusKita Terminal          → buskita-terminal.transity.web.id    │
│  TransExpress Terminal     → transexpress-terminal.transity.web.id│
│  ... (N operator)                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Mengapa TransityConsole Diperlukan?

Tanpa TransityConsole, TransityWeb harus langsung tahu URL semua Terminal. Ini menimbulkan masalah:

| Masalah | Tanpa Console | Dengan Console |
|---|---|---|
| Tambah operator baru | Update kode TransityWeb | Tambah baris di Operator Registry |
| Terminal down | TransityWeb ikut error | Console handle fallback/circuit breaker |
| Komisi & fee | Harus hardcode | Konfigurasi per operator di Console |
| Monitoring | Tidak ada | Dashboard kesehatan semua Terminal |
| Analytics lintas operator | Tidak bisa | Ada di Console |

**Kesimpulan**: TransityConsole adalah lapisan tengah (middleware/BFF) yang membuat TransityWeb tetap sederhana dan ekosistem tetap manageable seiring bertambahnya operator.

---

## Arsitektur Request Flow

### Pencarian Tiket (Search)
```
User → TransityWeb → POST /api/console/trips/search
                          ↓
                    TransityConsole
                    ├── GET operator registry (semua operator aktif)
                    ├── Fan-out parallel ke N Terminal:
                    │     GET {terminal.apiUrl}/api/app/trips/search
                    │     Header: X-Service-Key: {terminal.serviceKey}
                    ├── Merge & sort hasil
                    ├── Apply komisi/markup per operator
                    └── Return unified response ke TransityWeb
```

### Pemesanan Tiket (Booking)
```
User → TransityWeb → POST /api/console/bookings
                          ↓
                    TransityConsole
                    ├── Identifikasi operator dari tripId
                    ├── Forward booking ke Terminal operator
                    ├── Catat booking di Console DB (untuk tracking)
                    └── Return booking result ke TransityWeb
```

---

## Roadmap

---

### Phase 0: Terminal API Readiness ✅ (Selesai)

Persiapan Terminal agar siap dikonsumsi TransityConsole.

| Item | Status | Keterangan |
|---|---|---|
| `GET /api/health` | ✅ Done | Health check untuk monitoring & Docker |
| `GET /api/app/operator-info` | ✅ Done | Metadata brand (nama, logo, warna) |
| `X-Service-Key` middleware | ✅ Done | Auth service-to-service |
| Pagination pada search trips | ✅ Done | `page`, `limit`, `total`, `hasMore` |
| Error response terstandarisasi | ✅ Done | `{ error, code, details }` |

---

### Phase 1: TransityConsole MVP

**Target**: TransityConsole bisa mengelola operator dan mengagregasi pencarian tiket.

**Repo**: `transity-console` (project baru, terpisah)

**Stack**: Next.js (Admin UI) + Fastify (API) + PostgreSQL

#### 1.1 Operator Registry
- [ ] Schema: `operators` table (`id`, `name`, `slug`, `apiUrl`, `serviceKey`, `active`, `logoUrl`, `commissionPct`)
- [ ] CRUD operator (tambah, edit, nonaktifkan)
- [ ] Test koneksi Terminal (ping `GET /api/health`)
- [ ] Sinkron `operator-info` dari Terminal saat registrasi

#### 1.2 API Aggregation Layer
- [ ] `GET /api/console/trips/search` — fan-out paralel ke semua operator aktif
- [ ] `GET /api/console/trips/:operatorSlug/:tripId` — detail trip dari operator tertentu
- [ ] `GET /api/console/trips/:operatorSlug/:tripId/seatmap` — seatmap dari Terminal
- [ ] `GET /api/console/cities` — kumpulan kota dari semua Terminal

#### 1.3 Auth & Security
- [ ] Admin login (untuk operator internal Transity)
- [ ] API key management (generate service key per operator)
- [ ] Rate limiting per operator

#### 1.4 Health Monitoring Dashboard
- [ ] Status semua Terminal (online/offline/degraded)
- [ ] Latency per Terminal
- [ ] Alert jika Terminal down

---

### Phase 2: TransityWeb — Multi-Operator

**Target**: TransityWeb konsumsi API dari TransityConsole (bukan langsung ke Terminal).

#### 2.1 Migrasi Sumber Data
- [ ] Ganti direct Terminal call → TransityConsole aggregation API
- [ ] Handle response format terpadu dari Console
- [ ] Tampilkan branding per operator di hasil pencarian

#### 2.2 Unified Booking Flow
- [ ] Booking diteruskan ke Terminal yang tepat via Console
- [ ] Konfirmasi booking disimpan di Console DB
- [ ] Halaman "My Trips" menampilkan booking dari semua operator

#### 2.3 User Management (OTA)
- [ ] Akun user TransityWeb (terpisah dari akun CSO Terminal)
- [ ] Profil, riwayat perjalanan lintas operator
- [ ] Notifikasi (booking reminder, trip update)

---

### Phase 3: TransityConsole — Monetisasi & Analytics

**Target**: Transity sebagai OTA bisa mengelola revenue dan laporan.

#### 3.1 Commission Engine
- [ ] Konfigurasi komisi per operator (persen atau flat)
- [ ] Kalkulasi otomatis saat transaksi
- [ ] Invoice bulanan per operator

#### 3.2 Reporting & Analytics
- [ ] Revenue report lintas operator
- [ ] Rute paling populer (aggregated)
- [ ] Booking funnel (search → view → book → pay)
- [ ] Operator performance comparison

#### 3.3 Content Management
- [ ] Featured routes di homepage TransityWeb
- [ ] Banner/promo khusus dari operator
- [ ] SEO metadata per rute

---

### Phase 4: Ekosistem Lanjutan

| Fitur | Deskripsi |
|---|---|
| **Webhook dari Terminal** | Terminal push event ke Console (booking terkonfirmasi, trip dibatalkan) |
| **Cache Layer** | Redis di Console untuk cache hasil search (TTL 30 detik) |
| **Circuit Breaker** | Jika Terminal tidak respond dalam 3 detik, skip dan lanjut |
| **Multi-currency & multi-region** | Ekspansi ke luar Jawa |
| **Mobile App (B2C)** | Expo React Native untuk TransityWeb mobile |
| **API Publik** | Open API untuk third-party OTA yang ingin jual tiket Transity |

---

## File Structure (Target)

```
transity-console/               ← Repo baru
├── apps/
│   ├── api/                    ← Fastify aggregation API
│   │   ├── src/
│   │   │   ├── operators/      ← Operator registry CRUD
│   │   │   ├── aggregation/    ← Fan-out search, merge results
│   │   │   ├── bookings/       ← Booking tracking
│   │   │   └── monitoring/     ← Health check + alerting
│   └── dashboard/              ← Next.js admin panel
│       ├── app/
│       │   ├── operators/      ← Manage operators
│       │   ├── bookings/       ← All bookings across operators
│       │   ├── analytics/      ← Revenue & trip analytics
│       │   └── settings/       ← Console configuration
└── packages/
    └── shared/                 ← Shared types antara api & dashboard

transity-web/                   ← Repo ini (akan dipisah)
├── src/
│   ├── lib/
│   │   └── console-client.ts   ← HTTP client ke TransityConsole API
│   └── ...

transity-terminal/              ← Repo operator (deploy N kali)
└── ...                         ← Project ini
```

---

## Environment Variables yang Dibutuhkan

### TransityTerminal (sudah ada)
```env
TERMINAL_SERVICE_KEY=<generated-per-operator>   # ← Baru ditambahkan
REALMIO_TENANT_ID=nusa-shuttle
```

### TransityConsole (nanti)
```env
# Database Console
DATABASE_URL=postgresql://...

# Auth admin Console
CONSOLE_JWT_SECRET=<random-32-char>

# Daftar key per terminal disimpan di DB, bukan env
```

### TransityWeb (nanti, update)
```env
# Ganti dari direct Terminal URL ke Console URL
CONSOLE_API_URL=https://console.transity.web.id
CONSOLE_API_KEY=<key-untuk-web-akses-console>
```
