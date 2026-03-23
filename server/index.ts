import Fastify from "fastify";
import { ZodError } from "zod";
import rateLimit from "@fastify/rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./scheduler";
import { existsSync } from "fs";
import { join, resolve } from "path";

const app = Fastify({
  logger: false,
});

app.decorateRequest('user', undefined);
app.decorateRequest('rbac', undefined);
app.decorateRequest('scopedOutletId', undefined);
app.decorateRequest('outletId', undefined);
app.decorateRequest('appUser', undefined);
app.decorateRequest('rawBody', undefined);

app.register(rateLimit, {
  global: false,
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

    if (payload && typeof payload === 'string') {
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
  await registerRoutes(app);

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
  webSocketService.initialize(app.server);

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
