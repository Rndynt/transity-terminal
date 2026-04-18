export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: AppUser;
  token: string;
}

export interface StopSummary {
  name: string;
  code: string;
  city: string | null;
  departAt?: string | null;
  arriveAt?: string | null;
}

export interface StopDetail extends StopSummary {
  stopId: string;
}

export interface TripStopInfo {
  stopId: string;
  name: string;
  code: string;
  city?: string;
  sequence: number;
  arriveAt: string | null;
  departAt: string | null;
  boardingAllowed?: boolean;
  alightingAllowed?: boolean;
}

export interface GatewayStopInfo {
  stopId: string;
  cityName: string;
  stopName: string;
  sequence: number;
  departureTime: string | null;
}

export interface TripSearchResult {
  tripId: string;
  serviceDate: string;
  vehicleClass: string | null;
  operatorName: string;
  operatorSlug: string;
  operatorLogo: string | null;
  operatorColor: string | null;
  origin: GatewayStopInfo | null;
  destination: GatewayStopInfo | null;
  availableSeats: number;
  farePerPerson: number;
  isVirtual: boolean;
}

export interface TripDetail {
  tripId: string;
  serviceDate: string | null;
  patternCode: string | null;
  patternName: string | null;
  vehicleClass: string | null;
  operatorName: string | null;
  capacity: number | null;
  status: string | null;
  seatAvailability: { total: number; sold: number; available: number };
  stops: Array<{
    stopId: string;
    name: string;
    code: string;
    city: string | null;
    sequence: number;
    arriveAt: string | null;
    departAt: string | null;
    boardingAllowed: boolean;
    alightingAllowed: boolean;
  }>;
  reviews: { count: number; avgRating: number };
}

export interface SeatmapResponse {
  layout: { rows: number | null; cols: number | null; seatMap: SeatMapItem[] };
  seatAvailability: Record<string, { available: boolean; held: boolean }>;
}

export interface SeatMapItem {
  row: number;
  col: number;
  label: string;
  type: string;
}

export interface PassengerInfo {
  id: string;
  fullName: string;
  phone: string | null;
  seatNo: string;
  fareAmount: string | null;
}

export interface QrDataItem {
  passengerId: string;
  seatNo: string;
  fullName: string;
  qrToken: string;
  qrPayload: string;
}

export interface BookingListItem {
  id: string;
  tripId: string;
  serviceDate: string | null;
  patternCode: string | null;
  patternName: string | null;
  operatorName: string | null;
  status: string | null;
  totalAmount: string | null;
  origin: StopSummary | null;
  destination: StopSummary | null;
  passengerCount: number;
  passengerName: string | null;
  seatNumbers: string[];
  createdAt?: string | null;
  holdExpiresAt?: string | null;
  paymentMethod?: string | null;
}

function isEmptyStop(stop: any): boolean {
  if (!stop) return true;
  return !stop.name && !stop.city;
}

function cleanStop(stop: any): StopSummary | null {
  if (!stop || isEmptyStop(stop)) return null;
  return stop;
}

function normalizeBookingListItem(raw: any): BookingListItem {
  const amt = raw.finalAmount || raw.totalAmount;
  const hasValidAmount = amt && amt !== '0' && amt !== '0.00';
  return {
    id: raw.bookingId || raw.id || '',
    tripId: raw.tripId || '',
    serviceDate: raw.serviceDate || null,
    patternCode: raw.patternCode || null,
    patternName: raw.patternName || null,
    operatorName: raw.operatorName || null,
    status: raw.status || null,
    totalAmount: hasValidAmount ? amt : (raw.farePerPerson && raw.seatNumbers ? String(Number(raw.farePerPerson) * raw.seatNumbers.length) : amt),
    origin: cleanStop(raw.origin),
    destination: cleanStop(raw.destination),
    passengerCount: raw.passengerCount ?? (raw.passengers?.length || raw.seatNumbers?.length || 1),
    passengerName: raw.passengerName || (raw.passengers?.[0]?.fullName) || null,
    seatNumbers: raw.seatNumbers || [],
    createdAt: raw.createdAt || null,
    holdExpiresAt: raw.holdExpiresAt || null,
    paymentMethod: raw.paymentMethod || raw.payment_method || (raw.payments?.length > 0 && (raw.payments[0].paidAt || raw.payments[0].status === 'paid') ? raw.payments[0].method : null) || null,
  };
}

