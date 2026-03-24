# TransityTerminal — Multi-Stop Travel Management System

## Overview
Sistem manajemen perjalanan multi-stop (bus/travel) untuk operator Indonesia. Fitur utama: terminal reservasi CSO, penjadwalan trip, kargo, aturan harga, manajemen kursi real-time via WebSocket, SPJ, laporan, dan RBAC.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Fastify 5 + TypeScript (tsx)
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Real-time**: Socket.io WebSocket untuk update kursi
- **Mobile**: Expo React Native (B2C) di `/apps/mobile`

## Running
- Workflow "Start application" → `npm run dev` (port 5000)
- `npm run db:push` → sync schema ke database
- `npm run build` → production build

## VPS Deployment
1. `npm install` → install semua dependencies
2. `npm run build` → build frontend + server bundle ke `dist/`
3. Set environment variables (production):
   - `DATABASE_URL` — PostgreSQL connection string (wajib)
   - `PORT` — port server (default 5000)
   - `JWT_SECRET` — secret untuk JWT mobile app (wajib, fatal error jika tidak diset)
   - `AUTHCORE_BASE_URL` — URL Realmio auth server (wajib, auth akan reject semua request jika kosong)
   - `AUTHCORE_TENANT_ID` — Tenant ID di Realmio (default: `transity`)
   - `PAYMENT_WEBHOOK_SECRET` — HMAC secret untuk verifikasi webhook pembayaran (wajib jika pakai payment gateway)
   - `APP_CORS_ORIGINS` — Comma-separated allowed origins untuk mobile API (default: `*`, set ke domain spesifik di production)
4. `npm start` → jalankan production build
5. Variabel dev-only (JANGAN dipakai di production):
   - `DEV_BYPASS_AUTH=true` — bypass auth, auto-login sebagai owner (hardcoded tidak bisa aktif di production)
   - `npm run start:dev` → production build dengan auto bypass auth
- Vite plugin Replit (`@replit/vite-plugin-*`) otomatis di-skip jika `REPL_ID` tidak ada (bukan di Replit)

---

## Arsitektur Proyek

