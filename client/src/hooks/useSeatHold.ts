import { useState, useCallback, useRef, useEffect } from 'react';
import { holdsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SeatHold {
  holdRef: string;
  seatNo: string;
  expiresAt: number;
  tripId: string;
  originSeq: number;
  destinationSeq: number;
}

export function useSeatHold() {
  const [holds, setHolds] = useState<Map<string, SeatHold>>(new Map());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();
  // Use a ref to store holds for immediate access
  const holdsRef = useRef<Map<string, SeatHold>>(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    holdsRef.current = holds;
  }, [holds]);

  // Start TTL countdown for all holds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      setHolds(currentHolds => {
        const newHolds = new Map(currentHolds);
        let hasChanges = false;

        const expiredSeats = Array.from(newHolds.entries()).filter(([seatNo, hold]) => hold.expiresAt <= now);
        for (const [seatNo] of expiredSeats) {
          newHolds.delete(seatNo);
          hasChanges = true;
          toast({
            title: "Hold Expired",
            description: `Seat ${seatNo} hold has expired`,
            variant: "destructive"
          });
        }

        return hasChanges ? newHolds : currentHolds;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [toast]);

  const createHold = useCallback(async (
    tripId: string,
    seatNo: string,
    originSeq: number,
    destinationSeq: number,
    ttlSeconds: number = 120
  ) => {
    setLoading(true);
    try {
      const response = await holdsApi.create({
        tripId,
        seatNo,
        originSeq,
        destinationSeq,
        ttlSeconds
      });

      // Handle idempotent response
      if (response.holdRef) {
        // New hold created successfully
        const hold: SeatHold = {
          holdRef: response.holdRef,
          seatNo,
          expiresAt: response.expiresAt ?? Date.now() + (ttlSeconds * 1000),
          tripId,
          originSeq,
          destinationSeq
        };

        // Update both state and ref immediately
        holdsRef.current.set(seatNo, hold);
        setHolds(current => new Map(current.set(seatNo, hold)));

        console.log('[useSeatHold] Hold created:', { seatNo, holdRef: response.holdRef });

        toast({
          title: "Kursi Dipegang",
          description: `Kursi ${seatNo} dipegang selama ${Math.floor(ttlSeconds / 60)} menit`
        });

        return response.holdRef;
      } else if (response.ownedByYou) {
        // Seat already held by this operator (idempotent success)
        toast({
          title: "Kursi Sudah Dipegang",
          description: `Kursi ${seatNo} sudah dipegang oleh Anda`,
          variant: "default"
        });
        return null;
      }

      return response.holdRef;
    } catch (error) {
      console.error('[useSeatHold] Failed to create hold:', error);
      toast({
        title: "Gagal Mempengang Kursi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const releaseHold = useCallback(async (seatNo: string) => {
    // Use ref for immediate access
    const hold = holdsRef.current.get(seatNo);
    
    console.log('[useSeatHold] Release hold requested for:', seatNo);
    console.log('[useSeatHold] Current holds:', Array.from(holdsRef.current.entries()).map(([k, v]) => ({ seatNo: k, holdRef: v.holdRef })));
    
    if (!hold) {
      console.error('[useSeatHold] No hold found for seat:', seatNo);
      toast({
        title: "Tidak Dapat Melepas",
        description: `Kursi ${seatNo} tidak ditemukan dalam daftar hold`,
        variant: "destructive"
      });
      return false;
    }

    console.log('[useSeatHold] Releasing hold:', hold.holdRef);

    try {
      await holdsApi.release(hold.holdRef);
      
      // Update both ref and state
      holdsRef.current.delete(seatNo);
      setHolds(current => {
        const newHolds = new Map(current);
        newHolds.delete(seatNo);
        return newHolds;
      });

      toast({
        title: "Kursi Dilepas",
        description: `Kursi ${seatNo} sekarang tersedia`
      });
      
      return true;
    } catch (error) {
      console.error('[useSeatHold] Failed to release hold:', error);
      toast({
        title: "Gagal Melepas Kursi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  const releaseAllHolds = useCallback(async () => {
    const holdEntries = Array.from(holdsRef.current.entries());
    console.log('[useSeatHold] Releasing all holds:', holdEntries.length);
    
    for (const [seatNo, hold] of holdEntries) {
      try {
        await holdsApi.release(hold.holdRef);
        holdsRef.current.delete(seatNo);
      } catch (error) {
        console.error('[useSeatHold] Failed to release hold for seat:', seatNo, error);
      }
    }
    
    setHolds(new Map());
  }, []);

  const getHoldTTL = useCallback((seatNo: string): number => {
    const hold = holdsRef.current.get(seatNo);
    if (!hold) return 0;
    return Math.max(0, Math.floor((hold.expiresAt - Date.now()) / 1000));
  }, []);

  const isHeld = useCallback((seatNo: string): boolean => {
    const hold = holdsRef.current.get(seatNo);
    return hold ? hold.expiresAt > Date.now() : false;
  }, []);

  return {
    holds: Array.from(holds.values()),
    loading,
    createHold,
    releaseHold,
    releaseAllHolds,
    getHoldTTL,
    isHeld
  };
}
