import { IStorage } from "../../storage.interface";
import { InsertLayout, Layout } from "@shared/schema";

export class LayoutsService {
  constructor(private storage: IStorage) {}

  async getAllLayouts(): Promise<Layout[]> {
    return await this.storage.getLayouts();
  }

  async getLayoutById(id: string): Promise<Layout> {
    const layout = await this.storage.getLayoutById(id);
    if (!layout) {
      throw new Error(`Layout with id ${id} not found`);
    }
    return layout;
  }

  async createLayout(data: InsertLayout): Promise<Layout> {
    return await this.storage.createLayout(data);
  }

  async updateLayout(id: string, data: Partial<InsertLayout>): Promise<Layout> {
    await this.getLayoutById(id);
    return await this.storage.updateLayout(id, data);
  }

  async deleteLayout(id: string): Promise<void> {
    await this.getLayoutById(id);
    await this.storage.deleteLayout(id);
  }
}