### Struktur Folder
```
shared/
  schema/                → Drizzle table definitions, dipecah per domain
    index.ts             → Re-exports semua schema domain
    enums.ts             → Semua pgEnum definitions
    fleet.ts             → drivers, vehicles, layouts
    network.ts           → stops, outlets
    scheduling.ts        → tripPatterns, patternStops, tripBases, trips, scheduleExceptions, tripStopTimes, tripLegs
    inventory.ts         → seatInventory, seatHolds, priceRules
    booking.ts           → bookings, passengers, payments, printJobs
    cargo.ts             → cargoShipments, cargoTypes, cargoRates
    finance.ts           → tripCostTemplates, tripCostItems
    promo.ts             → promotions, vouchers
    spj.ts               → SPJ tables
    rbac.ts              → roles, permissions, userRoles, staff, featureFlags
    app-users.ts         → appUsers (mobile B2C)
    relations.ts         → Drizzle relations definitions
    reviews.ts           → Reviews tables

server/
  index.ts               → Fastify app bootstrap (decorateRequest, contentTypeParser, logging, error handler)
  routes.ts              → Route orchestrator — import & call registerXxxRoutes() dari setiap module
  storage.interface.ts   → IStorage interface + ManifestEntry/ManifestFull/ManifestCargoEntry types
  storage.ts             → Thin facade — delegasi ke 6 domain repositories
  db.ts                  → Drizzle ORM instance + PostgreSQL pool
  vite.ts                → Vite HMR integration (@fastify/middie) + static serving (@fastify/static)
  types/
    fastify.d.ts         → FastifyRequest type augmentations (user, rbac, appUser, scopedOutletId, rawBody)
  realtime/
    ws.ts                → Socket.io WebSocket server (seat updates, booking broadcasts)
  repositories/          → Domain-specific data access (SQL queries)
    fleet.repository.ts       → drivers, vehicles, layouts
    network.repository.ts     → stops, outlets + impact check queries (active trip/booking counts)
    scheduling.repository.ts  → trips, patterns, bases, stopTimes, legs, inventory, priceRules, manifest + impact checks
    booking.repository.ts     → bookings, passengers, payments, printJobs
    cargo.repository.ts       → cargoTypes, cargoRates, cargoShipments
    finance.repository.ts     → costTemplates, costItems, promotions, vouchers
    reports.repository.ts     → 8 analytical report queries (revenue, sales, profitability, load factor, cancellations, cargo, payments, commercial fee)
  scripts/
    backfill-snapshots.ts     → One-time script: populate snapshot columns for existing trips & bookings
  modules/               → Business logic + API controllers, 1 folder per domain
    auth/                → Realmio auth proxy (realmio.ts middleware, auth.routes.ts)
    rbac/                → RBAC + ABAC + Feature Flags (rbac.middleware.ts, rbac.service.ts, rbac.admin.routes.ts, rbac.seed.ts)
    app/                 → Mobile B2C API auth + controllers
    bookings/            → BookingsService + BookingsController + UnseatService + DeterministicBookingService
    pricing/             → PricingService + PricingController
    cargo/               → CargoService + CargoController
    seatInventory/       → SeatInventoryService
    tripBases/           → TripBasesService (materialisasi virtual → real)
    tripLegs/            → TripLegsService
    spj/                 → SpjService + SpjController (Surat Perintah Jalan) — Zod-validated cost-line input
    reports/             → ReportsService + ReportsController (8 report types) — delegasi ke ReportsRepository
    promos/              → PromosService + PromosController (promo & voucher)
    payments/            → PaymentsController
    holds/               → HoldsService (seat hold management)
    drivers/             → DriversController + DriversService
    vehicles/            → VehiclesController + VehiclesService
    stops/               → StopsController + StopsService
    outlets/             → OutletsController
    layouts/             → LayoutsController
    trips/               → TripsController
    tripPatterns/        → TripPatternsController
    patternStops/        → PatternStopsController
    tripStopTimes/       → TripStopTimesController
    priceRules/          → PriceRulesController
    printing/            → PrintService (print job management)

client/src/
  App.tsx                → Root router (wouter) + React.lazy page imports
  pages/
    cso/                 → CsoPage.tsx — terminal reservasi CSO utama
    cargo/               → CargoListPage.tsx — daftar pengiriman kargo
    bookings/            → AllBookingsPage.tsx — daftar semua booking
    schedule/            → SchedulePage.tsx — jadwal harian + assign driver + buat SPJ
    manifest/            → ManifestPage.tsx — cetak manifest perjalanan
    spj/                 → SpjPage.tsx — manajemen Surat Perintah Jalan
    masters/             → MastersPage.tsx — CRUD master data (stops, pola, armada, dll)
    reports/             → 8 report pages (Revenue, Sales, TripProfitability, LoadFactor, Cancellations, Cargo, Payments, CommercialFee)
    admin/               → StaffManagement + FeatureFlagManagement
    auth/                → LoginPage.tsx
    dashboard/           → DashboardPage.tsx
  components/
    cso/                 → Komponen terminal CSO
      TripSelector.tsx        → Pilih outlet + tanggal + trip
      RouteTimeline.tsx       → Timeline halte naik/turun
      SeatMap.tsx             → Peta kursi interaktif + real-time
      PassengerForm.tsx       → Form penumpang + pembayaran
      PassengerDetailModal.tsx→ Detail penumpang + unseat/reschedule/cancel
      BookingStepper.tsx      → Step indicator booking
      CargoForm.tsx           → Form pengiriman kargo di CSO
      CargoWaybillPreview.tsx → Preview waybill
      PrintPreview.tsx        → Preview cetak tiket
      PassengerCard.tsx       → Card info penumpang
      PassengerActions.tsx    → Aksi unseat/pindah kursi
      PaymentPanel.tsx        → Panel pembayaran
      BatchRescheduleDialog.tsx → Dialog batch reschedule saat close trip
    masters/             → Komponen CRUD master data
      StopsManager.tsx        → CRUD halte
      TripPatternsManager.tsx → CRUD pola trip
      TripBasesManager.tsx    → CRUD jadwal template (dipecah → TripBaseFormDialog + TripBaseGroupList)
      TripsManager.tsx        → Manage trip instances (dipecah → TripsFilterPanel)
      DriversManager.tsx      → CRUD driver
      VehiclesManager.tsx     → CRUD kendaraan
      LayoutsManager.tsx      → CRUD layout kursi
      OutletsManager.tsx      → CRUD outlet
      PriceRulesManager.tsx   → CRUD aturan harga
      CargoTypesManager.tsx   → CRUD tipe kargo
      CargoRatesManager.tsx   → CRUD tarif kargo
      PromosManager.tsx       → CRUD promo & voucher
      TripCostTemplatesManager.tsx → Template biaya perjalanan
      DataTable-related: MasterFormDialog, MasterPageHeader, DeleteConfirmDialog, RowActionsMenu
    manifest/            → ManifestDialog + ThermalManifest (cetak manifest 80mm)
    reports/             → ReportFilters, SummaryCards, ReportPageLayout
    shared/              → Reusable: DataTable, StatusBadges
    layout/              → Sidebar, ProtectedRoute
    rbac/                → RequireFlag + CanAccess permission components
    ui/                  → shadcn/ui components
  hooks/
    useBookingFlow.ts    → State machine booking flow CSO
    useSeatHold.ts       → Seat hold timer + auto-release
    useWebSocket.ts      → Socket.io connection management
    use-toast.ts         → Toast notifications
    use-mobile.tsx       → Mobile breakpoint detection
  lib/
    api.ts               → API client functions (grouped: tripsApi, bookingsApi, cargoApi, dll)
    auth.tsx             → AuthProvider + useAuth context
    constants.ts         → Centralized constants (status maps, channel maps, formatters)
    queryClient.ts       → React Query config + apiRequest helper
    permissions.tsx      → usePermissions hook
    utils.ts             → Utility functions

plan/                    → Dokumentasi teknis & plan fitur
```

### Lapisan Arsitektur Backend

```
Request → Fastify Route → preHandler middleware (auth, RBAC) → Controller → Service → Repository → Database
                                                                                   ↘ storage.ts facade (untuk IStorage interface)
```

1. **Route** (`*.routes.ts`): Definisi endpoint HTTP + middleware chain
2. **Controller** (`*.controller.ts`): Parse request, validasi input, panggil service, format response
3. **Service** (`*.service.ts`): Business logic, orchestrate multiple repository calls, transaksi
4. **Repository** (`server/repositories/*.repository.ts`): Raw SQL/Drizzle queries, satu per domain
5. **Storage Facade** (`server/storage.ts`): IStorage interface implementation, delegasi ke repositories

### Lapisan Arsitektur Frontend

```
Page → Components → Hooks → API Client → Backend
                         → React Query (cache + invalidation)
                         → WebSocket (real-time updates)
```

1. **Page** (`pages/*.tsx`): Layout halaman, state management top-level
2. **Component** (`components/*.tsx`): UI reusable, menerima props
3. **Hook** (`hooks/*.ts`): Shared logic (booking flow, seat hold, WebSocket)
4. **API** (`lib/api.ts`): Grouped API functions, return typed data
5. **React Query**: Caching, invalidation via `queryClient.invalidateQueries()`

---

## Panduan Membuat Fitur Baru

