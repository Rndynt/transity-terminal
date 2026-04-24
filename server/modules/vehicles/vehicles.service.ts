import { IStorage } from "@server/storage.interface";
import { InsertVehicle, Vehicle } from "@shared/schema";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09: lihat `server/modules/rbac/README.md` untuk pola
 * `requirePermission(ctx, perm)`.
 */
export class VehiclesService {
  constructor(private storage: IStorage) {}

  async getAllVehicles(): Promise<Vehicle[]> {
    return await this.storage.getVehicles();
  }

  async getVehicleById(id: string): Promise<Vehicle> {
    const vehicle = await this.storage.getVehicleById(id);
    if (!vehicle) {
      throw new Error(`Vehicle with id ${id} not found`);
    }
    return vehicle;
  }

  async createVehicle(data: InsertVehicle, ctx: ServiceContext): Promise<Vehicle> {
    requirePermission(ctx, "master.vehicles");
    return await this.storage.createVehicle(data);
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>, ctx: ServiceContext): Promise<Vehicle> {
    requirePermission(ctx, "master.vehicles");
    await this.getVehicleById(id);
    return await this.storage.updateVehicle(id, data);
  }

  async deleteVehicle(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, "master.vehicles");
    await this.getVehicleById(id);
    await this.storage.deleteVehicle(id);
  }
}
