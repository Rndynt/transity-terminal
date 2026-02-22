import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TripSelector from '@/components/cso/TripSelector';
import RouteTimeline from '@/components/cso/RouteTimeline';
import SeatMap from '@/components/cso/SeatMap';
import PassengerForm from '@/components/cso/PassengerForm';
import PaymentPanel from '@/components/cso/PaymentPanel';
import PrintPreview from '@/components/cso/PrintPreview';
import { useBookingFlow } from '@/hooks/useBookingFlow';
import { useSeatHold } from '@/hooks/useSeatHold';
import { ChevronLeft, ChevronRight, Check, MapPin, Grid3X3, Users, CreditCard, Ticket } from 'lucide-react';
import type { Trip, Stop, Outlet, CsoAvailableTrip } from '@/types';

// Simplified steps - 5 steps instead of 6
const STEPS = [
  { id: 1, name: 'Jadwal', icon: MapPin, desc: 'Pilih outlet & keberangkatan' },
  { id: 2, name: 'Rute', icon: MapPin, desc: 'Pilih titik naik & turun' },
  { id: 3, name: 'Kursi', icon: Grid3X3, desc: 'Pilih kursi' },
  { id: 4, name: 'Penumpang', icon: Users, desc: 'Isi data' },
  { id: 5, name: 'Bayar', icon: CreditCard, desc: 'Pembayaran' }
];

