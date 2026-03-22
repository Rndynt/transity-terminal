import type { FastifyRequest, FastifyReply } from "fastify";
import { PromosService } from "./promos.service";
import { IStorage } from "../../storage.interface";
import { insertPromotionSchema } from "@shared/schema";
import { z } from "zod";

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
    const promo = await this.service.getPromotionById(req.params.id);
    reply.send(promo);
  }

  async createPromotion(req: FastifyRequest, reply: FastifyReply) {
    const data = insertPromotionSchema.parse(req.body);
    const promo = await this.service.createPromotion(data);
    reply.code(201).send(promo);
  }

  async updatePromotion(req: FastifyRequest, reply: FastifyReply) {
    const data = insertPromotionSchema.partial().parse(req.body);
    const promo = await this.service.updatePromotion(req.params.id, data);
    reply.send(promo);
  }

  async deletePromotion(req: FastifyRequest, reply: FastifyReply) {
    await this.service.deletePromotion(req.params.id);
    reply.code(204).send();
  }

  async getVouchers(req: FastifyRequest, reply: FastifyReply) {
    const promoId = req.query.promoId as string | undefined;
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
    const vouchers = await this.service.generateVouchers(data.promoId, data.count, data.prefix, data.assignedTo);
    reply.code(201).send(vouchers);
  }

  async revokeVoucher(req: FastifyRequest, reply: FastifyReply) {
    const voucher = await this.service.revokeVoucher(req.params.id);
    reply.send(voucher);
  }

  async deleteVoucher(req: FastifyRequest, reply: FastifyReply) {
    await this.service.deleteVoucher(req.params.id);
    reply.code(204).send();
  }

  async validatePromoCode(req: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      code: z.string().min(1),
      subtotal: z.number().min(0),
      channel: z.string().optional(),
      tripId: z.string().optional(),
      patternId: z.string().optional()
    });
    const data = schema.parse(req.body);
    const result = await this.service.validateAndCalculateDiscount(
      data.code, data.subtotal, data.channel, data.tripId, data.patternId
    );
    reply.send(result);
  }
}
