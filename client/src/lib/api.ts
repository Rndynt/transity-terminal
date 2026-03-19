import { apiRequest } from "./queryClient";
import type { 
  Stop, Outlet, Vehicle, Layout, TripPattern, PatternStop,
  Trip, TripWithDetails, TripStopTime, PriceRule, Booking,
  SeatmapResponse, HoldResponse, CreateBookingRequest, CreateHoldRequest,
  CsoAvailableTrip, Driver
} from "@/types";

// Drivers API
export const driversApi = {
  getAll: () => fetch('/api/drivers').then(res => res.json()) as Promise<Driver[]>,
  getById: (id: string) => fetch(`/api/drivers/${id}`).then(res => res.json()) as Promise<Driver>,
  create: (data: any) => apiRequest('POST', '/api/drivers', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/drivers/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/drivers/${id}`)
};

// Stops API
export const stopsApi = {
  getAll: () => fetch('/api/stops').then(res => res.json()) as Promise<Stop[]>,
  getById: (id: string) => fetch(`/api/stops/${id}`).then(res => res.json()) as Promise<Stop>,
  create: (data: any) => apiRequest('POST', '/api/stops', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/stops/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/stops/${id}`)
};

// Outlets API
export const outletsApi = {
  getAll: () => fetch('/api/outlets').then(res => res.json()) as Promise<Outlet[]>,
  getById: (id: string) => fetch(`/api/outlets/${id}`).then(res => res.json()) as Promise<Outlet>,
  create: (data: any) => apiRequest('POST', '/api/outlets', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/outlets/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/outlets/${id}`)
};

// Vehicles API
export const vehiclesApi = {
  getAll: () => fetch('/api/vehicles').then(res => res.json()) as Promise<Vehicle[]>,
  getById: (id: string) => fetch(`/api/vehicles/${id}`).then(res => res.json()) as Promise<Vehicle>,
  create: (data: any) => apiRequest('POST', '/api/vehicles', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/vehicles/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/vehicles/${id}`)
};

// Layouts API
export const layoutsApi = {
  getAll: () => fetch('/api/layouts').then(res => res.json()) as Promise<Layout[]>,
  getById: (id: string) => fetch(`/api/layouts/${id}`).then(res => res.json()) as Promise<Layout>,
  create: (data: any) => apiRequest('POST', '/api/layouts', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/layouts/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/layouts/${id}`)
};

// Trip Patterns API
export const tripPatternsApi = {
  getAll: () => fetch('/api/trip-patterns').then(res => res.json()) as Promise<TripPattern[]>,
  getById: (id: string) => fetch(`/api/trip-patterns/${id}`).then(res => res.json()) as Promise<TripPattern>,
  create: (data: any) => apiRequest('POST', '/api/trip-patterns', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/trip-patterns/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/trip-patterns/${id}`),
  getStops: (patternId: string) => fetch(`/api/trip-patterns/${patternId}/stops`).then(res => res.json()) as Promise<PatternStop[]>
};

// Trip Bases API
export const tripBasesApi = {
  getAll: () => fetch('/api/trip-bases').then(res => res.json()),
  getById: (id: string) => fetch(`/api/trip-bases/${id}`).then(res => res.json()),
  create: (data: any) => apiRequest('POST', '/api/trip-bases', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/trip-bases/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/trip-bases/${id}`)
};

// Pattern Stops API
export const patternStopsApi = {
  create: (data: any) => apiRequest('POST', '/api/pattern-stops', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/pattern-stops/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/pattern-stops/${id}`),
  bulkReplace: (patternId: string, patternStops: any[]) => 
    apiRequest('POST', `/api/trip-patterns/${patternId}/stops/bulk-replace`, patternStops).then(res => res.json())
};

// Trips API
export const tripsApi = {
  getAll: (date?: string) => {
    const url = date ? `/api/trips?date=${date}` : '/api/trips';
    return fetch(url).then(res => res.json()) as Promise<TripWithDetails[]>;
  },
  getCsoAvailableTrips: (date: string, outletId: string) => {
    return fetch(`/api/cso/available-trips?date=${date}&outletId=${outletId}`)
      .then(res => res.json()) as Promise<CsoAvailableTrip[]>;
  },
  getById: (id: string) => fetch(`/api/trips/${id}`).then(res => res.json()) as Promise<Trip>,
  create: (data: any) => apiRequest('POST', '/api/trips', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/trips/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/trips/${id}`),
  deriveLegs: (id: string) => apiRequest('POST', `/api/trips/${id}/derive-legs`).then(res => res.json()),
  precomputeSeatInventory: (id: string) => apiRequest('POST', `/api/trips/${id}/precompute-seat-inventory`).then(res => res.json()),
  getStopTimes: (id: string) => fetch(`/api/trips/${id}/stop-times`).then(res => res.json()) as Promise<TripStopTime[]>,
  getStopTimesWithEffectiveFlags: (id: string) => fetch(`/api/trips/${id}/stop-times/effective`).then(res => res.json()),
  bulkUpsertStopTimes: (id: string, data: any[]) => apiRequest('POST', `/api/trips/${id}/stop-times/bulk-upsert`, data).then(res => res.json()),
  getSeatmap: (id: string, originSeq: number, destinationSeq: number) => 
    fetch(`/api/trips/${id}/seatmap?originSeq=${originSeq}&destinationSeq=${destinationSeq}`)
      .then(res => res.json()) as Promise<SeatmapResponse>,
  getSeatPassengerDetails: (tripId: string, seatNo: string, originSeq: number, destinationSeq: number) =>
    fetch(`/api/trips/${tripId}/seats/${seatNo}/passenger-details?originSeq=${originSeq}&destinationSeq=${destinationSeq}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch passenger details: ${res.status}`);
        }
        return res.json();
      })
};

// Trip Stop Times API
export const tripStopTimesApi = {
  create: (data: any) => apiRequest('POST', '/api/trip-stop-times', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/trip-stop-times/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/trip-stop-times/${id}`)
};

