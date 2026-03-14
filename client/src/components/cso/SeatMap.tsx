import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { tripsApi, holdsApi } from '@/lib/api';
import { useSeatHold } from '@/hooks/useSeatHold';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AlertTriangle, RotateCcw, Loader2, Car, Users, Timer, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Trip, SeatmapResponse } from '@/types';
import PassengerDetailModal from './PassengerDetailModal';

interface SeatMapProps {
  trip: Trip;
  originSeq: number;
  destinationSeq: number;
  selectedSeats: string[];
  onSeatSelect: (seatNo: string) => void;
  onSeatDeselect: (seatNo: string) => void;
}

export default function SeatMap({
  trip,
  originSeq,
  destinationSeq,
  selectedSeats,
  onSeatSelect,
  onSeatDeselect
}: SeatMapProps) {
  const [localSelectedSeats, setLocalSelectedSeats] = useState<Set<string>>(new Set());
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [selectedSeatForDetails, setSelectedSeatForDetails] = useState<string | null>(null);
  const [seatLoading, setSeatLoading] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const { createHold, releaseHold, getHoldTTL, isHeld } = useSeatHold();
  const { toast } = useToast();
  
  // WebSocket integration
  const { isConnected, subscribeToTrip, unsubscribeFromTrip, addEventListener } = useWebSocket();

  const { data: seatmap, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/trips', trip.id, 'seatmap', originSeq, destinationSeq],
    queryFn: () => tripsApi.getSeatmap(trip.id, originSeq, destinationSeq),
    enabled: !!trip.id && originSeq > 0 && destinationSeq > 0,
    staleTime: 5000
  });

  const passengerDetailsMutation = useMutation({
    mutationFn: ({ tripId, seatNo, originSeq, destinationSeq }: {
      tripId: string;
      seatNo: string;
      originSeq: number;
      destinationSeq: number;
    }) => tripsApi.getSeatPassengerDetails(tripId, seatNo, originSeq, destinationSeq)
  });

  useEffect(() => {
    setLocalSelectedSeats(new Set(selectedSeats));
  }, [selectedSeats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refetch]);

  // WebSocket subscription
  useEffect(() => {
    if (!isConnected || !trip.id) return;
    subscribeToTrip(trip.id);
    return () => unsubscribeFromTrip(trip.id);
  }, [isConnected, trip.id, subscribeToTrip, unsubscribeFromTrip]);

  // WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    const unsubInventory = addEventListener('INVENTORY_UPDATED', (data) => {
      if (data.tripId === trip.id) refetch();
    });

    const unsubStatus = addEventListener('TRIP_STATUS_CHANGED', (data) => {
      if (data.tripId === trip.id) refetch();
    });

    const unsubHolds = addEventListener('HOLDS_RELEASED', (data) => {
      if (data.tripId === trip.id) refetch();
    });

    return () => {
      unsubInventory();
      unsubStatus();
      unsubHolds();
    };
  }, [isConnected, trip.id, addEventListener, refetch]);

  // Release hold directly via API (for seats held by this session or orphaned holds)
  const releaseHoldDirectly = async (holdRef: string, seatNo: string) => {
    try {
      await holdsApi.release(holdRef);
      toast({
        title: "Hold Dilepas",
        description: `Kursi ${seatNo} sekarang tersedia`
      });
      // Refresh seatmap after release
      setTimeout(() => refetch(), 100);
      return true;
    } catch (error) {
      console.error('Failed to release hold:', error);
      toast({
        title: "Gagal Melepas Hold",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
      return false;
    }
  };

  const handleSeatClick = async (seatNo: string) => {
    if (!seatmap || seatLoading) return;

    const seatAvailability = seatmap.seatAvailability[seatNo];
    const isHeldByMe = isHeld(seatNo);
    
    // If seat is booked, show passenger details
    if (!seatAvailability.available && !seatAvailability.held) {
      setSelectedSeatForDetails(seatNo);
      setShowPassengerModal(true);
      passengerDetailsMutation.mutate({ tripId: trip.id, seatNo, originSeq, destinationSeq });
      return;
    }
    
    // If seat is held (yellow) - try to release it
    // Since there's no login yet, we allow releasing any held seat
    if (seatAvailability.held) {
      // Check if it's in our local holds
      if (localSelectedSeats.has(seatNo)) {
        // Release via hook (has holdRef in memory)
        setSeatLoading(seatNo);
        try {
          await releaseHold(seatNo);
          setLocalSelectedSeats(prev => {
            const newSet = new Set(prev);
            newSet.delete(seatNo);
            return newSet;
          });
          onSeatDeselect(seatNo);
          setTimeout(() => refetch(), 100);
        } catch (error) {
          console.error('Failed to release hold via hook:', error);
        } finally {
          setSeatLoading(null);
        }
        return;
      }
      
      // Not in local state - try to release via API using holdRef from server
      if (seatAvailability.holdRef) {
        setSeatLoading(seatNo);
        try {
          const success = await releaseHoldDirectly(seatAvailability.holdRef, seatNo);
          if (success) {
            setLocalSelectedSeats(prev => {
              const newSet = new Set(prev);
              newSet.delete(seatNo);
              return newSet;
            });
            onSeatDeselect(seatNo);
          }
        } finally {
          setSeatLoading(null);
        }
        return;
      }
      
      // No holdRef available - just refresh
      toast({
        title: "Tidak Dapat Melepas",
        description: "Hold tidak valid, memuat ulang...",
        variant: "destructive"
      });
      refetch();
      return;
    }

    // If already selected, deselect and release hold
    if (localSelectedSeats.has(seatNo)) {
      setSeatLoading(seatNo);
      try {
        await releaseHold(seatNo);
        setLocalSelectedSeats(prev => {
          const newSet = new Set(prev);
          newSet.delete(seatNo);
          return newSet;
        });
        onSeatDeselect(seatNo);
        setTimeout(() => refetch(), 100);
      } catch (error) {
        console.error('Failed to release hold:', error);
      } finally {
        setSeatLoading(null);
      }
      return;
    }

    // If held by me but not selected, just select it
    if (isHeldByMe) {
      setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
      onSeatSelect(seatNo);
      return;
    }

    // If available, create hold and select
    setSeatLoading(seatNo);
    try {
      await createHold(trip.id, seatNo, originSeq, destinationSeq, 300);
      setLocalSelectedSeats(prev => new Set(prev).add(seatNo));
      onSeatSelect(seatNo);
      setTimeout(() => refetch(), 100);
    } catch (error) {
      console.error('Failed to hold seat:', error);
      refetch();
    } finally {
      setSeatLoading(null);
    }
  };

  const getSeatClass = (seatNo: string) => {
    if (!seatmap) return 'seat available';
    
    const seatAvailability = seatmap.seatAvailability[seatNo];
    
    // Priority 1: Selected by me (blue)
    if (localSelectedSeats.has(seatNo)) return 'seat selected';
    
    // Priority 2: Held (yellow/amber) - can be clicked to release
    if (seatAvailability.held) return 'seat held';
    
    // Priority 3: Booked (with different colors based on status and type)
    if (!seatAvailability.available) {
      const isPaid = seatAvailability.bookingStatus === 'paid';
      const isMain = seatAvailability.bookedType === 'main';
      
      if (isPaid && isMain) return 'seat booked-paid-main';
      if (isPaid && !isMain) return 'seat booked-paid-transit';
      if (!isPaid && isMain) return 'seat booked-pending-main';
      if (!isPaid && !isMain) return 'seat booked-pending-transit';
      
      return 'seat booked';
    }
    
    return 'seat available';
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

  // Get minimum TTL among selected seats for progress bar
  const getMinTTL = useCallback(() => {
    const ttls = Array.from(localSelectedSeats).map(s => getHoldTTL(s)).filter(t => t > 0);
    return ttls.length > 0 ? Math.min(...ttls) : 0;
  }, [localSelectedSeats, getHoldTTL]);

  const minTTL = getMinTTL();
  const holdProgress = minTTL > 0 ? (minTTL / 300) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Memuat layout kursi...</p>
      </div>
    );
  }

  if (!seatmap) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-3">Gagal memuat layout kursi</p>
        <Button onClick={() => refetch()} size="sm" variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  const seatMapLayout = seatmap.layout.seatMap as any[];
  const availableCount = getAvailableCount();
  const totalSeats = seatMapLayout.length;
  const occupancyPercent = Math.round(((totalSeats - availableCount) / totalSeats) * 100);

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{availableCount}/{totalSeats}</span>
            <span className="text-xs text-muted-foreground">tersedia</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">{occupancyPercent}% terisi</span>
        </div>
        
        <Button 
          onClick={() => refetch()} 
          variant="ghost" 
          size="sm"
          className="h-8 px-2"
          disabled={isRefetching}
        >
          {isRefetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Compact Legend - Two Rows */}
      <div className="space-y-2">
        {/* Row 1: Available, Selected, Held */}
        <div className="flex items-center justify-center gap-3 py-1.5 px-3 bg-muted/30 rounded-lg text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded border-2 border-primary bg-background flex items-center justify-center text-[8px] font-bold text-primary">A</div>
            <span>Tersedia</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-primary flex items-center justify-center text-[8px] font-bold text-white">S</div>
            <span>Dipilih</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center text-[8px] font-bold text-white">H</div>
            <span>Dipegang</span>
          </div>
        </div>
        
        {/* Row 2: Booked states */}
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-muted/20 rounded-lg text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center text-[8px] font-bold text-white">B</div>
            <span>Booking</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-400 flex items-center justify-center text-[8px] font-bold text-white">T</div>
            <span>Book.Trn</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-500 flex items-center justify-center text-[8px] font-bold text-white">P</div>
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-blue-500 flex items-center justify-center text-[8px] font-bold text-white">T</div>
            <span>Paid.Trn</span>
          </div>
        </div>
      </div>

      {/* Bus Front Indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        <Car className="w-4 h-4" />
        <span>Depan</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Seat Grid */}
      <div className="seat-grid mx-auto">
        {seatMapLayout.map(seat => {
          const seatClass = getSeatClass(seat.seat_no);
          const holdTTL = getHoldTTL(seat.seat_no);
          const isLoading = seatLoading === seat.seat_no;
          
          return (
            <button
              key={seat.seat_no}
              className={`${seatClass} ${isLoading ? 'opacity-50' : ''} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`}
              onClick={() => !isLoading && handleSeatClick(seat.seat_no)}
              title={holdTTL > 0 ? `Dipegang - ${formatTTL(holdTTL)} tersisa` : seat.seat_no}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : seat.seat_no}
            </button>
          );
        })}
      </div>

      {/* Selected Seats Panel with Timer */}
      {localSelectedSeats.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Kursi Terpilih</span>
            </div>
            <div className="font-mono text-sm font-bold text-primary">
              {Array.from(localSelectedSeats).sort().join(', ')}
            </div>
          </div>
          
          {/* Timer Progress Bar */}
          {minTTL > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="w-3 h-3" />
                  <span>Waktu pegang</span>
                </div>
                <span className={`font-mono font-medium ${minTTL < 60 ? 'text-destructive' : 'text-primary'}`}>
                  {formatTTL(minTTL)}
                </span>
              </div>
              <Progress 
                value={holdProgress} 
                className={`h-1.5 ${minTTL < 60 ? '[&>div]:bg-destructive' : ''}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
        <span>Auto-refresh {autoRefreshEnabled ? 'aktif' : 'nonaktif'}</span>
        <button 
          onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          className="text-primary hover:underline"
        >
          {autoRefreshEnabled ? 'Matikan' : 'Aktifkan'}
        </button>
      </div>

      {/* Passenger Detail Modal */}
      <PassengerDetailModal
        isOpen={showPassengerModal}
        onClose={() => {
          setShowPassengerModal(false);
          setSelectedSeatForDetails(null);
          passengerDetailsMutation.reset();
        }}
        passengerDetails={passengerDetailsMutation.data}
        isLoading={passengerDetailsMutation.isPending}
        isError={passengerDetailsMutation.isError}
        selectedSeatNo={selectedSeatForDetails}
      />
    </div>
  );
}
