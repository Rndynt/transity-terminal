import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Phone, CreditCard, MapPin, User, Armchair, Ticket, Hash,
  ChevronDown, ChevronUp, ArrowRight, Calendar, Building2, Bus,
  UserMinus, ArrowLeftRight, Loader2, CalendarClock, Ban
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { passengersApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Passenger, Booking, Payment, Stop } from '@/types';

type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'paid' | 'canceled' | 'refunded' | 'unseated';

const STATUS_MAP: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: 'text-amber-700',  bg: 'bg-amber-50 border border-amber-200' },
  confirmed:  { label: 'Terkonfirmasi', color: 'text-blue-700',   bg: 'bg-blue-50 border border-blue-200' },
  checked_in: { label: 'Check-In',   color: 'text-indigo-700', bg: 'bg-indigo-50 border border-indigo-200' },
  paid:       { label: 'Lunas',      color: 'text-emerald-700',bg: 'bg-emerald-50 border border-emerald-200' },
  canceled:   { label: 'Dibatalkan', color: 'text-red-700',    bg: 'bg-red-50 border border-red-200' },
  refunded:   { label: 'Refund',     color: 'text-purple-700', bg: 'bg-purple-50 border border-purple-200' },
  unseated:   { label: 'Unseated',   color: 'text-orange-700', bg: 'bg-orange-50 border border-orange-200' },
};

const CHANNEL_MAP: Record<string, { label: string; color: string }> = {
  CSO: { label: 'CSO',  color: 'text-blue-600' },
  WEB: { label: 'Web',  color: 'text-green-600' },
  APP: { label: 'App',  color: 'text-purple-600' },
  OTA: { label: 'OTA',  color: 'text-orange-600' },
};

interface PassengerDetailsData {
  seatNo: string;
  bookings: Array<{
    booking: Booking & {
      originStop?: Stop;
      destinationStop?: Stop;
      outlet?: { id: string; name: string; code?: string };
      vehicle?: { id: string; plate: string; code: string };
      departAt?: string | null;
      arriveAt?: string | null;
    };
    passenger: Passenger;
    payments: Payment[];
  }>;
  available: boolean;
  error?: string;
}

interface PassengerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  passengerDetails: PassengerDetailsData | null;
  isLoading?: boolean;
  isError?: boolean;
  selectedSeatNo?: string | null;
  tripId?: string;
  onStartAssignMode?: (passenger: { id: string; name: string; ticketNumber: string | null; bookingCode: string }) => void;
  onStartRescheduleMode?: (passenger: { id: string; name: string; ticketNumber: string | null; bookingCode: string; seatNo: string; originStopName: string; destinationStopName: string; reason: string }) => void;
}

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

