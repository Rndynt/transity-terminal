import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tripsApi, stopsApi, tripPatternsApi, priceRulesApi } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { queryClient } from '@/lib/queryClient';
import {
  Clock, MapPin, ArrowRight, Check, ChevronRight, Loader2, AlertTriangle
} from 'lucide-react';
import type { Trip, Stop } from '@/types';

type EffectiveStopTime = {
  id: string;
  tripId: string;
  stopId: string;
  stopSequence: number;
  arriveAt: string | null;
  departAt: string | null;
  dwellSeconds: number;
  boardingAllowed: boolean | null;
  alightingAllowed: boolean | null;
  tripBoardingAllowed: boolean | null;
  tripAlightingAllowed: boolean | null;
  effectiveBoardingAllowed: boolean;
  effectiveAlightingAllowed: boolean;
};

type StopException = {
  id: string;
  stopId: string;
  disableBoarding: boolean;
  disableAlighting: boolean;
  reason: string | null;
};

interface RouteTimelineProps {
  trip: Trip;
  selectedOrigin?: Stop;
  selectedDestination?: Stop;
  onOriginSelect: (stop: Stop, sequence: number) => void;
  onDestinationSelect: (stop: Stop, sequence: number) => void;
  onProceed?: () => void;
  initialOriginStopId?: string;
  initialDestinationStopId?: string;
  onInitialRouteConsumed?: () => void;
}

const formatTime = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return '--:--';
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
  } catch { return '--:--'; }
};

