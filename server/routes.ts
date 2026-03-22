import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
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
  getDrivers(): Promise<Driver[]>;
  getDriverById(id: string): Promise<Driver | undefined>;
  createDriver(data: InsertDriver): Promise<Driver>;
  updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver>;
  deleteDriver(id: string): Promise<void>;

  getStops(): Promise<Stop[]>;
  getStopById(id: string): Promise<Stop | undefined>;
  createStop(data: InsertStop): Promise<Stop>;
  updateStop(id: string, data: Partial<InsertStop>): Promise<Stop>;
  deleteStop(id: string): Promise<void>;

  getOutlets(): Promise<Outlet[]>;
  getOutletById(id: string): Promise<Outlet | undefined>;
  createOutlet(data: InsertOutlet): Promise<Outlet>;
  updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet>;
  deleteOutlet(id: string): Promise<void>;

  getVehicles(): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | undefined>;
  createVehicle(data: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<void>;

  getLayouts(): Promise<Layout[]>;
  getLayoutById(id: string): Promise<Layout | undefined>;
  createLayout(data: InsertLayout): Promise<Layout>;
  updateLayout(id: string, data: Partial<InsertLayout>): Promise<Layout>;
  deleteLayout(id: string): Promise<void>;

  getTripPatterns(): Promise<TripPattern[]>;
  getTripPatternById(id: string): Promise<TripPattern | undefined>;
  createTripPattern(data: InsertTripPattern): Promise<TripPattern>;
  updateTripPattern(id: string, data: Partial<InsertTripPattern>): Promise<TripPattern>;
  deleteTripPattern(id: string): Promise<void>;

  getPatternStops(patternId: string): Promise<Array<PatternStop & { stop: Stop | null }>>;
  createPatternStop(data: InsertPatternStop): Promise<PatternStop>;
  updatePatternStop(id: string, data: Partial<InsertPatternStop>): Promise<PatternStop>;
  deletePatternStop(id: string): Promise<void>;
  bulkReplacePatternStops(patternId: string, patternStops: InsertPatternStop[]): Promise<PatternStop[]>;

  getTripBases(): Promise<TripBase[]>;
  getTripBaseById(id: string): Promise<TripBase | undefined>;
  createTripBase(data: InsertTripBase): Promise<TripBase>;
  updateTripBase(id: string, data: Partial<InsertTripBase>): Promise<TripBase>;
  deleteTripBase(id: string): Promise<void>;

  getTrips(serviceDate?: string): Promise<TripWithDetails[]>;
  getCsoAvailableTrips(serviceDate: string, outletId: string): Promise<CsoAvailableTrip[]>;
  getTripById(id: string): Promise<Trip | undefined>;
  createTrip(data: InsertTrip): Promise<Trip>;
  updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip>;
  deleteTrip(id: string): Promise<void>;

  getTripStopTimes(tripId: string): Promise<TripStopTime[]>;
  getTripStopTimesWithEffectiveFlags(tripId: string): Promise<any[]>;
  createTripStopTime(data: InsertTripStopTime): Promise<TripStopTime>;
  updateTripStopTime(id: string, data: Partial<InsertTripStopTime>): Promise<TripStopTime>;
  deleteTripStopTime(id: string): Promise<void>;
  bulkUpsertTripStopTimes(tripId: string, stopTimes: any[]): Promise<void>;

  getTripLegs(tripId: string): Promise<TripLeg[]>;
  createTripLeg(data: any): Promise<TripLeg>;
  deleteTripLegs(tripId: string): Promise<void>;

  getSeatInventory(tripId: string, legIndexes?: number[]): Promise<SeatInventory[]>;
  createSeatInventory(data: any[]): Promise<SeatInventory[]>;
  updateSeatInventory(tripId: string, seatNo: string, legIndexes: number[], updates: any): Promise<void>;
  deleteSeatInventory(tripId: string): Promise<void>;

  getPriceRules(): Promise<PriceRule[]>;
  getPriceRulesForTrip(tripId: string, patternId: string): Promise<PriceRule[]>;
  createPriceRule(data: InsertPriceRule): Promise<PriceRule>;
  updatePriceRule(id: string, data: Partial<InsertPriceRule>): Promise<PriceRule>;
  deletePriceRule(id: string): Promise<void>;

  getBookings(tripId?: string): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  getBookingByCode(bookingCode: string): Promise<Booking | undefined>;
  createBooking(data: InsertBooking): Promise<Booking>;
  updateBooking(id: string, data: Partial<InsertBooking>): Promise<Booking>;

  getPassengers(bookingId: string): Promise<Passenger[]>;
  getPassengersByBookingIds(bookingIds: string[]): Promise<Passenger[]>;
  getPassengerByTicketNumber(ticketNumber: string): Promise<Passenger | undefined>;
  createPassenger(data: InsertPassenger): Promise<Passenger>;
  updatePassenger(id: string, data: Partial<InsertPassenger>): Promise<Passenger>;

  getManifest(tripId: string): Promise<ManifestEntry[]>;
  getManifestFull(tripId: string): Promise<ManifestFull>;
  recordManifestPrint(tripId: string): Promise<string | null>;

  getPayments(bookingId: string): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;

  createPrintJob(data: InsertPrintJob): Promise<PrintJob>;

  getCargoTypes(): Promise<CargoType[]>;
  getCargoTypeById(id: string): Promise<CargoType | undefined>;
  createCargoType(data: InsertCargoType): Promise<CargoType>;
  updateCargoType(id: string, data: Partial<InsertCargoType>): Promise<CargoType>;
  deleteCargoType(id: string): Promise<void>;

  getCargoRates(cargoTypeId?: string): Promise<CargoRate[]>;
  getCargoRateById(id: string): Promise<CargoRate | undefined>;
  createCargoRate(data: InsertCargoRate): Promise<CargoRate>;
  updateCargoRate(id: string, data: Partial<InsertCargoRate>): Promise<CargoRate>;
  deleteCargoRate(id: string): Promise<void>;
  findCargoRate(cargoTypeId: string, originStopId: string, destinationStopId: string, tripId?: string): Promise<CargoRate | undefined>;

  getCargoShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<CargoShipment[]>;
  getCargoShipmentById(id: string): Promise<CargoShipment | undefined>;
  getCargoShipmentByWaybill(waybillNumber: string): Promise<CargoShipment | undefined>;
  createCargoShipment(data: InsertCargoShipment): Promise<CargoShipment>;
  updateCargoShipment(id: string, data: Partial<InsertCargoShipment>): Promise<CargoShipment>;

  getTripCostTemplates(patternId?: string): Promise<TripCostTemplate[]>;
  getTripCostTemplateById(id: string): Promise<TripCostTemplate | undefined>;
  createTripCostTemplate(data: InsertTripCostTemplate): Promise<TripCostTemplate>;
  updateTripCostTemplate(id: string, data: Partial<InsertTripCostTemplate>): Promise<TripCostTemplate>;
  deleteTripCostTemplate(id: string): Promise<void>;

  getTripCostItems(templateId: string): Promise<TripCostItem[]>;
  createTripCostItem(data: InsertTripCostItem): Promise<TripCostItem>;
  updateTripCostItem(id: string, data: Partial<InsertTripCostItem>): Promise<TripCostItem>;
  deleteTripCostItem(id: string): Promise<void>;

  getPromotions(): Promise<Promotion[]>;
  getPromotionById(id: string): Promise<Promotion | undefined>;
  getPromotionByCode(code: string): Promise<Promotion | undefined>;
  createPromotion(data: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion>;
  deletePromotion(id: string): Promise<void>;
  incrementPromoUsage(id: string): Promise<void>;

  getVouchers(promoId?: string): Promise<Voucher[]>;
  getVoucherById(id: string): Promise<Voucher | undefined>;
  getVoucherByCode(code: string): Promise<Voucher | undefined>;
  createVoucher(data: InsertVoucher): Promise<Voucher>;
  updateVoucher(id: string, data: Partial<InsertVoucher>): Promise<Voucher>;
  deleteVoucher(id: string): Promise<void>;

  tripHasBookings(tripId: string): Promise<boolean>;
  getTripByBaseAndDate(baseId: string, serviceDate: string): Promise<Trip | undefined>;
  releaseHoldsForTrip(tripId: string): Promise<void>;
  getUnseatedPassengers(tripId: string): Promise<any[]>;
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
import { requireFlag, requireAnyFlag, requireOutletScope } from "./modules/rbac/rbac.middleware";

export async function registerRoutes(app: FastifyInstance): Promise<FastifyInstance> {
  registerAuthRoutes(app);

  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith("/api/auth/") || req.url.startsWith("/api/app/") || !req.url.startsWith("/api")) {
      return;
    }
    await requireAuth(req, reply);
  });

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

  app.get('/api/permissions/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const rbac = req.rbac;
    reply.send({
      flags: rbac ? [...rbac.flags] : [],
      role: rbac?.roleId ?? null,
      outletId: rbac?.outletId ?? null,
    });
  });

  const masterDataCache = {
    onSend: async (_req: FastifyRequest, reply: FastifyReply, payload: string) => {
      reply.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
      return payload;
    }
  };

  app.get('/api/drivers', { ...masterDataCache }, async (req, reply) => driversController.getAll(req, reply));
  app.get('/api/drivers/:id', { ...masterDataCache }, async (req, reply) => driversController.getById(req, reply));
  app.post('/api/drivers', { preHandler: [requireFlag('master.drivers')] }, async (req, reply) => driversController.create(req, reply));
  app.put('/api/drivers/:id', { preHandler: [requireFlag('master.drivers')] }, async (req, reply) => driversController.update(req, reply));
  app.delete('/api/drivers/:id', { preHandler: [requireFlag('master.drivers')] }, async (req, reply) => driversController.delete(req, reply));

  app.get('/api/stops', { ...masterDataCache }, async (req, reply) => stopsController.getAll(req, reply));
  app.get('/api/stops/:id', { ...masterDataCache }, async (req, reply) => stopsController.getById(req, reply));
  app.post('/api/stops', { preHandler: [requireFlag('master.stops')] }, async (req, reply) => stopsController.create(req, reply));
  app.put('/api/stops/:id', { preHandler: [requireFlag('master.stops')] }, async (req, reply) => stopsController.update(req, reply));
  app.delete('/api/stops/:id', { preHandler: [requireFlag('master.stops')] }, async (req, reply) => stopsController.delete(req, reply));

  app.get('/api/outlets', { ...masterDataCache }, async (req, reply) => outletsController.getAll(req, reply));
  app.get('/api/outlets/:id', { ...masterDataCache }, async (req, reply) => outletsController.getById(req, reply));
  app.post('/api/outlets', { preHandler: [requireFlag('master.outlets')] }, async (req, reply) => outletsController.create(req, reply));
  app.put('/api/outlets/:id', { preHandler: [requireFlag('master.outlets')] }, async (req, reply) => outletsController.update(req, reply));
  app.delete('/api/outlets/:id', { preHandler: [requireFlag('master.outlets')] }, async (req, reply) => outletsController.delete(req, reply));

  app.get('/api/vehicles', { ...masterDataCache }, async (req, reply) => vehiclesController.getAll(req, reply));
  app.get('/api/vehicles/:id', { ...masterDataCache }, async (req, reply) => vehiclesController.getById(req, reply));
  app.post('/api/vehicles', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => vehiclesController.create(req, reply));
  app.put('/api/vehicles/:id', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => vehiclesController.update(req, reply));
  app.delete('/api/vehicles/:id', { preHandler: [requireFlag('master.vehicles')] }, async (req, reply) => vehiclesController.delete(req, reply));

  app.get('/api/layouts', { ...masterDataCache }, async (req, reply) => layoutsController.getAll(req, reply));
  app.get('/api/layouts/:id', { ...masterDataCache }, async (req, reply) => layoutsController.getById(req, reply));
  app.post('/api/layouts', { preHandler: [requireFlag('master.layouts')] }, async (req, reply) => layoutsController.create(req, reply));
  app.put('/api/layouts/:id', { preHandler: [requireFlag('master.layouts')] }, async (req, reply) => layoutsController.update(req, reply));
  app.delete('/api/layouts/:id', { preHandler: [requireFlag('master.layouts')] }, async (req, reply) => layoutsController.delete(req, reply));

  app.get('/api/trip-patterns', { ...masterDataCache }, async (req, reply) => tripPatternsController.getAll(req, reply));
  app.get('/api/trip-patterns/:id', { ...masterDataCache }, async (req, reply) => tripPatternsController.getById(req, reply));
  app.post('/api/trip-patterns', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => tripPatternsController.create(req, reply));
  app.put('/api/trip-patterns/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => tripPatternsController.update(req, reply));
  app.delete('/api/trip-patterns/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => tripPatternsController.delete(req, reply));

  app.get('/api/trip-patterns/:patternId/stops', async (req, reply) => patternStopsController.getByPattern(req, reply));
  app.post('/api/pattern-stops', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.create(req, reply));
  app.put('/api/pattern-stops/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.update(req, reply));
  app.delete('/api/pattern-stops/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.delete(req, reply));
  app.post('/api/trip-patterns/:patternId/stops/bulk-replace', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.bulkReplace(req, reply));

  app.get('/api/trip-bases', async (req, reply) => tripBasesController.getAllTripBases(req, reply));
  app.get('/api/trip-bases/:id', async (req, reply) => tripBasesController.getTripBaseById(req, reply));
  app.post('/api/trip-bases', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripBasesController.createTripBase(req, reply));
  app.put('/api/trip-bases/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripBasesController.updateTripBase(req, reply));
  app.delete('/api/trip-bases/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripBasesController.deleteTripBase(req, reply));

  app.post('/api/cso/materialize-trip', { preHandler: [requireFlag('action.trip.materialize')] }, async (req, reply) => tripBasesController.materializeTrip(req, reply));
  app.post('/api/trips/:id/close', { preHandler: [requireFlag('action.trip.close')] }, async (req, reply) => tripBasesController.closeTrip(req, reply));

  app.get('/api/trips', { preHandler: [requireOutletScope()] }, async (req, reply) => tripsController.getAll(req, reply));
  app.get('/api/cso/available-trips', { preHandler: [requireOutletScope()] }, async (req, reply) => tripsController.getCsoAvailableTrips(req, reply));
  app.get('/api/trips/:id', async (req, reply) => tripsController.getById(req, reply));
  app.post('/api/trips', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripsController.create(req, reply));
  app.put('/api/trips/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripsController.update(req, reply));
  app.delete('/api/trips/:id', { preHandler: [requireFlag('master.trips')] }, async (req, reply) => tripsController.delete(req, reply));

  app.get('/api/trips/:tripId/stop-times', async (req, reply) => tripStopTimesController.getByTrip(req, reply));
  app.get('/api/trips/:tripId/stop-times/effective', async (req, reply) => tripStopTimesController.getByTripWithEffectiveFlags(req, reply));
  app.post('/api/trips/:tripId/stop-times/bulk-upsert', async (req, reply) => tripStopTimesController.bulkUpsert(req, reply));
  app.post('/api/trips/:tripId/stop-times/sync-from-pattern', async (req, reply) => tripStopTimesController.syncFromPattern(req, reply));
  app.post('/api/trips/:tripId/derive-legs', async (req, reply) => tripStopTimesController.deriveLegs(req, reply));
  app.post('/api/trips/:tripId/precompute-seat-inventory', async (req, reply) => tripStopTimesController.precomputeSeatInventory(req, reply));
  app.post('/api/trip-stop-times', async (req, reply) => tripStopTimesController.create(req, reply));
  app.put('/api/trip-stop-times/:id', async (req, reply) => tripStopTimesController.update(req, reply));
  app.delete('/api/trip-stop-times/:id', async (req, reply) => tripStopTimesController.delete(req, reply));

  app.get('/api/trips/:id/seatmap', async (req, reply) => tripsController.getSeatmap(req, reply));
  app.get('/api/trips/:tripId/seats/:seatNo/passenger-details', async (req, reply) => tripsController.getSeatPassengerDetails(req, reply));

  app.get('/api/trips/:id/unseated-passengers', async (req, reply) => {
    const passengers = await storage.getUnseatedPassengers((req.params as any).id);
    reply.send(passengers);
  });

  app.get('/api/trips/:id/manifest', async (req, reply) => {
    const manifest = await storage.getManifestFull((req.params as any).id);
    reply.send(manifest);
  });

  app.post('/api/trips/:id/manifest/print', async (req, reply) => {
    const firstPrintedAt = await storage.recordManifestPrint((req.params as any).id);
    reply.send({ success: true, firstPrintedAt });
  });

  app.post('/api/holds', async (req, reply) => bookingsController.createHold(req, reply));
  app.delete('/api/holds/:holdRef', async (req, reply) => bookingsController.releaseHold(req, reply));

  app.get('/api/price-rules', async (req, reply) => priceRulesController.getAll(req, reply));
  app.post('/api/price-rules', { preHandler: [requireFlag('master.price_rules')] }, async (req, reply) => priceRulesController.create(req, reply));
  app.put('/api/price-rules/:id', { preHandler: [requireFlag('master.price_rules')] }, async (req, reply) => priceRulesController.update(req, reply));
  app.delete('/api/price-rules/:id', { preHandler: [requireFlag('master.price_rules')] }, async (req, reply) => priceRulesController.delete(req, reply));

  app.get('/api/pricing/quote-fare', async (req, reply) => pricingController.quoteFare(req, reply));

  app.get('/api/bookings', { preHandler: [requireOutletScope()] }, async (req, reply) => bookingsController.getAll(req, reply));
  app.get('/api/bookings/by-code/:code', async (req, reply) => {
    const booking = await storage.getBookingByCode((req.params as any).code.toUpperCase());
    if (!booking) return reply.code(404).send({ message: 'Booking tidak ditemukan' });
    reply.send(booking);
  });
  app.get('/api/bookings/:id', async (req, reply) => bookingsController.getById(req, reply));
  app.post('/api/bookings', { preHandler: [requireFlag('action.booking.create')] }, async (req, reply) => bookingsController.create(req, reply));
  app.post('/api/bookings/pending', { preHandler: [requireFlag('action.booking.create')] }, async (req, reply) => bookingsController.createPendingBooking(req, reply));
  app.get('/api/bookings/pending', async (req, reply) => bookingsController.getPendingBookings(req, reply));
  app.delete('/api/bookings/pending/:id', async (req, reply) => bookingsController.releasePendingBooking(req, reply));

  app.post('/api/passengers/:passengerId/unseat', { preHandler: [requireFlag('action.passenger.unseat')] }, async (req, reply) => bookingsController.unseatPassenger(req, reply));
  app.post('/api/passengers/:passengerId/assign-seat', { preHandler: [requireFlag('action.passenger.assign_seat')] }, async (req, reply) => bookingsController.assignSeatToUnseated(req, reply));
  app.post('/api/passengers/:passengerId/reschedule', { preHandler: [requireFlag('action.passenger.reschedule')] }, async (req, reply) => bookingsController.reschedulePassenger(req, reply));
  app.post('/api/bookings/:bookingId/unseat-all', { preHandler: [requireFlag('action.passenger.unseat')] }, async (req, reply) => bookingsController.unseatAllPassengers(req, reply));
  app.get('/api/bookings/:bookingId/history', async (req, reply) => bookingsController.getBookingHistory(req, reply));

  app.patch('/api/passengers/:id/cancel', { preHandler: [requireFlag('action.booking.cancel')] }, async (req, reply) => {
    const { reason } = (req.body as any) || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return reply.code(400).send({ error: 'Alasan pembatalan wajib diisi' });
    }
    const { db } = await import('./db');
    const { bookingHistory, passengers: passengersTable, seatInventory, bookings: bookingsTable } = await import('@shared/schema');
    const { eq, and, inArray } = await import('drizzle-orm');

    const [passengerRow] = await db.select().from(passengersTable).where(eq(passengersTable.id, (req.params as any).id));
    if (!passengerRow) return reply.code(404).send({ error: 'Penumpang tidak ditemukan' });
    if (passengerRow.ticketStatus === 'canceled') return reply.code(400).send({ error: 'Tiket sudah dibatalkan' });

    const booking = await storage.getBookingById(passengerRow.bookingId);
    if (!booking) return reply.code(404).send({ error: 'Booking tidak ditemukan' });

    const previousStatus = passengerRow.ticketStatus || 'active';
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);

    const performedBy = req.headers['x-operator-id'] as string || 'default-operator';

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updated] = await tx.update(passengersTable)
        .set({ ticketStatus: 'canceled' })
        .where(eq(passengersTable.id, (req.params as any).id))
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
        passengerId: (req.params as any).id,
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

    reply.send(updatedPassenger);
  });

  app.get('/api/tickets/:ticketNumber', async (req, reply) => {
    const passenger = await storage.getPassengerByTicketNumber((req.params as any).ticketNumber.toUpperCase());
    if (!passenger) return reply.code(404).send({ message: 'Tiket tidak ditemukan' });
    reply.send(passenger);
  });

  app.get('/api/bookings/:bookingId/payments', async (req, reply) => paymentsController.getByBooking(req, reply));
  app.post('/api/payments', { preHandler: [requireFlag('action.payment.create')] }, async (req, reply) => paymentsController.create(req, reply));

  app.get('/api/cargo-types', async (req, reply) => cargoController.getCargoTypes(req, reply));
  app.get('/api/cargo-types/:id', async (req, reply) => cargoController.getCargoTypeById(req, reply));
  app.post('/api/cargo-types', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.createCargoType(req, reply));
  app.put('/api/cargo-types/:id', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.updateCargoType(req, reply));
  app.delete('/api/cargo-types/:id', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.deleteCargoType(req, reply));

  app.get('/api/cargo-rates', async (req, reply) => cargoController.getCargoRates(req, reply));
  app.get('/api/cargo-rates/:id', async (req, reply) => cargoController.getCargoRateById(req, reply));
  app.post('/api/cargo-rates', { preHandler: [requireFlag('master.cargo_rates')] }, async (req, reply) => cargoController.createCargoRate(req, reply));
  app.put('/api/cargo-rates/:id', { preHandler: [requireFlag('master.cargo_rates')] }, async (req, reply) => cargoController.updateCargoRate(req, reply));
  app.delete('/api/cargo-rates/:id', { preHandler: [requireFlag('master.cargo_rates')] }, async (req, reply) => cargoController.deleteCargoRate(req, reply));

  app.get('/api/cargo/quote-tariff', async (req, reply) => cargoController.quoteTariff(req, reply));

  app.get('/api/cargo', { preHandler: [requireOutletScope()] }, async (req, reply) => cargoController.getAll(req, reply));
  app.get('/api/cargo/waybill/:waybillNumber', async (req, reply) => cargoController.getByWaybill(req, reply));
  app.get('/api/cargo/:id', async (req, reply) => cargoController.getById(req, reply));
  app.post('/api/cargo', { preHandler: [requireFlag('action.cargo.create'), requireOutletScope()] }, async (req, reply) => cargoController.create(req, reply));
  app.put('/api/cargo/:id', { preHandler: [requireFlag('action.cargo.manage')] }, async (req, reply) => cargoController.update(req, reply));
  app.patch('/api/cargo/:id/status', { preHandler: [requireFlag('action.cargo.manage')] }, async (req, reply) => cargoController.updateStatus(req, reply));

  app.get('/api/cost-templates', async (req: any, reply: any) => {
    const patternId = req.query.patternId as string | undefined;
    const templates = await storage.getTripCostTemplates(patternId);
    const templatesWithItems = await Promise.all(
      templates.map(async (t) => {
        const items = await storage.getTripCostItems(t.id);
        return { ...t, items };
      })
    );
    reply.send(templatesWithItems);
  });
  app.get('/api/cost-templates/:id', async (req: any, reply: any) => {
    const template = await storage.getTripCostTemplateById(req.params.id);
    if (!template) return reply.code(404).send({ message: 'Template tidak ditemukan' });
    const items = await storage.getTripCostItems(req.params.id);
    reply.send({ ...template, items });
  });
  app.post('/api/cost-templates', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostTemplateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const template = await storage.createTripCostTemplate(parsed.data);
    reply.code(201).send(template);
  });
  app.put('/api/cost-templates/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const template = await storage.updateTripCostTemplate(req.params.id, parsed.data);
    reply.send(template);
  });
  app.delete('/api/cost-templates/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    await storage.deleteTripCostTemplate(req.params.id);
    reply.code(204).send();
  });

  app.get('/api/cost-templates/:templateId/items', async (req: any, reply: any) => {
    const items = await storage.getTripCostItems(req.params.templateId);
    reply.send(items);
  });
  app.post('/api/cost-templates/:templateId/items', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostItemSchema.safeParse({ ...req.body, templateId: req.params.templateId });
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const item = await storage.createTripCostItem(parsed.data);
    reply.code(201).send(item);
  });
  app.put('/api/cost-items/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const item = await storage.updateTripCostItem(req.params.id, parsed.data);
    reply.send(item);
  });
  app.delete('/api/cost-items/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    await storage.deleteTripCostItem(req.params.id);
    reply.code(204).send();
  });

  const promosController = new PromosController(storage);
  app.get('/api/promotions', async (req, reply) => promosController.getPromotions(req, reply));
  app.get('/api/promotions/:id', async (req, reply) => promosController.getPromotionById(req, reply));
  app.post('/api/promotions', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.createPromotion(req, reply));
  app.patch('/api/promotions/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.updatePromotion(req, reply));
  app.delete('/api/promotions/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.deletePromotion(req, reply));
  app.get('/api/vouchers', async (req, reply) => promosController.getVouchers(req, reply));
  app.post('/api/vouchers/generate', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.generateVouchers(req, reply));
  app.patch('/api/vouchers/:id/revoke', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.revokeVoucher(req, reply));
  app.delete('/api/vouchers/:id', { preHandler: [requireFlag('master.promos')] }, async (req, reply) => promosController.deleteVoucher(req, reply));
  app.post('/api/promos/validate', async (req, reply) => promosController.validatePromoCode(req, reply));

  const spjController = new SpjController();
  app.get('/api/spj', async (req, reply) => spjController.getAll(req, reply));
  app.get('/api/spj/:id', async (req, reply) => spjController.getById(req, reply));
  app.get('/api/spj/trip/:tripId', async (req, reply) => spjController.getByTripId(req, reply));
  app.post('/api/spj', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.create(req, reply));
  app.patch('/api/spj/:id/issue', { preHandler: [requireFlag('action.spj.issue')] }, async (req, reply) => spjController.issue(req, reply));
  app.patch('/api/spj/:id/settle', { preHandler: [requireFlag('action.spj.settle')] }, async (req, reply) => spjController.settle(req, reply));
  app.patch('/api/spj/:id/notes', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.updateNotes(req, reply));
  app.delete('/api/spj/:id', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.delete(req, reply));
  app.post('/api/spj/:spjId/cost-lines', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.addCostLine(req, reply));
  app.patch('/api/spj/cost-lines/:id', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.updateCostLine(req, reply));
  app.delete('/api/spj/cost-lines/:id', { preHandler: [requireFlag('action.spj.create')] }, async (req, reply) => spjController.deleteCostLine(req, reply));
  app.get('/api/spj/trip/:tripId/profit', async (req, reply) => spjController.getTripProfit(req, reply));

  const { ReportsController } = await import('./modules/reports/reports.controller');
  const reportsController = new ReportsController();
  app.get('/api/reports/filter-options', async (req, reply) => reportsController.getFilterOptions(req, reply));
  app.get('/api/reports/revenue', async (req, reply) => reportsController.getRevenue(req, reply));
  app.get('/api/reports/sales', async (req, reply) => reportsController.getSales(req, reply));
  app.get('/api/reports/trip-profitability', async (req, reply) => reportsController.getTripProfitability(req, reply));
  app.get('/api/reports/load-factor', async (req, reply) => reportsController.getLoadFactor(req, reply));
  app.get('/api/reports/cancellations', async (req, reply) => reportsController.getCancellations(req, reply));
  app.get('/api/reports/cargo', async (req, reply) => reportsController.getCargo(req, reply));
  app.get('/api/reports/payments', async (req, reply) => reportsController.getPayments(req, reply));

  app.get('/api/admin/roles', { preHandler: [requireAnyFlag('admin.flags.manage', 'admin.staff.manage')] }, async (_req: any, reply: any) => {
    const { db } = await import('./db');
    const { roles } = await import('../shared/schema');
    const allRoles = await db.select().from(roles);
    reply.send(allRoles);
  });

  app.get('/api/admin/flags', { preHandler: [requireFlag('admin.flags.manage')] }, async (_req: any, reply: any) => {
    const { db } = await import('./db');
    const { featureFlags } = await import('../shared/schema');
    const allFlags = await db.select().from(featureFlags);
    reply.send(allFlags);
  });

  app.get('/api/admin/role-flags', { preHandler: [requireFlag('admin.flags.manage')] }, async (_req: any, reply: any) => {
    const { db } = await import('./db');
    const { roleFlags } = await import('../shared/schema');
    const matrix = await db.select().from(roleFlags);
    reply.send(matrix);
  });

  app.put('/api/admin/role-flags/:roleId/:flagId', { preHandler: [requireFlag('admin.flags.manage')] }, async (req: any, reply: any) => {
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
    reply.send({ roleId, flagId, enabled: !!enabled });
  });

  app.get('/api/admin/staff', { preHandler: [requireFlag('admin.staff.manage')] }, async (_req: any, reply: any) => {
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
    reply.send(list);
  });

  app.post('/api/admin/staff', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: any, reply: any) => {
    const { db } = await import('./db');
    const { staffMembers } = await import('../shared/schema');
    const { userId, roleId, outletId, isActive } = req.body;
    if (!userId || !roleId) return reply.code(400).send({ message: 'userId and roleId are required' });
    const [created] = await db.insert(staffMembers).values({
      userId,
      roleId,
      outletId: outletId || null,
      isActive: isActive !== false,
    }).returning();
    reply.code(201).send(created);
  });

  app.put('/api/admin/staff/:id', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: any, reply: any) => {
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
    if (!updated) return reply.code(404).send({ message: 'Staff member not found' });
    reply.send(updated);
  });

  app.delete('/api/admin/staff/:id', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: any, reply: any) => {
    const { db } = await import('./db');
    const { staffMembers } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    const { id } = req.params;
    await db.update(staffMembers).set({ isActive: false }).where(eq(staffMembers.id, id));
    reply.send({ success: true });
  });

  app.post('/api/seed', async (req: any, reply: any) => {
    const { seedData } = await import('./seed');
    await seedData();
    reply.send({ message: 'Seed data created successfully' });
  });

  app.post('/api/seed/rbac', async (req: any, reply: any) => {
    const { seedRbac } = await import('./modules/rbac/rbac.seed');
    await seedRbac();
    reply.send({ message: 'RBAC seed completed successfully' });
  });

  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/app/')) return;
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  app.options('/api/app/*', async (_req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.code(204).send();
  });

  const appController = new AppController(storage);

  app.post('/api/app/auth/register', async (req, reply) => appController.register(req, reply));
  app.post('/api/app/auth/login', async (req, reply) => appController.login(req, reply));
  app.get('/api/app/auth/me', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getMe(req, reply));

  app.get('/api/app/profile', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getProfile(req, reply));
  app.patch('/api/app/profile', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.updateProfile(req, reply));

  app.get('/api/app/cities', async (req, reply) => appController.getCities(req, reply));
  app.get('/api/app/operators', async (req, reply) => appController.getOperators(req, reply));
  app.get('/api/app/trips/search', async (req, reply) => appController.searchTrips(req, reply));
  app.get('/api/app/trips/:id', async (req, reply) => appController.getTripDetail(req, reply));
  app.get('/api/app/trips/:id/seatmap', async (req, reply) => appController.getSeatmap(req, reply));
  app.get('/api/app/trips/:tripId/reviews', async (req, reply) => appController.getTripReviews(req, reply));

  app.post('/api/app/bookings', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createBooking(req, reply));
  app.get('/api/app/bookings', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getMyBookings(req, reply));
  app.get('/api/app/bookings/:id', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getBookingDetail(req, reply));
  app.get('/api/app/bookings/:id/payment-status', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.getPaymentStatus(req, reply));
  app.post('/api/app/bookings/:id/cancel', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.cancelBooking(req, reply));

  app.post('/api/app/payments/webhook', async (req, reply) => appController.paymentWebhook(req, reply));

  app.post('/api/app/reviews', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createReview(req, reply));

  app.get('/api/app/cargo/track/:waybillNumber', async (req, reply) => appController.trackCargo(req, reply));
  app.get('/api/app/cargo/:waybillNumber', async (req, reply) => appController.trackCargo(req, reply));
  app.post('/api/app/cargo', { preHandler: [appAuthMiddleware] }, async (req, reply) => appController.createCargo(req, reply));

  return app;
}
