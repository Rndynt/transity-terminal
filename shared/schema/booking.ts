import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bookingStatusEnum, channelEnum, paymentMethodEnum, paymentStatusEnum, printStatusEnum, ticketStatusEnum, bookingHistoryActionEnum } from "./enums";
import { trips } from "./scheduling";
import { stops, outlets } from "./network";
import { appUsers } from "./app-users";

export const bookings = pgTable("bookings", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingCode:        text("booking_code").unique(),
  status:             bookingStatusEnum("status").default('pending'),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull().references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").notNull().references(() => stops.id),
  originSeq:          integer("origin_seq").notNull(),
  destinationSeq:     integer("destination_seq").notNull(),
  channel:            channelEnum("channel").default('CSO'),
  outletId:           uuid("outlet_id").references(() => outlets.id),
  totalAmount:        numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount:     numeric("discount_amount", { precision: 12, scale: 2 }).default('0'),
  promoId:            uuid("promo_id"),
  voucherCode:        text("voucher_code"),
  currency:           text("currency").default('IDR'),
  createdBy:          text("created_by"),
  appUserId:          uuid("app_user_id").references(() => appUsers.id),
  pendingExpiresAt:   timestamp("pending_expires_at", { withTimezone: true }),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxBookingsTripId: sql`CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON ${table} (trip_id)`,
  idxBookingsStatus: sql`CREATE INDEX IF NOT EXISTS idx_bookings_status ON ${table} (status)`,
  idxBookingsOutletId: sql`CREATE INDEX IF NOT EXISTS idx_bookings_outlet_id ON ${table} (outlet_id)`,
  idxBookingsCreatedAt: sql`CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON ${table} (created_at)`,
  idxBookingsPendingExpiry: sql`CREATE INDEX IF NOT EXISTS idx_bookings_pending_expiry ON ${table} (pending_expires_at) WHERE status = 'pending'`
}));

export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export const passengers = pgTable("passengers", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber:   text("ticket_number").unique(),
  ticketStatus:   ticketStatusEnum("ticket_status").default('active'),
  bookingId:      uuid("booking_id").notNull().references(() => bookings.id),
  seatNo:         text("seat_no").notNull(),
  fullName:       text("full_name").notNull(),
  phone:          text("phone"),
  idNumber:       text("id_number"),
  fareAmount:     numeric("fare_amount", { precision: 12, scale: 2 }).notNull(),
  fareBreakdown:  jsonb("fare_breakdown")
}, (table) => ({
  idxPassengersBookingId: sql`CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON ${table} (booking_id)`
}));

export const insertPassengerSchema = createInsertSchema(passengers).omit({ id: true });
export type Passenger = typeof passengers.$inferSelect;
export type InsertPassenger = z.infer<typeof insertPassengerSchema>;

export const payments = pgTable("payments", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId:   uuid("booking_id").notNull().references(() => bookings.id),
  method:      paymentMethodEnum("method").notNull(),
  status:      paymentStatusEnum("status").default('success'),
  amount:      numeric("amount", { precision: 12, scale: 2 }).notNull(),
  providerRef: text("provider_ref"),
  paidAt:      timestamp("paid_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxPaymentsBookingId: sql`CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON ${table} (booking_id)`
}));

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, paidAt: true });
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export const printJobs = pgTable("print_jobs", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  status:    printStatusEnum("status").default('queued'),
  attempts:  integer("attempts").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const insertPrintJobSchema = createInsertSchema(printJobs).omit({ id: true, createdAt: true });
export type PrintJob = typeof printJobs.$inferSelect;
export type InsertPrintJob = z.infer<typeof insertPrintJobSchema>;

export const bookingHistory = pgTable("booking_history", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId:     uuid("booking_id").notNull().references(() => bookings.id),
  passengerId:   uuid("passenger_id").references(() => passengers.id),
  action:        bookingHistoryActionEnum("action").notNull(),
  details:       jsonb("details"),
  performedBy:   text("performed_by"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxBookingHistoryBookingId: sql`CREATE INDEX IF NOT EXISTS idx_booking_history_booking_id ON ${table} (booking_id)`
}));

export const insertBookingHistorySchema = createInsertSchema(bookingHistory).omit({ id: true, createdAt: true });
export type BookingHistory = typeof bookingHistory.$inferSelect;
export type InsertBookingHistory = z.infer<typeof insertBookingHistorySchema>;
