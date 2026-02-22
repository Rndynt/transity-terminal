import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import TripSelector from '@/components/cso/TripSelector';
import RouteTimeline from '@/components/cso/RouteTimeline';
import SeatMap from '@/components/cso/SeatMap';
import PassengerForm from '@/components/cso/PassengerForm';
import PaymentPanel from '@/components/cso/PaymentPanel';
import PrintPreview from '@/components/cso/PrintPreview';
import { useBookingFlow } from '@/hooks/useBookingFlow';
import { useSeatHold } from '@/hooks/useSeatHold';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Users, CreditCard, CheckCircle, Circle, Loader2 } from 'lucide-react';
import type { Trip, Stop, Outlet, CsoAvailableTrip } from '@/types';

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
        console.error('Failed to calculate total amount:', error);
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
    releaseAllHolds();
    setSelectedCsoTrip(undefined);
  };

  const handleTripSelect = (csoTrip: CsoAvailableTrip) => {
    setSelectedCsoTrip(csoTrip);
    const trip: Trip = {
      id: csoTrip.tripId || '', 
      patternId: '', 
      vehicleId: '', 
      serviceDate: csoTrip.departAtAtOutlet ? new Date(csoTrip.departAtAtOutlet).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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
    updateState({ 
      destinationStop: stop, 
      destinationSeq: sequence 
    });
  };

  const handleSeatSelect = (seatNo: string) => addSeat(seatNo);
  const handleSeatDeselect = (seatNo: string) => removeSeat(seatNo);
  const handlePassengersUpdate = (passengers: any[]) => updatePassengers(passengers);
  const handlePaymentUpdate = (payment: any) => updateState({ payment });

  const handleCreateBooking = async () => {
    try {
      const result = await createBooking();
      setBookingResult(result);
      setCurrentStep(7);
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

  const handleStepClick = (stepNumber: number) => {
    if (stepNumber <= state.currentStep) {
      setCurrentStep(stepNumber);
    }
  };
    releaseAllHolds();
  };

  // Steps configuration
  const steps = [
    { id: 1, name: 'Outlet & Trip', icon: Circle },
    { id: 2, name: 'Rute', icon: Circle },
    { id: 3, name: 'Kursi', icon: Circle },
    { id: 4, name: 'Penumpang', icon: Users },
    { id: 5, name: 'Pembayaran', icon: CreditCard },
  ];

  const currentStepIndex = state.currentStep <= 2 ? 0 : state.currentStep - 2;
  const currentStep = steps[currentStepIndex] || steps[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">CSO Booking Terminal</h1>
            <p className="text-xs text-muted-foreground">Sistem Reservasi Tiket Bus</p>
          </div>
          
          {state.outlet && (
            <Badge variant="outline" className="bg-primary/10">
              {state.outlet.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {/* Step Indicator */}
        {state.currentStep < 7 && (
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 md:space-x-4 lg:space-x-8 min-w-max px-4">
              {[
                { id: 1, name: 'Outlet', icon: '1' },
                { id: 2, name: 'Trip', icon: '2' },
                { id: 3, name: 'Route', icon: '3' },
                { id: 4, name: 'Seats', icon: '4' },
                { id: 5, name: 'Passengers', icon: '5' },
                { id: 6, name: 'Payment', icon: '6' }
              ].map((step, index) => {
                const isActive = state.currentStep === step.id;
                const isCompleted = state.currentStep > step.id;
                const isClickable = state.currentStep >= step.id;
                
                return (
                  <div key={step.id} className="flex items-center">
                    <div 
                      className={`flex flex-col items-center cursor-pointer ${
                        isClickable ? 'hover:opacity-80' : 'opacity-50'
                      }`}
                      onClick={() => isClickable && handleStepClick(step.id)}
                    >
                      <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : isCompleted 
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {isCompleted ? '✓' : step.icon}
                      </div>
                      <span className={`text-[10px] md:text-xs mt-1 text-center leading-tight ${
                        isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                      }`}>
                        {step.name}
                      </span>
                    </div>
                    {index < 5 && (
                      <div className={`h-px w-4 md:w-8 lg:w-16 mx-1 md:mx-2 lg:mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-border'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Always visible */}
          <div className="lg:col-span-3 space-y-4">
            {/* Booking Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ringkasan Booking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {/* Trip Info */}
                {selectedCsoTrip && (
                  <div className="pb-3 border-b">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>Jadwal</span>
                    </div>
                    <p className="font-medium">{selectedCsoTrip.patternPath}</p>
                    {selectedCsoTrip.departAtAtOutlet && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedCsoTrip.departAtAtOutlet).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Jakarta'
                        })} WIB
                        {selectedCsoTrip.finalArrivalAt && (
                          <> → {new Date(selectedCsoTrip.finalArrivalAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Jakarta'
                          })} WIB</>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* Route Info */}
                {state.originStop && state.destinationStop && (
                  <div className="pb-3 border-b">
                    <div className="text-xs text-muted-foreground mb-1">Rute</div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{state.originStop.code}</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className="font-medium">{state.destinationStop.code}</span>
                    </div>
                  </div>
                )}

                {/* Seats Info */}
                {state.selectedSeats.length > 0 && (
                  <div className="pb-3 border-b">
                    <div className="text-xs text-muted-foreground mb-1">Kursi ({state.selectedSeats.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {state.selectedSeats.map(seat => (
                        <Badge key={seat} variant="secondary" className="text-xs">
                          {seat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Passengers Info */}
                {state.passengers.length > 0 && (
                  <div className="pb-3 border-b">
                    <div className="text-xs text-muted-foreground mb-1">Penumpang ({state.passengers.length})</div>
                    <p className="truncate">{state.passengers.map(p => p.fullName).join(', ')}</p>
                  </div>
                )}

                {/* Total */}
                {state.selectedSeats.length > 0 && (
                  <div className="pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total</span>
                      <span className="text-lg font-bold text-primary">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          minimumFractionDigits: 0
                        }).format(totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {state.currentStep > 1 && state.currentStep < 7 && (
              <Card>
                <CardContent className="p-3 space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Ganti Jadwal
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-muted-foreground"
                    onClick={handleNewBooking}
                  >
                    Mulai Baru
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle Column - Main Content */}
          <div className="lg:col-span-6">
            {/* Step 7: Print Preview */}
            {state.currentStep === 7 && bookingResult && (
              <PrintPreview
                booking={bookingResult.booking}
                printPayload={bookingResult.printPayload}
                onNewBooking={handleNewBooking}
                onPrint={() => window.print()}
              />
            )}

            {/* Steps 1-2: Outlet & Trip Selection */}
            {state.currentStep <= 2 && (
              <Card>
                <CardContent className="p-4">
                  <TripSelector
                    selectedOutlet={state.outlet}
                    selectedTrip={selectedCsoTrip}
                    onOutletSelect={handleOutletSelect}
                    onTripSelect={handleTripSelect}
                  />
                  
                  {/* Next Button */}
                  {canProceedToNextStep() && (
                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        className="w-full"
                        onClick={nextStep}
                      >
                        Lanjutkan ke Pemilihan Rute
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Route Selection */}
            {state.currentStep === 3 && (
              <Card>
                <CardContent className="p-4">
                  {state.trip ? (
                    <>
                      <RouteTimeline
                        trip={state.trip}
                        selectedOrigin={state.originStop}
                        selectedDestination={state.destinationStop}
                        onOriginSelect={handleOriginSelect}
                        onDestinationSelect={handleDestinationSelect}
                      />
                      
                      {/* Navigation */}
                      <div className="mt-4 pt-4 border-t flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={prevStep}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Kembali
                        </Button>
                        
                        {canProceedToNextStep() && (
                          <Button 
                            className="flex-1"
                            onClick={nextStep}
                          >
                            Lanjutkan ke Pemilihan Kursi
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Pilih trip terlebih dahulu</p>
                      <Button onClick={() => setCurrentStep(1)} className="mt-2">
                        Kembali ke Pemilihan Trip
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 4: Seat Selection */}
            {state.currentStep === 4 && (
              <Card>
                <CardContent className="p-4">
                  {state.trip && state.originSeq && state.destinationSeq ? (
                    <>
                      <SeatMap
                        trip={state.trip}
                        originSeq={state.originSeq}
                        destinationSeq={state.destinationSeq}
                        selectedSeats={state.selectedSeats}
                        onSeatSelect={handleSeatSelect}
                        onSeatDeselect={handleSeatDeselect}
                      />
                      
                      {/* Navigation */}
                      <div className="mt-4 pt-4 border-t flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={prevStep}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Kembali
                        </Button>
                        
                        {state.selectedSeats.length > 0 && (
                          <Button 
                            className="flex-1"
                            onClick={nextStep}
                          >
                            Lanjutkan ke Data Penumpang
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Pilih rute terlebih dahulu</p>
                      <Button onClick={() => setCurrentStep(3)} className="mt-2">
                        Kembali ke Pemilihan Rute
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 5: Passenger Form */}
            {state.currentStep === 5 && (
              <PassengerForm
                selectedSeats={state.selectedSeats}
                passengers={state.passengers}
                onPassengersUpdate={handlePassengersUpdate}
                onNext={nextStep}
                onBack={prevStep}
              />
            )}

            {/* Step 6: Payment */}
            {state.currentStep === 6 && (
              <PaymentPanel
                totalAmount={totalAmount}
                payment={state.payment}
                onPaymentUpdate={handlePaymentUpdate}
                onSubmit={handleCreateBooking}
                onBack={prevStep}
                loading={bookingLoading}
              />
            )}
          </div>

          {/* Right Column - Additional Info */}
          <div className="lg:col-span-3 space-y-4">
            {/* Current Trip Info */}
            {selectedCsoTrip && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Info Trip</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={selectedCsoTrip.isVirtual ? "outline" : "default"}>
                      {selectedCsoTrip.isVirtual ? 'Virtual' : 'Aktif'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kapasitas</span>
                    <span>{selectedCsoTrip.capacity} kursi</span>
                  </div>
                  {selectedCsoTrip.vehicle && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kendaraan</span>
                      <span>{selectedCsoTrip.vehicle.code}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jumlah Stop</span>
                    <span>{selectedCsoTrip.stopCount} titik</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Help Card */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <h4 className="font-medium text-sm mb-2">Butuh Bantuan?</h4>
                <p className="text-xs text-muted-foreground">
                  Hubungi supervisor atau teknisi jika mengalami kendala dalam proses booking.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
