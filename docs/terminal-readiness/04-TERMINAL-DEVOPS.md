# TransityTerminal — DevOps, Observability & Testing

---

## 1. Current State Assessment

| Aspek | Status | Bukti |
|---|---|---|
| CI/CD | ❌ Tidak ada | `.github/workflows/` kosong |
| Pre-commit hooks | ❌ Tidak ada | Tidak ada `.husky/`, `.lint-staged.config` |
| Linting gate | ⚠ Setup ada tapi tidak enforced | ESLint config? Verify |
| Type check gate | ⚠ Manual `npm run check` | Tidak run otomatis |
| Tests | ❌ 1 file (seed.test.ts) | Critical paths tidak tertest |
| Code coverage | ❌ Tidak diukur | |
| Sentry / Error tracking | ❌ Tidak ada | `Sentry` tidak ada di `package.json` |
| Structured logging | ⚠ Pino tersedia tapi pakai console.log | `server/index.ts` custom log helper |
| Metrics endpoint | ❌ Tidak ada `/metrics` | |
| Tracing | ❌ Tidak ada OTel | |
| Health check | ⚠ Basic `/api/health` | Tidak deep (DB, Redis, Realmio) |
| Backup automation | ⚠ Manual | Neon auto-backup ada tapi tidak documented |
| Runbook | ❌ Tidak ada | |
| Secret rotation procedure | ❌ Tidak ada | |
| Deploy procedure | ⚠ `deploy.sh` ada (basic Docker) | Tidak ada blue/green, no rollback |

---

## 2. CI/CD Pipeline (Recommended)

### 2.1. GitHub Actions Setup

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop, feat/*]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint . --ext .ts,.tsx --max-warnings 0
      - run: npx prettier --check "**/*.{ts,tsx,json,md}"

  unit-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: transity_test
        ports: [5432:5432]
        options: --health-cmd pg_isready
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- --coverage
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/transity_test
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
      redis:
        image: redis:7
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run db:push
        env: { DATABASE_URL: postgres://postgres:test@localhost:5432/postgres }
      - run: npm run test:integration

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --production --audit-level=high
      - uses: gitleaks/gitleaks-action@v2
      - uses: github/codeql-action/init@v3
        with: { languages: javascript }
      - uses: github/codeql-action/analyze@v3

  build:
    needs: [lint-and-typecheck, unit-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  docker-build:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }},ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 2.2. Pre-commit Hooks

**File**: `.husky/pre-commit`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

**File**: `.lintstagedrc.json`
```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

### 2.3. ESLint config (if missing)

**File**: `.eslintrc.cjs`
```js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    { files: ['client/**/*'], env: { browser: true } },
    { files: ['server/**/*'], env: { node: true } },
  ],
};
```

---

## 3. Testing Strategy

### 3.1. Unit Tests — Critical Paths Priority

**Tool**: Vitest (already compatible with Vite stack)

**Files to add** (target ~60% coverage P0):

```
server/modules/bookings/__tests__/
  bookings.service.test.ts          ← createBooking, idempotency, hold confirm
  reschedule.service.test.ts        ← release old → confirm new safety
  unseat.service.test.ts            ← compensation queue trigger
  
server/modules/holds/__tests__/
  atomicHold.service.test.ts        ← hold + release race
  holdsAdapter.test.ts              ← engine on/off dispatch
  compensationQueue.test.ts         ← retry, max attempts, FOR UPDATE SKIP LOCKED
  
server/modules/refunds/__tests__/
  refunds.service.test.ts           ← approve releases seat (after fix A1)
  
server/modules/cashier/__tests__/
  cashier.service.test.ts           ← multi-staff session (after fix A2)
  reconciliation.test.ts            ← cash count correctness
  
server/modules/promos/__tests__/
  promos.service.test.ts            ← validate, auto-apply, stacking
  conditions.test.ts                ← JSON conditions evaluation
  
server/modules/cargo/__tests__/
  cargo.service.test.ts             ← waybill generation, leg count
  
server/modules/payments/__tests__/
  payments.service.test.ts          ← webhook idempotency, HMAC
  
server/modules/spj/__tests__/
  spj.service.test.ts               ← profit calc, cost template
```

**Pattern example**:
```typescript
// bookings.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, cleanupTestDb, seedFixtures } from '@test/helpers';
import { BookingsService } from '../bookings.service';