function normalizeBookingDetail(raw: any): BookingDetail {
  const passengers: PassengerInfo[] = raw.passengers || [];
  if (passengers.length === 0 && raw.passengerName) {
    const seats: string[] = raw.seatNumbers || [];
    seats.forEach((seat, i) => {
      passengers.push({
        id: `p-${i}`,
        fullName: i === 0 ? raw.passengerName : `Penumpang ${i + 1}`,
        phone: raw.passengerPhone || null,
        seatNo: seat,
        fareAmount: null,
      });
    });
    if (passengers.length === 0) {
      passengers.push({
        id: 'p-0',
        fullName: raw.passengerName,
        phone: raw.passengerPhone || null,
        seatNo: '-',
        fareAmount: null,
      });
    }
  }
  return {
    id: raw.bookingId || raw.id || '',
    bookingId: raw.bookingId || raw.id || '',
    externalBookingId: raw.externalBookingId || null,
    bookingCode: raw.bookingCode || null,
    tripId: raw.tripId || '',
    serviceDate: raw.serviceDate || null,
    patternCode: raw.patternCode || null,
    patternName: raw.patternName || raw.operatorName || null,
    operatorName: raw.operatorName || null,
    operatorSlug: raw.operatorSlug || null,
    origin: cleanStop(raw.origin),
    destination: cleanStop(raw.destination),
    departAt: raw.departAt || raw.departureTime || raw.origin?.departAt || null,
    arriveAt: raw.arriveAt || raw.arrivalTime || raw.destination?.arriveAt || null,
    status: raw.status || null,
    totalAmount: (() => { const a = raw.finalAmount || raw.totalAmount; return (a && a !== '0' && a !== '0.00') ? a : (raw.farePerPerson && passengers.length > 0 ? String(Number(raw.farePerPerson) * passengers.length) : a); })(),
    channel: raw.channel || null,
    holdExpiresAt: raw.holdExpiresAt || null,
    paymentMethod: raw.paymentMethod || raw.payment_method || (raw.payments?.length > 0 && (raw.payments[0].paidAt || raw.payments[0].status === 'paid') ? raw.payments[0].method : null) || null,
    qrData: raw.qrData || [],
    passengers,
    payments: raw.payments || [],
    paymentIntent: raw.paymentIntent || null,
    createdAt: raw.createdAt || null,
  };
}

export interface BookingDetail {
  id: string;
  bookingId?: string;
  externalBookingId?: string | null;
  bookingCode?: string | null;
  tripId: string;
  serviceDate: string | null;
  patternCode: string | null;
  patternName: string | null;
  operatorName?: string | null;
  operatorSlug?: string | null;
  origin: StopDetail | null;
  destination: StopDetail | null;
  departAt: string | null;
  arriveAt: string | null;
  status: string | null;
  totalAmount: string | null;
  channel: string | null;
  holdExpiresAt: string | null;
  paymentMethod?: string | null;
  qrData: QrDataItem[];
  passengers: PassengerInfo[];
  payments: Array<{
    id: string;
    method: string;
    amount: string | null;
    status: string | null;
    paidAt: string | null;
  }>;
  paymentIntent: {
    paymentId: string;
    method: string;
    amount: string | null;
    status: string | null;
    providerRef: string | null;
    expiresAt: string | null;
  } | null;
  createdAt: string | null;
}

export interface GatewayBookingResponse {
  bookingId: string;
  externalBookingId?: string;
  operatorId?: string;
  operatorName?: string;
  operatorSlug?: string;
  status: string;
  totalAmount: string;
  holdExpiresAt: string | null;
  paymentIntent: {
    paymentId: string;
    method: string;
    amount: string;
  } | null;
  qrData: QrDataItem[];
  passengers: PassengerInfo[];
  tripId: string;
}

export interface CreateBookingData {
  tripId: string;
  serviceDate: string;
  originStopId: string;
  destinationStopId: string;
  originSeq: number;
  destinationSeq: number;
  passengers: Array<{ fullName: string; phone?: string; idNumber?: string; seatNo: string }>;
  paymentMethod?: string;
}

export interface PayBookingData {
  paymentMethod: string;
  voucherCode?: string;
}

function getToken(): string | null {
  try { return localStorage.getItem('transity_token'); } catch { return null; }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Terjadi kesalahan' }));
    const msg = err.error || err.message || 'Terjadi kesalahan';
    const code = err.code || undefined;
    const details = err.errors || err.details || err.validationErrors || undefined;
    throw new ApiError(msg, res.status, code, details);
  }
  return res.json();
}

