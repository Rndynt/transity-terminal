import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { bookingsApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Booking, Stop } from '@/types';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  List, Search, X, Loader2, RefreshCw,
  ArrowRight, User,
  Calendar, Ticket, MapPin, ChevronDown, ChevronUp,
  Package, ExternalLink, UserMinus, History
} from 'lucide-react';
import PassengerCard from '@/components/cso/PassengerCard';
import { BookingStatusBadge, ChannelBadge } from '@/components/shared/StatusBadges';
import { CanAccess } from '@/components/rbac/CanAccess';
import {
  BOOKING_STATUS_MAP, HISTORY_ACTION_MAP,
  ALL_BOOKING_STATUSES, ALL_CHANNELS,
  fmtCurrency, fmtDate, fmtShortDate, getPaymentLabel,
  type BookingStatus, type BookingChannel,
} from '@/lib/constants';

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
  onAssignInCso,
}: {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInCso?: (tripId: string, outletId: string, serviceDate: string, originStopId: string, destinationStopId: string) => void;
  onAssignInCso?: (tripId: string, outletId: string, serviceDate: string, originStopId: string, destinationStopId: string, passengerId: string, passengerName: string, bookingCode: string, ticketNumber: string | null) => void;
}) {
  const [passengersOpen, setPassengersOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmUnseatAll, setConfirmUnseatAll] = useState(false);
  const [unseatAllReason, setUnseatAllReason] = useState('');
  const { toast } = useToast();

  const { data: detail, isLoading, isError } = useQuery<BookingDetail>({
    queryKey: ['/api/bookings', bookingId],
    queryFn: () => bookingsApi.getById(bookingId!),
    enabled: !!bookingId && isOpen,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['/api/bookings', bookingId, 'history'],
    queryFn: () => bookingsApi.getHistory(bookingId!),
    enabled: !!bookingId && isOpen && historyOpen,
  });

  const unseatAllMutation = useMutation({
    mutationFn: ({ bId, reason }: { bId: string; reason: string }) =>
      bookingsApi.unseatAll(bId, reason),
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Semua penumpang berhasil di-unseat.' });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setConfirmUnseatAll(false);
      setUnseatAllReason('');
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const hasActivePassengers = detail?.passengers?.some(
    (p: any) => p.ticketStatus !== 'unseated' && p.ticketStatus !== 'canceled'
  );


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
                <BookingStatusBadge status={detail.status ?? ''} />
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
                  <p className="font-medium mt-0.5">
                    {detail.channel ? <ChannelBadge channel={detail.channel} /> : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold text-emerald-700 mt-0.5">{fmtCurrency(detail.totalAmount ?? 0)}</p>
                  {detail.discountAmount && parseFloat(String(detail.discountAmount)) > 0 && (
                    <p className="text-[11px] text-orange-600 mt-0.5">
                      Diskon: -{fmtCurrency(detail.discountAmount)} {detail.voucherCode ? `(${detail.voucherCode})` : ''}
                    </p>
                  )}
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
                  <div className="p-3 space-y-3">
                    {detail.passengers.map((p: any, idx: number) => (
                      <PassengerCard
                        key={p.id ?? idx}
                        passenger={p}
                        showHeader={false}
                        actionTarget={{
                          id: p.id,
                          fullName: p.fullName,
                          seatNo: p.seatNo,
                          ticketNumber: p.ticketNumber,
                          ticketStatus: p.ticketStatus ?? 'active',
                          bookingCode: detail.bookingCode ?? detail.id.slice(0, 8).toUpperCase(),
                          bookingId: detail.id,
                          originStopName: detail.originStop?.name,
                          destinationStopName: detail.destinationStop?.name,
                        }}
                        onClose={onClose}
                        onAssignInCso={
                          detail.tripId && detail.outletId && detail.tripDetails?.serviceDate && detail.originStopId && detail.destinationStopId && onAssignInCso
                            ? (passengerId, passengerName, bookingCode, ticketNumber) =>
                              onAssignInCso(detail.tripId, detail.outletId!, detail.tripDetails.serviceDate, detail.originStopId, detail.destinationStopId, passengerId, passengerName, bookingCode, ticketNumber)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}

                {hasActivePassengers && detail.passengers.length > 1 && (
                  <div className="px-4 py-2 border-t bg-muted/10">
                    {confirmUnseatAll ? (
                      <div className="space-y-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-700 font-semibold">Unseat semua penumpang?</p>
                        <Textarea
                          placeholder="Alasan unseat semua (wajib diisi)..."
                          value={unseatAllReason}
                          onChange={e => setUnseatAllReason(e.target.value)}
                          className="min-h-[50px] text-xs border-red-200 focus:border-red-400 focus:ring-red-100"
                          data-testid="input-unseat-all-reason"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="destructive" className="h-6 text-xs gap-1" disabled={!unseatAllReason.trim() || unseatAllMutation.isPending}
                            onClick={() => unseatAllMutation.mutate({ bId: bookingId!, reason: unseatAllReason.trim() })} data-testid="btn-confirm-unseat-all">
                            {unseatAllMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />} Ya, Unseat Semua
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setConfirmUnseatAll(false); setUnseatAllReason(''); }}>Batal</Button>
                        </div>
                      </div>
                    ) : (
                      <CanAccess flag="action.passenger.unseat">
                        <Button size="sm" variant="outline" className="h-6 text-xs gap-1 w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => setConfirmUnseatAll(true)} data-testid="btn-unseat-all">
                          <UserMinus className="w-3 h-3" /> Unseat Semua Penumpang
                        </Button>
                      </CanAccess>
                    )}
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
                          <span className="font-mono">{fmtCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-orange-600" data-testid="text-discount-detail">
                          <span>Diskon {detail.voucherCode ? <span className="font-mono text-[10px]">({detail.voucherCode})</span> : ''}</span>
                          <span className="font-mono">-{fmtCurrency(discount)}</span>
                        </div>
                        <Separator />
                      </>
                    )}
                    <div className="flex justify-between font-semibold">
                      <span>Total Bayar</span>
                      <span className="text-emerald-700 font-mono">{fmtCurrency(total)}</span>
                    </div>
                    {!!detail.payments?.length && (
                      <div className="pt-2 space-y-1.5 border-t mt-2">
                        {detail.payments.map((pay: any, idx: number) => (
                          <div key={pay.id ?? idx} className="flex items-center justify-between text-xs">
                            <div>
                              <span className="font-medium">{getPaymentLabel(pay.method)}</span>
                              {pay.paidAt && <span className="text-muted-foreground ml-1.5">{fmtShortDate(pay.paidAt)}</span>}
                            </div>
                            <span className="font-mono text-emerald-700">{fmtCurrency(pay.amount ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Booking History */}
            <div className="rounded-lg border overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-semibold"
                onClick={() => setHistoryOpen(o => !o)}
                data-testid="btn-toggle-history"
              >
                <span className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  Riwayat Perubahan
                </span>
                {historyOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {historyOpen && (
                <div className="px-4 py-3">
                  {(history as any[]).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada riwayat perubahan</p>
                  ) : (
                    <div className="space-y-3">
                      {(history as any[]).map((h: any, i: number) => {
                        const actionInfo = HISTORY_ACTION_MAP[h.action as keyof typeof HISTORY_ACTION_MAP] || { label: h.action, color: 'text-gray-600', dotColor: 'bg-gray-400' };
                        const details = h.details as any;
                        return (
                          <div key={h.id || i} className="flex gap-3 text-xs" data-testid={`history-${i}`}>
                            <div className="flex flex-col items-center">
                              <div className={`w-2 h-2 rounded-full mt-1.5 ${h.action === 'unseated' ? 'bg-orange-400' : h.action === 'reassigned' ? 'bg-blue-400' : h.action === 'rescheduled' ? 'bg-purple-400' : 'bg-gray-400'}`} />
                              {i < (history as any[]).length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                            </div>
                            <div className="flex-1 pb-3">
                              <span className={`font-semibold ${actionInfo.color}`}>{actionInfo.label}</span>
                              {details?.seatNo && <span className="text-muted-foreground ml-1">Kursi {details.seatNo}</span>}
                              {details?.oldSeatNo && details?.newSeatNo && (
                                <span className="text-muted-foreground ml-1">{details.oldSeatNo} → {details.newSeatNo}</span>
                              )}
                              {details?.reason && <span className="text-muted-foreground ml-1">— {details.reason}</span>}
                              <div className="text-muted-foreground mt-0.5">
                                {h.performedBy && <span>{h.performedBy}</span>}
                                {h.createdAt && <span className="ml-2">{fmtDate(h.createdAt)}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
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


  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="all-bookings-page">
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between px-3 md:px-5 h-11 md:h-12">
          <div className="flex items-center gap-1.5">
            <List className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-gray-800">Daftar Booking</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1">
              {filtered.length} booking
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 md:p-4 space-y-3 flex-shrink-0 bg-white border-b border-gray-100">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari kode, rute, atau operator..."
                  className="w-full h-9 pl-9 pr-8 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  data-testid="input-search-bookings"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" data-testid="btn-clear-search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-9 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                data-testid="btn-refresh-bookings"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Refresh</span>
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {([
                { value: 'all' as const, label: 'Semua' },
                ...ALL_BOOKING_STATUSES.map(s => ({ value: s, label: BOOKING_STATUS_MAP[s].label }))
              ]).map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                    statusFilter === f.value
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  data-testid={`filter-status-${f.value}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {(['all', ...ALL_CHANNELS] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch as BookingChannel | 'all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                    channelFilter === ch
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  data-testid={`filter-channel-${ch}`}
                >
                  {ch === 'all' ? 'Semua Channel' : ch}
                </button>
              ))}
            </div>
          </div>

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
                      <td className="px-4 py-3">
                        <BookingStatusBadge status={b.status ?? ''} />
                      </td>
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
                      <td className="px-4 py-3 hidden md:table-cell">
                        <ChannelBadge channel={b.channel ?? ''} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-emerald-700 text-xs whitespace-nowrap">
                          {fmtCurrency(b.totalAmount ?? 0)}
                        </span>
                      </td>
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

          {!isLoading && filtered.length > 0 && (
            <div className="border-t px-3 md:px-5 py-2 flex-shrink-0 flex items-center justify-between bg-white">
              <p className="text-xs text-muted-foreground">
                Menampilkan <strong>{filtered.length}</strong> dari <strong>{bookings.length}</strong> booking
              </p>
            </div>
          )}
        </div>
      </div>

      <BookingDetailModal
        bookingId={selectedId}
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        onOpenInCso={(tripId, outletId, serviceDate, originStopId, destinationStopId) => {
          setSelectedId(null);
          navigate(`/cso?tripId=${tripId}&outletId=${outletId}&date=${serviceDate}&originStopId=${originStopId}&destinationStopId=${destinationStopId}`);
        }}
        onAssignInCso={(tripId, outletId, serviceDate, originStopId, destinationStopId, passengerId, passengerName, bookingCode, ticketNumber) => {
          setSelectedId(null);
          const params = new URLSearchParams({
            tripId, outletId, date: serviceDate, originStopId, destinationStopId,
            assignPassengerId: passengerId,
            assignPassengerName: passengerName,
            assignBookingCode: bookingCode,
          });
          if (ticketNumber) params.set('assignTicketNumber', ticketNumber);
          navigate(`/cso?${params.toString()}`);
        }}
      />
    </div>
  );
}
