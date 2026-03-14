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
import { ChevronLeft, ChevronRight, Check, MapPin, Grid3X3, Users, Ticket, Loader2, Clock, Bus, ArrowRight, Calendar } from 'lucide-react';
import type { Trip, Stop, Outlet, CsoAvailableTrip } from '@/types';

const STEPS = [
  { id: 1, name: 'Jadwal', icon: MapPin },
  { id: 2, name: 'Rute', icon: MapPin },
  { id: 3, name: 'Kursi', icon: Grid3X3 },
  { id: 4, name: 'Penumpang', icon: Users }
];

// Helper to format time
const formatTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    });
  } catch {
    return '--:--';
  }
};

// Helper to format date
const formatDate = (isoString: string | null | undefined): string => {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return '-';
  }
};

// Helper to calculate duration
const calculateDuration = (depart: string | null | undefined, arrive: string | null | undefined): string => {
  if (!depart || !arrive) return '-';
  try {
    const departDate = new Date(depart);
    const arriveDate = new Date(arrive);
    const diffMinutes = Math.round((arriveDate.getTime() - departDate.getTime()) / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes} menit`;
  } catch {
    return '-';
  }
};

export default function CsoPage() {
  const [bookingResult, setBookingResult] = useState<{ booking: any; printPayload: any } | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedCsoTrip, setSelectedCsoTrip] = useState<CsoAvailableTrip | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  
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
    createPendingBooking,
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
    setSelectedCsoTrip(csoTrip);
    updateState({
      trip: {
        id: csoTrip.tripId || '',
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
    setCurrentStep(2);
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

  const handlePay = () => {
    nextStep();
  };

  const handleBook = async () => {
    setIsProcessing(true);
    try {
      const result = await createPendingBooking();
      setBookingResult(result);
      setCurrentStep(6);
    } catch (error) {
      console.error('Pending booking failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentUpdate = (payment: any) => updateState({ payment });

  const handleCreateBooking = async () => {
    setIsProcessing(true);
    try {
      const result = await createBooking();
      setBookingResult(result);
      setCurrentStep(6);
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setIsProcessing(false);
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
      default: return false;
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  // Calculate journey duration
  const journeyDuration = selectedCsoTrip?.departAtAtOutlet && selectedCsoTrip?.finalArrivalAt
    ? calculateDuration(selectedCsoTrip.departAtAtOutlet, selectedCsoTrip.finalArrivalAt)
    : '-';

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
                  <div className="flex justify-between"><span className="text-muted-foreground">Rute:</span><span className="font-medium">{state.originStop?.name || state.originStop?.code} <ArrowRight className="w-3 h-3 inline" /> {state.destinationStop?.name || state.destinationStop?.code}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kursi:</span><span className="font-medium">{state.selectedSeats.join(', ')}</span></div>
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
                <PassengerForm 
                  selectedSeats={state.selectedSeats} 
                  passengers={state.passengers} 
                  onPassengersUpdate={handlePassengersUpdate} 
                  onBook={handleBook}
                  onPay={handlePay}
                  onBack={prevStep}
                  loading={isProcessing}
                />
              </>
            )}

            {state.currentStep === 5 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="default">5</Badge>
                  Pembayaran
                </h2>
                <PaymentPanel totalAmount={totalAmount} payment={state.payment} onPaymentUpdate={handlePaymentUpdate} onSubmit={handleCreateBooking} onBack={prevStep} loading={isProcessing} />
              </>
            )}

            {state.currentStep < 4 && (
              <>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Ringkasan
                </h2>
                
                {/* Trip Info Card */}
                {selectedCsoTrip && (
                  <div className="bg-muted/30 rounded-lg p-3 mb-3 space-y-2">
                    {/* Date & Time */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{formatDate(selectedCsoTrip.departAtAtOutlet)}</span>
                      <span className="text-primary font-bold">{formatTime(selectedCsoTrip.departAtAtOutlet)}</span>
                    </div>
                    
                    {/* Route */}
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedCsoTrip.patternPath}</span>
                    </div>
                    
                    {/* Duration & Vehicle */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{journeyDuration}</span>
                      </div>
                      {selectedCsoTrip.vehicle?.code && (
                        <div className="flex items-center gap-1">
                          <Bus className="w-4 h-4 text-muted-foreground" />
                          <span>{selectedCsoTrip.vehicle.code}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Available Seats */}
                    {selectedCsoTrip.availableSeats !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        <span className={selectedCsoTrip.availableSeats > 5 ? 'text-green-600' : selectedCsoTrip.availableSeats > 0 ? 'text-amber-600' : 'text-red-600'}>
                          {selectedCsoTrip.availableSeats} kursi tersedia
                        </span>
                        <span className="mx-1">•</span>
                        <span>dari {selectedCsoTrip.capacity || '?'} total</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Selection Summary */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Outlet</span>
                    <span className="font-medium">{state.outlet?.name || '-'}</span>
                  </div>
                  
                  {state.originStop && state.destinationStop && (
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Titik Naik/Turun</span>
                      <span className="font-medium">
                        {state.originStop.code} <ArrowRight className="w-3 h-3 inline" /> {state.destinationStop.code}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Kursi Dipilih</span>
                    <span className="font-medium">{state.selectedSeats.length > 0 ? state.selectedSeats.join(', ') : '-'}</span>
                  </div>
                </div>
                
                {/* Total */}
                {state.selectedSeats.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-lg mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total ({state.selectedSeats.length} penumpang)</span>
                      <span className="font-bold text-lg text-primary">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 mt-4">
                  {state.currentStep > 1 && <Button variant="outline" className="w-full" onClick={prevStep}><ChevronLeft className="w-4 h-4 mr-1" /> Kembali</Button>}
                  {canProceed() && state.currentStep < 4 && <Button className="w-full" onClick={nextStep}>Lanjut <ChevronRight className="w-4 h-4 ml-1" /></Button>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Memproses booking...</span>
          </div>
        </div>
      )}
    </div>
  );
}
