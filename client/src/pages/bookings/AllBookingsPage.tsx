import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { bookingsApi, stopsApi } from '@/lib/api';
import type { Booking, Stop } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  List, Search, X, Loader2, RefreshCw,
  ArrowRight, User, CreditCard, Phone, Hash,
  Calendar, Ticket, MapPin, Armchair, ChevronDown, ChevronUp,
  Bus, Package, ExternalLink
} from 'lucide-react';

type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'paid' | 'canceled' | 'refunded';
type BookingChannel = 'CSO' | 'WEB' | 'APP' | 'OTA';

const STATUS_MAP: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: 'text-amber-700',  bg: 'bg-amber-50 border border-amber-200' },
  confirmed:  { label: 'Terkonfirmasi', color: 'text-blue-700',   bg: 'bg-blue-50 border border-blue-200' },
  checked_in: { label: 'Check-In',   color: 'text-indigo-700', bg: 'bg-indigo-50 border border-indigo-200' },
  paid:       { label: 'Lunas',      color: 'text-emerald-700',bg: 'bg-emerald-50 border border-emerald-200' },
  canceled:   { label: 'Dibatalkan', color: 'text-red-700',    bg: 'bg-red-50 border border-red-200' },
  refunded:   { label: 'Refund',     color: 'text-purple-700', bg: 'bg-purple-50 border border-purple-200' },
};

const CHANNEL_MAP: Record<BookingChannel, { label: string; color: string }> = {
  CSO: { label: 'CSO',  color: 'text-blue-600' },
  WEB: { label: 'Web',  color: 'text-green-600' },
  APP: { label: 'App',  color: 'text-purple-600' },
  OTA: { label: 'OTA',  color: 'text-orange-600' },
};

const ALL_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked_in', 'paid', 'canceled', 'refunded'];
const ALL_CHANNELS: BookingChannel[] = ['CSO', 'WEB', 'APP', 'OTA'];

const fmt = (amount: string | number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
    .format(typeof amount === 'string' ? parseFloat(amount) : amount);

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Jakarta'
  });
};

const fmtShortDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Jakarta'
  });
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status as BookingStatus] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-50 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const c = CHANNEL_MAP[channel as BookingChannel] ?? { label: channel, color: 'text-gray-500' };
  return <span className={`text-[11px] font-semibold ${c.color}`}>{c.label}</span>;
}

type EnrichedBooking = Booking & {
  _originStop?: Stop;
  _destinationStop?: Stop;
};

type BookingDetail = Booking & {
  passengers?: any[];
  payments?: any[];
  tripDetails?: any;
  originStop?: any;
  destinationStop?: any;
  outlet?: any;
  vehicle?: any;
  departAt?: string | null;
  arriveAt?: string | null;
};

