import type { FastifyInstance } from "fastify";
import { PromosController } from "./promos.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@server/modules/rbac/rbac.middleware";

export function registerPromosRoutes(app: FastifyInstance, storage: IStorage) {
  const promosController = new PromosController(storage);

  app.get('/api/promotions', async (req, reply) => promosController.getPromotions(req, reply));
  app.get('/api/promotions/:id', async (req, reply) => promosController.getPromotionById(req, reply));
  app.post('/api/promotions', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.createPromotion(req, reply));
  app.patch('/api/promotions/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.updatePromotion(req, reply));
  app.delete('/api/promotions/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.deletePromotion(req, reply));
  app.get('/api/vouchers', async (req, reply) => promosController.getVouchers(req, reply));
  app.post('/api/vouchers/generate', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.generateVouchers(req, reply));
  app.patch('/api/vouchers/:id/revoke', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.revokeVoucher(req, reply));
  app.delete('/api/vouchers/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.deleteVoucher(req, reply));
  app.post('/api/promos/validate', async (req, reply) => promosController.validatePromoCode(req, reply));
}
