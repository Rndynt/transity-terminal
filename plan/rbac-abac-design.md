# RBAC + ABAC + Feature Flag Design

## Overview

Sistem kontrol akses TransityCore menggunakan pendekatan dua lapis:

- **RBAC (Role-Based Access Control)**: Setiap user memiliki satu role, dan setiap role memiliki sekumpulan feature flag default.
- **ABAC (Attribute-Based Access Control)**: Di atas RBAC, ada kondisi berbasis atribut — misalnya staff CSO hanya boleh akses data dari outlet tertentu.

**Feature Flag** adalah nama permission spesifik yang bisa di-toggle per role secara dinamis dari database, tanpa perlu deploy ulang.

---

## Arsitektur

```
User (dari Realmio/auth)
  │
  ▼
staff_members (user_id → role_id + outlet_id)
  │
  ▼
role_flags (role_id → flag_id + enabled)
  │
  ▼
Effective Permissions = Set<flagId>
  │
  ├── Backend: requireFlag(flagId) middleware → 403 jika tidak ada
  └── Frontend: usePermissions() hook → hide/disable UI
```

---

## Roles

| Role ID | Nama | Deskripsi |
|---|---|---|
| `owner` | Owner | Full access semua fitur dan master data |
| `finance` | Finance | Akses laporan finansial dan data booking (read-only) |
| `manager` | Manager | Akses operasional penuh + semua laporan, tidak bisa kelola master |
| `spv_operations` | SPV Operations | Kelola jadwal, SPJ, manifest, kargo |
| `operations` | Operations | Operasional harian, tidak bisa aksi sensitif |
| `spv_cso` | SPV CSO | CSO + bisa unseat/reschedule |
| `cso` | CSO | Booking & transaksi harian saja |

---

## Feature Flags

### Kategori `page` — Akses Halaman

| Flag ID | Nama | Deskripsi |
|---|---|---|
| `page.cso` | Halaman CSO | Akses halaman Reservasi / CSO |
| `page.cargo` | Halaman Kargo | Akses halaman Kargo |
| `page.bookings` | Halaman All Bookings | Akses halaman semua booking |
| `page.schedule` | Halaman Jadwal | Akses halaman Jadwal Harian |
| `page.spj` | Halaman SPJ | Akses halaman SPJ |
| `page.manifest` | Halaman Manifest | Akses halaman Manifest |
| `page.reports` | Halaman Laporan | Akses section Laporan |
| `page.masters` | Halaman Master | Akses section Master Data |

### Kategori `report` — Sub-Laporan

| Flag ID | Nama |
|---|---|
| `report.revenue` | Laporan Pendapatan |
| `report.sales` | Laporan Penjualan |
| `report.trip_profitability` | Laba Rugi Trip |
| `report.load_factor` | Load Factor |
| `report.cancellations` | Laporan Pembatalan |
| `report.cargo` | Laporan Kargo |
| `report.payments` | Laporan Pembayaran |

### Kategori `master` — Sub-Master Data

| Flag ID | Nama |
|---|---|
| `master.stops` | Master Stops |
| `master.outlets` | Master Outlets |
| `master.vehicles` | Master Kendaraan |
| `master.drivers` | Master Driver |
| `master.layouts` | Layout Kursi |
| `master.trip_patterns` | Trip Patterns |
| `master.trips` | Data Trips |
| `master.price_rules` | Aturan Harga |
| `master.promos` | Promo & Voucher |
| `master.cargo_types` | Jenis Kargo |
| `master.cargo_rates` | Tarif Kargo |
| `master.cost_templates` | Biaya Perjalanan |

### Kategori `action` — Aksi Operasional

| Flag ID | Nama | Endpoint Terkait |
|---|---|---|
| `action.booking.create` | Buat Booking | `POST /api/bookings` |
| `action.booking.cancel` | Cancel Tiket/Booking | `PATCH /api/passengers/:id/cancel` |
| `action.passenger.unseat` | Unseat Penumpang | `POST /api/passengers/:id/unseat` |
| `action.passenger.reschedule` | Reschedule Penumpang | `POST /api/passengers/:id/reschedule` |
| `action.passenger.assign_seat` | Assign Kursi | `POST /api/passengers/:id/assign-seat` |
| `action.trip.materialize` | Materialize Trip | `POST /api/cso/materialize-trip` |
| `action.trip.close` | Close Trip | `POST /api/trips/:id/close` |
| `action.payment.create` | Buat Pembayaran | `POST /api/payments` |
| `action.cargo.create` | Buat Kargo | `POST /api/cargo` |
| `action.cargo.manage` | Kelola Status Kargo | `PATCH /api/cargo/:id/status` |
| `action.spj.create` | Buat SPJ | `POST /api/spj` |
| `action.spj.issue` | Terbitkan SPJ | `PATCH /api/spj/:id/issue` |
| `action.spj.settle` | Settle SPJ | `PATCH /api/spj/:id/settle` |

### Kategori `admin` — Administrasi Sistem

| Flag ID | Nama |
|---|---|
| `admin.staff.manage` | Kelola Staff & Role |
| `admin.flags.manage` | Toggle Feature Flags |

