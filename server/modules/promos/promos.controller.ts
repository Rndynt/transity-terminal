import { Request, Response } from "express";
import { PromosService } from "./promos.service";
import { IStorage } from "../../routes";
import { insertPromotionSchema } from "@shared/schema";
import { z } from "zod";

export class PromosController {
  private service: PromosService;

  constructor(storage: IStorage) {
    this.service = new PromosService(storage);
  }

  async getPromotions(req: Request, res: Response) {
    const promos = await this.service.getAllPromotions();
    res.json(promos);
  }

  async getPromotionById(req: Request, res: Response) {
    const promo = await this.service.getPromotionById(req.params.id);
    res.json(promo);
  }

  async createPromotion(req: Request, res: Response) {
    const data = insertPromotionSchema.parse(req.body);
    const promo = await this.service.createPromotion(data);
    res.status(201).json(promo);
  }

  async updatePromotion(req: Request, res: Response) {
    const data = insertPromotionSchema.partial().parse(req.body);
    const promo = await this.service.updatePromotion(req.params.id, data);
    res.json(promo);
  }

  async deletePromotion(req: Request, res: Response) {
    await this.service.deletePromotion(req.params.id);
    res.status(204).send();
  }

  async getVouchers(req: Request, res: Response) {
    const promoId = req.query.promoId as string | undefined;
    const vouchers = await this.service.getVouchers(promoId);
    res.json(vouchers);
  }

  async generateVouchers(req: Request, res: Response) {
    const schema = z.object({
      promoId: z.string().uuid(),
      count: z.number().min(1).max(100),
      prefix: z.string().optional(),
      assignedTo: z.string().optional()
    });
    const data = schema.parse(req.body);
    const vouchers = await this.service.generateVouchers(data.promoId, data.count, data.prefix, data.assignedTo);
    res.status(201).json(vouchers);
  }

  async revokeVoucher(req: Request, res: Response) {
    const voucher = await this.service.revokeVoucher(req.params.id);
    res.json(voucher);
  }

  async deleteVoucher(req: Request, res: Response) {
    await this.service.deleteVoucher(req.params.id);
    res.status(204).send();
  }

  async validatePromoCode(req: Request, res: Response) {
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
    res.json(result);
  }
}
