import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNav } from '@/App';
import { bookingsApi, type BookingDetail } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, QrCode, Users, XCircle, CheckCircle2, CreditCard, Clock, Calendar, Bus, Copy, Check, CalendarCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { BookingDetailSkeleton } from '@/components/ui/skeleton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';

function HoldTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      const val = Math.max(0, Math.floor(diff / 1000));
      setRemaining(val);
      if (val <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (remaining <= 0) return null;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const isUrgent = remaining <= 120;
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-2xl mb-3',
      isUrgent ? 'bg-amber-50 border border-amber-200/60' : 'bg-teal-50 border border-teal-200/60',
    )}>
      <Clock className={cn('w-5 h-5 shrink-0', isUrgent ? 'text-amber-500' : 'text-teal-600')} />
      <div className="flex-1">
        <p className={cn('text-[11px] font-medium', isUrgent ? 'text-amber-600' : 'text-teal-600')}>Selesaikan pembayaran dalam</p>
        <p className={cn('text-[20px] font-display font-extrabold tabular-nums', isUrgent ? 'text-amber-700' : 'text-teal-800')}>
          {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}

function CopyableId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-slate-400 shrink-0">{label}</span>
      <span className="text-[12px] font-mono text-slate-600 truncate">{value}</span>
      <button onClick={handleCopy} className="p-1 hover:bg-slate-100 rounded shrink-0">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
      </button>
    </div>
  );
}

interface Props {
  bookingId: string;
  source?: 'gateway' | 'terminal';
}

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Menunggu Pembayaran', variant: 'warning', icon: QrCode },
  confirmed: { label: 'Terkonfirmasi', variant: 'success', icon: CheckCircle2 },
  confirmed_unpaid: { label: 'Menunggu Pembayaran', variant: 'warning', icon: QrCode },
  completed: { label: 'Selesai', variant: 'secondary', icon: CheckCircle2 },
  cancelled: { label: 'Dibatalkan', variant: 'destructive', icon: XCircle },
  expired: { label: 'Kedaluwarsa', variant: 'destructive', icon: XCircle },
  uncertain: { label: 'Sedang Diproses', variant: 'default', icon: QrCode },
};

function fmtDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function fmtDateTimeFull(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function getDuration(depart: string | null | undefined, arrive: string | null | undefined): string | null {
  if (!depart || !arrive) return null;
  try {
    const d1 = new Date(depart);
    const d2 = new Date(arrive);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    const diffMs = d2.getTime() - d1.getTime();
    if (diffMs <= 0) return null;
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 0 && mins > 0) return `${hours}j ${mins}m`;
    if (hours > 0) return `${hours}j`;
    return `${mins}m`;
  } catch {
    return null;
  }
}

