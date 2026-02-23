import { 
  Stop, Outlet, Vehicle, Layout, TripPattern, PatternStop, TripBase,
  Trip, TripWithDetails, TripStopTime, TripLeg, SeatInventory, PriceRule, 
  Booking, Passenger, Payment, PrintJob, CsoAvailableTrip
} from "@shared/schema";

export type {
  Stop, Outlet, Vehicle, Layout, TripPattern, PatternStop, TripBase,
  Trip, TripWithDetails, TripStopTime, TripLeg, SeatInventory, PriceRule,
  Booking, Passenger, Payment, PrintJob, CsoAvailableTrip
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

export interface BookingFlowState {
  outlet?: Outlet;
  trip?: Trip;
  originStop?: Stop;
  destinationStop?: Stop;
  originSeq?: number;
  destinationSeq?: number;
  selectedSeats: string[];
  passengers: Passenger[];
  payment?: {
    method: 'cash' | 'qr' | 'ewallet' | 'bank';
    amount: number;
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
