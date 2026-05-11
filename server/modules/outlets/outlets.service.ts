import { IStorage } from "@server/storage.interface";
import { InsertOutlet, Outlet } from "@shared/schema";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09 (Sprint 2): setiap method mutasi memanggil
 * `requirePermission(ctx, 'master.outlets')` supaya pemeriksaan izin
 * tetap berjalan walaupun service dipanggil langsung dari modul internal
 * (bukan via HTTP route). Lihat `server/modules/rbac/README.md`.
 */
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

  async createOutlet(data: InsertOutlet, ctx: ServiceContext): Promise<Outlet> {
    requirePermission(ctx, "master.outlets");
    return await this.storage.createOutlet(data);
  }

  async updateOutlet(id: string, data: Partial<InsertOutlet>, ctx: ServiceContext): Promise<Outlet> {
    requirePermission(ctx, "master.outlets");
    await this.getOutletById(id);
    return await this.storage.updateOutlet(id, data);
  }

  async deleteOutlet(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, "master.outlets");
    await this.getOutletById(id);
    await this.storage.deleteOutlet(id);
  }
}
