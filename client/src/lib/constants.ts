export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'paid' | 'canceled' | 'refunded' | 'unseated';
export type BookingChannel = 'CSO' | 'WEB' | 'APP' | 'OTA';
export type TripStatus = 'scheduled' | 'canceled' | 'closed';
export type TicketStatus = 'active' | 'checked_in' | 'no_show' | 'canceled' | 'refunded' | 'unseated';
export type CargoStatus = 'pending' | 'received' | 'loaded' | 'in_transit' | 'arrived' | 'delivered' | 'returned' | 'canceled';
export type SpjStatus = 'draft' | 'issued' | 'on_trip' | 'settled';
export type HistoryAction = 'unseated' | 'reassigned' | 'rescheduled' | 'canceled' | 'status_change';

export const BOOKING_STATUS_MAP: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',        color: 'text-amber-700',   bg: 'bg-amber-50 border border-amber-200' },
  confirmed:  { label: 'Terkonfirmasi',  color: 'text-blue-700',    bg: 'bg-blue-50 border border-blue-200' },
  checked_in: { label: 'Check-In',       color: 'text-indigo-700',  bg: 'bg-indigo-50 border border-indigo-200' },
  paid:       { label: 'Lunas',          color: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-200' },
  canceled:   { label: 'Dibatalkan',     color: 'text-red-700',     bg: 'bg-red-50 border border-red-200' },
  refunded:   { label: 'Refund',         color: 'text-purple-700',  bg: 'bg-purple-50 border border-purple-200' },
  unseated:   { label: 'Unseated',       color: 'text-orange-700',  bg: 'bg-orange-50 border border-orange-200' },
};

export const CHANNEL_MAP: Record<BookingChannel, { label: string; color: string }> = {
  CSO: { label: 'CSO',  color: 'text-blue-600' },
  WEB: { label: 'Web',  color: 'text-green-600' },
  APP: { label: 'App',  color: 'text-purple-600' },
  OTA: { label: 'OTA',  color: 'text-orange-600' },
};

export const TRIP_STATUS_MAP: Record<TripStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Terjadwal',   color: 'text-blue-700',  bg: 'bg-blue-100 border border-blue-200' },
  canceled:  { label: 'Dibatalkan',  color: 'text-red-700',   bg: 'bg-red-100 border border-red-200' },
  closed:    { label: 'Ditutup',     color: 'text-gray-600',  bg: 'bg-gray-100 border border-gray-200' },
};

export const TICKET_STATUS_MAP: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  active:     { label: 'Aktif',     color: 'text-green-800',   bg: 'bg-green-100' },
  checked_in: { label: 'Check-In',  color: 'text-blue-800',    bg: 'bg-blue-100' },
  no_show:    { label: 'No-Show',   color: 'text-red-800',     bg: 'bg-red-100' },
  canceled:   { label: 'Batal',     color: 'text-gray-600',    bg: 'bg-gray-100' },
  refunded:   { label: 'Refund',    color: 'text-orange-800',  bg: 'bg-orange-100' },
  unseated:   { label: 'Unseated',  color: 'text-orange-700',  bg: 'bg-orange-100' },
};

export const CARGO_STATUS_MAP: Record<CargoStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Menunggu',           color: 'text-amber-700',   bg: 'bg-amber-100' },
  received:   { label: 'Diterima',           color: 'text-orange-700',  bg: 'bg-orange-100' },
  loaded:     { label: 'Dimuat',             color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  in_transit: { label: 'Dalam Perjalanan',   color: 'text-blue-700',    bg: 'bg-blue-100' },
  arrived:    { label: 'Tiba',               color: 'text-emerald-700', bg: 'bg-emerald-100' },
  delivered:  { label: 'Terkirim',           color: 'text-emerald-700', bg: 'bg-emerald-100' },
  returned:   { label: 'Dikembalikan',       color: 'text-purple-700',  bg: 'bg-purple-100' },
  canceled:   { label: 'Dibatalkan',         color: 'text-red-700',     bg: 'bg-red-100' },
};

export const SPJ_STATUS_MAP: Record<SpjStatus, { label: string; color: string; bg: string }> = {
  draft:   { label: 'Draft',            color: 'text-gray-700',    bg: 'bg-gray-100 border border-gray-200' },
  issued:  { label: 'Diterbitkan',      color: 'text-blue-700',    bg: 'bg-blue-100 border border-blue-200' },
  on_trip: { label: 'Dalam Perjalanan', color: 'text-amber-700',   bg: 'bg-amber-100 border border-amber-200' },
  settled: { label: 'Selesai',          color: 'text-green-700',   bg: 'bg-green-100 border border-green-200' },
};

export const HISTORY_ACTION_MAP: Record<HistoryAction, { label: string; color: string; dotColor: string }> = {
  unseated:      { label: 'Unseat',         color: 'text-orange-600', dotColor: 'bg-orange-400' },
  reassigned:    { label: 'Pindah Kursi',   color: 'text-blue-600',   dotColor: 'bg-blue-400' },
  rescheduled:   { label: 'Reschedule',     color: 'text-purple-600', dotColor: 'bg-purple-400' },
  canceled:      { label: 'Dibatalkan',     color: 'text-red-600',    dotColor: 'bg-red-400' },
  status_change: { label: 'Status Berubah', color: 'text-gray-600',   dotColor: 'bg-gray-400' },
};

export const ALL_BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked_in', 'paid', 'canceled', 'refunded', 'unseated'];
export const ALL_CHANNELS: BookingChannel[] = ['CSO', 'WEB', 'APP', 'OTA'];

export const CARGO_STATUS_TRANSITIONS: Record<CargoStatus, CargoStatus[]> = {
  pending: ['received', 'canceled'],
  received: ['loaded', 'canceled'],
  loaded: ['in_transit', 'canceled'],
  in_transit: ['arrived', 'canceled'],
  arrived: ['delivered', 'returned'],
  delivered: [],
  returned: [],
  canceled: [],
};

export const fmtCurrency = (amount: string | number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
    .format(typeof amount === 'string' ? parseFloat(amount) : amount);

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Jakarta'
  });
};

export const fmtShortDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Jakarta'
  });
};

export const getPaymentLabel = (method: string) => ({
  cash: 'Tunai', qr: 'QRIS', ewallet: 'E-Wallet', bank: 'Transfer Bank'
}[method] ?? method);
