import { relations } from "drizzle-orm";
import { stops, outlets } from "./network";
import { drivers, layouts, vehicles } from "./fleet";
import { tripPatterns, patternStops, tripBases, trips, tripStopTimes, tripLegs } from "./scheduling";
import { seatInventory, priceRules } from "./inventory";
import { bookings, passengers, payments, printJobs, bookingHistory } from "./booking";
import { appUsers } from "./app-users";
import { reviews } from "./reviews";

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

export const driversRelations = relations(drivers, ({ many }) => ({
  tripBases: many(tripBases),
  trips: many(trips)
}));

export const tripBasesRelations = relations(tripBases, ({ one, many }) => ({
  pattern: one(tripPatterns, { fields: [tripBases.patternId], references: [tripPatterns.id] }),
  defaultLayout: one(layouts, { fields: [tripBases.defaultLayoutId], references: [layouts.id] }),
  defaultVehicle: one(vehicles, { fields: [tripBases.defaultVehicleId], references: [vehicles.id] }),
  defaultDriver: one(drivers, { fields: [tripBases.defaultDriverId], references: [drivers.id] }),
  trips: many(trips)
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  pattern: one(tripPatterns, { fields: [trips.patternId], references: [tripPatterns.id] }),
  vehicle: one(vehicles, { fields: [trips.vehicleId], references: [vehicles.id] }),
  layout: one(layouts, { fields: [trips.layoutId], references: [layouts.id] }),
  driver: one(drivers, { fields: [trips.driverId], references: [drivers.id] }),
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

export const bookingHistoryRelations = relations(bookingHistory, ({ one }) => ({
  booking: one(bookings, { fields: [bookingHistory.bookingId], references: [bookings.id] }),
  passenger: one(passengers, { fields: [bookingHistory.passengerId], references: [passengers.id] })
}));

export const appUsersRelations = relations(appUsers, ({ many }) => ({
  bookings: many(bookings),
  reviews: many(reviews)
}));