describe('BookingsService.createBooking', () => {
  let service: BookingsService;
  beforeEach(async () => {
    await setupTestDb();
    await seedFixtures();
    service = new BookingsService(/* mocked deps */);
  });

  it('should create booking with idempotency_key', async () => {
    const idempotencyKey = crypto.randomUUID();
    const booking = await service.createBooking(payload, { idempotencyKey });
    expect(booking.id).toBeDefined();
    
    // Retry same key → returns same booking
    const retry = await service.createBooking(payload, { idempotencyKey });
    expect(retry.id).toEqual(booking.id);
  });

  it('should detect seat conflict between concurrent bookings', async () => {
    const promises = [
      service.createBooking(payload, { idempotencyKey: 'k1' }),
      service.createBooking(payload, { idempotencyKey: 'k2' }),
    ];
    const results = await Promise.allSettled(promises);
    const failed = results.filter(r => r.status === 'rejected');
    expect(failed.length).toEqual(1);
    expect(failed[0].reason.code).toEqual('SEAT_CONFLICT');
  });
});
```

### 3.2. Integration Tests

**Scope**: Real DB (test container or separate Postgres), API surface, WS events.

```typescript
// integration/booking-flow.test.ts
describe('Booking flow (e2e)', () => {
  it('full path: search → seatmap → hold → book → cancel', async () => {
    const search = await api.get('/api/app/trips/search?...');
    const seatmap = await api.get(`/api/app/trips/${tripId}/seatmap`);
    const hold = await api.post('/api/app/holds', { ...seats });
    const booking = await api.post('/api/app/bookings', { ...payload, holdRef: hold.ref });
    expect(booking.status).toBe('confirmed');
    
    const cancel = await api.post(`/api/app/bookings/${booking.id}/cancel`);
    expect(cancel.refundEligible).toBe(true);
    
    // Verify seat released (engine)
    const seatmapAfter = await api.get(`/api/app/trips/${tripId}/seatmap`);
    expect(seatmapAfter.seats.find(s => s.no === passengerSeat).status).toBe('available');
  });
});
```

### 3.3. Frontend Tests

**Tool**: Vitest + React Testing Library + Playwright (e2e)

**Priority pages**:
- `CsoPage` booking flow happy path + edge cases (no seats, payment fail)
- `RefundDetailsModal` approval workflow
- `CashierSessionPage` open/close
- `CargoCreatePage` shipment flow

### 3.4. Engine Tests
**Status**: ✅ Already exists `crates/engine-core/tests/parity.rs`
**Action**: Add to CI:
```yaml
engine-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions-rust-lang/setup-rust-toolchain@v1
    - run: cd engine && cargo test --workspace
    - run: cd engine && cargo clippy -- -D warnings
```

---

## 4. Observability Stack

### 4.1. Sentry — Error Tracking

```bash
npm install @sentry/node @sentry/react
```

**Server**:
```typescript
// server/index.ts (early)
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.GIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.postgresIntegration(),
  ],
  beforeSend(event) {
    // Redact sensitive data
    if (event.request?.cookies) delete event.request.cookies;
    return event;
  },
});

app.setErrorHandler((err, req, reply) => {
  Sentry.captureException(err, { extra: { url: req.url, method: req.method } });
  reply.status(500).send({ error: 'Internal Server Error' });
});
```

**Client**:
```typescript
// client/src/main.tsx
import * as Sentry from '@sentry/react';
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

### 4.2. Structured Logging — Pino

**Migration plan** (Pino sudah ada di package.json):

```typescript
// server/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['*.password', '*.token', '*.secret', 'req.headers.authorization', 'req.headers.cookie', 'body.password'],
    censor: '[REDACTED]',
  },
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
  } : undefined,
});

// In each module
import { logger } from '@/lib/logger';
const log = logger.child({ module: 'bookings' });
log.info({ bookingId, outletId }, 'booking created');
```

**Replace** `console.log` calls gradually (jangan one-shot).

### 4.3. Metrics — Prometheus

```bash
npm install prom-client
```

```typescript
// server/lib/metrics.ts
import client from 'prom-client';

client.collectDefaultMetrics();

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
});

export const compensationQueueDepth = new client.Gauge({
  name: 'engine_compensation_queue_depth',
  help: 'Number of pending compensation operations',
});

export const engineRequestsTotal = new client.Counter({
  name: 'engine_requests_total',
  help: 'Total requests to reservation engine',
  labelNames: ['op', 'status'],
});

// Endpoint
app.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', client.register.contentType);
  return client.register.metrics();
});

// Hook into request lifecycle
app.addHook('onResponse', (req, reply, done) => {
  httpRequestDuration
    .labels(req.method, req.routeOptions.url || req.url, String(reply.statusCode))
    .observe(reply.elapsedTime / 1000);
  done();
});
```