### Langkah 1: Definisikan Schema (jika perlu tabel baru)

File: `shared/schema/<domain>.ts` (pilih domain yang sesuai, atau buat file baru)

```typescript
import { sql } from "drizzle-orm";
import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const myNewTable = pgTable("my_new_table", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  categoryId: uuid("category_id").references(() => someOtherTable.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertMyNewTableSchema = createInsertSchema(myNewTable).omit({ id: true, deletedAt: true });
export type InsertMyNewTable = z.infer<typeof insertMyNewTableSchema>;
export type MyNewTable = typeof myNewTable.$inferSelect;
```

Kemudian re-export dari `shared/schema/index.ts`:
```typescript
export * from "./my-domain";
```

Lalu jalankan `npm run db:push` untuk sync ke database.

**Konvensi penting:**
- Semua master table WAJIB punya `deletedAt: timestamp("deleted_at", { withTimezone: true })` untuk soft delete
- Gunakan `uuid("id").primaryKey().default(sql\`gen_random_uuid()\`)` untuk UUID primary key (konvensi proyek ini)
- Buat insert schema dengan `.omit()` untuk field auto-generated
- Export 4 hal: table definition, insert schema, insert type, select type

### Langkah 2: Tambah Repository Method

File: `server/repositories/<domain>.repository.ts`

Tambahkan method CRUD di repository yang sesuai:

```typescript
async getMyItems(): Promise<MyNewTable[]> {
  return db.select().from(myNewTable).where(isNull(myNewTable.deletedAt));
}

async getMyItemById(id: string): Promise<MyNewTable | undefined> {
  const [item] = await db.select().from(myNewTable).where(eq(myNewTable.id, id));
  return item;
}

async createMyItem(data: InsertMyNewTable): Promise<MyNewTable> {
  const [item] = await db.insert(myNewTable).values(data).returning();
  return item;
}

async updateMyItem(id: string, data: Partial<InsertMyNewTable>): Promise<MyNewTable> {
  const [item] = await db.update(myNewTable).set(data).where(eq(myNewTable.id, id)).returning();
  return item;
}

async deleteMyItem(id: string): Promise<void> {
  await db.update(myNewTable).set({ deletedAt: new Date() }).where(eq(myNewTable.id, id));
}
```

**Jika repository baru**: buat file `server/repositories/xxx.repository.ts`, export class, import di `server/storage.ts`, tambahkan sebagai private field di `DatabaseStorage`, dan tambah delegasi methods.

### Langkah 3: Update IStorage Interface

File: `server/storage.interface.ts`

Tambahkan method signatures:
```typescript
getMyItems(): Promise<MyNewTable[]>;
getMyItemById(id: string): Promise<MyNewTable | undefined>;
createMyItem(data: InsertMyNewTable): Promise<MyNewTable>;
updateMyItem(id: string, data: Partial<InsertMyNewTable>): Promise<MyNewTable>;
deleteMyItem(id: string): Promise<void>;
```

### Langkah 4: Update Storage Facade

File: `server/storage.ts`

Tambahkan delegasi di `DatabaseStorage`:
```typescript
async getMyItems() { return this.xxxRepo.getMyItems(); }
async getMyItemById(id: number) { return this.xxxRepo.getMyItemById(id); }
// ... dst
```

### Langkah 5: Buat Module Backend (Service + Controller + Routes)

Buat folder: `server/modules/myFeature/`

**Service** (`myFeature.service.ts`):
```typescript
import { storage } from "../../storage";
import type { InsertMyNewTable } from "@shared/schema";

export class MyFeatureService {
  async getAll() {
    return storage.getMyItems();
  }
  async create(data: InsertMyNewTable) {
    // business logic, validasi, dll
    return storage.createMyItem(data);
  }
}
export const myFeatureService = new MyFeatureService();
```

**Controller** (`myFeature.controller.ts`):
```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import { myFeatureService } from "./myFeature.service";
import { insertMyNewTableSchema } from "@shared/schema";

export class MyFeatureController {
  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const items = await myFeatureService.getAll();
    reply.send(items);
  }
  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = insertMyNewTableSchema.parse(req.body);
    const item = await myFeatureService.create(data);
    reply.code(201).send(item);
  }
}
export const myFeatureController = new MyFeatureController();
```

**Routes** (`myFeature.routes.ts`):
```typescript
import type { FastifyInstance } from "fastify";
import { myFeatureController } from "./myFeature.controller";
import { requireFlag } from "../rbac/rbac.middleware";

export function registerMyFeatureRoutes(app: FastifyInstance) {
  app.get("/api/my-feature", { preHandler: [requireFlag("master.myFeature")] }, 
    myFeatureController.getAll.bind(myFeatureController));
  app.post("/api/my-feature", { preHandler: [requireFlag("master.myFeature")] }, 
    myFeatureController.create.bind(myFeatureController));
}
```

### Langkah 6: Register Routes

File: `server/routes.ts`

Import dan panggil di `registerRoutes()`:
```typescript
import { registerMyFeatureRoutes } from "./modules/myFeature/myFeature.routes";

// di dalam registerRoutes():
registerMyFeatureRoutes(app);
```

### Langkah 7: Buat Frontend Page/Component

**Jika halaman baru** — buat di `client/src/pages/myFeature/MyFeaturePage.tsx`

**Register route di App.tsx**:
```tsx
const MyFeaturePage = lazy(() => import("./pages/myFeature/MyFeaturePage"));
// di dalam Router:
<Route path="/my-feature" component={MyFeaturePage} />
```

**Tambah ke sidebar** di `client/src/components/layout/Sidebar.tsx`

**API functions** — tambahkan di `client/src/lib/api.ts`:
```typescript
export const myFeatureApi = {
  getAll: () => fetch("/api/my-feature").then(r => r.json()),
  create: (data: InsertMyNewTable) => apiRequest("POST", "/api/my-feature", data),
};
```

