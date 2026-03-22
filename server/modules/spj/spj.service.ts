import { db } from "../../db";
import { spj, spjCostLines, trips, drivers, vehicles, tripPatterns, tripCostTemplates, tripCostItems } from "@shared/schema";
import type { Spj, SpjCostLine, SpjWithDetails } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

export class SpjService {
  async generateSpjNumber(): Promise<string> {
    const now = new Date();
    const prefix = `SPJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const result = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM spj WHERE spj_number LIKE ${prefix + '%'}`
    );
    const count = (result.rows?.[0] as any)?.count || 0;
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async getAll(): Promise<SpjWithDetails[]> {
    const rows = await db.execute(sql`
      SELECT s.*,
        d.name as driver_name, d.code as driver_code, d.phone as driver_phone, d.license_no as driver_license_no,
        v.code as vehicle_code, v.plate as vehicle_plate,
        t.service_date as trip_service_date,
        tp.name as trip_pattern_name, tp.code as trip_pattern_code
      FROM spj s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN trips t ON s.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      ORDER BY s.created_at DESC
    `);
    return (rows.rows || []).map(this.mapRow);
  }

  async getById(id: string): Promise<SpjWithDetails | null> {
    const rows = await db.execute(sql`
      SELECT s.*,
        d.name as driver_name, d.code as driver_code, d.phone as driver_phone, d.license_no as driver_license_no,
        v.code as vehicle_code, v.plate as vehicle_plate,
        t.service_date as trip_service_date,
        tp.name as trip_pattern_name, tp.code as trip_pattern_code
      FROM spj s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN trips t ON s.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      WHERE s.id = ${id}
    `);
    if (!rows.rows?.length) return null;
    const spjData = this.mapRow(rows.rows[0]);
    const lines = await this.getCostLines(id);
    spjData.costLines = lines;
    return spjData;
  }

  async getByTripId(tripId: string): Promise<SpjWithDetails | null> {
    const rows = await db.execute(sql`
      SELECT s.*,
        d.name as driver_name, d.code as driver_code, d.phone as driver_phone, d.license_no as driver_license_no,
        v.code as vehicle_code, v.plate as vehicle_plate,
        t.service_date as trip_service_date,
        tp.name as trip_pattern_name, tp.code as trip_pattern_code
      FROM spj s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN trips t ON s.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      WHERE s.trip_id = ${tripId}
    `);
    if (!rows.rows?.length) return null;
    const spjData = this.mapRow(rows.rows[0]);
    const lines = await this.getCostLines(spjData.id);
    spjData.costLines = lines;
    return spjData;
  }

  async create(tripId: string, overrides?: { driverId?: string; vehicleId?: string; notes?: string }): Promise<SpjWithDetails> {
    const tripRows = await db.execute(sql`
      SELECT t.* FROM trips t
      WHERE t.id = ${tripId}
    `);
    if (!tripRows.rows?.length) throw new Error("Trip tidak ditemukan");
    const trip = tripRows.rows[0] as any;

    const existing = await db.execute(sql`SELECT id FROM spj WHERE trip_id = ${tripId}`);
    if (existing.rows?.length) throw new Error("SPJ sudah ada untuk trip ini");

    const driverId = overrides?.driverId || trip.driver_id;
    if (!driverId) throw new Error("Driver belum ditugaskan ke trip ini. Assign driver terlebih dahulu.");

    const vehicleId = overrides?.vehicleId || trip.vehicle_id;
    const spjNumber = await this.generateSpjNumber();

    const created = await db.transaction(async (tx) => {
      const [spjRecord] = await tx.insert(spj).values({
        spjNumber,
        tripId,
        driverId,
        vehicleId,
        status: 'draft',
        notes: overrides?.notes || null,
      }).returning();

      const templateRows = await tx.execute(sql`
        SELECT tci.* FROM trip_cost_items tci
        JOIN trip_cost_templates tct ON tci.template_id = tct.id
        WHERE tct.pattern_id = ${trip.pattern_id} AND tct.is_active = true
        ORDER BY tci.created_at ASC
      `);

      if (templateRows.rows?.length) {
        for (const item of templateRows.rows as any[]) {
          await tx.insert(spjCostLines).values({
            spjId: spjRecord.id,
            category: item.category,
            label: item.label,
            estimatedAmount: item.amount,
            isAdvance: item.is_advance,
            notes: item.notes,
          });
        }
      }

      return spjRecord;
    });

    return (await this.getById(created.id))!;
  }

