import { IStorage } from "@server/storage.interface";
import { InsertCargoShipment, CargoShipment, CargoShipmentListItem, CargoAvailableTrip, cargoStatusEnum, cargoShipments } from "@shared/schema";
import { db } from "@server/db";
import { sql, eq } from "drizzle-orm";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";
import { resolveCargoCell } from "./cargoRates.resolver";

/**
 * S1-09: lihat `server/modules/rbac/README.md`. Mapping flag:
 *   - createShipment                            → action.cargo.create
 *   - updateShipment / updateShipmentStatus     → action.cargo.manage
 * Read methods (getAll/getById/getByWaybill) tetap terbuka karena route
 * juga membolehkan publik untuk tracking — sumber otoritatif.
 *
 * Catatan: customer-app booking memanggil `createShipment` lewat
 * `app.service.createAppCargo`. Karena customer bukan staf RBAC, caller
 * itu memakai `SYSTEM_CONTEXT` secara eksplisit.
 */

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
    const result = await db.execute(sql`SELECT nextval('cargo_waybill_seq') AS id`) as { rows?: Array<{ id: string | number }> };
    const id = String(result.rows?.[0]?.id ?? 0).padStart(6, '0');
    return `WB-${yy}${mm}${dd}-${id}`;
  }

  async calculateTariff(
    cargoTypeId: string,
    originStopId: string,
    destinationStopId: string,
    weightKg: number,
    tripId?: string,
    serviceDate?: string,
  ): Promise<{ pricePerKg: number; minCharge: number; calculatedAmount: number } | null> {
    // Cargo pricing is pattern-scoped only (no global tier — design
    // decision #4), so a patternId is required to resolve anything. The
    // only way to know which pattern an OD belongs to is via the trip;
    // `serviceDate` is derived from the trip's own service date for
    // seasonal resolution unless the caller already knows it (e.g. the CSO
    // terminal page, which is quoting a specific trip on a specific date
    // it already fetched) and passes it explicitly to skip the lookup.
    let patternId: string | undefined;
    let effectiveServiceDate = serviceDate;

    if (tripId) {
      const trip = await this.storage.getTripById(tripId);
      if (trip?.patternId) {
        patternId = trip.patternId;
        if (!effectiveServiceDate) effectiveServiceDate = String(trip.serviceDate);
      }
    }

    if (!patternId || !effectiveServiceDate) return null;

    const resolved = await resolveCargoCell({
      patternId,
      tripId,
      cargoTypeId,
      originStopId,
      destinationStopId,
      serviceDate: effectiveServiceDate,
    });

    if (resolved.pricePerKg <= 0) return null; // "Tarif belum diatur"

    const cargoType = await this.storage.getCargoTypeById(cargoTypeId);
    const minCharge = cargoType?.minCharge ? parseFloat(cargoType.minCharge) : 0;

    const calculatedAmount = Math.max(resolved.pricePerKg * weightKg, minCharge);

    return { pricePerKg: resolved.pricePerKg, minCharge, calculatedAmount };
  }

  async getAvailableTrips(serviceDate: string, originStopId: string, destinationStopIds: string[]): Promise<CargoAvailableTrip[]> {
    return this.storage.getCargoAvailableTrips(serviceDate, originStopId, destinationStopIds);
  }

  async getAllShipments(
    filters?: { tripId?: string; status?: string; outletId?: string },
    opts?: { limit?: number; offset?: number }
  ): Promise<CargoShipmentListItem[]> {
    return await this.storage.getCargoShipments(filters, opts);
  }

  async countShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<number> {
    return await this.storage.countCargoShipments(filters);
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

  async createShipment(
    data: Omit<InsertCargoShipment, 'waybillNumber'>,
    ctx: ServiceContext,
  ): Promise<CargoShipment> {
    requirePermission(ctx, "action.cargo.create");
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

    // S1-06: server-side tracking secret. Public tracking endpoint butuh
    // (waybill, secret) supaya tidak bisa di-enumerate. Secret di-print
    // di label pengirim — tidak pernah expose ke daftar admin/operator.
    const { randomBytes } = await import("node:crypto");
    const trackingSecret = randomBytes(8).toString("hex");

    // trackingSecret di-omit dari insertCargoShipmentSchema (server-generated),
    // jadi kita lampirkan eksplisit di sini sebagai field tambahan yang sah.
    const payload: InsertCargoShipment & { trackingSecret: string } = {
      ...data,
      waybillNumber,
      trackingSecret,
    };
    return await this.storage.createCargoShipment(payload);
  }

  async updateShipment(
    id: string,
    data: Partial<InsertCargoShipment>,
    ctx: ServiceContext,
  ): Promise<CargoShipment> {
    requirePermission(ctx, "action.cargo.manage");
    // B4: lock + update in the SAME transaction. Using tx.update keeps the
    // write on the same connection that holds the row lock — calling the
    // global storage.updateCargoShipment would go through `db` (different
    // connection) and break the lock semantics.
    return await db.transaction(async (tx) => {
      const lockResult = await tx.execute(
        sql`SELECT id FROM cargo_shipments WHERE id = ${id} FOR UPDATE`
      ) as { rows?: Array<{ id: string }> };
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

  async updateShipmentStatus(
    id: string,
    newStatus: string,
    ctx: ServiceContext,
  ): Promise<CargoShipment> {
    requirePermission(ctx, "action.cargo.manage");
    if (!VALID_STATUSES.includes(newStatus as CargoStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Valid: ${VALID_STATUSES.join(', ')}`);
    }

    return await db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`SELECT status FROM cargo_shipments WHERE id = ${id} FOR UPDATE`
      ) as { rows?: Array<{ status?: string | null }> };
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
