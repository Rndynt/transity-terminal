import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, numeric, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bookingStatusEnum, channelEnum, paymentMethodEnum, paymentStatusEnum, printStatusEnum, ticketStatusEnum, bookingHistoryActionEnum } from "./enums";
import { trips } from "./scheduling";
import { stops, outlets } from "./network";
import { appUsers } from "./app-users";
import { promotions, vouchers } from "./promo";

export const bookingGroups = pgTable("booking_groups", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupCode:   text("group_code").notNull().unique(),
  type:        text("type").notNull().default("round_trip"),
  channel:     channelEnum("channel").notNull().default("CSO"),
  // §3.8: numeric(12,2) supaya align dengan bookings.totalAmount.
  // Drizzle merepresentasikan numeric sebagai string di runtime — caller
  // wajib `.toFixed(2)` atau `.toString()` saat insert (lihat
  // roundTrip.service.ts).
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  outletId:    uuid("outlet_id").references(() => outlets.id),
  createdBy:   text("created_by"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxBookingGroupsCreatedAt: index('idx_booking_groups_created_at').on(table.createdAt),
}));

export const insertBookingGroupSchema = createInsertSchema(bookingGroups).omit({
  id: true, createdAt: true,
});
export type BookingGroup = typeof bookingGroups.$inferSelect;
export type InsertBookingGroup = z.infer<typeof insertBookingGroupSchema>;

export const bookings = pgTable("bookings", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // §3.9a: notNull. Setiap insert path eksplisit panggil generateBookingCode().
  bookingCode:        text("booking_code").notNull().unique(),
  // §3.9a: notNull dengan default 'pending'. Insert paths set status
  // eksplisit ('paid'/'pending'); default ada untuk safety net.
  status:             bookingStatusEnum("status").notNull().default('pending'),
  groupId:            uuid("group_id").references(() => bookingGroups.id),
  legType:            text("leg_type").notNull().default("single"),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull().references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").notNull().references(() => stops.id),
  originSeq:          integer("origin_seq").notNull(),
  destinationSeq:     integer("destination_seq").notNull(),
  channel:            channelEnum("channel").default('CSO'),
  outletId:           uuid("outlet_id").references(() => outlets.id),
  snapOriginStopName:      text("snap_origin_stop_name"),
  snapDestinationStopName: text("snap_destination_stop_name"),
  snapDepartureHHMM:       text("snap_departure_hhmm"),
  snapOutletName:          text("snap_outlet_name"),
  totalAmount:        numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount:     numeric("discount_amount", { precision: 12, scale: 2 }).default('0'),
  // §3.9b: FK ke promotions(id) dengan ON DELETE SET NULL. Snapshot
  // data (discountAmount, voucherCode) tetap di booking row jadi
  // kehilangan ref promo aman.
  promoId:            uuid("promo_id").references(() => promotions.id, { onDelete: 'set null' }),
  // §3.9: snapshot text intentional — ketika voucher dicabut/expired,
  // booking history tetap menampilkan kode yang dipakai. Tidak FK by design.
  voucherCode:        text("voucher_code"),
  currency:           text("currency").default('IDR'),
  createdBy:          text("created_by"),
  salesChannelCode:   text("sales_channel_code"),
  salesChannelName:   text("sales_channel_name"),
  appUserId:          uuid("app_user_id").references(() => appUsers.id),
  pendingExpiresAt:   timestamp("pending_expires_at", { withTimezone: true }),
  idempotencyKey:     text("idempotency_key"),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxBookingsTripId:        index('idx_bookings_trip_id').on(table.tripId),
  idxBookingsStatus:        index('idx_bookings_status').on(table.status),
  idxBookingsTripStatus:    index('idx_bookings_trip_status').on(table.tripId, table.status),
  idxBookingsOutletId:      index('idx_bookings_outlet_id').on(table.outletId),
  idxBookingsCreatedAt:     index('idx_bookings_created_at').on(table.createdAt),
  idxBookingsPendingExpiry: index('idx_bookings_pending_expiry').on(table.pendingExpiresAt).where(sql`status = 'pending'`),
  idxBookingsAppUserId:     index('idx_bookings_app_user_id').on(table.appUserId).where(sql`app_user_id IS NOT NULL`),
  idxBookingsGroupId:       index('idx_bookings_group_id').on(table.groupId).where(sql`group_id IS NOT NULL`),
  idxBookingsOriginStop:    index('idx_bookings_origin_stop').on(table.originStopId),
  idxBookingsDestStop:      index('idx_bookings_destination_stop').on(table.destinationStopId),
  idxBookingsOutletCreated: index('idx_bookings_outlet_created').on(table.outletId, table.createdAt),
  uniqBookingsIdempotency:  uniqueIndex('uniq_bookings_idempotency_key').on(table.idempotencyKey).where(sql`idempotency_key IS NOT NULL`),
}));