**Scheduler hook**:
```typescript
// scheduler.ts in compensation queue runner
const depth = await db.execute(sql`SELECT count(*) FROM engine_compensation_queue WHERE attempts < 50`);
compensationQueueDepth.set(depth.rows[0].count);
```

### 4.4. Tracing — OpenTelemetry (Phase 2)

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

```typescript
// server/lib/tracing.ts (load before app)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'transity-terminal',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
```

Backend: Grafana Tempo, Jaeger, atau Honeycomb.

### 4.5. Health Check — Deep

**Replace basic `/api/health`**:

```typescript
// server/routes.ts
app.get('/api/health', async (req, reply) => {
  const checks = await Promise.allSettled([
    db.execute(sql`SELECT 1`).then(() => ({ db: 'ok' })),
    redis ? redis.ping().then(() => ({ redis: 'ok' })) : Promise.resolve({ redis: 'na' }),
    fetch(process.env.REALMIO_BASE_URL + '/healthz', { signal: AbortSignal.timeout(2000) })
      .then(r => ({ realmio: r.ok ? 'ok' : 'fail' })),
    process.env.RESERVATION_ENGINE_ENABLED === 'true'
      ? engineClient.healthz().then(() => ({ engine: 'ok' })).catch(() => ({ engine: 'fail' }))
      : Promise.resolve({ engine: 'disabled' }),
  ]);
  
  const result = Object.assign({}, ...checks.map(c => c.status === 'fulfilled' ? c.value : { error: 'check failed' }));
  const ok = !Object.values(result).some(v => v === 'fail');
  reply.status(ok ? 200 : 503).send({ status: ok ? 'ok' : 'degraded', ...result, ts: new Date().toISOString() });
});

app.get('/api/health/live', (req, reply) => reply.send({ ok: true })); // For k8s liveness
app.get('/api/health/ready', async (req, reply) => { /* same as /health */ });
```

### 4.6. Dashboards — Grafana

**Panels mandatory**:
1. Request rate by endpoint
2. p50/p95/p99 latency by endpoint
3. Error rate (5xx) per route
4. DB pool utilization
5. Compensation queue depth + age of oldest
6. Engine request success rate
7. Active WS connections
8. Memory & CPU per instance

---

## 5. Deployment Strategy

### 5.1. Current state
- `Dockerfile` ada, multi-stage
- `docker-compose.yml` basic
- `deploy.sh` script bash sederhana
- `deploy/engine/` overlay untuk sidecar

### 5.2. Recommended: Blue/Green atau Rolling

**Option A — Docker Compose blue/green** (simple, untuk operator kecil-menengah):

```bash
# deploy.sh enhanced
#!/usr/bin/env bash
set -euo pipefail

CURRENT=$(docker compose ps -q app | head -1)
NEW_TAG="${GIT_SHA:-latest}"

# Pull new image
docker compose pull app:${NEW_TAG}

# Start "green" alongside "blue"
docker compose -f docker-compose.yml -f docker-compose.green.yml up -d app-green

# Health check on green
for i in {1..30}; do
  if curl -fsS http://localhost:3001/api/health > /dev/null; then
    echo "Green healthy"
    break
  fi
  sleep 2
done

# Switch traffic (nginx upstream)
sed -i 's/server app:3000/server app-green:3000/' /etc/nginx/conf.d/transity.conf
nginx -s reload

# Stop blue
docker compose stop app
docker compose rm -f app
```

**Option B — Kubernetes** (untuk multi-operator scale).

### 5.3. Rollback procedure

```bash
# rollback.sh
docker compose pull app:${PREVIOUS_TAG}
docker compose up -d app
# DB rollback: NEVER auto. Use forward-fix migrations only.
```

### 5.4. Database migration safety

**Saat ini**: Auto-run on boot via `runSchemaMigrations()`.

**Risk**: Kalau migration fail, app stuck di startup loop.

**Recommendation**:
1. **Detach migrations dari boot**:
   ```typescript
   // server/index.ts
   if (process.env.RUN_MIGRATIONS_ON_BOOT === 'true') {
     await runSchemaMigrations();
   }
   ```
2. **Pre-deploy step di deploy.sh**:
   ```bash
   docker compose run --rm app npm run db:migrate
   if [ $? -ne 0 ]; then echo "Migration failed, abort deploy"; exit 1; fi
   ```
3. **Backward-compatible migrations** (always): add nullable column dulu, populate, then add NOT NULL in next deploy.