const getPaymentLabel = (method: string) => ({
  cash: 'Tunai', qr: 'QRIS', ewallet: 'E-Wallet', bank: 'Transfer Bank'
}[method] ?? method);

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status as BookingStatus] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-50 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.color}`} data-testid={`booking-status-${status}`}>
      {s.label}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const c = CHANNEL_MAP[channel] ?? { label: channel, color: 'text-gray-500' };
  return <span className={`text-[11px] font-semibold ${c.color}`}>{c.label}</span>;
}

export default function PassengerDetailModal({
  isOpen,
  onClose,
  passengerDetails,
  onStartRescheduleMode,
  isLoading = false,
  isError = false,
  selectedSeatNo = null,
  tripId,
  onStartAssignMode
}: PassengerDetailModalProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set([0]));
  const [reassignSeatNo, setReassignSeatNo] = useState<string>('');
  const [activeReassignId, setActiveReassignId] = useState<string | null>(null);
  const [confirmUnseatId, setConfirmUnseatId] = useState<string | null>(null);
  const [unseatReason, setUnseatReason] = useState<string>('');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [rescheduleReasonId, setRescheduleReasonId] = useState<string | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const { toast } = useToast();

  const unseatMutation = useMutation({
    mutationFn: ({ passengerId, reason }: { passengerId: string; reason: string }) =>
      passengersApi.unseat(passengerId, reason),
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Penumpang berhasil di-unseat. Kursi sekarang tersedia.' });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setConfirmUnseatId(null);
      setUnseatReason('');
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'Gagal Unseat', description: e.message, variant: 'destructive' });
    }
  });

  const cancelTicketMutation = useMutation({
    mutationFn: ({ passengerId, reason }: { passengerId: string; reason: string }) =>
      passengersApi.cancelTicket(passengerId, reason),
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Tiket berhasil dibatalkan.' });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setConfirmCancelId(null);
      setCancelReason('');
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'Gagal Batalkan Tiket', description: e.message, variant: 'destructive' });
    }
  });

  const reassignMutation = useMutation({
    mutationFn: ({ passengerId, newSeatNo }: { passengerId: string; newSeatNo: string }) =>
      passengersApi.reassign(passengerId, newSeatNo),
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Kursi berhasil dipindahkan.' });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setActiveReassignId(null);
      setReassignSeatNo('');
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'Gagal Pindah Kursi', description: e.message, variant: 'destructive' });
    }
  });

  const toggle = (index: number) => {
    setOpenIndices(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const isMulti = (passengerDetails?.bookings?.length ?? 0) > 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose} data-testid="passenger-detail-modal">
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Armchair className="w-4 h-4 text-primary" />
            Detail Penumpang — Kursi {passengerDetails?.seatNo || selectedSeatNo || ''}
            {isMulti && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({passengerDetails!.bookings.length} booking)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div data-testid="modal-content">
          {isLoading && (
            <div className="flex items-center justify-center py-12" data-testid="loading-state">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Memuat detail penumpang...</span>
            </div>
          )}

          {!isLoading && (isError || passengerDetails?.error) && (
            <div className="rounded-lg border bg-card p-5" data-testid="error-state">
              {isError ? (
                <div className="text-center space-y-1">
                  <p className="text-muted-foreground">Gagal memuat detail penumpang</p>
                  <p className="text-xs text-muted-foreground">Periksa koneksi internet dan coba lagi</p>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">{passengerDetails?.error}</p>
              )}
            </div>
          )}

          {!isLoading && passengerDetails?.bookings && passengerDetails.bookings.length > 0 && (
            <div className="space-y-4">
              {passengerDetails.bookings.map((bookingData, index) => {
                const isOpen = openIndices.has(index);
                const b = bookingData.booking as any;
                const p = bookingData.passenger as any;

                return (
                  <div key={b.id} className="space-y-4" data-testid={`booking-${index}`}>
                    {isMulti && (
                      <button
                        type="button"
                        onClick={() => toggle(index)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
                        data-testid={`booking-header-${index}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold font-mono">{p.seatNo}</span>
                          <span>{p.fullName}</span>
                          <StatusBadge status={b.status || 'unknown'} />
                        </span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}

                    {(!isMulti || isOpen) && (
                      <>
                        {/* Booking Header */}
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Kode Booking</p>
                              <p className="font-mono font-bold text-base text-blue-700" data-testid="booking-code">
                                {b.bookingCode ?? b.id?.slice(0, 8).toUpperCase()}
                              </p>
                            </div>
                            <StatusBadge status={b.status || 'unknown'} />
                          </div>

                          <div className="flex items-center gap-2 text-sm font-medium" data-testid="origin-destination">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{b.originStop?.name ?? '—'}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{b.destinationStop?.name ?? '—'}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground">Channel</p>
                              <p className="font-medium mt-0.5">
                                {b.channel ? <ChannelBadge channel={b.channel} /> : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total</p>
                              <p className="font-semibold text-emerald-700 mt-0.5">{fmt(b.totalAmount ?? 0)}</p>
                              {b.discountAmount && parseFloat(String(b.discountAmount)) > 0 && (
                                <p className="text-[11px] text-orange-600 mt-0.5">
                                  Diskon: -{fmt(b.discountAmount)} {b.voucherCode ? `(${b.voucherCode})` : ''}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground">Dibuat</p>
                              <p className="font-medium mt-0.5">{fmtDate(b.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Oleh</p>
                              <p className="font-medium mt-0.5 truncate">{b.createdBy ?? '—'}</p>
                            </div>
                            {b.outlet && (
                              <div>
                                <p className="text-muted-foreground">Outlet</p>
                                <p className="font-medium mt-0.5 truncate">{b.outlet.name}</p>
                              </div>
                            )}
                            {b.vehicle && (
                              <div>
                                <p className="text-muted-foreground">Kendaraan</p>
                                <p className="font-medium mt-0.5">{b.vehicle.plate} ({b.vehicle.code})</p>
                              </div>
                            )}
                            {b.departAt && (
                              <div>
                                <p className="text-muted-foreground">Berangkat</p>
                                <p className="font-medium mt-0.5">{fmtDate(b.departAt)}</p>
                              </div>
                            )}
                            {b.arriveAt && (
                              <div>
                                <p className="text-muted-foreground">Tiba</p>
                                <p className="font-medium mt-0.5">{fmtDate(b.arriveAt)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Passenger */}
                        <div className="rounded-lg border overflow-hidden">
                          <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            Penumpang
                          </div>
                          <div className="px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium" data-testid="passenger-name">{p.fullName}</span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="seat-number">
                                <Armchair className="w-3 h-3" />
                                {p.seatNo}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {p.phone && (
                                <span className="flex items-center gap-1" data-testid="passenger-phone">
                                  <Phone className="w-3 h-3" /> {p.phone}
                                </span>
                              )}
                              {p.idNumber && (
                                <span className="flex items-center gap-1" data-testid="passenger-id">
                                  <CreditCard className="w-3 h-3" /> {p.idNumber}
                                </span>
                              )}
                              {p.ticketNumber && (
                                <span className="flex items-center gap-1" data-testid="ticket-number">
                                  <Hash className="w-3 h-3" /> {p.ticketNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-emerald-700" data-testid="fare-amount">{fmt(p.fareAmount ?? 0)}</p>
                            {p.ticketStatus && p.ticketStatus !== 'active' && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium mt-1 ${
                                STATUS_MAP[p.ticketStatus as BookingStatus]?.bg || 'bg-gray-50 border border-gray-200'
                              } ${STATUS_MAP[p.ticketStatus as BookingStatus]?.color || 'text-gray-700'}`}>
                                Tiket: {STATUS_MAP[p.ticketStatus as BookingStatus]?.label || p.ticketStatus}
                              </span>
                            )}
                          </div>

                          {p.ticketStatus !== 'canceled' && (
                            <div className="px-4 py-2 border-t bg-muted/10 space-y-2">
                              {p.ticketStatus === 'unseated' ? (
                                <>
                                  <div className="flex items-center gap-2 px-2 py-1.5 bg-orange-50 border border-orange-200 rounded-md">
                                    <Armchair className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                    <span className="text-xs text-orange-700 font-medium">Penumpang ini belum memiliki kursi. Assign ke kursi baru.</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 w-full"
                                    onClick={() => {
                                      if (onStartAssignMode) {
                                        onStartAssignMode({
                                          id: p.id,
                                          name: p.fullName,
                                          ticketNumber: p.ticketNumber,
                                          bookingCode: b.bookingCode ?? b.id?.slice(0, 8).toUpperCase(),
                                        });
                                        onClose();
                                      }
                                    }}
                                    data-testid={`btn-assign-${p.id}`}
                                  >
                                    <Armchair className="w-3 h-3" />
                                    Pilih Kursi di Peta Kursi
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {confirmUnseatId === p.id ? (
                                    <div className="space-y-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                      <p className="text-xs text-red-700 font-semibold">Yakin unseat penumpang ini?</p>
                                      <Textarea
                                        placeholder="Alasan unseat (wajib diisi)..."
                                        value={unseatReason}
                                        onChange={e => setUnseatReason(e.target.value)}
                                        className="min-h-[50px] text-xs border-red-200 focus:border-red-400 focus:ring-red-100"
                                        data-testid={`input-unseat-reason-${p.id}`}
                                      />
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-7 text-xs gap-1"
                                          disabled={!unseatReason.trim() || unseatMutation.isPending}
                                          onClick={() => unseatMutation.mutate({ passengerId: p.id, reason: unseatReason.trim() })}
                                          data-testid={`btn-confirm-unseat-${p.id}`}
                                        >
                                          {unseatMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
                                          Ya, Unseat
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setConfirmUnseatId(null); setUnseatReason(''); }} data-testid="btn-cancel-unseat">
                                          Batal
                                        </Button>
                                      </div>
                                    </div>
                                  ) : confirmCancelId === p.id ? (
                                    <div className="space-y-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                      <p className="text-xs text-red-700 font-semibold">Yakin batalkan tiket penumpang ini?</p>
                                      <Textarea
                                        placeholder="Alasan pembatalan (wajib diisi)..."
                                        value={cancelReason}
                                        onChange={e => setCancelReason(e.target.value)}
                                        className="min-h-[50px] text-xs border-red-200 focus:border-red-400 focus:ring-red-100"
                                        data-testid={`input-cancel-reason-${p.id}`}
                                      />
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-7 text-xs gap-1"
                                          disabled={!cancelReason.trim() || cancelTicketMutation.isPending}
                                          onClick={() => cancelTicketMutation.mutate({ passengerId: p.id, reason: cancelReason.trim() })}
                                          data-testid={`btn-confirm-cancel-${p.id}`}
                                        >
                                          {cancelTicketMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                                          Ya, Batalkan
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setConfirmCancelId(null); setCancelReason(''); }} data-testid="btn-cancel-cancel">
                                          Batal
                                        </Button>
                                      </div>
                                    </div>
                                  ) : rescheduleReasonId === p.id ? (
                                    <div className="space-y-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                      <p className="text-xs text-purple-700 font-semibold">Alasan reschedule</p>
                                      <Textarea
                                        placeholder="Alasan reschedule (wajib diisi)..."
                                        value={rescheduleReason}
                                        onChange={e => setRescheduleReason(e.target.value)}
                                        className="min-h-[50px] text-xs border-purple-200 focus:border-purple-400 focus:ring-purple-100"
                                        data-testid={`input-reschedule-reason-${p.id}`}
                                      />
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                                          disabled={!rescheduleReason.trim()}
                                          onClick={() => {
                                            if (onStartRescheduleMode) {
                                              onStartRescheduleMode({
                                                id: p.id,
                                                name: p.fullName,
                                                ticketNumber: p.ticketNumber,
                                                bookingCode: b.bookingCode ?? b.id?.slice(0, 8).toUpperCase(),
                                                seatNo: p.seatNo,
                                                originStopName: b.originStop?.name ?? '—',
                                                destinationStopName: b.destinationStop?.name ?? '—',
                                                reason: rescheduleReason.trim(),
                                              });
                                              setRescheduleReasonId(null);
                                              setRescheduleReason('');
                                              onClose();
                                            }
                                          }}
                                          data-testid={`btn-confirm-reschedule-${p.id}`}
                                        >
                                          <CalendarClock className="w-3 h-3" />
                                          Lanjut Pilih Trip & Kursi
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRescheduleReasonId(null); setRescheduleReason(''); }} data-testid="btn-cancel-reschedule-reason">
                                          Batal
                                        </Button>
                                      </div>
                                    </div>
                                  ) : activeReassignId === p.id ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        placeholder="No. kursi baru"
                                        value={reassignSeatNo}
                                        onChange={e => setReassignSeatNo(e.target.value.toUpperCase())}
                                        className="h-7 w-24 text-xs font-mono"
                                        data-testid={`input-reassign-seat-${p.id}`}
                                      />
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        disabled={!reassignSeatNo || reassignMutation.isPending}
                                        onClick={() => reassignMutation.mutate({ passengerId: p.id, newSeatNo: reassignSeatNo })}
                                        data-testid={`btn-confirm-reassign-${p.id}`}
                                      >
                                        {reassignMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowLeftRight className="w-3 h-3" />}
                                        Pindah
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setActiveReassignId(null); setReassignSeatNo(''); }} data-testid="btn-cancel-reassign">
                                        Batal
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                        onClick={() => setConfirmUnseatId(p.id)}
                                        data-testid={`btn-unseat-${p.id}`}
                                      >
                                        <UserMinus className="w-3 h-3" />
                                        Unseat
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => setActiveReassignId(p.id)}
                                        data-testid={`btn-reassign-${p.id}`}
                                      >
                                        <ArrowLeftRight className="w-3 h-3" />
                                        Pindah Kursi
                                      </Button>
                                      {onStartRescheduleMode && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200"
                                          onClick={() => setRescheduleReasonId(p.id)}
                                          data-testid={`btn-reschedule-${p.id}`}
                                        >
                                          <CalendarClock className="w-3 h-3" />
                                          Reschedule
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                                        onClick={() => setConfirmCancelId(p.id)}
                                        data-testid={`btn-cancel-ticket-${p.id}`}
                                      >
                                        <Ban className="w-3 h-3" />
                                        Batalkan Tiket
                                      </Button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Payment Summary */}
                        {(() => {
                          const discount = parseFloat(String(b.discountAmount || 0));
                          const total = parseFloat(String(b.totalAmount || 0));
                          const subtotal = discount > 0 ? total + discount : total;
                          const hasDiscount = discount > 0;
                          return hasDiscount ? (
                            <div className="rounded-lg border overflow-hidden" data-testid="payment-summary">
                              <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                                <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                                Rincian Pembayaran
                              </div>
                              <div className="px-4 py-3 space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Subtotal</span>
                                  <span className="font-mono">{fmt(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-orange-600">
                                  <span>Diskon {b.voucherCode ? <span className="font-mono text-[10px]">({b.voucherCode})</span> : ''}</span>
                                  <span className="font-mono">-{fmt(discount)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold">
                                  <span>Total Bayar</span>
                                  <span className="text-emerald-700 font-mono">{fmt(total)}</span>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Payments */}
                        {bookingData.payments.length > 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              Pembayaran
                            </div>
                            <div className="divide-y">
                              {bookingData.payments.map((pay, pi) => (
                                <div key={pay.id} className="px-4 py-3 flex items-center justify-between text-sm" data-testid={`payment-${pi}`}>
                                  <div>
                                    <p className="font-medium">{getPaymentLabel(pay.method)}</p>
                                    {pay.paidAt && <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(pay.paidAt)}</p>}
                                  </div>
                                  <p className="font-semibold text-emerald-700">{fmt(pay.amount ?? 0)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {bookingData.payments.length === 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="px-4 py-3 bg-muted/20 flex items-center gap-2 text-sm font-semibold">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              Pembayaran
                            </div>
                            <p className="px-4 py-3 text-muted-foreground text-xs">Belum ada data pembayaran</p>
                          </div>
                        )}

                        {isMulti && index < passengerDetails.bookings.length - 1 && (
                          <Separator />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