function BookingDetailModal({
  bookingId,
  isOpen,
  onClose,
  onOpenInCso,
}: {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInCso?: (tripId: string, outletId: string, serviceDate: string, originStopId: string, destinationStopId: string) => void;
}) {
  const [passengersOpen, setPassengersOpen] = useState(true);

  const { data: detail, isLoading, isError } = useQuery<BookingDetail>({
    queryKey: ['/api/bookings', bookingId],
    queryFn: () => bookingsApi.getById(bookingId!),
    enabled: !!bookingId && isOpen,
  });

  const getPaymentLabel = (method: string) => ({
    cash: 'Tunai', qr: 'QRIS', ewallet: 'E-Wallet', bank: 'Transfer Bank'
  }[method] ?? method);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ticket className="w-4 h-4 text-blue-600" />
            Detail Booking
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}
        {isError && (
          <div className="py-8 text-center text-sm text-red-500">
            Gagal memuat detail booking.
          </div>
        )}
        {detail && !isLoading && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Kode Booking</p>
                  <p className="font-mono font-bold text-base text-blue-700">
                    {detail.bookingCode ?? detail.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <StatusBadge status={detail.status ?? ''} />
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{detail.originStop?.name ?? '—'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{detail.destinationStop?.name ?? '—'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Channel</p>
                  <p className="font-medium mt-0.5">{detail.channel ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold text-emerald-700 mt-0.5">{fmt(detail.totalAmount ?? 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dibuat</p>
                  <p className="font-medium mt-0.5">{fmtDate(detail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Oleh</p>
                  <p className="font-medium mt-0.5 truncate">{detail.createdBy ?? '—'}</p>
                </div>
                {detail.outlet && (
                  <div>
                    <p className="text-muted-foreground">Outlet</p>
                    <p className="font-medium mt-0.5 truncate">{detail.outlet.name}</p>
                  </div>
                )}
                {detail.vehicle && (
                  <div>
                    <p className="text-muted-foreground">Kendaraan</p>
                    <p className="font-medium mt-0.5">{detail.vehicle.plate} ({detail.vehicle.code})</p>
                  </div>
                )}
                {detail.departAt && (
                  <div>
                    <p className="text-muted-foreground">Berangkat</p>
                    <p className="font-medium mt-0.5">{fmtShortDate(detail.departAt)}</p>
                  </div>
                )}
                {detail.arriveAt && (
                  <div>
                    <p className="text-muted-foreground">Tiba</p>
                    <p className="font-medium mt-0.5">{fmtShortDate(detail.arriveAt)}</p>
                  </div>
                )}
              </div>

              {detail.tripId && detail.outletId && detail.tripDetails?.serviceDate && detail.originStopId && detail.destinationStopId && onOpenInCso && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 mt-1"
                  onClick={() => onOpenInCso(detail.tripId, detail.outletId!, detail.tripDetails.serviceDate, detail.originStopId, detail.destinationStopId)}
                  data-testid="btn-open-in-cso"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka di Reservasi
                </Button>
              )}
            </div>

            {/* Passengers */}
            {!!detail.passengers?.length && (
              <div className="rounded-lg border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-semibold"
                  onClick={() => setPassengersOpen(o => !o)}
                  data-testid="btn-toggle-passengers"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    Penumpang ({detail.passengers.length})
                  </span>
                  {passengersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {passengersOpen && (
                  <div className="divide-y">
                    {detail.passengers.map((p: any, idx: number) => (
                      <div key={p.id ?? idx} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{p.fullName}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Armchair className="w-3 h-3" />
                            {p.seatNo}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {p.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {p.phone}
                            </span>
                          )}
                          {p.idNumber && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" /> {p.idNumber}
                            </span>
                          )}
                          {p.ticketNumber && (
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" /> {p.ticketNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-emerald-700">{fmt(p.fareAmount ?? 0)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payment Summary */}
            {(() => {
              const discount = parseFloat(String(detail.discountAmount || 0));
              const total = parseFloat(String(detail.totalAmount || 0));
              const subtotal = discount > 0 ? total + discount : total;
              const hasDiscount = discount > 0;
              return (
                <div className="rounded-lg border overflow-hidden" data-testid="payment-summary">
                  <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                    <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                    Rincian Pembayaran
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-sm">
                    {hasDiscount && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-mono">{fmt(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-orange-600" data-testid="text-discount-detail">
                          <span>Diskon {detail.voucherCode ? <span className="font-mono text-[10px]">({detail.voucherCode})</span> : ''}</span>
                          <span className="font-mono">-{fmt(discount)}</span>
                        </div>
                        <Separator />
                      </>
                    )}
                    <div className="flex justify-between font-semibold">
                      <span>Total Bayar</span>
                      <span className="text-emerald-700 font-mono">{fmt(total)}</span>
                    </div>
                    {!!detail.payments?.length && (
                      <div className="pt-2 space-y-1.5 border-t mt-2">
                        {detail.payments.map((pay: any, idx: number) => (
                          <div key={pay.id ?? idx} className="flex items-center justify-between text-xs">
                            <div>
                              <span className="font-medium">{getPaymentLabel(pay.method)}</span>
                              {pay.paidAt && <span className="text-muted-foreground ml-1.5">{fmtShortDate(pay.paidAt)}</span>}
                            </div>
                            <span className="font-mono text-emerald-700">{fmt(pay.amount ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AllBookingsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<BookingChannel | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: bookings = [], isLoading, refetch, isFetching } = useQuery<Booking[]>({
    queryKey: ['/api/bookings'],
    queryFn: () => bookingsApi.getAll(),
    staleTime: 30_000,
  });

  const { data: stops = [] } = useQuery<Stop[]>({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll,
    staleTime: 60_000,
  });

  const stopMap = useMemo(() => {
    const m: Record<string, Stop> = {};
    stops.forEach(s => { m[s.id] = s; });
    return m;
  }, [stops]);

  const enriched: EnrichedBooking[] = useMemo(() =>
    bookings.map(b => ({
      ...b,
      _originStop: b.originStopId ? stopMap[b.originStopId] : undefined,
      _destinationStop: b.destinationStopId ? stopMap[b.destinationStopId] : undefined,
    })),
    [bookings, stopMap]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enriched.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (channelFilter !== 'all' && b.channel !== channelFilter) return false;
      if (!q) return true;
      const code = (b.bookingCode ?? '').toLowerCase();
      const originName = (b._originStop?.name ?? '').toLowerCase();
      const destName = (b._destinationStop?.name ?? '').toLowerCase();
      const createdBy = (b.createdBy ?? '').toLowerCase();
      return code.includes(q) || originName.includes(q) || destName.includes(q) || createdBy.includes(q);
    });
  }, [enriched, search, statusFilter, channelFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length };
    ALL_STATUSES.forEach(s => { c[s] = bookings.filter(b => b.status === s).length; });
    return c;
  }, [bookings]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <List className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">All Bookings</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Daftar semua transaksi booking dari semua channel dan outlet.
        </p>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b bg-muted/20 shrink-0 space-y-3">
        {/* Search + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari kode, rute, atau operator..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
              data-testid="input-search-bookings"
            />
            {search && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
                data-testid="btn-clear-search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 h-9"
            data-testid="btn-refresh-bookings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
            data-testid="filter-status-all"
          >
            Semua ({counts.all})
          </button>
          {ALL_STATUSES.map(s => {
            const sm = STATUS_MAP[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  statusFilter === s ? `${sm.bg} ${sm.color} border-current` : 'text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
                data-testid={`filter-status-${s}`}
              >
                {sm.label} ({counts[s] ?? 0})
              </button>
            );
          })}
        </div>

        {/* Channel filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Channel:</span>
          {(['all', ...ALL_CHANNELS] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch as BookingChannel | 'all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                channelFilter === ch
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-600 border-gray-200 hover:border-blue-400'
              }`}
              data-testid={`filter-channel-${ch}`}
            >
              {ch === 'all' ? 'Semua' : ch}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState message="Memuat data booking..." size="lg" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Tidak ada booking ditemukan."
            action={(search || statusFilter !== 'all' || channelFilter !== 'all') ? (
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={() => { setSearch(''); setStatusFilter('all'); setChannelFilter('all'); }}
                data-testid="button-reset-filters"
              >
                Reset filter
              </button>
            ) : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur border-b z-10">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kode Booking</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rute</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Channel</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(b => (
                <tr
                  key={b.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedId(b.id)}
                  data-testid={`row-booking-${b.id}`}
                >
                  {/* Kode Booking */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="font-mono font-semibold text-blue-700 text-xs">
                        {b.bookingCode ?? b.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    {b.createdBy && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 pl-5 truncate max-w-[140px]">{b.createdBy}</p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status ?? ''} />
                  </td>

                  {/* Rute */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-foreground">
                      <span className="font-medium max-w-[100px] truncate">
                        {b._originStop?.name ?? b.originStopId?.slice(0, 6) ?? '—'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium max-w-[100px] truncate">
                        {b._destinationStop?.name ?? b.destinationStopId?.slice(0, 6) ?? '—'}
                      </span>
                    </div>
                    {(b._originStop?.city || b._destinationStop?.city) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {b._originStop?.city ?? ''} → {b._destinationStop?.city ?? ''}
                      </p>
                    )}
                  </td>

                  {/* Channel */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ChannelBadge channel={b.channel ?? ''} />
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-emerald-700 text-xs whitespace-nowrap">
                      {fmt(b.totalAmount ?? 0)}
                    </span>
                  </td>

                  {/* Dibuat */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      {fmtDate(b.createdAt)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && filtered.length > 0 && (
        <div className="border-t px-6 py-2 shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Menampilkan <strong>{filtered.length}</strong> dari <strong>{bookings.length}</strong> booking
          </p>
        </div>
      )}

      {/* Detail Modal */}
      <BookingDetailModal
        bookingId={selectedId}
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        onOpenInCso={(tripId, outletId, serviceDate, originStopId, destinationStopId) => {
          setSelectedId(null);
          navigate(`/cso?tripId=${tripId}&outletId=${outletId}&date=${serviceDate}&originStopId=${originStopId}&destinationStopId=${destinationStopId}`);
        }}
      />
    </div>
  );
}
