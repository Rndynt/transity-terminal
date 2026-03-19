import { IStorage } from "../../routes";
import { Driver, InsertDriver } from "@shared/schema";

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

  async createDriver(data: InsertDriver): Promise<Driver> {
    return await this.storage.createDriver(data);
  }

  async updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver> {
    await this.getDriverById(id);
    return await this.storage.updateDriver(id, data);
  }

  async deleteDriver(id: string): Promise<void> {
    await this.getDriverById(id);
    await this.storage.deleteDriver(id);
  }
}
