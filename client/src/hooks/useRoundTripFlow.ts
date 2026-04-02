import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { CsoAvailableTrip, Stop, Outlet } from '@/types';

export type RoundTripStep = 1 | 2 | 3 | 4 | 5;

export interface RoundTripFlowState {
  step: RoundTripStep;
  // Outbound (pergi)
  outboundTrip?: CsoAvailableTrip;
  outboundOriginStop?: Stop;
  outboundDestinationStop?: Stop;
  outboundOriginSeq?: number;
  outboundDestinationSeq?: number;
  outboundSeats: string[]; // seatNo[]
  outboundOutlet?: Outlet;
  // Return (pulang)
  returnTrip?: CsoAvailableTrip;
  returnOriginStop?: Stop;
  returnDestinationStop?: Stop;
  returnOriginSeq?: number;
  returnDestinationSeq?: number;
  returnSeats: string[]; // seatNo[]
  // Shared
  passengers: { name: string; seatNoOutbound: string; seatNoReturn: string }[];
  payment?: { method: 'cash' | 'qr' | 'ewallet' | 'bank'; amount: number };
  // Result
  groupCode?: string;
  outboundBookingCode?: string;
  returnBookingCode?: string;
}

export function useRoundTripFlow() {
  const [state, setState] = useState<RoundTripFlowState>({
    step: 1,
    outboundSeats: [],
    returnSeats: [],
    passengers: []
  });
  const { toast } = useToast();

  const setStep = useCallback((step: RoundTripStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const setOutbound = useCallback((
    trip?: CsoAvailableTrip,
    originStop?: Stop,
    destStop?: Stop,
    originSeq?: number,
    destSeq?: number,
    outlet?: Outlet
  ) => {
    setState(prev => ({
      ...prev,
      outboundTrip: trip,
      outboundOriginStop: originStop,
      outboundDestinationStop: destStop,
      outboundOriginSeq: originSeq,
      outboundDestinationSeq: destSeq,
      outboundOutlet: outlet
    }));
  }, []);

  const setReturnTrip = useCallback((
    trip?: CsoAvailableTrip,
    originStop?: Stop,
    destStop?: Stop,
    originSeq?: number,
    destSeq?: number
  ) => {
    setState(prev => ({
      ...prev,
      returnTrip: trip,
      returnOriginStop: originStop,
      returnDestinationStop: destStop,
      returnOriginSeq: originSeq,
      returnDestinationSeq: destSeq
    }));
  }, []);

  const setOutboundSeats = useCallback((seats: string[]) => {
    setState(prev => ({ ...prev, outboundSeats: seats }));
  }, []);

  const addOutboundSeat = useCallback((seat: string) => {
    setState(prev => ({ ...prev, outboundSeats: [...prev.outboundSeats, seat] }));
  }, []);

  const removeOutboundSeat = useCallback((seat: string) => {
    setState(prev => ({ ...prev, outboundSeats: prev.outboundSeats.filter(s => s !== seat) }));
  }, []);

  const setReturnSeats = useCallback((seats: string[]) => {
    setState(prev => ({ ...prev, returnSeats: seats }));
  }, []);

  const addReturnSeat = useCallback((seat: string) => {
    setState(prev => ({ ...prev, returnSeats: [...prev.returnSeats, seat] }));
  }, []);

  const removeReturnSeat = useCallback((seat: string) => {
    setState(prev => ({ ...prev, returnSeats: prev.returnSeats.filter(s => s !== seat) }));
  }, []);

  const setPassengers = useCallback((passengers: { name: string; seatNoOutbound: string; seatNoReturn: string }[]) => {
    setState(prev => ({ ...prev, passengers }));
  }, []);

  const setPayment = useCallback((payment?: { method: 'cash' | 'qr' | 'ewallet' | 'bank'; amount: number }) => {
    setState(prev => ({ ...prev, payment }));
  }, []);

  const submitRoundTrip = async () => {
    if (!state.outboundTrip || !state.returnTrip || !state.payment) {
      throw new Error('Data tidak lengkap');
    }

    const payload = {
      outbound: {
        tripId: state.outboundTrip.tripId,
        originStopId: state.outboundOriginStop?.id,
        destinationStopId: state.outboundDestinationStop?.id,
        originSeq: state.outboundOriginSeq,
        destinationSeq: state.outboundDestinationSeq,
        outletId: state.outboundOutlet?.id,
        passengers: state.passengers.map(p => ({
          fullName: p.name,
          seatNo: p.seatNoOutbound
        }))
      },
      return: {
        tripId: state.returnTrip.tripId,
        originStopId: state.returnOriginStop?.id,
        destinationStopId: state.returnDestinationStop?.id,
        originSeq: state.returnOriginSeq,
        destinationSeq: state.returnDestinationSeq,
        passengers: state.passengers.map(p => ({
          fullName: p.name,
          seatNo: p.seatNoReturn
        }))
      },
      payment: state.payment,
      channel: 'CSO'
    };

    try {
      const res = await apiRequest('POST', '/api/bookings/round-trip', payload);
      const result = await res.json();
      setState(prev => ({
        ...prev,
        groupCode: result.groupCode,
        outboundBookingCode: result.outboundBooking?.bookingCode,
        returnBookingCode: result.returnBooking?.bookingCode
      }));
      return result;
    } catch (error: any) {
      toast({
        title: 'Gagal membuat PP',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const reset = useCallback(() => {
    setState({
      step: 1,
      outboundSeats: [],
      returnSeats: [],
      passengers: []
    });
  }, []);

  return {
    state,
    setStep,
    setOutbound,
    setReturnTrip,
    setOutboundSeats,
    addOutboundSeat,
    removeOutboundSeat,
    setReturnSeats,
    addReturnSeat,
    removeReturnSeat,
    setPassengers,
    setPayment,
    submitRoundTrip,
    reset
  };
}
