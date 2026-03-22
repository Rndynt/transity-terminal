import { IStorage } from "../../storage.interface";
import { InsertStop, Stop } from "@shared/schema";

export class StopsService {
  constructor(private storage: IStorage) {}

  async getAllStops(): Promise<Stop[]> {
    return await this.storage.getStops();
  }

  async getStopById(id: string): Promise<Stop> {
    const stop = await this.storage.getStopById(id);
    if (!stop) {
      throw new Error(`Stop with id ${id} not found`);
    }
    return stop;
  }

  async createStop(data: InsertStop): Promise<Stop> {
    return await this.storage.createStop(data);
  }

  async updateStop(id: string, data: Partial<InsertStop>): Promise<Stop> {
    await this.getStopById(id); // Check if exists
    return await this.storage.updateStop(id, data);
  }

  async deleteStop(id: string): Promise<void> {
    await this.getStopById(id); // Check if exists
    await this.storage.deleteStop(id);
  }
}
