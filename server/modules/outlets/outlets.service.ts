import { IStorage } from "@server/storage.interface";
import { InsertOutlet, Outlet } from "@shared/schema";

export class OutletsService {
  constructor(private storage: IStorage) {}

  async getAllOutlets(): Promise<Outlet[]> {
    return await this.storage.getOutlets();
  }

  async getOutletById(id: string): Promise<Outlet> {
    const outlet = await this.storage.getOutletById(id);
    if (!outlet) {
      throw new Error(`Outlet with id ${id} not found`);
    }
    return outlet;
  }

  async createOutlet(data: InsertOutlet): Promise<Outlet> {
    return await this.storage.createOutlet(data);
  }

  async updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet> {
    await this.getOutletById(id);
    return await this.storage.updateOutlet(id, data);
  }

  async deleteOutlet(id: string): Promise<void> {
    await this.getOutletById(id);
    await this.storage.deleteOutlet(id);
  }
}