const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const authApi = {
  register: (data: { fullName: string; email: string; phone: string; password: string }) =>
    api.post<AuthResponse>('/api/gateway/auth/register', data as unknown as Record<string, unknown>),
  login: (data: { email?: string; phone?: string; password: string }) =>
    api.post<AuthResponse>('/api/gateway/auth/login', data as unknown as Record<string, unknown>),
  getMe: () => api.get<Record<string, unknown>>('/api/gateway/auth/me').then(res => {
    const user = (res as { user?: AppUser }).user || (res as unknown as AppUser);
    return (user && (user as AppUser).id) ? user as AppUser : null;
  }),
  updateProfile: (data: { fullName?: string; phone?: string }) =>
    api.put<{ user: AppUser }>('/api/gateway/auth/profile', data as unknown as Record<string, unknown>).then(res => res.user),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>('/api/gateway/auth/change-password', data as unknown as Record<string, unknown>),
};

export interface TripSearchPaginatedResponse {
  data: TripSearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface GatewaySearchResponse {
  trips: TripSearchResult[];
  errors?: Array<{ operatorSlug: string; error: string }>;
  totalOperators?: number;
  respondedOperators?: number;
}

export interface OperatorInfo {
  slug: string;
  name: string;
  color: string;
  logo: string | null;
}

interface CitiesFullResponse {
  cities: ({ city: string; stopCount: number } | string)[];
  byOperator?: { operatorSlug: string; operatorName?: string; operatorLogo?: string | null; operatorColor?: string; cities: unknown[] }[];
}

export const tripsApi = {
  getCitiesAndOperators: async (): Promise<{ cities: string[]; operators: OperatorInfo[] }> => {
    const res = await api.get<CitiesFullResponse | ({ city: string; stopCount: number } | string)[]>('/api/gateway/cities');
    if (Array.isArray(res)) {
      return { cities: res.map((c) => (typeof c === 'string' ? c : c.city)), operators: [] };
    }
    const citiesData = res.cities || [];
    const cities = citiesData.map((c: { city: string; stopCount: number } | string) => (typeof c === 'string' ? c : c.city));
    const operators: OperatorInfo[] = (res.byOperator || [])
      .filter((op) => op.operatorSlug)
      .map((op) => ({
        slug: op.operatorSlug,
        name: op.operatorName || op.operatorSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        color: op.operatorColor || '#134E4A',
        logo: op.operatorLogo || null,
      }));
    return { cities, operators };
  },

  getCities: async (): Promise<string[]> => {
    const { cities } = await tripsApi.getCitiesAndOperators();
    return cities;
  },

  search: async (params: { originCity: string; destinationCity: string; date: string; passengers?: number; page?: number; limit?: number }): Promise<TripSearchResult[]> => {
    const qs = new URLSearchParams(params as unknown as Record<string, string>).toString();
    const result = await api.get<GatewaySearchResponse | TripSearchResult[]>(`/api/gateway/trips/search?${qs}`);
    if (Array.isArray(result)) return result;
    if ('trips' in result) return result.trips;
    return [];
  },

  searchPaginated: async (params: { originCity: string; destinationCity: string; date: string; passengers?: number; page: number; limit: number }): Promise<TripSearchPaginatedResponse> => {
    const qs = new URLSearchParams(params as unknown as Record<string, string>).toString();
    const result = await api.get<GatewaySearchResponse | TripSearchPaginatedResponse | TripSearchResult[]>(`/api/gateway/trips/search?${qs}`);

    if (Array.isArray(result)) {
      return { data: result, total: result.length, page: 1, limit: result.length, hasMore: false };
    }
    if ('trips' in result) {
      const trips = result.trips;
      const page = params.page;
      const limit = params.limit;
      const start = (page - 1) * limit;
      const sliced = trips.slice(start, start + limit);
      return {
        data: sliced,
        total: trips.length,
        page,
        limit,
        hasMore: start + limit < trips.length,
      };
    }
    return result as TripSearchPaginatedResponse;
  },

  getDetail: (tripId: string, serviceDate?: string) => {
    const qs = serviceDate ? `?serviceDate=${serviceDate}` : '';
    return api.get<TripDetail>(`/api/gateway/trips/${tripId}${qs}`);
  },
  getSeatmap: (tripId: string, originSeq: number, destSeq: number, serviceDate?: string) => {
    let qs = `?originSeq=${originSeq}&destinationSeq=${destSeq}`;
    if (serviceDate) qs += `&serviceDate=${serviceDate}`;
    return api.get<SeatmapResponse>(`/api/gateway/trips/${tripId}/seatmap${qs}`);
  },
  getReviews: (tripId: string) =>
    api.get<unknown>(`/api/gateway/trips/${tripId}/reviews`),
  materialize: async (tripId: string, serviceDate: string): Promise<{ tripId: string }> => {
    return api.post<{ tripId: string }>('/api/gateway/trips/materialize', { tripId, serviceDate });
  },
  getOperatorInfo: (operatorSlug: string) =>
    api.get<unknown>(`/api/gateway/operators/${operatorSlug}/info`),
  getServiceLines: () =>
    api.get<unknown>('/api/gateway/service-lines'),
};

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'bank_transfer' | 'ewallet' | 'qris' | 'virtual_account' | 'other';
  icon?: string;
  description?: string;
  enabled: boolean;
}

