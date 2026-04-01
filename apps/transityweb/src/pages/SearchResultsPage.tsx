import { useState, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNav } from '@/App';
import { tripsApi, type TripSearchResult, type TripStopInfo } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, SearchX, Clock, MapPin, ChevronDown, ChevronUp, Bus, Users, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const PAGE_LIMIT = 10;

interface Props {
  originCity: string;
  destinationCity: string;
  date: string;
  passengers: number;
}

export default function SearchResultsPage({ originCity, destinationCity, date, passengers }: Props) {
  const { navigate, goBack } = useNav();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['trips-search-infinite', originCity, destinationCity, date, passengers],
    queryFn: ({ pageParam }) =>
      tripsApi.searchPaginated({ originCity, destinationCity, date, passengers, page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  const trips = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '120px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const selectTrip = (trip: TripSearchResult) => {
    const fare = trip.farePerPerson || parseFloat(trip.baseFare || '0') || 0;
    navigate({
      name: 'select-stops',
      tripId: trip.tripId,
      passengers,
      tripLabel: `${trip.patternName || trip.patternCode}`,
      fare,
      stops: trip.stops || [],
      originCity,
      destCity: destinationCity,
      originSeq: trip.origin?.sequence || 0,
      destSeq: trip.destination?.sequence || 0,
    });
  };

  let dateLabel = date;
  try { dateLabel = format(parseISO(date), 'EEE, d MMM yyyy', { locale: idLocale }); } catch {}

  return (
    <div className="anim-fade min-h-screen bg-slate-50">
      <div className="hero-mesh px-4 pt-3 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-white font-bold text-[16px] font-display">
              <span className="truncate">{originCity}</span>
              <span className="text-teal-300 text-[13px]">→</span>
              <span className="truncate">{destinationCity}</span>
            </div>
            <p className="text-teal-300/80 text-[12px] mt-0.5 font-medium">
              {dateLabel} · {passengers} penumpang
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8">
        {isLoading && (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
            </div>
            <p className="text-[13px] text-slate-400 font-medium">Mencari perjalanan...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <SearchX className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 text-[14px]">Gagal memuat hasil pencarian</p>
          </div>
        )}

        {!isLoading && !error && trips.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <SearchX className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700">Tidak ada perjalanan</p>
            <p className="text-[13px] text-slate-400 mt-1">Coba tanggal atau rute lain</p>
          </div>
        )}

        {trips.length > 0 && (
          <p className="text-[12px] font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            {trips.length} dari {total} perjalanan
          </p>
        )}

        <div className="space-y-3">
          {trips.map((trip, i) => (
            <TripCard
              key={trip.tripId}
              trip={trip}
              index={i}
              passengers={passengers}
              onSelect={() => selectTrip(trip)}
            />
          ))}
        </div>

        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex flex-col items-center py-6 gap-2" data-testid="status-loading-more">
            <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
            <p className="text-[12px] text-slate-400 font-medium">Memuat lebih banyak...</p>
          </div>
        )}

        {!isLoading && !hasNextPage && trips.length > 0 && (
          <div className="flex flex-col items-center py-6 gap-1.5" data-testid="status-all-loaded">
            <CheckCircle2 className="w-4 h-4 text-slate-300" />
            <p className="text-[11px] text-slate-300 font-medium">Semua perjalanan ditampilkan</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getDurationLabel(departAt?: string, arriveAt?: string): string {
  if (!departAt || !arriveAt) return '';
  const d1 = new Date(departAt).getTime();
  const d2 = new Date(arriveAt).getTime();
  if (isNaN(d1) || isNaN(d2)) return '';
  const diff = Math.abs(d2 - d1);
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

function TripCard({ trip, index, passengers, onSelect }: {
  trip: TripSearchResult; index: number; passengers: number; onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fare = trip.farePerPerson || parseFloat(trip.baseFare || '0') || 0;
  const allStops = trip.stops || [];
  const duration = getDurationLabel(trip.origin?.departAt, trip.destination?.arriveAt);
  const intermediateStops = Math.max(allStops.length - 2, 0);
  const isFull = trip.availableSeats < passengers;

  return (
    <div
      className={cn('bg-white rounded-2xl overflow-hidden anim-slide-up border border-slate-100', `delay-${Math.min(index + 1, 4)}`)}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
      data-testid={`card-trip-${trip.tripId}`}
    >
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <Bus className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[13px] text-slate-700 truncate leading-tight">{trip.patternName || trip.patternCode}</p>
            {trip.vehicleClass && (
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{trip.vehicleClass}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-extrabold text-[18px] text-teal-700 font-display leading-none">{fmtCurrency(fare)}</p>
            <p className="text-[10px] text-slate-400 font-medium">/orang</p>
          </div>
        </div>

        <div className="flex items-stretch gap-3">
          <div className="flex flex-col items-center shrink-0 w-[52px]">
            <p className="font-bold text-[22px] text-slate-900 leading-none font-display">{fmtTime(trip.origin?.departAt)}</p>
            <div className="flex-1 flex flex-col items-center py-1.5">
              <div className="w-[9px] h-[9px] rounded-full border-[2.5px] border-teal-500 bg-white" />
              <div className="flex-1 w-[2px] bg-gradient-to-b from-teal-400 to-coral-400 rounded-full my-0.5" style={{ minHeight: 24 }} />
              <div className="w-[9px] h-[9px] rounded-full bg-coral-500" />
            </div>
            <p className="font-bold text-[22px] text-slate-900 leading-none font-display">{fmtTime(trip.destination?.arriveAt)}</p>
          </div>

          <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
            <div>
              <p className="font-semibold text-[13px] text-slate-800 truncate">{trip.origin?.name}</p>
            </div>

            <div className="flex items-center gap-2 my-1">
              {duration && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-50 rounded-md px-2 py-0.5">
                  <Clock className="w-3 h-3" />
                  {duration}
                </span>
              )}
              {intermediateStops > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-teal-600 bg-teal-50/60 rounded-md px-2 py-0.5 hover:bg-teal-50 transition-colors"
                  data-testid={`button-expand-stops-${trip.tripId}`}
                >
                  <MapPin className="w-3 h-3" />
                  {intermediateStops} transit
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            <div>
              <p className="font-semibold text-[13px] text-slate-800 truncate">{trip.destination?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {expanded && allStops.length > 0 && (
        <div className="px-4 pb-3">
          <StopsTimeline stops={allStops} />
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-t border-slate-100/80">
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className={cn(
            isFull ? 'text-red-500' : trip.availableSeats <= 5 ? 'text-amber-600' : 'text-slate-400'
          )}>
            {isFull ? 'Penuh' : `${trip.availableSeats} kursi tersedia`}
          </span>
        </div>
        <Button
          size="sm"
          className={cn(
            "h-9 px-6 rounded-xl text-[13px] font-bold shadow-sm transition-all",
            isFull
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-teal-700 hover:bg-teal-800 active:scale-[0.97] text-white"
          )}
          onClick={onSelect}
          disabled={isFull}
          data-testid={`button-select-trip-${trip.tripId}`}
        >
          {isFull ? 'Penuh' : 'Pilih'}
        </Button>
      </div>
    </div>
  );
}

function StopsTimeline({ stops }: { stops: TripStopInfo[] }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 anim-fade">
      <div className="relative pl-5">
        <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-teal-400 via-teal-300 to-coral-400 rounded-full" />
        {stops.map((stop, i) => {
          const isFirst = i === 0;
          const isLast = i === stops.length - 1;
          const time = isFirst ? stop.departAt : stop.arriveAt;
          return (
            <div key={stop.stopId} className="relative flex items-start gap-3 pb-3 last:pb-0">
              <div className="absolute left-[-17px] top-[5px]">
                {isFirst || isLast ? (
                  <div className={cn(
                    'w-[10px] h-[10px] rounded-full border-2',
                    isFirst ? 'border-teal-500 bg-white' : 'bg-coral-500 border-coral-500',
                  )} />
                ) : (
                  <div className="w-[8px] h-[8px] rounded-full bg-teal-300 border border-white ml-[1px]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn(
                    'text-[12px] truncate',
                    (isFirst || isLast) ? 'font-bold text-slate-800' : 'font-medium text-slate-500',
                  )}>
                    {stop.name}
                  </p>
                  <span className={cn(
                    'shrink-0 text-[12px] tabular-nums',
                    (isFirst || isLast) ? 'font-bold text-slate-800' : 'font-medium text-slate-400',
                  )}>
                    {fmtTime(time)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
