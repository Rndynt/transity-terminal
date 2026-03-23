import { db } from "../db";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import {
  stops, outlets, patternStops, bookings, tripStopTimes, trips,
  type Stop, type InsertStop,
  type Outlet, type InsertOutlet
} from "@shared/schema";

export class NetworkRepository {
  async getStops(): Promise<Stop[]> {
    return await db.select().from(stops).where(isNull(stops.deletedAt)).orderBy(stops.name);
  }

  async getStopById(id: string): Promise<Stop | undefined> {
    const [stop] = await db.select().from(stops).where(eq(stops.id, id));
    return stop;
  }

  async getStopsByIds(ids: string[]): Promise<Stop[]> {
    if (ids.length === 0) return [];
    return await db.select().from(stops).where(inArray(stops.id, ids));
  }

  async createStop(data: InsertStop): Promise<Stop> {
    const [stop] = await db.insert(stops).values(data).returning();
    return stop;
  }

  async updateStop(id: string, data: Partial<InsertStop>): Promise<Stop> {
    const [stop] = await db.update(stops).set(data).where(eq(stops.id, id)).returning();
    return stop;
  }

  async deleteStop(id: string): Promise<void> {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(patternStops).set({ deletedAt: now }).where(eq(patternStops.stopId, id));
      await tx.update(outlets).set({ deletedAt: now }).where(eq(outlets.stopId, id));
      await tx.update(stops).set({ deletedAt: now }).where(eq(stops.id, id));
    });
  }

  async getOutlets(): Promise<Outlet[]> {
    return await db.select().from(outlets).where(isNull(outlets.deletedAt)).orderBy(outlets.name);
  }

  async getOutletById(id: string): Promise<Outlet | undefined> {
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, id));
    return outlet;
  }

  async getOutletsByIds(ids: string[]): Promise<Outlet[]> {
    if (ids.length === 0) return [];
    return await db.select().from(outlets).where(inArray(outlets.id, ids));
  }

  async createOutlet(data: InsertOutlet): Promise<Outlet> {
    const [outlet] = await db.insert(outlets).values(data).returning();
    return outlet;
  }

  async updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet> {
    const [outlet] = await db.update(outlets).set(data).where(eq(outlets.id, id)).returning();
    return outlet;
  }

  async deleteOutlet(id: string): Promise<void> {
    await db.update(outlets).set({ deletedAt: new Date() }).where(eq(outlets.id, id));
  }

  async getActiveBookingCountForStop(stopId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(
        sql`(${bookings.originStopId} = ${stopId} OR ${bookings.destinationStopId} = ${stopId})`,
        inArray(bookings.status, ['pending', 'paid', 'confirmed'])
      ));
    return result?.count || 0;
  }

  async getActiveTripsForStop(stopId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(distinct ${tripStopTimes.tripId})::int` })
      .from(tripStopTimes)
      .innerJoin(trips, eq(tripStopTimes.tripId, trips.id))
      .where(and(
        eq(tripStopTimes.stopId, stopId),
        eq(trips.status, 'scheduled'),
        isNull(trips.deletedAt),
        isNull(tripStopTimes.deletedAt)
      ));
    return result?.count || 0;
  }
}
