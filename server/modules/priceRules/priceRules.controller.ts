import type { FastifyRequest, FastifyReply } from "fastify";
import { PriceRulesService } from "./priceRules.service";
import { IStorage } from "@server/storage.interface";
import { insertPriceRuleSchema } from "@shared/schema";
import { buildServiceContext } from "@modules/rbac/rbac.guard";

export class PriceRulesController {
  private priceRulesService: PriceRulesService;

  constructor(storage: IStorage) {
    this.priceRulesService = new PriceRulesService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const rules = await this.priceRulesService.getAllPriceRules();
    reply.send(rules);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertPriceRuleSchema.parse(req.body);
    const rule = await this.priceRulesService.createPriceRule(validatedData, buildServiceContext(req));
    reply.code(201).send(rule);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const validatedData = insertPriceRuleSchema.partial().parse(req.body);
    const rule = await this.priceRulesService.updatePriceRule(id, validatedData, buildServiceContext(req));
    reply.send(rule);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.priceRulesService.deletePriceRule(id, buildServiceContext(req));
    reply.code(204).send();
  }
}
