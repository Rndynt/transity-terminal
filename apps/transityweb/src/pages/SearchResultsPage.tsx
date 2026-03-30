import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNav } from '@/App';
import { tripsApi, type TripSearchResult, type TripStopInfo } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, SearchX, Users, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  originCity: string;
  destinationCity: string;
  date: string;
  passengers: number;
}

export default function SearchResultsPage({ originCity, destinationCity, date, passengers }: Props) {
  const { navigate, goBack } = useNav();

  const { data: trips, isLoading, error } = useQuery({
    queryKey: ['trips-search', originCity, destinationCity, date, passengers],
    queryFn: () => tripsApi.search({ originCity, destinationCity, date, passengers }),
  });

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
      <div className="bg-teal-900 px-4 pt-3 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-white font-semibold text-[15px]">
              <span className="truncate">{originCity}</span>
              <ChevronRight className="w-4 h-4 shrink-0 text-teal-300" />
              <span className="truncate">{destinationCity}</span>
            </div>
            <p className="text-teal-300 text-[12px] mt-0.5">{dateLabel} · {passengers} penumpang</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {isLoading && (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-[13px] text-slate-400 font-medium">Mencari perjalanan...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <SearchX className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 text-[14px]">Gagal memuat hasil pencarian</p>
          </div>
        )}

        {trips && trips.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <SearchX className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700">Tidak ada perjalanan</p>
            <p className="text-[13px] text-slate-400 mt-1">Coba tanggal atau rute lain</p>
          </div>
        )}

        {trips && trips.length > 0 && (
          <p className="text-[12px] font-semibold text-slate-400 mb-3">{trips.length} perjalanan ditemukan</p>
        )}

        <div className="space-y-3">
          {trips?.map((trip, i) => (
            <TripCard key={trip.tripId} trip={trip} index={i} passengers={passengers} onSelect={() => selectTrip(trip)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TripCard({ trip, index, passengers, onSelect }: {
  trip: TripSearchResult; index: number; passengers: number; onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fare = trip.farePerPerson || parseFloat(trip.baseFare || '0') || 0;

  const originSeq = trip.origin?.sequence || 0;
  const destSeq = trip.destination?.sequence || 0;
  const allStops = (trip.stops || []).filter(s => s.sequence >= originSeq && s.sequence <= destSeq);

  return (
    <div
      className={cn('bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up', `delay-${Math.min(index + 1, 4)}`)}
      data-testid={`card-trip-${trip.tripId}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[14px] text-slate-800 leading-snug">{trip.patternName || trip.patternCode}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {trip.vehicleClass && (
                <Badge variant="secondary" className="text-[10px] font-semibold bg-teal-50 text-teal-700 border-0 px-2 py-0.5 rounded-md">{trip.vehicleClass}</Badge>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="font-extrabold text-[17px] text-teal-800 font-display">{fmtCurrency(fare)}</p>
            <p className="text-[10px] text-slate-400 font-medium">/orang</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="text-left shrink-0">
            <p className="font-bold text-[20px] text-slate-900 leading-none">{fmtTime(trip.origin?.departAt)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{trip.origin?.name}</p>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 px-1">
            <div className="w-full flex items-center">
              <div className="w-[7px] h-[7px] rounded-full border-2 border-teal-500" />
              <div className="flex-1 h-[1.5px] bg-gradient-to-r from-teal-400/60 via-teal-300/40 to-coral-400/60 mx-0.5" />
              <div className="w-[7px] h-[7px] rounded-full bg-coral-500" />
            </div>
            {allStops.length > 2 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 text-[10px] font-semibold text-teal-600 hover:text-teal-800 transition-colors"
                data-testid={`button-expand-stops-${trip.tripId}`}
              >
                {allStops.length - 2} pemberhentian
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-[20px] text-slate-900 leading-none">{fmtTime(trip.destination?.arriveAt)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{trip.destination?.name}</p>
          </div>
        </div>

        {expanded && allStops.length > 0 && (
          <StopsTimeline stops={allStops} originSeq={originSeq} destSeq={destSeq} />
        )}

        <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-100">
          <div className="flex items-center gap-1.5 text-[12px] text-slate-400 font-medium">
            <Users className="w-3.5 h-3.5" />
            <span>{trip.availableSeats} kursi tersedia</span>
          </div>
          <Button
            size="sm"
            className="h-9 px-5 rounded-xl bg-teal-800 hover:bg-teal-900 text-[13px] font-bold shadow-sm"
            onClick={onSelect}
            disabled={trip.availableSeats < passengers}
            data-testid={`button-select-trip-${trip.tripId}`}
          >
            Pilih
          </Button>
        </div>
      </div>
    </div>
  );
}

function StopsTimeline({ stops, originSeq, destSeq }: {
  stops: TripStopInfo[]; originSeq: number; destSeq: number;
}) {
  return (
    <div className="mb-3 mx-1 bg-slate-50 rounded-xl p-3 anim-fade">
      <div className="relative pl-5">
        <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-teal-400 via-teal-300 to-coral-400 rounded-full" />
        {stops.map((stop, i) => {
          const isFirst = stop.sequence === originSeq;
          const isLast = stop.sequence === destSeq;
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
                    'text-[13px] truncate',
                    (isFirst || isLast) ? 'font-bold text-slate-800' : 'font-medium text-slate-500',
                  )}>
                    {stop.name}
                  </p>
                  <span className={cn(
                    'shrink-0 text-[13px] tabular-nums',
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
