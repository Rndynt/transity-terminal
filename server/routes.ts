import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { webSocketService } from "./realtime/ws";
import { z } from "zod";
import { 
  insertStopSchema, insertOutletSchema, insertVehicleSchema, insertLayoutSchema,
  insertTripPatternSchema, insertPatternStopSchema, insertTripBaseSchema, insertTripSchema,
  insertTripStopTimeSchema, insertPriceRuleSchema, insertBookingSchema,
  insertPassengerSchema, insertPaymentSchema, insertCargoShipmentSchema,
  insertTripCostTemplateSchema, insertTripCostItemSchema,
  insertPromotionSchema, insertVoucherSchema,
  type Stop, type Outlet, type Vehicle, type Layout, type TripPattern, 
  type PatternStop, type TripBase, type Trip, type TripWithDetails, type TripStopTime, type TripLeg, 
  type SeatInventory, type PriceRule, type Booking, type Passenger, 
  type Payment, type PrintJob, type CargoShipment, type CargoType, type CargoRate,
  type Driver, type InsertDriver,
  type InsertStop, type InsertOutlet, type InsertVehicle, type InsertLayout,
  type InsertTripPattern, type InsertPatternStop, type InsertTripBase, type InsertTrip,
  type InsertTripStopTime, type InsertPriceRule, type InsertBooking,
  type InsertPassenger, type InsertPayment, type InsertPrintJob, type InsertCargoShipment,
  type InsertCargoType, type InsertCargoRate,
  type TripCostTemplate, type InsertTripCostTemplate,
  type TripCostItem, type InsertTripCostItem,
  type CsoAvailableTrip,
  type Promotion, type InsertPromotion,
  type Voucher, type InsertVoucher
} from "@shared/schema";

export interface ManifestEntry {
  ticketNumber: string | null;
  ticketStatus: string;
  passengerName: string;
  seatNo: string;
  phone: string | null;
  idNumber: string | null;
  fareAmount: string;
  bookingCode: string | null;
  bookingStatus: string;
  channel: string | null;
  originStopName: string | null;
  destinationStopName: string | null;
  createdAt: Date | null;
}

export interface ManifestCargoEntry {
  waybillNumber: string;
  senderName: string;
  recipientName: string;
  itemDescription: string;
  quantity: number;
  weightKg: string | null;
  totalAmount: string;
  originStopName: string | null;
  destinationStopName: string | null;
}

export interface ManifestFull {
  header: {
    manifestNumber: string;
    tripId: string;
    serviceDate: string;
    departureTime: string | null;
    routeName: string;
    originStop: string;
    destinationStop: string;
    vehiclePlate: string;
    vehicleType: string;
    driverName: string | null;
    driverLicense: string | null;
    generatedAt: string;
    firstPrintedAt: string | null;
  };
  passengers: ManifestEntry[];
  cargo: ManifestCargoEntry[];
  summary: {
    totalPassengers: number;
    totalCargoItems: number;
    totalCargoWeight: number;
    totalTicketRevenue: number;
    totalCargoRevenue: number;
    totalRevenue: number;
  };
}

export interface IStorage {
  // Drivers
  getDrivers(): Promise<Driver[]>;
  getDriverById(id: string): Promise<Driver | undefined>;
  createDriver(data: InsertDriver): Promise<Driver>;
  updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver>;
  deleteDriver(id: string): Promise<void>;

  // Stops
  getStops(): Promise<Stop[]>;
  getStopById(id: string): Promise<Stop | undefined>;
  createStop(data: InsertStop): Promise<Stop>;
  updateStop(id: string, data: Partial<InsertStop>): Promise<Stop>;
  deleteStop(id: string): Promise<void>;