### 5.5. Engine deployment

**Per-operator**: 
- TT + engine container di Docker network sama
- Shared Postgres
- Toggle `RESERVATION_ENGINE_ENABLED` di TT `.env`
- Engine deploy via `deploy/engine/docker-compose.engine.yml` overlay

**Activation runbook**:
```bash
# 1. Deploy engine container (idle)
cd deploy/engine && docker compose up -d engine

# 2. Verify engine healthy
curl http://engine:8000/api/v1/healthz

# 3. Update TT .env
echo "RESERVATION_ENGINE_ENABLED=true" >> .env

# 4. Restart TT (graceful)
docker compose restart app

# 5. Smoke test
bash scripts/engine-smoke-test.sh

# 6. Monitor metrics for 24h before declaring stable
```

---

## 6. Backup & DR

### 6.1. Database
- **Neon**: Auto-backup + branching available — verify retention setting (recommended: 7 days)
- **Self-hosted Postgres**: pgBackRest atau pg_dump nightly + WAL archiving

### 6.2. Engine state
- Engine memory (idempotency cache) **ephemeral** — no backup needed
- All durable state di shared Postgres → covered by DB backup

### 6.3. RTO/RPO targets
| Tier | RTO | RPO | Strategy |
|---|---|---|---|
| Production | 4 jam | 15 menit | Hot standby DB, deploy script ready |
| Staging | 1 hari | 1 jam | Daily backup |

### 6.4. Disaster scenarios documented
- DB corruption / accidental DROP TABLE
- VPS host hardware failure
- Engine container crash loop
- Realmio outage (auth dependency)
- Payment provider outage
- Full region outage

---

## 7. Secret Management

### 7.1. Current
- `.env` files at runtime (gitignored)
- Replit Secrets for development

### 7.2. Production recommended
- **HashiCorp Vault** atau **Doppler** atau **AWS Secrets Manager**
- Or minimum: Encrypted `.env` di server, decrypt on startup with KMS
- **Never** commit `.env` to git (verify `.gitignore`)
- **Rotation policy**: 90 hari semua secret kritis (JWT_SECRET, REALMIO_SHARED_SECRET, RESERVATION_ENGINE_HMAC_SECRET, TERMINAL_SERVICE_KEY)

### 7.3. Rotation runbook (per secret)

**JWT_SECRET**:
```
1. Generate new: openssl rand -base64 64
2. Add to env as JWT_SECRET_NEXT
3. Code: verify with both current + next (allow grace period 24h)
4. Promote NEXT → current after grace period
5. All users force re-login
```

**RESERVATION_ENGINE_HMAC_SECRET**:
```
1. Generate new
2. Set on engine first as HMAC_SECRET_NEXT (engine accepts both)
3. Update TT to use new
4. Verify all signed
5. Remove old from engine
```

---

## 8. Cost Optimization

### 8.1. Database
- Neon scale-to-zero off-hours (kalau staging/dev)
- Connection pooling (PgBouncer) untuk reduce active connection cost

### 8.2. PDF generation
- Hindari Puppeteer di critical path; queue async

### 8.3. Object storage (jika dipakai untuk upload)
- Lifecycle policies: archive ke S3 Glacier setelah 90 hari

---

## 9. Sprint DevOps Plan

### Week 1 — Foundations
- [ ] Setup `.github/workflows/ci.yml` (lint, typecheck, basic tests)
- [ ] Add `.husky/pre-commit` + lint-staged
- [ ] Sentry server + client integration
- [ ] Migrate `console.log` → `pino` (top 10 critical files)
- [ ] Implement `/metrics` Prometheus endpoint

### Week 2 — Tests
- [ ] Setup Vitest + test DB harness
- [ ] Write 20 unit tests for: bookings, refunds (post-fix), cashier (post-fix), holds, promos
- [ ] Write 5 integration tests: full booking, cancel, refund, OTA flow, cargo
- [ ] Add coverage gate to CI (target 50% as start)

### Week 3 — Deploy & Observability
- [ ] Detach migrations from boot
- [ ] Blue/green deploy script + nginx upstream
- [ ] Grafana dashboard setup (10 panels)
- [ ] Engine activation runbook
- [ ] Incident runbooks (5 scenarios)

### Week 4 — Polish
- [ ] OpenTelemetry tracing
- [ ] Chaos test: kill engine container, verify compensation queue drains
- [ ] Backup restore drill (full DB restore from snapshot)
- [ ] Penetration test (eksternal vendor atau OWASP ZAP basic scan)
- [ ] Load test (k6 booking flow)
