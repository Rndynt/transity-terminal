import type { FastifyRequest, FastifyReply } from "fastify";
import { PromosService } from "./promos.service";
import { IStorage } from "@server/storage.interface";
import { insertPromotionSchema, promoConditionInputSchema } from "@shared/schema";
import { z } from "zod";
import { buildServiceContext } from "@modules/rbac/rbac.guard";

export class PromosController {
  private service: PromosService;

  constructor(storage: IStorage) {
    this.service = new PromosService(storage);
  }

  async getPromotions(req: FastifyRequest, reply: FastifyReply) {
    const promos = await this.service.getAllPromotions();
    reply.send(promos);
  }

  async getPromotionById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const promo = await this.service.getPromotionById(id);
    reply.send(promo);
  }

  async createPromotion(req: FastifyRequest, reply: FastifyReply) {
    const data = insertPromotionSchema.parse(req.body);
    const promo = await this.service.createPromotion(data, buildServiceContext(req));
    reply.code(201).send(promo);
  }

  async updatePromotion(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const data = insertPromotionSchema.partial().parse(req.body);
    const promo = await this.service.updatePromotion(id, data, buildServiceContext(req));
    reply.send(promo);
  }

  async deletePromotion(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.service.deletePromotion(id, buildServiceContext(req));
    reply.code(204).send();
  }

  async getPromoConditions(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const conditions = await this.service.getConditions(id);
    reply.send(conditions);
  }

  async replacePromoConditions(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const conditions = z.array(promoConditionInputSchema).parse(req.body);
    const result = await this.service.replaceConditions(id, conditions, buildServiceContext(req));
    reply.send(result);
  }

  async listScopedPromotions(req: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      channel: z.string().optional(),
      tripId: z.string().optional(),
      patternId: z.string().optional(),
      outletId: z.string().optional(),
      salesChannelCode: z.string().optional(),
      departureDate: z.string().optional(),
      subtotal: z.coerce.number().nonnegative().optional(),
      includeRequireVoucher: z.coerce.boolean().optional(),
      onlyEligible: z.coerce.boolean().optional(),
    });
    const q = schema.parse(req.query);
    const list = await this.service.listScopedPromotions(
      {
        channel: q.channel,
        tripId: q.tripId,
        patternId: q.patternId,
        outletId: q.outletId,
        salesChannelCode: q.salesChannelCode,
        departureDate: q.departureDate,
      },
      { subtotal: q.subtotal, includeRequireVoucher: q.includeRequireVoucher }
    );
    const filtered = q.onlyEligible ? list.filter(x => x.eligible) : list;
    reply.send(filtered);
  }

  async autoApplyPromo(req: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      subtotal: z.number().nonnegative(),
      channel: z.string().optional(),
      tripId: z.string().optional(),
      patternId: z.string().optional(),
      outletId: z.string().optional(),
      salesChannelCode: z.string().optional(),
      departureDate: z.string().optional(),
    });
    const ctx = schema.parse(req.body);
    const best = await this.service.findBestAutoApplicablePromo(ctx.subtotal, ctx);
    reply.send(best);
  }

  async getVouchers(req: FastifyRequest, reply: FastifyReply) {
    const { promoId } = req.query as { promoId?: string };
    const vouchers = await this.service.getVouchers(promoId);
    reply.send(vouchers);
  }

  async generateVouchers(req: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      promoId: z.string().uuid(),
      count: z.number().min(1).max(100),
      prefix: z.string().optional(),
      assignedTo: z.string().optional()
    });
    const data = schema.parse(req.body);
    const vouchers = await this.service.generateVouchers(data.promoId, data.count, data.prefix, data.assignedTo, buildServiceContext(req));
    reply.code(201).send(vouchers);
  }

  async revokeVoucher(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const voucher = await this.service.revokeVoucher(id, buildServiceContext(req));
    reply.send(voucher);
  }

  async deleteVoucher(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.service.deleteVoucher(id, buildServiceContext(req));
    reply.code(204).send();
  }

  async validatePromoCode(req: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      code: z.string().min(1),
      subtotal: z.number().min(0),
      channel: z.string().optional(),
      tripId: z.string().optional(),
      patternId: z.string().optional(),
      outletId: z.string().optional(),
      salesChannelCode: z.string().optional(),
      departureDate: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const result = await this.service.validateAndCalculateDiscount(
      data.code, data.subtotal, {
        channel: data.channel,
        tripId: data.tripId,
        patternId: data.patternId,
        outletId: data.outletId,
        salesChannelCode: data.salesChannelCode,
        departureDate: data.departureDate,
      }
    );
    reply.send(result);
  }
}
