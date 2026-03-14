import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { bookingsApi, pricingApi } from '@/lib/api';
import type { BookingFlowState, BookingStep, CreateBookingRequest } from '@/types';

const BOOKING_STEPS: BookingStep[] = [
  { id: 1, name: 'Outlet', status: 'pending' },
  { id: 2, name: 'Trip', status: 'pending' },
  { id: 3, name: 'Route', status: 'pending' },
  { id: 4, name: 'Seats', status: 'pending' },
  { id: 5, name: 'Passengers', status: 'pending' },
  { id: 6, name: 'Payment', status: 'pending' }
];

export function useBookingFlow() {
  const [state, setState] = useState<BookingFlowState>({
    selectedSeats: [],
    passengers: [],
    currentStep: 1
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateState = useCallback((updates: Partial<BookingFlowState>) => {
    setState(current => ({ ...current, ...updates }));
  }, []);

  const setCurrentStep = useCallback((step: number) => {
    setState(current => ({ ...current, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setState(current => ({ 
      ...current, 
      currentStep: Math.min(current.currentStep + 1, BOOKING_STEPS.length)
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(current => ({ 
      ...current, 
      currentStep: Math.max(current.currentStep - 1, 1)
    }));
  }, []);

  const getSteps = useCallback(() => {
    return BOOKING_STEPS.map(step => ({
      ...step,
      status: step.id < state.currentStep ? 'completed' as const :
              step.id === state.currentStep ? 'active' as const : 'pending' as const
    }));
  }, [state.currentStep]);

  const addSeat = useCallback((seatNo: string) => {
    setState(current => ({
      ...current,
      selectedSeats: [...current.selectedSeats, seatNo]
    }));
  }, []);

  const removeSeat = useCallback((seatNo: string) => {
    setState(current => ({
      ...current,
      selectedSeats: current.selectedSeats.filter(seat => seat !== seatNo)
    }));
  }, []);

  const clearSeats = useCallback(() => {
    setState(current => ({
      ...current,
      selectedSeats: []
    }));
  }, []);

  const updatePassengers = useCallback((passengers: any[]) => {
    setState(current => ({ ...current, passengers }));
  }, []);

  const canProceedToNextStep = useCallback(() => {
    switch (state.currentStep) {
      case 1: return !!state.outlet;
      case 2: return !!state.trip;
      case 3: return !!state.originStop && !!state.destinationStop;
      case 4: return state.selectedSeats.length > 0;
      case 5: return state.passengers.length === state.selectedSeats.length && 
                     state.passengers.every(p => (p.fullName ?? '').trim());
      case 6: return !!state.payment;
      default: return false;
    }
  }, [state]);

  const calculateTotalAmount = useCallback(async (): Promise<number> => {
    if (!state.trip?.id || state.originSeq === undefined || state.destinationSeq === undefined || state.selectedSeats.length === 0) {
      return state.selectedSeats.length * 25000;
    }

    try {
      const fareQuote = await pricingApi.quoteFare(
        state.trip.id,
        state.originSeq,
        state.destinationSeq,
        state.selectedSeats.length
      );
      return fareQuote.totalForAllPassengers;
    } catch (error) {
      console.error('Failed to calculate dynamic pricing, using fallback:', error);
      return state.selectedSeats.length * 25000;
    }
  }, [state.trip?.id, state.originSeq, state.destinationSeq, state.selectedSeats.length]);

  const validateBookingData = useCallback(() => {
    const validationErrors = [];
    
    if (!state.trip) validationErrors.push('Trip not selected');
    if (!state.originStop) validationErrors.push('Origin stop not selected');
    if (!state.destinationStop) validationErrors.push('Destination stop not selected');
    if (!state.originSeq && state.originSeq !== 0) validationErrors.push('Origin sequence not set');
    if (!state.destinationSeq && state.destinationSeq !== 0) validationErrors.push('Destination sequence not set');
    if (!state.selectedSeats || state.selectedSeats.length === 0) validationErrors.push('No seats selected');
    if (!state.passengers || state.passengers.length === 0) validationErrors.push('No passengers added');
    if (state.passengers.length !== state.selectedSeats.length) validationErrors.push('Passenger count does not match seat count');
    
    if (state.originSeq !== undefined && state.destinationSeq !== undefined && state.originSeq >= state.destinationSeq) {
      validationErrors.push('Origin sequence must be less than destination sequence');
    }
    
    const uniqueSeats = new Set(state.selectedSeats);
    if (uniqueSeats.size !== state.selectedSeats.length) {
      validationErrors.push('Duplicate seats are not allowed');
    }
    
    state.selectedSeats.forEach((seat, index) => {
      if (!seat || !seat.trim()) {
        validationErrors.push(`Seat ${index + 1} number cannot be empty`);
      }
    });
    
    state.passengers.forEach((passenger, index) => {
      if (!passenger.fullName || !passenger.fullName.trim()) {
        validationErrors.push(`Passenger ${index + 1} name is required`);
      }
    });

    return validationErrors;
  }, [state]);

  const createPendingBooking = useCallback(async (): Promise<{ booking: any; printPayload: any }> => {
    const validationErrors = validateBookingData();

    if (validationErrors.length > 0) {
      const errorMessage = `Booking validation failed: ${validationErrors.join(', ')}`;
      console.error('Booking validation errors:', validationErrors);
      throw new Error(errorMessage);
    }

    setLoading(true);
    try {
      const totalAmount = await calculateTotalAmount();
      
      const bookingData = {
        tripId: state.trip!.id,
        outletId: state.outlet?.id,
        originStopId: state.originStop!.id,
        destinationStopId: state.destinationStop!.id,
        originSeq: state.originSeq!,
        destinationSeq: state.destinationSeq!,
        totalAmount: totalAmount,
        channel: 'CSO' as const,
        createdBy: 'CSO User',
        passengers: state.passengers.map((passenger, index) => ({
          fullName: passenger.fullName,
          phone: passenger.phone || undefined,
          idNumber: passenger.idNumber || undefined,
          seatNo: state.selectedSeats[index]
        }))
      };

      const idempotencyKey = `pending-booking-${Date.now()}-${Math.random()}`;
      console.log('Creating pending booking with idempotency key:', idempotencyKey);
      
      // Call the pending booking API
      const response = await fetch('/api/bookings/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(bookingData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create pending booking');
      }

      const result = await response.json();

      toast({
        title: "Booking Dibuat",
        description: `Booking ${result.booking.id.slice(-8)} berhasil dibuat (belum bayar)`
      });

      return result;
    } catch (error) {
      console.error('Pending booking failed:', error);
      toast({
        title: "Booking Gagal",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [state, toast, calculateTotalAmount, validateBookingData]);

  const createBooking = useCallback(async (): Promise<{ booking: any; printPayload: any }> => {
    const validationErrors = validateBookingData();
    
    if (!state.payment) validationErrors.push('Payment information not provided');
    
    if (state.payment) {
      const validMethods = ['cash', 'qr', 'ewallet', 'bank'];
      if (!validMethods.includes(state.payment.method)) {
        validationErrors.push('Invalid payment method');
      }
    }

    if (validationErrors.length > 0) {
      const errorMessage = `Booking validation failed: ${validationErrors.join(', ')}`;
      console.error('Booking validation errors:', validationErrors);
      throw new Error(errorMessage);
    }

    setLoading(true);
    try {
      const totalAmount = await calculateTotalAmount();
      
      if (state.payment && state.payment.amount < totalAmount) {
        throw new Error(`Payment amount (${state.payment.amount}) is less than total amount (${totalAmount})`);
      }
      
      const bookingData: CreateBookingRequest = {
        tripId: state.trip!.id,
        outletId: state.outlet?.id,
        originStopId: state.originStop!.id,
        destinationStopId: state.destinationStop!.id,
        originSeq: state.originSeq!,
        destinationSeq: state.destinationSeq!,
        totalAmount: totalAmount,
        channel: 'CSO',
        createdBy: 'CSO User',
        passengers: state.passengers.map((passenger, index) => ({
          fullName: passenger.fullName,
          phone: passenger.phone || undefined,
          idNumber: passenger.idNumber || undefined,
          seatNo: state.selectedSeats[index]
        })),
        payment: state.payment!
      };

      const idempotencyKey = `booking-${Date.now()}-${Math.random()}`;
      console.log('Creating booking with idempotency key:', idempotencyKey);
      const result = await bookingsApi.create(bookingData, idempotencyKey);

      toast({
        title: "Booking Created",
        description: `Booking ${result.booking.id.slice(-8)} created successfully`
      });

      return result;
    } catch (error) {
      console.error('Booking failed:', error);
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [state, toast, calculateTotalAmount, validateBookingData]);

  const resetFlow = useCallback(() => {
    setState({
      selectedSeats: [],
      passengers: [],
      currentStep: 1
    });
  }, []);

  return {
    state,
    loading,
    steps: getSteps(),
    updateState,
    setCurrentStep,
    nextStep,
    prevStep,
    addSeat,
    removeSeat,
    clearSeats,
    updatePassengers,
    canProceedToNextStep,
    createBooking,
    createPendingBooking,
    resetFlow,
    calculateTotalAmount
  };
}
