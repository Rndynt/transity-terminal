import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { bookingsApi, pricingApi, promotionsApi } from '@/lib/api';
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

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

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
      case 3: return !!state.originStop && !!state.destinationStop &&
                     state.originSeq !== undefined && state.destinationSeq !== undefined &&
                     state.originSeq < state.destinationSeq;
      case 4: return state.selectedSeats.length > 0;
      case 5: return state.passengers.length === state.selectedSeats.length && 
                     state.passengers.every(p => (p.fullName ?? '').trim());
      case 6: return !!state.payment;
      default: return false;
    }
  }, [state]);

  const calculateTotalAmount = useCallback(async (): Promise<number> => {
    const legCount = (state.originSeq !== undefined && state.destinationSeq !== undefined)
      ? Math.max(state.destinationSeq - state.originSeq, 1)
      : 1;
    const fallbackPerLeg = 25000;
    const fallbackTotal = state.selectedSeats.length * legCount * fallbackPerLeg;

    if (!state.trip?.id || state.originSeq === undefined || state.destinationSeq === undefined || state.selectedSeats.length === 0) {
      return fallbackTotal;
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
      return fallbackTotal;
    }
  }, [state.trip?.id, state.originSeq, state.destinationSeq, state.selectedSeats.length]);

  const validateBookingData = useCallback((overrides?: { passengers?: any[]; payment?: any }) => {
    const s = { ...stateRef.current, ...overrides };
    const validationErrors = [];
    
    if (!s.trip) validationErrors.push('Trip not selected');
    if (!s.originStop) validationErrors.push('Origin stop not selected');
    if (!s.destinationStop) validationErrors.push('Destination stop not selected');
    if (!s.originSeq && s.originSeq !== 0) validationErrors.push('Origin sequence not set');
    if (!s.destinationSeq && s.destinationSeq !== 0) validationErrors.push('Destination sequence not set');
    if (!s.selectedSeats || s.selectedSeats.length === 0) validationErrors.push('No seats selected');
    if (!s.passengers || s.passengers.length === 0) validationErrors.push('No passengers added');
    if (s.passengers.length !== s.selectedSeats.length) validationErrors.push('Passenger count does not match seat count');
    
    if (s.originSeq !== undefined && s.destinationSeq !== undefined && s.originSeq >= s.destinationSeq) {
      validationErrors.push('Origin sequence must be less than destination sequence');
    }
    
    const uniqueSeats = new Set(s.selectedSeats);
    if (uniqueSeats.size !== s.selectedSeats.length) {
      validationErrors.push('Duplicate seats are not allowed');
    }
    
    s.selectedSeats.forEach((seat: string, index: number) => {
      if (!seat || !seat.trim()) {
        validationErrors.push(`Seat ${index + 1} number cannot be empty`);
      }
    });
    
    s.passengers.forEach((passenger: any, index: number) => {
      if (!passenger.fullName || !passenger.fullName.trim()) {
        validationErrors.push(`Passenger ${index + 1} name is required`);
      }
    });

    return validationErrors;
  }, []);

  const createPendingBooking = useCallback(async (overrides?: { passengers?: any[] }): Promise<{ booking: any; printPayload: any }> => {
    const s = { ...stateRef.current, ...overrides };
    const validationErrors = validateBookingData(overrides);

    if (validationErrors.length > 0) {
      const errorMessage = `Booking validation failed: ${validationErrors.join(', ')}`;
      console.error('Booking validation errors:', validationErrors);
      throw new Error(errorMessage);
    }

    setLoading(true);
    try {
      const totalAmount = await calculateTotalAmount();
      
      const bookingData = {
        tripId: s.trip!.id,
        outletId: s.outlet?.id,
        originStopId: s.originStop!.id,
        destinationStopId: s.destinationStop!.id,
        originSeq: s.originSeq!,
        destinationSeq: s.destinationSeq!,
        totalAmount: totalAmount,
        channel: 'CSO' as const,
        createdBy: 'CSO User',
        passengers: s.passengers.map((passenger: any, index: number) => ({
          fullName: passenger.fullName,
          phone: passenger.phone || undefined,
          idNumber: passenger.idNumber || undefined,
          seatNo: s.selectedSeats[index]
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
  }, [toast, calculateTotalAmount, validateBookingData]);

  const applyPromoCode = useCallback(async (code: string): Promise<void> => {
    if (!code.trim()) {
      setState(current => ({
        ...current,
        promoCode: undefined,
        discountAmount: undefined,
        promoValidation: undefined,
      }));
      return;
    }

    const s = stateRef.current;
    if (!s.trip?.id || s.originSeq === undefined || s.destinationSeq === undefined) {
      throw new Error('Pilih trip dan rute terlebih dahulu');
    }

    const subtotal = await calculateTotalAmount();
    const trip = s.trip as any;

    const result = await promotionsApi.validate({
      code: code.trim(),
      subtotal,
      channel: 'CSO',
      tripId: s.trip.id,
      patternId: trip.patternId || undefined,
    });

    setState(current => ({
      ...current,
      promoCode: result.valid ? code.trim().toUpperCase() : undefined,
      discountAmount: result.valid ? result.discountAmount : undefined,
      promoValidation: result,
    }));

    if (!result.valid) {
      throw new Error(result.error || 'Kode promo tidak valid');
    }
  }, [calculateTotalAmount]);

  const clearPromoCode = useCallback(() => {
    setState(current => ({
      ...current,
      promoCode: undefined,
      discountAmount: undefined,
      promoValidation: undefined,
    }));
  }, []);

  const createBooking = useCallback(async (overrides?: { passengers?: any[]; payment?: any }): Promise<{ booking: any; printPayload: any }> => {
    const s = { ...stateRef.current, ...overrides };
    const validationErrors = validateBookingData(overrides);
    
    if (!s.payment) validationErrors.push('Payment information not provided');
    
    if (s.payment) {
      const validMethods = ['cash', 'qr', 'ewallet', 'bank'];
      if (!validMethods.includes(s.payment.method)) {
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
      const subtotal = await calculateTotalAmount();
      const discount = s.discountAmount || 0;
      const totalAmount = subtotal - discount;
      
      if (s.payment && s.payment.amount < totalAmount) {
        throw new Error(`Payment amount (${s.payment.amount}) is less than total amount (${totalAmount})`);
      }
      
      const bookingData: CreateBookingRequest = {
        tripId: s.trip!.id,
        outletId: s.outlet?.id,
        originStopId: s.originStop!.id,
        destinationStopId: s.destinationStop!.id,
        originSeq: s.originSeq!,
        destinationSeq: s.destinationSeq!,
        totalAmount: totalAmount,
        channel: 'CSO',
        createdBy: 'CSO User',
        promoCode: s.promoCode || undefined,
        passengers: s.passengers.map((passenger: any, index: number) => ({
          fullName: passenger.fullName,
          phone: passenger.phone || undefined,
          idNumber: passenger.idNumber || undefined,
          seatNo: s.selectedSeats[index]
        })),
        payment: s.payment!
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
  }, [toast, calculateTotalAmount, validateBookingData]);

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
    calculateTotalAmount,
    applyPromoCode,
    clearPromoCode,
  };
}
