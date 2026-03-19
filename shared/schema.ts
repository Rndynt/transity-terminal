import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  date,
  jsonb,
  pgEnum
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const tripStatusEnum = pgEnum('trip_status', ['scheduled', 'canceled', 'closed']);
export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'checked_in', 'paid', 'canceled', 'refunded']);
export const channelEnum = pgEnum('channel', ['CSO', 'WEB', 'APP', 'OTA']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'qr', 'ewallet', 'bank']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'success', 'failed']);
export const printStatusEnum = pgEnum('print_status', ['queued', 'sent', 'failed']);
export const priceRuleScopeEnum = pgEnum('price_rule_scope', ['pattern', 'trip', 'leg', 'time']);
export const ticketStatusEnum = pgEnum('ticket_status', ['active', 'canceled', 'refunded', 'checked_in', 'no_show']);

// 1. Stops
export const stops = pgTable("stops", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:      text("code").notNull().unique(),
  name:      text("name").notNull(),
  city:      text("city"),
  isOutlet:  boolean("is_outlet").default(false),
  lat:       numeric("lat", { precision: 9, scale: 6 }),
  lng:       numeric("lng", { precision: 9, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 2. Outlets
export const outlets = pgTable("outlets", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  stopId:           uuid("stop_id").notNull().references(() => stops.id).unique(),
  name:             text("name").notNull(),
  address:          text("address"),
  phone:            text("phone"),
  printerProfileId: text("printer_profile_id"),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 3. Layouts
export const layouts = pgTable("layouts", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name:      text("name").notNull(),
  rows:      integer("rows").notNull(),
  cols:      integer("cols").notNull(),
  seatMap:   jsonb("seat_map").notNull(), // array of {seat_no, row, col, class?, disabled?}
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 4. Vehicles
export const vehicles = pgTable("vehicles", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:      text("code").notNull().unique(),
  plate:     text("plate").notNull().unique(),
  layoutId:  uuid("layout_id").notNull().references(() => layouts.id),
  capacity:  integer("capacity").notNull(),
  notes:     text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 5. Trip Patterns
export const tripPatterns = pgTable("trip_patterns", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:            text("code").notNull().unique(),
  name:            text("name").notNull(),
  active:          boolean("active").default(true),
  vehicleClass:    text("vehicle_class"),
  defaultLayoutId: uuid("default_layout_id").references(() => layouts.id),
  tags:            text("tags").array().default(sql`'{}'`),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 6. Pattern Stops
export const patternStops = pgTable("pattern_stops", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patternId:        uuid("pattern_id").notNull().references(() => tripPatterns.id),
  stopId:           uuid("stop_id").notNull().references(() => stops.id),
  stopSequence:     integer("stop_sequence").notNull(),
  boardingAllowed:  boolean("boarding_allowed").notNull().default(true),
  alightingAllowed: boolean("alighting_allowed").notNull().default(true),
  dwellSeconds:     integer("dwell_seconds").default(0),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 6a. Trip Bases (Virtual scheduling templates)
export const tripBases = pgTable("trip_bases", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:             text("code").unique(),
  name:             text("name").notNull(),
  patternId:        uuid("pattern_id").notNull().references(() => tripPatterns.id),
  active:           boolean("active").notNull().default(true),
  timezone:         text("timezone").notNull().default('Asia/Jakarta'),
  validFrom:        date("valid_from"),
  validTo:          date("valid_to"),
  // Days of operation
  mon:              boolean("mon").notNull().default(true),
  tue:              boolean("tue").notNull().default(true),
  wed:              boolean("wed").notNull().default(true),
  thu:              boolean("thu").notNull().default(true),
  fri:              boolean("fri").notNull().default(true),
  sat:              boolean("sat").notNull().default(true),
  sun:              boolean("sun").notNull().default(true),
  defaultLayoutId:  uuid("default_layout_id").references(() => layouts.id),
  defaultVehicleId: uuid("default_vehicle_id").references(() => vehicles.id),
  capacity:         integer("capacity"),
  channelFlags:     jsonb("channel_flags").notNull().default(sql`'{"CSO":true,"WEB":false,"APP":false,"OTA":false}'`),
  defaultStopTimes: jsonb("default_stop_times").notNull(), // Default stop times as local time strings without date
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxTripBasesActive:  sql`CREATE INDEX IF NOT EXISTS idx_trip_bases_active ON ${table} (active)`,
  idxTripBasesPattern: sql`CREATE INDEX IF NOT EXISTS idx_trip_bases_pattern ON ${table} (pattern_id)`,
  idxTripBasesValid:   sql`CREATE INDEX IF NOT EXISTS idx_trip_bases_valid ON ${table} (valid_from, valid_to)`
}));

// 7. Trips
export const trips = pgTable("trips", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  baseId:           uuid("base_id").references(() => tripBases.id),
  patternId:        uuid("pattern_id").notNull().references(() => tripPatterns.id),
  serviceDate:      date("service_date").notNull(),
  status:           tripStatusEnum("status").default('scheduled'),
  vehicleId:        uuid("vehicle_id").notNull().references(() => vehicles.id),
  layoutId:         uuid("layout_id").references(() => layouts.id),
  capacity:         integer("capacity").notNull(),
  originDepartHHMM: text("origin_depart_hhmm"),
  channelFlags:     jsonb("channel_flags").default(sql`'{"CSO":true,"WEB":false,"APP":false,"OTA":false}'`),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  uniqTripBasePerDay: sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_trip_base_per_day ON ${table} (base_id, service_date) WHERE base_id IS NOT NULL`
}));

// 8. Trip Stop Times
export const tripStopTimes = pgTable("trip_stop_times", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:           uuid("trip_id").notNull().references(() => trips.id),
  stopId:           uuid("stop_id").notNull().references(() => stops.id),
  stopSequence:     integer("stop_sequence").notNull(),
  arriveAt:         timestamp("arrive_at", { withTimezone: true }),
  departAt:         timestamp("depart_at", { withTimezone: true }),
  boardingAllowed:  boolean("boarding_allowed"), // null = inherit from pattern
  alightingAllowed: boolean("alighting_allowed"), // null = inherit from pattern
  dwellSeconds:     integer("dwell_seconds").default(0)
});

// 9. Trip Legs
export const tripLegs = pgTable("trip_legs", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:      uuid("trip_id").notNull().references(() => trips.id),
  legIndex:    integer("leg_index").notNull(),
  fromStopId:  uuid("from_stop_id").notNull().references(() => stops.id),
  toStopId:    uuid("to_stop_id").notNull().references(() => stops.id),
  departAt:    timestamp("depart_at", { withTimezone: true }).notNull(),
  arriveAt:    timestamp("arrive_at", { withTimezone: true }).notNull(),
  durationMin: integer("duration_min").notNull()
});

// 10. Seat Inventory
export const seatInventory = pgTable("seat_inventory", {
  id:       uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:   uuid("trip_id").notNull().references(() => trips.id),
  seatNo:   text("seat_no").notNull(),
  legIndex: integer("leg_index").notNull(),
  booked:   boolean("booked").default(false),
  holdRef:  text("hold_ref")
});

// 10a. Seat Holds
export const seatHolds = pgTable("seat_holds", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  holdRef:     text("hold_ref").notNull().unique(),
  tripId:      uuid("trip_id").notNull().references(() => trips.id),
  seatNo:      text("seat_no").notNull(),
  legIndexes:  integer("leg_indexes").array().notNull(),
  ttlClass:    text("ttl_class").notNull(), // 'short' | 'long'
  operatorId:  text("operator_id").notNull(),
  bookingId:   text("booking_id"), // nullable for non-booking holds
  expiresAt:   timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 11. Price Rules
export const priceRules = pgTable("price_rules", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  scope:     priceRuleScopeEnum("scope").notNull(),
  patternId: uuid("pattern_id").references(() => tripPatterns.id),
  tripId:    uuid("trip_id").references(() => trips.id),
  legIndex:  integer("leg_index"),
  priority:  integer("priority").default(0),
  rule:      jsonb("rule").notNull(), // base per leg, caps, discounts, peak %, promo
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo:   timestamp("valid_to", { withTimezone: true })
});

// 12. Bookings
export const bookings = pgTable("bookings", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingCode:        text("booking_code").unique(), // Human-readable PNR e.g. TRV-20240319-XYZ12
  status:             bookingStatusEnum("status").default('pending'),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull().references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").notNull().references(() => stops.id),
  originSeq:          integer("origin_seq").notNull(),
  destinationSeq:     integer("destination_seq").notNull(),
  channel:            channelEnum("channel").default('CSO'),
  outletId:           uuid("outlet_id").references(() => outlets.id),
  totalAmount:        numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency:           text("currency").default('IDR'),
  createdBy:          text("created_by"),
  appUserId:          uuid("app_user_id").references(() => appUsers.id),
  pendingExpiresAt:   timestamp("pending_expires_at", { withTimezone: true }),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
});

// 13. Passengers
export const passengers = pgTable("passengers", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber:   text("ticket_number").unique(), // Per-passenger ticket ID e.g. TKT-20240319-AB123
  ticketStatus:   ticketStatusEnum("ticket_status").default('active'), // Individual cancellation per passenger
  bookingId:      uuid("booking_id").notNull().references(() => bookings.id),
  seatNo:         text("seat_no").notNull(),
  fullName:       text("full_name").notNull(),
  phone:          text("phone"),
  idNumber:       text("id_number"),
  fareAmount:     numeric("fare_amount", { precision: 12, scale: 2 }).notNull(),
  fareBreakdown:  jsonb("fare_breakdown")
});

// 14. Payments
export const payments = pgTable("payments", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId:   uuid("booking_id").notNull().references(() => bookings.id),
  method:      paymentMethodEnum("method").notNull(),
  status:      paymentStatusEnum("status").default('success'),
  amount:      numeric("amount", { precision: 12, scale: 2 }).notNull(),
  providerRef: text("provider_ref"),
  paidAt:      timestamp("paid_at", { withTimezone: true }).defaultNow()
});

// 15. Print Jobs
export const printJobs = pgTable("print_jobs", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  status:    printStatusEnum("status").default('queued'),
  attempts:  integer("attempts").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// Relations
export const stopsRelations = relations(stops, ({ many, one }) => ({
  outlets: one(outlets),
  patternStops: many(patternStops),
  tripStopTimes: many(tripStopTimes),
  tripLegsFrom: many(tripLegs, { relationName: "fromStop" }),
  tripLegsTo: many(tripLegs, { relationName: "toStop" }),
  bookingsOrigin: many(bookings, { relationName: "originStop" }),
  bookingsDestination: many(bookings, { relationName: "destinationStop" })
}));

export const outletsRelations = relations(outlets, ({ one, many }) => ({
  stop: one(stops, { fields: [outlets.stopId], references: [stops.id] }),
  bookings: many(bookings)
}));

export const layoutsRelations = relations(layouts, ({ many }) => ({
  vehicles: many(vehicles),
  tripPatterns: many(tripPatterns),
  trips: many(trips)
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  layout: one(layouts, { fields: [vehicles.layoutId], references: [layouts.id] }),
  trips: many(trips)
}));

export const tripPatternsRelations = relations(tripPatterns, ({ one, many }) => ({
  defaultLayout: one(layouts, { fields: [tripPatterns.defaultLayoutId], references: [layouts.id] }),
  patternStops: many(patternStops),
  trips: many(trips),
  priceRules: many(priceRules)
}));

export const patternStopsRelations = relations(patternStops, ({ one }) => ({
  pattern: one(tripPatterns, { fields: [patternStops.patternId], references: [tripPatterns.id] }),
  stop: one(stops, { fields: [patternStops.stopId], references: [stops.id] })
}));

export const tripBasesRelations = relations(tripBases, ({ one, many }) => ({
  pattern: one(tripPatterns, { fields: [tripBases.patternId], references: [tripPatterns.id] }),
  defaultLayout: one(layouts, { fields: [tripBases.defaultLayoutId], references: [layouts.id] }),
  defaultVehicle: one(vehicles, { fields: [tripBases.defaultVehicleId], references: [vehicles.id] }),
  trips: many(trips)
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  pattern: one(tripPatterns, { fields: [trips.patternId], references: [tripPatterns.id] }),
  vehicle: one(vehicles, { fields: [trips.vehicleId], references: [vehicles.id] }),
  layout: one(layouts, { fields: [trips.layoutId], references: [layouts.id] }),
  base: one(tripBases, { fields: [trips.baseId], references: [tripBases.id] }),
  tripStopTimes: many(tripStopTimes),
  tripLegs: many(tripLegs),
  seatInventory: many(seatInventory),
  bookings: many(bookings),
  priceRules: many(priceRules)
}));

export const tripStopTimesRelations = relations(tripStopTimes, ({ one }) => ({
  trip: one(trips, { fields: [tripStopTimes.tripId], references: [trips.id] }),
  stop: one(stops, { fields: [tripStopTimes.stopId], references: [stops.id] })
}));

export const tripLegsRelations = relations(tripLegs, ({ one }) => ({
  trip: one(trips, { fields: [tripLegs.tripId], references: [trips.id] }),
  fromStop: one(stops, { fields: [tripLegs.fromStopId], references: [stops.id], relationName: "fromStop" }),
  toStop: one(stops, { fields: [tripLegs.toStopId], references: [stops.id], relationName: "toStop" })
}));

export const seatInventoryRelations = relations(seatInventory, ({ one }) => ({
  trip: one(trips, { fields: [seatInventory.tripId], references: [trips.id] })
}));

export const priceRulesRelations = relations(priceRules, ({ one }) => ({
  pattern: one(tripPatterns, { fields: [priceRules.patternId], references: [tripPatterns.id] }),
  trip: one(trips, { fields: [priceRules.tripId], references: [trips.id] })
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  trip: one(trips, { fields: [bookings.tripId], references: [trips.id] }),
  originStop: one(stops, { fields: [bookings.originStopId], references: [stops.id], relationName: "originStop" }),
  destinationStop: one(stops, { fields: [bookings.destinationStopId], references: [stops.id], relationName: "destinationStop" }),
  outlet: one(outlets, { fields: [bookings.outletId], references: [outlets.id] }),
  appUser: one(appUsers, { fields: [bookings.appUserId], references: [appUsers.id] }),
  passengers: many(passengers),
  payments: many(payments),
  printJobs: many(printJobs),
  reviews: many(reviews)
}));

export const passengersRelations = relations(passengers, ({ one }) => ({
  booking: one(bookings, { fields: [passengers.bookingId], references: [bookings.id] })
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] })
}));

export const printJobsRelations = relations(printJobs, ({ one }) => ({
  booking: one(bookings, { fields: [printJobs.bookingId], references: [bookings.id] })
}));

// Insert schemas
export const insertStopSchema = createInsertSchema(stops).omit({ id: true, createdAt: true });
export const insertOutletSchema = createInsertSchema(outlets).omit({ id: true, createdAt: true });
export const insertLayoutSchema = createInsertSchema(layouts).omit({ id: true, createdAt: true });
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });
export const insertTripPatternSchema = createInsertSchema(tripPatterns).omit({ id: true, createdAt: true });
export const insertPatternStopSchema = createInsertSchema(patternStops).omit({ id: true, createdAt: true });
export const insertTripBaseSchema = createInsertSchema(tripBases).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTripSchema = createInsertSchema(trips).omit({ id: true, createdAt: true });
export const insertTripStopTimeSchema = createInsertSchema(tripStopTimes).omit({ id: true });
export const insertTripLegSchema = createInsertSchema(tripLegs).omit({ id: true });
export const insertSeatInventorySchema = createInsertSchema(seatInventory).omit({ id: true });
export const insertPriceRuleSchema = createInsertSchema(priceRules).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertPassengerSchema = createInsertSchema(passengers).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, paidAt: true });
export const insertPrintJobSchema = createInsertSchema(printJobs).omit({ id: true, createdAt: true });

// Types
export type Stop = typeof stops.$inferSelect;
export type Outlet = typeof outlets.$inferSelect;
export type Layout = typeof layouts.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type TripPattern = typeof tripPatterns.$inferSelect;
export type PatternStop = typeof patternStops.$inferSelect;
export type TripBase = typeof tripBases.$inferSelect;
export type Trip = typeof trips.$inferSelect;
// Extended Trip type with joined data for display
export type TripWithDetails = Trip & {
  patternName?: string | null;
  patternCode?: string | null;
  vehicleCode?: string | null;
  vehiclePlate?: string | null;
  scheduleTime?: string | null;
};

// CSO Available Trip type for filtered trips by outlet (updated for virtual scheduling)
export type CsoAvailableTrip = {
  tripId?: string;                 // present if real
  baseId?: string;                 // present if virtual (and also present for real trip that came from a base)
  isVirtual: boolean;              // true for base-derived items (no real trip yet)
  patternCode: string;
  patternPath: string;             // "A → C → B"
  vehicle: { code?: string; plate?: string } | null;
  capacity: number | null;
  status: "scheduled" | "canceled" | "closed" | "draft" | "unknown";
  departAtAtOutlet: string | null; // ISO if real; or computed from base if virtual
  finalArrivalAt: string | null;   // ISO if real; or computed from base if virtual
  stopCount: number;
  outletStopSequence: number;      // stop_sequence of the outlet in the trip (1 = origin, >1 = transit)
  availableSeats?: number;         // available seat count (for real trips); undefined for virtual trips
};

// Extended TripStopTime with effective flags and stop details
export type TripStopTimeWithEffectiveFlags = TripStopTime & {
  stopName?: string;
  stopCode?: string;
  effectiveBoardingAllowed: boolean;
  effectiveAlightingAllowed: boolean;
  legDurationMinutes?: number | null;
};

// Bulk upsert request for trip stop times
export type BulkUpsertTripStopTime = {
  stopId: string;
  stopSequence: number;
  arriveAt?: Date | null;
  departAt?: Date | null;
  dwellSeconds?: number;
  boardingAllowed?: boolean | null;
  alightingAllowed?: boolean | null;
};

// Validation schema for bulk upsert
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
export type TripStopTime = typeof tripStopTimes.$inferSelect;
export type TripLeg = typeof tripLegs.$inferSelect;
export type SeatInventory = typeof seatInventory.$inferSelect;
export type PriceRule = typeof priceRules.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Passenger = typeof passengers.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PrintJob = typeof printJobs.$inferSelect;

export type InsertStop = z.infer<typeof insertStopSchema>;
export type InsertOutlet = z.infer<typeof insertOutletSchema>;
export type InsertLayout = z.infer<typeof insertLayoutSchema>;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type InsertTripPattern = z.infer<typeof insertTripPatternSchema>;
export type InsertPatternStop = z.infer<typeof insertPatternStopSchema>;
export type InsertTripBase = z.infer<typeof insertTripBaseSchema>;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type InsertTripStopTime = z.infer<typeof insertTripStopTimeSchema>;
export type InsertTripLeg = z.infer<typeof insertTripLegSchema>;
export type InsertSeatInventory = z.infer<typeof insertSeatInventorySchema>;
export type InsertPriceRule = z.infer<typeof insertPriceRuleSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertPassenger = z.infer<typeof insertPassengerSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertPrintJob = z.infer<typeof insertPrintJobSchema>;

// 16. Cargo Types
export const cargoTypes = pgTable("cargo_types", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:         text("code").notNull().unique(),
  name:         text("name").notNull(),
  isActive:     boolean("is_active").default(true),
  description:  text("description"),
  maxWeightKg:  numeric("max_weight_kg", { precision: 8, scale: 2 }),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const insertCargoTypeSchema = createInsertSchema(cargoTypes).omit({ id: true, createdAt: true });
export type CargoType = typeof cargoTypes.$inferSelect;
export type InsertCargoType = z.infer<typeof insertCargoTypeSchema>;

// 17. Cargo Rates
export const cargoRateScopeEnum = pgEnum('cargo_rate_scope', ['global', 'pattern', 'trip']);

export const cargoRates = pgTable("cargo_rates", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cargoTypeId:        uuid("cargo_type_id").notNull().references(() => cargoTypes.id),
  scope:              cargoRateScopeEnum("scope").notNull().default('global'),
  scopeRefId:         uuid("scope_ref_id"),
  originStopId:       uuid("origin_stop_id").references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").references(() => stops.id),
  isActive:           boolean("is_active").default(true),
  pricePerKg:         numeric("price_per_kg", { precision: 12, scale: 2 }).notNull(),
  pricePerLeg:        numeric("price_per_leg", { precision: 12, scale: 2 }).notNull().default('0'),
  minCharge:          numeric("min_charge", { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const cargoRatesRelations = relations(cargoRates, ({ one }) => ({
  cargoType: one(cargoTypes, { fields: [cargoRates.cargoTypeId], references: [cargoTypes.id] }),
  originStop: one(stops, { fields: [cargoRates.originStopId], references: [stops.id], relationName: "cargoRateOriginStop" }),
  destinationStop: one(stops, { fields: [cargoRates.destinationStopId], references: [stops.id], relationName: "cargoRateDestinationStop" })
}));

export const insertCargoRateSchema = createInsertSchema(cargoRates).omit({ id: true, createdAt: true });
export type CargoRate = typeof cargoRates.$inferSelect;
export type InsertCargoRate = z.infer<typeof insertCargoRateSchema>;

// 18. Cargo Shipments
export const cargoStatusEnum = pgEnum('cargo_status', ['pending', 'received', 'loaded', 'in_transit', 'arrived', 'delivered', 'returned', 'canceled']);

export const cargoShipments = pgTable("cargo_shipments", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  waybillNumber:      text("waybill_number").notNull().unique(),
  status:             cargoStatusEnum("status").default('received'),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull().references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").notNull().references(() => stops.id),
  outletId:           uuid("outlet_id").references(() => outlets.id),
  channel:            channelEnum("channel").default('CSO'),
  cargoTypeId:        uuid("cargo_type_id").references(() => cargoTypes.id),
  senderName:         text("sender_name").notNull(),
  senderPhone:        text("sender_phone").notNull(),
  recipientName:      text("recipient_name").notNull(),
  recipientPhone:     text("recipient_phone").notNull(),
  itemDescription:    text("item_description").notNull(),
  quantity:           integer("quantity").notNull().default(1),
  weightKg:           numeric("weight_kg", { precision: 8, scale: 2 }),
  lengthCm:           numeric("length_cm", { precision: 8, scale: 2 }),
  widthCm:            numeric("width_cm", { precision: 8, scale: 2 }),
  heightCm:           numeric("height_cm", { precision: 8, scale: 2 }),
  declaredValue:      numeric("declared_value", { precision: 12, scale: 2 }),
  totalAmount:        numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod:      paymentMethodEnum("payment_method"),
  paidAt:             timestamp("paid_at", { withTimezone: true }),
  notes:              text("notes"),
  createdBy:          text("created_by"),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const cargoShipmentsRelations = relations(cargoShipments, ({ one }) => ({
  trip: one(trips, { fields: [cargoShipments.tripId], references: [trips.id] }),
  originStop: one(stops, { fields: [cargoShipments.originStopId], references: [stops.id], relationName: "cargoOriginStop" }),
  destinationStop: one(stops, { fields: [cargoShipments.destinationStopId], references: [stops.id], relationName: "cargoDestinationStop" }),
  outlet: one(outlets, { fields: [cargoShipments.outletId], references: [outlets.id] }),
  cargoType: one(cargoTypes, { fields: [cargoShipments.cargoTypeId], references: [cargoTypes.id] })
}));

export const insertCargoShipmentSchema = createInsertSchema(cargoShipments)
  .omit({ id: true, createdAt: true })
  .extend({
    paidAt: z.union([z.date(), z.string().transform(s => new Date(s))]).optional().nullable()
  });
export type CargoShipment = typeof cargoShipments.$inferSelect;
export type InsertCargoShipment = z.infer<typeof insertCargoShipmentSchema>;

// 19. App Users (B2C mobile customers)
export const appUsers = pgTable("app_users", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email:        text("email").notNull().unique(),
  name:         text("name").notNull(),
  phone:        text("phone"),
  isActive:     boolean("is_active").default(true),
  avatar:       text("avatar"),
  passwordHash: text("password_hash").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const appUsersRelations = relations(appUsers, ({ many }) => ({
  bookings: many(bookings),
  reviews: many(reviews)
}));

export const insertAppUserSchema = createInsertSchema(appUsers).omit({ id: true, createdAt: true });
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;

// 20. Reviews
export const reviews = pgTable("reviews", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  appUserId: uuid("app_user_id").notNull().references(() => appUsers.id),
  tripId:    uuid("trip_id").notNull().references(() => trips.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  rating:    integer("rating").notNull(),
  comment:   text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  appUser: one(appUsers, { fields: [reviews.appUserId], references: [appUsers.id] }),
  trip: one(trips, { fields: [reviews.tripId], references: [trips.id] }),
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] })
}));

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

// Keep existing user schema for compatibility (can be removed later)
export const users = pgTable("users", {
  id:       uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
