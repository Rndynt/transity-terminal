import { 
  Driver, Stop, Outlet, Vehicle, Layout, TripPattern, PatternStop, TripBase,
  Trip, TripWithDetails, TripStopTime, TripLeg, SeatInventory, PriceRule, 
  Booking, Passenger, Payment, PrintJob, CsoAvailableTrip, CargoAvailableTrip,
  CargoShipment, CargoType, CargoRate, Spj, SpjCostLine, SpjWithDetails
} from "@shared/schema";

export type {
  Driver, Stop, Outlet, Vehicle, Layout, TripPattern, PatternStop, TripBase,
  Trip, TripWithDetails, TripStopTime, TripLeg, SeatInventory, PriceRule,
  Booking, Passenger, Payment, PrintJob, CsoAvailableTrip, CargoAvailableTrip,
  CargoShipment, CargoType, CargoRate, Spj, SpjCostLine, SpjWithDetails
};

export type CargoShipmentWithStops = CargoShipment & {
  originStopName?: string;
  originStopCode?: string;
  destinationStopName?: string;
  destinationStopCode?: string;
  outletName?: string;
  vehiclePlate?: string;
  tripServiceDate?: string;
  tripDepartAt?: string;
};

export interface BookingStep {
  id: number;
  name: string;
  status: 'pending' | 'active' | 'completed';
}

export interface SeatAvailability {
  available: boolean;
  held: boolean;
  holdRef?: string;
  bookedType?: 'main' | 'transit' | null;
  bookingStatus?: 'pending' | 'paid' | null;
  isMultiSeat?: boolean;
}

export interface SeatmapResponse {
  trip: Trip;
  layout: Layout;
  seatAvailability: Record<string, SeatAvailability>;
  legIndexes: number[];
}

export interface HoldResponse {
  holdRef: string | null;
  expiresAt?: number;
  ownedByYou?: boolean;
}

export interface FareQuote {
  total: number;
  perPassenger: number;
  breakdown: any;
}

export interface PassengerInput {
  fullName: string;
  phone?: string;
  idNumber?: string;
}

export interface BookingFlowState {
  outlet?: Outlet;
  trip?: Trip;
  originStop?: Stop;
  destinationStop?: Stop;
  originSeq?: number;
  destinationSeq?: number;
  selectedSeats: string[];
  passengers: PassengerInput[];
  payment?: {
    method: 'cash' | 'qr' | 'ewallet' | 'bank';
    amount: number;
  };
  promoCode?: string;
  discountAmount?: number;
  promoValidation?: {
    valid: boolean;
    discountAmount: number;
    promotion?: Record<string, unknown>;
    voucher?: Record<string, unknown>;
    error?: string;
  };
  currentStep: number;
}

export interface CreateBookingRequest {
  tripId: string;
  outletId?: string;
  originStopId: string;
  destinationStopId: string;
  originSeq: number;
  destinationSeq: number;
  totalAmount: number;
  channel: 'CSO' | 'WEB' | 'APP' | 'OTA';
  createdBy?: string;
  promoCode?: string;
  passengers: Array<{
    fullName: string;
    phone?: string;
    idNumber?: string;
    seatNo: string;
  }>;
  payment: {
    method: 'cash' | 'qr' | 'ewallet' | 'bank';
    amount: number;
  };
}

export interface CreateHoldRequest {
  tripId: string;
  seatNo: string;
  originSeq: number;
  destinationSeq: number;
  ttlSeconds?: number;
}
