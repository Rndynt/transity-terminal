# TransityTerminal — Hybrid Refactor Plan (Pendekatan C)

## Tujuan
Restrukturisasi kode untuk meningkatkan **maintainability** dan **performa** secara seimbang,
tanpa mengubah arsitektur secara drastis atau memutus API contracts yang sudah berjalan.

---

## Masalah Saat Ini

| File | Baris | Masalah |
|------|-------|---------|
| `server/storage.ts` | 1.462 | God object — semua operasi DB 20+ tabel di satu class |
| `server/routes.ts` | 758 | Monolith — IStorage interface + semua route registrations |
| `shared/schema.ts` | 984 | Single file — semua tabel, enums, insert schemas, types |
| `server/modules/app/app.service.ts` | 1.014 | CSO trip fetching + pricing + seat logic campur jadi satu |
| `client/src/components/masters/TripBasesManager.tsx` | 1.143 | Form + table + dialogs + logic dalam satu file |
| `client/src/components/masters/TripsManager.tsx` | 992 | Form + table + schedule editor + logic dalam satu file |
| `client/src/pages/cso/CsoPage.tsx` | 848 | State management + booking flow + render semua di satu file |

---

## Phase 1: Backend — Pecah Schema (shared/schema.ts → shared/schema/)

**Sebelum:**
```
shared/schema.ts (984 baris — semua tabel)
```

**Sesudah:**
```
shared/schema/index.ts          — re-export semua
shared/schema/enums.ts          — semua pgEnum definitions
shared/schema/fleet.ts          — drivers, vehicles, layouts
shared/schema/network.ts        — stops, outlets
shared/schema/scheduling.ts     — tripPatterns, patternStops, tripBases, trips, tripStopTimes, tripLegs
shared/schema/inventory.ts      — seatInventory, seatHolds, priceRules
shared/schema/booking.ts        — bookings, passengers, payments, printJobs
shared/schema/cargo.ts          — cargoShipments, cargoTypes, cargoRates
shared/schema/finance.ts        — tripCostTemplates, tripCostItems
shared/schema/promo.ts          — promotions, vouchers
```

**Aturan:** Semua import yang sebelumnya `from "@shared/schema"` tetap bekerja karena `index.ts` re-export semua.

---

## Phase 2: Backend — Pecah IStorage + storage.ts

**Sebelum:**
```
server/routes.ts    — berisi IStorage interface (150+ methods) + route registrations
server/storage.ts   — 1 class DatabaseStorage implements semua
```

**Sesudah:**
Setiap module yang sudah punya service mendapat repository sendiri:
```
server/modules/drivers/drivers.repository.ts
server/modules/stops/stops.repository.ts
server/modules/outlets/outlets.repository.ts
server/modules/vehicles/vehicles.repository.ts
server/modules/layouts/layouts.repository.ts
server/modules/tripPatterns/tripPatterns.repository.ts
server/modules/patternStops/patternStops.repository.ts
server/modules/tripBases/tripBases.repository.ts
server/modules/trips/trips.repository.ts
server/modules/tripStopTimes/tripStopTimes.repository.ts
server/modules/tripLegs/tripLegs.repository.ts
server/modules/seatInventory/seatInventory.repository.ts
server/modules/priceRules/priceRules.repository.ts
server/modules/bookings/bookings.repository.ts
server/modules/payments/payments.repository.ts
server/modules/cargo/cargo.repository.ts
server/modules/promos/promos.repository.ts
server/modules/printing/print.repository.ts
server/modules/spj/spj.repository.ts         — manifest queries
```

- `IStorage` dipindah ke `server/storage.interface.ts`
- `storage.ts` tetap ada sebagai fasad: impor semua repository, delegasi ke masing-masing
- `routes.ts` menjadi murni route registration (interface types + ManifestEntry dipindah)

---

## Phase 3: Backend — Decentralize Route Registration

**Sebelum:** `routes.ts` mendaftarkan 80+ routes secara manual

**Sesudah:** Setiap controller mendaftarkan routes sendiri:
```typescript
// server/modules/drivers/drivers.controller.ts
export function registerDriverRoutes(app: FastifyInstance, opts: RouteOpts) {
  app.get('/api/drivers', { ...opts.cache }, (req, reply) => ...);
  app.post('/api/drivers', { preHandler: [opts.requireFlag('master.drivers')] }, ...);
  // ...
}
```

```typescript
// server/routes.ts (menjadi ~50 baris)
export async function registerRoutes(app: FastifyInstance) {
  registerAuthRoutes(app);
  app.addHook('preHandler', requireAuth);

  registerDriverRoutes(app, opts);
  registerStopRoutes(app, opts);
  // ... auto-register semua modules
}
```

---

## Phase 4: Frontend — Pecah Komponen Besar

### TripBasesManager.tsx (1.143 baris) →
```
components/masters/trip-bases/TripBasesManager.tsx     — orchestrator
components/masters/trip-bases/TripBasesTable.tsx        — DataTable render
components/masters/trip-bases/TripBaseForm.tsx           — form dialog
components/masters/trip-bases/TripScheduleSection.tsx    — schedule editor bagian
```

### TripsManager.tsx (992 baris) →
```
components/masters/trips/TripsManager.tsx       — orchestrator + filters
components/masters/trips/TripsTable.tsx          — DataTable render
components/masters/trips/TripForm.tsx            — create/edit form
components/masters/trips/TripDetailPanel.tsx     — stop times + legs detail
```

### CsoPage.tsx (848 baris) →
```
pages/cso/CsoPage.tsx              — orchestrator
pages/cso/useCsoState.ts           — state management hook
pages/cso/CsoTripPanel.tsx         — trip selection + seat section
pages/cso/CsoBookingPanel.tsx      — booking summary + payment
```

---

## Phase 5: Performance Optimization

1. **Frontend lazy loading** — sudah diterapkan di App.tsx ✓
2. **Bundle analysis** — identifikasi modul terbesar
3. **Backend query optimization:**
   - Review N+1 queries di getTrips/getCsoAvailableTrips
   - Index review untuk kolom yang sering di-filter (serviceDate, tripId, status)
4. **API response caching** — review cache headers untuk master data endpoints

---

## Aturan Pelaksanaan
1. Tidak ada breaking change pada API endpoints
2. Semua import `from "@shared/schema"` tetap bekerja (re-export dari index.ts)
3. `storage` singleton tetap tersedia di seluruh backend
4. Setiap phase di-test sebelum lanjut ke phase berikutnya
5. Urutan: Phase 1 → 2 → 3 → 4 → 5 (saling bergantung)
