import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tripsApi, holdsApi } from '@/lib/api';
import { useSeatHold } from '@/hooks/useSeatHold';
import { useWebSocket } from '@/hooks/useWebSocket';
import { RotateCcw, Loader2, Bus, Timer, CheckCircle2, AlertTriangle, Users, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Trip, SeatmapResponse } from '@/types';
import PassengerDetailModal from './PassengerDetailModal';
import { apiRequest } from '@/lib/queryClient';

interface SeatMapProps {
  trip: Trip;
  originSeq: number;
  destinationSeq: number;
  selectedSeats: string[];
  onSeatSelect: (seatNo: string) => void;
  onSeatDeselect: (seatNo: string) => void;
  isPastTrip?: boolean;
}

export default function SeatMap({
  trip,
  originSeq,
  destinationSeq,
  selectedSeats,
  onSeatSelect,
  onSeatDeselect,
  isPastTrip = false
}: SeatMapProps) {
  const [localSelectedSeats, setLocalSelectedSeats] = useState<Set<string>>(new Set());
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [selectedSeatForDetails, setSelectedSeatForDetails] = useState<string | null>(null);
  const [seatLoading, setSeatLoading] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [precomputing, setPrecomputing] = useState(false);
  const { createHold, releaseHold, getHoldTTL, isHeld } = useSeatHold();
  const { toast } = useToast();

  const { isConnected, subscribeToTrip, unsubscribeFromTrip, addEventListener } = useWebSocket();

  const { data: seatmap, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/trips', trip.id, 'seatmap', originSeq, destinationSeq],
    queryFn: () => tripsApi.getSeatmap(trip.id, originSeq, destinationSeq),
    enabled: !!trip.id && originSeq > 0 && destinationSeq > 0,
    staleTime: 5000
  });

  const passengerDetailsMutation = useMutation({
    mutationFn: ({ tripId, seatNo, originSeq, destinationSeq }: {
      tripId: string; seatNo: string; originSeq: number; destinationSeq: number;
    }) => tripsApi.getSeatPassengerDetails(tripId, seatNo, originSeq, destinationSeq)
  });

  useEffect(() => { setLocalSelectedSeats(new Set(selectedSeats)); }, [selectedSeats]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => refetch(), 30000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refetch]);

  useEffect(() => {
    if (!isConnected || !trip.id) return;
    subscribeToTrip(trip.id);
    return () => unsubscribeFromTrip(trip.id);
  }, [isConnected, trip.id, subscribeToTrip, unsubscribeFromTrip]);

  useEffect(() => {
    if (!isConnected) return;
    const unsubInventory = addEventListener('INVENTORY_UPDATED', (data) => { if (data.tripId === trip.id) refetch(); });
    const unsubStatus = addEventListener('TRIP_STATUS_CHANGED', (data) => { if (data.tripId === trip.id) refetch(); });
    const unsubHolds = addEventListener('HOLDS_RELEASED', (data) => { if (data.tripId === trip.id) refetch(); });
    return () => { unsubInventory(); unsubStatus(); unsubHolds(); };
  }, [isConnected, trip.id, addEventListener, refetch]);

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
      setTimeout(() => refetch(), 100);
      return true;
    } catch (error) {
      toast({ title: "Gagal Melepas Hold", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
      return false;
    }
  };

  const handleSeatClick = async (seatNo: string) => {
    if (!seatmap || seatLoading) return;
    const seatAvailability = seatmap.seatAvailability[seatNo];
    const isHeldByMe = isHeld(seatNo);

    if (!seatAvailability.available && !seatAvailability.held) {
      setSelectedSeatForDetails(seatNo);
      setShowPassengerModal(true);
      passengerDetailsMutation.mutate({ tripId: trip.id, seatNo, originSeq, destinationSeq });
      return;
    }

    if (isPastTrip) {
      return;
    }

    if (seatAvailability.held) {
      if (localSelectedSeats.has(seatNo)) {
        setSeatLoading(seatNo);
        try {
          await releaseHold(seatNo);
          setLocalSelectedSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
          onSeatDeselect(seatNo);
          setTimeout(() => refetch(), 100);
        } catch (error) { console.error('Failed to release hold:', error); }
        finally { setSeatLoading(null); }
        return;
      }
      if (seatAvailability.holdRef) {
        setSeatLoading(seatNo);
        try {
          const success = await releaseHoldDirectly(seatAvailability.holdRef, seatNo);
          if (success) {
            setLocalSelectedSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
            onSeatDeselect(seatNo);
          }
        } finally { setSeatLoading(null); }
        return;
      }
      toast({ title: "Tidak Dapat Melepas", description: "Hold tidak valid, memuat ulang...", variant: "destructive" });
      refetch();
      return;
    }

    if (localSelectedSeats.has(seatNo)) {
      setSeatLoading(seatNo);
      try {
        await releaseHold(seatNo);
        setLocalSelectedSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
        onSeatDeselect(seatNo);
        setTimeout(() => refetch(), 100);
      } catch (error) { console.error('Failed to release hold:', error); }
      finally { setSeatLoading(null); }
      return;
    }

    if (isHeldByMe) {
      setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
      onSeatSelect(seatNo);
      return;
    }

    setSeatLoading(seatNo);
    try {
      await createHold(trip.id, seatNo, originSeq, destinationSeq, 300);
      setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
      onSeatSelect(seatNo);
      setTimeout(() => refetch(), 100);
    } catch (error) {
      console.error('Failed to hold seat:', error);
      refetch();
    } finally { setSeatLoading(null); }
  };

  const getSeatStatus = (seatNo: string) => {
    if (!seatmap) return 'available';
    if (localSelectedSeats.has(seatNo)) return 'selected';
    const sa = seatmap.seatAvailability[seatNo];
    if (sa.held) return isPastTrip ? 'past-locked' : 'held';
    if (!sa.available) return 'booked';
    return isPastTrip ? 'past-locked' : 'available';
  };

  const seatColors: Record<string, string> = {
    available: 'bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 cursor-pointer',
    selected: 'bg-blue-500 border-blue-500 text-white shadow-md cursor-pointer',
    booked: 'bg-red-100 border-red-200 text-red-300 cursor-pointer',
    held: 'bg-amber-100 border-amber-300 text-amber-600 cursor-pointer',
    'past-locked': 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed',
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-400">Memuat layout kursi...</p>
      </div>
    );
  }

  if (!seatmap) {
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

  const seatMapLayout = seatmap.layout.seatMap as any[];
  const availableCount = getAvailableCount();
  const totalSeats = seatMapLayout.length;

  const maxCol = Math.max(...seatMapLayout.map((s: any) => s.col));
  const maxRow = Math.max(...seatMapLayout.map((s: any) => s.row));
  const gridCols = maxCol + 1;

  const seatGrid: (any | null)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    seatGrid[r] = [];
    for (let c = 0; c <= maxCol; c++) {
      seatGrid[r][c] = null;
    }
  }
  seatMapLayout.forEach((seat: any) => {
    seatGrid[seat.row][seat.col] = seat;
  });

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
            <p className="text-[11px] text-amber-700 mt-0.5">Kursi tidak bisa dipilih sebelum inventori diinisialisasi.</p>
          </div>
          <button
            onClick={handlePrecompute}
            disabled={precomputing}
            data-testid="btn-precompute-inventory"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white text-[11px] font-semibold rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0 disabled:opacity-60"
          >
            {precomputing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Settings2 className="w-3 h-3" />}
            {precomputing ? 'Memproses...' : 'Inisialisasi'}
          </button>
        </div>
      )}

      {isPastTrip && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <p className="text-xs text-orange-700 font-medium">Jadwal sudah lewat — kursi kosong tidak bisa dipilih. Klik kursi terisi untuk lihat detail penumpang.</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 py-1.5 px-3 bg-gray-50 rounded-lg flex-wrap">
        {isPastTrip ? (
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

        <div className="flex flex-col gap-1 w-fit mx-auto">
          {seatGrid.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.map((seat, ci) => {
                if (seat === null) return <div key={`gap-${ri}-${ci}`} className="w-9 h-9" />;
                const status = getSeatStatus(seat.seat_no);
                const holdTTL = getHoldTTL(seat.seat_no);
                const isLoading = seatLoading === seat.seat_no;
                const isMultiSeat = !!(seatmap?.seatAvailability[seat.seat_no]?.isMultiSeat);
                return (
                  <div key={seat.seat_no} className="relative w-9 h-9">
                    <button
                      onClick={() => !isLoading && handleSeatClick(seat.seat_no)}
                      disabled={isLoading}
                      data-testid={`seat-${seat.seat_no}`}
                      className={`w-9 h-9 rounded-lg border text-[10px] font-bold font-mono transition-all duration-100 flex items-center justify-center ${seatColors[status]} ${isLoading ? 'opacity-50' : ''}`}
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : seat.seat_no}
                    </button>
                    {status === 'held' && holdTTL > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 px-1 py-px rounded text-[7px] font-mono font-bold z-10 ${
                        holdTTL < 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-400 text-amber-900'
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
              })}
            </div>
          ))}
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
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(minTTL / 300) * 100}%` }} />
              </div>
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
      <div className="relative w-5 h-5 flex-shrink-0">
        <div className="w-5 h-5 rounded bg-red-100 border border-red-200" />
        <Users className="w-2.5 h-2.5 text-orange-500 absolute top-0.5 right-0.5" />
      </div>
      <span className="text-[10px] text-gray-500">Multi-Penumpang</span>
    </div>
  );
}
