import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { tripStatusEnum } from "./enums";
import { stops } from "./network";
import { layouts, vehicles, drivers } from "./fleet";

export const tripPatterns = pgTable("trip_patterns", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:            text("code").notNull().unique(),
  name:            text("name").notNull(),
  note:            text("note"),
  active:          boolean("active").default(true),
  vehicleClass:    text("vehicle_class"),
  defaultLayoutId: uuid("default_layout_id").references(() => layouts.id),
  tags:            text("tags").array().default(sql`'{}'`),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:       timestamp("deleted_at", { withTimezone: true })
});

export const insertTripPatternSchema = createInsertSchema(tripPatterns).omit({ id: true, createdAt: true });
export type TripPattern = typeof tripPatterns.$inferSelect;
export type InsertTripPattern = z.infer<typeof insertTripPatternSchema>;

export const patternStops = pgTable("pattern_stops", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patternId:        uuid("pattern_id").notNull().references(() => tripPatterns.id),
  stopId:           uuid("stop_id").notNull().references(() => stops.id),
  stopSequence:     integer("stop_sequence").notNull(),
  boardingAllowed:  boolean("boarding_allowed").notNull().default(true),
  alightingAllowed: boolean("alighting_allowed").notNull().default(true),
  dwellSeconds:     integer("dwell_seconds").default(0),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:        timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  idxPatternStopsPatternId: sql`CREATE INDEX IF NOT EXISTS idx_pattern_stops_pattern_id ON ${table} (pattern_id)`,
  idxPatternStopsStopId: sql`CREATE INDEX IF NOT EXISTS idx_pattern_stops_stop_id ON ${table} (stop_id)`
}));

export const insertPatternStopSchema = createInsertSchema(patternStops).omit({ id: true, createdAt: true });
export type PatternStop = typeof patternStops.$inferSelect;
export type InsertPatternStop = z.infer<typeof insertPatternStopSchema>;

export const tripBases = pgTable("trip_bases", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:             text("code").unique(),
  name:             text("name").notNull(),
  patternId:        uuid("pattern_id").notNull().references(() => tripPatterns.id),
  active:           boolean("active").notNull().default(true),
  timezone:         text("timezone").notNull().default('Asia/Jakarta'),
  validFrom:        date("valid_from"),
  validTo:          date("valid_to"),
  mon:              boolean("mon").notNull().default(true),
  tue:              boolean("tue").notNull().default(true),
  wed:              boolean("wed").notNull().default(true),
  thu:              boolean("thu").notNull().default(true),
  fri:              boolean("fri").notNull().default(true),
  sat:              boolean("sat").notNull().default(true),
  sun:              boolean("sun").notNull().default(true),
  defaultLayoutId:  uuid("default_layout_id").references(() => layouts.id),
  defaultVehicleId: uuid("default_vehicle_id").references(() => vehicles.id),
  defaultDriverId:  uuid("default_driver_id").references(() => drivers.id),
  capacity:         integer("capacity"),
  channelFlags:     jsonb("channel_flags").notNull().default(sql`'{"CSO":true,"WEB":false,"APP":false,"OTA":false}'`),
  defaultStopTimes: jsonb("default_stop_times").notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt:        timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  idxTripBasesActive:  sql`CREATE INDEX IF NOT EXISTS idx_trip_bases_active ON ${table} (active)`,
  idxTripBasesPattern: sql`CREATE INDEX IF NOT EXISTS idx_trip_bases_pattern ON ${table} (pattern_id)`,
  idxTripBasesValid:   sql`CREATE INDEX IF NOT EXISTS idx_trip_bases_valid ON ${table} (valid_from, valid_to)`
}));

export const insertTripBaseSchema = createInsertSchema(tripBases).omit({ id: true, createdAt: true, updatedAt: true });
export type TripBase = typeof tripBases.$inferSelect;
export type InsertTripBase = z.infer<typeof insertTripBaseSchema>;

