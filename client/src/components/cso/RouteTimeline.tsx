import { useQuery } from '@tanstack/react-query';
import { tripsApi, stopsApi } from '@/lib/api';
import {
  Clock, ArrowDown, MapPin, ArrowRight, Check, ChevronRight, Loader2
} from 'lucide-react';
import type { Trip, Stop } from '@/types';

interface RouteTimelineProps {
  trip: Trip;
  selectedOrigin?: Stop;
  selectedDestination?: Stop;
  onOriginSelect: (stop: Stop, sequence: number) => void;
  onDestinationSelect: (stop: Stop, sequence: number) => void;
  onProceed?: () => void;
}

const formatTime = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return '--:--';
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
  } catch { return '--:--'; }
};

const calculateDuration = (depart: Date | string | null | undefined, arrive: Date | string | null | undefined): number | null => {
  if (!depart || !arrive) return null;
  try {
    const departDate = depart instanceof Date ? depart : new Date(depart);
    const arriveDate = arrive instanceof Date ? arrive : new Date(arrive);
    if (isNaN(departDate.getTime()) || isNaN(arriveDate.getTime())) return null;
    return Math.round((arriveDate.getTime() - departDate.getTime()) / (1000 * 60));
  } catch { return null; }
};

const formatDuration = (mins: number): string => {
  if (mins >= 60) return `${Math.floor(mins / 60)}j ${mins % 60}m`;
  return `${mins}m`;
};

