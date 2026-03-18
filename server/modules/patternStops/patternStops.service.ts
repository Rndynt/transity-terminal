import { IStorage } from "../../routes";
import { InsertPatternStop, PatternStop, Stop } from "@shared/schema";

export class PatternStopsService {
  constructor(private storage: IStorage) {}

  async getPatternStops(patternId: string): Promise<Array<PatternStop & { stop: Stop | null }>> {
    return await this.storage.getPatternStops(patternId);
  }

  async createPatternStop(data: InsertPatternStop): Promise<PatternStop> {
    return await this.storage.createPatternStop(data);
  }

  async updatePatternStop(id: string, data: Partial<InsertPatternStop>): Promise<PatternStop> {
    return await this.storage.updatePatternStop(id, data);
  }

  async deletePatternStop(id: string): Promise<void> {
    await this.storage.deletePatternStop(id);
  }

  async bulkReplacePatternStops(patternId: string, patternStops: InsertPatternStop[]): Promise<PatternStop[]> {
    return await this.storage.bulkReplacePatternStops(patternId, patternStops);
  }
}
