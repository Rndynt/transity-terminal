import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { storage } from "./storage";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { requireAuth } from "./modules/auth/realmio";
import { requireFlag } from "./modules/rbac/rbac.middleware";

import { registerDriversRoutes } from "./modules/drivers/drivers.routes";
import { registerStopsRoutes } from "./modules/stops/stops.routes";
import { registerOutletsRoutes } from "./modules/outlets/outlets.routes";
import { registerVehiclesRoutes } from "./modules/vehicles/vehicles.routes";
import { registerLayoutsRoutes } from "./modules/layouts/layouts.routes";
import { registerTripPatternsRoutes } from "./modules/tripPatterns/tripPatterns.routes";
import { registerTripBasesRoutes } from "./modules/tripBases/tripBases.routes";
import { registerTripsRoutes } from "./modules/trips/trips.routes";
import { registerPriceRulesRoutes } from "./modules/priceRules/priceRules.routes";
import { registerBookingsRoutes } from "./modules/bookings/bookings.routes";
import { registerPaymentsRoutes } from "./modules/payments/payments.routes";
import { registerCargoRoutes } from "./modules/cargo/cargo.routes";
import { registerFinanceRoutes } from "./modules/finance/finance.routes";
import { registerPromosRoutes } from "./modules/promos/promos.routes";
import { registerSpjRoutes } from "./modules/spj/spj.routes";
import { registerReportsRoutes } from "./modules/reports/reports.routes";
import { registerAdminRoutes } from "./modules/rbac/rbac.admin.routes";
import { registerAppRoutes } from "./modules/app/app.routes";
import { registerSchedulerRoutes } from "./modules/scheduler/scheduler.routes";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { registerNotificationsRoutes } from "./modules/notifications/notifications.routes";
import { registerCashierRoutes } from "./modules/cashier/cashier.routes";
import { registerRefundsRoutes } from "./modules/refunds/refunds.routes";
import { registerMaintenanceRoutes } from "./modules/maintenance/maintenance.routes";
import { registerCustomersRoutes } from "./modules/customers/customers.routes";
import { registerSettingsRoutes } from "./modules/settings/settings.routes";
import { registerConsoleRoutes } from "./modules/console/console.routes";

const TERMINAL_SERVICE_KEY = process.env.TERMINAL_SERVICE_KEY || '';

