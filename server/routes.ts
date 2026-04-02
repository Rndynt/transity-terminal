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

const TERMINAL_SERVICE_KEY = process.env.TERMINAL_SERVICE_KEY || '';

export async function registerRoutes(app: FastifyInstance): Promise<FastifyInstance> {
  app.get('/api/health', async (req, reply) => {
    const incomingKey = req.headers['x-service-key'] as string | undefined;
    if (incomingKey) {
      if (!TERMINAL_SERVICE_KEY) {
        return reply.code(401).send({ error: 'Service key not configured on this terminal' });
      }
      if (incomingKey !== TERMINAL_SERVICE_KEY) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }
    reply.send({ status: 'ok' });
  });

  registerAuthRoutes(app);

  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith("/api/auth/") || req.url.startsWith("/api/app/") || !req.url.startsWith("/api")) {
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
