import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tripsApi, stopsApi, tripPatternsApi, priceRulesApi } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { queryClient } from '@/lib/queryClient';
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

const formatTimeDot = (timestamp: string | Date | null | undefined): string => {
  const t = formatTime(timestamp);
  return t === '--:--' ? '--.--' : t.replace(':', '.');
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

  // A CSO-selectable trip can be a not-yet-materialized "virtual-<baseId>"
  // placeholder (see getCsoAvailableTrips / AppService's virtual trips) that
  // has no row in `trips` yet. getPricedMatrixForTrip resolves via
  // storage.getTripById(tripId) — for a virtual id that lookup finds
  // nothing and the endpoint returns `{}` as a "successful" empty matrix,
  // which would make every OD on that trip look unpriced (or, under the old
  // fail-open gate, every OD look priced). Only ever query the matrix for a
  // real, materialized trip id; for a virtual id the gate below stays
  // fail-closed (matrix never "loads") until the trip is materialized.
  const isRealTripId = !!trip.id && !trip.id.startsWith('virtual-');

  // OD-aware pricing gate: same exception-accurate matrix the App API
  // exposes on trip detail (GET /api/app/trips/:id `pricedMatrix`),
  // fetched here from its CSO-facing sibling endpoint — CSO uses session
  // auth and can't call the App API directly, so this hits
  // PriceRulesService.getPricedMatrixForTrip instead, which delegates to
  // the SAME buildPricedMatrix. Used below to grey out Naik/Turun
  // combinations that would form an unpriced OD, so a CSO can never reach
  // the booking call that would otherwise 422 on NO_PRICE_RULE.
  const { data: pricedMatrix = {}, isSuccess: pricedMatrixLoaded } = useQuery<Record<string, Record<string, number>>>({
    queryKey: ['/api/pricing/trip-matrix', trip.id],
    queryFn: () => priceRulesApi.getTripPricedMatrix(trip.id),
    enabled: isRealTripId,
    // Fallback for when the PRICE_RULES_CHANGED websocket push (below) was
    // missed (socket briefly disconnected) — re-check on refocus so an
    // admin's price change is picked up next time the CSO looks back at
    // this tab, without requiring a full manual page refresh.
    refetchOnWindowFocus: true,
  });

  // Master Data price-rule edits (Aturan Harga: pattern matrix, global
  // fallback, or a per-trip exception) used to only reach an already-open
  // CSO tab on manual browser refresh, because pricedMatrix above is a
  // plain react-query fetch with no invalidation trigger. Mirrors the same
  // useWebSocket + invalidate pattern SeatMap.tsx already uses for seat
  // inventory. Broad prefix invalidate (no exact tripId filter) — cheap,
  // and correct even for a global-fallback or another pattern's edit that
  // could still affect this trip's resolver precedence.
  const { isConnected: wsConnected, addEventListener } = useWebSocket();
  useEffect(() => {
    if (!wsConnected) return;
    return addEventListener('PRICE_RULES_CHANGED', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/trip-matrix'] });
    });
  }, [wsConnected, addEventListener]);

  // true kalau originStopId -> destinationStopId ADA di pricedMatrix dengan
  // harga > 0. FAIL-CLOSED: sebelumnya fail-open (anggap priced) selagi
  // query belum selesai, yang membuka jendela balapan di mana OD yang belum
  // berharga tetap bisa dipilih sebelum matrix datang. Sekarang pasangan
  // hanya dianggap priced kalau matrix SUDAH sukses dimuat DAN benar-benar
  // punya harga > 0 untuk pasangan itu — selagi masih memuat (atau query
  // di-disable karena trip masih virtual), semua pasangan dianggap BELUM
  // priced. 422 dari server tetap jadi penjaga terakhir kalau ada balapan.
  const isOdPriced = (originStopId: string, destinationStopId: string) =>
    pricedMatrixLoaded && (pricedMatrix[originStopId]?.[destinationStopId] ?? 0) > 0;

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

  // Dipakai saat BELUM ada titik naik/turun yang dipilih sama sekali: stop
  // yang sama sekali tidak muncul sebagai origin manapun, atau tidak
  // pernah muncul sebagai destination manapun, di pricedMatrix — grey-out
  // preemptif sebelum CSO sempat mencoba memilihnya.
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
  // legCount > 0 guard: kalau origin/dest sama stop (leg tidak valid), itu
  // sudah pesan error tersendiri di bawah — jangan tumpang tindih dengan
  // pesan "Belum Ada Harga" (pricedMatrix memang tidak pernah punya entry
  // stop->dirinya sendiri, jadi tanpa guard ini originDestUnpriced bisa
  // salah ke-true untuk kasus itu juga).
  const originDestUnpriced = !!(selectedOrigin && selectedDestination && legCount > 0
    && !isOdPriced(selectedOrigin.id, selectedDestination.id));
  // Dipakai untuk membedakan "masih menunggu matrix" dari "sudah dikonfirmasi
  // belum ada harga" di badge/pesan ringkasan rute — supaya rute yang
  // sebenarnya priced tidak sekejap terlihat seperti error saat matrix masih
  // di-fetch.
  const pricingStillLoading = !!(selectedOrigin && selectedDestination && legCount > 0 && !pricedMatrixLoaded);
  const isValid = legCount > 0 && !originClosed && !destClosed && !originDestUnpriced && pricedMatrixLoaded;

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
    <div className="flex-1 overflow-y-auto space-y-6">
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
          // OD-aware "Belum Ada Harga" gate, mirroring blockedByCityAsOrigin/
          // Dest exactly: kalau lawan pasangannya sudah dipilih, cek pasangan
          // spesifik itu; kalau belum ada yang dipilih sama sekali, cek
          // apakah stop ini SECARA TOTAL tidak pernah punya OD berharga ke
          // arah manapun (preemptive grey-out).
          const notPricedAsOrigin = !isDest && (
            selectedDestination ? !isOdPriced(stop.id, selectedDestination.id) : stopsWithNoPricedDestination.has(stop.id)
          );
          const notPricedAsDest = !isOrigin && (
            selectedOrigin ? !isOdPriced(selectedOrigin.id, stop.id) : stopsWithNoPricedOrigin.has(stop.id)
          );
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
                  {/* Baris 1: jam bold · nama stop · badge status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold tabular-nums text-gray-900">
                      {isFirst
                        ? formatTimeDot(stopTime.departAt)
                        : isLast
                        ? formatTimeDot(stopTime.arriveAt)
                        : !canBoard && canAlight
                        ? formatTimeDot(stopTime.arriveAt)
                        : formatTimeDot(stopTime.departAt ?? stopTime.arriveAt)}
                    </span>
                    <span className={`text-sm font-semibold pl-3 ${isOrigin || isDest ? 'text-gray-900' : 'text-gray-700'}`}>{stop.name}</span>
                    <div className="flex gap-1">
                      {!isLast && stopTime.effectiveBoardingAllowed !== false && (
                        isOrigin ? (
                          <span className="inline-block px-1.5 py-0.5 rounded border border-emerald-500 leading-none text-[9px] font-bold uppercase bg-emerald-500 text-white">NAIK</span>
                        ) : boardingClosed ? (
                          <span className="inline-block px-1.5 py-0.5 rounded border border-amber-300 leading-none text-[9px] font-bold uppercase text-amber-400 line-through">NAIK</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded border border-emerald-400 leading-none text-[9px] font-bold uppercase text-emerald-600">NAIK</span>
                        )
                      )}
                      {!isFirst && stopTime.effectiveAlightingAllowed !== false && (
                        isDest ? (
                          <span className="inline-block px-1.5 py-0.5 rounded border border-rose-500 leading-none text-[9px] font-bold uppercase bg-rose-500 text-white">TURUN</span>
                        ) : alightingClosed ? (
                          <span className="inline-block px-1.5 py-0.5 rounded border border-amber-300 leading-none text-[9px] font-bold uppercase text-amber-400 line-through">TURUN</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded border border-rose-400 leading-none text-[9px] font-bold uppercase text-rose-500">TURUN</span>
                        )
                      )}
                      {!isFirst && !isLast && stopTime.effectiveBoardingAllowed === false && stopTime.effectiveAlightingAllowed === false && (
                        <span className="inline-block px-1.5 py-0.5 rounded border border-gray-300 leading-none text-[9px] font-bold uppercase text-gray-400">TRANSIT</span>
                      )}
                    </div>
                  </div>
                  {/* Baris 2: clock ±durasi · pin label (hanya stop pertama & terakhir) */}
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    {!isLast && (
                      <>
                        {/* <Clock className="w-3 h-3 flex-shrink-0" />*/}
                        <span>{legDuration ? `${formatDuration(legDuration)}` : '-'}</span>
                      </>
                    )}
                    {(isFirst || isLast) && (
                      <>
                        {!isLast && <span className="text-gray-300 mx-0.5">·</span>}
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span>{isFirst ? 'Keberangkatan' : 'Tujuan akhir'}</span>
                      </>
                    )}
                  </div>
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
                    ) : !pricedMatrixLoaded ? (
                      <span
                        title="Memuat data harga…"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-wait inline-flex items-center gap-1"
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />Naik
                      </span>
                    ) : notPricedAsOrigin ? (
                      <span
                        title="Belum Ada Harga — kombinasi titik naik & turun ini belum diisi harga"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 border border-red-100 text-red-300 cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />Naik
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
                    ) : !pricedMatrixLoaded ? (
                      <span
                        title="Memuat data harga…"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-300 cursor-wait inline-flex items-center gap-1"
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />Turun
                      </span>
                    ) : notPricedAsDest ? (
                      <span
                        title="Belum Ada Harga — kombinasi titik naik & turun ini belum diisi harga"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 border border-red-100 text-red-300 cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />Turun
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