export async function registerRoutes(app: FastifyInstance): Promise<FastifyInstance> {
  app.get('/api/health', async (req, reply) => {
    const incomingKey = req.headers['x-service-key'] as string | undefined;

    if (!TERMINAL_SERVICE_KEY) {
      // Development: service key belum dikonfigurasi — tetap lanjut dengan warning
      if (process.env.NODE_ENV === 'production') {
        return reply.code(503).send({ error: 'TERMINAL_SERVICE_KEY not configured' });
      }
      return reply.send({ status: 'ok', warning: 'TERMINAL_SERVICE_KEY not configured — development mode' });
    }

    if (!incomingKey) {
      return reply.code(401).send({ error: 'Missing X-Service-Key header', code: 'MISSING_SERVICE_KEY' });
    }

    if (incomingKey !== TERMINAL_SERVICE_KEY) {
      return reply.code(401).send({ error: 'Invalid service key', code: 'INVALID_SERVICE_KEY' });
    }

    reply.send({ status: 'ok' });
  });

  // S2-06: deep health check. Default `/api/health` tetap shallow (cuma
  // liveness, dipakai allowlist rate-limit). Dengan `?deep=1`, kita ping
  // engine `/api/v1/healthz` dan jalankan SELECT 1 ke DB. Hasilnya
  // structured per-subsystem dengan latency, supaya monitoring bisa
  // alarm pada subsystem yang spesifik.
  app.get('/api/health/deep', async (req, reply) => {
    const incomingKey = req.headers['x-service-key'] as string | undefined;
    if (TERMINAL_SERVICE_KEY) {
      if (!incomingKey) {
        return reply.code(401).send({ error: 'Missing X-Service-Key header', code: 'MISSING_SERVICE_KEY' });
      }
      if (incomingKey !== TERMINAL_SERVICE_KEY) {
        return reply.code(401).send({ error: 'Invalid service key', code: 'INVALID_SERVICE_KEY' });
      }
    }

    const checks: Record<string, { status: 'ok' | 'fail' | 'skip'; latencyMs?: number; detail?: string }> = {};

    // 1. Database — SELECT 1
    {
      const t0 = Date.now();
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        await db.execute(sql`SELECT 1`);
        checks.db = { status: 'ok', latencyMs: Date.now() - t0 };
      } catch (e) {
        checks.db = { status: 'fail', latencyMs: Date.now() - t0, detail: (e as Error).message };
      }
    }

    // 2. Engine — /api/v1/healthz (kalau engine diaktifkan).
    if (process.env.RESERVATION_ENGINE_ENABLED === 'true' && process.env.RESERVATION_ENGINE_URL) {
      const t0 = Date.now();
      try {
        const { engineClient } = await import('./modules/holds/engineClient');
        const res = await engineClient.health();
        checks.engine = {
          status: res?.status === 'ok' ? 'ok' : 'fail',
          latencyMs: Date.now() - t0,
          detail: res?.service ? `service=${res.service}` : undefined,
        };
      } catch (e) {
        checks.engine = { status: 'fail', latencyMs: Date.now() - t0, detail: (e as Error).message };
      }

      // S2-04: compensation queue backlog. dead_lettered > 0 = degraded
      // (butuh intervensi); near_cap > 0 = warning (engine flaky).
      const tCq = Date.now();
      try {
        const { getStuckCount } = await import('./modules/holds/compensationQueue');
        const stuck = await getStuckCount();
        checks.compensationQueue = {
          status: stuck.deadLettered > 0 ? 'fail' : 'ok',
          latencyMs: Date.now() - tCq,
          detail: `dlq=${stuck.deadLettered} nearCap=${stuck.nearCap}`,
        };
      } catch (e) {
        checks.compensationQueue = { status: 'fail', latencyMs: Date.now() - tCq, detail: (e as Error).message };
      }
    } else {
      checks.engine = { status: 'skip', detail: 'engine disabled' };
    }

    const overall = Object.values(checks).every(c => c.status !== 'fail') ? 'ok' : 'degraded';
    reply.code(overall === 'ok' ? 200 : 503).send({
      status: overall,
      checks,
      serverTime: new Date().toISOString(),
    });
  });

  // S2-05: clock health endpoint. Monitoring/ops bisa polling ini dan
  // membandingkan `serverTimeMs` dengan jam mereka untuk mendeteksi drift.
  // Jika drift > HMAC skew (60s), HMAC verify ke engine pasti gagal — ini
  // sumber bug paling sulit di-diagnosis di production. Endpoint ini
  // sengaja TIDAK butuh service key supaya monitoring eksternal mudah
  // pakai (cuma return waktu, bukan info sensitif).
  app.get('/api/health/clock', async (_req, reply) => {
    const now = new Date();
    reply.send({
      status: 'ok',
      serverTime: now.toISOString(),
      serverTimeMs: now.getTime(),
      uptimeSec: Math.floor(process.uptime()),
      hmacSkewSec: 60, // batas yang dikonfigurasi di engine
    });
  });

  registerAuthRoutes(app);
  registerConsoleRoutes(app, storage);

  app.addHook('preHandler', async (req, reply) => {
    if (
      req.url.startsWith("/api/auth/") ||
      req.url.startsWith("/api/app/") ||
      req.url.startsWith("/api/console/") ||
      !req.url.startsWith("/api")
    ) {
      return;
    }
    await requireAuth(req, reply);
  });

  app.get('/api/permissions/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const rbac = req.rbac;
    reply.send({
      flags: rbac ? [...rbac.flags] : [],
      role: rbac?.roleId ?? null,
      outletId: rbac?.outletId ?? null,
    });
  });

  const masterDataCache = {
    onSend: async (_req: FastifyRequest, reply: FastifyReply, payload: string) => {
      reply.header('Cache-Control', 'no-cache');
      return payload;
    }
  };

  registerDriversRoutes(app, storage, masterDataCache);
  registerStopsRoutes(app, storage, masterDataCache);
  registerOutletsRoutes(app, storage, masterDataCache);
  registerVehiclesRoutes(app, storage, masterDataCache);
  registerLayoutsRoutes(app, storage, masterDataCache);
  registerTripPatternsRoutes(app, storage, masterDataCache);
  registerTripBasesRoutes(app, storage);
  registerTripsRoutes(app, storage);
  await registerPriceRulesRoutes(app, storage);
  registerBookingsRoutes(app, storage);
  registerPaymentsRoutes(app, storage);
  registerCargoRoutes(app, storage);
  registerFinanceRoutes(app, storage);
  registerPromosRoutes(app, storage);
  registerSpjRoutes(app);
  registerReportsRoutes(app);
  registerAdminRoutes(app);
  registerSchedulerRoutes(app, storage);
  registerDashboardRoutes(app);
  registerNotificationsRoutes(app);
  registerCashierRoutes(app);
  registerRefundsRoutes(app);
  registerMaintenanceRoutes(app);
  registerCustomersRoutes(app);
  registerSettingsRoutes(app);

  app.post('/api/seed', { preHandler: [requireFlag('admin.flags.manage')] }, async (req: any, reply: any) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({ error: 'Seed disabled in production' });
    }
    const { seedData } = await import('./seed');
    await seedData();
    reply.send({ message: 'Seed data created successfully' });
  });

  app.post('/api/seed/rbac', { preHandler: [requireFlag('admin.flags.manage')] }, async (req: any, reply: any) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({ error: 'Seed disabled in production' });
    }
    const { seedRbac } = await import('./modules/rbac/rbac.seed');
    await seedRbac();
    reply.send({ message: 'RBAC seed completed successfully' });
  });

  registerAppRoutes(app, storage);

  return app;
}
