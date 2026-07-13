import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tripsApi, stopsApi, tripPatternsApi } from '@/lib/api';
import {
  Clock, ArrowDown, MapPin, ArrowRight, Check, ChevronRight, Loader2, AlertTriangle
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
  const [lineSegments, setLineSegments] = useState<{ top: number; height: number; color: string }[]>([]);

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

  // Dipakai untuk guard rute pendek dalam-kota (lihat isSameCityBlocked di
  // bawah) — pattern yang belum mengaktifkan allowIntraCityBooking tidak
  // boleh menawarkan kombinasi naik+turun yang sama-sama di kota yang sama
  // (mis. Pasteur -> Dipatiukur pada pola Jakarta-Bandung-Karangayu).
  const { data: patterns = [] } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
  });
  const currentPattern = patterns.find(p => p.id === trip.patternId);
  const allowIntraCityBooking = currentPattern?.allowIntraCityBooking ?? false;

  const getStopException = (stopId: string) => stopExceptions.find(e => e.stopId === stopId);

  const getStopById = (stopId: string) => stops.find(s => s.id === stopId);

  // true kalau memilih `stop` sebagai lawan dari `otherSelected` (naik
  // atau turun, urutan pemilihan bebas) menghasilkan pasangan "sama kota"
  // yang diblokir pattern ini.
  const isSameCityBlocked = (stop: Stop, otherSelected?: Stop) => {
    if (allowIntraCityBooking || !otherSelected) return false;
    if (!stop.city || !otherSelected.city) return false;
    return stop.city === otherSelected.city;
  };

  const sortedStopTimes = useMemo(
    () => [...stopTimes].sort((a, b) => a.stopSequence - b.stopSequence),
    [stopTimes]
  );

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

  // Dipakai bareng oleh kartu ringkasan (desktop + mobile) dan action bar
  // mobile di bawah — dihitung sekali di sini supaya keduanya selalu
  // konsisten (logic tampil/enable tombol TIDAK berubah, cuma dipakai di
  // dua tempat render yang berbeda).
  const originTime = originIdx >= 0 ? formatTime(sortedStopTimes[originIdx]?.departAt) : null;
  const destTime = destIdx >= 0 ? formatTime(sortedStopTimes[destIdx]?.arriveAt) : null;
  const totalDuration = (originIdx >= 0 && destIdx >= 0)
    ? calculateDuration(sortedStopTimes[originIdx]?.departAt, sortedStopTimes[destIdx]?.arriveAt)
    : null;
  const originClosed = selectedOrigin ? getStopException(selectedOrigin.id)?.disableBoarding : false;
  const destClosed = selectedDestination ? getStopException(selectedDestination.id)?.disableAlighting : false;
  const isValid = legCount > 0 && !originClosed && !destClosed;

  const isInSelectedRange = (i: number) => {
    if (originIdx < 0 || destIdx < 0) return false;
    return i >= originIdx && i <= destIdx;
  };

  // Ukur posisi vertikal (center) tiap lingkaran stop secara nyata dari DOM,
  // lalu gambar SATU garis penghubung absolut per segmen antar-stop. Ini
  // menghindari garis "putus-putus" yang muncul kalau tiap baris menggambar
  // separuh garisnya sendiri-sendiri (rawan celah 1px akibat pembulatan
  // sub-pixel di browser mobile / layar retina).
  const lastSegmentsKey = useRef<string>('');
  useLayoutEffect(() => {
    const measure = () => {
      const container = listRef.current;
      if (!container) return;
      const containerTop = container.getBoundingClientRect().top;
      const centers = sortedStopTimes.map((_, i) => {
        const el = circleRefs.current[i];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return Math.round(r.top - containerTop + r.height / 2);
      });
      const segments: { top: number; height: number; color: string }[] = [];
      for (let i = 0; i < centers.length - 1; i++) {
        const top = centers[i];
        const bottom = centers[i + 1];
        if (top == null || bottom == null) continue;
        const segmentInRange = originIdx >= 0 && destIdx >= 0 && i >= originIdx && i + 1 <= destIdx;
        const color = segmentInRange ? 'bg-blue-300' : 'bg-gray-300';
        segments.push({ top, height: bottom - top, color });
      }
      // Rounding + skip-if-unchanged guard: a ResizeObserver observing this
      // same container would otherwise retrigger every time setState causes
      // a (sub-pixel-identical) re-render, producing an infinite update loop.
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

      <div ref={listRef} className="relative bg-white border border-gray-200 rounded-xl overflow-hidden">
        {lineSegments.map((seg, i) => (
          <div
            key={i}
            className={`absolute w-[3px] z-0 ${seg.color}`}
            style={{ left: '25px', top: seg.top, height: seg.height }}
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
          // Stop ini tidak boleh jadi titik NAIK kalau kotanya sama dengan
          // titik turun yang sudah dipilih (dan sebaliknya untuk turun) —
          // guard rute pendek dalam-kota (lihat isSameCityBlocked).
          const blockedByCityAsOrigin = !isDest && isSameCityBlocked(stop, selectedDestination);
          const blockedByCityAsDest = !isOrigin && isSameCityBlocked(stop, selectedOrigin);
          const inRange = isInSelectedRange(index);

          const nextStopTime = sortedStopTimes[index + 1];
          const legDuration = nextStopTime ? calculateDuration(stopTime.departAt, nextStopTime.arriveAt) : null;

          return (
            <div key={stopTime.id}>
              <div className={`flex items-center px-4 py-3 transition-colors ${
                isOrigin ? 'bg-emerald-50' : isDest ? 'bg-rose-50' : inRange ? 'bg-blue-50/40' : 'hover:bg-gray-50'
              }`}>
                <div className="flex flex-col items-center justify-center mr-4 self-stretch">
                  <div
                    ref={(el) => { circleRefs.current[index] = el; }}
                    className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isOrigin ? 'bg-emerald-500 ring-[3px] ring-emerald-200 shadow-sm' :
                      isDest ? 'bg-rose-500 ring-[3px] ring-rose-200 shadow-sm' :
                      inRange ? 'bg-blue-400 border-2 border-blue-300' :
                      'bg-white border-2 border-gray-300'
                    }`}
                  >
                    {isOrigin && <ArrowRight className="w-2.5 h-2.5 text-white" />}
                    {isDest && <MapPin className="w-2.5 h-2.5 text-white" />}
                    {inRange && !isOrigin && !isDest && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm font-semibold ${isOrigin || isDest ? 'text-gray-900' : 'text-gray-700'}`}>{stop.name}</p>
                    <div className="flex gap-1">
                      {!isLast && stopTime.effectiveBoardingAllowed !== false && (
                        isOrigin ? (
                          <span className="inline-block px-1.5 py-0.5 rounded leading-none text-[9px] font-bold uppercase bg-emerald-500 text-white">Naik</span>
                        ) : boardingClosed ? (
                          <span className="inline-block px-1.5 py-0.5 rounded leading-none text-[9px] font-bold uppercase bg-amber-50 text-amber-500 line-through">Naik</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded leading-none text-[9px] font-bold uppercase bg-emerald-50 text-emerald-600">Naik</span>
                        )
                      )}
                      {!isFirst && stopTime.effectiveAlightingAllowed !== false && (
                        isDest ? (
                          <span className="inline-block px-1.5 py-0.5 rounded leading-none text-[9px] font-bold uppercase bg-rose-500 text-white">Turun</span>
                        ) : alightingClosed ? (
                          <span className="inline-block px-1.5 py-0.5 rounded leading-none text-[9px] font-bold uppercase bg-amber-50 text-amber-500 line-through">Turun</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded leading-none text-[9px] font-bold uppercase bg-rose-50 text-rose-500">Turun</span>
                        )
                      )}
                      {!isFirst && !isLast && stopTime.effectiveBoardingAllowed === false && stopTime.effectiveAlightingAllowed === false && (
                        <span className="inline-block px-1.5 py-0.5 rounded leading-none text-[9px] font-bold uppercase bg-gray-100 text-gray-400">Transit</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    <Clock className="w-3 h-3 inline -mt-px mr-0.5" />
                    {isFirst
                      ? formatTime(stopTime.departAt)
                      : isLast
                      ? formatTime(stopTime.arriveAt)
                      : !canBoard && canAlight
                      ? formatTime(stopTime.arriveAt)
                      : formatTime(stopTime.departAt ?? stopTime.arriveAt)}
                    {isFirst && <span className="text-gray-300 ml-1.5">&middot; Keberangkatan</span>}
                    {isLast && <span className="text-gray-300 ml-1.5">&middot; Tujuan akhir</span>}
                    {!isFirst && !isLast && canBoard && stopTime.arriveAt && stopTime.departAt && stopTime.arriveAt !== stopTime.departAt && (
                      <span className="text-gray-300 ml-1.5">&middot; Berangkat</span>
                    )}
                  </p>
                  {stopEx && (
                    <div className="flex items-center gap-1 mt-1">
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

                <div className="flex gap-1.5 flex-shrink-0">
                  {canBoard && !isLast ? (
                    isDest && !isOrigin ? (
                      <span
                        title="Stop ini sudah dipilih sebagai titik turun"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed"
                      >
                        Naik
                      </span>
                    ) : blockedByCityAsOrigin ? (
                      <span
                        title={`Rute dalam kota ${stop.city} tidak dijual untuk pola ini`}
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
                    ) : blockedByCityAsDest ? (
                      <span
                        title={`Rute dalam kota ${stop.city} tidak dijual untuk pola ini`}
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
                <div className="flex px-4 py-2">
                  <div className="w-5 mr-4 flex-shrink-0" />
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <ArrowDown className="w-3 h-3" />
                    <span>{formatDuration(legDuration)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
                <span className="text-rose-500 text-sm font-bold">⚠</span>
                <p className="text-xs text-rose-700 font-medium">
                  {originClosed || destClosed
                    ? 'Titik yang dipilih sedang ditutup oleh operasional. Pilih stop lain.'
                    : 'Titik naik dan turun tidak boleh sama. Pilih stop yang berbeda.'}
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

    {/* Mobile: action bar flex-shrink-0, sibling di luar area scroll di atas
        (bukan sticky) — jadi selalu nempel di bawah panel tanpa perlu
        scroll dulu. Logic tampil/enable-nya identik dengan tombol desktop:
        butuh onProceed + selectedOrigin + selectedDestination, disabled
        kalau !isValid. */}
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
