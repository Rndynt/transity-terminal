import { storage } from './storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://your-repl-domain.replit.app';

interface AppUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AuthResponse {
  user: AppUser;
  token: string;
}

interface StopSummary {
  name: string;
  code: string;
  city: string | null;
}

interface StopDetail extends StopSummary {
  stopId: string;
}

interface TripSearchResult {
  tripId: string;
  serviceDate: string;
  patternCode: string;
  patternName: string;
  vehicleClass: string | null;
  operatorName: string | null;
  operatorLogo: string | null;
  origin: StopSummary | null;
  destination: StopSummary | null;
  departAt: string | null;
  arriveAt: string | null;
  availableSeats: number;
  baseFare: string | null;
}

interface TripDetail {
  tripId: string;
  serviceDate: string | null;
  patternCode: string | null;
  patternName: string | null;
  vehicleClass: string | null;
  operatorName: string | null;
  operatorLogo: string | null;
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

interface SeatmapResponse {
  layout: { rows: number | null; cols: number | null; seatMap: unknown };
  seatAvailability: Record<string, { available: boolean; held: boolean }>;
}

interface PassengerInfo {
  id: string;
  fullName: string;
  phone: string | null;
  seatNo: string;
  fareAmount: string | null;
}

interface QrDataItem {
  passengerId: string;
  seatNo: string;
  fullName: string;
  qrToken: string;
  qrPayload: string;
}

interface PaymentIntent {
  paymentId: string;
  method: string;
  amount: string | null;
  status: string | null;
  providerRef: string | null;
  expiresAt: string | null;
}

interface BookingListItem {
  id: string;
  tripId: string;
  serviceDate: string | null;
  patternCode: string | null;
  patternName: string | null;
  status: string | null;
  totalAmount: string | null;
  origin: StopSummary | null;
  destination: StopSummary | null;
  passengerCount: number;
}

interface BookingDetail {
  id: string;
  tripId: string;
  serviceDate: string | null;
  patternCode: string | null;
  patternName: string | null;
  origin: StopDetail | null;
  destination: StopDetail | null;
  departAt: string | null;
  arriveAt: string | null;
  status: string | null;
  totalAmount: string | null;
  channel: string | null;
  holdExpiresAt: string | null;
  qrData: QrDataItem[];
  passengers: PassengerInfo[];
  payments: Array<{
    id: string;
    method: string;
    amount: string | null;
    status: string | null;
    paidAt: string | null;
  }>;
  paymentIntent: PaymentIntent | null;
  createdAt: string | null;
}

interface PaymentStatusResponse {
  bookingId: string;
  bookingStatus: string | null;
  paymentId: string;
  paymentStatus: string | null;
  method: string;
  amount: string | null;
  providerRef: string | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  userName: string | null;
  createdAt: string | null;
}

interface CargoTrackResult {
  waybillNumber: string;
  status: string | null;
  origin: StopSummary | null;
  destination: StopSummary | null;
  serviceDate: string | null;
  patternName: string | null;
  senderName: string;
  recipientName: string;
  itemDescription: string | null;
  weightKg: string | null;
  totalAmount: string | null;
  createdAt: string | null;
}

interface CreateBookingData {
  tripId: string;
  originStopId: string;
  destinationStopId: string;
  originSeq: number;
  destinationSeq: number;
  passengers: Array<{ fullName: string; phone?: string; idNumber?: string; seatNo: string }>;
  paymentMethod: 'qr' | 'ewallet' | 'bank';
}

interface CreateCargoData {
  tripId: string;
  originStopId: string;
  destinationStopId: string;
  cargoTypeId?: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  itemDescription: string;
  quantity: number;
  weightKg?: number;
  notes?: string;
}

interface OperatorItem {
  id: string;
  name: string;
  code: string;
  logo: string | null;
}

async function getToken(): Promise<string | null> {
  try {
    return await storage.getItem('auth_token');
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T, B extends Record<string, unknown> = Record<string, unknown>>(path: string, body: B) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T, B extends Record<string, unknown> = Record<string, unknown>>(path: string, body: B) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    api.post<AuthResponse>('/api/app/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/api/app/auth/login', data),
  getMe: () => api.get<AppUser>('/api/app/auth/me'),
  getProfile: () => api.get<AppUser>('/api/app/profile'),
  updateProfile: (data: { name?: string; phone?: string }) =>
    api.patch<AppUser>('/api/app/profile', data),
};

export const operatorsApi = {
  list: () => api.get<OperatorItem[]>('/api/app/operators'),
};

export const tripsApi = {
  getCities: () => api.get<{ city: string; stopCount: number }[]>('/api/app/cities'),
  search: (params: { originCity: string; destinationCity: string; date: string; passengers?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<TripSearchResult[]>(`/api/app/trips/search?${qs}`);
  },
  getDetail: (tripId: string) => api.get<TripDetail>(`/api/app/trips/${tripId}`),
  getSeatmap: (tripId: string, originSeq: number, destSeq: number) =>
    api.get<SeatmapResponse>(`/api/app/trips/${tripId}/seatmap?originSeq=${originSeq}&destinationSeq=${destSeq}`),
  getReviews: (tripId: string) => api.get<ReviewItem[]>(`/api/app/trips/${tripId}/reviews`),
};

export const bookingsApi = {
  create: (data: CreateBookingData) => api.post<BookingDetail, CreateBookingData>('/api/app/bookings', data),
  list: () => api.get<BookingListItem[]>('/api/app/bookings'),
  getDetail: (id: string) => api.get<BookingDetail>(`/api/app/bookings/${id}`),
  getPaymentStatus: (id: string) => api.get<PaymentStatusResponse>(`/api/app/bookings/${id}/payment-status`),
  cancel: (id: string) => api.post<{ success: boolean }>(`/api/app/bookings/${id}/cancel`, {}),
};

export const reviewsApi = {
  create: (data: { tripId: string; bookingId?: string; rating: number; comment?: string }) =>
    api.post<ReviewItem, typeof data>('/api/app/reviews', data),
};

export const cargoApi = {
  track: (waybillNumber: string) => api.get<CargoTrackResult>(`/api/app/cargo/track/${waybillNumber}`),
  create: (data: CreateCargoData) => api.post<Record<string, unknown>, CreateCargoData>('/api/app/cargo', data),
};
