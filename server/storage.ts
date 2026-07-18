import {
  IStorage, ManifestEntry, ManifestFull,
  TripStopTimeWithEffectiveFlags, BulkUpsertStopTimeInput,
  ActivePassengerForTrip, UnseatedPassengerForTrip,
} from "./storage.interface";
import {
  FleetRepository, NetworkRepository, SchedulingRepository,
  BookingRepository, CargoRepository, FinanceRepository
} from "./repositories";
import { getRequestContext } from "./lib/requestContext";
import type {
  Driver, InsertDriver, Stop, InsertStop, Outlet, InsertOutlet,
  Vehicle, InsertVehicle, Layout, InsertLayout,
  TripPattern, InsertTripPattern, PatternStop, InsertPatternStop,
  TripBase, InsertTripBase, Trip, InsertTrip, TripWithDetails,
  TripStopTime, InsertTripStopTime, TripLeg, InsertTripLeg,
  SeatInventory, InsertSeatInventory,
  Booking, InsertBooking, Passenger, InsertPassenger,
  Payment, InsertPayment, PrintJob, InsertPrintJob,
  CargoShipment, CargoShipmentListItem, InsertCargoShipment, CargoType, InsertCargoType,
  CsoAvailableTrip, CargoAvailableTrip,
  TripCostTemplate, InsertTripCostTemplate, TripCostItem, InsertTripCostItem,
  Promotion, InsertPromotion, PromoCondition, PromoConditionInput, Voucher, InsertVoucher,
  BookingPromoApplication, InsertBookingPromoApplication
} from "@shared/schema";

export class DatabaseStorage implements IStorage {
  private fleet = new FleetRepository();
  private network = new NetworkRepository();
  private scheduling = new SchedulingRepository();
  private booking = new BookingRepository();
  private cargo = new CargoRepository();
  private finance = new FinanceRepository();

  // Fleet
  getDrivers(): Promise<Driver[]> { return this.fleet.getDrivers(); }
  getDriverById(id: string): Promise<Driver | undefined> { return this.fleet.getDriverById(id); }
  createDriver(data: InsertDriver): Promise<Driver> { return this.fleet.createDriver(data); }
  updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver> { return this.fleet.updateDriver(id, data); }
  deleteDriver(id: string): Promise<void> { return this.fleet.deleteDriver(id); }
  getVehicles(): Promise<Vehicle[]> { return this.fleet.getVehicles(); }
  getVehicleById(id: string): Promise<Vehicle | undefined> {
    const ctx = getRequestContext();
    if (!ctx) return this.fleet.getVehicleById(id);
    const cached = ctx.vehicleCache.get(id);
    if (cached) return cached;
    const promise = this.fleet.getVehicleById(id);
    ctx.vehicleCache.set(id, promise);
    promise.catch(() => { ctx.vehicleCache.delete(id); });
    return promise;
  }
  createVehicle(data: InsertVehicle): Promise<Vehicle> { return this.fleet.createVehicle(data); }
  updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle> {
    getRequestContext()?.vehicleCache.delete(id);
    return this.fleet.updateVehicle(id, data);
  }
  deleteVehicle(id: string): Promise<void> {
    getRequestContext()?.vehicleCache.delete(id);
    return this.fleet.deleteVehicle(id);
  }
  getLayouts(): Promise<Layout[]> { return this.fleet.getLayouts(); }
  getLayoutById(id: string): Promise<Layout | undefined> {
    const ctx = getRequestContext();
    if (!ctx) return this.fleet.getLayoutById(id);
    const cached = ctx.layoutCache.get(id);
    if (cached) return cached;
    const promise = this.fleet.getLayoutById(id);
    ctx.layoutCache.set(id, promise);
    promise.catch(() => { ctx.layoutCache.delete(id); });
    return promise;
  }
  createLayout(data: InsertLayout): Promise<Layout> { return this.fleet.createLayout(data); }
  updateLayout(id: string, data: Partial<InsertLayout>): Promise<Layout> {
    getRequestContext()?.layoutCache.delete(id);
    return this.fleet.updateLayout(id, data);
  }
  deleteLayout(id: string): Promise<void> {
    getRequestContext()?.layoutCache.delete(id);
    return this.fleet.deleteLayout(id);
  }

