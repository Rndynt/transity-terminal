import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://your-repl-domain.replit.app';

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('auth_token');
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
  post: <T>(path: string, body: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: any) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    api.post<{ user: any; token: string }>('/api/app/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: any; token: string }>('/api/app/auth/login', data),
  getMe: () => api.get<any>('/api/app/auth/me'),
  getProfile: () => api.get<any>('/api/app/profile'),
  updateProfile: (data: { name?: string; phone?: string }) =>
    api.patch<any>('/api/app/profile', data),
};

export const operatorsApi = {
  list: () => api.get<any[]>('/api/app/operators'),
};

export const tripsApi = {
  getCities: () => api.get<{ city: string; stopCount: number }[]>('/api/app/cities'),
  search: (params: { originCity: string; destinationCity: string; date: string; passengers?: number }) => {
    const qs = new URLSearchParams(params as any).toString();
    return api.get<any[]>(`/api/app/trips/search?${qs}`);
  },
  getDetail: (tripId: string) => api.get<any>(`/api/app/trips/${tripId}`),
  getSeatmap: (tripId: string, originSeq: number, destSeq: number) =>
    api.get<any>(`/api/app/trips/${tripId}/seatmap?originSeq=${originSeq}&destinationSeq=${destSeq}`),
  getReviews: (tripId: string) => api.get<any[]>(`/api/app/trips/${tripId}/reviews`),
};

export const bookingsApi = {
  create: (data: any) => api.post<any>('/api/app/bookings', data),
  list: () => api.get<any[]>('/api/app/bookings'),
  getDetail: (id: string) => api.get<any>(`/api/app/bookings/${id}`),
  confirmPayment: (id: string) => api.post<any>(`/api/app/bookings/${id}/confirm-payment`, {}),
  cancel: (id: string) => api.post<any>(`/api/app/bookings/${id}/cancel`, {}),
};

export const reviewsApi = {
  create: (data: { tripId: string; bookingId?: string; rating: number; comment?: string }) =>
    api.post<any>('/api/app/reviews', data),
};

export const cargoApi = {
  track: (waybillNumber: string) => api.get<any>(`/api/app/cargo/track/${waybillNumber}`),
  create: (data: any) => api.post<any>('/api/app/cargo', data),
};
