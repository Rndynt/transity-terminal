# TransityTerminal — Performance & Scalability

**Status indikator**:
- ✅ Confirmed · ⚠ Suspected · 🟢 Already addressed · 🆕 New finding

---

## 1. Database Layer

### 1.1. ✅ Indexes — Sudah Solid
**Status**: 🟢 Already addressed (Sprint hardening April 2026, P1)

- 22 indexes baru ditambah pada hot tables
- Total: 76 indexes
- Hot paths covered: bookings, cargo, trips, app_users, customers, notifications, reviews, drivers, promotions

**Verification action**: Production load test untuk identify slow query yang missed:
```sql
-- After 1 week prod, run:
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 30;
```

### 1.2. 🟠 HIGH — Reports query berat (N sub-query JOIN)
**Status**: ✅ Confirmed
**File**: `server/repositories/reports.repository.ts:386` (sub-query agregasi `bk`, `cr`, `sc` di LEFT JOIN)

**Risk**: Query fan-out → di scale ratusan ribu bookings, query > 10s. Reports user-facing → timeout.

**Fix Strategy**:
1. **Materialized view** untuk daily aggregates:
   ```sql
   CREATE MATERIALIZED VIEW mv_daily_revenue AS
   SELECT
     DATE(b.created_at) as day,
     b.outlet_id,
     b.channel,
     b.sales_channel_code,
     SUM(b.total_amount) as revenue,
     COUNT(*) as booking_count
   FROM bookings b
   WHERE b.status IN ('confirmed', 'completed')
   GROUP BY 1, 2, 3, 4;
   
   CREATE UNIQUE INDEX idx_mv_daily_revenue ON mv_daily_revenue(day, outlet_id, channel, sales_channel_code);
   ```
   Refresh tiap 30 menit dengan `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

2. **Async aggregation** untuk reports complex: enqueue ke job queue (BullMQ + Redis), return job ID, frontend poll.

3. **Pagination wajib** untuk reports yang return rows banyak.

### 1.3. 🟠 HIGH — N+1 di `enrichTripsWithPromo`
**Status**: ✅ Confirmed
**File**: `server/modules/app/app.service.ts:~437`

**Risk**: 1 query per trip dalam search results. Search return 50 trips → 50 query promo. Latency 2-3s minimum.

**Fix**:
```typescript
async enrichTripsWithPromo(trips: Trip[], context: PromoContext): Promise<TripWithPromo[]> {
  const tripIds = trips.map(t => t.id);
  
  // Single query: get all auto-applicable promos for these trips
  const promosByTrip = await this.getApplicablePromosBatch(tripIds, context);
  // Returns Map<tripId, Promo[]>
  
  return trips.map(t => ({
    ...t,
    promos: promosByTrip.get(t.id) || [],
    bestPromo: this.pickBestPromo(promosByTrip.get(t.id) || []),
  }));
}

async getApplicablePromosBatch(tripIds: string[], context: PromoContext) {
  // 1 query joining trips + patterns + promotion_conditions
  // WHERE conditions match (trip_id IN ... OR pattern_id IN ... OR route IN ...)
  // GROUP BY trip_id
}
```

**Test**: assert 1 query for N trips (vs N queries before).

### 1.4. 🆕 MEDIUM — Pagination tidak konsisten
**Status**: ✅ Confirmed (some endpoints have `getPaginated`, many don't)

**Endpoints yang return all rows** (perlu pagination):
- `GET /api/stops` — bisa 10K rows untuk operator nasional
- `GET /api/vehicles` — 100-500 rows OK, tapi bisa scale
- `GET /api/drivers` — sama
- `GET /api/customers` — bisa 100K+ rows
- `GET /api/promotions` — biasanya < 100, OK
- `GET /api/trips` — sudah filter by date, tapi tidak paginated dalam date

**Fix**: Standardize helper:
```typescript
// server/utils/pagination.ts
export function paginate<T>(query: SelectQuery<T>, opts: { page: number; pageSize: number; max?: number }) {
  const pageSize = Math.min(opts.pageSize || 20, opts.max || 200);
  const offset = (opts.page - 1) * pageSize;
  return query.limit(pageSize).offset(offset);
}

