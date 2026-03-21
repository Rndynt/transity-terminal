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
      }),
  getUnseatedPassengers: async (tripId: string) => {
    const res = await fetch(`/api/trips/${tripId}/unseated-passengers`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch unseated passengers'); }
    return res.json();
  },
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
  getHistory: (bookingId: string) => fetch(`/api/bookings/${bookingId}/history`).then(res => res.json()),
  unseatAll: async (bookingId: string, reason?: string) => {
    const res = await fetch(`/api/bookings/${bookingId}/unseat-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Unseat failed'); }
    return res.json();
  },
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

// Passengers API
export const passengersApi = {
  unseat: async (passengerId: string, reason?: string) => {
    const res = await fetch(`/api/passengers/${passengerId}/unseat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Unseat failed'); }
    return res.json();
  },
  reassign: async (passengerId: string, newSeatNo: string) => {
    const res = await fetch(`/api/passengers/${passengerId}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newSeatNo })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Reassign failed'); }
    return res.json();
  },
  assignSeat: async (passengerId: string, newSeatNo: string) => {
    const res = await fetch(`/api/passengers/${passengerId}/assign-seat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newSeatNo })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Assign seat failed'); }
    return res.json();
  },
  reschedule: async (passengerId: string, data: {
    newTripId: string;
    newSeatNo: string;
    newOriginStopId: string;
    newDestinationStopId: string;
    newOriginSeq: number;
    newDestinationSeq: number;
  }) => {
    const res = await fetch(`/api/passengers/${passengerId}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Reschedule failed'); }
    return res.json();
  }
};

// Holds API
export const holdsApi = {
  create: async (data: CreateHoldRequest): Promise<HoldResponse> => {
    const response = await fetch('/api/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorCode = 'UNKNOWN';
      let errorMessage = 'Gagal memegang kursi';

      try {
        const body = JSON.parse(errorText);
        errorCode = body.code || errorCode;

        if (body.code === 'INCOMPLETE_INVENTORY') {
          errorMessage = 'Inventori kursi belum diinisialisasi. Jalankan Precompute Seat Inventory di halaman Master Data → Trip.';
        } else if (body.code === 'HELD_BY_OTHER') {
          errorMessage = 'Kursi sedang dipegang oleh agen lain. Coba kursi lain atau tunggu hold berakhir.';
        } else if (body.code === 'NO_PRICE_RULE' || body.code === 'PRICE_NOT_CONFIGURED') {
          errorMessage = 'Belum ada aturan harga untuk rute ini. Silakan konfigurasi di menu Aturan Harga terlebih dahulu.';
        } else if (body.code === 'TRIP_CLOSED' || body.code === 'TRIP_CANCELLED') {
          errorMessage = 'Trip ini sudah ditutup atau dibatalkan.';
        } else if (body.details && typeof body.details === 'string') {
          errorMessage = body.details;
        } else if (body.error && typeof body.error === 'string') {
          errorMessage = body.error;
        }
      } catch {
        errorMessage = errorText || `Error ${response.status}`;
      }

      const err = new Error(errorMessage) as Error & { code: string };
      err.code = errorCode;
      throw err;
    }

    return response.json();
  },
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

// Manifest API
export const manifestApi = {
  get: (tripId: string) => fetch(`/api/trips/${tripId}/manifest`).then(res => res.json()),
  recordPrint: (tripId: string) => apiRequest('POST', `/api/trips/${tripId}/manifest/print`).then(res => res.json()),
};

// Promotions API
export const promotionsApi = {
  getAll: () => fetch('/api/promotions').then(res => res.json()),
  getById: (id: string) => fetch(`/api/promotions/${id}`).then(res => res.json()),
  create: (data: any) => apiRequest('POST', '/api/promotions', data).then(res => res.json()),
  update: (id: string, data: any) => apiRequest('PATCH', `/api/promotions/${id}`, data).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/promotions/${id}`),
  validate: (data: { code: string; subtotal: number; channel?: string; tripId?: string; patternId?: string }) =>
    apiRequest('POST', '/api/promos/validate', data).then(res => res.json()),
};

// Vouchers API
export const vouchersApi = {
  getAll: (promoId?: string) => {
    const qs = promoId ? `?promoId=${promoId}` : '';
    return fetch(`/api/vouchers${qs}`).then(res => res.json());
  },
  generate: (data: { promoId: string; count: number; prefix?: string; assignedTo?: string }) =>
    apiRequest('POST', '/api/vouchers/generate', data).then(res => res.json()),
  revoke: (id: string) => apiRequest('PATCH', `/api/vouchers/${id}/revoke`).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/vouchers/${id}`),
};

// SPJ API
async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const spjApi = {
  getAll: () => fetchJson('/api/spj'),
  getById: (id: string) => fetchJson(`/api/spj/${id}`),
  getByTripId: (tripId: string) => fetch(`/api/spj/trip/${tripId}`).then(res => { if (!res.ok && res.status === 404) return null; if (!res.ok) throw new Error('Failed'); return res.json(); }),
  create: (data: { tripId: string; driverId?: string; vehicleId?: string; notes?: string }) =>
    apiRequest('POST', '/api/spj', data).then(res => res.json()),
  issue: (id: string) => apiRequest('PATCH', `/api/spj/${id}/issue`).then(res => res.json()),
  settle: (id: string) => apiRequest('PATCH', `/api/spj/${id}/settle`).then(res => res.json()),
  updateNotes: (id: string, notes: string) => apiRequest('PATCH', `/api/spj/${id}/notes`, { notes }).then(res => res.json()),
  delete: (id: string) => apiRequest('DELETE', `/api/spj/${id}`),
  addCostLine: (spjId: string, data: any) => apiRequest('POST', `/api/spj/${spjId}/cost-lines`, data).then(res => res.json()),
  updateCostLine: (lineId: string, data: any) => apiRequest('PATCH', `/api/spj/cost-lines/${lineId}`, data).then(res => res.json()),
  deleteCostLine: (lineId: string) => apiRequest('DELETE', `/api/spj/cost-lines/${lineId}`),
  getTripProfit: (tripId: string) => fetchJson(`/api/spj/trip/${tripId}/profit`),
};

// Seed API
export const seedApi = {
  run: () => apiRequest('POST', '/api/seed').then(res => res.json())
};