  // Network
  getStops(): Promise<Stop[]> { return this.network.getStops(); }
  getStopById(id: string): Promise<Stop | undefined> {
    const ctx = getRequestContext();
    if (!ctx) return this.network.getStopById(id);
    const cached = ctx.stopCache.get(id);
    if (cached) return cached;
    const promise = this.network.getStopById(id);
    ctx.stopCache.set(id, promise);
    promise.catch(() => { ctx.stopCache.delete(id); });
    return promise;
  }
  getStopsByIds(ids: string[]): Promise<Stop[]> { return this.network.getStopsByIds(ids); }
  createStop(data: InsertStop): Promise<Stop> { return this.network.createStop(data); }
  updateStop(id: string, data: Partial<InsertStop>): Promise<Stop> {
    getRequestContext()?.stopCache.delete(id);
    return this.network.updateStop(id, data);
  }
  deleteStop(id: string): Promise<void> {
    getRequestContext()?.stopCache.delete(id);
    return this.network.deleteStop(id);
  }
  getOutlets(): Promise<Outlet[]> { return this.network.getOutlets(); }
  getOutletById(id: string): Promise<Outlet | undefined> {
    const ctx = getRequestContext();
    if (!ctx) return this.network.getOutletById(id);
    const cached = ctx.outletCache.get(id);
    if (cached) return cached;
    const promise = this.network.getOutletById(id);
    ctx.outletCache.set(id, promise);
    promise.catch(() => { ctx.outletCache.delete(id); });
    return promise;
  }
  getOutletsByIds(ids: string[]): Promise<Outlet[]> { return this.network.getOutletsByIds(ids); }
  createOutlet(data: InsertOutlet): Promise<Outlet> { return this.network.createOutlet(data); }
  updateOutlet(id: string, data: Partial<InsertOutlet>): Promise<Outlet> {
    getRequestContext()?.outletCache.delete(id);
    return this.network.updateOutlet(id, data);
  }
  deleteOutlet(id: string): Promise<void> {
    getRequestContext()?.outletCache.delete(id);
    return this.network.deleteOutlet(id);
  }

