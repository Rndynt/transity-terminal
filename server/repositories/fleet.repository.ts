import { db } from "@server/db";
import { eq, isNull } from "drizzle-orm";
import {
  drivers, vehicles, layouts,
  type Driver, type InsertDriver,
  type Vehicle, type InsertVehicle,
  type Layout, type InsertLayout
} from "@shared/schema";

export class FleetRepository {
  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).where(isNull(drivers.deletedAt)).orderBy(drivers.name);
  }

  async getDriverById(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async createDriver(data: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(data).returning();
    return driver;
  }

  async updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver> {
    const [driver] = await db.update(drivers).set(data).where(eq(drivers.id, id)).returning();
    return driver;
  }

  async deleteDriver(id: string): Promise<void> {
    await db.update(drivers).set({ deletedAt: new Date() }).where(eq(drivers.id, id));
  }

  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(isNull(vehicles.deletedAt)).orderBy(vehicles.code);
  }

  async getVehicleById(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async createVehicle(data: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(data).returning();
    return vehicle;
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle> {
    const [vehicle] = await db.update(vehicles).set(data).where(eq(vehicles.id, id)).returning();
    return vehicle;
  }

  async deleteVehicle(id: string): Promise<void> {
    await db.update(vehicles).set({ deletedAt: new Date() }).where(eq(vehicles.id, id));
  }

  async getLayouts(): Promise<Layout[]> {
    return await db.select().from(layouts).where(isNull(layouts.deletedAt)).orderBy(layouts.name);
  }

  async getLayoutById(id: string): Promise<Layout | undefined> {
    const [layout] = await db.select().from(layouts).where(eq(layouts.id, id));
    return layout;
  }

  async createLayout(data: InsertLayout): Promise<Layout> {
    const [layout] = await db.insert(layouts).values(data).returning();
    return layout;
  }

  async updateLayout(id: string, data: Partial<InsertLayout>): Promise<Layout> {
    const [layout] = await db.update(layouts).set(data).where(eq(layouts.id, id)).returning();
    return layout;
  }

  async deleteLayout(id: string): Promise<void> {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(vehicles).set({ deletedAt: now }).where(eq(vehicles.layoutId, id));
      await tx.update(layouts).set({ deletedAt: now }).where(eq(layouts.id, id));
    });
  }
}
