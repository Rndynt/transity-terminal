# RBAC — Two-Layer Permission Model

Modul ini menyediakan dua lapis pemeriksaan izin (RBAC) untuk operator
TransityTerminal:

| Layer | File | Kapan dipakai |
|---|---|---|
| HTTP route | `rbac.middleware.ts` (`requireFlag`, `requireAnyFlag`, `requireOutletScope`) | Pre-handler Fastify pada route. First line of defense. |
| Service kelas | `rbac.guard.ts` (`requirePermission`, `requireAnyPermission`) | Dipanggil di awal method service. Jaring pengaman untuk caller internal yang tidak lewat route. |

## Kenapa butuh dua lapis?

Sebelum S1-09, izin hanya dicek di route handler. Akibatnya bila ada
modul lain memanggil service kelas langsung — misal job scheduler,
websocket handler, customer-app booking, atau test utility — pengecekan
izin terlewat dan staf bisa melakukan operasi yang seharusnya ditolak.

Dengan service-layer guard, *setiap* eksekusi method sensitif akan
divalidasi tanpa peduli siapa yang memanggil.

## Pola pemakaian

### 1. Di service kelas

```ts
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

export class DriversService {
  constructor(private storage: IStorage) {}

  async createDriver(data: InsertDriver, ctx: ServiceContext): Promise<Driver> {
    requirePermission(ctx, "master.drivers");
    return await this.storage.createDriver(data);
  }
}
```

`requirePermission` melempar `PermissionDeniedError` (HTTP 403) jika
`ctx.flags` tidak memuat permission yang diminta. Errornya ditangkap
oleh `app.setErrorHandler` di `server/index.ts` dan diteruskan ke klien
sebagai `403 { message: "Akses ditolak. Izin '<flag>' dibutuhkan." }`.

### 2. Di controller (HTTP)

```ts
import { buildServiceContext } from "@modules/rbac/rbac.guard";

async create(req: FastifyRequest, reply: FastifyReply) {
  const data = insertDriverSchema.parse(req.body);
  const driver = await this.service.createDriver(data, buildServiceContext(req));
  reply.code(201).send(driver);
}
```

`buildServiceContext(req)` mengubah `req.rbac` (yang sudah di-attach
oleh `requireAuth` di `auth/realmio.ts`) menjadi `ServiceContext`.

### 3. Caller internal yang bukan staf

Untuk caller yang sah tapi bukan staf RBAC (mis. customer-app booking
flow yang sudah punya app-auth sendiri, scheduler, seed/migration), pakai
`SYSTEM_CONTEXT` secara **eksplisit** supaya reviewer langsung sadar:

```ts
import { SYSTEM_CONTEXT } from "@modules/rbac/rbac.guard";

// Customer-app sudah lewat requireAppAuth di route. Cargo service di
// sini dipanggil atas nama customer, bukan staf, jadi pakai bypass
// yang eksplisit.
await cargoService.createShipment(data, SYSTEM_CONTEXT);
```

## Flag mapping (5 modul kritis)

| Service | Method | Flag |
|---|---|---|
| `DriversService` | create / update / delete | `master.drivers` |
| `VehiclesService` | create / update / delete | `master.vehicles` |
| `RefundsService` | getAll / getById | `page.refunds` |
| `RefundsService` | create | `action.refund.create` |
| `RefundsService` | approve / reject | `action.refund.approve` |
| `RefundsService` | process | `action.refund.process` |
| `CashierService` | semua method | `page.cashier` |
| `CargoService` | createShipment | `action.cargo.create` |
| `CargoService` | updateShipment / updateShipmentStatus | `action.cargo.manage` |

Read methods (drivers/vehicles/cargo getAll/getById) **belum** di-guard
karena route memang membolehkan dibaca tanpa flag tertentu.

## Test integrasi

Lihat `tests/sprint2-rbac-service-guards.test.ts` untuk bukti bahwa
memanggil setiap service tanpa ctx atau dengan flag yang tidak sesuai
selalu dilempar `PermissionDeniedError`.

```bash
npx vitest run tests/sprint2-rbac-service-guards.test.ts
```

## Cara menambah modul baru

1. Tambahkan `ctx: ServiceContext` sebagai argumen terakhir pada method
   service yang sensitif.
2. Panggil `requirePermission(ctx, '<flag>')` di awal method.
3. Update controller agar memanggil `buildServiceContext(req)`.
4. Tambah test di `tests/sprint2-rbac-service-guards.test.ts` untuk
   ketiga skenario (no ctx, ctx tanpa flag, ctx dengan flag).
5. Update bagian "Flag mapping" di file README ini.
