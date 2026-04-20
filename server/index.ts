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

import Fastify from "fastify";
import { ZodError } from "zod";
import rateLimit from "@fastify/rate-limit";
import { createRateLimitRedisClient } from "./realtime/redis";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./scheduler";
import { runMigrations } from "./migrate";
import { seedRbac } from "./modules/rbac/rbac.seed";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { runSchemaMigrations } from "./migrator";

const app = Fastify({
  logger: false,
  bodyLimit: 1024 * 1024,
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
app.register(rateLimit, {
  global: true,
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  allowList: (req) => req.url === '/api/health' || req.url === '/health',
  ...(_rateLimitRedis ? { redis: _rateLimitRedis, nameSpace: 'transity-rl:' } : {}),
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

app.addHook('onSend', async (request, reply, payload) => {
  const path = request.url;
  if (path.startsWith("/api")) {
    const duration = Math.round(reply.elapsedTime);
    let logLine = `${request.method} ${path} ${reply.statusCode} in ${duration}ms`;

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

app.setErrorHandler((err: Error & { status?: number; statusCode?: number; code?: string }, request, reply) => {
  if (err.code === '23505') {
    const detail: string = (err as any).detail ?? '';
    const valueMatch = detail.match(/Key \([^)]+\)=\(([^)]+)\)/);
    const fieldMatch = detail.match(/Key \(([^)]+)\)=/);
    const value = valueMatch ? valueMatch[1] : null;
    const field = fieldMatch ? fieldMatch[1] : 'data';
    const msg = value
      ? `Kode "${value}" sudah digunakan. Gunakan ${field} yang berbeda.`
      : `Nilai ${field} sudah digunakan. Gunakan nilai yang berbeda.`;
    return reply.code(409).send({ message: msg });
  }

  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return reply.code(400).send({ message: `Data tidak valid: ${messages}` });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  reply.code(status).send({ message });
  if (status === 500) {
    console.error(err);
  }
});

(async () => {
  // 1. Jalankan SQL migration files (membuat semua tabel dari nol di fresh DB,
  //    atau hanya migration baru jika DB sudah ada sebelumnya)
  await runSchemaMigrations();

  // 2. Safety-net ALTER TABLE (untuk kompatibilitas Realmio)
  await runMigrations();

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

  process.on('SIGTERM', () => {
    scheduler.stop();
    app.close();
  });

  process.on('SIGINT', () => {
    scheduler.stop();
    app.close().then(() => process.exit(0));
  });
})();
