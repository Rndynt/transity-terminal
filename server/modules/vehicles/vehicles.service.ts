import { IStorage } from "../../storage.interface";
import { InsertVehicle, Vehicle } from "@shared/schema";

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

  async createVehicle(data: InsertVehicle): Promise<Vehicle> {
    return await this.storage.createVehicle(data);
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle> {
    await this.getVehicleById(id);
    return await this.storage.updateVehicle(id, data);
  }

  async deleteVehicle(id: string): Promise<void> {
    await this.getVehicleById(id);
    await this.storage.deleteVehicle(id);
  }
}
