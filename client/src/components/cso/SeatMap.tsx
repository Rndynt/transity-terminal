import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tripsApi, holdsApi, passengersApi } from '@/lib/api';
import { useSeatHold } from '@/hooks/useSeatHold';
import { useWebSocket } from '@/hooks/useWebSocket';
import { RotateCcw, Loader2, Bus, Timer, CheckCircle2, AlertTriangle, Users, Settings2, Armchair, X, User, ChevronDown, ChevronUp, UserX, CalendarClock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import type { Trip, SeatmapResponse } from '@/types';
import PassengerDetailModal from './PassengerDetailModal';
import { apiRequest } from '@/lib/queryClient';
import { usePermissions } from '@/lib/permissions';


export interface AssignModeState {
  passengerId: string;
  passengerName: string;
  ticketNumber: string | null;
  bookingCode: string;
}

export interface RescheduleModeState {
  passengerId: string;
  passengerName: string;
  ticketNumber: string | null;
  bookingCode: string;
  seatNo: string;
  originStopName: string;
  destinationStopName: string;
  reason: string;
}

interface SeatMapProps {
  trip: Trip;
  originSeq: number;
  destinationSeq: number;
  selectedSeats: string[];
  onSeatSelect: (seatNo: string) => void;
  onSeatDeselect: (seatNo: string) => void;
  isPastTrip?: boolean;
  externalAssignMode?: AssignModeState | null;
  onAssignModeChange?: (mode: AssignModeState | null) => void;
  rescheduleMode?: RescheduleModeState | null;
  onRescheduleComplete?: () => void;
  onStartReschedule?: (info: RescheduleModeState) => void;
  originStopId?: string;
  destinationStopId?: string;
}

export default function SeatMap({
  trip,
  originSeq,
  destinationSeq,
  selectedSeats,
  onSeatSelect,
  onSeatDeselect,
  isPastTrip = false,
  externalAssignMode = null,
  onAssignModeChange,
  rescheduleMode = null,
  onRescheduleComplete,
  onStartReschedule,
  originStopId,
  destinationStopId
}: SeatMapProps) {
  const [localSelectedSeats, setLocalSelectedSeats] = useState<Set<string>>(new Set());
  const [pendingReleases, setPendingReleases] = useState<Set<string>>(new Set());
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [selectedSeatForDetails, setSelectedSeatForDetails] = useState<string | null>(null);
  const [seatLoading, setSeatLoading] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [precomputing, setPrecomputing] = useState(false);
  const [internalAssignMode, setInternalAssignMode] = useState<AssignModeState | null>(null);
  const assignMode = externalAssignMode || internalAssignMode;
  const setAssignMode = (mode: AssignModeState | null) => {
    if (onAssignModeChange) {
      onAssignModeChange(mode);
    }
    setInternalAssignMode(mode);
  };
  const { toast } = useToast();
  const { can } = usePermissions();
  const refetchRef = useRef<() => void>(() => {});

  const assignSeatMutation = useMutation({
    mutationFn: ({ passengerId, newSeatNo }: { passengerId: string; newSeatNo: string }) =>
      passengersApi.assignSeat(passengerId, newSeatNo),
    onSuccess: (_data, variables) => {
      toast({ title: 'Berhasil', description: `Penumpang berhasil di-assign ke kursi ${variables.newSeatNo}.` });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setAssignMode(null);
      refetch();
      refetchUnseated();
    },
    onError: (e: Error) => {
      toast({ title: 'Gagal Assign Kursi', description: e.message, variant: 'destructive' });
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ passengerId, newSeatNo }: { passengerId: string; newSeatNo: string }) =>
      passengersApi.reschedule(passengerId, {
        newTripId: trip.id,
        newSeatNo,
        newOriginStopId: originStopId!,
        newDestinationStopId: destinationStopId!,
        newOriginSeq: originSeq,
        newDestinationSeq: destinationSeq,
        reason: rescheduleMode?.reason
      }),
    onSuccess: (_data, variables) => {
      toast({ title: 'Berhasil', description: `Penumpang berhasil di-reschedule ke kursi ${variables.newSeatNo}.` });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      refetch();
      refetchUnseated();
      onRescheduleComplete?.();
    },
    onError: (e: Error) => {
      toast({ title: 'Gagal Reschedule', description: e.message, variant: 'destructive' });
    }
  });

  const handleHoldExpired = useCallback((seatNo: string) => {
    setLocalSelectedSeats(prev => {
      const n = new Set(prev);
      n.delete(seatNo);
      return n;
    });
    onSeatDeselect(seatNo);
  }, [onSeatDeselect]);

  const { createHold, releaseHold, getHoldTTL, getInitialTTL, isHeld } = useSeatHold(handleHoldExpired);

  const { isConnected, subscribeToTrip, unsubscribeFromTrip, addEventListener } = useWebSocket();

  const [unseatedOpen, setUnseatedOpen] = useState(true);

  const { data: seatmap, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/trips', trip.id, 'seatmap', originSeq, destinationSeq],
    queryFn: () => tripsApi.getSeatmap(trip.id, originSeq, destinationSeq),
    enabled: !!trip.id && originSeq > 0 && destinationSeq > 0,
    staleTime: 2000
  });

  const { data: unseatedPassengers = [], refetch: refetchUnseated } = useQuery<any[]>({
    queryKey: ['/api/trips', trip.id, 'unseated-passengers'],
    queryFn: () => tripsApi.getUnseatedPassengers(trip.id),
    enabled: !!trip.id,
    staleTime: 5000,
    refetchInterval: isConnected ? false : 5000
  });

  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  const passengerDetailsMutation = useMutation({
    mutationFn: ({ tripId, seatNo, originSeq, destinationSeq }: {
      tripId: string; seatNo: string; originSeq: number; destinationSeq: number;
    }) => tripsApi.getSeatPassengerDetails(tripId, seatNo, originSeq, destinationSeq)
  });

  useEffect(() => { setLocalSelectedSeats(new Set(selectedSeats)); }, [selectedSeats]);

  useEffect(() => {
    setPendingReleases(new Set());
    setSeatLoading(new Set());
  }, [trip.id, originSeq, destinationSeq]);

  useEffect(() => {
    if (!seatmap) return;
    setPendingReleases(prev => {
      if (prev.size === 0) return prev;
      const stillPending = new Set<string>();
      prev.forEach(seatNo => {
        const sa = seatmap.seatAvailability[seatNo];
        if (sa?.held) stillPending.add(seatNo);
      });
      return stillPending.size === prev.size ? prev : stillPending;
    });
  }, [seatmap]);

  useEffect(() => {
    if (!autoRefreshEnabled || isConnected) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, isConnected, refetch]);

  useEffect(() => {
    if (!isConnected || !trip.id) return;
    subscribeToTrip(trip.id);
    return () => unsubscribeFromTrip(trip.id);
  }, [isConnected, trip.id, subscribeToTrip, unsubscribeFromTrip]);

  const debouncedRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefetch = useCallback(() => {
    if (debouncedRefetchRef.current) clearTimeout(debouncedRefetchRef.current);
    debouncedRefetchRef.current = setTimeout(() => {
      refetchRef.current?.();
      debouncedRefetchRef.current = null;
    }, 500);
  }, []);

  useEffect(() => {
    return () => { if (debouncedRefetchRef.current) clearTimeout(debouncedRefetchRef.current); };
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const unsubInventory = addEventListener('INVENTORY_UPDATED', (data) => { if (data.tripId === trip.id) debouncedRefetch(); });
    const unsubStatus = addEventListener('TRIP_STATUS_CHANGED', (data) => { if (data.tripId === trip.id) debouncedRefetch(); });
    const unsubHolds = addEventListener('HOLDS_RELEASED', (data) => { if (data.tripId === trip.id) debouncedRefetch(); });
    return () => { unsubInventory(); unsubStatus(); unsubHolds(); };
  }, [isConnected, trip.id, addEventListener, debouncedRefetch]);

  const handlePrecompute = async () => {
    setPrecomputing(true);
    try {
      await apiRequest('POST', `/api/trips/${trip.id}/precompute-seat-inventory`);
      toast({ title: 'Inventori Berhasil Diinisialisasi', description: 'Klik kursi sekarang sudah bisa dilakukan.' });
      await refetch();
    } catch {
      toast({ title: 'Gagal Inisialisasi', description: 'Coba lagi atau hubungi administrator.', variant: 'destructive' });
    } finally {
      setPrecomputing(false);
    }
  };

  const releaseHoldDirectly = async (holdRef: string, seatNo: string) => {
    try {
      await holdsApi.release(holdRef);
      toast({ title: "Hold Dilepas", description: `Kursi ${seatNo} sekarang tersedia` });
      return true;
    } catch (error) {
      toast({ title: "Gagal Melepas Hold", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
      return false;
    }
  };

  const isSeatLoading = useCallback((seatNo: string) => seatLoading.has(seatNo), [seatLoading]);
  const startSeatLoading = useCallback((seatNo: string) => setSeatLoading(prev => new Set(prev).add(seatNo)), []);
  const stopSeatLoading = useCallback((seatNo: string) => setSeatLoading(prev => { const n = new Set(prev); n.delete(seatNo); return n; }), []);

  const handleSeatClick = async (seatNo: string) => {
    if (!seatmap || seatLoading.has(seatNo)) return;
    const seatAvailability = seatmap.seatAvailability[seatNo];
    const isHeldByMe = isHeld(seatNo);

    if (rescheduleMode) {
      if (!seatAvailability.available) {
        toast({ title: 'Kursi Tidak Tersedia', description: `Kursi ${seatNo} sudah terisi atau sedang dipegang. Pilih kursi yang tersedia.`, variant: 'destructive' });
        return;
      }
      if (!originStopId || !destinationStopId) {
        toast({ title: 'Data Tidak Lengkap', description: 'Origin/destination stop belum dipilih.', variant: 'destructive' });
        return;
      }
      rescheduleMutation.mutate({ passengerId: rescheduleMode.passengerId, newSeatNo: seatNo });
      return;
    }

    if (assignMode) {
      if (isPastTrip) {
        toast({ title: 'Tidak Bisa Assign', description: 'Jadwal sudah lewat. Tidak bisa assign kursi.', variant: 'destructive' });
        setAssignMode(null);
        return;
      }
      if (!seatAvailability.available) {
        toast({ title: 'Kursi Tidak Tersedia', description: `Kursi ${seatNo} sudah terisi atau sedang dipegang. Pilih kursi yang tersedia.`, variant: 'destructive' });
        return;
      }
      assignSeatMutation.mutate({ passengerId: assignMode.passengerId, newSeatNo: seatNo });
      return;
    }

    if (!seatAvailability.available && !seatAvailability.held && !pendingReleases.has(seatNo)) {
      setSelectedSeatForDetails(seatNo);
      setShowPassengerModal(true);
      passengerDetailsMutation.mutate({ tripId: trip.id, seatNo, originSeq, destinationSeq });
      return;
    }

    if (isPastTrip) {
      return;
    }

    if (seatAvailability.held && !pendingReleases.has(seatNo)) {
      if (localSelectedSeats.has(seatNo)) {
        startSeatLoading(seatNo);
        setLocalSelectedSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
        setPendingReleases(prev => new Set(prev).add(seatNo));
        onSeatDeselect(seatNo);
        try {
          const success = await releaseHold(seatNo);
          if (!success) {
            setPendingReleases(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
            setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
            onSeatSelect(seatNo);
          } else {
            debouncedRefetch();
          }
        } catch (error) {
          console.error('Failed to release hold:', error);
          setPendingReleases(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
          setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
          onSeatSelect(seatNo);
        }
        finally { stopSeatLoading(seatNo); }
        return;
      }
      if (seatAvailability.holdRef) {
        startSeatLoading(seatNo);
        setPendingReleases(prev => new Set(prev).add(seatNo));
        try {
          const success = await releaseHoldDirectly(seatAvailability.holdRef, seatNo);
          if (success) {
            setLocalSelectedSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
            onSeatDeselect(seatNo);
            debouncedRefetch();
          } else {
            setPendingReleases(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
          }
        } finally { stopSeatLoading(seatNo); }
        return;
      }
      toast({ title: "Tidak Dapat Melepas", description: "Hold tidak valid, memuat ulang...", variant: "destructive" });
      refetch();
      return;
    }

    if (localSelectedSeats.has(seatNo)) {
      startSeatLoading(seatNo);
      setLocalSelectedSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
      setPendingReleases(prev => new Set(prev).add(seatNo));
      onSeatDeselect(seatNo);
      try {
        const success = await releaseHold(seatNo);
        if (!success) {
          setPendingReleases(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
          setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
          onSeatSelect(seatNo);
        } else {
          debouncedRefetch();
        }
      } catch (error) {
        console.error('Failed to release hold:', error);
        setPendingReleases(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
        setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
        onSeatSelect(seatNo);
      }
      finally { stopSeatLoading(seatNo); }
      return;
    }

    if (isHeldByMe) {
      setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
      onSeatSelect(seatNo);
      return;
    }

    startSeatLoading(seatNo);
    setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
    setPendingReleases(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
    onSeatSelect(seatNo);
    try {
      await createHold(trip.id, seatNo, originSeq, destinationSeq, 300);
      debouncedRefetch();
    } catch (error) {
      console.error('Failed to hold seat:', error);
      setLocalSelectedSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
      onSeatDeselect(seatNo);
    } finally { stopSeatLoading(seatNo); }
  };

  const isPickingMode = !!(assignMode || rescheduleMode);

  const getSeatStatus = (seatNo: string) => {
    if (!seatmap) return 'available';
    if (localSelectedSeats.has(seatNo)) return isPickingMode ? 'blocked' : 'selected';
    if (pendingReleases.has(seatNo)) {
      if (isPickingMode) return rescheduleMode ? 'reschedule-available' : 'assign-available';
      return isPastTrip ? 'past-locked' : 'available';
    }
    const sa = seatmap.seatAvailability[seatNo];
    if (sa.held) return isPastTrip ? 'past-locked' : (isPickingMode ? 'blocked' : 'held');
    if (!sa.available) return isPickingMode ? 'blocked' : 'booked';
    if (isPickingMode) return rescheduleMode ? 'reschedule-available' : 'assign-available';
    return isPastTrip ? 'past-locked' : 'available';
  };

  const seatColors: Record<string, string> = {
    available: 'bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 cursor-pointer',
    selected: 'bg-blue-500 border-blue-500 text-white shadow-md cursor-pointer',
    booked: 'bg-red-100 border-red-200 text-red-300 cursor-pointer',
    held: 'bg-amber-100 border-amber-300 text-amber-600 cursor-pointer',
    'past-locked': 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed',
    'assign-available': 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100 hover:border-amber-500 cursor-pointer ring-1 ring-amber-300 animate-pulse',
    'reschedule-available': 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100 hover:border-amber-500 cursor-pointer ring-1 ring-amber-300 animate-pulse',
    'blocked': 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-50',
  };

  const getAvailableCount = () => {
    if (!seatmap) return 0;
    return Object.values(seatmap.seatAvailability).filter(seat => seat.available).length;
  };

  const formatTTL = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getMinTTL = useCallback(() => {
    const ttls = Array.from(localSelectedSeats).map(s => getHoldTTL(s)).filter(t => t > 0);
    return ttls.length > 0 ? Math.min(...ttls) : 0;
  }, [localSelectedSeats, getHoldTTL]);

  const minTTL = getMinTTL();

  // Initial TTL of whichever selected seat has the minimum remaining TTL —
  // used as the progress bar's divider instead of a hardcoded 300s, so a
  // long-hold (e.g. 1800s) doesn't overflow past 100%. Falls back to 300
  // via getInitialTTL() when no hold is found.
  const getMinTTLInitial = useCallback(() => {
    let minRemaining = Infinity;
    let initialForMin = 300;
    for (const s of Array.from(localSelectedSeats)) {
      const remaining = getHoldTTL(s);
      if (remaining > 0 && remaining < minRemaining) {
        minRemaining = remaining;
        initialForMin = getInitialTTL(s);
      }
    }
    return initialForMin;
  }, [localSelectedSeats, getHoldTTL, getInitialTTL]);

  const minTTLInitial = getMinTTLInitial();

  const seatMapLayout = seatmap?.layout?.seatMap as any[] | undefined;

  const { gridCols, seatGrid } = useMemo(() => {
    if (!seatMapLayout || seatMapLayout.length === 0) {
      return { gridCols: 1, seatGrid: [] as (any | null)[][] };
    }
    const minc = Math.min(...seatMapLayout.map((s: any) => s.col));
    const mc = Math.max(...seatMapLayout.map((s: any) => s.col));
    const minr = Math.min(...seatMapLayout.map((s: any) => s.row));
    const mr = Math.max(...seatMapLayout.map((s: any) => s.row));
    const cols = mc - minc + 1;
    const grid: (any | null)[][] = [];
    for (let r = minr; r <= mr; r++) {
      const row: (any | null)[] = [];
      for (let c = minc; c <= mc; c++) {
        row.push(null);
      }
      grid.push(row);
    }
    seatMapLayout.forEach((seat: any) => {
      grid[seat.row - minr][seat.col - minc] = seat;
    });
    return { gridCols: cols, seatGrid: grid };
  }, [seatMapLayout]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-400">Memuat layout kursi...</p>
      </div>
    );
  }

  if (!seatmap || !seatMapLayout) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-gray-400 mb-3">Gagal memuat layout kursi</p>
        <button onClick={() => refetch()} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1.5" data-testid="button-retry-seatmap">
          <RotateCcw className="w-3.5 h-3.5" /> Coba Lagi
        </button>
      </div>
    );
  }

  const availableCount = getAvailableCount();
  const totalSeats = seatMapLayout.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Pilih Kursi</h3>
          <p className="text-[11px] text-gray-400">{availableCount}/{totalSeats} tersedia</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-1.5 rounded-lg bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          data-testid="btn-refresh-seats"
        >
          {isRefetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!(seatmap as any).inventoryInitialized && !isPastTrip && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Inventori kursi belum disiapkan</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Hubungi administrator untuk mengaktifkan kursi pada jadwal ini.</p>
          </div>
          {can('action.inventory.initialize') && (
            <button
              onClick={handlePrecompute}
              disabled={precomputing}
              data-testid="btn-precompute-inventory"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white text-[11px] font-semibold rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0 disabled:opacity-60"
            >
              {precomputing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Settings2 className="w-3 h-3" />}
              {precomputing ? 'Memproses...' : 'Inisialisasi'}
            </button>
          )}
        </div>
      )}

      {assignSeatMutation.isPending && (
        <div className="flex items-center gap-2 text-xs text-amber-700 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Memproses assign kursi...</span>
        </div>
      )}

      {rescheduleMutation.isPending && (
        <div className="flex items-center gap-2 text-xs text-amber-700 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Memproses reschedule...</span>
        </div>
      )}

      {isPastTrip && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <p className="text-xs text-orange-700 font-medium">Jadwal sudah lewat — kursi kosong tidak bisa dipilih. Klik kursi terisi untuk lihat detail penumpang.</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 py-1.5 px-3 bg-gray-50 rounded-lg flex-wrap">
        {rescheduleMode ? (
          <>
            <LegendDot color="bg-amber-50 border-amber-400 ring-1 ring-amber-300" label="Tersedia (klik reschedule)" />
            <LegendDot color="bg-gray-100 border-gray-200 opacity-50" label="Tidak tersedia" />
          </>
        ) : assignMode ? (
          <>
            <LegendDot color="bg-amber-50 border-amber-400 ring-1 ring-amber-300" label="Tersedia (klik assign)" />
            <LegendDot color="bg-gray-100 border-gray-200 opacity-50" label="Tidak tersedia" />
          </>
        ) : isPastTrip ? (
          <>
            <LegendDot color="bg-gray-100 border-gray-200" label="Terkunci" />
            <LegendDot color="bg-red-100 border-red-200" label="Terisi (klik detail)" />
            <LegendMultiSeat />
          </>
        ) : (
          <>
            <LegendDot color="bg-white border-gray-300" label="Tersedia" />
            <LegendDot color="bg-blue-500 border-blue-500" label="Dipilih" />
            <LegendDot color="bg-amber-100 border-amber-300" label="Dipegang" />
            <LegendDot color="bg-red-100 border-red-200" label="Terisi" />
            <LegendMultiSeat />
          </>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col items-center gap-3">
        <div className="w-full flex items-center gap-2 text-[10px] text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          <Bus className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wider">Depan</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="w-full flex justify-center">
          <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${gridCols}, 2.75rem)` }}>
            {seatGrid.flatMap((row, ri) =>
              row.map((seat, ci) => {
                if (seat === null) return <div key={`gap-${ri}-${ci}`} className="w-11 h-11" />;
                const status = getSeatStatus(seat.seat_no);
                const holdTTL = getHoldTTL(seat.seat_no);
                const isMultiSeat = !!(seatmap?.seatAvailability[seat.seat_no]?.isMultiSeat);
                const showTTL = holdTTL > 0 && (status === 'held' || status === 'selected');
                return (
                  <div key={seat.seat_no} className="relative w-11 h-11">
                    <button
                      onClick={() => !isSeatLoading(seat.seat_no) && !assignSeatMutation.isPending && !rescheduleMutation.isPending && handleSeatClick(seat.seat_no)}
                      disabled={isSeatLoading(seat.seat_no) || assignSeatMutation.isPending || rescheduleMutation.isPending || status === 'blocked'}
                      data-testid={`seat-${seat.seat_no}`}
                      className={`w-11 h-11 rounded-lg border text-xs font-bold font-mono transition-all duration-100 flex items-center justify-center ${seatColors[status]} ${isSeatLoading(seat.seat_no) ? 'opacity-50' : ''}`}
                    >
                      {isSeatLoading(seat.seat_no) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : seat.seat_no}
                    </button>
                    {showTTL && (
                      <span className={`absolute -top-1.5 -right-1.5 px-1 py-px rounded text-[7px] font-mono font-bold z-10 ${
                        status === 'selected'
                          ? (holdTTL < 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-700 text-white')
                          : (holdTTL < 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-400 text-amber-900')
                      }`}>{formatTTL(holdTTL)}</span>
                    )}
                    {isMultiSeat && status === 'booked' && (
                      <span
                        title="Multi-Penumpang: kursi ini dipakai oleh lebih dari 1 penumpang pada rute berbeda"
                        className="absolute top-0.5 right-0.5 z-10 pointer-events-none"
                        data-testid={`multi-seat-badge-${seat.seat_no}`}
                      >
                        <Users className="w-2.5 h-2.5 text-orange-500" />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="w-full flex items-center gap-2 text-[10px] text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="font-semibold uppercase tracking-wider">Belakang</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      </div>

      {localSelectedSeats.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-gray-700">Terpilih</span>
            </div>
            <div className="flex gap-1">
              {Array.from(localSelectedSeats).sort().map(s => (
                <span key={s} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-mono font-bold">{s}</span>
              ))}
            </div>
          </div>
          {minTTL > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-gray-500"><Timer className="w-3 h-3" />Hold</span>
                <span className="font-mono font-bold text-blue-600">{formatTTL(minTTL)}</span>
              </div>
              <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, (minTTL / minTTLInitial) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {unseatedPassengers.length > 0 && !assignMode && !rescheduleMode && (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 overflow-hidden">
          <button
            onClick={() => setUnseatedOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-orange-100/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <UserX className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-orange-800">Penumpang Tanpa Kursi</p>
                <p className="text-[10px] text-orange-600">{unseatedPassengers.length} penumpang perlu assign kursi</p>
              </div>
            </div>
            {unseatedOpen ? <ChevronUp className="w-4 h-4 text-orange-400" /> : <ChevronDown className="w-4 h-4 text-orange-400" />}
          </button>
          {unseatedOpen && (
            <div className="px-3 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
              {isPastTrip && (
                <p className="text-[10px] text-orange-600 italic px-1">Jadwal sudah lewat — assign kursi tidak tersedia.</p>
              )}
              {unseatedPassengers.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-2 bg-white rounded-lg border border-orange-200">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{p.fullName}</p>
                    <p className="text-[10px] text-gray-500">
                      <span className="font-mono">{p.bookingCode}</span>
                      {p.originStopName && p.destinationStopName && (
                        <> · {p.originStopName} → {p.destinationStopName}</>
                      )}
                    </p>
                  </div>
                  {!isPastTrip && (
                    <button
                      onClick={() => {
                        setAssignMode({
                          passengerId: p.id,
                          passengerName: p.fullName,
                          ticketNumber: p.ticketNumber || null,
                          bookingCode: p.bookingCode,
                        });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold rounded-lg transition-colors flex-shrink-0"
                      data-testid={`btn-assign-unseated-${p.id}`}
                    >
                      <Armchair className="w-3 h-3" />
                      Assign
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PassengerDetailModal
        isOpen={showPassengerModal}
        onClose={() => { setShowPassengerModal(false); setSelectedSeatForDetails(null); passengerDetailsMutation.reset(); }}
        passengerDetails={passengerDetailsMutation.data}
        isLoading={passengerDetailsMutation.isPending}
        isError={passengerDetailsMutation.isError}
        selectedSeatNo={selectedSeatForDetails}
        tripId={trip.id}
        onStartAssignMode={(passenger) => {
          setAssignMode({
            passengerId: passenger.id,
            passengerName: passenger.name,
            ticketNumber: passenger.ticketNumber,
            bookingCode: passenger.bookingCode,
          });
          setShowPassengerModal(false);
          setSelectedSeatForDetails(null);
          passengerDetailsMutation.reset();
        }}
        onStartRescheduleMode={onStartReschedule ? (passenger) => {
          setShowPassengerModal(false);
          setSelectedSeatForDetails(null);
          passengerDetailsMutation.reset();
          onStartReschedule({
            passengerId: passenger.id,
            passengerName: passenger.name,
            ticketNumber: passenger.ticketNumber,
            bookingCode: passenger.bookingCode,
            seatNo: passenger.seatNo,
            originStopName: passenger.originStopName,
            destinationStopName: passenger.destinationStopName,
            reason: passenger.reason,
          });
        } : undefined}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-3 h-3 rounded border ${color}`} />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

function LegendMultiSeat() {
  return (
    <div className="flex items-center gap-1">
      <div className="relative w-3 h-3 flex-shrink-0">
        <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
        <Users className="w-2 h-2 text-orange-500 absolute -top-0.5 -right-0.5" />
      </div>
      <span className="text-[10px] text-gray-500">Multi-Penumpang</span>
    </div>
  );
}