export const trips = pgTable("trips", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  baseId:           uuid("base_id").references(() => tripBases.id),
  patternId:        uuid("pattern_id").notNull().references(() => tripPatterns.id),
  serviceDate:      date("service_date").notNull(),
  status:           tripStatusEnum("status").default('scheduled'),
  vehicleId:        uuid("vehicle_id").notNull().references(() => vehicles.id),
  layoutId:         uuid("layout_id").references(() => layouts.id),
  capacity:         integer("capacity").notNull(),
  driverId:         uuid("driver_id").references(() => drivers.id),
  originDepartHHMM:         text("origin_depart_hhmm"),
  channelFlags:             jsonb("channel_flags").default(sql`'{"CSO":true,"WEB":false,"APP":false,"OTA":false}'`),
  manifestFirstPrintedAt:   timestamp("manifest_first_printed_at", { withTimezone: true }),
  snapRouteName:            text("snap_route_name"),
  snapRouteCode:            text("snap_route_code"),
  snapDriverName:           text("snap_driver_name"),
  snapVehiclePlate:         text("snap_vehicle_plate"),
  createdAt:                timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:                timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  uniqTripBasePerDay: sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_trip_base_per_day ON ${table} (base_id, service_date) WHERE base_id IS NOT NULL`,
  idxTripsServiceDate: sql`CREATE INDEX IF NOT EXISTS idx_trips_service_date ON ${table} (service_date)`,
  idxTripsPatternId: sql`CREATE INDEX IF NOT EXISTS idx_trips_pattern_id ON ${table} (pattern_id)`,
  idxTripsStatus: sql`CREATE INDEX IF NOT EXISTS idx_trips_status ON ${table} (status)`,
  idxTripsDriverId: sql`CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON ${table} (driver_id)`,
  idxTripsVehicleId: sql`CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON ${table} (vehicle_id)`
}));

export const insertTripSchema = createInsertSchema(trips).omit({ id: true, createdAt: true });
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

export type TripWithDetails = Trip & {
  patternName?: string | null;
  patternCode?: string | null;
  vehicleCode?: string | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  driverCode?: string | null;
  scheduleTime?: string | null;
};

export type CsoAvailableTrip = {
  tripId?: string;
  baseId?: string;
  isVirtual: boolean;
  patternCode: string;
  patternPath: string;
  vehicle: { code?: string; plate?: string } | null;
  capacity: number | null;
  status: "scheduled" | "canceled" | "closed" | "draft" | "unknown";
  departAtAtOutlet: string | null;
  finalArrivalAt: string | null;
  stopCount: number;
  outletStopSequence: number;
  availableSeats?: number;
  hasPriceRule: boolean;
  outletStopClosed?: boolean;
  outletStopClosedReason?: string | null;
};

export const scheduleExceptions = pgTable("schedule_exceptions", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  baseId:      uuid("base_id").notNull().references(() => tripBases.id),
  exceptionDate: date("exception_date").notNull(),
  reason:      text("reason"),
  createdBy:   text("created_by"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqBaseDate: sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_exception_base_date ON ${table} (base_id, exception_date)`,
  idxExceptionDate: sql`CREATE INDEX IF NOT EXISTS idx_schedule_exception_date ON ${table} (exception_date)`,
}));

export const insertScheduleExceptionSchema = createInsertSchema(scheduleExceptions).omit({ id: true, createdAt: true });
export type ScheduleException = typeof scheduleExceptions.$inferSelect;
export type InsertScheduleException = z.infer<typeof insertScheduleExceptionSchema>;