**Gunakan React Query** di component:
```tsx
const { data, isLoading } = useQuery({ queryKey: ["/api/my-feature"] });

const createMutation = useMutation({
  mutationFn: (data: InsertMyNewTable) => myFeatureApi.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/my-feature"] });
    toast({ title: "Berhasil dibuat" });
  },
});
```

### Langkah 8: RBAC (jika perlu akses kontrol)

1. Tambahkan feature flag di database:
   ```sql
   INSERT INTO feature_flags (id, name, category) VALUES ('master.myFeature', 'My Feature', 'master');
   INSERT INTO role_flags (role_id, flag_id, enabled) VALUES ('admin', 'master.myFeature', true);
   ```
2. Gunakan `requireFlag("master.myFeature")` di route preHandler
3. Di frontend, gunakan `usePermissions()` untuk cek akses:
   ```tsx
   const { can } = usePermissions();
   if (!can("master.myFeature")) return null;
   ```

### Checklist Fitur Baru
- [ ] Schema defined di `shared/schema/<domain>.ts` + re-export di index.ts
- [ ] `npm run db:push` berhasil
- [ ] Repository methods di `server/repositories/`
- [ ] IStorage interface updated di `server/storage.interface.ts`
- [ ] Storage facade delegasi di `server/storage.ts`
- [ ] Module folder: service + controller + routes di `server/modules/`
- [ ] Routes registered di `server/routes.ts`
- [ ] Frontend page/component + route di App.tsx
- [ ] API functions di `client/src/lib/api.ts`
- [ ] React Query dengan proper cache invalidation
- [ ] Sidebar menu item (jika halaman baru)
- [ ] RBAC flag (jika perlu akses kontrol)
- [ ] `data-testid` pada elemen interaktif

---

## Konvensi & Aturan Penting

### Data Safety (Soft Delete + Cascade)
Semua data master menggunakan **`deleted_at` TIMESTAMPTZ** untuk soft delete — tidak pernah dihapus permanen:
- **drivers, stops, outlets, vehicles, layouts, trip_patterns, pattern_stops, trip_bases, trips, trip_stop_times, trip_legs, price_rules, cargo_types** → kolom `deleted_at` di-set
- **trips** → juga set `status='canceled'` bersamaan dengan `deleted_at`
- **`active` flag** pada trip_patterns/trip_bases tetap terpisah — untuk enable/disable sementara, bukan delete
- Query list otomatis filter `deleted_at IS NULL`
- Query by ID tetap mengembalikan data termasuk yang soft-deleted (untuk laporan/referensi historis)
- **seat_inventory & seat_holds** tetap hard-delete karena bersifat transaksional/ephemeral

#### Cascade Soft Delete
Saat induk dihapus, semua anak ikut di-soft-delete:
- **deleteStop** → pattern_stops, outlets
- **deleteLayout** → vehicles
- **deleteTripPattern** → pattern_stops, price_rules (pattern-level), trip_bases
- **deleteTripBase** → trips (+ trip_stop_times, trip_legs, price_rules, seat_inventory, seat_holds)
- **deleteTrip** → trip_stop_times, trip_legs, price_rules (trip-level), seat_inventory (hard), seat_holds (hard)
- **deleteCargoType** → cargo_rates (hard delete, no deletedAt)

### Fastify Backend Conventions
- **Framework**: Fastify 5 — async-first, tidak perlu `asyncHandler` wrapper
- **Request augmentation**: `decorateRequest` di `index.ts` + type declarations di `server/types/fastify.d.ts`
  - `req.user` — authenticated user (dari Realmio)
  - `req.rbac` — resolved RBAC permissions (flags, role, outletId)
  - `req.appUser` — mobile B2C authenticated user
  - `req.scopedOutletId` — outlet scope dari RBAC
  - `req.rawBody` — raw Buffer untuk webhook signature verification
- **Middleware pattern**: Fastify `preHandler` hooks, bukan Express middleware
  - Global auth: `addHook('preHandler', ...)` di `routes.ts` (skip `/api/auth/` dan `/api/app/`)
  - Per-route: `{ preHandler: [requireFlag('master.stops'), requireOutletScope] }`
- **Error handling**: Centralized `setErrorHandler` — PG duplicate key (409), ZodError (400), generic (500)
- **Logging**: `onSend` hook logs semua `/api` requests — auth/session/profile/webhook paths otomatis redacted (token, password, dll tidak ter-log)
- **Rate Limiting**: `@fastify/rate-limit` (global: false, per-route config) — login 10/mnt, register 5/mnt
- **WebSocket**: Socket.io di-attach ke `app.server` setelah `listen()`

### Frontend Conventions
- **Routing**: `wouter` — semua page di `client/src/pages/`, register di `App.tsx`
- **State Management**: React Query untuk server state, React useState/useReducer untuk UI state
- **Forms**: shadcn `useForm` + `react-hook-form` + `zodResolver` dari insert schema
- **Icons**: `lucide-react` untuk aksi, `react-icons/si` untuk logo
- **Query keys**: array format `['/api/resource', id]` untuk proper invalidation
- **Mutations**: selalu invalidate cache setelah mutasi berhasil
- **Code splitting**: semua page di-lazy-load via `React.lazy()` + `Suspense`
- **data-testid**: wajib pada semua elemen interaktif dan data display

### Styling
- Tailwind CSS + shadcn/ui
- Dark mode: `darkMode: ["class"]` di tailwind config
- Custom properties di `index.css` pakai format `H S% L%` (space-separated)
- Import shadcn components via `@/components/ui/`
- Import hooks via `@/hooks/`

---

## Key Concepts

