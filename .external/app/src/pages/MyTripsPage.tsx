import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNav, useAuth } from '@/App';
import { bookingsApi, type BookingListItem } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { Ticket, LogIn, Search, Clock, Bus, CalendarDays, Users, ArrowRight, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { BookingCardSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';

function HoldCountdown({ expiresAt }: { expiresAt: string }) {
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
  const pct = Math.min(100, (remaining / 900) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', isUrgent ? 'bg-red-400' : 'bg-amber-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        'text-[11px] font-bold tabular-nums shrink-0',
        isUrgent ? 'text-red-500' : 'text-amber-600'
      )}>
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
    </div>
  );
}

type StatusCfg = { label: string; bg: string; text: string; dot: string };

const STATUS_MAP: Record<string, StatusCfg> = {
  pending: { label: 'Menunggu Bayar', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  held: { label: 'Menunggu Bayar', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  confirmed_paid: { label: 'Dikonfirmasi', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  confirmed_unpaid: { label: 'Menunggu Bayar', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  completed: { label: 'Selesai', bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-red-50/80', text: 'text-red-500', dot: 'bg-red-400' },
  expired: { label: 'Kedaluwarsa', bg: 'bg-red-50/80', text: 'text-red-500', dot: 'bg-red-400' },
  uncertain: { label: 'Diproses', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
};

function isUnpaid(b: BookingListItem): boolean {
  if (b.paymentMethod) return false;
  if (b.status === 'pending') return true;
  if (b.holdExpiresAt) {
    const exp = new Date(b.holdExpiresAt).getTime();
    if (exp > Date.now() && b.status !== 'confirmed') return true;
  }
  if (b.status === 'confirmed' && !b.paymentMethod) return true;
  return false;
}

function isHoldExpired(b: BookingListItem): boolean {
  if (!b.holdExpiresAt) return false;
  return new Date(b.holdExpiresAt).getTime() <= Date.now();
}

function getStatus(b: BookingListItem): StatusCfg {
  if (b.status === 'uncertain') {
    if (isHoldExpired(b)) return STATUS_MAP['expired'];
    return STATUS_MAP['uncertain'];
  }
  if (b.status === 'confirmed' && isUnpaid(b)) return STATUS_MAP['confirmed_unpaid'];
  if (b.status === 'confirmed') return STATUS_MAP['confirmed_paid'];
  if ((b.status === 'pending') && isHoldExpired(b)) return STATUS_MAP['expired'];
  return STATUS_MAP[b.status || ''] || { label: b.status || '?', bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300' };
}

function getContextHint(b: BookingListItem): string | null {
  if (!b.serviceDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trip = new Date(b.serviceDate + 'T00:00:00');
  const tripDay = new Date(trip.getFullYear(), trip.getMonth(), trip.getDate());
  const diff = Math.round((tripDay.getTime() - today.getTime()) / 86400000);
  if (diff === 0) {
    if (b.origin?.departAt) {
      const tp = b.origin.departAt.includes('T') ? b.origin.departAt.split('T')[1] : b.origin.departAt;
      const [hh, mm] = tp.split(':').map(Number);
      const dep = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
      const mins = Math.round((dep.getTime() - now.getTime()) / 60000);
      if (mins <= 0) return 'Sedang berlangsung';
      if (mins <= 60) return `${mins} menit lagi`;
      if (mins <= 180) return `${Math.round(mins / 60)} jam lagi`;
    }
    return 'Hari ini';
  }
  if (diff === 1) return 'Besok';
  if (diff <= 3) return `${diff} hari lagi`;
  return null;
}

function TicketCard({ booking, onClick }: { booking: BookingListItem; onClick: () => void }) {
  const departTime = booking.origin?.departAt ? fmtTime(booking.origin.departAt) : null;
  const arriveTime = booking.destination?.arriveAt ? fmtTime(booking.destination.arriveAt) : null;
  const isInactive = ['cancelled', 'expired', 'completed'].includes(booking.status || '') || (booking.status === 'uncertain' && isHoldExpired(booking)) || ((booking.status === 'pending') && isHoldExpired(booking));
  const isPending = isUnpaid(booking);
  const status = getStatus(booking);
  const hint = !isInactive ? getContextHint(booking) : null;

  let dateLabel = '';
  try {
    if (booking.serviceDate) dateLabel = format(parseISO(booking.serviceDate), 'EEE, d MMM yyyy', { locale: idLocale });
  } catch {}

  const originCity = booking.origin?.city || '';
  const originName = booking.origin?.name || booking.origin?.city || '-';
  const destCity = booking.destination?.city || '';
  const destName = booking.destination?.name || booking.destination?.city || '-';
  const showSubCity = (city: string, name: string) => city && name !== city;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left transition-all active:scale-[0.97] group',
        isInactive && 'opacity-55',
      )}
    >
      <div className={cn(
        'bg-white rounded-2xl overflow-hidden relative',
        isPending ? 'ring-1 ring-amber-200/70 shadow-sm shadow-amber-100/40' : 'shadow-sm',
      )}>
        {isPending && (
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 to-orange-400" />
        )}

        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Bus className={cn('w-4 h-4 shrink-0', isInactive ? 'text-slate-300' : 'text-teal-500')} />
              <span className="text-[11px] font-semibold text-slate-400 truncate">{booking.operatorName || 'Shuttle'}</span>
              {dateLabel && (
                <>
                  <span className="text-slate-200 shrink-0">·</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{dateLabel}</span>
                </>
              )}
            </div>
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ml-2', status.bg, status.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
          </div>

          {(booking.origin || booking.destination) ? (
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1 shrink-0" style={{ width: 10 }}>
                <div className={cn('w-2.5 h-2.5 rounded-full border-2', isInactive ? 'border-slate-300 bg-white' : 'border-teal-500 bg-white')} />
                <div className={cn('w-[2px] flex-1 my-1 min-h-[20px] rounded-full', isInactive ? 'bg-slate-200' : 'bg-gradient-to-b from-teal-300 to-coral-300')} />
                <div className={cn('w-2.5 h-2.5 rounded-full', isInactive ? 'bg-slate-300' : 'bg-coral-500')} />
              </div>

              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[14px] text-slate-800 truncate">{originName}</p>
                    {showSubCity(originCity, originName) && <p className="text-[10px] text-slate-400 mt-0.5">{originCity}</p>}
                  </div>
                  {departTime && (
                    <span className={cn('text-[16px] font-display font-bold tabular-nums ml-2 shrink-0', isInactive ? 'text-slate-400' : 'text-teal-700')}>
                      {departTime}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[14px] text-slate-800 truncate">{destName}</p>
                    {showSubCity(destCity, destName) && <p className="text-[10px] text-slate-400 mt-0.5">{destCity}</p>}
                  </div>
                  {arriveTime && (
                    <span className="text-[16px] font-display font-bold text-slate-400 tabular-nums ml-2 shrink-0">{arriveTime}</span>
                  )}
                </div>
              </div>
            </div>
          ) : booking.passengerName ? (
            <div className="flex items-center gap-2 py-1">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-[14px] text-slate-700">{booking.passengerName}</span>
            </div>
          ) : null}
        </div>

        <div className="relative h-5">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-[#f8fafa] rounded-r-full" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-[#f8fafa] rounded-l-full" />
          <div className="absolute left-4 right-4 top-1/2 border-t border-dashed border-slate-200/80" />
        </div>

        <div className="px-4 pb-3.5">
          {isPending && booking.holdExpiresAt && (
            <div className="mb-2.5">
              <HoldCountdown expiresAt={booking.holdExpiresAt} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {booking.seatNumbers?.length > 0 && (
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v7" />
                    <path d="M3 12h10v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V12z" />
                    <path d="M4 8h8" />
                  </svg>
                  {booking.seatNumbers.join(', ')}
                </span>
              )}
              {booking.passengerCount > 0 && (
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {booking.passengerCount}
                </span>
              )}
              {hint && (
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  hint === 'Hari ini' || hint.includes('menit') || hint.includes('jam') || hint === 'Sedang berlangsung'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-slate-100 text-slate-500'
                )}>{hint}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn(
                'font-display font-extrabold text-[16px]',
                isInactive ? 'text-slate-400' : 'text-slate-800'
              )}>
                {fmtCurrency(booking.totalAmount)}
              </span>
              <ChevronRight className={cn('w-4 h-4 transition-colors', isInactive ? 'text-slate-300' : 'text-slate-400 group-hover:text-teal-600')} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MyTripsPage() {
  const { navigate } = useNav();
  const { user, isLoggedIn } = useAuth();
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const queryClient = useQueryClient();

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings'] });
  }, [queryClient]);

  const { containerRef, pullDistance, isRefreshing, progress, isPastThreshold } = usePullToRefresh({
    onRefresh,
    useWindowScroll: true,
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list(),
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data as typeof bookings;
      return data?.some(b => b.status === 'pending' && b.holdExpiresAt) ? 30000 : false;
    },
  });

  const isBookingPast = (b: BookingListItem) => {
    if (!b.serviceDate) return false;
    const now = new Date();
    const depTime = b.destination?.arriveAt || b.origin?.departAt;
    if (depTime) {
      const timePart = depTime.includes('T') ? depTime.split('T')[1] : depTime;
      const [hh, mm] = timePart.split(':').map(Number);
      const tripEnd = new Date(b.serviceDate + 'T00:00:00');
      tripEnd.setHours(hh, mm, 0, 0);
      if (hh < 6) tripEnd.setDate(tripEnd.getDate() + 1);
      return now > tripEnd;
    }
    const tripDay = new Date(b.serviceDate + 'T23:59:59');
    return now > tripDay;
  };

  const activeBookings = bookings?.filter(b => {
    const isUncertainActive = b.status === 'uncertain' && !isHoldExpired(b);
    const statusActive = b.status === 'confirmed' || b.status === 'pending' || isUncertainActive;
    const holdExpired = (b.status === 'pending') && isHoldExpired(b);
    return statusActive && !holdExpired && !isBookingPast(b);
  }) || [];
  const pastBookings = bookings?.filter(b => {
    const isUncertainActive = b.status === 'uncertain' && !isHoldExpired(b);
    const statusActive = b.status === 'confirmed' || b.status === 'pending' || isUncertainActive;
    const holdExpired = (b.status === 'pending') && isHoldExpired(b);
    return !statusActive || holdExpired || isBookingPast(b);
  }) || [];
  const displayedBookings = tab === 'active' ? activeBookings : pastBookings;

  useEffect(() => {
    if (!isLoading && bookings && activeBookings.length === 0 && pastBookings.length > 0) {
      setTab('history');
    }
  }, [isLoading, bookings]);

  return (
    <div ref={containerRef} className="anim-fade min-h-screen bg-[#f8fafa]">
      <PageHeader
        title="Pesanan Saya"
        subtitle={isLoggedIn
          ? (isLoading ? 'Memuat...' : `${activeBookings.length > 0 ? `${activeBookings.length} tiket aktif` : 'Riwayat perjalananmu'}`)
          : 'Masuk untuk melihat pesanan'
        }
      >
        {isLoggedIn && bookings && bookings.length > 0 && (
          <div className="mt-3 flex bg-white/10 rounded-xl p-1">
            <button
              onClick={() => setTab('active')}
              className={cn(
                'flex-1 py-2 rounded-lg text-[12px] font-bold transition-all',
                tab === 'active'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-white/70 hover:text-white'
              )}
            >
              Aktif
              {activeBookings.length > 0 && (
                <span className={cn(
                  'ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                  tab === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-white/20 text-white'
                )}>
                  {activeBookings.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('history')}
              className={cn(
                'flex-1 py-2 rounded-lg text-[12px] font-bold transition-all',
                tab === 'history'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-white/70 hover:text-white'
              )}
            >
              Riwayat
              {pastBookings.length > 0 && (
                <span className={cn(
                  'ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                  tab === 'history' ? 'bg-slate-200 text-slate-600' : 'bg-white/20 text-white'
                )}>
                  {pastBookings.length}
                </span>
              )}
            </button>
          </div>
        )}
      </PageHeader>

      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        isPastThreshold={isPastThreshold}
      />

      <div className="px-4 pt-4 safe-pb-24">
        {!isLoggedIn && (
          <div className="text-center py-16 anim-fade">
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center">
              <LogIn className="w-9 h-9 text-teal-500" />
            </div>
            <p className="font-display font-bold text-[18px] text-slate-800 mb-2">Masuk untuk Melihat Pesanan</p>
            <p className="text-[13px] text-slate-400 mb-8 max-w-[260px] mx-auto leading-relaxed">Login untuk melihat riwayat perjalanan dan tiket aktif kamu</p>
            <Button
              className="h-12 px-10 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[14px] font-bold shadow-lg shadow-emerald-600/15"
              onClick={() => navigate({ name: 'auth', returnTo: { name: 'my-trips' } })}
            >
              Masuk / Daftar
            </Button>
          </div>
        )}

        {isLoggedIn && isLoading && (
          <div className="space-y-3 anim-fade">
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingCardSkeleton key={i} />
            ))}
          </div>
        )}

        {isLoggedIn && !isLoading && (!bookings || bookings.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 anim-fade">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center">
                <Ticket className="w-11 h-11 text-teal-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center border-4 border-[#f8fafa] shadow-sm">
                <Search className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <h3 className="font-display font-bold text-[18px] text-slate-800 mb-2">Belum Ada Perjalanan</h3>
            <p className="text-[13px] text-slate-400 text-center max-w-[240px] leading-relaxed mb-8">
              Yuk, mulai pesan tiket shuttle bus favoritmu sekarang!
            </p>
            <Button
              className="h-12 px-10 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[14px] font-bold shadow-lg shadow-emerald-600/15 gap-2"
              onClick={() => navigate({ name: 'home' })}
            >
              <Search className="w-4 h-4" />
              Cari Perjalanan
            </Button>
          </div>
        )}

        {isLoggedIn && !isLoading && bookings && bookings.length > 0 && (
          <>
            {displayedBookings.length > 0 ? (
              <div className="space-y-3">
                {displayedBookings.map((b) => (
                  <TicketCard
                    key={b.id}
                    booking={b}
                    onClick={() => navigate({ name: 'booking-detail', bookingId: b.id, source: 'my-trips' as any })}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 anim-fade">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  {tab === 'active' ? <Ticket className="w-7 h-7 text-slate-300" /> : <CalendarDays className="w-7 h-7 text-slate-300" />}
                </div>
                <p className="text-[14px] font-semibold text-slate-500 mb-1">
                  {tab === 'active' ? 'Tidak ada tiket aktif' : 'Belum ada riwayat'}
                </p>
                <p className="text-[12px] text-slate-400">
                  {tab === 'active' ? 'Pesanan aktif akan muncul di sini' : 'Perjalanan sebelumnya akan muncul di sini'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
