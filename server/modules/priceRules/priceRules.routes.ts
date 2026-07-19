import type { FastifyInstance } from "fastify";
import { PriceRulesController } from "./priceRules.controller";
import { PricingController } from "./pricing.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export async function registerPriceRulesRoutes(app: FastifyInstance, storage: IStorage) {
  const c = new PriceRulesController(storage);
  const pricingController = new PricingController(storage);
  const write = { preHandler: [requireFlag('master.price_rules')] };

  // Fare quote (CSO quote-before-book preview)
  app.get('/api/pricing/quote-fare', async (req, reply) => pricingController.quoteFare(req, reply));

  // Read-only, used by CSO "Pilih Rute" (no admin flag needed — just booking UI)
  app.get('/api/pricing/priced-destinations', async (req, reply) => c.pricedDestinations(req, reply));

  // Exception-aware priced OD matrix for one trip (same authority as the App
  // API's pricedMatrix field) — read-only, used by CSO "Pilih Rute" OD-aware
  // Naik/Turun gating (no admin flag needed — just booking UI)
  app.get('/api/pricing/trip-matrix/:tripId', async (req, reply) => c.tripPricedMatrix(req, reply));

  // Master data — price rule grids (pattern/global tiers)
  app.get('/api/price-rules', async (req, reply) => c.listPriceRules(req, reply));
  app.get('/api/price-rules/global', async (req, reply) => c.getGlobalList(req, reply));
  app.get('/api/price-rules/pattern/:patternId', async (req, reply) => c.getPatternGrid(req, reply));
  app.put('/api/price-rules', write, async (req, reply) => c.savePriceRule(req, reply));
  app.patch('/api/price-rules/:id/active', write, async (req, reply) => c.setPriceRuleActive(req, reply));
  app.delete('/api/price-rules/:id', write, async (req, reply) => c.deletePriceRule(req, reply));

  // Seasonal templates (pattern-scoped)
  app.get('/api/price-rules/pattern/:patternId/seasonal', async (req, reply) => c.listSeasonalTemplates(req, reply));
  app.post('/api/price-rules/pattern/:patternId/seasonal', write, async (req, reply) => c.createSeasonalTemplate(req, reply));

  // Sync (read-time detection + manual button — no webhooks)
  app.get('/api/price-rules/pattern/:patternId/sync-status', async (req, reply) => c.getSyncStatus(req, reply));
  app.post('/api/price-rules/pattern/:patternId/sync', write, async (req, reply) => c.sync(req, reply));

  // Trip exceptions (per-trip, per-OD overrides)
  app.get('/api/pricing/trip-exceptions/:tripId', async (req, reply) => c.listTripExceptions(req, reply));
  app.put('/api/pricing/trip-exceptions', write, async (req, reply) => c.upsertTripException(req, reply));
  app.delete('/api/pricing/trip-exceptions/:id', write, async (req, reply) => c.deleteTripException(req, reply));
}