// Usage in routes
const { page = 1, pageSize = 20 } = req.query;
const items = await paginate(query, { page, pageSize });
const total = await query.count();
return { items, page, pageSize, total };
```

Frontend: `useInfiniteQuery` untuk seamless scroll.

### 1.5. 🟡 MEDIUM — `pg.Pool` config production
**Status**: ✅ Confirmed default (pool max 10)
**File**: `server/db.ts`

**Recommendations**:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX || '20'),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Session-level
  options: '-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000',
});

// Monitor
pool.on('error', (err) => Sentry.captureException(err));
setInterval(() => {
  const poolStats = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
  metrics.gauge('pg_pool_total', poolStats.total);
  // ...
}, 10_000);
```

**SSL warning fix**: Set `DATABASE_URL` eksplisit `?sslmode=verify-full` (sesuai pg v9 deprecation warning).

---

## 2. Engine Performance

### 2.1. ✅ Solid — Atomic hold dengan deterministic lock order
**Status**: 🟢 Confirmed (engine code review)
**Detail**: `ORDER BY leg_index` cegah deadlock multi-leg

### 2.2. 🟢 Reaper task: efficient
**Status**: 🟢 Confirmed
**Detail**: `FOR UPDATE SKIP LOCKED LIMIT 500` — minimal contention dengan booking aktif

### 2.3. 🆕 MEDIUM — Engine inventory snapshot bisa cache
**Status**: ⚠ Currently not cached
**Action**: Kalau sering di-poll untuk monitoring/dashboard, cache 5s di engine memory atau Redis.

---

## 3. WebSocket Scaling

### 3.1. ✅ Redis adapter optional
**Status**: 🟢 Confirmed
**File**: `server/realtime/ws.ts:53-65`

**Current**: Single instance default, multi-instance kalau `REDIS_URL` set.

**Recommendation production**:
- **Wajib Redis** kalau pakai 2+ TT instances per operator
- Document di `DEPLOY_VPS_DOCKER.md`: "Untuk operator dengan high-availability target, tambahkan Redis container ke compose"

### 3.2. 🟡 MEDIUM — WS reconnection manual setTimeout
**Status**: ✅ Confirmed
**File**: `client/src/hooks/useWebSocket.ts:50` (`reconnection: false`)

**Risk**: Edge case network instability → state desync; client tidak tahu dia missed events.

**Fix**: Pakai socket.io built-in reconnection dengan custom config:
```typescript
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  reconnectionAttempts: Infinity,
  randomizationFactor: 0.5,
});

socket.on('reconnect', () => {
  // Re-subscribe to rooms
  rooms.forEach(r => socket.emit('subscribe', { room: r }));
  // Refresh data via TanStack Query invalidate
  queryClient.invalidateQueries();
});
```

---

## 4. PDF Generation (Puppeteer)

### 4.1. 🟠 HIGH — Puppeteer di server (kalau aktif)
**Status**: ✅ Confirmed (`puppeteer ^24.40.0` di package.json)

**Risk**: Setiap PDF launch Chromium ~500MB RAM, ~3-5s blocking. Kalau TT terima 10 cetak/menit, server overload.

**Audit Action**: Cek mana yang pakai Puppeteer:
```bash
grep -r "puppeteer\|launch\|page\.pdf" server/
```

**Fix Options**:
1. **Browser pool**: 1-2 long-lived Chromium reuse pages
   ```typescript
   import puppeteer from 'puppeteer';
   let browserInstance: Browser | null = null;
   async function getBrowser() {
     if (!browserInstance) browserInstance = await puppeteer.launch({ headless: true });
     return browserInstance;
   }
   // Always call .close() on page, never on browser
   ```
2. **Worker queue**: BullMQ + Redis, async PDF gen, polling result
3. **Client-side print**: `window.print()` untuk thermal ticket sederhana (sudah ada `PrintPreview.tsx`)
4. **External service**: Browserless.io, PDFShift untuk infrequent PDF