export default function RouteTimeline({
  trip,
  selectedOrigin,
  selectedDestination,
  onOriginSelect,
  onDestinationSelect,
  onProceed
}: RouteTimelineProps) {
  const { data: stopTimes = [], isLoading } = useQuery({
    queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'],
    queryFn: () => tripsApi.getStopTimesWithEffectiveFlags(trip.id),
    enabled: !!trip.id
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const getStopById = (stopId: string) => stops.find(s => s.id === stopId);
  const sortedStopTimes = [...stopTimes].sort((a: any, b: any) => a.stopSequence - b.stopSequence);

  const originIdx = selectedOrigin ? sortedStopTimes.findIndex((st: any) => st.stopId === selectedOrigin.id) : -1;
  const destIdx = selectedDestination ? sortedStopTimes.findIndex((st: any) => st.stopId === selectedDestination.id) : -1;
  const legCount = originIdx >= 0 && destIdx > originIdx ? destIdx - originIdx : 0;

  const isInSelectedRange = (i: number) => {
    if (originIdx < 0 || destIdx < 0) return false;
    return i >= originIdx && i <= destIdx;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
        <p className="text-xs text-gray-400">Memuat rute...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-0.5">Pilih Rute</h3>
        <p className="text-[11px] text-gray-400">Tentukan titik naik dan turun penumpang</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {sortedStopTimes.map((stopTime: any, index: number) => {
          const stop = getStopById(stopTime.stopId);
          if (!stop) return null;

          const isFirst = index === 0;
          const isLast = index === sortedStopTimes.length - 1;
          const isOrigin = selectedOrigin?.id === stop.id;
          const isDest = selectedDestination?.id === stop.id;
          const canBoard = stopTime.effectiveBoardingAllowed !== false;
          const canAlight = stopTime.effectiveAlightingAllowed !== false;
          const inRange = isInSelectedRange(index);

          const nextStopTime = sortedStopTimes[index + 1];
          const legDuration = nextStopTime ? calculateDuration(stopTime.departAt, nextStopTime.arriveAt) : null;

          return (
            <div key={stopTime.id}>
              <div className={`flex items-center px-4 py-3 transition-colors ${
                isOrigin ? 'bg-emerald-50' : isDest ? 'bg-rose-50' : inRange ? 'bg-blue-50/40' : 'hover:bg-gray-50'
              }`}>
                <div className="flex flex-col items-center mr-4 self-stretch">
                  {!isFirst && (
                    <div className={`w-0.5 flex-1 ${inRange || isOrigin ? 'bg-blue-300' : 'bg-gray-200'}`} />
                  )}
                  {isFirst && <div className="flex-1" />}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isOrigin ? 'bg-emerald-500 ring-[3px] ring-emerald-200 shadow-sm' :
                    isDest ? 'bg-rose-500 ring-[3px] ring-rose-200 shadow-sm' :
                    inRange ? 'bg-blue-400 border-2 border-blue-300' :
                    'bg-white border-2 border-gray-300'
                  }`}>
                    {isOrigin && <ArrowRight className="w-2.5 h-2.5 text-white" />}
                    {isDest && <MapPin className="w-2.5 h-2.5 text-white" />}
                    {inRange && !isOrigin && !isDest && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 ${inRange && !isDest ? 'bg-blue-300' : 'bg-gray-200'}`} />
                  )}
                  {isLast && <div className="flex-1" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${isOrigin || isDest ? 'text-gray-900' : 'text-gray-700'}`}>{stop.name}</p>
                    {isOrigin && <span className="px-1.5 py-px bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase">Naik</span>}
                    {isDest && <span className="px-1.5 py-px bg-rose-100 text-rose-700 rounded text-[9px] font-bold uppercase">Turun</span>}
                    {!isOrigin && !isDest && (
                      <div className="flex gap-1">
                        {canBoard && !isLast && <span className="px-1 py-px bg-emerald-50 text-emerald-500 rounded text-[8px] font-medium border border-emerald-100">Pickup</span>}
                        {canAlight && !isFirst && <span className="px-1 py-px bg-rose-50 text-rose-400 rounded text-[8px] font-medium border border-rose-100">Drop</span>}
                        {!canBoard && !canAlight && <span className="px-1 py-px bg-gray-100 text-gray-400 rounded text-[8px] font-medium">Transit</span>}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                    <Clock className="w-3 h-3 inline -mt-px mr-0.5" />
                    {isFirst ? formatTime(stopTime.departAt) : isLast ? formatTime(stopTime.arriveAt) : formatTime(stopTime.arriveAt)}
                    {isFirst && <span className="text-gray-300 ml-1.5">&middot; Keberangkatan</span>}
                    {isLast && <span className="text-gray-300 ml-1.5">&middot; Tujuan akhir</span>}
                  </p>
                </div>

                <div className="flex gap-1.5 flex-shrink-0">
                  {canBoard && !isLast ? (
                    isDest && !isOrigin ? (
                      <span
                        title="Stop ini sudah dipilih sebagai titik turun"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed"
                      >
                        Naik
                      </span>
                    ) : (
                      <button
                        onClick={() => onOriginSelect(stop, stopTime.stopSequence)}
                        data-testid={`naik-${index}`}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          isOrigin
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {isOrigin ? <><Check className="w-3 h-3 inline -mt-px mr-0.5" />Naik</> : 'Naik'}
                      </button>
                    )
                  ) : !isLast ? (
                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed">
                      Naik
                    </span>
                  ) : null}
                  {canAlight && !isFirst ? (
                    isOrigin && !isDest ? (
                      <span
                        title="Stop ini sudah dipilih sebagai titik naik"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed"
                      >
                        Turun
                      </span>
                    ) : (
                      <button
                        onClick={() => onDestinationSelect(stop, stopTime.stopSequence)}
                        data-testid={`turun-${index}`}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          isDest
                            ? 'bg-rose-500 text-white shadow-sm shadow-rose-200'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                      >
                        {isDest ? <><Check className="w-3 h-3 inline -mt-px mr-0.5" />Turun</> : 'Turun'}
                      </button>
                    )
                  ) : !isFirst ? (
                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed">
                      Turun
                    </span>
                  ) : null}
                </div>
              </div>

              {!isLast && legDuration && (
                <div className="flex items-center px-4 py-0">
                  <div className="flex flex-col items-center mr-4 w-5">
                    <div className={`w-0.5 h-6 ${(inRange && !isDest) ? 'bg-blue-300' : 'bg-gray-200'}`} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 -my-1">
                    <span className="flex items-center gap-1"><ArrowDown className="w-2.5 h-2.5" />{formatDuration(legDuration)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedOrigin && selectedDestination && (
        <div className={`bg-white border-2 rounded-xl p-4 shadow-sm ${legCount > 0 ? 'border-blue-200' : 'border-rose-200 bg-rose-50/30'}`}>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Naik</p>
              <p className="text-sm font-bold text-gray-900">{selectedOrigin.name}</p>
              {originIdx >= 0 && (
                <p className="text-[11px] text-gray-400 font-mono">
                  {formatTime(sortedStopTimes[originIdx]?.departAt)}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center gap-1 px-3">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${legCount > 0 ? 'bg-emerald-400' : 'bg-rose-300'}`} />
                <div className={`h-px w-8 ${legCount > 0 ? 'bg-blue-400' : 'bg-rose-300'}`} />
                <div className={`px-2 py-0.5 rounded-full ${legCount > 0 ? 'bg-blue-100' : 'bg-rose-100'}`}>
                  <span className={`text-[10px] font-bold ${legCount > 0 ? 'text-blue-700' : 'text-rose-600'}`}>{legCount} leg</span>
                </div>
                <div className={`h-px w-8 ${legCount > 0 ? 'bg-blue-400' : 'bg-rose-300'}`} />
                <div className={`w-2 h-2 rounded-full ${legCount > 0 ? 'bg-rose-400' : 'bg-rose-300'}`} />
              </div>
            </div>

            <div className="flex-1 text-right">
              <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Turun</p>
              <p className="text-sm font-bold text-gray-900">{selectedDestination.name}</p>
              {destIdx >= 0 && (
                <p className="text-[11px] text-gray-400 font-mono">
                  {formatTime(sortedStopTimes[destIdx]?.arriveAt)}
                </p>
              )}
            </div>
          </div>

          {legCount === 0 && (
            <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
              <span className="text-rose-500 text-sm font-bold">⚠</span>
              <p className="text-xs text-rose-700 font-medium">Titik naik dan turun tidak boleh sama. Pilih stop yang berbeda.</p>
            </div>
          )}

          {onProceed && (
            <button
              onClick={legCount > 0 ? onProceed : undefined}
              disabled={legCount === 0}
              data-testid="btn-proceed-from-route"
              className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 ${
                legCount > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Lanjut Pilih Kursi <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
