import { IStorage } from "@server/storage.interface";
import { InsertCargoShipment, CargoShipment, CargoAvailableTrip, cargoStatusEnum, cargoShipments } from "@shared/schema";
import { db } from "@server/db";
import { sql, eq } from "drizzle-orm";

const VALID_STATUSES = cargoStatusEnum.enumValues;
type CargoStatus = typeof VALID_STATUSES[number];

const ALLOWED_TRANSITIONS: Record<CargoStatus, CargoStatus[]> = {
  pending: ['received', 'cancelled'],
  received: ['loaded', 'cancelled'],
  loaded: ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['delivered', 'returned'],
  delivered: [],
  returned: [],
  cancelled: []
};

export class CargoService {
  constructor(private storage: IStorage) {}

  generateWaybillNumber(): string {
    // Legacy random-based generator; kept for fallback only. The active path
    // uses generateWaybillFromSequence() (Q5) which is deterministic and
    // collision-free.
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = String(Math.floor(10000 + Math.random() * 90000));
    return `TRN-${datePart}-${randomPart}`;
  }

  // Q5: pull next id from a Postgres sequence. Format `WB-YYMMDD-{id:6d}`.
  // Sequence is created in migrator.ts so it's guaranteed to exist by the
  // time the first request comes in.
  async generateWaybillFromSequence(): Promise<string> {
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const result: any = await db.execute(sql`SELECT nextval('cargo_waybill_seq') AS id`);
    const id = String(result.rows?.[0]?.id ?? 0).padStart(6, '0');
    return `WB-${yy}${mm}${dd}-${id}`;
  }

  async countLegsBetweenStops(tripId: string, originStopId: string, destinationStopId: string): Promise<number> {
    const stopTimes = await this.storage.getTripStopTimes(tripId);
    if (!stopTimes || stopTimes.length === 0) return 1;

    const originSeq = stopTimes.find(st => st.stopId === originStopId)?.stopSequence;
    const destSeq = stopTimes.find(st => st.stopId === destinationStopId)?.stopSequence;

    if (originSeq === undefined || destSeq === undefined) return 1;
    const legCount = Math.abs(destSeq - originSeq);
    return Math.max(legCount, 1);
  }

  async calculateTariff(
    cargoTypeId: string,
    originStopId: string,
    destinationStopId: string,
    weightKg: number,
    tripId?: string
  ): Promise<{ pricePerKg: number; pricePerLeg: number; minCharge: number; legCount: number; calculatedAmount: number } | null> {
    const rate = await this.storage.findCargoRate(cargoTypeId, originStopId, destinationStopId, tripId);
    if (!rate) return null;

    const pricePerKg = parseFloat(rate.pricePerKg);
    const pricePerLeg = parseFloat(rate.pricePerLeg || '0');
    const minCharge = parseFloat(rate.minCharge);

    let legCount = 1;
    if (tripId) {
      legCount = await this.countLegsBetweenStops(tripId, originStopId, destinationStopId);
    }

    const weightCost = pricePerKg * weightKg;
    const legCost = pricePerLeg * legCount;
    const calculated = weightCost + legCost;
    const calculatedAmount = Math.max(calculated, minCharge);

    return { pricePerKg, pricePerLeg, minCharge, legCount, calculatedAmount };
  }

  async getAvailableTrips(serviceDate: string, originStopId: string, destinationStopId: string): Promise<CargoAvailableTrip[]> {
    return this.storage.getCargoAvailableTrips(serviceDate, originStopId, destinationStopId);
  }

  async getAllShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<CargoShipment[]> {
    return await this.storage.getCargoShipments(filters);
  }

  async getShipmentById(id: string): Promise<CargoShipment> {
    const shipment = await this.storage.getCargoShipmentById(id);
    if (!shipment) throw new Error(`Cargo shipment with id ${id} not found`);
    return shipment;
  }

  async getShipmentByWaybill(waybillNumber: string): Promise<CargoShipment> {
    const shipment = await this.storage.getCargoShipmentByWaybill(waybillNumber);
    if (!shipment) throw new Error(`Cargo shipment with waybill ${waybillNumber} not found`);
    return shipment;
  }

  async createShipment(data: Omit<InsertCargoShipment, 'waybillNumber'>): Promise<CargoShipment> {
    if (data.cargoTypeId && data.originStopId && data.destinationStopId && data.weightKg) {
      const weight = parseFloat(String(data.weightKg));
      if (weight > 0) {
        const tariff = await this.calculateTariff(
          data.cargoTypeId, data.originStopId, data.destinationStopId,
          weight, data.tripId || undefined
        );
        if (tariff) {
          data = { ...data, totalAmount: String(tariff.calculatedAmount) };
        }
      }
    }

    if (data.paymentMethod && !data.paidAt) {
      data = { ...data, paidAt: new Date() };
    }

    // Q5: deterministic waybill from a Postgres sequence — no retry loop, no
    // brittle string-match on constraint names. Fall back to the legacy
    // random generator only if the sequence call fails for some reason.
    let waybillNumber: string;
    try {
      waybillNumber = await this.generateWaybillFromSequence();
    } catch {
      waybillNumber = this.generateWaybillNumber();
    }
    return await this.storage.createCargoShipment({ ...data, waybillNumber });
  }

  async updateShipment(id: string, data: Partial<InsertCargoShipment>): Promise<CargoShipment> {
    // B4: lock + update in the SAME transaction. Using tx.update keeps the
    // write on the same connection that holds the row lock — calling the
    // global storage.updateCargoShipment would go through `db` (different
    // connection) and break the lock semantics.
    return await db.transaction(async (tx) => {
      const lockResult: any = await tx.execute(
        sql`SELECT id FROM cargo_shipments WHERE id = ${id} FOR UPDATE`
      );
      if (!lockResult.rows?.[0]) {
        throw new Error('Cargo shipment not found');
      }
      const [updated] = await tx.update(cargoShipments)
        .set(data)
        .where(eq(cargoShipments.id, id))
        .returning();
      return updated;
    });
  }

  async updateShipmentStatus(id: string, newStatus: string): Promise<CargoShipment> {
    if (!VALID_STATUSES.includes(newStatus as CargoStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Valid: ${VALID_STATUSES.join(', ')}`);
    }

    return await db.transaction(async (tx) => {
      const result: any = await tx.execute(
        sql`SELECT status FROM cargo_shipments WHERE id = ${id} FOR UPDATE`
      );
      const row = result.rows?.[0];
      if (!row) {
        throw new Error('Cargo shipment not found');
      }
      const currentStatus = (row.status || 'received') as CargoStatus;
      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(newStatus as CargoStatus)) {
        throw new Error(`Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`);
      }
      const updates: Partial<InsertCargoShipment> = {};
      const statusVal = newStatus as CargoStatus;
      updates.status = statusVal;
      if (statusVal === 'delivered') {
        updates.paidAt = new Date();
      }
      const [updated] = await tx.update(cargoShipments)
        .set(updates)
        .where(eq(cargoShipments.id, id))
        .returning();
      return updated;
    });
  }
}