### 4.2. 🟡 MEDIUM — Puppeteer di client `dependencies`
**Status**: ✅ Confirmed
**File**: `package.json:83`

**Risk**: Kalau 1 import di client/ tidak di tree-shake, bundle naik 50MB+ (Chromium binary).

**Fix**:
- Move ke `devDependencies` kalau hanya dipakai di build/scripts
- Atau pakai `puppeteer-core` (tanpa Chromium) di server, install Chromium separate
- Verify bundle: `vite build && du -sh dist/`

---

## 5. Cache Strategy (Mostly Missing)

### 5.1. 🆕 MEDIUM — Tidak ada cache layer untuk static-ish data
**Status**: ✅ Confirmed (no Redis cache layer in code)

**Opportunities**:
- Cache `stops`, `outlets`, `layouts`, `cargo_types`, `cargo_rates` di Redis dengan TTL 5 menit
- Cache `trip_patterns` & `trip_bases` (jarang berubah dalam jam operasional) TTL 1 jam
- HTTP `Cache-Control: public, max-age=300` untuk public-facing read endpoints

**Pattern**:
```typescript
// server/utils/cache.ts
import Redis from 'ioredis';
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

export async function withCache<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  if (!redis) return fn();
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const fresh = await fn();
  await redis.setex(key, ttlSec, JSON.stringify(fresh));
  return fresh;
}

// Usage
const stops = await withCache('stops:all', 300, () => storage.stops.list());
```

**Cache invalidation**: On UPDATE/DELETE in admin module, `redis.del('stops:all')`.

---

## 6. Frontend Performance

### 6.1. 🟠 HIGH — DataTable tanpa virtualization
**Status**: ✅ Confirmed
**File**: `client/src/components/shared/DataTable.tsx:88`

**Risk**: 500+ rows → scroll lag, browser jank.

**Fix**: `@tanstack/react-virtual`:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function DataTable({ rows, ...props }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <RowComponent
            key={virtualRow.key}
            row={rows[virtualRow.index]}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          />
        ))}
      </div>
    </div>
  );
}
```

### 6.2. 🟡 MEDIUM — No code splitting / React.Suspense
**Status**: ✅ Confirmed
**File**: `client/src/main.tsx`, `client/src/App.tsx`

**Risk**: All 30 pages di-bundle in initial JS chunk → first paint slow.

**Fix**:
```tsx
import { lazy, Suspense } from 'react';

