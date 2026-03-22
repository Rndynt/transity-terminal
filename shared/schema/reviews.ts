import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { appUsers } from "./app-users";
import { trips } from "./scheduling";
import { bookings } from "./booking";

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
