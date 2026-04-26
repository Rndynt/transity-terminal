import { db } from "@server/db";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import {
  cargoShipments, cargoTypes, cargoRates, stops, trips,
  type CargoShipment, type CargoShipmentListItem, type InsertCargoShipment,
  type CargoType, type InsertCargoType,
  type CargoRate, type InsertCargoRate,
  type Trip
} from "@shared/schema";

export class CargoRepository {
  async getCargoTypes(): Promise<CargoType[]> {
    return await db.select().from(cargoTypes).where(isNull(cargoTypes.deletedAt)).orderBy(cargoTypes.name);
  }

  async getCargoTypeById(id: string): Promise<CargoType | undefined> {
    const [ct] = await db.select().from(cargoTypes).where(eq(cargoTypes.id, id));
    return ct;
  }

  async createCargoType(data: InsertCargoType): Promise<CargoType> {
    const [ct] = await db.insert(cargoTypes).values(data).returning();
    return ct;
  }

  async updateCargoType(id: string, data: Partial<InsertCargoType>): Promise<CargoType> {
    const [ct] = await db.update(cargoTypes).set(data).where(eq(cargoTypes.id, id)).returning();
    return ct;
  }

  async deleteCargoType(id: string): Promise<void> {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(cargoRates).where(eq(cargoRates.cargoTypeId, id));
      await tx.update(cargoTypes).set({ deletedAt: now }).where(eq(cargoTypes.id, id));
    });
  }

  async getCargoRates(cargoTypeId?: string): Promise<CargoRate[]> {
    if (cargoTypeId) {
      return await db.select().from(cargoRates).where(eq(cargoRates.cargoTypeId, cargoTypeId)).orderBy(desc(cargoRates.createdAt));
    }
    return await db.select().from(cargoRates).orderBy(desc(cargoRates.createdAt));
  }

  async getCargoRateById(id: string): Promise<CargoRate | undefined> {
    const [cr] = await db.select().from(cargoRates).where(eq(cargoRates.id, id));
    return cr;
  }

  async createCargoRate(data: InsertCargoRate): Promise<CargoRate> {
    const [cr] = await db.insert(cargoRates).values(data).returning();
    return cr;
  }

  async updateCargoRate(id: string, data: Partial<InsertCargoRate>): Promise<CargoRate> {
    const [cr] = await db.update(cargoRates).set(data).where(eq(cargoRates.id, id)).returning();
    return cr;
  }

  async deleteCargoRate(id: string): Promise<void> {
    await db.delete(cargoRates).where(eq(cargoRates.id, id));
  }

  async findCargoRate(cargoTypeId: string, originStopId: string, destinationStopId: string, tripId?: string, getTripById?: (id: string) => Promise<Trip | undefined>): Promise<CargoRate | undefined> {
    const findBestInScope = async (scope: 'global' | 'pattern' | 'trip', scopeRefId: string): Promise<CargoRate | undefined> => {
      const [routeSpecific] = await db.select().from(cargoRates).where(
        and(
          eq(cargoRates.cargoTypeId, cargoTypeId),
          eq(cargoRates.scope, scope),
          eq(cargoRates.scopeRefId, scopeRefId),
          eq(cargoRates.originStopId, originStopId),
          eq(cargoRates.destinationStopId, destinationStopId),
          eq(cargoRates.isActive, true)
        )
      );
      if (routeSpecific) return routeSpecific;

      const [scopeFallback] = await db.select().from(cargoRates).where(
        and(
          eq(cargoRates.cargoTypeId, cargoTypeId),
          eq(cargoRates.scope, scope),
          eq(cargoRates.scopeRefId, scopeRefId),
          isNull(cargoRates.originStopId),
          isNull(cargoRates.destinationStopId),
          eq(cargoRates.isActive, true)
        )
      );
      return scopeFallback;
    };

    if (tripId) {
      const tripRate = await findBestInScope('trip', tripId);
      if (tripRate) return tripRate;

      if (getTripById) {
        const trip = await getTripById(tripId);
        if (trip?.patternId) {
          const patternRate = await findBestInScope('pattern', trip.patternId);
          if (patternRate) return patternRate;
        }
      }
    }

    const [globalRouteSpecific] = await db.select().from(cargoRates).where(
      and(
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.scope, 'global'),
        eq(cargoRates.originStopId, originStopId),
        eq(cargoRates.destinationStopId, destinationStopId),
        eq(cargoRates.isActive, true)
      )
    );
    if (globalRouteSpecific) return globalRouteSpecific;

    const [globalFallback] = await db.select().from(cargoRates).where(
      and(
        eq(cargoRates.cargoTypeId, cargoTypeId),
        eq(cargoRates.scope, 'global'),
        isNull(cargoRates.originStopId),
        isNull(cargoRates.destinationStopId),
        eq(cargoRates.isActive, true)
      )
    );
    return globalFallback;
  }

  async getCargoShipments(
    filters?: { tripId?: string; status?: string; outletId?: string },
    opts?: { limit?: number; offset?: number }
  ): Promise<CargoShipmentListItem[]> {
    const originStop = db.select({ id: stops.id, code: stops.code, name: stops.name }).from(stops).as('origin_stop');
    const destStop = db.select({ id: stops.id, code: stops.code, name: stops.name }).from(stops).as('dest_stop');

    const conditions = [];
    if (filters?.tripId) conditions.push(eq(cargoShipments.tripId, filters.tripId));
    if (filters?.status) conditions.push(sql`${cargoShipments.status} = ${filters.status}`);
    if (filters?.outletId) conditions.push(eq(cargoShipments.outletId, filters.outletId));

    // β-2: enforce hard cap di repository supaya caller manapun (controller,
    // job, integration test) tidak bisa pull unbounded list. Default 200 dari
    // shared constant, hard cap 1000.
    const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 1000);
    const offset = Math.max(opts?.offset ?? 0, 0);

    const baseQuery = db
      .select({
        id: cargoShipments.id,
        waybillNumber: cargoShipments.waybillNumber,
        tripId: cargoShipments.tripId,
        originStopId: cargoShipments.originStopId,
        destinationStopId: cargoShipments.destinationStopId,
        outletId: cargoShipments.outletId,
        cargoTypeId: cargoShipments.cargoTypeId,
        senderName: cargoShipments.senderName,
        senderPhone: cargoShipments.senderPhone,
        recipientName: cargoShipments.recipientName,
        recipientPhone: cargoShipments.recipientPhone,
        itemDescription: cargoShipments.itemDescription,
        quantity: cargoShipments.quantity,
        weightKg: cargoShipments.weightKg,
        lengthCm: cargoShipments.lengthCm,
        widthCm: cargoShipments.widthCm,
        heightCm: cargoShipments.heightCm,
        declaredValue: cargoShipments.declaredValue,
        totalAmount: cargoShipments.totalAmount,
        status: cargoShipments.status,
        channel: cargoShipments.channel,
        paymentMethod: cargoShipments.paymentMethod,
        paidAt: cargoShipments.paidAt,
        notes: cargoShipments.notes,
        createdBy: cargoShipments.createdBy,
        createdAt: cargoShipments.createdAt,
        originStopCode: originStop.code,
        originStopName: originStop.name,
        destinationStopCode: destStop.code,
        destinationStopName: destStop.name
      })
      .from(cargoShipments)
      .leftJoin(originStop, eq(cargoShipments.originStopId, originStop.id))
      .leftJoin(destStop, eq(cargoShipments.destinationStopId, destStop.id));

    if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions)).orderBy(desc(cargoShipments.createdAt)).limit(limit).offset(offset);
    }
    return await baseQuery.orderBy(desc(cargoShipments.createdAt)).limit(limit).offset(offset);
  }

  async countCargoShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<number> {
    const conditions = [];
    if (filters?.tripId) conditions.push(eq(cargoShipments.tripId, filters.tripId));
    if (filters?.status) conditions.push(sql`${cargoShipments.status} = ${filters.status}`);
    if (filters?.outletId) conditions.push(eq(cargoShipments.outletId, filters.outletId));

    const query = db.select({ count: sql<number>`count(*)::int` }).from(cargoShipments);
    const [row] = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    return row?.count ?? 0;
  }

  async getCargoShipmentById(id: string): Promise<CargoShipment | undefined> {
    const [shipment] = await db.select().from(cargoShipments).where(eq(cargoShipments.id, id));
    return shipment;
  }

  async getCargoShipmentByWaybill(waybillNumber: string): Promise<CargoShipment | undefined> {
    const [shipment] = await db.select().from(cargoShipments).where(eq(cargoShipments.waybillNumber, waybillNumber));
    return shipment;
  }

  async createCargoShipment(data: InsertCargoShipment & { trackingSecret: string }): Promise<CargoShipment> {
    const [shipment] = await db.insert(cargoShipments).values(data).returning();
    return shipment;
  }

  async updateCargoShipment(id: string, data: Partial<InsertCargoShipment>): Promise<CargoShipment> {
    const [shipment] = await db.update(cargoShipments).set(data).where(eq(cargoShipments.id, id)).returning();
    return shipment;
  }
}