export const scheduleStopExceptions = pgTable("schedule_stop_exceptions", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  baseId:          uuid("base_id").notNull().references(() => tripBases.id),
  exceptionDate:   date("exception_date").notNull(),
  stopId:          uuid("stop_id").notNull().references(() => stops.id),
  disableBoarding: boolean("disable_boarding").notNull().default(true),
  disableAlighting:boolean("disable_alighting").notNull().default(false),
  reason:          text("reason"),
  createdBy:       text("created_by"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqBaseDateStop: sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_stop_exception_base_date_stop ON ${table} (base_id, exception_date, stop_id)`,
  idxStopExceptionDate: sql`CREATE INDEX IF NOT EXISTS idx_stop_exception_date ON ${table} (exception_date)`,
}));

export const insertScheduleStopExceptionSchema = createInsertSchema(scheduleStopExceptions).omit({ id: true, createdAt: true });
export type ScheduleStopException = typeof scheduleStopExceptions.$inferSelect;
export type InsertScheduleStopException = z.infer<typeof insertScheduleStopExceptionSchema>;

export const tripStopTimes = pgTable("trip_stop_times", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:           uuid("trip_id").notNull().references(() => trips.id),
  stopId:           uuid("stop_id").notNull().references(() => stops.id),
  stopSequence:     integer("stop_sequence").notNull(),
  arriveAt:         timestamp("arrive_at", { withTimezone: true }),
  departAt:         timestamp("depart_at", { withTimezone: true }),
  boardingAllowed:  boolean("boarding_allowed"),
  alightingAllowed: boolean("alighting_allowed"),
  dwellSeconds:     integer("dwell_seconds").default(0),
  deletedAt:        timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  idxTstTripId: sql`CREATE INDEX IF NOT EXISTS idx_tst_trip_id ON ${table} (trip_id)`,
  idxTstStopId: sql`CREATE INDEX IF NOT EXISTS idx_tst_stop_id ON ${table} (stop_id)`,
  idxTstTripStop: sql`CREATE INDEX IF NOT EXISTS idx_tst_trip_stop ON ${table} (trip_id, stop_id) WHERE deleted_at IS NULL`,
  idxTstTripSeq: sql`CREATE INDEX IF NOT EXISTS idx_tst_trip_seq ON ${table} (trip_id, stop_sequence) WHERE deleted_at IS NULL`
}));

export const insertTripStopTimeSchema = createInsertSchema(tripStopTimes).omit({ id: true });
export type TripStopTime = typeof tripStopTimes.$inferSelect;
export type InsertTripStopTime = z.infer<typeof insertTripStopTimeSchema>;

export type TripStopTimeWithEffectiveFlags = TripStopTime & {
  stopName?: string;
  stopCode?: string;
  effectiveBoardingAllowed: boolean;
  effectiveAlightingAllowed: boolean;
  legDurationMinutes?: number | null;
};

export type BulkUpsertTripStopTime = {
  stopId: string;
  stopSequence: number;
  arriveAt?: Date | null;
  departAt?: Date | null;
  dwellSeconds?: number;
  boardingAllowed?: boolean | null;
  alightingAllowed?: boolean | null;
};

export const bulkUpsertTripStopTimeSchema = z.object({
  stopId: z.string().uuid(),
  stopSequence: z.number().int().min(1),
  arriveAt: z.union([
    z.date(),
    z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date string" }),
    z.null()
  ]).optional().transform(val => {
    if (val === null || val === undefined) return null;
    return val instanceof Date ? val : new Date(val);
  }),
  departAt: z.union([
    z.date(),
    z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date string" }),
    z.null()
  ]).optional().transform(val => {
    if (val === null || val === undefined) return null;
    return val instanceof Date ? val : new Date(val);
  }),
  dwellSeconds: z.number().int().min(0).optional().default(0),
  boardingAllowed: z.boolean().nullable().optional(),
  alightingAllowed: z.boolean().nullable().optional()
});

export const tripLegs = pgTable("trip_legs", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:      uuid("trip_id").notNull().references(() => trips.id),
  legIndex:    integer("leg_index").notNull(),
  fromStopId:  uuid("from_stop_id").notNull().references(() => stops.id),
  toStopId:    uuid("to_stop_id").notNull().references(() => stops.id),
  departAt:    timestamp("depart_at", { withTimezone: true }).notNull(),
  arriveAt:    timestamp("arrive_at", { withTimezone: true }).notNull(),
  durationMin: integer("duration_min").notNull(),
  deletedAt:   timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  idxTripLegsTripId: sql`CREATE INDEX IF NOT EXISTS idx_trip_legs_trip_id ON ${table} (trip_id)`
}));

export const insertTripLegSchema = createInsertSchema(tripLegs).omit({ id: true });
export type TripLeg = typeof tripLegs.$inferSelect;
export type InsertTripLeg = z.infer<typeof insertTripLegSchema>;