### Virtual vs Real Trips
- **Trip Base** = jadwal template (pola + hari + waktu default)
- **Virtual Trip** = tampil di CSO berdasarkan Trip Base, belum ada di database
- **Real Trip** = sudah di-materialize ke tabel `trips` dengan stop times, legs, seat inventory
- Saat CSO klik virtual trip → otomatis materialize → jadi real trip

### Pricing
- Price rules: scope `pattern | trip | leg | time`, prioritas tertinggi dipakai
- Rule JSON: `{ pricingMode, basePricePerLeg, currency, multiplier }`
- `pricingMode`: `per_leg` (harga × jumlah leg × multiplier) atau `flat` (tarif tetap × multiplier)
- Trip tanpa price rule: disabled di CSO, tidak bisa dipesan

### Seat Management
- `seat_inventory`: pre-computed per seat per leg
- `seat_holds`: temporary hold saat CSO pilih kursi (TTL-based, auto-cleanup via scheduler)
- WebSocket broadcast saat inventory berubah

### Authentication (Realmio Integration)
- **Model**: Whitelabel — 1 operator = 1 TransityTerminal instance
- **Backend**: `server/modules/auth/realmio.ts` (middleware), `auth.routes.ts` (proxy)
- **Frontend**: `client/src/lib/auth.tsx` (AuthProvider + useAuth)
- **Dev Mode**: Hanya aktif jika `NODE_ENV !== 'production'` — bypass auth, auto-login sebagai owner
- **Production Safety**: `DEV_BYPASS_AUTH` hardcoded `!IS_PRODUCTION` — mustahil aktif di production. Jika `AUTHCORE_BASE_URL` kosong di production, semua auth request akan di-reject
- **Env Vars**: `AUTHCORE_BASE_URL` (wajib prod), `AUTHCORE_TENANT_ID`, `DEV_BYPASS_AUTH` (dev only)

### RBAC + ABAC + Feature Flags
- **7 Roles**: `owner` (full access), `manager` (operasional + laporan), `finance` (laporan finansial, read-only), `spv_operations` (jadwal/SPJ/manifest/kargo), `operations` (operasional terbatas), `spv_cso` (CSO + unseat/reschedule), `cso` (booking harian)
- **33+ Permission Flags** di 5 kategori:
  - `page.*` — akses halaman (cso, cargo, bookings, schedule, spj, manifest, reports, masters, schedule.closed, cso.view_closed)
  - `report.*` — akses per-laporan (revenue, sales, trip_profitability, load_factor, cancellations, cargo, payments, commercial_fee)
  - `master.*` — CRUD master data (stops, outlets, vehicles, drivers, layouts, trip_patterns, trips, price_rules, promos, cargo_types, cargo_rates, cost_templates)
  - `action.*` — aksi operasional (booking.create, booking.cancel, passenger.unseat, passenger.reschedule, passenger.assign_seat, trip.materialize, trip.close, trip.batch_reschedule, payment.create, cargo.create, cargo.manage, spj.create, spj.issue, spj.settle)
  - `admin.*` — administrasi (staff.manage, flags.manage)
- **Database**: `roles` → `role_flags` (role-flag mapping) → `feature_flags` (flag id, name, category); `staff_members` (userId, role, outletId scope)
- **Backend**: `rbac.service.ts` (resolvePermissions, checkFlag), `rbac.middleware.ts` (requireFlag, requireAnyFlag, requireOutletScope), `rbac.admin.routes.ts` (admin CRUD)
- **Frontend**: `usePermissions().can(flagId)` untuk cek akses; `<RequireFlag>` dan `<CanAccess>` wrapper components
- **Middleware**: `requireFlag('master.stops')`, `requireAnyFlag('page.cso', 'page.cargo')`, `requireOutletScope`
- **Admin UI**: `/admin/staff` + `/admin/flags`
- **Seed**: `rbac.seed.ts` berisi default roles + flags + matrix — jalankan via `/api/seed/rbac` (dev only)

---

## Fitur-Fitur Utama

### CSO Booking Terminal (`/cso`)
- 2-phase layout: select phase (outlet + tanggal + trip) → book phase (seat map + passenger form)
- SeatMap interaktif dengan WebSocket real-time
- Unseat, pindah kursi, reschedule, cancel tiket — semua butuh reason/notes
- Auto-cancel timer (60 detik) untuk assign mode dan reschedule mode
- Deep-link dari All Bookings → CSO dengan auto-select outlet/trip/route
- Promo code support di booking flow

### Kargo (`/cargo`)
- cargo_types, cargo_rates, cargo_shipments
- Waybill generation (TRN-YYYYMMDD-XXXXX)
- Tariff calculation berdasarkan rute + tipe kargo
- Status lifecycle tracking

### Jadwal Harian (`/schedule`)
- Semua trip untuk tanggal tertentu
- Inline driver assignment
- Akses manifest + buat SPJ dari satu halaman

### SPJ — Surat Perintah Jalan (`/spj`)
- Auto-populate cost lines dari template
- Financial summary (revenue/costs/profit)
- Issue + settle workflow

### Reports (`/reports/*`)
- 8 tipe: Revenue, Sales, Trip Profitability, Load Factor, Cancellations, Cargo, Payments, Commercial Fee
- Shared components: ReportFilters, SummaryCards, ReportPageLayout
- SQL aggregation queries di `ReportsRepository` — service layer hanya business logic (commercial fee rules)
- Semua report menggunakan `COALESCE(snapshot, master)` — laporan historis tetap akurat walau data master berubah
- Per-report permission flags: setiap report punya flag sendiri (e.g., `report.revenue`, `report.commercial_fee`)
- Commercial fee: 3% gross, 11% PPN, volume discounts 0–15% berdasarkan total bulanan

