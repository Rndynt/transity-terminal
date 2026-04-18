import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNav, useAuth, useSheet } from '@/App';
import { tripsApi, bookingsApi, type BookingListItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowDownUp, Search, CalendarDays, Users, X, ArrowRight, Clock, Bus, MapPin, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import PromoSection from '@/components/PromoSection';
import RouteDealsSection from '@/components/RouteDealsSection';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';

const CITY_IMAGES: Record<string, string> = {
  'Jakarta': 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=400&h=400&fit=crop&q=80',
  'Bandung': 'https://images.unsplash.com/photo-1598880940080-ff9a29891b85?w=400&h=400&fit=crop&q=80',
  'Semarang': 'https://images.unsplash.com/photo-1565967511849-76a60a516170?w=400&h=400&fit=crop&q=80',
  'Yogyakarta': 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=400&h=400&fit=crop&q=80',
  'Surabaya': 'https://images.unsplash.com/photo-1586818398936-0999fbd1d3b7?w=400&h=400&fit=crop&q=80',
  'Cirebon': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=400&fit=crop&q=80',
  'Denpasar': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=400&fit=crop&q=80',
  'Malang': 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?w=400&h=400&fit=crop&q=80',
  'Gianyar': 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=400&h=400&fit=crop&q=80',
  'Probolinggo': 'https://images.unsplash.com/photo-1589451872985-2ceed665b75c?w=400&h=400&fit=crop&q=80',
};
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=400&fit=crop&q=80';

const CITY_TAGLINES: Record<string, string> = {
  'Jakarta': 'Ibukota Indonesia',
  'Bandung': 'Kota Kembang',
  'Semarang': 'Kota Lumpia',
  'Yogyakarta': 'Kota Gudeg',
  'Surabaya': 'Kota Pahlawan',
  'Cirebon': 'Kota Udang',
  'Denpasar': 'Pulau Dewata',
  'Malang': 'Kota Apel',
  'Gianyar': 'Seni & Budaya Bali',
  'Probolinggo': 'Gerbang Bromo',
};

function popularRoutes(cities: string[]) {
  const routes = [
    { from: cities[0], to: cities[1], price: 'Rp 95.000', duration: '~3 jam' },
    { from: cities[1], to: cities[0], price: 'Rp 95.000', duration: '~3 jam' },
    ...(cities[2] ? [{ from: cities[0], to: cities[2], price: 'Rp 120.000', duration: '~5 jam' }] : []),
    ...(cities[3] ? [{ from: cities[1], to: cities[3], price: 'Rp 110.000', duration: '~7 jam' }] : []),
  ];
  return routes.slice(0, 4).map(r => ({
    ...r,
    img: CITY_IMAGES[r.to] || FALLBACK_IMG,
  }));
}

export default function HomePage() {
  const { navigate } = useNav();
  const { user } = useAuth();
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOriginRaw] = useState(() => sessionStorage.getItem('t_origin') || '');
  const [destination, setDestinationRaw] = useState(() => sessionStorage.getItem('t_dest') || '');
  const [date, setDateRaw] = useState(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const stored = sessionStorage.getItem('t_date');
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) && stored >= today) return stored;
    return today;
  });
  const [passengers, setPassengersRaw] = useState(() => {
    const n = parseInt(sessionStorage.getItem('t_pax') || '1', 10);
    return (isNaN(n) || n < 1 || n > 10) ? 1 : n;
  });
  const [sheetFor, setSheetFor] = useState<'origin' | 'destination' | null>(null);
  const queryClient = useQueryClient();

  const onRefresh = useCallback(async () => {
    const p1 = tripsApi.getCitiesAndOperators().then(({ cities }) => setCities(cities)).catch(() => {});
    const p2 = queryClient.invalidateQueries({ queryKey: ['bookings'] });
    await Promise.all([p1, p2]);
  }, [queryClient]);

  const { containerRef: pullRef, pullDistance, isRefreshing, progress, isPastThreshold } = usePullToRefresh({
    onRefresh,
    useWindowScroll: true,
  });

  const setOrigin = (v: string) => { setOriginRaw(v); sessionStorage.setItem('t_origin', v); };
  const setDestination = (v: string) => { setDestinationRaw(v); sessionStorage.setItem('t_dest', v); };
  const setDate = (v: string) => { setDateRaw(v); sessionStorage.setItem('t_date', v); };
  const setPassengers = (v: number) => { setPassengersRaw(v); sessionStorage.setItem('t_pax', String(v)); };

  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (date < today) {
      setDate(today);
    }
    tripsApi.getCitiesAndOperators()
      .then(({ cities }) => { setCities(cities); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { data: upcomingTrips = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list(),
    enabled: !!user,
    staleTime: 60_000,
    select: (bookings) => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return bookings
        .filter((b) => {
          if (!b.serviceDate) return false;
          if (!b.status || !['confirmed', 'pending', 'uncertain'].includes(b.status)) return false;
          const holdExpired = b.holdExpiresAt ? new Date(b.holdExpiresAt).getTime() <= Date.now() : false;
          if ((b.status === 'pending' || b.status === 'uncertain') && holdExpired) return false;
          if (b.serviceDate < todayStr) return false;
          if (b.serviceDate === todayStr) {
            const dep = b.destination?.arriveAt || b.origin?.departAt;
            if (dep) {
              const tp = dep.includes('T') ? dep.split('T')[1] : dep;
              const [hh, mm] = tp.split(':').map(Number);
              const depDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
              if (now > depDate) return false;
            }
          }
          return true;
        })
        .sort((a, b) => {
          const dateCmp = (a.serviceDate || '').localeCompare(b.serviceDate || '');
          if (dateCmp !== 0) return dateCmp;
          const aTime = a.origin?.departAt || '';
          const bTime = b.origin?.departAt || '';
          return aTime.localeCompare(bTime);
        })
        .slice(0, 3);
    },
  });

  const swap = () => { setOrigin(destination); setDestination(origin); };
  const search = () => {
    if (!origin || !destination || !date) return;
    navigate({ name: 'search-results', originCity: origin, destinationCity: destination, date, passengers, operatorFilter: null });
  };

  const selectCity = (city: string) => {
    if (sheetFor === 'origin') setOrigin(city);
    else if (sheetFor === 'destination') setDestination(city);
    saveRecentCity(city);
    setSheetFor(null);
  };

  return (
    <div ref={pullRef} className="anim-fade safe-pb-24 bg-[#f8fafa] overflow-x-hidden">
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        isPastThreshold={isPastThreshold}
      />
      <div className="hero-mesh relative overflow-hidden rounded-b-[2rem]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.07]" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-white/[0.05]" />
        </div>
        <div className="px-5 pb-28 relative z-10 safe-top-lg">
          <div className="mb-2">
            <span className="font-display font-extrabold text-2xl text-white tracking-tight">Transity</span>
          </div>
          <p className="text-teal-200/90 text-[15px] leading-snug max-w-[260px]">
            {user
              ? <>Hai <span className="font-semibold text-white">{user.fullName.split(' ')[0]}</span>, mau ke mana hari ini?</>
              : 'Temukan & pesan tiket bus favoritmu dalam hitungan detik.'
            }
          </p>
        </div>
      </div>

      <div className="px-4 -mt-20 relative z-20">
        <div className="bg-white rounded-[1.25rem] shadow-float overflow-visible anim-slide-up">
          <div className="p-4 pb-5">
            <div className="relative">
              <div className="relative bg-gradient-to-b from-teal-50/80 to-slate-50/50 rounded-2xl border border-teal-100/60 overflow-hidden">
                <button
                  onClick={() => setSheetFor('origin')}
                  className="relative w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-teal-50/60 transition-colors"
                  data-testid="input-origin"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border border-teal-200/60 flex items-center justify-center shadow-sm shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full border-[2.5px] border-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-teal-600/60 uppercase tracking-[0.1em] block">Dari</span>
                    {origin ? (
                      <span className="text-[15px] font-bold text-slate-800 block mt-0.5 truncate">{origin}</span>
                    ) : (
                      <span className="text-[15px] text-slate-300 block mt-0.5">Kota keberangkatan</span>
                    )}
                  </div>
                </button>

                <div className="relative h-0 mx-4">
                  <div className="absolute inset-x-0 border-t border-dashed border-teal-200/50" />
                  <div className="absolute left-[14px] -top-[3px] w-[7px] h-[7px] rounded-full bg-teal-100 border border-teal-200/60" />
                  <div className="absolute left-[11px] top-[3px] border-l-[1.5px] border-dashed border-teal-200/60 h-0" />
                </div>

                <button
                  onClick={() => setSheetFor('destination')}
                  className="relative w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-teal-50/60 transition-colors"
                  data-testid="input-destination"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border border-coral-100 flex items-center justify-center shadow-sm shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-coral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-coral-500/60 uppercase tracking-[0.1em] block">Ke</span>
                    {destination ? (
                      <span className="text-[15px] font-bold text-slate-800 block mt-0.5 truncate">{destination}</span>
                    ) : (
                      <span className="text-[15px] text-slate-300 block mt-0.5">Kota tujuan</span>
                    )}
                  </div>
                </button>

                <button
                  onClick={swap}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-xl bg-white border border-teal-200/60 shadow-md flex items-center justify-center hover:bg-teal-50 active:scale-90 transition-all"
                  data-testid="button-swap"
                >
                  <ArrowDownUp className="w-[18px] h-[18px] text-teal-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div className="relative bg-gradient-to-b from-teal-50/60 to-slate-50/30 rounded-2xl border border-teal-100/60 p-3 pb-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-teal-200/60 flex items-center justify-center shadow-sm">
                    <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <span className="text-[9px] font-bold text-teal-600/60 uppercase tracking-[0.1em]">Tanggal</span>
                </div>
                <label className="relative block h-10 cursor-pointer">
                  <span className="text-[14px] font-bold text-slate-800 leading-[40px]">{formatDateDisplay(date)}</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })()}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    data-testid="input-date"
                  />
                </label>
              </div>

              <div className="relative bg-gradient-to-b from-teal-50/60 to-slate-50/30 rounded-2xl border border-teal-100/60 p-3 pb-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-teal-200/60 flex items-center justify-center shadow-sm">
                    <Users className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <span className="text-[9px] font-bold text-teal-600/60 uppercase tracking-[0.1em]">Penumpang</span>
                </div>
                <div className="flex items-center h-10">
                  <button
                    onClick={() => setPassengers(Math.max(1, passengers - 1))}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-400 hover:text-teal-700 hover:border-teal-200 active:scale-90 transition-all shadow-sm"
                    data-testid="button-passenger-minus"
                  >
                    <span className="text-lg font-bold leading-none">−</span>
                  </button>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="font-bold text-[20px] text-slate-800 tabular-nums" data-testid="text-passenger-count">{passengers}</span>
                  </div>
                  <button
                    onClick={() => setPassengers(Math.min(10, passengers + 1))}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-400 hover:text-teal-700 hover:border-teal-200 active:scale-90 transition-all shadow-sm"
                    data-testid="button-passenger-plus"
                  >
                    <span className="text-lg font-bold leading-none">+</span>
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={search}
              size="lg"
              className="w-full mt-4 h-[52px] text-[15px] font-bold rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
              disabled={!origin || !destination || !date}
              data-testid="button-search"
            >
              <Search className="w-5 h-5 mr-1.5" />
              Cari Tiket
            </Button>
          </div>
        </div>

        <PromoSection />

        <RouteDealsSection />

        {upcomingTrips.length > 0 && (
          <div className="mt-5 anim-slide-up delay-2">
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-teal-500 to-emerald-500" />
                <h3 className="text-[14px] font-bold text-slate-800">Perjalanan Mendatang</h3>
              </div>
              <button
                onClick={() => navigate({ name: 'my-trips' })}
                className="text-[11px] font-bold text-teal-600 flex items-center gap-0.5 active:opacity-70"
              >
                Lihat semua
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {upcomingTrips.length === 1 ? (
              <UpcomingTripCard
                trip={upcomingTrips[0]}
                onTap={() => navigate({ name: 'booking-detail', bookingId: upcomingTrips[0].id, source: 'my-trips' })}
                fullWidth
              />
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                {upcomingTrips.map((trip) => (
                  <UpcomingTripCard
                    key={trip.id}
                    trip={trip}
                    onTap={() => navigate({ name: 'booking-detail', bookingId: trip.id, source: 'my-trips' })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {cities.length > 1 && (
          <div className="mt-6 anim-slide-up delay-2">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <h3 className="text-[14px] font-bold text-slate-800">Rute Populer</h3>
              <span className="text-[11px] font-semibold text-teal-600">Lihat semua</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 snap-x">
              {popularRoutes(cities).map((route) => (
                <button
                  key={`${route.from}-${route.to}`}
                  onClick={() => { setOrigin(route.from); setDestination(route.to); }}
                  className="snap-start shrink-0 w-[70%] rounded-2xl overflow-hidden relative group active:scale-[0.97] transition-transform shadow-lg"
                  data-testid={`route-${route.from}-${route.to}`}
                >
                  <img
                    src={route.img}
                    alt={route.to}
                    className="w-full h-[160px] object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-white/70 text-[12px] font-medium">{route.from}</span>
                      <ArrowRight className="w-3 h-3 text-coral-400" />
                      <span className="text-white font-bold text-[13px]">{route.to}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-teal-300 text-[12px] font-bold">mulai {route.price}</span>
                      <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{route.duration}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <CityBottomSheet
        open={sheetFor !== null}
        title={sheetFor === 'origin' ? 'Kota Keberangkatan' : 'Kota Tujuan'}
        cities={cities}
        onSelect={selectCity}
        onClose={() => setSheetFor(null)}
      />

    </div>
  );
}


function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTripDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tripDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Besok';

  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const parts = timeStr.split('T');
  const time = parts.length > 1 ? parts[1] : timeStr;
  return time.substring(0, 5);
}

function getContextLabel(dateStr: string | null, departAt: string | null | undefined): { text: string; urgency: 'now' | 'soon' | 'upcoming' | 'later' } {
  if (!dateStr) return { text: '', urgency: 'later' };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tripDate = new Date(dateStr + 'T00:00:00');
  const tripDay = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate());
  const diffDays = Math.round((tripDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && departAt) {
    const timePart = departAt.includes('T') ? departAt.split('T')[1] : departAt;
    const [hh, mm] = timePart.split(':').map(Number);
    const departDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    const diffMin = Math.round((departDate.getTime() - now.getTime()) / 60000);
    if (diffMin <= 0) return { text: 'Sedang berlangsung', urgency: 'now' };
    if (diffMin <= 60) return { text: `Berangkat ${diffMin} menit lagi`, urgency: 'now' };
    if (diffMin <= 180) return { text: `Berangkat ${Math.round(diffMin / 60)} jam lagi`, urgency: 'soon' };
    return { text: 'Hari ini', urgency: 'soon' };
  }
  if (diffDays === 0) return { text: 'Hari ini', urgency: 'soon' };
  if (diffDays === 1) return { text: 'Besok', urgency: 'upcoming' };
  if (diffDays <= 3) return { text: `${diffDays} hari lagi`, urgency: 'upcoming' };
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return { text: `${days[tripDay.getDay()]}, ${tripDay.getDate()} ${months[tripDay.getMonth()]}`, urgency: 'later' };
}

function UpcomingTripCard({ trip, onTap, fullWidth }: { trip: BookingListItem; onTap: () => void; fullWidth?: boolean }) {
  const departTime = formatTime(trip.origin?.departAt);
  const arriveTime = formatTime(trip.destination?.arriveAt);
  const hasActiveHold = trip.holdExpiresAt ? new Date(trip.holdExpiresAt).getTime() > Date.now() : false;
  const holdExpired = trip.holdExpiresAt ? new Date(trip.holdExpiresAt).getTime() <= Date.now() : false;
  const isHeld = !holdExpired && (trip.status === 'pending' || (trip.status === 'confirmed' && (hasActiveHold || !trip.paymentMethod)));
  const ctx = getContextLabel(trip.serviceDate, trip.origin?.departAt);
  const originCity = trip.origin?.city || trip.origin?.name || '—';
  const destCity = trip.destination?.city || trip.destination?.name || '—';
  const dateLabel = trip.serviceDate ? formatTripDate(trip.serviceDate) : '';
  const paxName = trip.passengerName || null;
  const notchBg = '#f8fafa';

  return (
    <button
      onClick={onTap}
      className={cn('shrink-0 active:scale-[0.97] transition-transform text-left', fullWidth && 'w-full')}
      style={fullWidth ? undefined : { width: 'calc(78vw - 16px)' }}
    >
      <div className="relative">
        <div
          className="rounded-2xl h-full"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)' }}
        >
          <div className={cn(
            'rounded-t-2xl px-4 pt-3.5 pb-4',
            isHeld
              ? 'bg-gradient-to-br from-amber-500 via-amber-500 to-orange-500'
              : ctx.urgency === 'now'
              ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-700'
              : 'bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600'
          )}>
            <div className="absolute top-3 right-3 w-20 h-20 rounded-full bg-white/[0.06]" />
            <div className="absolute top-12 right-12 w-8 h-8 rounded-full bg-white/[0.04]" />

            <div className="relative flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">
                {isHeld ? 'Belum Bayar' : ctx.text}
              </span>
              {trip.operatorName && (
                <span className="text-[9px] font-medium text-white/40">{trip.operatorName}</span>
              )}
            </div>

            <div className="relative flex items-end justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-white/50 font-medium mb-0.5">Dari</p>
                <p className="text-[15px] font-bold text-white leading-tight truncate">{originCity}</p>
                {departTime && (
                  <p className="text-[20px] font-display font-extrabold text-white leading-none mt-1 tabular-nums">{departTime}</p>
                )}
              </div>

              <div className="shrink-0 mx-3 flex flex-col items-center gap-1 pb-1">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/30">
                  <path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="7" cy="18" r="2" stroke="currentColor" fill="none" strokeWidth="1.5"/>
                  <circle cx="16" cy="18" r="2" stroke="currentColor" fill="none" strokeWidth="1.5"/>
                </svg>
                <div className="flex items-center gap-[2px]">
                  <div className="w-1 h-1 rounded-full bg-white/30" />
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="w-1 h-1 rounded-full bg-white/30" />
                </div>
              </div>

              <div className="min-w-0 flex-1 text-right">
                <p className="text-[10px] text-white/50 font-medium mb-0.5">Ke</p>
                <p className="text-[15px] font-bold text-white leading-tight truncate">{destCity}</p>
                {arriveTime && (
                  <p className="text-[20px] font-display font-extrabold text-white/70 leading-none mt-1 tabular-nums">{arriveTime}</p>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-[8px] -left-[8px] w-4 h-4 rounded-full" style={{ background: notchBg }} />
            <div className="absolute -top-[8px] -right-[8px] w-4 h-4 rounded-full" style={{ background: notchBg }} />
            <div className="absolute top-[0px] left-4 right-4 border-t border-dashed border-slate-200" />

            <div className="bg-white rounded-b-2xl px-4 pt-3.5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {dateLabel && (
                    <div className="shrink-0">
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Tanggal</p>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">{dateLabel}</p>
                    </div>
                  )}
                  {trip.seatNumbers?.length > 0 && (
                    <div className="shrink-0">
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Kursi</p>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">{trip.seatNumbers.join(', ')}</p>
                    </div>
                  )}
                  {paxName && (
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Penumpang</p>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5 truncate">
                        {paxName}{trip.passengerCount > 1 ? ` +${trip.passengerCount - 1}` : ''}
                      </p>
                    </div>
                  )}
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center shrink-0 ml-2">
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

const CITY_LANDMARKS: Record<string, JSX.Element> = {
  'Jakarta': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <rect x="14" y="4" width="4" height="4" rx="1" fill="currentColor" opacity="0.3"/>
      <rect x="15" y="8" width="2" height="6" fill="currentColor"/>
      <path d="M10 14h12l-2 12H12L10 14z" fill="currentColor" opacity="0.7"/>
      <rect x="14.5" y="18" width="3" height="5" rx="0.5" fill="white" opacity="0.5"/>
      <rect x="8" y="26" width="16" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Bandung': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <path d="M6 26h20v-8L21 12h-2v-4h-6v4h-2L6 18v8z" fill="currentColor" opacity="0.7"/>
      <rect x="12" y="20" width="3" height="6" rx="0.5" fill="white" opacity="0.5"/>
      <rect x="17" y="20" width="3" height="3" rx="0.5" fill="white" opacity="0.5"/>
      <path d="M14 6h4v2h-4z" fill="currentColor" opacity="0.4"/>
      <rect x="4" y="26" width="24" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Semarang': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <path d="M4 26V14l4-4h16l4 4v12" fill="currentColor" opacity="0.7"/>
      <rect x="8" y="16" width="3" height="5" rx="1" fill="white" opacity="0.5"/>
      <rect x="14" y="16" width="3" height="5" rx="1" fill="white" opacity="0.5"/>
      <rect x="20" y="16" width="3" height="5" rx="1" fill="white" opacity="0.5"/>
      <path d="M12 8h8l2 2H10l2-2z" fill="currentColor" opacity="0.4"/>
      <rect x="2" y="26" width="28" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Yogyakarta': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <rect x="14" y="4" width="4" height="3" rx="1" fill="currentColor" opacity="0.4"/>
      <rect x="15" y="7" width="2" height="5" fill="currentColor" opacity="0.6"/>
      <path d="M12 12h8l1 4H11l1-4z" fill="currentColor" opacity="0.7"/>
      <rect x="15" y="16" width="2" height="10" fill="currentColor" opacity="0.6"/>
      <rect x="10" y="26" width="12" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Surabaya': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <rect x="14" y="3" width="4" height="3" rx="1" fill="currentColor" opacity="0.4"/>
      <rect x="15" y="6" width="2" height="8" fill="currentColor"/>
      <path d="M11 14h10v4H11z" fill="currentColor" opacity="0.7"/>
      <rect x="13" y="18" width="6" height="8" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="15" y="20" width="2" height="4" rx="0.5" fill="white" opacity="0.5"/>
      <rect x="8" y="26" width="16" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Cirebon': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <path d="M16 5l8 9v12H8V14l8-9z" fill="currentColor" opacity="0.7"/>
      <rect x="13" y="18" width="6" height="8" rx="1" fill="white" opacity="0.4"/>
      <path d="M16 5l-2 3h4l-2-3z" fill="currentColor" opacity="0.5"/>
      <rect x="6" y="26" width="20" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Denpasar': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <path d="M16 3l-3 5h6l-3-5z" fill="currentColor" opacity="0.5"/>
      <path d="M16 8l-5 6h10l-5-6z" fill="currentColor" opacity="0.6"/>
      <path d="M16 14l-7 8h14l-7-8z" fill="currentColor" opacity="0.7"/>
      <rect x="15" y="22" width="2" height="4" fill="currentColor" opacity="0.5"/>
      <rect x="8" y="26" width="16" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Malang': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <circle cx="16" cy="10" r="5" fill="currentColor" opacity="0.3"/>
      <rect x="15" y="6" width="2" height="8" fill="currentColor" opacity="0.6"/>
      <rect x="13" y="14" width="6" height="12" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="14.5" y="18" width="3" height="4" rx="0.5" fill="white" opacity="0.5"/>
      <rect x="10" y="26" width="12" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Gianyar': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <path d="M16 4l-4 7h8l-4-7z" fill="currentColor" opacity="0.5"/>
      <path d="M16 11l-6 8h12l-6-8z" fill="currentColor" opacity="0.65"/>
      <rect x="14" y="19" width="4" height="7" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="8" y="26" width="16" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
  'Probolinggo': (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
      <path d="M16 4l-6 14h12L16 4z" fill="currentColor" opacity="0.5"/>
      <path d="M14 10l-8 16h10l-2-16z" fill="currentColor" opacity="0.35"/>
      <path d="M18 10l8 16H16l2-16z" fill="currentColor" opacity="0.35"/>
      <ellipse cx="16" cy="8" rx="3" ry="1.5" fill="white" opacity="0.4"/>
      <rect x="4" y="26" width="24" height="2" rx="1" fill="currentColor"/>
    </svg>
  ),
};

function CityIcon({ city }: { city: string }) {
  const landmark = CITY_LANDMARKS[city];
  return (
    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 text-teal-600">
      {landmark || <MapPin className="w-5 h-5" />}
    </div>
  );
}

function CityList({ cities, isOrigin, onSelect }: { cities: string[]; isOrigin: boolean; onSelect: (city: string) => void }) {
  return (
    <div className="space-y-2">
      {cities.map((city) => (
        <button
          key={city}
          onClick={() => onSelect(city)}
          className="w-full flex items-center gap-3 bg-white rounded-2xl p-3 active:scale-[0.98] hover:shadow-md transition-all text-left shadow-sm"
          data-testid={`sheet-city-${city}`}
        >
          <CityIcon city={city} />
          <p className="flex-1 text-[14px] font-bold text-slate-800">{city}</p>
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
            isOrigin ? 'bg-teal-50' : 'bg-coral-50',
          )}>
            <ArrowRight className={cn('w-3.5 h-3.5', isOrigin ? 'text-teal-500' : 'text-coral-400')} />
          </div>
        </button>
      ))}
    </div>
  );
}

const RECENT_CITIES_KEY = 't_recent_cities';
const MAX_RECENT = 5;

function getRecentCities(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CITIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch { return []; }
}

function saveRecentCity(city: string) {
  const recent = getRecentCities().filter((c) => c !== city);
  recent.unshift(city);
  localStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function CityBottomSheet({ open, title, cities, onSelect, onClose }: {
  open: boolean; title: string; cities: string[];
  onSelect: (city: string) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { setSheetOpen } = useSheet();

  useEffect(() => {
    if (open) {
      setQuery('');
    }
    setSheetOpen(open);
    return () => { setSheetOpen(false); };
  }, [open, setSheetOpen]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      if (sheetRef.current) {
        sheetRef.current.style.height = `${window.innerHeight * 0.9}px`;
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const filtered = cities.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );

  const isOrigin = title.toLowerCase().includes('keberangkatan');

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[70] bg-[#f8fafa] rounded-t-[1.5rem] transition-transform duration-300 ease-out',
          'flex flex-col',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="bg-white rounded-t-[1.5rem] shadow-sm shrink-0">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center',
                isOrigin ? 'bg-teal-50' : 'bg-coral-50',
              )}>
                <MapPin className={cn('w-4 h-4', isOrigin ? 'text-teal-600' : 'text-coral-500')} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-800">{title}</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Pilih kota {isOrigin ? 'asal' : 'tujuanmu'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              data-testid="button-close-sheet"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="px-5 pb-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari kota..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 text-[14px] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-500/40 transition-all"
                data-testid="input-search-city"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-24 min-h-0 px-4 pt-3">
          {query ? (
            filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-[13px] text-slate-400 font-medium">Kota tidak ditemukan</p>
              </div>
            ) : (
              <CityList cities={filtered} isOrigin={isOrigin} onSelect={onSelect} />
            )
          ) : (() => {
            const recentCities = getRecentCities().filter((c) => cities.includes(c));
            return (
              <>
                {recentCities.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <History className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terakhir</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentCities.map((city) => (
                        <button
                          key={`recent-${city}`}
                          onClick={() => onSelect(city)}
                          className="flex items-center gap-1.5 bg-white border border-teal-200/60 rounded-full pl-1.5 pr-3 py-1.5 active:scale-95 transition-all shadow-sm"
                          data-testid={`sheet-recent-${city}`}
                        >
                          <div className="w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                            <History className="w-3 h-3" />
                          </div>
                          <span className="text-[12px] font-semibold text-slate-700">{city}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <CityList cities={cities} isOrigin={isOrigin} onSelect={onSelect} />
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