function normalizePaymentType(type: string): PaymentMethod['type'] {
  switch (type) {
    case 'qr': case 'qris': return 'qris';
    case 'va': case 'virtual_account': return 'virtual_account';
    case 'transfer': case 'bank_transfer': return 'bank_transfer';
    case 'ewallet': return 'ewallet';
    default: return 'other';
  }
}

function normalizePaymentMethods(raw: unknown[]): PaymentMethod[] {
  return raw.map((m: any) => ({
    id: m.id,
    name: m.name,
    type: normalizePaymentType(m.type || ''),
    description: m.description,
    icon: m.icon,
    enabled: m.enabled !== undefined ? !!m.enabled : true,
  }));
}

export const paymentsApi = {
  getMethods: async (): Promise<PaymentMethod[]> => {
    try {
      const res = await api.get<PaymentMethod[] | { methods: unknown[] } | { data: unknown[] }>('/api/gateway/payments/methods');
      let raw: unknown[] = [];
      if (Array.isArray(res)) raw = res;
      else if (res && typeof res === 'object' && Array.isArray((res as any).methods)) raw = (res as any).methods;
      else if (res && typeof res === 'object' && Array.isArray((res as any).data)) raw = (res as any).data;
      return normalizePaymentMethods(raw);
    } catch {
      return [];
    }
  },
  validateVoucher: async (code: string, tripId: string, amount: number): Promise<{ valid: boolean; discount: number; message?: string }> => {
    try {
      // Console mengembalikan: { valid, discountValue, finalAmount, message, source }
      // App membutuhkan: { valid, discount, message }
      const res = await api.post<any>('/api/gateway/vouchers/validate', { code, tripId, amount } as unknown as Record<string, unknown>);
      return {
        valid: !!res.valid,
        discount: Number(res.discountValue ?? res.discount ?? res.calculatedDiscount ?? 0),
        message: res.message,
      };
    } catch (err: any) {
      return { valid: false, discount: 0, message: err?.message || 'Kode voucher tidak valid' };
    }
  },
};

export const bookingsApi = {
  create: (data: CreateBookingData) =>
    api.post<GatewayBookingResponse>('/api/gateway/bookings', data as unknown as Record<string, unknown>),
  getGatewayDetail: (bookingId: string) => api.get<any>(`/api/gateway/bookings/${bookingId}`).then(res => {
    return normalizeBookingDetail(res);
  }),
  list: () => api.get<BookingListItem[] | Record<string, unknown>>('/api/gateway/bookings').then(res => {
    let items: any[] = [];
    if (Array.isArray(res)) items = res;
    else if (res && typeof res === 'object' && Array.isArray((res as any).bookings)) items = (res as any).bookings;
    else if (res && typeof res === 'object' && Array.isArray((res as any).data)) items = (res as any).data;
    return items.map(normalizeBookingListItem);
  }),
  getDetail: (id: string) => api.get<BookingDetail>(`/api/gateway/bookings/${id}`),
  cancel: (id: string) => api.post<{ success: boolean }>(`/api/gateway/bookings/${id}/cancel`, {}),
  pay: (bookingId: string, data: PayBookingData) =>
    api.post<GatewayBookingResponse>(`/api/gateway/bookings/${bookingId}/pay`, data as unknown as Record<string, unknown>),
};

export const store = {
  setAuth(user: AppUser, token: string) {
    localStorage.setItem('transity_token', token);
    localStorage.setItem('transity_user', JSON.stringify(user));
  },
  getUser(): AppUser | null {
    try {
      const raw = localStorage.getItem('transity_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.name && !parsed.fullName) {
        parsed.fullName = parsed.name;
      }
      if (parsed.avatar !== undefined && parsed.avatarUrl === undefined) {
        parsed.avatarUrl = parsed.avatar;
      }
      return parsed;
    } catch { return null; }
  },
  getToken,
  logout() {
    localStorage.removeItem('transity_token');
    localStorage.removeItem('transity_user');
    sessionStorage.removeItem('t_origin');
    sessionStorage.removeItem('t_dest');
    sessionStorage.removeItem('t_date');
    sessionStorage.removeItem('t_pax');
    localStorage.removeItem('t_recent_cities');
  },
  isLoggedIn(): boolean {
    return !!localStorage.getItem('transity_token');
  },
};