### Batch Reschedule on Trip Close (`/cso`)
- Saat close trip, sistem cek apakah ada penumpang aktif
- Jika ada: tampilkan `BatchRescheduleDialog` dengan daftar penumpang + pilih trip tujuan
- Endpoint: `GET /api/trips/:id/active-passengers` + `POST /api/trips/:id/close-with-reschedule`
- Dilindungi: `action.trip.close` + `action.trip.batch_reschedule`
- Closed trip bisa dilihat di Schedule (`page.schedule.closed`) dan CSO (`page.cso.view_closed`)

### Master Data (`/masters`)
- Tabs: Halte, Pola Trip, Jadwal, Trip, Driver, Kendaraan, Layout, Outlet, Aturan Harga, Tipe Kargo, Tarif Kargo, Template Biaya, Promo & Voucher

---

## Data Integrity — Snapshot System

Untuk menjaga akurasi laporan historis, sistem menggunakan **snapshot columns** pada `trips` dan `bookings`. Data master (nama halte, nama rute, plat kendaraan, dll) bisa berubah kapan saja, tapi laporan harus tetap menampilkan data saat transaksi terjadi.

### Cara Kerja
- **Saat trip dimaterialisasi**: kolom `snap_route_name`, `snap_route_code` diisi dari trip pattern
- **Saat booking dibuat**: kolom `snap_origin_stop_name`, `snap_destination_stop_name`, `snap_departure_hhmm`, `snap_outlet_name` diisi dari data master saat itu
- **Saat driver/kendaraan di-assign**: `snap_driver_name`, `snap_vehicle_plate` diisi

### Penggunaan di Laporan
Semua query laporan menggunakan pola:
```sql
COALESCE(b.snap_origin_stop_name, s.name) AS origin_stop_name
```
Ini artinya: pakai snapshot jika ada, fallback ke data master jika belum ada snapshot (backward compatible untuk data lama).

### Impact Check
Saat user mengubah data master (nama halte, pola trip), endpoint impact check (`/api/stops/:id/impact`, `/api/trip-patterns/:id/impact`) mengembalikan jumlah trip/booking aktif yang terpengaruh. Frontend bisa menampilkan warning sebelum perubahan dilakukan.

### Backfill
Script `server/scripts/backfill-snapshots.ts` mengisi snapshot untuk data existing yang belum punya. Jalankan sekali:
```bash
npx tsx server/scripts/backfill-snapshots.ts
```

---

## Security

### Authentication
- **Staff/Admin**: Realmio external auth — proxy di `auth.routes.ts`, middleware di `realmio.ts`
- **Mobile App**: JWT internal (`jsonwebtoken`, bcryptjs) — 30 hari expiry
- **Production Guard**: `DEV_BYPASS_AUTH` hardcoded hanya di non-production; `JWT_SECRET` wajib di production (fatal error jika kosong)

### Authorization (RBAC)
- Semua endpoint `/api/*` dilindungi `requireAuth` global (kecuali `/api/auth/` dan `/api/app/`)
- Per-endpoint permission: `requireFlag('report.revenue')`, `requireAnyFlag(...)`, `requireOutletScope()`
- 7 role bawaan: owner, finance, manager, spv_operations, operations, spv_cso, cso
- 33+ permission flags di 5 kategori: page, report, master, action, admin

### Rate Limiting
- `@fastify/rate-limit` (global: false, per-route)
- Login endpoints: 10 request/menit
- Register endpoints: 5 request/menit

### Input Validation
- Booking: custom Zod schema dengan cross-field validation
- Cargo: Drizzle-Zod insert schemas
- SPJ cost-line: Zod schema (category, label, amount format, notes length)
- Reports: `reportFiltersSchema` untuk query params
- Trips: Zod schema untuk seatmap query coercion

### Webhook Security
- Payment webhook: HMAC-SHA256 signature verification (`x-webhook-signature` header)
- `crypto.timingSafeEqual` untuk timing-safe comparison

### CORS
- Admin dashboard: same-origin (tidak perlu CORS)
- Mobile API (`/api/app/*`): dikonfigurasi via `APP_CORS_ORIGINS` env var

### Response Logging
- Semua auth/session/profile/webhook response di-redact — token, password, session data tidak ter-log
- Sensitive keys: `token`, `password`, `passwordHash`, `providerRef`, `authorization`

### Seed Protection
- `/api/seed` dan `/api/seed/rbac` memerlukan `admin.flags.manage` permission
- Diblokir total di production (`NODE_ENV === 'production'`)

---

## Performance Optimizations

### Database Indexes
- 33+ indexes pada foreign keys dan frequently queried columns
- Partial index pada `bookings(pending_expires_at) WHERE status = 'pending'`
- Composite indexes: `seat_inventory(trip_id, seat_no)`, `trip_stop_times(trip_id, stop_id)`, `bookings(trip_id, status)`, `seat_inventory(trip_id, leg_index)`

### Batch Query Methods
- `getStopsByIds(ids)`, `getOutletsByIds(ids)`, `getPaymentsByBookingIds(bookingIds)`: single `WHERE id IN (...)` query
- `getBookingsPaginated()`: database-level LIMIT/OFFSET

### N+1 Query Fixes
- `getSeatmap`: batch passenger fetch via `getPassengersByBookingIds()`
- `getSeatPassengerDetails`: batch stops + outlets + payments + vehicle dalam single `Promise.all`; returns `otherPassengers` (semua penumpang lain dalam booking yang sama)
- `getVirtualTripsForCso`: batch pattern/patternStops dengan Maps
- `cleanupExpiredHolds`: bulk UPDATE+DELETE, bukan per-hold loop

