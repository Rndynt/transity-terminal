import { existsSync as _envExists, readFileSync as _envRead } from "fs";
import { resolve as _envResolve } from "path";
const _envPath = _envResolve(process.cwd(), ".env");
if (_envExists(_envPath)) {
  for (const raw of _envRead(_envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

// S3-03: Sentry harus diinit SEBELUM Fastify supaya boot-time
// unhandled errors ter-capture. No-op kalau SENTRY_DSN tidak diset.
import { initSentry, flushSentry } from "./observability/sentry";
import { registerGlobalErrorHandler } from "./errorHandler";
initSentry();

import Fastify from "fastify";
import { createHash } from "node:crypto";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { createRateLimitRedisClient } from "./realtime/redis";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./scheduler";
import { runMigrations } from "./migrate";
import { seedRbac } from "./modules/rbac/rbac.seed";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { runSchemaMigrations } from "./migrator";

// T-CON-05: aktifkan request-id propagation. Fastify auto-generate kalau
// header tidak ada; kalau ada (mis. dari Console / load balancer), pakai
// nilai yang masuk. Header response juga di-set lewat onSend hook di bawah
// supaya client bisa correlate request ↔ log entry.
const app = Fastify({
  logger: false,
  bodyLimit: 1024 * 1024,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'request_id',
});

const LOG_RESPONSE_BODIES =
  process.env.NODE_ENV !== "production" || process.env.LOG_BODIES === "true";

app.decorateRequest('user', undefined);
app.decorateRequest('rbac', undefined);
app.decorateRequest('scopedOutletId', undefined);
app.decorateRequest('outletId', undefined);
app.decorateRequest('appUser', undefined);
app.decorateRequest('rawBody', undefined);

// S2: kalau REDIS_URL diset, pakai Redis store supaya counter konsisten lintas instance.
// Tanpa Redis, fallback in-memory (per-instance) yang OK untuk single-instance deploy.
const _rateLimitRedis = createRateLimitRedisClient();
if (_rateLimitRedis) {
  console.log('[rate-limit] Redis store enabled (multi-instance safe)');
} else {
  console.log('[rate-limit] in-memory store (single-instance only)');
}
// T-CON-04: rate-limit aware service-key. Console / OTA aggregator polling
// hot-path (schedules, bookings, seatmap) dengan frekuensi tinggi via
// X-Service-Key. Kasih bucket terpisah dengan limit jauh lebih longgar
// (default 3000/min) supaya tidak bentrok dengan limit user IP biasa.
const _rateLimitMaxIp = parseInt(process.env.RATE_LIMIT_MAX || '300', 10);
const _rateLimitMaxService = parseInt(process.env.RATE_LIMIT_MAX_SERVICE || '3000', 10);
app.register(rateLimit, {
  global: true,
  max: (req) => {
    const incomingKey = req.headers['x-service-key'] as string | undefined;
    const expected = process.env.TERMINAL_SERVICE_KEY || '';
    if (expected && incomingKey && incomingKey === expected) {
      return _rateLimitMaxService;
    }
    return _rateLimitMaxIp;
  },
  keyGenerator: (req) => {
    const incomingKey = req.headers['x-service-key'] as string | undefined;
    const expected = process.env.TERMINAL_SERVICE_KEY || '';
    if (expected && incomingKey && incomingKey === expected) {
      // Bucket id = SHA256(key).slice(0,12) — non-reversible, tidak ada
      // material rahasia di Redis keyspace / metric label / log.
      const digest = createHash('sha256').update(incomingKey).digest('hex');
      return `service:${digest.slice(0, 12)}`;
    }
    return req.ip;
  },
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  allowList: (req) => req.url === '/api/health' || req.url === '/health',
  ...(_rateLimitRedis ? { redis: _rateLimitRedis, nameSpace: 'transity-rl:' } : {}),
});

// Security headers (helmet). CSP dimatikan supaya tidak konflik dengan Vite dev / inline.
app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// Unified CORS. Origin yang tidak ada di whitelist ditolak (kecuali same-origin / no Origin header).
const _corsOriginsRaw = (process.env.APP_CORS_ORIGINS || process.env.CORS_ORIGINS || '').trim();
const _corsAllowAll = _corsOriginsRaw === '*';
const _corsAllowList = _corsOriginsRaw && !_corsAllowAll
  ? _corsOriginsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
const _isProd = process.env.NODE_ENV === 'production';

if (_isProd && _corsAllowAll) {
  console.warn('[cors] APP_CORS_ORIGINS="*" di production — strongly discouraged. Set whitelist eksplisit.');
}
if (_isProd && !_corsAllowAll && _corsAllowList.length === 0) {
  console.warn('[cors] APP_CORS_ORIGINS / CORS_ORIGINS kosong di production. Cross-origin requests akan ditolak.');
}

app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin navigation / curl
    if (_corsAllowAll) return cb(null, true);
    if (_corsAllowList.includes(origin)) return cb(null, true);
    // Dev: izinkan semua origin supaya Vite HMR + same-origin fetch
    // (localhost:5000, *.replit.dev) tidak terblokir. Production tetap
    // strict — wajib via whitelist.
    if (!_isProd) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-access-token', 'X-Operator-Slug'],
  exposedHeaders: ['X-Total-Count'],
});

app.register(import("@fastify/middie"));

app.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (req, body, done) {
  try {
    const json = body.length > 0 ? JSON.parse(body.toString()) : undefined;
    (req as any).rawBody = body;
    done(null, json);
  } catch (err: any) {
    done(err, undefined);
  }
});

