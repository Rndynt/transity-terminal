import type { FastifyInstance } from "fastify";
import { PromosController } from "./promos.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export function registerPromosRoutes(app: FastifyInstance, storage: IStorage) {
  const promosController = new PromosController(storage);

  app.get('/api/promotions', async (req, reply) => promosController.getPromotions(req, reply));
  app.get('/api/promotions/:id', async (req, reply) => promosController.getPromotionById(req, reply));
  app.post('/api/promotions', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.createPromotion(req, reply));
  app.patch('/api/promotions/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.updatePromotion(req, reply));
  app.delete('/api/promotions/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.deletePromotion(req, reply));
  app.get('/api/promotions/:id/conditions', async (req, reply) => promosController.getPromoConditions(req, reply));
  app.put('/api/promotions/:id/conditions', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.replacePromoConditions(req, reply));
  app.get('/api/vouchers', async (req, reply) => promosController.getVouchers(req, reply));
  app.post('/api/vouchers/generate', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.generateVouchers(req, reply));
  app.patch('/api/vouchers/:id/revoke', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.revokeVoucher(req, reply));
  app.delete('/api/vouchers/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.deleteVoucher(req, reply));
  app.post('/api/promos/validate', async (req, reply) => promosController.validatePromoCode(req, reply));
  app.post('/api/promos/auto-apply', async (req, reply) => promosController.autoApplyPromo(req, reply));

  // Public scoped API — partner OTA / app frontend bisa fetch promo yg berlaku utk konteks-nya.
  app.get('/api/public/promotions', async (req, reply) => promosController.listScopedPromotions(req, reply));
  app.post('/api/public/promotions/validate', async (req, reply) => promosController.validatePromoCode(req, reply));
  app.post('/api/public/promotions/auto-apply', async (req, reply) => promosController.autoApplyPromo(req, reply));
}
