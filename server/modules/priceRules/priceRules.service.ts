import { IStorage } from "@server/storage.interface";
import { InsertPriceRule, PriceRule } from "@shared/schema";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09 (Sprint 2): mutasi tarif memanggil
 * `requirePermission(ctx, 'master.price_rules')` agar service tetap
 * aman walaupun di-import langsung dari modul lain. Lihat
 * `server/modules/rbac/README.md`.
 */
export class PriceRulesService {
  constructor(private storage: IStorage) {}

  async getAllPriceRules(): Promise<PriceRule[]> {
    return await this.storage.getPriceRules();
  }

  async createPriceRule(data: InsertPriceRule, ctx: ServiceContext): Promise<PriceRule> {
    requirePermission(ctx, "master.price_rules");
    return await this.storage.createPriceRule(data);
  }

  async updatePriceRule(id: string, data: Partial<InsertPriceRule>, ctx: ServiceContext): Promise<PriceRule> {
    requirePermission(ctx, "master.price_rules");
    return await this.storage.updatePriceRule(id, data);
  }

  async deletePriceRule(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, "master.price_rules");
    await this.storage.deletePriceRule(id);
  }
}