const SENSITIVE_PATHS = [
  '/api/app/auth/login', '/api/app/auth/register', '/api/app/payments/webhook',
  '/api/auth/sign-in/email', '/api/auth/sign-up/email', '/api/auth/sign-out',
  '/api/auth/session', '/api/auth/me',
  '/api/app/auth/me', '/api/app/profile',
  '/api/permissions/me',
];
const SENSITIVE_KEYS = new Set(['token', 'password', 'passwordHash', 'providerRef', 'authorization']);

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// S3-05 (post-review fix): wire HTTP metrics ke setiap response.
// onResponse jalan setelah reply terkirim, jadi durasi + status final
// sudah tersedia. Skip route /api/metrics sendiri supaya scrape
// Prometheus tidak self-amplify counter.
app.addHook('onResponse', async (request, reply) => {
  const url = request.url;
  if (!url.startsWith('/api') || url === '/api/metrics') return;
  try {
    const { recordHttpResponse } = await import('./observability/metrics');
    // Pakai route template ('/api/bookings/:id') supaya cardinality gauge
    // tidak meledak. Fastify v5 expose via request.routeOptions.url; v4
    // via request.routerPath. Fallback ke 'unknown' kalau belum match.
    const r = request as unknown as { routeOptions?: { url?: string }; routerPath?: string };
    const routeTpl = r.routeOptions?.url ?? r.routerPath ?? 'unknown';
    recordHttpResponse(request.method, reply.statusCode, routeTpl, Math.round(reply.elapsedTime));
  } catch {
    // metrics module gagal load — jangan ganggu request flow
  }
});

app.addHook('onSend', async (request, reply, payload) => {
  // T-CON-05: echo request-id ke response header. Header ditambah utk
  // SEMUA request (termasuk non-/api) supaya client mana pun bisa correlate
  // log entry tanpa harus tau path mana saja yang propagate.
  const reqId = request.id;
  if (reqId && !reply.getHeader('x-request-id')) {
    reply.header('x-request-id', String(reqId));
  }

  const path = request.url;
  if (path.startsWith("/api")) {
    const duration = Math.round(reply.elapsedTime);
    let logLine = `${request.method} ${path} ${reply.statusCode} in ${duration}ms`;
    if (reqId) {
      logLine += ` [${String(reqId).slice(0, 8)}]`;
    }

    if (LOG_RESPONSE_BODIES && payload && typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        if (!SENSITIVE_PATHS.includes(path)) {
          logLine += ` :: ${JSON.stringify(parsed)}`;
        } else {
          logLine += ` :: ${JSON.stringify(redactSensitive(parsed))}`;
        }
      } catch {}
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  }
  return payload;
});

// Global error handler — diekstrak ke `./errorHandler.ts` supaya
// production app dan test integrasi share kode yang sama.
registerGlobalErrorHandler(app);

