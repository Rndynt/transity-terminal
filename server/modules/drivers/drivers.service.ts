import { IStorage } from "@server/storage.interface";
import { Driver, InsertDriver } from "@shared/schema";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09: setiap method mutasi memanggil `requirePermission(ctx, ...)`
 * supaya pemeriksaan izin tetap berjalan walaupun service dipanggil
 * langsung dari modul internal (bukan via HTTP route). Lihat
 * `server/modules/rbac/README.md` untuk detail pola.
 */
export class DriversService {
  constructor(private storage: IStorage) {}

  async getAllDrivers(): Promise<Driver[]> {
    return await this.storage.getDrivers();
  }

  async getDriverById(id: string): Promise<Driver> {
    const driver = await this.storage.getDriverById(id);
    if (!driver) throw new Error(`Driver with id ${id} not found`);
    return driver;
  }

  async createDriver(data: InsertDriver, ctx: ServiceContext): Promise<Driver> {
    requirePermission(ctx, "master.drivers");
    return await this.storage.createDriver(data);
  }

  async updateDriver(id: string, data: Partial<InsertDriver>, ctx: ServiceContext): Promise<Driver> {
    requirePermission(ctx, "master.drivers");
    await this.getDriverById(id);
    return await this.storage.updateDriver(id, data);
  }

  async deleteDriver(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, "master.drivers");
    await this.getDriverById(id);
    await this.storage.deleteDriver(id);
  }
}