### Parallelized Queries (Promise.all)
- `searchTrips`: origin + destination stops in parallel
- `getSeatmap`: layout + inventory + bookings + stopTimes in parallel
- `getCsoAvailableTrips`: real + virtual trips in parallel

### Frontend Performance
- SeatMap: polling disabled saat WebSocket connected
- SeatMap: seat grid calculation memoized via useMemo
- CsoPage: price calculation debounced (300ms)
- Code splitting: semua page lazy-loaded via React.lazy()

### Cache Headers
- Master data GET endpoints: `Cache-Control: private, max-age=60, stale-while-revalidate=120`

### API Pagination
- Bookings endpoint: `?page=1&pageSize=50` + RBAC outletId filter
- Returns `{ data, total, page, pageSize, totalPages }` (atau flat array jika tanpa page param)

---

## Critical Business Rules (WAJIB DIPAHAMI)

### Aturan Arsitektur — TIDAK BOLEH DILANGGAR
1. **TIDAK ADA SQL langsung di service layer** — Semua query database HARUS melalui rantai: Repository → IStorage → storage.ts facade. Service hanya boleh panggil `storage.xxx()` atau repository method. Satu-satunya exception: `ReportsRepository` yang standalone (tidak via IStorage) karena query-nya hanya read-only aggregasi.
2. **Semua endpoint `/api/*` dilindungi `requireAuth` global** — Hanya `/api/auth/*` dan `/api/app/*` yang di-exclude. Jangan pernah tambah endpoint tanpa auth.
3. **Soft delete wajib** untuk semua master data — Gunakan `deletedAt` column, bukan hard delete. Query list filter `isNull(deletedAt)`. Query by-id boleh return deleted (untuk referensi historis/laporan).
4. **Snapshot columns wajib diisi** saat create trip/booking — Semua laporan bergantung pada snapshot. Jika lupa isi, laporan akan fallback ke data master terkini (tidak fatal, tapi inaccurate secara historis).

### Aturan Bisnis — Logika Domain
1. **Trip status enum**: hanya 3 value — `scheduled`, `canceled`, `closed`. Tidak ada status lain.
2. **Booking status lifecycle**: `pending` → `paid` → `completed` (atau `canceled` kapan saja). Pending auto-cleanup oleh scheduler.
3. **Passenger status**: `active`, `unseated`, `canceled`. Penumpang `unseated` masih ada di booking tapi tidak punya kursi.
4. **Seat hold TTL**: Short (300s, saat pilih kursi) → Long (1800s, saat isi form) → Released (saat booking dibuat). Expired holds di-cleanup tiap 1 menit oleh scheduler.
5. **Pricing rule priority**: `leg` > `trip` > `time_of_day` > `pattern`. Scope paling spesifik menang. Trip tanpa price rule = disabled, tidak bisa dipesan.
6. **Commercial fee**: 3% dari gross revenue, 11% PPN, volume discount 0-15% berdasarkan total bulanan. Ini kontrak bisnis dengan operator.
7. **Close trip**: Jika ada penumpang aktif, WAJIB batch reschedule atau cancel dulu. Endpoint `close-with-reschedule` handle ini atomically.
8. **Waybill format**: `TRN-YYYYMMDD-XXXXX` (5 digit random, retry max 5x untuk uniqueness).
9. **SPJ workflow**: Draft → Issued → Settled. Cost lines punya estimasi (template) dan aktual (diisi saat settle).

### Aturan Keuangan
1. **Mata uang**: Semua amount dalam IDR (Indonesian Rupiah), integer (tidak ada desimal).
2. **Payment methods**: cash, qr, ewallet, bank_transfer.
3. **Payment channels**: CSO (terminal), WEB, APP, OTA.
4. **Revenue = bookings.totalAmount** dimana status IN ('paid', 'completed').

---

## Common Pitfalls & Troubleshooting

### Database
- **`DATABASE_URL` Unicode issue**: Neon connection string dari UI kadang punya Unicode left-quote (U+2018). `db.ts` dan `drizzle.config.ts` sudah punya regex strip untuk ini (`replace(/[\u2018\u2019\u201C\u201D]/g, ...)`). Jika koneksi DB gagal, cek ini pertama.
- **Schema push**: Selalu gunakan `npm run db:push`. Jangan tulis SQL migration manual. Jika ada konflik, gunakan `npm run db:push --force`.
- **ID columns**: Semua tabel pakai UUID (`uuid("id").primaryKey().default(sql\`gen_random_uuid()\`)`). JANGAN pernah ganti tipe ID column.

### Replit Environment
- **Port**: Aplikasi jalan di port 5000. Replit proxy ke public URL via `$REPLIT_DEV_DOMAIN`.
- **Vite plugin**: `@replit/vite-plugin-*` otomatis di-skip jika `REPL_ID` tidak ada. Saat deploy ke VPS, plugin ini diabaikan.
- **Host config**: Vite dev server harus allow semua host (`server.allowedHosts: true` di `vite.config.ts`) agar bisa diakses via Replit proxy.

### Frontend
- **React Query key convention**: Gunakan URL path sebagai query key, misal `['/api/trips']`. Saat invalidate, gunakan key yang sama: `queryClient.invalidateQueries({ queryKey: ['/api/trips'] })`.
- **apiRequest helper**: Semua API call harus via `apiRequest(method, url, data)` dari `lib/queryClient.ts` — sudah handle error parsing, response formatting, dan auth header.
- **Form dialog pattern**: Gunakan `MasterFormDialog` untuk CRUD master data — sudah terintegrasi dengan React Hook Form + Zod + shadcn.