// Price Rules API
export const priceRulesApi = {
  getAll: () => fetch('/api/price-rules').then(res => res.json()) as Promise<PriceRule[]>,
  create: (data: any) => apiRequest('POST', '/api/price-rules', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/price-rules/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/price-rules/${id}`)
};

// Bookings API
export const bookingsApi = {
  getAll: (tripId?: string) => {
    const url = tripId ? `/api/bookings?tripId=${tripId}` : '/api/bookings';
    return fetch(url).then(res => res.json()) as Promise<Booking[]>;
  },
  getById: (id: string) => fetch(`/api/bookings/${id}`).then(res => res.json()) as Promise<Booking>,
  create: async (data: CreateBookingRequest, idempotencyKey?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Unknown error occurred';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.details || errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    return response.json();
  }
};

// Holds API
export const holdsApi = {
  create: (data: CreateHoldRequest) => apiRequest('POST', '/api/holds', data).then(res => res.json()) as Promise<HoldResponse>,
  release: (holdRef: string) => apiRequest('DELETE', `/api/holds/${holdRef}`)
};

// Pricing API
export const pricingApi = {
  quoteFare: (tripId: string, originSeq: number, destinationSeq: number, passengerCount: number = 1) => {
    const params = new URLSearchParams({
      tripId,
      originSeq: originSeq.toString(),
      destinationSeq: destinationSeq.toString(),
      passengerCount: passengerCount.toString()
    });
    return fetch(`/api/pricing/quote-fare?${params}`).then(res => res.json()) as Promise<{
      perPassenger: number;
      totalForAllPassengers: number;
      passengerCount: number;
      breakdown: any;
    }>;
  }
};

// Cargo Types API
export const cargoTypesApi = {
  getAll: () => fetch('/api/cargo-types').then(res => res.json()),
  getById: (id: string) => fetch(`/api/cargo-types/${id}`).then(res => res.json()),
  create: (data: Record<string, unknown>) => apiRequest('POST', '/api/cargo-types', data).then(res => res.json()),
  update: (id: string, data: Record<string, unknown>) => apiRequest('PUT', `/api/cargo-types/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/cargo-types/${id}`)
};

export const cargoRatesApi = {
  getAll: (cargoTypeId?: string) => {
    const qs = cargoTypeId ? `?cargoTypeId=${cargoTypeId}` : '';
    return fetch(`/api/cargo-rates${qs}`).then(res => res.json());
  },
  getById: (id: string) => fetch(`/api/cargo-rates/${id}`).then(res => res.json()),
  create: (data: Record<string, unknown>) => apiRequest('POST', '/api/cargo-rates', data).then(res => res.json()),
  update: (id: string, data: Record<string, unknown>) => apiRequest('PUT', `/api/cargo-rates/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/cargo-rates/${id}`)
};

export const cargoApi = {
  getAll: (filters?: { tripId?: string; status?: string; outletId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.tripId) params.set('tripId', filters.tripId);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.outletId) params.set('outletId', filters.outletId);
    const qs = params.toString();
    return fetch(`/api/cargo${qs ? `?${qs}` : ''}`).then(res => res.json());
  },
  getById: (id: string) => fetch(`/api/cargo/${id}`).then(res => res.json()),
  getByWaybill: (waybillNumber: string) => fetch(`/api/cargo/waybill/${waybillNumber}`).then(res => res.json()),
  create: (data: Record<string, unknown>) => apiRequest('POST', '/api/cargo', data).then(res => res.json()),
  update: (id: string, data: Record<string, unknown>) => apiRequest('PUT', `/api/cargo/${id}`, data).then(res => res.json()),
  updateStatus: (id: string, status: string) => apiRequest('PATCH', `/api/cargo/${id}/status`, { status }).then(res => res.json()),
  quoteTariff: (cargoTypeId: string, originStopId: string, destinationStopId: string, weightKg: number, tripId?: string) => {
    const params = new URLSearchParams({ cargoTypeId, originStopId, destinationStopId, weightKg: String(weightKg) });
    if (tripId) params.set('tripId', tripId);
    return fetch(`/api/cargo/quote-tariff?${params}`).then(res => res.json());
  }
};

// Trip Cost Templates API
export const costTemplatesApi = {
  getAll: (patternId?: string) => {
    const qs = patternId ? `?patternId=${patternId}` : '';
    return fetch(`/api/cost-templates${qs}`).then(res => res.json());
  },
  getById: (id: string) => fetch(`/api/cost-templates/${id}`).then(res => res.json()),
  create: (data: any) => apiRequest('POST', '/api/cost-templates', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PUT', `/api/cost-templates/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/cost-templates/${id}`),
  getItems: (templateId: string) => fetch(`/api/cost-templates/${templateId}/items`).then(res => res.json()),
  createItem: (templateId: string, data: any) => apiRequest('POST', `/api/cost-templates/${templateId}/items`, data).then(res => res.json()),
  updateItem: (id: string, data: any) => apiRequest('PUT', `/api/cost-items/${id}`, data).then(res => res.json()),
  deleteItem: (id: string) => apiRequest('DELETE', `/api/cost-items/${id}`)
};

// Seed API
export const seedApi = {
  run: () => apiRequest('POST', '/api/seed').then(res => res.json())
};