// §3.9a: bookingCode is notNull at the column level, but every TT
// insert path generates it via generateBookingCode() at the service
// layer. Omit it from InsertBooking so controllers don't need to pass
// a placeholder string just to satisfy the type.
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, bookingCode: true });
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

// Aplikasi promo per booking — 1 baris per promo (mendukung stacking & audit).
// bookingCode/ticketNumber tidak di-snapshot di sini krn bisa di-join dari bookings/passengers via bookingId.
export const bookingPromoApplications = pgTable("booking_promo_applications", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId:       uuid("booking_id").notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  promoId:         uuid("promo_id").notNull().references(() => promotions.id),
  promoCode:       text("promo_code").notNull(),         // snapshot kode promo
  voucherId:       uuid("voucher_id").references(() => vouchers.id),
  voucherCode:     text("voucher_code"),                  // snapshot kode voucher (jika ada)
  source:          text("source").notNull(),              // 'auto' | 'manual'
  discountAmount:  numeric("discount_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxBpaBookingId:     index('idx_bpa_booking_id').on(table.bookingId),
  idxBpaPromoId:       index('idx_bpa_promo_id').on(table.promoId),
  uniqBpaBookingPromo: uniqueIndex('uniq_bpa_booking_promo').on(table.bookingId, table.promoId),
}));

export const insertBookingPromoApplicationSchema = createInsertSchema(bookingPromoApplications).omit({ id: true, createdAt: true });
export type BookingPromoApplication = typeof bookingPromoApplications.$inferSelect;
export type InsertBookingPromoApplication = z.infer<typeof insertBookingPromoApplicationSchema>;

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
  idxPassengersBookingId:   index('idx_passengers_booking_id').on(table.bookingId),
  idxPassengersBookingSeat: index('idx_passengers_booking_seat').on(table.bookingId, table.seatNo),
}));

export const insertPassengerSchema = createInsertSchema(passengers).omit({ id: true });
export type Passenger = typeof passengers.$inferSelect;
export type InsertPassenger = z.infer<typeof insertPassengerSchema>;

export const payments = pgTable("payments", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId:   uuid("booking_id").notNull().references(() => bookings.id),
  method:      paymentMethodEnum("method").notNull(),
  status:      paymentStatusEnum("status").default('pending'),
  amount:      numeric("amount", { precision: 12, scale: 2 }).notNull(),
  providerRef: text("provider_ref"),
  // §3.9: semantic "kapan paid". Default defaultNow() pragmatis di-keep
  // supaya tidak break existing pending-then-success flow (PR #10 set
  // paidAt eksplisit saat status transit). Reports yang baca paidAt
  // wajib JOIN ke payments.status='success' untuk filter row pending.
  paidAt:      timestamp("paid_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxPaymentsBookingId:   index('idx_payments_booking_id').on(table.bookingId),
  idxPaymentsProviderRef: index('idx_payments_provider_ref').on(table.providerRef).where(sql`provider_ref IS NOT NULL`),
  idxPaymentsPaidAt:      index('idx_payments_paid_at').on(table.paidAt),
  // P3 / P2 §7.9: functional index on paid_at grouped by UTC date so reports
  // that filter/group by date hit an index instead of a full scan.
  //
  // Partial index: only `status = 'success'` rows are indexed. Callers
  // that want to use this index MUST include the predicate `status = 'success'`
  // in their WHERE clause, otherwise Postgres falls back to a sequential scan.
  //
  // Expression uses AT TIME ZONE 'UTC' because paid_at is timestamptz and
  // a plain ::date cast is timezone-dependent (NOT IMMUTABLE in Postgres).
  // Callers must use `(paid_at AT TIME ZONE 'UTC')` to hit this index.
  idxPaymentsPaidDate: index('idx_payments_paid_date').on(sql`(paid_at AT TIME ZONE 'UTC')`).where(sql`status = 'success'`),
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
}, (table) => ({
  idxPrintJobsBookingId: index('idx_print_jobs_booking_id').on(table.bookingId),
}));

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
  idxBookingHistoryBookingId: index('idx_booking_history_booking_id').on(table.bookingId),
}));

export const insertBookingHistorySchema = createInsertSchema(bookingHistory).omit({ id: true, createdAt: true });
export type BookingHistory = typeof bookingHistory.$inferSelect;
export type InsertBookingHistory = z.infer<typeof insertBookingHistorySchema>;