  // Scheduling
  getTripPatterns(): Promise<TripPattern[]> { return this.scheduling.getTripPatterns(); }
  getTripPatternById(id: string): Promise<TripPattern | undefined> {
    const ctx = getRequestContext();
    if (!ctx) return this.scheduling.getTripPatternById(id);
    const cached = ctx.tripPatternCache.get(id);
    if (cached) return cached;
    const promise = this.scheduling.getTripPatternById(id);
    ctx.tripPatternCache.set(id, promise);
    promise.catch(() => { ctx.tripPatternCache.delete(id); });
    return promise;
  }
  createTripPattern(data: InsertTripPattern): Promise<TripPattern> { return this.scheduling.createTripPattern(data); }
  updateTripPattern(id: string, data: Partial<InsertTripPattern>): Promise<TripPattern> {
    getRequestContext()?.tripPatternCache.delete(id);
    return this.scheduling.updateTripPattern(id, data);
  }
  deleteTripPattern(id: string): Promise<void> {
    getRequestContext()?.tripPatternCache.delete(id);
    return this.scheduling.deleteTripPattern(id);
  }
  getPatternStops(patternId: string): Promise<Array<PatternStop & { stop: Stop | null }>> { return this.scheduling.getPatternStops(patternId); }
  getPatternStopsByPatternIds(patternIds: string[]): Promise<Map<string, Array<PatternStop & { stop: Stop | null }>>> { return this.scheduling.getPatternStopsByPatternIds(patternIds); }
  getTripPatternsByIds(patternIds: string[]): Promise<Map<string, TripPattern>> { return this.scheduling.getTripPatternsByIds(patternIds); }
  createPatternStop(data: InsertPatternStop): Promise<PatternStop> { return this.scheduling.createPatternStop(data); }
  updatePatternStop(id: string, data: Partial<InsertPatternStop>): Promise<PatternStop> { return this.scheduling.updatePatternStop(id, data); }
  deletePatternStop(id: string): Promise<void> { return this.scheduling.deletePatternStop(id); }
  bulkReplacePatternStops(patternId: string, stops: InsertPatternStop[]): Promise<PatternStop[]> { return this.scheduling.bulkReplacePatternStops(patternId, stops); }
  getTripBases(): Promise<TripBase[]> { return this.scheduling.getTripBases(); }
  getTripBaseById(id: string): Promise<TripBase | undefined> { return this.scheduling.getTripBaseById(id); }
  createTripBase(data: InsertTripBase): Promise<TripBase> { return this.scheduling.createTripBase(data); }
  updateTripBase(id: string, data: Partial<InsertTripBase>): Promise<TripBase> { return this.scheduling.updateTripBase(id, data); }
  deleteTripBase(id: string): Promise<void> { return this.scheduling.deleteTripBase(id); }
  getTrips(serviceDate?: string, opts?: { limit?: number }): Promise<TripWithDetails[]> { return this.scheduling.getTrips(serviceDate, opts); }
  getTripsForDateRange(fromDate: string, toDate: string, opts?: { limit?: number }): Promise<TripWithDetails[]> { return this.scheduling.getTripsForDateRange(fromDate, toDate, opts); }
  getCsoAvailableTrips(serviceDate: string, outletId: string): Promise<CsoAvailableTrip[]> {
    return this.scheduling.getCsoAvailableTrips(serviceDate, outletId, (id) => this.network.getOutletById(id));
  }
  getCargoAvailableTrips(serviceDate: string, originStopId: string, destinationStopIds: string[]): Promise<CargoAvailableTrip[]> {
    return this.scheduling.getCargoAvailableTrips(serviceDate, originStopId, destinationStopIds);
  }
  getTripById(id: string): Promise<Trip | undefined> {
    const ctx = getRequestContext();
    if (!ctx) return this.scheduling.getTripById(id);
    const cached = ctx.tripCache.get(id);
    if (cached) return cached;
    const promise = this.scheduling.getTripById(id);
    ctx.tripCache.set(id, promise);
    promise.catch(() => { ctx.tripCache.delete(id); });
    return promise;
  }
  createTrip(data: InsertTrip): Promise<Trip> { return this.scheduling.createTrip(data); }
  updateTrip(id: string, data: Partial<InsertTrip>): Promise<Trip> {
    getRequestContext()?.tripCache.delete(id);
    return this.scheduling.updateTrip(id, data);
  }
  deleteTrip(id: string): Promise<void> {
    getRequestContext()?.tripCache.delete(id);
    return this.scheduling.deleteTrip(id);
  }
  getTripStopTimes(tripId: string): Promise<TripStopTime[]> { return this.scheduling.getTripStopTimes(tripId); }
  getTripStopTimesByTripIds(tripIds: string[]): Promise<Map<string, TripStopTime[]>> { return this.scheduling.getTripStopTimesByTripIds(tripIds); }
  createTripStopTime(data: InsertTripStopTime): Promise<TripStopTime> { return this.scheduling.createTripStopTime(data); }
  updateTripStopTime(id: string, data: Partial<InsertTripStopTime>): Promise<TripStopTime> { return this.scheduling.updateTripStopTime(id, data); }
  deleteTripStopTime(id: string): Promise<void> { return this.scheduling.deleteTripStopTime(id); }
  getTripStopTimesWithEffectiveFlags(tripId: string): Promise<TripStopTimeWithEffectiveFlags[]> { return this.scheduling.getTripStopTimesWithEffectiveFlags(tripId); }
  bulkUpsertTripStopTimes(tripId: string, stopTimes: BulkUpsertStopTimeInput[]): Promise<void> { return this.scheduling.bulkUpsertTripStopTimes(tripId, stopTimes); }
  getTripLegs(tripId: string): Promise<TripLeg[]> { return this.scheduling.getTripLegs(tripId); }
  createTripLeg(data: InsertTripLeg): Promise<TripLeg> { return this.scheduling.createTripLeg(data); }
  deleteTripLegs(tripId: string): Promise<void> { return this.scheduling.deleteTripLegs(tripId); }
  getSeatInventory(tripId: string, legIndexes?: number[]): Promise<SeatInventory[]> { return this.scheduling.getSeatInventory(tripId, legIndexes); }
  createSeatInventory(data: InsertSeatInventory[]): Promise<SeatInventory[]> { return this.scheduling.createSeatInventory(data); }
  updateSeatInventory(tripId: string, seatNo: string, legIndexes: number[], updates: Partial<InsertSeatInventory>): Promise<void> { return this.scheduling.updateSeatInventory(tripId, seatNo, legIndexes, updates); }
  deleteSeatInventory(tripId: string): Promise<void> { return this.scheduling.deleteSeatInventory(tripId); }
  tripHasBookings(tripId: string): Promise<boolean> { return this.scheduling.tripHasBookings(tripId); }
  getTripByBaseAndDate(baseId: string, serviceDate: string): Promise<Trip | undefined> { return this.scheduling.getTripByBaseAndDate(baseId, serviceDate); }
  releaseHoldsForTrip(tripId: string): Promise<void> { return this.scheduling.releaseHoldsForTrip(tripId); }
  getManifest(tripId: string): Promise<ManifestEntry[]> { return this.scheduling.getManifest(tripId); }
  recordManifestPrint(tripId: string): Promise<string | null> { return this.scheduling.recordManifestPrint(tripId); }
  getManifestFull(tripId: string): Promise<ManifestFull> { return this.scheduling.getManifestFull(tripId); }

