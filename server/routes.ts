import type { Express } from "express";
import { createServer, type Server } from "http";
import { webSocketService } from "./realtime/ws";
import { z } from "zod";
import { 
  insertStopSchema, insertOutletSchema, insertVehicleSchema, insertLayoutSchema,
  insertTripPatternSchema, insertPatternStopSchema, insertTripBaseSchema, insertTripSchema,
  insertTripStopTimeSchema, insertPriceRuleSchema, insertBookingSchema,
  insertPassengerSchema, insertPaymentSchema, insertCargoShipmentSchema,
  insertTripCostTemplateSchema, insertTripCostItemSchema,
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
  type CsoAvailableTrip
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
import { appAuthMiddleware, optionalAuthMiddleware } from "./modules/app/app.auth";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Drivers routes
  app.get('/api/drivers', asyncHandler(driversController.getAll.bind(driversController)));
  app.get('/api/drivers/:id', asyncHandler(driversController.getById.bind(driversController)));
  app.post('/api/drivers', asyncHandler(driversController.create.bind(driversController)));
  app.put('/api/drivers/:id', asyncHandler(driversController.update.bind(driversController)));
  app.delete('/api/drivers/:id', asyncHandler(driversController.delete.bind(driversController)));

  // Stops routes
  app.get('/api/stops', asyncHandler(stopsController.getAll.bind(stopsController)));
  app.get('/api/stops/:id', asyncHandler(stopsController.getById.bind(stopsController)));
  app.post('/api/stops', asyncHandler(stopsController.create.bind(stopsController)));
  app.put('/api/stops/:id', asyncHandler(stopsController.update.bind(stopsController)));
  app.delete('/api/stops/:id', asyncHandler(stopsController.delete.bind(stopsController)));

  // Outlets routes
  app.get('/api/outlets', asyncHandler(outletsController.getAll.bind(outletsController)));
  app.get('/api/outlets/:id', asyncHandler(outletsController.getById.bind(outletsController)));
  app.post('/api/outlets', asyncHandler(outletsController.create.bind(outletsController)));
  app.put('/api/outlets/:id', asyncHandler(outletsController.update.bind(outletsController)));
  app.delete('/api/outlets/:id', asyncHandler(outletsController.delete.bind(outletsController)));

  // Vehicles routes
  app.get('/api/vehicles', asyncHandler(vehiclesController.getAll.bind(vehiclesController)));
  app.get('/api/vehicles/:id', asyncHandler(vehiclesController.getById.bind(vehiclesController)));
  app.post('/api/vehicles', asyncHandler(vehiclesController.create.bind(vehiclesController)));
  app.put('/api/vehicles/:id', asyncHandler(vehiclesController.update.bind(vehiclesController)));
  app.delete('/api/vehicles/:id', asyncHandler(vehiclesController.delete.bind(vehiclesController)));

  // Layouts routes
  app.get('/api/layouts', asyncHandler(layoutsController.getAll.bind(layoutsController)));
  app.get('/api/layouts/:id', asyncHandler(layoutsController.getById.bind(layoutsController)));
  app.post('/api/layouts', asyncHandler(layoutsController.create.bind(layoutsController)));
  app.put('/api/layouts/:id', asyncHandler(layoutsController.update.bind(layoutsController)));
  app.delete('/api/layouts/:id', asyncHandler(layoutsController.delete.bind(layoutsController)));

  // Trip Patterns routes
  app.get('/api/trip-patterns', asyncHandler(tripPatternsController.getAll.bind(tripPatternsController)));
  app.get('/api/trip-patterns/:id', asyncHandler(tripPatternsController.getById.bind(tripPatternsController)));
  app.post('/api/trip-patterns', asyncHandler(tripPatternsController.create.bind(tripPatternsController)));
  app.put('/api/trip-patterns/:id', asyncHandler(tripPatternsController.update.bind(tripPatternsController)));
  app.delete('/api/trip-patterns/:id', asyncHandler(tripPatternsController.delete.bind(tripPatternsController)));

  // Pattern Stops routes
  app.get('/api/trip-patterns/:patternId/stops', asyncHandler(patternStopsController.getByPattern.bind(patternStopsController)));
  app.post('/api/pattern-stops', asyncHandler(patternStopsController.create.bind(patternStopsController)));
  app.put('/api/pattern-stops/:id', asyncHandler(patternStopsController.update.bind(patternStopsController)));
  app.delete('/api/pattern-stops/:id', asyncHandler(patternStopsController.delete.bind(patternStopsController)));
  app.post('/api/trip-patterns/:patternId/stops/bulk-replace', asyncHandler(patternStopsController.bulkReplace.bind(patternStopsController)));

  // Trip Bases routes
  app.get('/api/trip-bases', asyncHandler(tripBasesController.getAllTripBases.bind(tripBasesController)));
  app.get('/api/trip-bases/:id', asyncHandler(tripBasesController.getTripBaseById.bind(tripBasesController)));
  app.post('/api/trip-bases', asyncHandler(tripBasesController.createTripBase.bind(tripBasesController)));
  app.put('/api/trip-bases/:id', asyncHandler(tripBasesController.updateTripBase.bind(tripBasesController)));
  app.delete('/api/trip-bases/:id', asyncHandler(tripBasesController.deleteTripBase.bind(tripBasesController)));

  // CSO Virtual Scheduling routes
  app.post('/api/cso/materialize-trip', asyncHandler(tripBasesController.materializeTrip.bind(tripBasesController)));
  app.post('/api/trips/:id/close', asyncHandler(tripBasesController.closeTrip.bind(tripBasesController)));

  // Trips routes
  app.get('/api/trips', asyncHandler(tripsController.getAll.bind(tripsController)));
  app.get('/api/cso/available-trips', asyncHandler(tripsController.getCsoAvailableTrips.bind(tripsController)));
  app.get('/api/trips/:id', asyncHandler(tripsController.getById.bind(tripsController)));
  app.post('/api/trips', asyncHandler(tripsController.create.bind(tripsController)));
  app.put('/api/trips/:id', asyncHandler(tripsController.update.bind(tripsController)));
  app.delete('/api/trips/:id', asyncHandler(tripsController.delete.bind(tripsController)));

  // Trip Stop Times routes
  app.get('/api/trips/:tripId/stop-times', asyncHandler(tripStopTimesController.getByTrip.bind(tripStopTimesController)));
  app.get('/api/trips/:tripId/stop-times/effective', asyncHandler(tripStopTimesController.getByTripWithEffectiveFlags.bind(tripStopTimesController)));
  app.post('/api/trips/:tripId/stop-times/bulk-upsert', asyncHandler(tripStopTimesController.bulkUpsert.bind(tripStopTimesController)));
  app.post('/api/trips/:tripId/derive-legs', asyncHandler(tripStopTimesController.deriveLegs.bind(tripStopTimesController)));
  app.post('/api/trips/:tripId/precompute-seat-inventory', asyncHandler(tripStopTimesController.precomputeSeatInventory.bind(tripStopTimesController)));
  app.post('/api/trip-stop-times', asyncHandler(tripStopTimesController.create.bind(tripStopTimesController)));
  app.put('/api/trip-stop-times/:id', asyncHandler(tripStopTimesController.update.bind(tripStopTimesController)));
  app.delete('/api/trip-stop-times/:id', asyncHandler(tripStopTimesController.delete.bind(tripStopTimesController)));

  // Seat map and availability
  app.get('/api/trips/:id/seatmap', asyncHandler(tripsController.getSeatmap.bind(tripsController)));
  app.get('/api/trips/:tripId/seats/:seatNo/passenger-details', asyncHandler(tripsController.getSeatPassengerDetails.bind(tripsController)));

  // Manifest — operational passenger list per trip
  app.get('/api/trips/:id/manifest', asyncHandler(async (req, res) => {
    const manifest = await storage.getManifest(req.params.id);
    res.json(manifest);
  }));

  // Seat holds
  app.post('/api/holds', asyncHandler(bookingsController.createHold.bind(bookingsController)));
  app.delete('/api/holds/:holdRef', asyncHandler(bookingsController.releaseHold.bind(bookingsController)));

  // Price Rules routes
  app.get('/api/price-rules', asyncHandler(priceRulesController.getAll.bind(priceRulesController)));
  app.post('/api/price-rules', asyncHandler(priceRulesController.create.bind(priceRulesController)));
  app.put('/api/price-rules/:id', asyncHandler(priceRulesController.update.bind(priceRulesController)));
  app.delete('/api/price-rules/:id', asyncHandler(priceRulesController.delete.bind(priceRulesController)));

  // Pricing routes
  app.get('/api/pricing/quote-fare', asyncHandler(pricingController.quoteFare.bind(pricingController)));

  // Bookings routes
  app.get('/api/bookings', asyncHandler(bookingsController.getAll.bind(bookingsController)));
  // Lookup by booking code / PNR (must be before /:id)
  app.get('/api/bookings/by-code/:code', asyncHandler(async (req, res) => {
    const booking = await storage.getBookingByCode(req.params.code.toUpperCase());
    if (!booking) return res.status(404).json({ message: 'Booking tidak ditemukan' });
    res.json(booking);
  }));
  app.get('/api/bookings/:id', asyncHandler(bookingsController.getById.bind(bookingsController)));
  app.post('/api/bookings', asyncHandler(bookingsController.create.bind(bookingsController)));
  app.post('/api/bookings/pending', asyncHandler(bookingsController.createPendingBooking.bind(bookingsController)));
  app.get('/api/bookings/pending', asyncHandler(bookingsController.getPendingBookings.bind(bookingsController)));
  app.delete('/api/bookings/pending/:id', asyncHandler(bookingsController.releasePendingBooking.bind(bookingsController)));

  // Ticket (passenger-level) cancel — cancel satu penumpang tanpa batalkan booking
  app.patch('/api/passengers/:id/cancel', asyncHandler(async (req, res) => {
    const passenger = await storage.updatePassenger(req.params.id, { ticketStatus: 'canceled' });
    res.json(passenger);
  }));

  // Lookup passenger by ticket number
  app.get('/api/tickets/:ticketNumber', asyncHandler(async (req, res) => {
    const passenger = await storage.getPassengerByTicketNumber(req.params.ticketNumber.toUpperCase());
    if (!passenger) return res.status(404).json({ message: 'Tiket tidak ditemukan' });
    res.json(passenger);
  }));

  // Payments routes
  app.get('/api/bookings/:bookingId/payments', asyncHandler(paymentsController.getByBooking.bind(paymentsController)));
  app.post('/api/payments', asyncHandler(paymentsController.create.bind(paymentsController)));

  // Cargo types routes
  app.get('/api/cargo-types', asyncHandler(cargoController.getCargoTypes.bind(cargoController)));
  app.get('/api/cargo-types/:id', asyncHandler(cargoController.getCargoTypeById.bind(cargoController)));
  app.post('/api/cargo-types', asyncHandler(cargoController.createCargoType.bind(cargoController)));
  app.put('/api/cargo-types/:id', asyncHandler(cargoController.updateCargoType.bind(cargoController)));
  app.delete('/api/cargo-types/:id', asyncHandler(cargoController.deleteCargoType.bind(cargoController)));

  // Cargo rates routes
  app.get('/api/cargo-rates', asyncHandler(cargoController.getCargoRates.bind(cargoController)));
  app.get('/api/cargo-rates/:id', asyncHandler(cargoController.getCargoRateById.bind(cargoController)));
  app.post('/api/cargo-rates', asyncHandler(cargoController.createCargoRate.bind(cargoController)));
  app.put('/api/cargo-rates/:id', asyncHandler(cargoController.updateCargoRate.bind(cargoController)));
  app.delete('/api/cargo-rates/:id', asyncHandler(cargoController.deleteCargoRate.bind(cargoController)));

  // Cargo tariff quote
  app.get('/api/cargo/quote-tariff', asyncHandler(cargoController.quoteTariff.bind(cargoController)));

  // Cargo shipment routes
  app.get('/api/cargo', asyncHandler(cargoController.getAll.bind(cargoController)));
  app.get('/api/cargo/waybill/:waybillNumber', asyncHandler(cargoController.getByWaybill.bind(cargoController)));
  app.get('/api/cargo/:id', asyncHandler(cargoController.getById.bind(cargoController)));
  app.post('/api/cargo', asyncHandler(cargoController.create.bind(cargoController)));
  app.put('/api/cargo/:id', asyncHandler(cargoController.update.bind(cargoController)));
  app.patch('/api/cargo/:id/status', asyncHandler(cargoController.updateStatus.bind(cargoController)));

  // Trip Cost Templates routes
  app.get('/api/cost-templates', asyncHandler(async (req: any, res: any) => {
    const patternId = req.query.patternId as string | undefined;
    const templates = await storage.getTripCostTemplates(patternId);
    res.json(templates);
  }));
  app.get('/api/cost-templates/:id', asyncHandler(async (req: any, res: any) => {
    const template = await storage.getTripCostTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template tidak ditemukan' });
    const items = await storage.getTripCostItems(req.params.id);
    res.json({ ...template, items });
  }));
  app.post('/api/cost-templates', asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const template = await storage.createTripCostTemplate(parsed.data);
    res.status(201).json(template);
  }));
  app.put('/api/cost-templates/:id', asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const template = await storage.updateTripCostTemplate(req.params.id, parsed.data);
    res.json(template);
  }));
  app.delete('/api/cost-templates/:id', asyncHandler(async (req: any, res: any) => {
    await storage.deleteTripCostTemplate(req.params.id);
    res.status(204).end();
  }));

  // Trip Cost Items routes
  app.get('/api/cost-templates/:templateId/items', asyncHandler(async (req: any, res: any) => {
    const items = await storage.getTripCostItems(req.params.templateId);
    res.json(items);
  }));
  app.post('/api/cost-templates/:templateId/items', asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostItemSchema.safeParse({ ...req.body, templateId: req.params.templateId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createTripCostItem(parsed.data);
    res.status(201).json(item);
  }));
  app.put('/api/cost-items/:id', asyncHandler(async (req: any, res: any) => {
    const parsed = insertTripCostItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.updateTripCostItem(req.params.id, parsed.data);
    res.json(item);
  }));
  app.delete('/api/cost-items/:id', asyncHandler(async (req: any, res: any) => {
    await storage.deleteTripCostItem(req.params.id);
    res.status(204).end();
  }));

  // Seed data
  app.post('/api/seed', asyncHandler(async (req: any, res: any) => {
    const { seedData } = await import('./seed');
    await seedData();
    res.json({ message: 'Seed data created successfully' });
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