---

## Default Flag Matrix per Role

| Flag | owner | finance | manager | spv_ops | ops | spv_cso | cso |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **page.cso** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **page.cargo** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **page.bookings** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **page.schedule** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **page.spj** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **page.manifest** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **page.reports** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **page.masters** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **report.revenue** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **report.sales** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **report.trip_profitability** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **report.load_factor** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **report.cancellations** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **report.cargo** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **report.payments** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **master.stops** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.outlets** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.vehicles** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.drivers** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.layouts** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.trip_patterns** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.trips** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.price_rules** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.promos** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.cargo_types** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.cargo_rates** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **master.cost_templates** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **action.booking.create** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **action.booking.cancel** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **action.passenger.unseat** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **action.passenger.reschedule** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **action.passenger.assign_seat** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **action.trip.materialize** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **action.trip.close** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **action.payment.create** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **action.cargo.create** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **action.cargo.manage** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **action.spj.create** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **action.spj.issue** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **action.spj.settle** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **admin.staff.manage** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **admin.flags.manage** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Database Schema (Tabel Baru)

```sql
-- 1. Role definitions
CREATE TABLE roles (
  id          TEXT PRIMARY KEY,         -- 'owner', 'cso', 'spv_cso', dll
  name        TEXT NOT NULL,            -- 'Owner', 'CSO', 'SPV CSO', dll
  description TEXT
);

-- 2. Feature flag registry
CREATE TABLE feature_flags (
  id          TEXT PRIMARY KEY,         -- 'action.passenger.unseat'
  name        TEXT NOT NULL,            -- 'Unseat Penumpang'
  description TEXT,
  category    TEXT NOT NULL             -- 'page' | 'report' | 'master' | 'action' | 'admin'
);

-- 3. Role ↔ Flag mapping (many-to-many)
CREATE TABLE role_flags (
  role_id     TEXT NOT NULL REFERENCES roles(id),
  flag_id     TEXT NOT NULL REFERENCES feature_flags(id),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role_id, flag_id)
);

-- 4. Staff member directory
CREATE TABLE staff_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL UNIQUE,     -- maps ke Realmio user.id
  role_id     TEXT NOT NULL REFERENCES roles(id),
  outlet_id   UUID REFERENCES outlets(id),  -- NULL = akses semua outlet
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## ABAC: Outlet Scope

Jika `staff_members.outlet_id` tidak null, maka:
- Query ke `/api/bookings` hanya return booking dari outlet tersebut
- Query ke `/api/trips` hanya return trip dari outlet tersebut
- Booking baru otomatis menggunakan outlet_id dari staff
- Endpoint lain yang relevan melakukan filtering serupa

Jika `outlet_id` null → user bisa akses **semua** outlet (mode multi-outlet).

---

## Backend Enforcement

### Middleware `requireFlag(flagId)`

```typescript
// Contoh penggunaan di routes.ts
app.post('/api/passengers/:id/unseat',
  requireFlag('action.passenger.unseat'),
  asyncHandler(bookingsController.unseatPassenger)
);
```

### Middleware `requireOutletScope()`

```typescript
// Otomatis filter atau reject jika resource bukan milik outlet user
app.get('/api/bookings',
  requireOutletScope(),   // attach outlet filter ke req
  asyncHandler(bookingsController.getAll)
);
```

### Endpoint `/api/permissions/me`

```json
{
  "flags": ["page.cso", "page.cargo", "action.booking.create", ...],
  "outletId": "uuid-outlet | null",
  "role": "cso"
}
```

---

## Frontend Enforcement

### Hook `usePermissions()`

```typescript
const { can, outletId, role } = usePermissions();

// Cek flag
if (!can('action.passenger.unseat')) return null;
```

### Component `<CanAccess>`

```tsx
<CanAccess flag="action.passenger.unseat">
  <Button onClick={handleUnseat}>Unseat</Button>
</CanAccess>
```

### Route Guard

```tsx
<Route path="/masters">
  <RequireFlag flag="page.masters" fallback={<Forbidden />}>
    <MastersPage />
  </RequireFlag>
</Route>
```

---

## Admin UI

### Halaman `/admin/staff`
- Tabel daftar staff aktif (nama, email, role, outlet, status)
- Tambah staff baru: cari user Realmio by email → assign role → assign outlet (opsional)
- Edit role atau outlet assignment
- Nonaktifkan staff

### Halaman `/admin/flags`
- Grid role vs flag
- Toggle checkbox per sel (role × flag)
- Perubahan langsung update `role_flags` di DB
- Reload permissions cache user yang sedang aktif

---

## Rencana Implementasi

| Task | Scope | Status |
|---|---|---|
| #1 — Foundation | Schema DB, RBAC service, seed data | 🔲 |
| #2 — Backend Enforcement | Middleware pada semua routes, outlet scope, `/api/permissions/me` | 🔲 |
| #3 — Frontend System | Hooks, component guard, route protection, UI per flag | 🔲 |
| #4 — Admin UI | Staff management page + flag toggle page | 🔲 |
