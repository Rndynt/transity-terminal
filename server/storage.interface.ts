import type {
  Stop, Outlet, Vehicle, Layout, TripPattern,
  PatternStop, TripBase, Trip, TripWithDetails, TripStopTime, TripLeg,
  SeatInventory, PriceRule, Booking, Passenger,
  Payment, PrintJob, CargoShipment, CargoType, CargoRate,
  Driver, InsertDriver,
  InsertStop, InsertOutlet, InsertVehicle, InsertLayout,
  InsertTripPattern, InsertPatternStop, InsertTripBase, InsertTrip,
  InsertTripStopTime, InsertPriceRule, InsertBooking,
  InsertPassenger, InsertPayment, InsertPrintJob, InsertCargoShipment,
  InsertCargoType, InsertCargoRate,
  TripCostTemplate, InsertTripCostTemplate,
  TripCostItem, InsertTripCostItem,
  CsoAvailableTrip,
  Promotion, InsertPromotion,
  Voucher, InsertVoucher
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
  getStopsByIds(ids: string[]): Promise<Stop[]>;
  createStop(data: InsertStop): Promise<Stop>;
  updateStop(id: string, data: Partial<InsertStop>): Promise<Stop>;
  deleteStop(id: string): Promise<void>;

  getOutlets(): Promise<Outlet[]>;
  getOutletById(id: string): Promise<Outlet | undefined>;
  getOutletsByIds(ids: string[]): Promise<Outlet[]>;
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
  getBookingsPaginated(options: { tripId?: string; outletId?: string; page: number; pageSize: number }): Promise<{ data: Booking[]; total: number }>;
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
  getPaymentsByBookingIds(bookingIds: string[]): Promise<Payment[]>;
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
  getActivePassengersForTrip(tripId: string): Promise<any[]>;
  getUnseatedPassengers(tripId: string): Promise<any[]>;
}