  getActiveBookingCountForStop(stopId: string): Promise<number> { return this.network.getActiveBookingCountForStop(stopId); }
  getActiveTripsForStop(stopId: string): Promise<number> { return this.network.getActiveTripsForStop(stopId); }
  getActiveTripsForPattern(patternId: string): Promise<number> { return this.scheduling.getActiveTripsForPattern(patternId); }
  getActiveBookingCountForPattern(patternId: string): Promise<number> { return this.scheduling.getActiveBookingCountForPattern(patternId); }

  // Booking
  getBookings(tripId?: string): Promise<Booking[]> { return this.booking.getBookings(tripId); }
  getActiveBookingsForTrip(tripId: string): Promise<Booking[]> { return this.booking.getActiveBookingsForTrip(tripId); }
  getActiveBookingsByTripIds(tripIds: string[]): Promise<Map<string, Booking[]>> { return this.booking.getActiveBookingsByTripIds(tripIds); }
  getBookingsPaginated(options: { tripId?: string; outletId?: string; page: number; pageSize: number }): Promise<{ data: Booking[]; total: number }> { return this.booking.getBookingsPaginated(options); }
  getBookingById(id: string): Promise<Booking | undefined> { return this.booking.getBookingById(id); }
  createBooking(data: InsertBooking & { bookingCode: string }): Promise<Booking> { return this.booking.createBooking(data); }
  updateBooking(id: string, data: Partial<InsertBooking>): Promise<Booking> { return this.booking.updateBooking(id, data); }
  getBookingByCode(bookingCode: string): Promise<Booking | undefined> { return this.booking.getBookingByCode(bookingCode); }
  getPassengers(bookingId: string): Promise<Passenger[]> { return this.booking.getPassengers(bookingId); }
  getPassengersByBookingIds(bookingIds: string[]): Promise<Passenger[]> { return this.booking.getPassengersByBookingIds(bookingIds); }
  getPassengerByTicketNumber(ticketNumber: string): Promise<Passenger | undefined> { return this.booking.getPassengerByTicketNumber(ticketNumber); }
  createPassenger(data: InsertPassenger): Promise<Passenger> { return this.booking.createPassenger(data); }
  updatePassenger(id: string, data: Partial<InsertPassenger>): Promise<Passenger> { return this.booking.updatePassenger(id, data); }
  getActivePassengersForTrip(tripId: string): Promise<ActivePassengerForTrip[]> { return this.booking.getActivePassengersForTrip(tripId); }
  getUnseatedPassengers(tripId: string): Promise<UnseatedPassengerForTrip[]> { return this.booking.getUnseatedPassengers(tripId); }
  getPayments(bookingId: string): Promise<Payment[]> { return this.booking.getPayments(bookingId); }
  getPaymentsByBookingIds(bookingIds: string[]): Promise<Payment[]> { return this.booking.getPaymentsByBookingIds(bookingIds); }
  createPayment(data: InsertPayment): Promise<Payment> { return this.booking.createPayment(data); }
  createPrintJob(data: InsertPrintJob): Promise<PrintJob> { return this.booking.createPrintJob(data); }

  // Cargo
  getCargoTypes(): Promise<CargoType[]> { return this.cargo.getCargoTypes(); }
  getCargoTypeById(id: string): Promise<CargoType | undefined> { return this.cargo.getCargoTypeById(id); }
  createCargoType(data: InsertCargoType): Promise<CargoType> { return this.cargo.createCargoType(data); }
  updateCargoType(id: string, data: Partial<InsertCargoType>): Promise<CargoType> { return this.cargo.updateCargoType(id, data); }
  deleteCargoType(id: string): Promise<void> { return this.cargo.deleteCargoType(id); }
  getCargoShipments(
    filters?: { tripId?: string; status?: string; outletId?: string },
    opts?: { limit?: number; offset?: number }
  ): Promise<CargoShipmentListItem[]> { return this.cargo.getCargoShipments(filters, opts); }
  countCargoShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<number> { return this.cargo.countCargoShipments(filters); }
  getCargoShipmentById(id: string): Promise<CargoShipment | undefined> { return this.cargo.getCargoShipmentById(id); }
  getCargoShipmentByWaybill(waybillNumber: string): Promise<CargoShipment | undefined> { return this.cargo.getCargoShipmentByWaybill(waybillNumber); }
  createCargoShipment(data: InsertCargoShipment & { trackingSecret: string }): Promise<CargoShipment> { return this.cargo.createCargoShipment(data); }
  updateCargoShipment(id: string, data: Partial<InsertCargoShipment>): Promise<CargoShipment> { return this.cargo.updateCargoShipment(id, data); }

