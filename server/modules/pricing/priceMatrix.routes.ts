import type { FastifyInstance } from "fastify";
import { PriceMatrixController } from "./priceMatrix.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export async function registerPriceMatrixRoutes(app: FastifyInstance, storage: IStorage) {
  const c = new PriceMatrixController(storage);
  const write = { preHandler: [requireFlag('master.price_rules')] };

  // Read-only, used by CSO "Pilih Rute" (no admin flag needed — just booking UI)
  app.get('/api/pricing/priced-destinations', async (req, reply) => c.pricedDestinations(req, reply));

  // Master data — matrix grids
  app.get('/api/pricing/matrix', async (req, reply) => c.listMatrices(req, reply));
  app.get('/api/pricing/matrix/global', async (req, reply) => c.getGlobalList(req, reply));
  app.get('/api/pricing/matrix/pattern/:patternId', async (req, reply) => c.getPatternGrid(req, reply));
  app.put('/api/pricing/matrix', write, async (req, reply) => c.saveMatrix(req, reply));
  app.patch('/api/pricing/matrix/:id/active', write, async (req, reply) => c.setMatrixActive(req, reply));
  app.delete('/api/pricing/matrix/:id', write, async (req, reply) => c.deleteMatrix(req, reply));

  // Seasonal templates (pattern-scoped)
  app.get('/api/pricing/matrix/pattern/:patternId/seasonal', async (req, reply) => c.listSeasonalTemplates(req, reply));
  app.post('/api/pricing/matrix/pattern/:patternId/seasonal', write, async (req, reply) => c.createSeasonalTemplate(req, reply));

  // Sync (read-time detection + manual button, §8 — no webhooks)
  app.get('/api/pricing/matrix/pattern/:patternId/sync-status', async (req, reply) => c.getSyncStatus(req, reply));
  app.post('/api/pricing/matrix/pattern/:patternId/sync', write, async (req, reply) => c.sync(req, reply));

  // Trip exceptions (per-trip, per-OD overrides)
  app.get('/api/pricing/trip-exceptions/:tripId', async (req, reply) => c.listTripExceptions(req, reply));
  app.put('/api/pricing/trip-exceptions', write, async (req, reply) => c.upsertTripException(req, reply));
  app.delete('/api/pricing/trip-exceptions/:id', write, async (req, reply) => c.deleteTripException(req, reply));
}
