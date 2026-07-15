import { db } from "@server/db";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from "@server/constants/pagination";
import {
  cargoShipments, cargoTypes, cargoRates, cargoRateExceptions, stops,
  type CargoShipment, type CargoShipmentListItem, type InsertCargoShipment,
  type CargoType, type InsertCargoType,
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
      await tx.delete(cargoRateExceptions).where(eq(cargoRateExceptions.cargoTypeId, id));
      await tx.update(cargoTypes).set({ deletedAt: now }).where(eq(cargoTypes.id, id));
    });
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
    // job, integration test) tidak bisa pull unbounded list.
    const limit = Math.min(Math.max(opts?.limit ?? LIST_DEFAULT_LIMIT, 1), LIST_MAX_LIMIT);
    const offset = Math.max(opts?.offset ?? 0, 0);

    const baseQuery = db
      .select({
        id: cargoShipments.id,
        waybillNumber: cargoShipments.waybillNumber,
        tripId: cargoShipments.tripId,
        originStopId: cargoShipments.originStopId,
        destinationStopId: cargoShipments.destinationStopId,
        outletId: cargoShipments.outletId,
        destinationOutletId: cargoShipments.destinationOutletId,
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
