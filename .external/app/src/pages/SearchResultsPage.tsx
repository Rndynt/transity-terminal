import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNav } from '@/App';
import { tripsApi, type TripSearchResult } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import OperatorLogo from '@/components/OperatorLogo';
import FilterBottomSheet, { type FilterState, type SortOption } from '@/components/FilterBottomSheet';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Loader2, SearchX, Clock, MapPin, ChevronDown, ChevronUp, CheckCircle2, ArrowRight, SlidersHorizontal, Bus, ArrowUpDown } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { format, parseISO, addDays, isSameDay, isToday, isTomorrow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TripCardSkeleton } from '@/components/ui/skeleton';

const PAGE_LIMIT = 10;

const VEHICLE_LABELS: Record<string, string> = {
  'commuter-14': 'Commuter',
  'premio-14': 'Premio',
  'executive-14': 'Executive',
};

function vehicleLabel(vc: string | null | undefined): string {
  if (!vc) return '';
  return VEHICLE_LABELS[vc] || vc.replace(/-\d+$/, '').replace(/^\w/, c => c.toUpperCase());
}

interface Props {
  originCity: string;
  destinationCity: string;
  date: string;
  passengers: number;
  operatorFilter?: string | null;
}

function generateDateRange(originalDate: string, days: number): Date[] {
  const original = parseISO(originalDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = original < today ? today : original;
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(start, i));
  }
  return dates;
}

function getDateChipLabel(d: Date): string {
  if (isToday(d)) return 'Hari Ini';
  if (isTomorrow(d)) return 'Besok';
  return format(d, 'EEE', { locale: idLocale });
}