const CsoPage = lazy(() => import('./pages/CsoPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
// etc.

<Suspense fallback={<PageLoader />}>
  <Switch>
    <Route path="/cso" component={CsoPage} />
    <Route path="/reports" component={ReportsPage} />
  </Switch>
</Suspense>
```

Vite akan auto-split chunks per dynamic import.

### 6.3. 🟡 MEDIUM — `useEffect` dengan large dependency array
**Status**: ✅ Confirmed
**File**: `client/src/hooks/useBookingFlow.ts:356`

**Risk**: Re-run berlebihan, possible infinite loop.

**Fix**: Reduce deps via `useCallback` + `useMemo`, atau pisah `useEffect` jadi beberapa yang lebih granular.

### 6.4. 🟢 LOW — Currency input tanpa thousand separator
**Status**: ✅ Confirmed
**File**: `client/src/components/cso/PaymentPanel.tsx:190`

**Fix**: Pakai `react-imask` atau custom input formatter:
```tsx
<Input
  value={formatThousands(cashAmount)}
  onChange={(e) => setCashAmount(parseThousands(e.target.value))}
  inputMode="numeric"
/>
```

### 6.5. 🟢 LOW — DataTable z-index sticky header
**Status**: ✅ Confirmed
**Fix**: `z-20` (di atas Shadcn dialog/modal default `z-50`? Verify) atau pakai CSS variable `--z-sticky-table`.

---

## 7. Memory & Resource Management

### 7.1. 🟡 MEDIUM — Long-lived Node process: connection leak monitoring
**Action**:
- Add `process.on('uncaughtException')` & `unhandledRejection` handlers (kemungkinan sudah ada — verify)
- Memory metric export: `process.memoryUsage()` ke Prometheus
- Restart pada threshold (PM2 `--max-memory-restart 1024M` atau Docker `--memory-swap`)

### 7.2. 🟢 LOW — Open file descriptor (FD) leak risk
**Action**: Set `ulimit -n 65536` di Docker / systemd.

---

## 8. Load Test Plan

### 8.1. Sebelum production launch
**Tools**: k6, Artillery, atau autocannon

**Scenarios**:
```javascript
// k6 test: booking flow
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // ramp up
    { duration: '5m', target: 50 },   // sustain
    { duration: '2m', target: 100 },  // peak
    { duration: '3m', target: 100 },
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1500'],
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  // Search trips
  const searchRes = http.get(`${BASE_URL}/api/app/trips/search?...`);
  check(searchRes, { 'search 200': r => r.status === 200 });

  // Get seatmap
  const seatmapRes = http.get(`${BASE_URL}/api/app/trips/${tripId}/seatmap`);

  // Hold seat
  const holdRes = http.post(`${BASE_URL}/api/app/holds`, ...);

  // Create booking
  const bookRes = http.post(`${BASE_URL}/api/app/bookings`, ...,
    headers: { 'X-Idempotency-Key': uuid() });
}
```

**Metric targets**:
- 100 concurrent users searching → p95 < 1.5s
- 50 concurrent booking attempts → no double-booking, no 500 errors
- 10 RPS payment webhook → all processed idempotently
- 1000 WS connections → memory stable, broadcast latency < 200ms

### 8.2. Engine specific load test
**Tool**: built-in `loadtest` crate di engine repo

```bash
cd .local/ecosystem-analysis/TransityTerminal_ResvCoreEngine
cargo run -p loadtest -- --scenario hold-release --concurrency 100 --duration 60s
cargo run -p loadtest -- --scenario hold-confirm --concurrency 50 --duration 60s
```

**Targets**: p99 < 50ms, 0 conflict errors at 100 concurrent on 10-seat trip.

---

## 9. Quick Wins Summary (< 1 hari per item)

| # | Item | Estimasi | Impact |
|---|---|---|---|
| 1 | Fix `enrichTripsWithPromo` N+1 | 1 hari | Search latency 2s → <500ms |
| 2 | Pagination helper + apply 5 hot endpoints | 4 jam | Memory & latency stabil |
| 3 | `pg.Pool` production config | 30 menit | Connection exhaustion prevented |
| 4 | DB SSL mode eksplisit | 5 menit | Warning gone |
| 5 | DataTable virtualization | 4 jam | Browser smooth at 1000+ rows |
| 6 | Code splitting per route | 2 jam | First paint -50% |
| 7 | Puppeteer browser pool | 2 jam | PDF gen 5s → 200ms reuse |
| 8 | WS reconnection built-in | 1 jam | Connection resilience |
| 9 | Cache layer (Redis) untuk stops/outlets | 4 jam | Static data instant |
| 10 | Currency input thousand separator | 1 jam | UX cashier ↑ |

**Total quick wins**: ~3 hari pengerjaan untuk semua, gain signifikan.

---

## 10. Long-Term Scalability (Post Launch)

### 10.1. Database scaling
- **Read replica** untuk reports & analytics queries
- **Connection pooler** PgBouncer di depan Postgres (jika instance count tinggi)
- **Partitioning** `bookings`, `payments` by month untuk archival data

### 10.2. Multi-region
- Operator regional (Sumatera) → consider deploy TT terdekat
- Shared global PG cluster vs per-region (cost vs latency tradeoff)

### 10.3. Edge caching
- Cloudflare di depan public-facing endpoints (cargo tracking dengan token, operator info)

### 10.4. Engine scaling
- Engine sudah multi-instance ready (advisory lock reaper)
- Horizontal scale: tambah engine container, sama Postgres → linear throughput
