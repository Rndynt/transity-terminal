import { useState, useEffect } from 'react';
import TripSelector from '@/components/cso/TripSelector';
import RouteTimeline from '@/components/cso/RouteTimeline';
import SeatMap from '@/components/cso/SeatMap';
import PassengerForm from '@/components/cso/PassengerForm';
import PrintPreview from '@/components/cso/PrintPreview';

import { useBookingFlow } from '@/hooks/useBookingFlow';
import { useSeatHold } from '@/hooks/useSeatHold';
import {
  ChevronRight, ChevronLeft, Loader2, MapPin,
  Armchair, ArrowRight
} from 'lucide-react';
import type { Stop, Outlet, CsoAvailableTrip } from '@/types';

type Phase = 'select' | 'book';

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

export default function CsoPage() {
  const [phase, setPhase] = useState<Phase>('select');
  const [bookingResult, setBookingResult] = useState<{ booking: any; printPayload: any } | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedCsoTrip, setSelectedCsoTrip] = useState<CsoAvailableTrip | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    state,
    updateState,
    setCurrentStep,
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
    setPhase('select');
    setShowPrint(false);
    setBookingResult(null);
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
      },
      originStop: undefined,
      destinationStop: undefined,
      originSeq: undefined,
      destinationSeq: undefined,
      selectedSeats: [],
      passengers: []
    });
    setCurrentStep(2);
  };

  const handleOriginSelect = (stop: Stop, sequence: number) => {
    updateState({
      originStop: stop,
      originSeq: sequence,
      ...(state.destinationSeq && state.destinationSeq <= sequence
        ? { destinationStop: undefined, destinationSeq: undefined }
        : {})
    });
  };

  const handleDestinationSelect = (stop: Stop, sequence: number) => {
    updateState({ destinationStop: stop, destinationSeq: sequence });
  };

  const handleSeatSelect = (seatNo: string) => addSeat(seatNo);
  const handleSeatDeselect = (seatNo: string) => removeSeat(seatNo);

  const handlePassengersUpdate = (passengers: any[]) => updatePassengers(passengers);

  const handleProceedToBook = () => {
    if (state.originStop && state.destinationStop) {
      setPhase('book');
      setCurrentStep(3);
    }
  };

  const handleBackToSelect = () => {
    setPhase('select');
    updateState({ selectedSeats: [], passengers: [], payment: undefined });
    releaseAllHolds();
  };

  const handleBookWithData = async (passengers: any[]) => {
    updatePassengers(passengers);
    setIsProcessing(true);
    try {
      const result = await createPendingBooking({ passengers });
      setBookingResult(result);
      setShowPrint(true);
    } catch (error) {
      console.error('Pending booking failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentUpdate = (payment: any) => updateState({ payment });

  const handlePayWithData = async (passengers: any[], payment: { method: string; amount: number }) => {
    const paymentWithTotal = { ...payment, amount: totalAmount };
    updatePassengers(passengers);
    updateState({ payment: paymentWithTotal });
    setIsProcessing(true);
    try {
      const result = await createBooking({ passengers, payment: paymentWithTotal });
      setBookingResult(result);
      setShowPrint(true);
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewBooking = () => {
    setBookingResult(null);
    setSelectedCsoTrip(undefined);
    setShowPrint(false);
    setPhase('select');
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

  const handleBackFromPrint = () => {
    setShowPrint(false);
  };

  return (
    <div className="flex flex-col h-full -m-3 lg:-m-6" data-testid="cso-page">
      <div className="h-10 bg-card border-b border-border flex items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {showPrint ? (
            <>
              <button
                onClick={handleBackFromPrint}
                className="text-xs text-primary hover:underline"
                data-testid="breadcrumb-back-book"
              >
                Kursi & Penumpang
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 mx-0.5" />
              <span className="text-xs text-muted-foreground">Tiket</span>
            </>
          ) : phase === 'book' ? (
            <>
              <button
                onClick={handleBackToSelect}
                className="text-xs text-primary hover:underline"
                data-testid="breadcrumb-back-select"
              >
                Jadwal & Rute
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 mx-0.5" />
              <span className="text-xs text-muted-foreground">Kursi & Penumpang</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Jadwal & Rute</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {phase === 'book' && !showPrint && (
            <button
              onClick={handleBackToSelect}
              className="px-3 py-1.5 bg-card border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              data-testid="btn-back-to-select"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Ubah Rute
            </button>
          )}
          {showPrint && (
            <button
              onClick={handleBackFromPrint}
              className="px-3 py-1.5 bg-card border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              data-testid="btn-back-from-print"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Kembali
            </button>
          )}
        </div>
      </div>

      {showPrint ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {bookingResult ? (
              <PrintPreview
                booking={bookingResult.booking}
                printPayload={bookingResult.printPayload}
                onNewBooking={handleNewBooking}
                onPrint={() => window.print()}
              />
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                <p>Memuat data booking...</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {phase === 'book' && selectedCsoTrip && state.originStop && state.destinationStop && (
            <div className="bg-primary/5 border-b border-primary/10 px-5 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="font-semibold text-primary">{formatTime(selectedCsoTrip.departAtAtOutlet)}</span>
                <span>{state.originStop.name} <ArrowRight className="w-3 h-3 inline" /> {state.destinationStop.name}</span>
                {selectedCsoTrip.vehicle?.code && (
                  <span className="text-gray-400">{selectedCsoTrip.vehicle.code}</span>
                )}
              </div>
              <button
                onClick={handleBackToSelect}
                className="px-3 py-1.5 bg-white border border-gray-200 hover:border-primary/30 hover:bg-primary/5 text-gray-600 hover:text-primary rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                data-testid="btn-change-route"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Ubah Rute
              </button>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
            {phase === 'select' && (
              <>
                <div className="flex-1 border-r border-gray-200 overflow-y-auto p-5" data-testid="panel-trip-selector">
                  <TripSelector
                    selectedOutlet={state.outlet}
                    selectedTrip={selectedCsoTrip}
                    onOutletSelect={handleOutletSelect}
                    onTripSelect={handleTripSelect}
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-5" data-testid="panel-route-timeline">
                  {state.trip?.id ? (
                    <div className="space-y-4">
                      <RouteTimeline
                        trip={state.trip}
                        selectedOrigin={state.originStop}
                        selectedDestination={state.destinationStop}
                        onOriginSelect={handleOriginSelect}
                        onDestinationSelect={handleDestinationSelect}
                      />

                      {state.originStop && state.destinationStop && (
                        <button
                          onClick={handleProceedToBook}
                          className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
                          data-testid="btn-proceed-book"
                        >
                          Lanjut Pilih Kursi <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                      <MapPin className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Pilih jadwal di sebelah kiri</p>
                      <p className="text-xs text-gray-300 mt-1">Rute akan muncul di sini</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {phase === 'book' && (
              <>
                <div className="flex-1 border-r border-gray-200 overflow-y-auto p-5" data-testid="panel-seat-map">
                  {state.trip?.id && state.originSeq !== undefined && state.destinationSeq !== undefined ? (
                    <SeatMap
                      trip={state.trip}
                      originSeq={state.originSeq}
                      destinationSeq={state.destinationSeq}
                      selectedSeats={state.selectedSeats}
                      onSeatSelect={handleSeatSelect}
                      onSeatDeselect={handleSeatDeselect}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                      <Armchair className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Data kursi tidak tersedia</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col" data-testid="panel-passenger-payment">
                  {state.selectedSeats.length > 0 ? (
                    <PassengerForm
                      selectedSeats={state.selectedSeats}
                      passengers={state.passengers}
                      onPassengersUpdate={handlePassengersUpdate}
                      totalAmount={totalAmount}
                      onBook={handleBookWithData}
                      onPay={handlePayWithData}
                      onPaymentUpdate={handlePaymentUpdate}
                      payment={state.payment}
                      onBack={handleBackToSelect}
                      loading={isProcessing}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                      <Armchair className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Pilih kursi di sebelah kiri</p>
                      <p className="text-xs text-gray-300 mt-1">Form penumpang akan muncul di sini</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg flex items-center gap-3 shadow-xl">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-gray-700">Memproses booking...</span>
          </div>
        </div>
      )}
    </div>
  );
}