function DateStrip({ currentDate, originalDate, onChangeDate }: {
  currentDate: string;
  originalDate: string;
  onChangeDate: (newDate: string) => void;
}) {
  const dates = generateDateRange(originalDate, 7);
  const selected = parseISO(currentDate);

  return (
    <div className="grid grid-cols-7 gap-1 mt-3 -mx-4 px-4 pb-0.5 pt-2">
      {dates.map((d) => {
        const iso = format(d, 'yyyy-MM-dd');
        const isActive = isSameDay(d, selected);
        return (
          <button
            key={iso}
            onClick={() => { if (!isActive) onChangeDate(iso); }}
            className={cn(
              'relative flex flex-col items-center py-2 text-center transition-all active:scale-[0.95] rounded-xl',
              isActive ? '' : 'hover:bg-white/10',
            )}
          >
            {isActive && (
              <div className="absolute inset-[2px] bg-white/20 ring-1 ring-inset ring-white/30 rounded-[10px]" />
            )}
            <span className={cn('relative text-[10px] font-semibold leading-tight', isActive ? 'text-white' : 'text-teal-300/60')}>
              {getDateChipLabel(d)}
            </span>
            <span className={cn('relative text-[17px] font-extrabold font-display leading-snug', isActive ? 'text-white' : 'text-teal-200/80')}>
              {format(d, 'd')}
            </span>
            <span className={cn('relative text-[9px] font-semibold uppercase tracking-wider leading-tight', isActive ? 'text-teal-200' : 'text-teal-300/50')}>
              {format(d, 'MMM', { locale: idLocale })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function SearchResultsPage({ originCity, destinationCity, date, passengers, operatorFilter }: Props) {
  const { navigate, goBack } = useNav();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<FilterState>({
    operator: operatorFilter ?? null,
    sort: 'default',
    pickupStop: null,
    dropStop: null,
  });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const [activeDate, setActiveDate] = useState(date);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['trips-search-infinite', originCity, destinationCity, activeDate, passengers],
    queryFn: ({ pageParam }) =>
      tripsApi.searchPaginated({ originCity, destinationCity, date: activeDate, passengers, page: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  const handlePullRefresh = useCallback(async () => {
    await queryClient.resetQueries({ queryKey: ['trips-search-infinite', originCity, destinationCity, activeDate, passengers] });
  }, [queryClient, originCity, destinationCity, activeDate, passengers]);

  const handleDateChange = useCallback((newDate: string) => {
    setActiveDate(newDate);
    setFilters({ operator: null, sort: 'default', pickupStop: null, dropStop: null });
  }, []);

  const { containerRef, pullDistance, isRefreshing, progress, isPastThreshold } = usePullToRefresh({
    onRefresh: handlePullRefresh,
  });

  const allTrips = data?.pages.flatMap((p) => p.data) ?? [];
  const totalUnfiltered = data?.pages[0]?.total ?? 0;

  const trips = useMemo(() => {
    let result = [...allTrips];
    if (filters.operator) {
      result = result.filter(t => t.operatorSlug === filters.operator);
    }
    if (filters.pickupStop) {
      result = result.filter(t => {
        const raw = (t as unknown as { raw?: { stops?: Array<{ name: string; boardingAllowed?: boolean }> } }).raw;
        return raw?.stops?.some(s => s.name === filters.pickupStop && s.boardingAllowed !== false);
      });
    }
    if (filters.dropStop) {
      result = result.filter(t => {
        const raw = (t as unknown as { raw?: { stops?: Array<{ name: string; alightingAllowed?: boolean }> } }).raw;
        return raw?.stops?.some(s => s.name === filters.dropStop && s.alightingAllowed !== false);
      });
    }
    if (filters.sort === 'price-asc') {
      result.sort((a, b) => a.farePerPerson - b.farePerPerson);
    } else if (filters.sort === 'price-desc') {
      result.sort((a, b) => b.farePerPerson - a.farePerPerson);
    } else if (filters.sort === 'depart-asc') {
      result.sort((a, b) => (getRawTimes(a).departAt || '').localeCompare(getRawTimes(b).departAt || ''));
    } else if (filters.sort === 'depart-desc') {
      result.sort((a, b) => (getRawTimes(b).departAt || '').localeCompare(getRawTimes(a).departAt || ''));
    }
    return result;
  }, [allTrips, filters]);

  const operators = Array.from(
    new Map(allTrips.map(t => [t.operatorSlug, { slug: t.operatorSlug, name: t.operatorName, color: t.operatorColor || '#134E4A', logo: t.operatorLogo }])).values()
  );

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
    const rawStops = getRawStops(trip);
    const stopsForNav: import('@/lib/api').TripStopInfo[] = rawStops.map(s => ({
      stopId: s.stopId || s.code,
      name: s.name,
      code: s.code,
      city: s.city,
      sequence: s.sequence,
      arriveAt: s.arriveAt,
      departAt: s.departAt,
      boardingAllowed: s.boardingAllowed,
      alightingAllowed: s.alightingAllowed,
    }));
    navigate({
      name: 'trip-detail',
      tripId: trip.tripId,
      serviceDate: trip.serviceDate,
      passengers,
      originCity,
      destCity: destinationCity,
      trip,
      rawStops: stopsForNav,
    });
  };

  let dateLabel = activeDate;
  try { dateLabel = format(parseISO(activeDate), 'EEE, d MMM yyyy', { locale: idLocale }); } catch {}

  return (
    <div ref={containerRef} className="anim-fade bg-[#f8fafa] overflow-y-auto" style={{ height: '100dvh' }}>
      <PageHeader
        title={`${originCity} → ${destinationCity}`}
        subtitle={`${passengers} penumpang`}
        onBack={goBack}
        sticky
        scrollContainerRef={containerRef}
      >
        <DateStrip
          currentDate={activeDate}
          originalDate={date}
          onChangeDate={handleDateChange}
        />
      </PageHeader>

      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        isPastThreshold={isPastThreshold}
      />

      <div className="px-4 pt-4 safe-pb-24">
        {!isLoading && allTrips.length > 0 && (() => {
          const activeCount = [filters.operator, filters.sort !== 'default' ? true : null, filters.pickupStop, filters.dropStop].filter(Boolean).length;
          return (
            <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
              <button
                onClick={() => setFilterSheetOpen(true)}
                className={cn(
                  'flex items-center gap-2 h-9 px-3 pr-3.5 rounded-xl border text-[12px] font-semibold transition-all active:scale-[0.97] shrink-0',
                  activeCount > 0
                    ? 'border-teal-600 bg-teal-50 text-teal-800 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-teal-300'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {activeCount > 0 && (
                  <span className="bg-teal-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeCount}</span>
                )}
              </button>
              {filters.operator && (
                <span className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-teal-200 bg-teal-50/60 text-[11px] font-semibold text-teal-700 shrink-0">
                  <Bus className="w-3 h-3" />
                  {operators.find(o => o.slug === filters.operator)?.name}
                </span>
              )}
              {filters.sort !== 'default' && (
                <span className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-teal-200 bg-teal-50/60 text-[11px] font-semibold text-teal-700 shrink-0">
                  <ArrowUpDown className="w-3 h-3" />
                  {filters.sort === 'price-asc' ? 'Termurah' : filters.sort === 'price-desc' ? 'Termahal' : filters.sort === 'depart-asc' ? 'Paling Awal' : 'Paling Akhir'}
                </span>
              )}
              {filters.pickupStop && (
                <span className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-teal-200 bg-teal-50/60 text-[11px] font-semibold text-teal-700 shrink-0">
                  <MapPin className="w-3 h-3" />
                  {filters.pickupStop}
                </span>
              )}
              {filters.dropStop && (
                <span className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-emerald-200 bg-emerald-50/60 text-[11px] font-semibold text-emerald-700 shrink-0">
                  <MapPin className="w-3 h-3" />
                  {filters.dropStop}
                </span>
              )}
            </div>
          );
        })()}

        {isLoading && (
          <div className="space-y-3 anim-fade">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
              <p className="text-[12px] text-slate-400 font-medium">Mencari perjalanan...</p>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
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
            <p className="text-[13px] text-slate-400 mt-1">
              {(filters.operator || filters.pickupStop || filters.dropStop) ? 'Tidak ada perjalanan yang sesuai filter. Coba ubah filter.' : 'Coba tanggal atau rute lain'}
            </p>
            {(filters.operator || filters.pickupStop || filters.dropStop) && (
              <button
                onClick={() => setFilters({ operator: null, sort: 'default', pickupStop: null, dropStop: null })}
                className="mt-3 text-[13px] font-semibold text-teal-600 hover:text-teal-700"
              >
                Reset semua filter
              </button>
            )}
          </div>
        )}

        {trips.length > 0 && (
          <p className="text-[12px] font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            {(filters.operator || filters.pickupStop || filters.dropStop) ? `${trips.length} perjalanan` : `${trips.length} dari ${totalUnfiltered} perjalanan`}
          </p>
        )}

        <div className="space-y-3">
          {trips.map((trip, i) => (
            <TripCard
              key={trip.tripId}
              trip={trip}
              index={i}
              passengers={passengers}
              originCity={originCity}
              destCity={destinationCity}
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

      <FilterBottomSheet
        open={filterSheetOpen}
        operators={operators.map(o => ({ slug: o.slug, name: o.name, color: o.color, logo: o.logo }))}
        trips={allTrips}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterSheetOpen(false)}
      />
    </div>
  );
}

function getRawStops(trip: TripSearchResult): Array<{ stopId?: string; name: string; code: string; city: string; departAt: string | null; arriveAt: string | null; sequence: number; boardingAllowed?: boolean; alightingAllowed?: boolean }> {
  const raw = (trip as unknown as { raw?: { stops?: Array<{ stopId?: string; name: string; code: string; city: string; departAt: string | null; arriveAt: string | null; sequence: number; boardingAllowed?: boolean; alightingAllowed?: boolean }> } }).raw;
  return raw?.stops || [];
}

function getRawTimes(trip: TripSearchResult): { departAt: string | null; arriveAt: string | null } {
  const raw = (trip as unknown as { raw?: { origin?: { departAt: string | null }; destination?: { arriveAt: string | null } } }).raw;
  return {
    departAt: raw?.origin?.departAt || trip.origin?.departureTime || null,
    arriveAt: raw?.destination?.arriveAt || trip.destination?.departureTime || null,
  };
}

function getDurationLabel(departureTime?: string | null, arrivalTime?: string | null): string {
  if (!departureTime || !arrivalTime) return '';
  const d1 = new Date(departureTime).getTime();
  const d2 = new Date(arrivalTime).getTime();
  if (isNaN(d1) || isNaN(d2)) return '';
  const diff = Math.abs(d2 - d1);
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} jam`;
  return `${h}j ${m}m`;
}

function TripCard({ trip, index, passengers, originCity, destCity, onSelect }: {
  trip: TripSearchResult; index: number; passengers: number; originCity: string; destCity: string; onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rawTimes = getRawTimes(trip);
  const departTime = fmtTime(rawTimes.departAt);
  const arriveTime = fmtTime(rawTimes.arriveAt);
  const duration = getDurationLabel(rawTimes.departAt, rawTimes.arriveAt);
  const isFull = trip.availableSeats < passengers;
  const stops = getRawStops(trip);
  const svcLabel = vehicleLabel(trip.vehicleClass);
  const originLabel = trip.origin?.stopName || originCity;
  const destLabel = trip.destination?.stopName || destCity;

  return (
    <div
      role="button"
      tabIndex={isFull ? undefined : 0}
      className={cn(
        'w-full text-left bg-white rounded-2xl overflow-hidden anim-slide-up transition-all cursor-pointer',
        isFull ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]',
        `delay-${Math.min(index + 1, 4)}`
      )}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}
      onClick={isFull ? undefined : onSelect}
      data-testid={`card-trip-${trip.tripId}`}
    >
      <div className="p-4 pb-3">
        <div className="flex">
          <div style={{ width: 16 }} className="flex flex-col items-center shrink-0 self-stretch">
            <div className="flex items-center" style={{ height: 24 }}>
              <div className="w-[8px] h-[8px] rounded-full border-[2px] border-teal-500 bg-white" />
            </div>
            <div className="w-[1.5px] flex-1 bg-gradient-to-b from-teal-400 to-emerald-400" />
            <div className="flex items-center" style={{ height: 24 }}>
              <div className="w-[8px] h-[8px] rounded-full bg-emerald-500" />
            </div>
          </div>

          <div className="flex-1 min-w-0" style={{ paddingLeft: 10 }}>
            <div className="flex items-center gap-2.5" style={{ height: 24 }}>
              <span className="font-extrabold text-[20px] text-slate-900 font-display leading-none tracking-tight shrink-0 tabular-nums">{departTime}</span>
              <span className="text-[13px] font-medium text-slate-600 truncate">{originLabel}</span>
            </div>

            <div className="flex items-center gap-1.5 my-2.5 pl-0.5">
              {duration && (
                <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-1.5 py-[1px] rounded">{duration}</span>
              )}
              {stops.length > 2 && (
                <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-1.5 py-[1px] rounded">{stops.length} halte</span>
              )}
            </div>

            <div className="flex items-center gap-2.5" style={{ height: 24 }}>
              <span className="font-extrabold text-[20px] text-slate-900 font-display leading-none tracking-tight shrink-0 tabular-nums">{arriveTime}</span>
              <span className="text-[13px] font-medium text-slate-600 truncate">{destLabel}</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-extrabold text-[17px] text-teal-700 font-display leading-none tracking-tight">{fmtCurrency(trip.farePerPerson)}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">/orang</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100/80">
        <OperatorLogo
          name={trip.operatorName}
          logo={trip.operatorLogo}
          color={trip.operatorColor || '#134E4A'}
          size="sm"
          className="!w-5 !h-5 !rounded shrink-0"
        />
        <span className="text-[11px] font-medium text-slate-500 truncate">{trip.operatorName}</span>
        {svcLabel && (
          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-[1px] rounded-md shrink-0">{svcLabel}</span>
        )}
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-medium">
            <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 18v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2" /><rect x="6" y="2" width="12" height="10" rx="2" /><path d="M4 18h16" /><path d="M6 22h12" />
            </svg>
            <span className={cn(
              isFull ? 'text-red-500 font-semibold' : trip.availableSeats <= 5 ? 'text-amber-600' : 'text-slate-500'
            )}>
              {isFull ? 'Penuh' : `${trip.availableSeats}`}
            </span>
          </div>

          {stops.length > 2 && (
            <>
              <div className="w-px h-3 bg-slate-200" />
              <div
                role="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="flex items-center gap-0.5 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                data-testid={`button-expand-stops-${trip.tripId}`}
              >
                <MapPin className="w-3 h-3" />
                Rute
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </>
          )}
        </div>
      </div>

      {expanded && stops.length > 0 && (
        <div className="px-4 pt-3 pb-3 border-t border-slate-100/60 bg-slate-50/30" onClick={(e) => e.stopPropagation()}>
          {stops.map((stop, i) => {
            const isFirst = i === 0;
            const isLast = i === stops.length - 1;
            return (
              <div key={stop.code} className="relative flex" style={{ paddingLeft: 26 }}>
                <div className="absolute left-0 top-0 bottom-0" style={{ width: 16 }}>
                  {!isFirst && (
                    <div className="absolute left-[7px] top-0 bottom-1/2 w-[1.5px] bg-teal-200" />
                  )}
                  {!isLast && (
                    <div className="absolute left-[7px] top-1/2 bottom-0 w-[1.5px] bg-teal-200" />
                  )}
                  <div
                    className={cn(
                      'absolute left-1/2 top-[7px] -translate-x-1/2 rounded-full',
                      isFirst ? 'w-2 h-2 border-[2px] border-teal-500 bg-white'
                        : isLast ? 'w-2 h-2 bg-emerald-500'
                        : 'w-[6px] h-[6px] bg-slate-300'
                    )}
                  />
                </div>
                <div className="flex items-start gap-3 py-[5px] min-w-0">
                  <span
                    className={cn(
                      'text-[12px] font-bold tabular-nums shrink-0 leading-[16px]',
                      isFirst || isLast ? 'text-slate-700' : 'text-slate-400'
                    )}
                    style={{ width: 36 }}
                  >
                    {fmtTime(stop.departAt || stop.arriveAt)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'text-[13px] leading-[16px] truncate',
                      isFirst || isLast ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'
                    )}>
                      {stop.name}
                    </p>
                    {stop.city && (
                      <p className="text-[10px] text-slate-400 mt-[1px] truncate">{stop.city}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
