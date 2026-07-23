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
  initialTtl: number;
}

export function useSeatHold(onHoldExpired?: (seatNo: string) => void) {
  const [holds, setHolds] = useState<Map<string, SeatHold>>(new Map());
  const [loadingSeats, setLoadingSeats] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();
  const holdsRef = useRef<Map<string, SeatHold>>(new Map());
  const onHoldExpiredRef = useRef(onHoldExpired);

  useEffect(() => {
    onHoldExpiredRef.current = onHoldExpired;
  }, [onHoldExpired]);

  useEffect(() => {
    holdsRef.current = holds;
  }, [holds]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();

      setTick(t => t + 1);

      setHolds(currentHolds => {
        const newHolds = new Map(currentHolds);
        let hasChanges = false;

        const expiredSeats = Array.from(newHolds.entries()).filter(([, hold]) => hold.expiresAt <= now);
        for (const [seatNo, hold] of expiredSeats) {
          newHolds.delete(seatNo);
          holdsRef.current.delete(seatNo);
          hasChanges = true;
          toast({
            title: "Hold Expired",
            description: `Kursi ${seatNo} sudah dilepas otomatis`,
            variant: "destructive"
          });
          onHoldExpiredRef.current?.(seatNo);
          holdsApi.release(hold.holdRef).catch(() => {});
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
    ttlSeconds: number = 300
  ) => {
    setLoadingSeats(prev => new Set(prev).add(seatNo));
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
        const hold: SeatHold = {
          holdRef: response.holdRef,
          seatNo,
          expiresAt: response.expiresAt ?? Date.now() + (ttlSeconds * 1000),
          tripId,
          originSeq,
          destinationSeq,
          initialTtl: ttlSeconds
        };

        holdsRef.current.set(seatNo, hold);
        setHolds(current => new Map(current.set(seatNo, hold)));

        return response.holdRef;
      } else if (response.ownedByYou) {
        return null;
      }

      return response.holdRef;
    } catch (error) {
      console.error('[useSeatHold] Failed to create hold:', error);
      toast({
        title: "Gagal Memegang Kursi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat memegang kursi",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoadingSeats(prev => { const n = new Set(prev); n.delete(seatNo); return n; });
    }
  }, [toast]);

  const releaseHold = useCallback(async (seatNo: string) => {
    // Use ref for immediate access
    const hold = holdsRef.current.get(seatNo);
    
    if (!hold) {
      console.error('[useSeatHold] No hold found for seat:', seatNo);
      toast({
        title: "Tidak Dapat Melepas",
        description: `Kursi ${seatNo} tidak ditemukan dalam daftar hold`,
        variant: "destructive"
      });
      return false;
    }

    try {
      await holdsApi.release(hold.holdRef);
      
      holdsRef.current.delete(seatNo);
      setHolds(current => {
        const newHolds = new Map(current);
        newHolds.delete(seatNo);
        return newHolds;
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
    void tick;
    const hold = holdsRef.current.get(seatNo);
    if (!hold) return 0;
    return Math.max(0, Math.floor((hold.expiresAt - Date.now()) / 1000));
  }, [tick]);

  const getInitialTTL = useCallback((seatNo: string): number => {
    const hold = holdsRef.current.get(seatNo);
    return hold?.initialTtl ?? 300;
  }, []);

  const isHeld = useCallback((seatNo: string): boolean => {
    void tick;
    const hold = holdsRef.current.get(seatNo);
    return hold ? hold.expiresAt > Date.now() : false;
  }, [tick]);

  return {
    holds: Array.from(holds.values()),
    loading: loadingSeats.size > 0,
    createHold,
    releaseHold,
    releaseAllHolds,
    getHoldTTL,
    getInitialTTL,
    isHeld,
    tick
  };
}