  // Outlets
  getOutlets(): Promise<Outlet[]>;
  getOutletById(id: string): Promise<Outlet | undefined>;
  createOutlet(data: InsertOutlet): Promise<Outlet>;
  updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet>;
  deleteOutlet(id: string): Promise<void>;

  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | undefined>;
  createVehicle(data: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<void>;

  // Layouts
  getLayouts(): Promise<Layout[]>;
  getLayoutById(id: string): Promise<Layout | undefined>;
  createLayout(data: InsertLayout): Promise<Layout>;
  updateLayout(id: string, data: Partial<InsertLayout>): Promise<Layout>;
  deleteLayout(id: string): Promise<void>;

  // Trip Patterns
  getTripPatterns(): Promise<TripPattern[]>;
  getTripPatternById(id: string): Promise<TripPattern | undefined>;
  createTripPattern(data: InsertTripPattern): Promise<TripPattern>;
  updateTripPattern(id: string, data: Partial<InsertTripPattern>): Promise<TripPattern>;
  deleteTripPattern(id: string): Promise<void>;

  // Pattern Stops
  getPatternStops(patternId: string): Promise<Array<PatternStop & { stop: Stop | null }>>;
  createPatternStop(data: InsertPatternStop): Promise<PatternStop>;
  updatePatternStop(id: string, data: Partial<InsertPatternStop>): Promise<PatternStop>;
  deletePatternStop(id: string): Promise<void>;
  bulkReplacePatternStops(patternId: string, patternStops: InsertPatternStop[]): Promise<PatternStop[]>;

  // Trip Bases
  getTripBases(): Promise<TripBase[]>;
  getTripBaseById(id: string): Promise<TripBase | undefined>;
  createTripBase(data: InsertTripBase): Promise<TripBase>;
  updateTripBase(id: string, data: Partial<InsertTripBase>): Promise<TripBase>;
  deleteTripBase(id: string): Promise<void>;

  // Trips
  getTrips(serviceDate?: string): Promise<TripWithDetails[]>;
  getCsoAvailableTrips(serviceDate: string, outletId: string): Promise<CsoAvailableTrip[]>;
  getTripById(id: string): Promise<Trip | undefined>;
  createTrip(data: InsertTrip): Promise<Trip>;
  updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip>;
  deleteTrip(id: string): Promise<void>;

  // Trip Stop Times
  getTripStopTimes(tripId: string): Promise<TripStopTime[]>;
  getTripStopTimesWithEffectiveFlags(tripId: string): Promise<any[]>;
  createTripStopTime(data: InsertTripStopTime): Promise<TripStopTime>;
  updateTripStopTime(id: string, data: Partial<InsertTripStopTime>): Promise<TripStopTime>;
  deleteTripStopTime(id: string): Promise<void>;
  bulkUpsertTripStopTimes(tripId: string, stopTimes: any[]): Promise<void>;

  // Trip Legs
  getTripLegs(tripId: string): Promise<TripLeg[]>;
  createTripLeg(data: any): Promise<TripLeg>;
  deleteTripLegs(tripId: string): Promise<void>;

  // Seat Inventory
  getSeatInventory(tripId: string, legIndexes?: number[]): Promise<SeatInventory[]>;
  createSeatInventory(data: any[]): Promise<SeatInventory[]>;
  updateSeatInventory(tripId: string, seatNo: string, legIndexes: number[], updates: any): Promise<void>;
  deleteSeatInventory(tripId: string): Promise<void>;

  // Price Rules
  getPriceRules(): Promise<PriceRule[]>;
  getPriceRulesForTrip(tripId: string, patternId: string): Promise<PriceRule[]>;
  createPriceRule(data: InsertPriceRule): Promise<PriceRule>;
  updatePriceRule(id: string, data: Partial<InsertPriceRule>): Promise<PriceRule>;
  deletePriceRule(id: string): Promise<void>;

  // Bookings
  getBookings(tripId?: string): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  getBookingByCode(bookingCode: string): Promise<Booking | undefined>;
  createBooking(data: InsertBooking): Promise<Booking>;
  updateBooking(id: string, data: Partial<InsertBooking>): Promise<Booking>;

  // Passengers
  getPassengers(bookingId: string): Promise<Passenger[]>;
  getPassengerByTicketNumber(ticketNumber: string): Promise<Passenger | undefined>;
  createPassenger(data: InsertPassenger): Promise<Passenger>;
  updatePassenger(id: string, data: Partial<InsertPassenger>): Promise<Passenger>;

  // Manifest
  getManifest(tripId: string): Promise<ManifestEntry[]>;
  getManifestFull(tripId: string): Promise<ManifestFull>;
  recordManifestPrint(tripId: string): Promise<string | null>;

  // Payments
  getPayments(bookingId: string): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;

  // Print Jobs
  createPrintJob(data: InsertPrintJob): Promise<PrintJob>;

  // Cargo Types
  getCargoTypes(): Promise<CargoType[]>;
  getCargoTypeById(id: string): Promise<CargoType | undefined>;
  createCargoType(data: InsertCargoType): Promise<CargoType>;
  updateCargoType(id: string, data: Partial<InsertCargoType>): Promise<CargoType>;
  deleteCargoType(id: string): Promise<void>;

  // Cargo Rates
  getCargoRates(cargoTypeId?: string): Promise<CargoRate[]>;
  getCargoRateById(id: string): Promise<CargoRate | undefined>;
  createCargoRate(data: InsertCargoRate): Promise<CargoRate>;
  updateCargoRate(id: string, data: Partial<InsertCargoRate>): Promise<CargoRate>;
  deleteCargoRate(id: string): Promise<void>;
  findCargoRate(cargoTypeId: string, originStopId: string, destinationStopId: string, tripId?: string): Promise<CargoRate | undefined>;

  // Cargo Shipments
  getCargoShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<CargoShipment[]>;
  getCargoShipmentById(id: string): Promise<CargoShipment | undefined>;
  getCargoShipmentByWaybill(waybillNumber: string): Promise<CargoShipment | undefined>;
  createCargoShipment(data: InsertCargoShipment): Promise<CargoShipment>;
  updateCargoShipment(id: string, data: Partial<InsertCargoShipment>): Promise<CargoShipment>;

  // Trip Cost Templates
  getTripCostTemplates(patternId?: string): Promise<TripCostTemplate[]>;
  getTripCostTemplateById(id: string): Promise<TripCostTemplate | undefined>;
  createTripCostTemplate(data: InsertTripCostTemplate): Promise<TripCostTemplate>;
  updateTripCostTemplate(id: string, data: Partial<InsertTripCostTemplate>): Promise<TripCostTemplate>;
  deleteTripCostTemplate(id: string): Promise<void>;

  // Trip Cost Items
  getTripCostItems(templateId: string): Promise<TripCostItem[]>;
  createTripCostItem(data: InsertTripCostItem): Promise<TripCostItem>;
  updateTripCostItem(id: string, data: Partial<InsertTripCostItem>): Promise<TripCostItem>;
  deleteTripCostItem(id: string): Promise<void>;

  // Promotions
  getPromotions(): Promise<Promotion[]>;
  getPromotionById(id: string): Promise<Promotion | undefined>;
  getPromotionByCode(code: string): Promise<Promotion | undefined>;
  createPromotion(data: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion>;
  deletePromotion(id: string): Promise<void>;
  incrementPromoUsage(id: string): Promise<void>;

  // Vouchers
  getVouchers(promoId?: string): Promise<Voucher[]>;
  getVoucherById(id: string): Promise<Voucher | undefined>;
  getVoucherByCode(code: string): Promise<Voucher | undefined>;
  createVoucher(data: InsertVoucher): Promise<Voucher>;
  updateVoucher(id: string, data: Partial<InsertVoucher>): Promise<Voucher>;
  deleteVoucher(id: string): Promise<void>;

  // Utility
  tripHasBookings(tripId: string): Promise<boolean>;
  getTripByBaseAndDate(baseId: string, serviceDate: string): Promise<Trip | undefined>;
  releaseHoldsForTrip(tripId: string): Promise<void>;
}

import { storage } from "./storage";
import { DriversController } from "./modules/drivers/drivers.controller";
import { StopsController } from "./modules/stops/stops.controller";
import { OutletsController } from "./modules/outlets/outlets.controller";
import { VehiclesController } from "./modules/vehicles/vehicles.controller";
import { LayoutsController } from "./modules/layouts/layouts.controller";
import { TripPatternsController } from "./modules/tripPatterns/tripPatterns.controller";
import { PatternStopsController } from "./modules/patternStops/patternStops.controller";
import { TripsController } from "./modules/trips/trips.controller";
import { TripBasesController } from "./modules/tripBases/tripBases.controller";
import { TripStopTimesController } from "./modules/tripStopTimes/tripStopTimes.controller";
import { TripLegsController } from "./modules/tripLegs/tripLegs.controller";
import { PriceRulesController } from "./modules/priceRules/priceRules.controller";
import { BookingsController } from "./modules/bookings/bookings.controller";
import { PaymentsController } from "./modules/payments/payments.controller";
import { CargoController } from "./modules/cargo/cargo.controller";
import { AppController } from "./modules/app/app.controller";
import { PromosController } from "./modules/promos/promos.controller";
import { SpjController } from "./modules/spj/spj.controller";
import { appAuthMiddleware, optionalAuthMiddleware } from "./modules/app/app.auth";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { requireAuth } from "./modules/auth/realmio";
import { requireFlag, requireOutletScope } from "./modules/rbac/rbac.middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  registerAuthRoutes(app);

  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/") || req.path.startsWith("/app/")) {
      return next();
    }
    requireAuth(req, res, next);
  });

  // Initialize controllers
  const driversController = new DriversController(storage);
  const stopsController = new StopsController(storage);
  const outletsController = new OutletsController(storage);
  const vehiclesController = new VehiclesController(storage);
  const layoutsController = new LayoutsController(storage);
  const tripPatternsController = new TripPatternsController(storage);
  const patternStopsController = new PatternStopsController(storage);
  const tripBasesService = new (await import('./modules/tripBases/tripBases.service')).TripBasesService(storage);
  const tripBasesController = new TripBasesController(tripBasesService);
  const tripsController = new TripsController(storage);
  const tripStopTimesController = new TripStopTimesController(storage);
  const tripLegsController = new TripLegsController(storage);
  const priceRulesController = new PriceRulesController(storage);
  const pricingController = new (await import('./modules/pricing/pricing.controller')).PricingController(storage);
  const bookingsController = new BookingsController(storage);
  const paymentsController = new PaymentsController(storage);
  const cargoController = new CargoController(storage);

  // Error handler middleware
  const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  // Permissions endpoint — returns effective flags, role, and outletId for the authenticated user
  app.get('/api/permissions/me', asyncHandler(async (req: Request, res: Response) => {
    const rbac = req.rbac;
    res.json({
      flags: rbac ? [...rbac.flags] : [],
      role: rbac?.roleId ?? null,
      outletId: rbac?.outletId ?? null,
    });
  }));

  // Drivers routes
  app.get('/api/drivers', asyncHandler(driversController.getAll.bind(driversController)));
  app.get('/api/drivers/:id', asyncHandler(driversController.getById.bind(driversController)));
  app.post('/api/drivers', requireFlag('master.drivers'), asyncHandler(driversController.create.bind(driversController)));
  app.put('/api/drivers/:id', requireFlag('master.drivers'), asyncHandler(driversController.update.bind(driversController)));
  app.delete('/api/drivers/:id', requireFlag('master.drivers'), asyncHandler(driversController.delete.bind(driversController)));

  // Stops routes
  app.get('/api/stops', asyncHandler(stopsController.getAll.bind(stopsController)));
  app.get('/api/stops/:id', asyncHandler(stopsController.getById.bind(stopsController)));
  app.post('/api/stops', requireFlag('master.stops'), asyncHandler(stopsController.create.bind(stopsController)));
  app.put('/api/stops/:id', requireFlag('master.stops'), asyncHandler(stopsController.update.bind(stopsController)));
  app.delete('/api/stops/:id', requireFlag('master.stops'), asyncHandler(stopsController.delete.bind(stopsController)));

  // Outlets routes
  app.get('/api/outlets', asyncHandler(outletsController.getAll.bind(outletsController)));
  app.get('/api/outlets/:id', asyncHandler(outletsController.getById.bind(outletsController)));
  app.post('/api/outlets', requireFlag('master.outlets'), asyncHandler(outletsController.create.bind(outletsController)));
  app.put('/api/outlets/:id', requireFlag('master.outlets'), asyncHandler(outletsController.update.bind(outletsController)));
  app.delete('/api/outlets/:id', requireFlag('master.outlets'), asyncHandler(outletsController.delete.bind(outletsController)));

  // Vehicles routes
  app.get('/api/vehicles', asyncHandler(vehiclesController.getAll.bind(vehiclesController)));
  app.get('/api/vehicles/:id', asyncHandler(vehiclesController.getById.bind(vehiclesController)));
  app.post('/api/vehicles', requireFlag('master.vehicles'), asyncHandler(vehiclesController.create.bind(vehiclesController)));
  app.put('/api/vehicles/:id', requireFlag('master.vehicles'), asyncHandler(vehiclesController.update.bind(vehiclesController)));
  app.delete('/api/vehicles/:id', requireFlag('master.vehicles'), asyncHandler(vehiclesController.delete.bind(vehiclesController)));

  // Layouts routes
  app.get('/api/layouts', asyncHandler(layoutsController.getAll.bind(layoutsController)));
  app.get('/api/layouts/:id', asyncHandler(layoutsController.getById.bind(layoutsController)));
  app.post('/api/layouts', requireFlag('master.layouts'), asyncHandler(layoutsController.create.bind(layoutsController)));
  app.put('/api/layouts/:id', requireFlag('master.layouts'), asyncHandler(layoutsController.update.bind(layoutsController)));
  app.delete('/api/layouts/:id', requireFlag('master.layouts'), asyncHandler(layoutsController.delete.bind(layoutsController)));

  // Trip Patterns routes
  app.get('/api/trip-patterns', asyncHandler(tripPatternsController.getAll.bind(tripPatternsController)));
  app.get('/api/trip-patterns/:id', asyncHandler(tripPatternsController.getById.bind(tripPatternsController)));
  app.post('/api/trip-patterns', requireFlag('master.trip_patterns'), asyncHandler(tripPatternsController.create.bind(tripPatternsController)));
  app.put('/api/trip-patterns/:id', requireFlag('master.trip_patterns'), asyncHandler(tripPatternsController.update.bind(tripPatternsController)));
  app.delete('/api/trip-patterns/:id', requireFlag('master.trip_patterns'), asyncHandler(tripPatternsController.delete.bind(tripPatternsController)));

  // Pattern Stops routes
  app.get('/api/trip-patterns/:patternId/stops', asyncHandler(patternStopsController.getByPattern.bind(patternStopsController)));
  app.post('/api/pattern-stops', requireFlag('master.trip_patterns'), asyncHandler(patternStopsController.create.bind(patternStopsController)));
  app.put('/api/pattern-stops/:id', requireFlag('master.trip_patterns'), asyncHandler(patternStopsController.update.bind(patternStopsController)));
  app.delete('/api/pattern-stops/:id', requireFlag('master.trip_patterns'), asyncHandler(patternStopsController.delete.bind(patternStopsController)));
  app.post('/api/trip-patterns/:patternId/stops/bulk-replace', requireFlag('master.trip_patterns'), asyncHandler(patternStopsController.bulkReplace.bind(patternStopsController)));

  // Trip Bases routes
  app.get('/api/trip-bases', asyncHandler(tripBasesController.getAllTripBases.bind(tripBasesController)));
  app.get('/api/trip-bases/:id', asyncHandler(tripBasesController.getTripBaseById.bind(tripBasesController)));
  app.post('/api/trip-bases', requireFlag('master.trips'), asyncHandler(tripBasesController.createTripBase.bind(tripBasesController)));
  app.put('/api/trip-bases/:id', requireFlag('master.trips'), asyncHandler(tripBasesController.updateTripBase.bind(tripBasesController)));
  app.delete('/api/trip-bases/:id', requireFlag('master.trips'), asyncHandler(tripBasesController.deleteTripBase.bind(tripBasesController)));

  // CSO Virtual Scheduling routes
  app.post('/api/cso/materialize-trip', requireFlag('action.trip.materialize'), asyncHandler(tripBasesController.materializeTrip.bind(tripBasesController)));
  app.post('/api/trips/:id/close', requireFlag('action.trip.close'), asyncHandler(tripBasesController.closeTrip.bind(tripBasesController)));

  // Trips routes
  app.get('/api/trips', requireOutletScope(), asyncHandler(tripsController.getAll.bind(tripsController)));
  app.get('/api/cso/available-trips', requireOutletScope(), asyncHandler(tripsController.getCsoAvailableTrips.bind(tripsController)));
  app.get('/api/trips/:id', asyncHandler(tripsController.getById.bind(tripsController)));
  app.post('/api/trips', requireFlag('master.trips'), asyncHandler(tripsController.create.bind(tripsController)));
  app.put('/api/trips/:id', requireFlag('master.trips'), asyncHandler(tripsController.update.bind(tripsController)));
  app.delete('/api/trips/:id', requireFlag('master.trips'), asyncHandler(tripsController.delete.bind(tripsController)));

  // Trip Stop Times routes
  app.get('/api/trips/:tripId/stop-times', asyncHandler(tripStopTimesController.getByTrip.bind(tripStopTimesController)));
  app.get('/api/trips/:tripId/stop-times/effective', asyncHandler(tripStopTimesController.getByTripWithEffectiveFlags.bind(tripStopTimesController)));
  app.post('/api/trips/:tripId/stop-times/bulk-upsert', asyncHandler(tripStopTimesController.bulkUpsert.bind(tripStopTimesController)));
  app.post('/api/trips/:tripId/stop-times/sync-from-pattern', asyncHandler(tripStopTimesController.syncFromPattern.bind(tripStopTimesController)));
  app.post('/api/trips/:tripId/derive-legs', asyncHandler(tripStopTimesController.deriveLegs.bind(tripStopTimesController)));
  app.post('/api/trips/:tripId/precompute-seat-inventory', asyncHandler(tripStopTimesController.precomputeSeatInventory.bind(tripStopTimesController)));
  app.post('/api/trip-stop-times', asyncHandler(tripStopTimesController.create.bind(tripStopTimesController)));
  app.put('/api/trip-stop-times/:id', asyncHandler(tripStopTimesController.update.bind(tripStopTimesController)));
  app.delete('/api/trip-stop-times/:id', asyncHandler(tripStopTimesController.delete.bind(tripStopTimesController)));

  // Seat map and availability
  app.get('/api/trips/:id/seatmap', asyncHandler(tripsController.getSeatmap.bind(tripsController)));
  app.get('/api/trips/:tripId/seats/:seatNo/passenger-details', asyncHandler(tripsController.getSeatPassengerDetails.bind(tripsController)));

  app.get('/api/trips/:id/unseated-passengers', asyncHandler(async (req, res) => {
    const passengers = await storage.getUnseatedPassengers(req.params.id);
    res.json(passengers);
  }));

  // Manifest — full manifest document per trip (header + passengers + cargo + summary)
  app.get('/api/trips/:id/manifest', asyncHandler(async (req, res) => {
    const manifest = await storage.getManifestFull(req.params.id);
    res.json(manifest);
  }));

  // Manifest print — record first print timestamp
  app.post('/api/trips/:id/manifest/print', asyncHandler(async (req, res) => {
    const firstPrintedAt = await storage.recordManifestPrint(req.params.id);
    res.json({ success: true, firstPrintedAt });
  }));

  // Seat holds
  app.post('/api/holds', asyncHandler(bookingsController.createHold.bind(bookingsController)));
  app.delete('/api/holds/:holdRef', asyncHandler(bookingsController.releaseHold.bind(bookingsController)));

  // Price Rules routes
  app.get('/api/price-rules', asyncHandler(priceRulesController.getAll.bind(priceRulesController)));
  app.post('/api/price-rules', requireFlag('master.price_rules'), asyncHandler(priceRulesController.create.bind(priceRulesController)));
  app.put('/api/price-rules/:id', requireFlag('master.price_rules'), asyncHandler(priceRulesController.update.bind(priceRulesController)));
  app.delete('/api/price-rules/:id', requireFlag('master.price_rules'), asyncHandler(priceRulesController.delete.bind(priceRulesController)));

  // Pricing routes
  app.get('/api/pricing/quote-fare', asyncHandler(pricingController.quoteFare.bind(pricingController)));

  // Bookings routes
  app.get('/api/bookings', requireOutletScope(), asyncHandler(bookingsController.getAll.bind(bookingsController)));
  // Lookup by booking code / PNR (must be before /:id)
  app.get('/api/bookings/by-code/:code', asyncHandler(async (req, res) => {
    const booking = await storage.getBookingByCode(req.params.code.toUpperCase());
    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });
    res.json(booking);
  }));
  app.get('/api/bookings/:id', asyncHandler(bookingsController.getById.bind(bookingsController)));
  app.post('/api/bookings', requireFlag('action.booking.create'), asyncHandler(bookingsController.create.bind(bookingsController)));
  app.post('/api/bookings/pending', requireFlag('action.booking.create'), asyncHandler(bookingsController.createPendingBooking.bind(bookingsController)));
  app.get('/api/bookings/pending', asyncHandler(bookingsController.getPendingBookings.bind(bookingsController)));
  app.delete('/api/bookings/pending/:id', asyncHandler(bookingsController.releasePendingBooking.bind(bookingsController)));

  app.post('/api/passengers/:passengerId/unseat', requireFlag('action.passenger.unseat'), asyncHandler(bookingsController.unseatPassenger.bind(bookingsController)));
  app.post('/api/passengers/:passengerId/assign-seat', requireFlag('action.passenger.assign_seat'), asyncHandler(bookingsController.assignSeatToUnseated.bind(bookingsController)));
  app.post('/api/passengers/:passengerId/reschedule', requireFlag('action.passenger.reschedule'), asyncHandler(bookingsController.reschedulePassenger.bind(bookingsController)));
  app.post('/api/bookings/:bookingId/unseat-all', requireFlag('action.passenger.unseat'), asyncHandler(bookingsController.unseatAllPassengers.bind(bookingsController)));
  app.get('/api/bookings/:bookingId/history', asyncHandler(bookingsController.getBookingHistory.bind(bookingsController)));

  // Ticket (passenger-level) cancel — cancel satu penumpang tanpa batalkan booking
  app.patch('/api/passengers/:id/cancel', requireFlag('action.booking.cancel'), asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Alasan pembatalan wajib diisi' });
    }
    const { db } = await import('./db');
    const { bookingHistory, passengers: passengersTable, seatInventory, bookings: bookingsTable } = await import('@shared/schema');
    const { eq, and, inArray } = await import('drizzle-orm');

    const [passengerRow] = await db.select().from(passengersTable).where(eq(passengersTable.id, req.params.id));
    if (!passengerRow) return res.status(404).json({ error: 'Penumpang tidak ditemukan' });
    if (passengerRow.ticketStatus === 'canceled') return res.status(400).json({ error: 'Tiket sudah dibatalkan' });

    const booking = await storage.getBookingById(passengerRow.bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });

    const previousStatus = passengerRow.ticketStatus || 'active';
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);

    const performedBy = req.headers['x-operator-id'] as string || 'default-operator';

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updated] = await tx.update(passengersTable)
        .set({ ticketStatus: 'canceled' })
        .where(eq(passengersTable.id, req.params.id))
        .returning();

      if (passengerRow.seatNo && legIndexes.length > 0) {
        await tx.update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            eq(seatInventory.seatNo, passengerRow.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));
      }

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId: req.params.id,
        action: 'canceled',
        details: {
          seatNo: passengerRow.seatNo,
          reason: reason.trim(),
          previousStatus
        },
        performedBy
      });

      const allPassengers = await tx.select().from(passengersTable).where(eq(passengersTable.bookingId, booking.id));
      const allInactive = allPassengers.every(p => p.ticketStatus === 'canceled' || p.ticketStatus === 'unseated');
      if (allInactive) {
        await tx.update(bookingsTable)
          .set({ status: 'canceled' })
          .where(eq(bookingsTable.id, booking.id));
      }

      return updated;
    });

    if (passengerRow.seatNo) {
      const { webSocketService } = await import('./realtime/ws');
      for (const legIdx of legIndexes) {
        webSocketService.emitInventoryUpdated(booking.tripId, passengerRow.seatNo, [legIdx]);
      }
    }

    res.json(updatedPassenger);
  }));

  // Lookup passenger by ticket number
  app.get('/api/tickets/:ticketNumber', asyncHandler(async (req, res) => {
    const passenger = await storage.getPassengerByTicketNumber(req.params.ticketNumber.toUpperCase());
    if (!passenger) return res.status(404).json({ message: 'Tiket tidak ditemukan' });
    res.json(passenger);
  }));

  // Payments routes
  app.get('/api/bookings/:bookingId/payments', asyncHandler(paymentsController.getByBooking.bind(paymentsController)));
  app.post('/api/payments', requireFlag('action.payment.create'), asyncHandler(paymentsController.create.bind(paymentsController)));

  // Cargo types routes
  app.get('/api/cargo-types', asyncHandler(cargoController.getCargoTypes.bind(cargoController)));
  app.get('/api/cargo-types/:id', asyncHandler(cargoController.getCargoTypeById.bind(cargoController)));
  app.post('/api/cargo-types', requireFlag('master.cargo_types'), asyncHandler(cargoController.createCargoType.bind(cargoController)));
  app.put('/api/cargo-types/:id', requireFlag('master.cargo_types'), asyncHandler(cargoController.updateCargoType.bind(cargoController)));
  app.delete('/api/cargo-types/:id', requireFlag('master.cargo_types'), asyncHandler(cargoController.deleteCargoType.bind(cargoController)));

  // Cargo rates routes
  app.get('/api/cargo-rates', asyncHandler(cargoController.getCargoRates.bind(cargoController)));
  app.get('/api/cargo-rates/:id', asyncHandler(cargoController.getCargoRateById.bind(cargoController)));
  app.post('/api/cargo-rates', requireFlag('master.cargo_rates'), asyncHandler(cargoController.createCargoRate.bind(cargoController)));
  app.put('/api/cargo-rates/:id', requireFlag('master.cargo_rates'), asyncHandler(cargoController.updateCargoRate.bind(cargoController)));
  app.delete('/api/cargo-rates/:id', requireFlag('master.cargo_rates'), asyncHandler(cargoController.deleteCargoRate.bind(cargoController)));

  // Cargo tariff quote
  app.get('/api/cargo/quote-tariff', asyncHandler(cargoController.quoteTariff.bind(cargoController)));

  // Cargo shipment routes
  app.get('/api/cargo', requireOutletScope(), asyncHandler(cargoController.getAll.bind(cargoController)));
  app.get('/api/cargo/waybill/:waybillNumber', asyncHandler(cargoController.getByWaybill.bind(cargoController)));
  app.get('/api/cargo/:id', asyncHandler(cargoController.getById.bind(cargoController)));
  app.post('/api/cargo', requireFlag('action.cargo.create'), requireOutletScope(), asyncHandler(cargoController.create.bind(cargoController)));
  app.put('/api/cargo/:id', requireFlag('action.cargo.manage'), asyncHandler(cargoController.update.bind(cargoController)));
  app.patch('/api/cargo/:id/status', requireFlag('action.cargo.manage'), asyncHandler(cargoController.updateStatus.bind(cargoController)));

  // Trip Cost Templates routes
  app.get('/api/cost-templates', asyncHandler(async (req: any, res: any) => {
    const patternId = req.query.patternId as string | undefined;
    const templates = await storage.getTripCostTemplates(patternId);
    const templatesWithItems = await Promise.all(
      templates.map(async (t) => {
        const items = await storage.getTripCostItems(t.id);
        return { ...t, items };
      })
    );
    res.json(templatesWithItems);
  }));
  app.get('/api/cost-templates/:id', asyncHandler(async (req: any, res: any) => {
    const template = await storage.getTripCostTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template tidak ditemukan' });
    const items = await storage.getTripCostItems(req.params.id);
    res.json({ ...template, items });
  }));
  app.post('/api/cost-templates', requireFlag('master.cost_templates'), asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const template = await storage.createTripCostTemplate(parsed.data);
    res.status(201).json(template);
  }));
  app.put('/api/cost-templates/:id', requireFlag('master.cost_templates'), asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const template = await storage.updateTripCostTemplate(req.params.id, parsed.data);
    res.json(template);
  }));
  app.delete('/api/cost-templates/:id', requireFlag('master.cost_templates'), asyncHandler(async (req: any, res: any) => {
    await storage.deleteTripCostTemplate(req.params.id);
    res.status(204).end();
  }));

  // Trip Cost Items routes
  app.get('/api/cost-templates/:templateId/items', asyncHandler(async (req: any, res: any) => {
    const items = await storage.getTripCostItems(req.params.templateId);
    res.json(items);
  }));
  app.post('/api/cost-templates/:templateId/items', requireFlag('master.cost_templates'), asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostItemSchema.safeParse({ ...req.body, templateId: req.params.templateId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createTripCostItem(parsed.data);
    res.status(201).json(item);
  }));
  app.put('/api/cost-items/:id', requireFlag('master.cost_templates'), asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.updateTripCostItem(req.params.id, parsed.data);
    res.json(item);
  }));
  app.delete('/api/cost-items/:id', requireFlag('master.cost_templates'), asyncHandler(async (req: any, res: any) => {
    await storage.deleteTripCostItem(req.params.id);
    res.status(204).end();
  }));

  // Promotions & Vouchers
  const promosController = new PromosController(storage);
  app.get('/api/promotions', asyncHandler(promosController.getPromotions.bind(promosController)));
  app.get('/api/promotions/:id', asyncHandler(promosController.getPromotionById.bind(promosController)));
  app.post('/api/promotions', requireFlag('master.promos'), asyncHandler(promosController.createPromotion.bind(promosController)));
  app.patch('/api/promotions/:id', requireFlag('master.promos'), asyncHandler(promosController.updatePromotion.bind(promosController)));
  app.delete('/api/promotions/:id', requireFlag('master.promos'), asyncHandler(promosController.deletePromotion.bind(promosController)));
  app.get('/api/vouchers', asyncHandler(promosController.getVouchers.bind(promosController)));
  app.post('/api/vouchers/generate', requireFlag('master.promos'), asyncHandler(promosController.generateVouchers.bind(promosController)));
  app.patch('/api/vouchers/:id/revoke', requireFlag('master.promos'), asyncHandler(promosController.revokeVoucher.bind(promosController)));
  app.delete('/api/vouchers/:id', requireFlag('master.promos'), asyncHandler(promosController.deleteVoucher.bind(promosController)));
  app.post('/api/promos/validate', asyncHandler(promosController.validatePromoCode.bind(promosController)));

  // SPJ routes
  const spjController = new SpjController();
  app.get('/api/spj', asyncHandler(spjController.getAll.bind(spjController)));
  app.get('/api/spj/:id', asyncHandler(spjController.getById.bind(spjController)));
  app.get('/api/spj/trip/:tripId', asyncHandler(spjController.getByTripId.bind(spjController)));
  app.post('/api/spj', requireFlag('action.spj.create'), asyncHandler(spjController.create.bind(spjController)));
  app.patch('/api/spj/:id/issue', requireFlag('action.spj.issue'), asyncHandler(spjController.issue.bind(spjController)));
  app.patch('/api/spj/:id/settle', requireFlag('action.spj.settle'), asyncHandler(spjController.settle.bind(spjController)));
  app.patch('/api/spj/:id/notes', requireFlag('action.spj.create'), asyncHandler(spjController.updateNotes.bind(spjController)));
  app.delete('/api/spj/:id', requireFlag('action.spj.create'), asyncHandler(spjController.delete.bind(spjController)));
  app.post('/api/spj/:spjId/cost-lines', requireFlag('action.spj.create'), asyncHandler(spjController.addCostLine.bind(spjController)));
  app.patch('/api/spj/cost-lines/:id', requireFlag('action.spj.create'), asyncHandler(spjController.updateCostLine.bind(spjController)));
  app.delete('/api/spj/cost-lines/:id', requireFlag('action.spj.create'), asyncHandler(spjController.deleteCostLine.bind(spjController)));
  app.get('/api/spj/trip/:tripId/profit', asyncHandler(spjController.getTripProfit.bind(spjController)));

  // Reports routes
  const { ReportsController } = await import('./modules/reports/reports.controller');
  const reportsController = new ReportsController();
  app.get('/api/reports/filter-options', asyncHandler(reportsController.getFilterOptions.bind(reportsController)));
  app.get('/api/reports/revenue', asyncHandler(reportsController.getRevenue.bind(reportsController)));
  app.get('/api/reports/sales', asyncHandler(reportsController.getSales.bind(reportsController)));
  app.get('/api/reports/trip-profitability', asyncHandler(reportsController.getTripProfitability.bind(reportsController)));
  app.get('/api/reports/load-factor', asyncHandler(reportsController.getLoadFactor.bind(reportsController)));
  app.get('/api/reports/cancellations', asyncHandler(reportsController.getCancellations.bind(reportsController)));
  app.get('/api/reports/cargo', asyncHandler(reportsController.getCargo.bind(reportsController)));
  app.get('/api/reports/payments', asyncHandler(reportsController.getPayments.bind(reportsController)));

  // ── Admin API (/api/admin/) ──────────────────────────────────

  // List all roles
  app.get('/api/admin/roles', requireFlag('admin.flags.manage'), asyncHandler(async (_req: any, res: any) => {
    const { db } = await import('./db');
    const { roles } = await import('../shared/schema');
    const allRoles = await db.select().from(roles);
    res.json(allRoles);
  }));

  // List all feature flags
  app.get('/api/admin/flags', requireFlag('admin.flags.manage'), asyncHandler(async (_req: any, res: any) => {
    const { db } = await import('./db');
    const { featureFlags } = await import('../shared/schema');
    const allFlags = await db.select().from(featureFlags);
    res.json(allFlags);
  }));

  // Get full role-flag matrix
  app.get('/api/admin/role-flags', requireFlag('admin.flags.manage'), asyncHandler(async (_req: any, res: any) => {
    const { db } = await import('./db');
    const { roleFlags } = await import('../shared/schema');
    const matrix = await db.select().from(roleFlags);
    res.json(matrix);
  }));

  // Toggle a role-flag entry (upsert)
  app.put('/api/admin/role-flags/:roleId/:flagId', requireFlag('admin.flags.manage'), asyncHandler(async (req: any, res: any) => {
    const { db } = await import('./db');
    const { roleFlags } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    const { roleId, flagId } = req.params;
    const { enabled } = req.body;
    const existing = await db.select().from(roleFlags).where(and(eq(roleFlags.roleId, roleId), eq(roleFlags.flagId, flagId))).limit(1);
    if (existing.length > 0) {
      await db.update(roleFlags).set({ enabled: !!enabled }).where(and(eq(roleFlags.roleId, roleId), eq(roleFlags.flagId, flagId)));
    } else if (enabled) {
      await db.insert(roleFlags).values({ roleId, flagId, enabled: true });
    }
    res.json({ roleId, flagId, enabled: !!enabled });
  }));

  // List all staff members
  app.get('/api/admin/staff', requireFlag('admin.staff.manage'), asyncHandler(async (_req: any, res: any) => {
    const { db } = await import('./db');
    const { staffMembers } = await import('../shared/schema');
    const list = await db.select({
      id: staffMembers.id,
      userId: staffMembers.userId,
      roleId: staffMembers.roleId,
      outletId: staffMembers.outletId,
      isActive: staffMembers.isActive,
      createdAt: staffMembers.createdAt,
    }).from(staffMembers);
    res.json(list);
  }));

  // Create staff member
  app.post('/api/admin/staff', requireFlag('admin.staff.manage'), asyncHandler(async (req: any, res: any) => {
    const { db } = await import('./db');
    const { staffMembers } = await import('../shared/schema');
    const { userId, roleId, outletId, isActive } = req.body;
    if (!userId || !roleId) return res.status(400).json({ message: 'userId and roleId are required' });
    const [created] = await db.insert(staffMembers).values({
      userId,
      roleId,
      outletId: outletId || null,
      isActive: isActive !== false,
    }).returning();
    res.status(201).json(created);
  }));

  // Update staff member
  app.put('/api/admin/staff/:id', requireFlag('admin.staff.manage'), asyncHandler(async (req: any, res: any) => {
    const { db } = await import('./db');
    const { staffMembers } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { id } = req.params;
    const { roleId, outletId, isActive } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (roleId !== undefined) updates.roleId = roleId;
    if (outletId !== undefined) updates.outletId = outletId || null;
    if (isActive !== undefined) updates.isActive = isActive;
    const [updated] = await db.update(staffMembers).set(updates).where(eq(staffMembers.id, id)).returning();
    if (!updated) return res.status(404).json({ message: 'Staff member not found' });
    res.json(updated);
  }));

  // Deactivate / delete staff member
  app.delete('/api/admin/staff/:id', requireFlag('admin.staff.manage'), asyncHandler(async (req: any, res: any) => {
    const { db } = await import('./db');
    const { staffMembers } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { id } = req.params;
    await db.update(staffMembers).set({ isActive: false }).where(eq(staffMembers.id, id));
    res.json({ success: true });
  }));

  // Seed data (includes RBAC seed at the end)
  app.post('/api/seed', asyncHandler(async (req: any, res: any) => {
    const { seedData } = await import('./seed');
    await seedData();
    res.json({ message: 'Seed data created successfully' });
  }));

  // RBAC seed only (idempotent, safe to run anytime)
  app.post('/api/seed/rbac', asyncHandler(async (req: any, res: any) => {
    const { seedRbac } = await import('./modules/rbac/rbac.seed');
    await seedRbac();
    res.json({ message: 'RBAC seed completed successfully' });
  }));

  // ── Mobile App API (/api/app/) ──────────────────────────────────
  // CORS middleware for mobile app API (allows cross-origin requests from Expo Web)
  app.use('/api/app', (req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  const appController = new AppController(storage);

  // Auth (public)
  app.post('/api/app/auth/register', asyncHandler(appController.register.bind(appController)));
  app.post('/api/app/auth/login', asyncHandler(appController.login.bind(appController)));
  app.get('/api/app/auth/me', appAuthMiddleware, asyncHandler(appController.getMe.bind(appController)));

  // Profile (authed)
  app.get('/api/app/profile', appAuthMiddleware, asyncHandler(appController.getProfile.bind(appController)));
  app.patch('/api/app/profile', appAuthMiddleware, asyncHandler(appController.updateProfile.bind(appController)));

  // Public discovery
  app.get('/api/app/cities', asyncHandler(appController.getCities.bind(appController)));
  app.get('/api/app/operators', asyncHandler(appController.getOperators.bind(appController)));
  app.get('/api/app/trips/search', asyncHandler(appController.searchTrips.bind(appController)));
  app.get('/api/app/trips/:id', asyncHandler(appController.getTripDetail.bind(appController)));
  app.get('/api/app/trips/:id/seatmap', asyncHandler(appController.getSeatmap.bind(appController)));
  app.get('/api/app/trips/:tripId/reviews', asyncHandler(appController.getTripReviews.bind(appController)));

  // Bookings (authed)
  app.post('/api/app/bookings', appAuthMiddleware, asyncHandler(appController.createBooking.bind(appController)));
  app.get('/api/app/bookings', appAuthMiddleware, asyncHandler(appController.getMyBookings.bind(appController)));
  app.get('/api/app/bookings/:id', appAuthMiddleware, asyncHandler(appController.getBookingDetail.bind(appController)));
  app.get('/api/app/bookings/:id/payment-status', appAuthMiddleware, asyncHandler(appController.getPaymentStatus.bind(appController)));
  app.post('/api/app/bookings/:id/cancel', appAuthMiddleware, asyncHandler(appController.cancelBooking.bind(appController)));

  app.post('/api/app/payments/webhook', asyncHandler(appController.paymentWebhook.bind(appController)));

  // Reviews (authed)
  app.post('/api/app/reviews', appAuthMiddleware, asyncHandler(appController.createReview.bind(appController)));

  // Cargo (public tracking, authed creation)
  app.get('/api/app/cargo/track/:waybillNumber', asyncHandler(appController.trackCargo.bind(appController)));
  app.get('/api/app/cargo/:waybillNumber', asyncHandler(appController.trackCargo.bind(appController)));
  app.post('/api/app/cargo', appAuthMiddleware, asyncHandler(appController.createCargo.bind(appController)));

  const httpServer = createServer(app);
  
  // Initialize WebSocket service
  webSocketService.initialize(httpServer);
  
  return httpServer;
}
