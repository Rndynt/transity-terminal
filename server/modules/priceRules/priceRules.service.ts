import { IStorage } from "@server/storage.interface";
import { InsertPriceRule, PriceRule } from "@shared/schema";

export class PriceRulesService {
  constructor(private storage: IStorage) {}

  async getAllPriceRules(): Promise<PriceRule[]> {
    return await this.storage.getPriceRules();
  }

  async createPriceRule(data: InsertPriceRule): Promise<PriceRule> {
    return await this.storage.createPriceRule(data);
  }

  async updatePriceRule(id: string, data: Partial<InsertPriceRule>): Promise<PriceRule> {
    return await this.storage.updatePriceRule(id, data);
  }

  async deletePriceRule(id: string): Promise<void> {
    await this.storage.deletePriceRule(id);
  }
}