export default function CsoPage() {
  const [bookingResult, setBookingResult] = useState<{ booking: any; printPayload: any } | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedCsoTrip, setSelectedCsoTrip] = useState<CsoAvailableTrip | undefined>();
  
  const { 
    state, 
    updateState, 
    setCurrentStep, 
    nextStep, 
    prevStep,
    addSeat,
    removeSeat,
    updatePassengers,
    canProceedToNextStep,
    createBooking,
    resetFlow,
    calculateTotalAmount,
    loading: bookingLoading
  } = useBookingFlow();
  
  const { releaseAllHolds } = useSeatHold();

  // Calculate total amount
  useEffect(() => {
    const updateTotal = async () => {
      try {
        const total = await calculateTotalAmount();
        setTotalAmount(total);
      } catch (error) {
        console.error('Failed to calculate total:', error);
        setTotalAmount(0);
      }
    };

    if (state.selectedSeats.length > 0) {
      updateTotal();
    } else {
      setTotalAmount(0);
    }
  }, [state.trip?.id, state.originSeq, state.destinationSeq, state.selectedSeats.length, calculateTotalAmount]);

  const handleOutletSelect = (outlet: Outlet) => {
    updateState({ 
      outlet,
      trip: undefined,
      originStop: undefined,
      destinationStop: undefined,
      originSeq: undefined,
      destinationSeq: undefined,
      selectedSeats: [],
      passengers: [],
      payment: undefined
    });
    setSelectedCsoTrip(undefined);
    releaseAllHolds();
  };

  const handleTripSelect = (csoTrip: CsoAvailableTrip) => {
    setSelectedCsoTrip(csoTrip);
    const trip: Trip = {
      id: csoTrip.tripId || '', 
      patternId: '',
      vehicleId: '',
      serviceDate: new Date().toISOString().split('T')[0],
      capacity: csoTrip.capacity || 0,
      status: csoTrip.status as 'scheduled' | 'canceled' | 'closed',
      layoutId: null,
      channelFlags: {},
      createdAt: null,
      baseId: csoTrip.baseId || null,
      originDepartHHMM: null
    };
    updateState({ trip });
  };

  const handleOriginSelect = (stop: Stop, sequence: number) => {
    updateState({ 
      originStop: stop, 
      originSeq: sequence,
      ...(state.destinationSeq && state.destinationSeq <= sequence ? { 
        destinationStop: undefined, 
        destinationSeq: undefined 
      } : {})
    });
  };

  const handleDestinationSelect = (stop: Stop, sequence: number) => {
    updateState({ destinationStop: stop, destinationSeq: sequence });
  };

  const handleSeatSelect = (seatNo: string) => addSeat(seatNo);
  const handleSeatDeselect = (seatNo: string) => removeSeat(seatNo);
  const handlePassengersUpdate = (passengers: any[]) => updatePassengers(passengers);
  const handlePaymentUpdate = (payment: any) => updateState({ payment });

  const handleCreateBooking = async () => {
    try {
      const result = await createBooking();
      setBookingResult(result);
      setCurrentStep(6); // Success step
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  const handleNewBooking = () => {
    setBookingResult(null);
    setSelectedCsoTrip(undefined);
    updateState({ 
      trip: undefined,
      originStop: undefined,
      destinationStop: undefined,
      originSeq: undefined,
      destinationSeq: undefined,
      selectedSeats: [],
      passengers: [],
      payment: undefined
    });
    resetFlow();
    releaseAllHolds();
  };

  const handleStepClick = (stepNumber: number) => {
    if (stepNumber < state.currentStep) {
      setCurrentStep(stepNumber);
    }
  };

  const getStepStatus = (stepId: number) => {
    if (bookingResult) return stepId < 6 ? 'completed' : 'active';
    if (state.currentStep > stepId) return 'completed';
    if (state.currentStep === stepId) return 'active';
    return 'pending';
  };

  const canProceed = () => {
    switch (state.currentStep) {
      case 1: return !!state.outlet && !!state.trip;
      case 2: return !!state.originStop && !!state.destinationStop;
      case 3: return state.selectedSeats.length > 0;
      case 4: return state.passengers.length === state.selectedSeats.length && 
                     state.passengers.every(p => (p.fullName ?? '').trim());
      case 5: return !!state.payment;
      default: return false;
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  // Success view
  if (state.currentStep === 6 && bookingResult) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <PrintPreview
          booking={bookingResult.booking}
          printPayload={bookingResult.printPayload}
          onNewBooking={handleNewBooking}
          onPrint={() => window.print()}
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Compact Stepper */}
      <div className="bg-card border-b px-4 py-2">
        <div className="flex items-center justify-center gap-1 overflow-x-auto">
          {STEPS.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step.id)}
                  disabled={status === 'pending'}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                    status === 'active' 
                      ? 'bg-primary text-primary-foreground' 
                      : status === 'completed'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    status === 'completed' ? 'bg-green-500 text-white' : status === 'active' ? 'bg-primary-foreground/20' : 'bg-muted'
                  }`}>
                    {status === 'completed' ? <Check className="w-3 h-3" /> : step.id}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.name}</span>
                </button>
                
                {index < STEPS.length - 1 && (
                  <ChevronRight className={`w-4 h-4 mx-1 ${
                    state.currentStep > step.id ? 'text-green-500' : 'text-muted-foreground/30'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Column 1: Jadwal (Always visible) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 overflow-auto p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  state.currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>1</div>
                <h2 className="font-semibold">Pilih Jadwal</h2>
              </div>
              <TripSelector
                selectedOutlet={state.outlet}
                selectedTrip={selectedCsoTrip}
                onOutletSelect={handleOutletSelect}
                onTripSelect={handleTripSelect}
              />
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Rute / Kursi */}
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 overflow-auto p-4">
              {/* Step 2: Rute */}
              {state.currentStep === 2 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                    <h2 className="font-semibold">Pilih Rute</h2>
                  </div>
                  {state.trip ? (
                    <RouteTimeline
                      trip={state.trip}
                      selectedOrigin={state.originStop}
                      selectedDestination={state.destinationStop}
                      onOriginSelect={handleOriginSelect}
                      onDestinationSelect={handleDestinationSelect}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Pilih jadwal terlebih dahulu</p>
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Kursi */}
              {state.currentStep === 3 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
                    <h2 className="font-semibold">Pilih Kursi</h2>
                  </div>
                  {state.trip && state.originSeq && state.destinationSeq ? (
                    <SeatMap
                      trip={state.trip}
                      originSeq={state.originSeq}
                      destinationSeq={state.destinationSeq}
                      selectedSeats={state.selectedSeats}
                      onSeatSelect={handleSeatSelect}
                      onSeatDeselect={handleSeatDeselect}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Pilih rute terlebih dahulu</p>
                    </div>
                  )}
                </>
              )}

              {/* Summary for steps 4-5 */}
              {state.currentStep >= 4 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <h2 className="font-semibold">Rute & Kursi</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Rute:</span>
                        <span className="font-medium">
                          {state.originStop?.code} → {state.destinationStop?.code}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kursi:</span>
                        <span className="font-medium">{state.selectedSeats.join(', ')}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setCurrentStep(2)}>
                      Ubah Rute/Kursi
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Penumpang / Pembayaran */}
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 overflow-auto p-4">
              {/* Step 4: Penumpang */}
              {state.currentStep === 4 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
                    <h2 className="font-semibold">Data Penumpang</h2>
                  </div>
                  <PassengerForm
                    selectedSeats={state.selectedSeats}
                    passengers={state.passengers}
                    onPassengersUpdate={handlePassengersUpdate}
                    onNext={nextStep}
                    onBack={prevStep}
                  />
                </>
              )}

              {/* Step 5: Pembayaran */}
              {state.currentStep === 5 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">5</div>
                    <h2 className="font-semibold">Pembayaran</h2>
                  </div>
                  <PaymentPanel
                    totalAmount={totalAmount}
                    payment={state.payment}
                    onPaymentUpdate={handlePaymentUpdate}
                    onSubmit={handleCreateBooking}
                    onBack={prevStep}
                    loading={bookingLoading}
                  />
                </>
              )}

              {/* Summary for steps 1-3 */}
              {state.currentStep < 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold">Ringkasan Booking</h2>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Outlet</span>
                      <span className="font-medium">{state.outlet?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Jadwal</span>
                      <span className="font-medium">{selectedCsoTrip?.patternPath || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Rute</span>
                      <span className="font-medium">
                        {state.originStop && state.destinationStop 
                          ? `${state.originStop.code} → ${state.destinationStop.code}`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Kursi</span>
                      <span className="font-medium">
                        {state.selectedSeats.length > 0 ? state.selectedSeats.join(', ') : '-'}
                      </span>
                    </div>
                  </div>

                  {state.selectedSeats.length > 0 && (
                    <div className="p-3 bg-primary/5 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="space-y-2 pt-4">
                    {state.currentStep > 1 && (
                      <Button variant="outline" className="w-full" onClick={prevStep}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
                      </Button>
                    )}
                    
                    {canProceed() && state.currentStep < 5 && (
                      <Button className="w-full" onClick={nextStep}>
                        Lanjutkan <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
