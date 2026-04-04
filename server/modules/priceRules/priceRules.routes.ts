import type { FastifyInstance } from "fastify";
import { PriceRulesController } from "./priceRules.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export async function registerPriceRulesRoutes(app: FastifyInstance, storage: IStorage) {
  const priceRulesController = new PriceRulesController(storage);
  const { PricingController } = await import('../pricing/pricing.controller');
  const pricingController = new PricingController(storage);

  app.get('/api/price-rules', async (req, reply) => priceRulesController.getAll(req, reply));
  app.post('/api/price-rules', { preHandler: [requireFlag('master.price_rules')] }, async (req, reply) => priceRulesController.create(req, reply));
  app.put('/api/price-rules/:id', { preHandler: [requireFlag('master.price_rules')] }, async (req, reply) => priceRulesController.update(req, reply));
  app.delete('/api/price-rules/:id', { preHandler: [requireFlag('master.price_rules')] }, async (req, reply) => priceRulesController.delete(req, reply));

  app.get('/api/pricing/quote-fare', async (req, reply) => pricingController.quoteFare(req, reply));
}