function ScheduleCard({ booking, routeTitle, duration }: { booking: BookingDetail; routeTitle: string; duration: string | null }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const fullCode = booking.bookingCode || booking.externalBookingId || '';
  const shortCode = fullCode.length > 5 ? fullCode.slice(-5).toUpperCase() : fullCode.toUpperCase();

  const copyCode = () => {
    if (!fullCode) return;
    navigator.clipboard?.writeText(fullCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const originCity = booking.origin?.city || '';
  const destCity = booking.destination?.city || '';

  return (
    <div className="rounded-2xl overflow-hidden anim-slide-up" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)' }}>
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 px-4 pt-4 pb-5 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/[0.06]" />
        <div className="absolute bottom-2 -left-6 w-20 h-20 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            {booking.operatorName && (
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1">{booking.operatorName}</p>
            )}
            {booking.serviceDate && (
              <p className="text-[12px] font-semibold text-white/80">{fmtDateLong(booking.serviceDate)}</p>
            )}
          </div>
          {shortCode && (
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-lg px-2.5 py-1.5 active:bg-white/20 transition-colors shrink-0 ml-3"
            >
              <span className="font-mono font-extrabold text-[13px] text-white tracking-wider">{shortCode}</span>
              {codeCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/50" />
              )}
            </button>
          )}
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-white/40 mb-0.5">Berangkat</p>
            <p className="font-display font-black text-[26px] text-white leading-none tabular-nums">{fmtTime(booking.departAt)}</p>
            <p className="text-[13px] font-semibold text-white/90 mt-1 truncate">{originCity}</p>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-1 px-2">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <div className="w-6 h-px bg-white/20" />
              <Bus className="w-3.5 h-3.5 text-white/40" />
              <div className="w-6 h-px bg-white/20" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
            </div>
            {duration && (
              <span className="text-[9px] font-semibold text-white/40">{duration}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] font-medium text-white/40 mb-0.5">Tiba</p>
            <p className="font-display font-black text-[26px] text-white/80 leading-none tabular-nums">{fmtTime(booking.arriveAt)}</p>
            <p className="text-[13px] font-semibold text-white/90 mt-1 truncate">{destCity}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -top-[10px] -left-[10px] w-5 h-5 rounded-full bg-[#f8fafa]" />
        <div className="absolute -top-[10px] -right-[10px] w-5 h-5 rounded-full bg-[#f8fafa]" />
        <div className="absolute top-0 left-5 right-5 border-t border-dashed border-slate-200" style={{ top: '-0.5px' }} />
      </div>

      <div className="bg-white px-4 pt-4 pb-3.5">
        <div className="flex">
          <div style={{ width: 14 }} className="flex flex-col items-center shrink-0 self-stretch mr-3">
            <div className="w-2.5 h-2.5 rounded-full border-[2px] border-teal-500 bg-white mt-0.5" />
            <div className="w-[1.5px] flex-1 bg-gradient-to-b from-teal-300/60 to-emerald-300/60 my-1" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mb-0.5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Naik</span>
                {booking.departAt && (
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums">{fmtTime(booking.departAt)}</span>
                )}
              </div>
              <p className="text-[14px] font-bold text-slate-800 mt-0.5 leading-snug">{booking.origin?.name || '—'}</p>
              {booking.origin?.city && (
                <p className="text-[11px] text-slate-400 mt-0.5">{booking.origin.city}</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Turun</span>
                {booking.arriveAt && (
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums">{fmtTime(booking.arriveAt)}</span>
                )}
              </div>
              <p className="text-[14px] font-bold text-slate-800 mt-0.5 leading-snug">{booking.destination?.name || '—'}</p>
              {booking.destination?.city && (
                <p className="text-[11px] text-slate-400 mt-0.5">{booking.destination.city}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailPage({ bookingId, source }: Props) {
  const { navigate, goBack, resetTo } = useNav();
  const queryClient = useQueryClient();

  const handleBack = () => {
    if (source === 'gateway') {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      resetTo({ name: 'my-trips' });
    } else {
      goBack();
    }
  };

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['booking', bookingId, source] });
  }, [queryClient, bookingId, source]);

  const { containerRef, pullDistance, isRefreshing, progress, isPastThreshold } = usePullToRefresh({
    onRefresh,
    useWindowScroll: true,
  });

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId, source],
    queryFn: () => bookingsApi.getGatewayDetail(bookingId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  if (isLoading) {
    return <BookingDetailSkeleton />;
  }

  if (error || !booking) {
    return (
      <div>
        <PageHeader title="Detail Pesanan" onBack={handleBack} />
        <p className="text-center text-slate-400 py-10">Pesanan tidak ditemukan</p>
      </div>
    );
  }

  const hasActiveHold = booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() > Date.now() : false;
  const holdExpired = booking.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() <= Date.now() : false;
  const hasPaid = !!booking.paymentMethod ||
    (booking.payments?.length > 0 && booking.payments.some(p => p.paidAt || p.status === 'paid')) ||
    (booking.paymentIntent?.status === 'paid' || booking.paymentIntent?.status === 'completed') ||
    (booking.status === 'confirmed' && booking.qrData?.length > 0);
  const isUnpaid = !hasPaid && (hasActiveHold || (booking.status === 'confirmed' && !booking.paymentMethod));
  const statusKey =
    (booking.status === 'uncertain' && holdExpired) ? 'expired' :
    ((booking.status === 'pending') && holdExpired) ? 'expired' :
    (booking.status === 'confirmed' && !isUnpaid) ? 'confirmed' :
    (booking.status === 'confirmed') ? 'confirmed_unpaid' :
    (booking.status || '');
  const st = STATUS_CFG[statusKey] || { label: booking.status, variant: 'secondary' as const, icon: QrCode };

  const originCity = booking.origin?.city || null;
  const destCity = booking.destination?.city || null;
  const routeTitle = originCity && destCity ? `${originCity} → ${destCity}` : (booking.operatorName || 'Detail Perjalanan');
  const duration = getDuration(booking.departAt, booking.arriveAt);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f8fafa] anim-fade">
      <PageHeader
        title="Detail Pesanan"
        onBack={handleBack}
        rightContent={<Badge variant={st.variant} className="rounded-lg px-2.5 py-1 text-[11px] font-bold">{st.label}</Badge>}
      />

      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        isPastThreshold={isPastThreshold}
      />

      <div className="px-4 pt-4 safe-pb-24">
        {(booking.status === 'pending' || statusKey === 'confirmed_unpaid') && statusKey !== 'expired' && !hasPaid && booking.holdExpiresAt && !holdExpired && (
          <HoldTimer expiresAt={booking.holdExpiresAt} />
        )}

        <ScheduleCard booking={booking} routeTitle={routeTitle} duration={duration} />

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden mt-3 anim-slide-up delay-1">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Penumpang</p>
              <span className="text-[11px] text-slate-400 ml-auto">{booking.passengers?.length || 0} orang</span>
            </div>
            <div className="space-y-2">
              {booking.passengers?.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-50/80 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-teal-700">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-700 truncate">{p.fullName}</p>
                      {p.phone && <p className="text-[11px] text-slate-400">{p.phone}</p>}
                    </div>
                  </div>
                  <span className="text-[12px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md shrink-0 ml-2">Kursi {p.seatNo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden mt-3 anim-slide-up delay-2">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pembayaran</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-slate-500">Tiket × {booking.passengers?.length || 1}</span>
                <span className="text-[13px] font-semibold text-slate-700">{fmtCurrency(booking.totalAmount)}</span>
              </div>
              {booking.paymentMethod && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-500">Metode</span>
                  <span className="text-[13px] font-semibold text-slate-700 capitalize">{booking.paymentMethod.replace(/_/g, ' ')}</span>
                </div>
              )}
              <div className="border-t border-dashed border-slate-200 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-slate-800">Total</span>
                  <span className="font-display font-extrabold text-[20px] text-teal-800">{fmtCurrency(booking.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden mt-3 anim-slide-up delay-2">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Info Pemesanan</p>
            </div>
            <div className="space-y-2">
              {booking.createdAt && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-500">Tanggal Pesan</span>
                  <span className="text-[13px] font-semibold text-slate-700">{fmtDateTimeFull(booking.createdAt)}</span>
                </div>
              )}
              {booking.payments?.length > 0 && booking.payments[0].paidAt && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-500">Tanggal Bayar</span>
                  <span className="text-[13px] font-semibold text-slate-700">{fmtDateTimeFull(booking.payments[0].paidAt)}</span>
                </div>
              )}
              {booking.serviceDate && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-slate-500">Keberangkatan</span>
                  <span className="text-[13px] font-semibold text-slate-700">
                    {fmtDateLong(booking.serviceDate)}{booking.departAt ? `, ${fmtTime(booking.departAt)}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {booking.qrData && booking.qrData.length > 0 && (
          <div className="mt-3 anim-slide-up delay-3">
            <div className="flex items-center gap-2 mb-3 px-0.5">
              <QrCode className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tiket Digital</p>
            </div>
            <div className="space-y-3">
              {booking.qrData.map((qr) => (
                <div key={qr.passengerId} className="bg-white rounded-2xl shadow-soft overflow-hidden">
                  <div className="p-5 flex flex-col items-center">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100">
                      <QRCodeSVG value={qr.qrPayload} size={140} level="M" />
                    </div>
                    <p className="font-bold text-[14px] mt-3">{qr.fullName}</p>
                    <p className="text-[12px] text-slate-400 font-medium">Kursi {qr.seatNo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(booking.status === 'pending' || statusKey === 'confirmed_unpaid') && !hasPaid && booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() > Date.now() && (
          <div className="mt-4 anim-slide-up delay-2">
            <Button
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[15px] font-bold shadow-lg shadow-emerald-600/15 transition-all active:scale-[0.97] gap-2"
              onClick={() => navigate({
                name: 'payment',
                tripId: booking.tripId,
                serviceDate: booking.serviceDate || '',
                originStopId: booking.origin?.stopId || '',
                destStopId: booking.destination?.stopId || '',
                originSeq: 0,
                destSeq: 0,
                bookingId: booking.id || booking.bookingId || bookingId,
                holdExpiresAt: booking.holdExpiresAt,
                tripLabel: [booking.origin?.city, booking.destination?.city].filter(Boolean).join(' → ') || booking.operatorName || 'Perjalanan',
                fare: booking.passengers?.length > 0 ? Math.round(Number(booking.totalAmount || 0) / booking.passengers.length) : Number(booking.totalAmount || 0),
                seats: booking.passengers?.map(p => p.seatNo) || [],
                originStopName: booking.origin?.name || undefined,
                destStopName: booking.destination?.name || undefined,
                originTime: booking.departAt || undefined,
                destTime: booking.arriveAt || undefined,
                passengers: booking.passengers?.map(p => ({ fullName: p.fullName, phone: undefined, seatNo: p.seatNo })) || [],
              })}
            >
              <CreditCard className="w-5 h-5" />
              Bayar Sekarang
            </Button>
          </div>
        )}

        {booking.status === 'uncertain' && !holdExpired && (
          <div className="mt-4 anim-slide-up delay-2">
            <div className="flex items-start gap-3 px-4 py-3.5 bg-blue-50 border border-blue-200/60 rounded-2xl">
              <Loader2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 animate-spin" />
              <div>
                <p className="text-[13px] font-bold text-blue-700">Pesanan sedang diproses</p>
                <p className="text-[12px] text-blue-500 mt-0.5 leading-relaxed">
                  Sistem sedang mengkonfirmasi pesananmu dengan operator. Ini biasanya selesai dalam beberapa menit. Coba refresh halaman ini.
                </p>
              </div>
            </div>
          </div>
        )}

        {statusKey === 'confirmed' && (
          <div className="mt-4 anim-slide-up delay-2">
            <div className="flex items-start gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-200/60 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-emerald-700">Pembayaran Berhasil</p>
                <p className="text-[12px] text-emerald-500 mt-0.5 leading-relaxed">
                  Tiketmu sudah aktif. Tunjukkan QR Code saat boarding.
                </p>
              </div>
            </div>
          </div>
        )}

        {(booking.status === 'pending' || statusKey === 'confirmed_unpaid') && statusKey !== 'expired' && (
          <div className="mt-3 anim-slide-up delay-3">
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 font-bold text-[13px]"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              data-testid="button-cancel"
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Batalkan Pesanan
            </Button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center">
          <CopyableId label="ID Pesanan:" value={booking.bookingId || booking.id || bookingId} />
        </div>
      </div>
    </div>
  );
}
