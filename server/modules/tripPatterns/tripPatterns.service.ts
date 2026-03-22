import { IStorage } from "../../storage.interface";
import { InsertTripPattern, TripPattern } from "@shared/schema";

export class TripPatternsService {
  constructor(private storage: IStorage) {}

  async getAllTripPatterns(): Promise<TripPattern[]> {
    return await this.storage.getTripPatterns();
  }

  async getTripPatternById(id: string): Promise<TripPattern> {
    const pattern = await this.storage.getTripPatternById(id);
    if (!pattern) {
      throw new Error(`Trip pattern with id ${id} not found`);
    }
    return pattern;
  }

  async createTripPattern(data: InsertTripPattern): Promise<TripPattern> {
    return await this.storage.createTripPattern(data);
  }

  async updateTripPattern(id: string, data: Partial<InsertTripPattern>): Promise<TripPattern> {
    await this.getTripPatternById(id);
    return await this.storage.updateTripPattern(id, data);
  }

  async deleteTripPattern(id: string): Promise<void> {
    await this.getTripPatternById(id);
    await this.storage.deleteTripPattern(id);
  }
}
