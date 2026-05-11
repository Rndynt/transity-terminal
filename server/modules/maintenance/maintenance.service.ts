import { db } from "@server/db";
import { vehicleMaintenances, type InsertVehicleMaintenance, type VehicleMaintenance } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

type MaintenanceCreateInput = Omit<InsertVehicleMaintenance, 'vehicleId' | 'createdBy' | 'cost'> & { cost?: string | number | null };
type MaintenanceUpdateInput = Partial<Pick<VehicleMaintenance, 'status' | 'completedDate' | 'odometerKm' | 'notes' | 'description'>> & { cost?: string | number | null };

export class MaintenanceService {
  async getByVehicle(vehicleId: string) {
    return db.select().from(vehicleMaintenances)
      .where(eq(vehicleMaintenances.vehicleId, vehicleId))
      .orderBy(desc(vehicleMaintenances.createdAt));
  }

  async getAlerts() {
    const result = await db.execute(sql`
      SELECT vm.*, v.plate, v.code AS vehicle_code
      FROM vehicle_maintenances vm
      JOIN vehicles v ON v.id = vm.vehicle_id
      WHERE vm.status IN ('scheduled', 'overdue')
        AND (vm.scheduled_date <= (CURRENT_DATE + INTERVAL '7 days')::text OR vm.status = 'overdue')
      ORDER BY vm.scheduled_date ASC
      LIMIT 20
    `);
    return Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows || [];
  }

  async create(vehicleId: string, data: MaintenanceCreateInput, createdBy: string) {
    const [row] = await db.insert(vehicleMaintenances).values({
      vehicleId,
      type: data.type,
      description: data.description,
      scheduledDate: data.scheduledDate,
      completedDate: data.completedDate,
      odometerKm: data.odometerKm,
      cost: data.cost ? String(data.cost) : null,
      vendorName: data.vendorName,
      status: data.status || 'scheduled',
      nextServiceKm: data.nextServiceKm,
      nextServiceDate: data.nextServiceDate,
      createdBy,
      notes: data.notes,
    }).returning();
    return row;
  }

  async update(id: string, data: MaintenanceUpdateInput) {
    const updates: Partial<VehicleMaintenance> & { updatedAt: Date } = { updatedAt: new Date() };
    if (data.status) updates.status = data.status;
    if (data.completedDate) updates.completedDate = data.completedDate;
    if (data.odometerKm) updates.odometerKm = data.odometerKm;
    if (data.cost) updates.cost = String(data.cost);
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.description) updates.description = data.description;

    await db.update(vehicleMaintenances).set(updates).where(eq(vehicleMaintenances.id, id));
    return { success: true };
  }

  async remove(id: string) {
    await db.delete(vehicleMaintenances).where(eq(vehicleMaintenances.id, id));
    return { success: true };
  }
}