function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const required: Array<[string, string]> = [
    ['JWT_SECRET', 'Secret untuk signing JWT. Generate: openssl rand -hex 32'],
    ['DATABASE_URL', 'Postgres connection string'],
  ];

  // Realmio integration wajib hanya jika BASE_URL diset (artinya integrasi aktif).
  // Kalau dua-duanya kosong, integrasi memang sengaja di-disable.
  const realmioBase = process.env.REALMIO_BASE_URL?.trim();
  const realmioKey = process.env.REALMIO_API_KEY?.trim();
  if (realmioBase || realmioKey) {
    required.push(['REALMIO_BASE_URL', 'URL Realmio API (kosongkan keduanya untuk disable integrasi)']);
    required.push(['REALMIO_API_KEY', 'API key Realmio (kosongkan keduanya untuk disable integrasi)']);
  }

  if (process.env.RESERVATION_ENGINE_ENABLED === 'true') {
    required.push(['RESERVATION_ENGINE_HMAC_SECRET', 'HMAC secret untuk reservation engine adapter']);
  }

  const missing = required.filter(([k]) => !process.env[k]?.trim()).map(([k, hint]) => `  - ${k}: ${hint}`);
  if (missing.length > 0) {
    console.error('\n[boot] FATAL — Missing required production env vars:\n' + missing.join('\n') + '\n');
    process.exit(1);
  }

  if (process.env.DEV_BYPASS_AUTH === 'true') {
    console.error('\n[boot] FATAL — DEV_BYPASS_AUTH=true dilarang di production.\n');
    process.exit(1);
  }

  if ((process.env.JWT_SECRET || '').length < 32) {
    console.error('\n[boot] FATAL — JWT_SECRET terlalu pendek (<32 chars). Gunakan: openssl rand -hex 32\n');
    process.exit(1);
  }

  console.log('[boot] Production env guard passed.');
}

(async () => {
  // 0. Production safety: pastikan env wajib ada, tolak DEV_BYPASS_AUTH.
  assertProductionEnv();

  // S3-08: migration boleh di-detach dari boot. Set RUN_MIGRATIONS_ON_BOOT=false
  // di production setelah deploy script (`scripts/db-migrate.ts`) jalankan
  // migrasi sebagai langkah terpisah sebelum app start. Default true untuk
  // backward-compat (dev + single-instance VPS).
  const runMigrationsOnBoot = process.env.RUN_MIGRATIONS_ON_BOOT !== 'false';
  if (runMigrationsOnBoot) {
    // 1. Jalankan SQL migration files (membuat semua tabel dari nol di fresh DB,
    //    atau hanya migration baru jika DB sudah ada sebelumnya)
    await runSchemaMigrations();

    // 2. Safety-net ALTER TABLE (untuk kompatibilitas Realmio)
    await runMigrations();
  } else {
    console.log('[boot] RUN_MIGRATIONS_ON_BOOT=false — skipping migrations. Run `pnpm tsx scripts/db-migrate.ts` separately before starting app.');
  }

  // 3. Seed roles, feature flags, dan staff dev
  await seedRbac();
  await registerRoutes(app);

  // S4: in single-instance deployment we serve mobile/dist directly. For
  // multi-instance (k8s, multi-node), bake apps/mobile/dist into the image
  // or push it to a CDN — every node must serve the SAME build to avoid
  // version skew on rolling deploys.
  const mobileDist = join(process.cwd(), "apps/mobile/dist");
  if (existsSync(mobileDist)) {
    await app.register(import("@fastify/static"), {
      root: mobileDist,
      prefix: "/mobile/",
      decorateReply: false,
    });
    app.get("/mobile/*", async (_req, reply) => {
      return reply.sendFile("index.html", mobileDist);
    });
    log("Mobile web app served at /mobile");
  }

  if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
    await setupVite(app, app.server);
  } else {
    await serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  await app.listen({
    port,
    host: "0.0.0.0",
  });

  const { webSocketService } = await import('./realtime/ws');
  await webSocketService.initialize(app.server);

  log(`serving on port ${port}`);

  scheduler.start();

  process.on('SIGTERM', async () => {
    scheduler.stop();
    await app.close();
    await flushSentry(2000);
  });

  process.on('SIGINT', async () => {
    scheduler.stop();
    await app.close();
    await flushSentry(2000);
    process.exit(0);
  });
})();