  // Finance
  getTripCostTemplates(patternId?: string): Promise<TripCostTemplate[]> { return this.finance.getTripCostTemplates(patternId); }
  getTripCostTemplateById(id: string): Promise<TripCostTemplate | undefined> { return this.finance.getTripCostTemplateById(id); }
  createTripCostTemplate(data: InsertTripCostTemplate): Promise<TripCostTemplate> { return this.finance.createTripCostTemplate(data); }
  updateTripCostTemplate(id: string, data: Partial<InsertTripCostTemplate>): Promise<TripCostTemplate> { return this.finance.updateTripCostTemplate(id, data); }
  deleteTripCostTemplate(id: string): Promise<void> { return this.finance.deleteTripCostTemplate(id); }
  getTripCostItems(templateId: string): Promise<TripCostItem[]> { return this.finance.getTripCostItems(templateId); }
  createTripCostItem(data: InsertTripCostItem): Promise<TripCostItem> { return this.finance.createTripCostItem(data); }
  updateTripCostItem(id: string, data: Partial<InsertTripCostItem>): Promise<TripCostItem> { return this.finance.updateTripCostItem(id, data); }
  deleteTripCostItem(id: string): Promise<void> { return this.finance.deleteTripCostItem(id); }
  getPromotions(): Promise<Promotion[]> { return this.finance.getPromotions(); }
  getPromotionById(id: string): Promise<Promotion | undefined> { return this.finance.getPromotionById(id); }
  getPromotionByCode(code: string): Promise<Promotion | undefined> { return this.finance.getPromotionByCode(code); }
  createPromotion(data: InsertPromotion): Promise<Promotion> { return this.finance.createPromotion(data); }
  updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion> { return this.finance.updatePromotion(id, data); }
  deletePromotion(id: string): Promise<void> { return this.finance.deletePromotion(id); }
  incrementPromoUsage(id: string): Promise<void> { return this.finance.incrementPromoUsage(id); }
  createBookingPromoApplications(rows: InsertBookingPromoApplication[]): Promise<BookingPromoApplication[]> { return this.finance.createBookingPromoApplications(rows); }
  getBookingPromoApplications(bookingId: string): Promise<BookingPromoApplication[]> { return this.finance.getBookingPromoApplications(bookingId); }
  getBookingPromoApplicationsWithName(bookingId: string) { return this.finance.getBookingPromoApplicationsWithName(bookingId); }
  getBookingPromoApplicationsWithNameForBookings(bookingIds: string[]) { return this.finance.getBookingPromoApplicationsWithNameForBookings(bookingIds); }
  deleteBookingPromoApplications(bookingId: string): Promise<void> { return this.finance.deleteBookingPromoApplications(bookingId); }
  getPromoConditions(promoId: string): Promise<PromoCondition[]> { return this.finance.getPromoConditions(promoId); }
  getPromoConditionsForPromos(promoIds: string[]): Promise<Map<string, PromoCondition[]>> { return this.finance.getPromoConditionsForPromos(promoIds); }
  replacePromoConditions(promoId: string, conditions: PromoConditionInput[]): Promise<PromoCondition[]> { return this.finance.replacePromoConditions(promoId, conditions); }
  getVouchers(promoId?: string): Promise<Voucher[]> { return this.finance.getVouchers(promoId); }
  getVoucherById(id: string): Promise<Voucher | undefined> { return this.finance.getVoucherById(id); }
  getVoucherByCode(code: string): Promise<Voucher | undefined> { return this.finance.getVoucherByCode(code); }
  createVoucher(data: InsertVoucher): Promise<Voucher> { return this.finance.createVoucher(data); }
  updateVoucher(id: string, data: Partial<InsertVoucher>): Promise<Voucher> { return this.finance.updateVoucher(id, data); }
  deleteVoucher(id: string): Promise<void> { return this.finance.deleteVoucher(id); }
}

export const storage = new DatabaseStorage();