### Backend
- **Fastify 5 vs Express**: Tidak perlu `asyncHandler` wrapper. Fastify native async. Return value dari handler otomatis di-serialize ke JSON.
- **preHandler vs middleware**: Fastify tidak punya Express middleware. Gunakan `preHandler` hooks array di route config.
- **Request body parsing**: Fastify auto-parse JSON body. Untuk webhook (butuh raw body), gunakan `contentTypeParser` custom di `index.ts`.
- **WebSocket rooms**: Setelah mutasi yang mempengaruhi trip (booking, unseat, hold, release), HARUS emit event ke room `trip:{tripId}` agar SeatMap di-refresh.

---

## Recent Changes (Kronologis)

| Tanggal | Perubahan |
|---------|-----------|
| 2026-03-23 | **Security Audit & Hardening** — 10 vulnerabilities fixed: rate limiting, CORS, response redaction, seed protection, per-report permission flags, webhook HMAC, Zod validation |
| 2026-03-23 | **Data Integrity — Snapshot System** — Snapshot columns di trips & bookings, COALESCE queries di laporan, impact check endpoints, backfill script |
| 2026-03-23 | **Batch Reschedule on Trip Close** — Permission flags, active-passengers endpoint, close-with-reschedule endpoint, BatchRescheduleDialog UI |
| 2026-03-23 | **Commercial Fee Report** — Laporan ke-8, standalone ReportsRepository, 3% gross + 11% PPN + volume discount |
| 2026-03-22 | **Hybrid Refactor Complete** — Schema split (13 files), repository pattern (6 repos), route decentralization, frontend component split |
| 2026-03-22 | **Express → Fastify 5 Migration** — 104+ endpoints, preHandler arrays, type augmentations |
| 2026-03-22 | **RBAC Admin UI** — Staff management + feature flag matrix |
| 2026-03-21 | **Realmio Auth + RBAC + Unseat/Reschedule + Deep-Link + SPJ + Promo + Pricing Enforcement** |
| 2026-03-19 | **Manifest + Cargo Terminal + CSO Booking Redesign** |

---

## Dokumentasi Teknis

| File | Topik |
|------|-------|
| `README.md` | Overview proyek, arsitektur, API endpoints, panduan fitur baru |
| `docs/FEATURES.md` | Dokumentasi fitur lengkap (19 bab), cara kerja, logika perhitungan |
| `docs/Commercial_Fee_Agreement.md` | Kontrak biaya komersial operator |
| `docs/PKS_Perjanjian_Kerja_Sama.md` | Perjanjian kerja sama operator |
| `plan/REFACTOR_PLAN.md` | Hybrid refactor plan (Pendekatan C) |
| `plan/CHECKLIST.md` | Progress checklist refactor (Phase 1-9, semua complete) |
| `plan/PERFORMANCE_REVIEW.md` | N+1 queries, missing indexes, cache headers, bundle review |
| `plan/pricing-enforcement.md` | Pricing enforcement design |
| `plan/reports-plan.md` | Reports module phases (Prioritas 1-4) |
| `plan/manifest-spj-biaya-perjalanan.md` | Manifest + SPJ + biaya design |
| `plan/rbac-abac-design.md` | RBAC/ABAC architecture + flag matrix (33+ flags, 7 roles) |
| `plan/panduan-operasional.md` | Panduan operasional CSO |
| `plan/audit-report.md` | Audit & quality report (bugs, UI inconsistencies, saran) |

---

## Frequently Asked Questions (untuk Agent)

**Q: Dimana query SQL untuk laporan?**
A: Semua di `server/repositories/reports.repository.ts`. Service layer (`reports.service.ts`) hanya business logic (commercial fee calculation, formatting). JANGAN tulis SQL baru di service.

**Q: Bagaimana cara tambah permission flag baru?**
A: 1) Tambah di `rbac.seed.ts` (default flags + matrix), 2) Gunakan `requireFlag('flag.id')` di route, 3) Gunakan `usePermissions().can('flag.id')` di frontend, 4) Jalankan `/api/seed/rbac` untuk apply.

**Q: Kenapa data laporan berbeda dari data master?**
A: Laporan menggunakan snapshot columns. Jika data master diubah setelah booking/trip dibuat, laporan tetap menampilkan data saat transaksi. Ini by design.

**Q: Bagaimana menambah laporan baru?**
A: 1) Tambah query di `reports.repository.ts`, 2) Tambah method di `reports.service.ts`, 3) Tambah endpoint di `reports.routes.ts` dengan `requireFlag('report.xxx')`, 4) Tambah flag di `rbac.seed.ts`, 5) Buat frontend page di `client/src/pages/reports/`, 6) Register lazy route di `App.tsx`, 7) Tambah sidebar entry.

**Q: Bagaimana cara kerja virtual trip?**
A: Trip Base (template) + eligible date = Virtual Trip (computed, belum di DB). Saat CSO booking → materialize → Real Trip (UUID, ada di DB, punya stop times + legs + seat inventory). Proses materialisasi ada di `tripBases.service.ts`.

**Q: Bagaimana seat inventory bekerja?**
A: Pre-computed per seat per leg. 1 trip dengan 3 stops = 2 legs. Jika penumpang naik di stop A turun di stop C, maka leg 1 (A→B) dan leg 2 (B→C) ditandai booked untuk kursi itu. Hold TTL-based — short saat pilih, long saat isi form.

**Q: Kenapa booking bisa "pending"?**
A: CSO memilih kursi → hold → isi form → create booking (status: pending) → bayar → paid. Jika CSO abandon (tutup browser), scheduler akan auto-release pending bookings yang sudah expired (`PENDING_BOOKING_AUTO_RELEASE=true`).

**Q: Dimana semua WebSocket events dikirim?**
A: Cari `wsService.emit` atau `broadcast` di codebase. Utamanya di: `holds.service.ts` (hold/release), `bookings.service.ts` (booking created), `unseat.service.ts` (unseat/reschedule), `tripBases.service.ts` (materialize/close).
