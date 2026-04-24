import { IStorage } from "@server/storage.interface";
import { InsertTripPattern, TripPattern } from "@shared/schema";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09 (Sprint 2): mutasi trip pattern memanggil
 * `requirePermission(ctx, 'master.trip_patterns')` agar guard berjalan
 * meskipun service dipanggil dari modul internal. Lihat
 * `server/modules/rbac/README.md`.
 */
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

  async createTripPattern(data: InsertTripPattern, ctx: ServiceContext): Promise<TripPattern> {
    requirePermission(ctx, "master.trip_patterns");
    return await this.storage.createTripPattern(data);
  }

  async updateTripPattern(id: string, data: Partial<InsertTripPattern>, ctx: ServiceContext): Promise<TripPattern> {
    requirePermission(ctx, "master.trip_patterns");
    await this.getTripPatternById(id);
    return await this.storage.updateTripPattern(id, data);
  }

  async deleteTripPattern(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, "master.trip_patterns");
    await this.getTripPatternById(id);
    await this.storage.deleteTripPattern(id);
  }

  async getPatternStops(patternId: string) {
    return await this.storage.getPatternStops(patternId);
  }

  async getActiveTripsForPattern(patternId: string): Promise<number> {
    return await this.storage.getActiveTripsForPattern(patternId);
  }

  async getActiveBookingCountForPattern(patternId: string): Promise<number> {
    return await this.storage.getActiveBookingCountForPattern(patternId);
  }
}