/** Format waktu dengan titik sebagai separator, misal "15.00" */
const formatTimeDot = (timestamp: string | Date | null | undefined): string => {
  const t = formatTime(timestamp);
  return t === '--:--' ? '--' : t.replace(':', '.');
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
  onProceed,
  initialOriginStopId,
  initialDestinationStopId,
  onInitialRouteConsumed
}: RouteTimelineProps) {
  const autoSelectDone = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const circleRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [lineSegments, setLineSegments] = useState<{ top: number; height: number; isFirst: boolean }[]>([]);
  // horizontal center of the timeline dots — computed in layout effect
  const lineLeftRef = useRef(35);

  const { data: stopTimes = [], isLoading } = useQuery<EffectiveStopTime[]>({
    queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'],
    queryFn: () => tripsApi.getStopTimesWithEffectiveFlags(trip.id),
    enabled: !!trip.id
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const { data: stopExceptions = [] } = useQuery<StopException[]>({
    queryKey: ['/api/scheduler/stop-exceptions', trip.baseId, trip.serviceDate],
    queryFn: async () => {
      const res = await fetch(`/api/scheduler/stop-exceptions?baseId=${trip.baseId}&date=${trip.serviceDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(trip.baseId && trip.serviceDate),
    staleTime: 30_000,
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
  });
  const currentPattern = patterns.find(p => p.id === trip.patternId);
  const allowIntraCityBooking = currentPattern?.allowIntraCityBooking ?? false;

  const isRealTripId = !!trip.id && !trip.id.startsWith('virtual-');

  const { data: pricedMatrix = {}, isSuccess: pricedMatrixLoaded } = useQuery<Record<string, Record<string, number>>>({
    queryKey: ['/api/pricing/trip-matrix', trip.id],
    queryFn: () => priceRulesApi.getTripPricedMatrix(trip.id),
    enabled: isRealTripId,
    refetchOnWindowFocus: true,
  });

  const { isConnected: wsConnected, addEventListener } = useWebSocket();
  useEffect(() => {
    if (!wsConnected) return;
    return addEventListener('PRICE_RULES_CHANGED', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/trip-matrix'] });
    });
  }, [wsConnected, addEventListener]);

  const isOdPriced = (originStopId: string, destinationStopId: string) =>
    pricedMatrixLoaded && (pricedMatrix[originStopId]?.[destinationStopId] ?? 0) > 0;

  const getStopException = (stopId: string) => stopExceptions.find(e => e.stopId === stopId);

  const getStopById = (stopId: string) => stops.find(s => s.id === stopId);

  const isSameCityBlocked = (stop: Stop, otherSelected?: Stop) => {
    if (allowIntraCityBooking || !otherSelected) return false;
    if (!stop.city || !otherSelected.city) return false;
    return stop.city === otherSelected.city;
  };

  const sortedStopTimes = useMemo(
    () => [...stopTimes].sort((a, b) => a.stopSequence - b.stopSequence),
    [stopTimes]
  );

  const stopsWithNoPricedDestination = useMemo(() => {
    if (!pricedMatrixLoaded) return new Set<string>();
    const withDest = new Set(Object.keys(pricedMatrix));
    return new Set(sortedStopTimes.map(st => st.stopId).filter(id => !withDest.has(id)));
  }, [pricedMatrix, pricedMatrixLoaded, sortedStopTimes]);

  const stopsWithNoPricedOrigin = useMemo(() => {
    if (!pricedMatrixLoaded) return new Set<string>();
    const withOrigin = new Set<string>();
    for (const destinations of Object.values(pricedMatrix)) {
      for (const destinationStopId of Object.keys(destinations)) withOrigin.add(destinationStopId);
    }
    return new Set(sortedStopTimes.map(st => st.stopId).filter(id => !withOrigin.has(id)));
  }, [pricedMatrix, pricedMatrixLoaded, sortedStopTimes]);

  useEffect(() => {
    if (autoSelectDone.current) return;
    if (!initialOriginStopId || !initialDestinationStopId) return;
    if (sortedStopTimes.length === 0 || stops.length === 0) return;

    const originSt = sortedStopTimes.find(st => st.stopId === initialOriginStopId);
    const destSt = sortedStopTimes.find(st => st.stopId === initialDestinationStopId);
    const originStop = originSt ? getStopById(originSt.stopId) : undefined;
    const destStop = destSt ? getStopById(destSt.stopId) : undefined;

    if (originStop && destStop && originSt && destSt) {
      const originEx = getStopException(originStop.id);
      const destEx = getStopException(destStop.id);
      if (originEx?.disableBoarding || destEx?.disableAlighting) {
        autoSelectDone.current = true;
        onInitialRouteConsumed?.();
        return;
      }
      autoSelectDone.current = true;
      onOriginSelect(originStop, originSt.stopSequence);
      const timer = setTimeout(() => {
        onDestinationSelect(destStop, destSt.stopSequence);
        onInitialRouteConsumed?.();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [sortedStopTimes, stops, initialOriginStopId, initialDestinationStopId, stopExceptions]);

  const originIdx = selectedOrigin ? sortedStopTimes.findIndex(st => st.stopId === selectedOrigin.id) : -1;
  const destIdx = selectedDestination ? sortedStopTimes.findIndex(st => st.stopId === selectedDestination.id) : -1;
  const legCount = originIdx >= 0 && destIdx > originIdx ? destIdx - originIdx : 0;

  const originTime = originIdx >= 0 ? formatTime(sortedStopTimes[originIdx]?.departAt) : null;
  const destTime = destIdx >= 0 ? formatTime(sortedStopTimes[destIdx]?.arriveAt) : null;
  const totalDuration = (originIdx >= 0 && destIdx >= 0)
    ? calculateDuration(sortedStopTimes[originIdx]?.departAt, sortedStopTimes[destIdx]?.arriveAt)
    : null;
  const originClosed = selectedOrigin ? getStopException(selectedOrigin.id)?.disableBoarding : false;
  const destClosed = selectedDestination ? getStopException(selectedDestination.id)?.disableAlighting : false;
  const originDestUnpriced = !!(selectedOrigin && selectedDestination && legCount > 0
    && !isOdPriced(selectedOrigin.id, selectedDestination.id));
  const pricingStillLoading = !!(selectedOrigin && selectedDestination && legCount > 0 && !pricedMatrixLoaded);
  const isValid = legCount > 0 && !originClosed && !destClosed && !originDestUnpriced && pricedMatrixLoaded;

  const isInSelectedRange = (i: number) => {
    if (originIdx < 0 || destIdx < 0) return false;
    return i >= originIdx && i <= destIdx;
  };

  const lastSegmentsKey = useRef<string>('');
  useLayoutEffect(() => {
    const measure = () => {
      const container = listRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const centers = sortedStopTimes.map((_, i) => {
        const el = circleRefs.current[i];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return Math.round(r.top - containerRect.top + r.height / 2);
      });
      // compute horizontal center from first circle
      const firstEl = circleRefs.current[0];
      if (firstEl) {
        const r = firstEl.getBoundingClientRect();
        lineLeftRef.current = Math.round(r.left - containerRect.left + r.width / 2) - 1;
      }
      const segments: { top: number; height: number; isFirst: boolean }[] = [];
      for (let i = 0; i < centers.length - 1; i++) {
        const top = centers[i];
        const bottom = centers[i + 1];
        if (top == null || bottom == null) continue;
        segments.push({ top, height: bottom - top, isFirst: i === 0 });
      }
      const key = JSON.stringify(segments);
      if (key === lastSegmentsKey.current) return;
      lastSegmentsKey.current = key;
      setLineSegments(segments);
    };

    measure();
    const container = listRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [sortedStopTimes, selectedOrigin, selectedDestination, stopExceptions, stops, originIdx, destIdx]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
        <p className="text-xs text-gray-400">Memuat rute...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-0.5">Pilih Rute</h3>
          <p className="text-[11px] text-gray-400">Tentukan titik naik dan turun penumpang</p>
        </div>

        {/* ── Timeline list ── */}
        <div ref={listRef} className="relative bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">

          {/* Connector lines — absolute, one per segment */}
          {lineSegments.map((seg, i) => (
            <div
              key={i}
              className="absolute z-0 w-[2px]"
              style={{
                left: `${lineLeftRef.current}px`,
                top: seg.top,
                height: seg.height,
                // First segment: solid blue line; rest: dashed gray
                ...(seg.isFirst
                  ? { backgroundColor: '#2563eb' }
                  : {
                      backgroundImage:
                        'repeating-linear-gradient(to bottom, #d1d5db 0, #d1d5db 5px, transparent 5px, transparent 10px)',
                    }),
              }}
            />
          ))}

          {sortedStopTimes.map((stopTime, index) => {
            const stop = getStopById(stopTime.stopId);
            if (!stop) return null;

            const isFirst = index === 0;
            const isLast = index === sortedStopTimes.length - 1;
            const isOrigin = selectedOrigin?.id === stop.id;
            const isDest = selectedDestination?.id === stop.id;
            const stopEx = getStopException(stop.id);
            const boardingClosed = stopEx?.disableBoarding === true;
            const alightingClosed = stopEx?.disableAlighting === true;
            const canBoard = stopTime.effectiveBoardingAllowed !== false && !boardingClosed;
            const canAlight = stopTime.effectiveAlightingAllowed !== false && !alightingClosed;
            const blockedByCityAsOrigin = !isDest && isSameCityBlocked(stop, selectedDestination);
            const blockedByCityAsDest = !isOrigin && isSameCityBlocked(stop, selectedOrigin);
            const notPricedAsOrigin = !isDest && (
              selectedDestination ? !isOdPriced(stop.id, selectedDestination.id) : stopsWithNoPricedDestination.has(stop.id)
            );
            const notPricedAsDest = !isOrigin && (
              selectedOrigin ? !isOdPriced(selectedOrigin.id, stop.id) : stopsWithNoPricedOrigin.has(stop.id)
            );
            const inRange = isInSelectedRange(index);

            // Leg duration ke stop berikutnya
            const nextStopTime = sortedStopTimes[index + 1];
            const legDuration = !isLast && nextStopTime
              ? calculateDuration(stopTime.departAt, nextStopTime.arriveAt)
              : null;

            // Waktu tampil untuk stop ini
            const timeDisplay = isFirst
              ? formatTimeDot(stopTime.departAt)
              : isLast
              ? formatTimeDot(stopTime.arriveAt)
              : (!canBoard && canAlight)
              ? formatTimeDot(stopTime.arriveAt)
              : formatTimeDot(stopTime.departAt ?? stopTime.arriveAt);

            /* ── Naik badge/button states ── */
            const naikVisible = !isLast && stopTime.effectiveBoardingAllowed !== false;
            const naikClickable = naikVisible && !isDest && !blockedByCityAsOrigin && !boardingClosed && pricedMatrixLoaded && !notPricedAsOrigin;
            const naikLoading = naikVisible && !isDest && !blockedByCityAsOrigin && !boardingClosed && !pricedMatrixLoaded;
            const naikBlocked = naikVisible && !isDest && (boardingClosed || blockedByCityAsOrigin || (pricedMatrixLoaded && notPricedAsOrigin));
            const naikIsDest = naikVisible && isDest;

            /* ── Turun badge/button states ── */
            const turunVisible = !isFirst && stopTime.effectiveAlightingAllowed !== false;
            const turunClickable = turunVisible && !isOrigin && !blockedByCityAsDest && !alightingClosed && pricedMatrixLoaded && !notPricedAsDest;
            const turunLoading = turunVisible && !isOrigin && !blockedByCityAsDest && !alightingClosed && !pricedMatrixLoaded;
            const turunBlocked = turunVisible && !isOrigin && (alightingClosed || blockedByCityAsDest || (pricedMatrixLoaded && notPricedAsDest));
            const turunIsOrigin = turunVisible && isOrigin;

            return (
              <div
                key={stopTime.id}
                className={`relative flex items-start px-5 py-4 transition-colors ${
                  isOrigin || isDest ? 'bg-blue-50/40' : inRange ? 'bg-blue-50/20' : ''
                }`}
              >
                {/* ── Timeline dot ── */}
                <div
                  ref={(el) => { circleRefs.current[index] = el; }}
                  className="flex-shrink-0 mr-4 mt-0.5 z-10"
                >
                  {isFirst ? (
                    /* First stop: filled blue circle with white inner circle (radio style) */
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-sm">
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                  ) : isLast ? (
                    /* Last stop: blue map pin */
                    <div className="w-8 h-8 flex items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-7 h-7"
                        fill="#2563eb"
                        stroke="white"
                        strokeWidth="1.2"
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" fill="white" stroke="none" />
                      </svg>
                    </div>
                  ) : (
                    /* Middle stop: hollow circle */
                    <div
                      className={`w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center ${
                        inRange ? 'border-blue-400' : 'border-gray-300'
                      }`}
                    >
                      {inRange && <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />}
                    </div>
                  )}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 min-w-0">
                  {/* Main row: time + stop name + badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xl font-bold text-gray-900 tabular-nums leading-none min-w-[3.8rem]">
                      {timeDisplay}
                    </span>
                    <span className={`text-[15px] font-semibold leading-none ${
                      isOrigin || isDest ? 'text-blue-900' : 'text-gray-800'
                    }`}>
                      {stop.name}
                    </span>

                    {/* NAIK badge */}
                    {naikVisible && (
                      naikIsDest ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-300 cursor-not-allowed" title="Stop ini sudah dipilih sebagai titik turun">
                          NAIK
                        </span>
                      ) : naikBlocked ? (
                        <span
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-300 cursor-not-allowed"
                          title={notPricedAsOrigin ? 'Belum ada harga untuk titik ini' : blockedByCityAsOrigin ? `Rute dalam kota ${stop.city} tidak dijual` : 'Ditutup operasional'}
                        >
                          {(pricedMatrixLoaded && notPricedAsOrigin) && <AlertTriangle className="w-2.5 h-2.5 text-red-300" />}
                          NAIK
                        </span>
                      ) : naikLoading ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-400 cursor-wait">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />NAIK
                        </span>
                      ) : naikClickable ? (
                        <button
                          onClick={() => onOriginSelect(stop, stopTime.stopSequence)}
                          data-testid={`naik-${index}`}
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            isOrigin
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {isOrigin && <Check className="w-2.5 h-2.5" />}
                          NAIK
                        </button>
                      ) : null
                    )}

                    {/* TURUN badge */}
                    {turunVisible && (
                      turunIsOrigin ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-300 cursor-not-allowed" title="Stop ini sudah dipilih sebagai titik naik">
                          TURUN
                        </span>
                      ) : turunBlocked ? (
                        <span
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-300 cursor-not-allowed"
                          title={notPricedAsDest ? 'Belum ada harga untuk titik ini' : blockedByCityAsDest ? `Rute dalam kota ${stop.city} tidak dijual` : 'Ditutup operasional'}
                        >
                          {(pricedMatrixLoaded && notPricedAsDest) && <AlertTriangle className="w-2.5 h-2.5 text-red-300" />}
                          TURUN
                        </span>
                      ) : turunLoading ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-400 cursor-wait">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />TURUN
                        </span>
                      ) : turunClickable ? (
                        <button
                          onClick={() => onDestinationSelect(stop, stopTime.stopSequence)}
                          data-testid={`turun-${index}`}
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            isDest
                              ? 'bg-rose-500 text-white shadow-sm'
                              : 'bg-rose-50 text-rose-500 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {isDest && <Check className="w-2.5 h-2.5" />}
                          TURUN
                        </button>
                      ) : null
                    )}

                    {/* Transit only (no board, no alight) */}
                    {!isFirst && !isLast && stopTime.effectiveBoardingAllowed === false && stopTime.effectiveAlightingAllowed === false && (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-400">TRANSIT</span>
                    )}
                  </div>

                  {/* Sub-row: clock + duration, pin + keberangkatan/tujuan */}
                  <div className="flex items-center gap-4 mt-1.5">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>{isLast ? '-' : legDuration ? `±${formatDuration(legDuration)}` : '-'}</span>
                    </div>
                    {isFirst && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span>Keberangkatan</span>
                      </div>
                    )}
                    {isLast && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span>Tujuan akhir</span>
                      </div>
                    )}
                  </div>

                  {/* Stop exception warning */}
                  {stopEx && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-600 font-medium">
                        Ditutup Ops
                        {boardingClosed && !alightingClosed && ' (Naik)'}
                        {alightingClosed && !boardingClosed && ' (Turun)'}
                        {boardingClosed && alightingClosed && ' (Naik & Turun)'}
                      </span>
                      {stopEx.reason && (
                        <span className="text-xs text-amber-400 ml-0.5">— {stopEx.reason}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Summary card (origin → destination) ── */}
        {selectedOrigin && selectedDestination && (
          <div className={`rounded-xl overflow-hidden shadow-sm border-2 ${isValid ? 'border-blue-200' : 'border-rose-200'}`}>
            <div className={`px-4 py-3 ${isValid ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-rose-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Naik</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{selectedOrigin.name}</p>
                  {originTime && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{originTime}</p>
                  )}
                </div>

                <div className="flex flex-col items-center pt-1 px-1 flex-shrink-0">
                  {totalDuration && totalDuration > 0 && (
                    <span className="text-sm font-bold text-gray-800">{formatDuration(totalDuration)}</span>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`h-[2px] w-5 ${isValid ? 'bg-blue-300' : 'bg-rose-300'}`} />
                    <ArrowRight className={`w-3.5 h-3.5 ${isValid ? 'text-blue-500' : 'text-rose-500'}`} />
                    <div className={`h-[2px] w-5 ${isValid ? 'bg-blue-300' : 'bg-rose-300'}`} />
                  </div>
                  <span className="text-xs text-gray-400 mt-1">{legCount} pemberhentian</span>
                </div>

                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Turun</span>
                    <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{selectedDestination.name}</p>
                  {destTime && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{destTime}</p>
                  )}
                </div>
              </div>
            </div>

            {!isValid && (
              <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 flex items-center gap-2">
                {pricingStillLoading ? (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-semibold flex-shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin" />Memuat Harga
                  </span>
                ) : originDestUnpriced ? (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-semibold flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" />Belum Ada Harga
                  </span>
                ) : (
                  <span className="text-rose-500 text-sm font-bold">⚠</span>
                )}
                <p className="text-xs text-rose-700 font-medium">
                  {originClosed || destClosed
                    ? 'Titik yang dipilih sedang ditutup oleh operasional. Pilih stop lain.'
                    : legCount <= 0
                    ? 'Titik naik dan turun tidak boleh sama. Pilih stop yang berbeda.'
                    : pricingStillLoading
                    ? 'Sedang memuat data harga untuk rute ini…'
                    : 'Rute ini belum memiliki harga. Pilih titik naik atau turun yang lain.'}
                </p>
              </div>
            )}

            {onProceed && (
              <button
                onClick={isValid ? onProceed : undefined}
                disabled={!isValid}
                data-testid="btn-proceed-from-route"
                className={`hidden md:flex w-full py-3 text-sm font-bold transition-all items-center justify-center gap-2 ${
                  isValid
                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Lanjut Pilih Kursi <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile: action bar sticky di bawah panel */}
      {selectedOrigin && selectedDestination && onProceed && (
        <div className="md:hidden flex-shrink-0 border-t border-gray-200 bg-white -mx-3 -mb-3 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={isValid ? onProceed : undefined}
            disabled={!isValid}
            data-testid="btn-proceed-from-route-mobile"
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              isValid
                ? 'bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800 shadow-lg shadow-blue-600/20'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Lanjut Pilih Kursi <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