  async updateStatus(id: string, status: 'draft' | 'issued' | 'on_trip' | 'settled'): Promise<Spj> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'issued') updates.issuedAt = new Date();
    if (status === 'settled') updates.settledAt = new Date();

    const [updated] = await db.update(spj).set(updates).where(eq(spj.id, id)).returning();
    if (!updated) throw new Error("SPJ tidak ditemukan");
    return updated;
  }

  async updateNotes(id: string, notes: string): Promise<Spj> {
    const [updated] = await db.update(spj).set({ notes, updatedAt: new Date() }).where(eq(spj.id, id)).returning();
    if (!updated) throw new Error("SPJ tidak ditemukan");
    return updated;
  }

  async getCostLines(spjId: string): Promise<SpjCostLine[]> {
    return db.select().from(spjCostLines).where(eq(spjCostLines.spjId, spjId)).orderBy(spjCostLines.createdAt);
  }

  async updateCostLine(lineId: string, data: { actualAmount?: string | null; notes?: string | null }): Promise<SpjCostLine> {
    const [updated] = await db.update(spjCostLines).set(data).where(eq(spjCostLines.id, lineId)).returning();
    if (!updated) throw new Error("Cost line tidak ditemukan");
    return updated;
  }

  async addCostLine(spjId: string, data: { category: string; label: string; estimatedAmount: string; isAdvance: boolean; notes?: string }): Promise<SpjCostLine> {
    const [created] = await db.insert(spjCostLines).values({
      spjId,
      category: data.category as any,
      label: data.label,
      estimatedAmount: data.estimatedAmount,
      isAdvance: data.isAdvance,
      notes: data.notes || null,
    }).returning();
    return created;
  }

  async deleteCostLine(lineId: string): Promise<void> {
    await db.delete(spjCostLines).where(eq(spjCostLines.id, lineId));
  }

  async delete(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(spjCostLines).where(eq(spjCostLines.spjId, id));
      await tx.delete(spj).where(eq(spj.id, id));
    });
  }

  async getTripProfit(tripId: string) {
    const revenue = await db.execute(sql`
      SELECT
        COALESCE(SUM(b.total_amount::numeric), 0) as ticket_revenue,
        COALESCE((SELECT SUM(cs.total_amount::numeric) FROM cargo_shipments cs WHERE cs.trip_id = ${tripId}), 0) as cargo_revenue
      FROM bookings b WHERE b.trip_id = ${tripId} AND b.status != 'canceled'
    `);
    const costs = await db.execute(sql`
      SELECT
        COALESCE(SUM(scl.actual_amount::numeric), 0) as total_actual_cost,
        COALESCE(SUM(scl.estimated_amount::numeric), 0) as total_estimated_cost,
        COALESCE(SUM(CASE WHEN scl.is_advance THEN scl.estimated_amount::numeric ELSE 0 END), 0) as total_advance
      FROM spj_cost_lines scl
      JOIN spj s ON scl.spj_id = s.id
      WHERE s.trip_id = ${tripId}
    `);
    const rev = revenue.rows?.[0] as any || {};
    const cost = costs.rows?.[0] as any || {};
    const ticketRevenue = parseFloat(rev.ticket_revenue || '0');
    const cargoRevenue = parseFloat(rev.cargo_revenue || '0');
    const totalRevenue = ticketRevenue + cargoRevenue;
    const totalActualCost = parseFloat(cost.total_actual_cost || '0');
    const totalEstimatedCost = parseFloat(cost.total_estimated_cost || '0');
    const totalAdvance = parseFloat(cost.total_advance || '0');
    return {
      ticketRevenue,
      cargoRevenue,
      totalRevenue,
      totalEstimatedCost,
      totalActualCost,
      totalAdvance,
      profit: totalRevenue - totalActualCost,
      advanceSettlement: totalAdvance - totalActualCost,
    };
  }

  private mapRow(row: any): SpjWithDetails {
    return {
      id: row.id,
      spjNumber: row.spj_number,
      tripId: row.trip_id,
      driverId: row.driver_id,
      vehicleId: row.vehicle_id,
      status: row.status,
      issuedAt: row.issued_at,
      settledAt: row.settled_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      driverName: row.driver_name,
      driverCode: row.driver_code,
      driverPhone: row.driver_phone,
      driverLicenseNo: row.driver_license_no,
      vehicleCode: row.vehicle_code,
      vehiclePlate: row.vehicle_plate,
      tripServiceDate: row.trip_service_date,
      tripPatternName: row.trip_pattern_name,
      tripPatternCode: row.trip_pattern_code,
    };
  }
}
