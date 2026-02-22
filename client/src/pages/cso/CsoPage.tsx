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
import { ChevronLeft, ChevronRight, Check, MapPin, Grid3X3, Users, CreditCard, Ticket, Loader2 } from 'lucide-react';
import type { Trip, Stop, Outlet, CsoAvailableTrip } from '@/types';

const STEPS = [
  { id: 1, name: 'Jadwal', icon: MapPin },
  { id: 2, name: 'Rute', icon: MapPin },
  { id: 3, name: 'Kursi', icon: Grid3X3 },
  { id: 4, name: 'Penumpang', icon: Users },
  { id: 5, name: 'Bayar', icon: CreditCard }
];

export default function CsoPage() {
  const [bookingResult, setBookingResult] = useState<{ booking: any; printPayload: any } | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedCsoTrip, setSelectedCsoTrip] = useState<CsoAvailableTrip | undefined>();
  const [isMaterializing, setIsMaterializing] = useState(false);
  
  const { 
    state, 
    updateState, 
    setCurrentStep, 
    nextStep, 
    prevStep,
    addSeat,
    removeSeat,
    updatePassengers,
    createBooking,
    resetFlow,
    calculateTotalAmount,
    loading: bookingLoading
  } = useBookingFlow();
  
  const { releaseAllHolds } = useSeatHold();

  useEffect(() => {
    const updateTotal = async () => {
      try {
        const total = await calculateTotalAmount();
        setTotalAmount(total);
      } catch {
        setTotalAmount(0);
      }
    };
    if (state.selectedSeats.length > 0) updateTotal();
    else setTotalAmount(0);
  }, [state.trip?.id, state.originSeq, state.destinationSeq, state.selectedSeats.length, calculateTotalAmount]);

  const handleOutletSelect = (outlet: Outlet) => {
    updateState({ outlet, trip: undefined, originStop: undefined, destinationStop: undefined, originSeq: undefined, destinationSeq: undefined, selectedSeats: [], passengers: [], payment: undefined });
    setSelectedCsoTrip(undefined);
    releaseAllHolds();
  };

  const handleTripSelect = async (csoTrip: CsoAvailableTrip) => {
    setIsMaterializing(true);
    try {
      let tripId = csoTrip.tripId;
      
      // Materialize virtual trip
      if (csoTrip.isVirtual && csoTrip.baseId) {
        const res = await fetch('/api/cso/materialize-trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseId: csoTrip.baseId, serviceDate: csoTrip.departAtAtOutlet?.split('T')[0] || new Date().toISOString().split('T')[0] })
        });
        const data = await res.json();
        tripId = data.tripId;
      }
      
      setSelectedCsoTrip({ ...csoTrip, tripId });
      updateState({
        trip: {
          id: tripId || '',
          patternId: '',
          vehicleId: '',
          serviceDate: new Date().toISOString().split('T')[0],
          capacity: csoTrip.capacity || 0,
          status: csoTrip.status as any,
          layoutId: null,
          channelFlags: {},
          createdAt: null,
          baseId: csoTrip.baseId || null,
          originDepartHHMM: null
        }
      });
    } catch (error) {
      console.error('Trip selection failed:', error);
    } finally {
      setIsMaterializing(false);
    }
  };

  const handleOriginSelect = (stop: Stop, sequence: number) => {
    updateState({ originStop: stop, originSeq: sequence, ...(state.destinationSeq && state.destinationSeq <= sequence ? { destinationStop: undefined, destinationSeq: undefined } : {}) });
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
      setCurrentStep(6);
    } catch (error) {
      console.error('Booking failed:', error);
    }
  };

  const handleNewBooking = () => {
    setBookingResult(null);
    setSelectedCsoTrip(undefined);
    updateState({ trip: undefined, originStop: undefined, destinationStop: undefined, originSeq: undefined, destinationSeq: undefined, selectedSeats: [], passengers: [], payment: undefined });
    resetFlow();
    releaseAllHolds();
  };

  const handleStepClick = (stepId: number) => {
    if (stepId < state.currentStep) setCurrentStep(stepId);
    else if (stepId === state.currentStep + 1 && canProceed()) nextStep();
  };

  const canProceed = () => {
    switch (state.currentStep) {
      case 1: return !!state.outlet && !!state.trip;
      case 2: return !!state.originStop && !!state.destinationStop;
      case 3: return state.selectedSeats.length > 0;
      case 4: return state.passengers.length === state.selectedSeats.length && state.passengers.every(p => p.fullName?.trim());
      case 5: return !!state.payment;
      default: return false;
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  // Success view
  if (state.currentStep === 6 && bookingResult) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <PrintPreview booking={bookingResult.booking} printPayload={bookingResult.printPayload} onNewBooking={handleNewBooking} onPrint={() => window.print()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Stepper */}
      <div className="bg-card border-b px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-2 overflow-x-auto">
          {STEPS.map((step, i) => {
            const isActive = state.currentStep === step.id;
            const isCompleted = state.currentStep > step.id;
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                <button onClick={() => handleStepClick(step.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${isActive ? 'bg-primary text-white' : isCompleted ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="hidden sm:inline">{step.name}</span>
                </button>
                {i < STEPS.length - 1 && <ChevronRight className={`w-4 h-4 mx-1 ${isCompleted ? 'text-green-500' : 'text-muted-foreground/30'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          
          {/* Column 1: Jadwal */}
          <div className="bg-card rounded-lg p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Badge variant={state.currentStep >= 1 ? "default" : "secondary"}>1</Badge>
              Pilih Jadwal
            </h2>
            <TripSelector selectedOutlet={state.outlet} selectedTrip={selectedCsoTrip} onOutletSelect={handleOutletSelect} onTripSelect={handleTripSelect} />
          </div>

          {/* Column 2: Rute / Kursi */}
          <div className="bg-card rounded-lg p-4">
            {state.currentStep === 2 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default">2</Badge>
                  Pilih Rute
                </h2>
                {state.trip?.id ? (
                  <RouteTimeline trip={state.trip} selectedOrigin={state.originStop} selectedDestination={state.destinationStop} onOriginSelect={handleOriginSelect} onDestinationSelect={handleDestinationSelect} />
                ) : (
                  <p className="text-muted-foreground text-center py-8">Pilih jadwal dulu</p>
                )}
              </>
            )}
            
            {state.currentStep === 3 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default">3</Badge>
                  Pilih Kursi
                </h2>
                {state.trip?.id && state.originSeq && state.destinationSeq ? (
                  <SeatMap trip={state.trip} originSeq={state.originSeq} destinationSeq={state.destinationSeq} selectedSeats={state.selectedSeats} onSeatSelect={handleSeatSelect} onSeatDeselect={handleSeatDeselect} />
                ) : (
                  <p className="text-muted-foreground text-center py-8">Pilih rute dulu</p>
                )}
              </>
            )}

            {state.currentStep >= 4 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Rute & Kursi Terpilih
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Rute:</span><span>{state.originStop?.code} &rarr; {state.destinationStop?.code}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kursi:</span><span>{state.selectedSeats.join(', ')}</span></div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setCurrentStep(2)}>Ubah</Button>
              </>
            )}
          </div>

          {/* Column 3: Penumpang / Bayar / Summary */}
          <div className="bg-card rounded-lg p-4">
            {state.currentStep === 4 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default">4</Badge>
                  Data Penumpang
                </h2>
                <PassengerForm selectedSeats={state.selectedSeats} passengers={state.passengers} onPassengersUpdate={handlePassengersUpdate} onNext={nextStep} onBack={prevStep} />
              </>
            )}

            {state.currentStep === 5 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default">5</Badge>
                  Pembayaran
                </h2>
                <PaymentPanel totalAmount={totalAmount} payment={state.payment} onPaymentUpdate={handlePaymentUpdate} onSubmit={handleCreateBooking} onBack={prevStep} loading={bookingLoading} />
              </>
            )}

            {state.currentStep < 4 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Ringkasan
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Outlet</span><span>{state.outlet?.name || '-'}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Jadwal</span><span>{selectedCsoTrip?.patternPath || '-'}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Rute</span><span>{state.originStop && state.destinationStop ? `${state.originStop.code} &rarr; ${state.destinationStop.code}` : '-'}</span></div>
                  <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Kursi</span><span>{state.selectedSeats.length > 0 ? state.selectedSeats.join(', ') : '-'}</span></div>
                </div>
                {state.selectedSeats.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-lg mt-3">
                    <div className="flex justify-between"><span>Total</span><span className="font-bold text-primary">{formatCurrency(totalAmount)}</span></div>
                  </div>
                )}
                <div className="space-y-2 mt-4">
                  {state.currentStep > 1 && <Button variant="outline" className="w-full" onClick={prevStep}><ChevronLeft className="w-4 h-4 mr-1" /> Kembali</Button>}
                  {canProceed() && state.currentStep < 5 && <Button className="w-full" onClick={nextStep}>Lanjut <ChevronRight className="w-4 h-4 ml-1" /></Button>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {isMaterializing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Memproses jadwal...</span>
          </div>
        </div>
      )}
    </div>
  );
}