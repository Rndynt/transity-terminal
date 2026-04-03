import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearch, useLocation } from 'wouter';
import { CanAccess } from '@/components/rbac/CanAccess';
import { usePermissions } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { fmtCurrency } from '@/lib/constants';
import { localDateStr } from '@/lib/date';
import TripSelector from '@/components/cso/TripSelector';
import RouteTimeline from '@/components/cso/RouteTimeline';
import SeatMap, { type AssignModeState, type RescheduleModeState } from '@/components/cso/SeatMap';
import PassengerForm from '@/components/cso/PassengerForm';
import type { PassengerData } from '@/components/cso/PassengerForm';
import { useRoundTripFlow } from '@/hooks/useRoundTripFlow';
import RoundTripStepper from '@/components/cso/RoundTripStepper';
import RoundTripPrintPreview from '@/components/cso/RoundTripPrintPreview';
import { pricingApi, outletsApi } from '@/lib/api';
import CargoWaybillPreview from '@/components/cso/CargoWaybillPreview';
import CsoCargoPanel from './CsoCargoPanel';
import ManifestDialog from '@/components/manifest/ManifestDialog';
import BatchRescheduleDialog from '@/components/cso/BatchRescheduleDialog';
import PrintPreview from '@/components/cso/PrintPreview';

import { useBookingFlow } from '@/hooks/useBookingFlow';
import { useSeatHold } from '@/hooks/useSeatHold';
import ModeTimer from '@/components/cso/ModeTimer';
import { useLayout, useHideAppHeader } from '@/components/layout/LayoutContext';
import {
  ChevronRight, ChevronLeft, Loader2, MapPin,
  Armchair, ArrowRight, Ticket, Package, Clock,
  FileText, Lock, CalendarClock, User, X, Menu
} from 'lucide-react';
import type { Stop, Outlet, CsoAvailableTrip, CargoShipmentWithStops } from '@/types';


type Phase = 'select' | 'book';
type MobilePanel = 'left' | 'right';
type CsoMode = 'penumpang' | 'kargo';

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
  const { openSidebar, isMobile } = useLayout();
  const { outletId: scopedOutletId, can } = usePermissions();
  const { toast } = useToast();
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const urlParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const initialTripId = urlParams.get('tripId') || undefined;
  const initialOutletId = urlParams.get('outletId') || undefined;
  const initialDate = urlParams.get('date') || undefined;
  const initialOriginStopId = urlParams.get('originStopId') || undefined;
  const initialDestinationStopId = urlParams.get('destinationStopId') || undefined;
  const initialAssignPassengerId = urlParams.get('assignPassengerId') || undefined;
  const initialAssignPassengerName = urlParams.get('assignPassengerName') || undefined;
  const initialAssignBookingCode = urlParams.get('assignBookingCode') || '';
  const initialAssignTicketNumber = urlParams.get('assignTicketNumber') || null;

  const [bookingMode, setBookingMode] = useState<'single' | 'round-trip'>('single');
  const [ppStep, setPpStep] = useState<1 | 2 | 3 | 4>(1);
  const roundTripFlow = useRoundTripFlow();
  const [ppResult, setPpResult] = useState<any>(null);
  const [ppFares, setPpFares] = useState<{ outbound: number; return: number }>({ outbound: 0, return: 0 });
  const [returnOutlet, setReturnOutlet] = useState<Outlet | undefined>();
  const [returnDate, setReturnDate] = useState<string>('');
  // Return trip sub-steps: 'route' = pilih rute pulang, 'seat' = pilih kursi pulang
  const [returnSubStep, setReturnSubStep] = useState<'route' | 'seat'>('route');
  const [returnSelectedTrip, setReturnSelectedTrip] = useState<CsoAvailableTrip | undefined>();
  const [returnOriginStopSel, setReturnOriginStopSel] = useState<Stop | undefined>();
  const [returnDestStopSel, setReturnDestStopSel] = useState<Stop | undefined>();
  const [returnOriginSeqSel, setReturnOriginSeqSel] = useState<number | undefined>();
  const [returnDestSeqSel, setReturnDestSeqSel] = useState<number | undefined>();
  const { data: allOutlets = [] } = useQuery({ queryKey: ['/api/outlets'], queryFn: outletsApi.getAll });

  const [assignModeInfo, setAssignModeInfo] = useState<AssignModeState | null>(
    initialAssignPassengerId && initialAssignPassengerName
      ? { passengerId: initialAssignPassengerId, passengerName: initialAssignPassengerName, ticketNumber: initialAssignTicketNumber, bookingCode: initialAssignBookingCode }
      : null
  );
  const [rescheduleModeInfo, setRescheduleModeInfo] = useState<RescheduleModeState | null>(null);

  const [phase, setPhase] = useState<Phase>('select');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('left');
  const [bookingResult, setBookingResult] = useState<{ booking: any; printPayload: any } | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedCsoTrip, setSelectedCsoTrip] = useState<CsoAvailableTrip | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [csoMode, setCsoMode] = useState<CsoMode>('penumpang');
  const [cargoResult, setCargoResult] = useState<CargoShipmentWithStops | null>(null);
  const [showCargoWaybill, setShowCargoWaybill] = useState(false);
  const [mobileCargoPanel, setMobileCargoPanel] = useState<'left' | 'right'>('left');
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [manifestDialogTripId, setManifestDialogTripId] = useState<string | null>(null);
  const [confirmCloseTrip, setConfirmCloseTrip] = useState(false);
  const [batchRescheduleState, setBatchRescheduleState] = useState<{
    show: boolean;
    passengers: any[];
    checking: boolean;
  }>({ show: false, passengers: [], checking: false });
  const [pendingRouteAutoSelect, setPendingRouteAutoSelect] = useState<{
    originStopId: string;
    destinationStopId: string;
  } | null>(
    initialOriginStopId && initialDestinationStopId
      ? { originStopId: initialOriginStopId, destinationStopId: initialDestinationStopId }
      : null
  );

  const tripId = selectedCsoTrip?.tripId;
  const isPastCsoTrip = selectedCsoTrip?.departAtAtOutlet
    ? new Date(selectedCsoTrip.departAtAtOutlet) < new Date()
    : false;

  const closeTripMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/trips/${id}/close`, { method: 'POST', credentials: 'include' })
        .then(async r => { if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); } return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cso/available-trips'] });
      toast({ title: 'Trip berhasil ditutup', description: 'Status trip diubah menjadi closed.' });
    },
    onError: (e: Error) => toast({ title: 'Gagal menutup trip', description: e.message, variant: 'destructive' }),
  });

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
    applyPromoCode,
    clearPromoCode,
    loading: bookingLoading
  } = useBookingFlow();

  const { releaseAllHolds } = useSeatHold();

  const returnInitialOutletId = useMemo(() => {
    if (!state.destinationStop) return undefined;
    return allOutlets.find((o: Outlet) => o.stopId === state.destinationStop!.id)?.id;
  }, [allOutlets, state.destinationStop]);

  useEffect(() => {
    if (state.selectedSeats.length === 0) {
      setTotalAmount(0);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const total = await calculateTotalAmount();
        setTotalAmount(total);
      } catch {
        setTotalAmount(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [state.trip?.id, state.originSeq, state.destinationSeq, state.selectedSeats.length, calculateTotalAmount]);

  const handleProceedToReturnTrip = async () => {
    if (!selectedCsoTrip || !state.originStop || !state.destinationStop || state.originSeq === undefined || state.destinationSeq === undefined) return;
    
    setIsProcessing(true);
    try {
      const fare = await pricingApi.quoteFare(
        selectedCsoTrip.tripId!,
        state.originSeq,
        state.destinationSeq,
        state.selectedSeats.length
      );
      setPpFares(prev => ({ ...prev, outbound: fare.perPassenger }));
      
      roundTripFlow.setOutbound(
        selectedCsoTrip,
        state.originStop,
        state.destinationStop,
        state.originSeq,
        state.destinationSeq,
        state.outlet
      );
      roundTripFlow.setOutboundSeats([...state.selectedSeats]);
      if (!returnDate) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + 1);
        setReturnDate(localDateStr(d));
      }
      setPpStep(2);
      setMobilePanel('left');
    } catch (e: any) {
      toast({ title: 'Gagal mengambil harga', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(true); // Should be false but task said setIsProcessing(true) then result then false
      setIsProcessing(false);
    }
  };

  const handleReturnTripSelect = (trip: CsoAvailableTrip) => {
    // Hanya simpan trip, reset pilihan rute/kursi, tampilkan RouteTimeline
    setReturnSelectedTrip(trip);
    setReturnOriginStopSel(undefined);
    setReturnDestStopSel(undefined);
    setReturnOriginSeqSel(undefined);
    setReturnDestSeqSel(undefined);
    roundTripFlow.setReturnSeats([]);
    setReturnSubStep('route');
    setMobilePanel('right');
  };

  const handleReturnProceedToSeat = () => {
    if (!returnSelectedTrip || !returnOriginStopSel || !returnDestStopSel ||
        returnOriginSeqSel === undefined || returnDestSeqSel === undefined) return;
    // Commit rute ke roundTripFlow dan pindah ke sub-step pilih kursi
    roundTripFlow.setReturnTrip(
      returnSelectedTrip,
      returnOriginStopSel,
      returnDestStopSel,
      returnOriginSeqSel,
      returnDestSeqSel
    );
    setReturnSubStep('seat');
    setMobilePanel('left');
  };

  const handleReturnNext = async (overrideSeats?: string[]) => {
    const seats = overrideSeats ?? roundTripFlow.state.returnSeats;
    if (!roundTripFlow.state.returnTrip || seats.length === 0 ||
        roundTripFlow.state.returnOriginSeq === undefined || roundTripFlow.state.returnDestinationSeq === undefined) return;
    
    setIsProcessing(true);
    try {
      const fare = await pricingApi.quoteFare(
        roundTripFlow.state.returnTrip.tripId!,
        roundTripFlow.state.returnOriginSeq,
        roundTripFlow.state.returnDestinationSeq,
        seats.length
      );
      setPpFares(prev => ({ ...prev, return: fare.perPassenger }));
      setPpStep(3);
    } catch (e: any) {
      toast({ title: 'Gagal mengambil harga', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRoundTripPayAndBook = async (passengers: PassengerData[], payment: { method: string; amount: number }) => {
    if (!roundTripFlow.state.outboundTrip || !roundTripFlow.state.returnTrip) return;
    setIsProcessing(true);
    try {
      const payload = {
        outbound: {
          tripId: roundTripFlow.state.outboundTrip.tripId,
          originStopId: roundTripFlow.state.outboundOriginStop?.id,
          destinationStopId: roundTripFlow.state.outboundDestinationStop?.id,
          originSeq: roundTripFlow.state.outboundOriginSeq,
          destinationSeq: roundTripFlow.state.outboundDestinationSeq,
          outletId: roundTripFlow.state.outboundOutlet?.id,
          passengers: roundTripFlow.state.outboundSeats.map((seatNo, i) => ({
            name: passengers[i]?.fullName || '',
            seatNo
          }))
        },
        return: {
          tripId: roundTripFlow.state.returnTrip.tripId,
          originStopId: roundTripFlow.state.returnOriginStop?.id,
          destinationStopId: roundTripFlow.state.returnDestinationStop?.id,
          originSeq: roundTripFlow.state.returnOriginSeq,
          destinationSeq: roundTripFlow.state.returnDestinationSeq,
          passengers: roundTripFlow.state.returnSeats.map((seatNo, i) => ({
            name: passengers[i]?.fullName || '',
            seatNo
          }))
        },
        payment: { method: payment.method, amount: payment.amount },
        channel: 'CSO'
      };
      const res = await apiRequest('POST', '/api/bookings/round-trip', payload);
      const result = await res.json();
      setPpResult(result);
      setPpStep(4);
    } catch (e: any) {
      toast({ title: 'Gagal membuat PP', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewRoundTrip = () => {
    roundTripFlow.reset();
    setPpStep(1);
    setPpResult(null);
    handleNewBooking();
  };

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
    clearPromoCode();
    setSelectedCsoTrip(undefined);
    setPhase('select');
    setAssignModeInfo(null);
    setRescheduleModeInfo(null);
    setMobilePanel('left');
    setShowPrint(false);
    setBookingResult(null);
    setCsoMode('penumpang');
    setCargoResult(null);
    setShowCargoWaybill(false);
    releaseAllHolds();
  };

  const handleTripSelect = async (csoTrip: CsoAvailableTrip) => {
    setSelectedCsoTrip(csoTrip);
    clearPromoCode();
    updateState({
      trip: {
        id: csoTrip.tripId || '',
        patternId: '',
        vehicleId: '',
        serviceDate: selectedDate,
        capacity: csoTrip.capacity || 0,
        status: csoTrip.status as any,
        layoutId: null,
        channelFlags: {},
        createdAt: null,
        deletedAt: null,
        driverId: null,
        manifestFirstPrintedAt: null,
        snapRouteName: null,
        snapVehiclePlate: null,
        snapDriverName: null,
        baseId: csoTrip.baseId || null,
        originDepartHHMM: null
      } as any,
      originStop: undefined,
      destinationStop: undefined,
      originSeq: undefined,
      destinationSeq: undefined,
      selectedSeats: [],
      passengers: []
    });
    setCurrentStep(2);
    setMobilePanel('right');
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
    updateState({
      destinationStop: stop,
      destinationSeq: sequence,
      ...(state.originSeq !== undefined && state.originSeq >= sequence
        ? { originStop: undefined, originSeq: undefined }
        : {})
    });
  };

  const handleSeatSelect = (seatNo: string) => addSeat(seatNo);
  const handleSeatDeselect = (seatNo: string) => removeSeat(seatNo);
  const handlePassengersUpdate = (passengers: PassengerData[]) => updatePassengers(passengers as any);

  const handleProceedToBook = () => {
    if (state.originStop && state.destinationStop) {
      setPhase('book');
      setCurrentStep(3);
      setMobilePanel('left');
    }
  };

  const handleBackToSelect = () => {
    setPhase('select');
    setMobilePanel('left');
    clearPromoCode();
    updateState({ selectedSeats: [], passengers: [], payment: undefined });
    releaseAllHolds();
    roundTripFlow.reset();
    setPpStep(1);
  };

  const handleBookWithData = async (passengers: PassengerData[]) => {
    updatePassengers(passengers as any);
    setIsProcessing(true);
    try {
      const result = await createPendingBooking({ passengers: passengers as any });
      setBookingResult(result);
      setShowPrint(true);
    } catch (error) {
      console.error('Pending booking failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentUpdate = (payment: any) => updateState({ payment });

  const handlePayWithData = async (passengers: PassengerData[], payment: { method: 'cash' | 'qr' | 'ewallet' | 'bank'; amount: number }) => {
    updatePassengers(passengers as any);
    updateState({ payment });
    setIsProcessing(true);
    try {
      const result = await createBooking({ passengers: passengers as any, payment });
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
    setMobilePanel('left');
    setCsoMode('penumpang');
    setCargoResult(null);
    setShowCargoWaybill(false);
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
    queryClient.invalidateQueries({ queryKey: ['/api/cso/available-trips'] });
  };

  const handleBackFromPrint = () => {
    setShowPrint(false);
    setShowCargoWaybill(false);
  };

  const handleCargoSuccess = (shipment: CargoShipmentWithStops) => {
    setCargoResult(shipment);
    setShowCargoWaybill(true);
  };

  const handleNewCargo = () => {
    setCargoResult(null);
    setShowCargoWaybill(false);
  };

  const selectedSeats = state.selectedSeats;
  const sortedSeats = [...selectedSeats].sort();
  const nowDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Jakarta' });

  const hideHeader = useHideAppHeader();
  useEffect(() => {
    return hideHeader();
  }, [hideHeader]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="cso-page">
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between px-3 md:px-5 h-11 md:h-12">
          <div className="flex items-center gap-1.5 min-w-0">
            {isMobile && (
              <button
                onClick={openSidebar}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0 mr-0.5"
                aria-label="Open sidebar"
                data-testid="cso-open-sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Ticket className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-bold text-gray-800 truncate hidden sm:inline">CSO Booking Terminal</span>
            <span className="text-sm font-bold text-gray-800 sm:hidden">CSO</span>

            <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 flex-shrink-0" />
            {phase === 'select' && (
              <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 text-xs">
                <button
                  onClick={() => setBookingMode('single')}
                  className={bookingMode === 'single' ? 'bg-white rounded-md px-3 py-1 shadow-sm font-medium text-gray-800' : 'px-3 py-1 text-gray-500'}
                  data-testid="btn-mode-single"
                >
                  Sekali Jalan
                </button>
                <button
                  onClick={() => setBookingMode('round-trip')}
                  className={bookingMode === 'round-trip' ? 'bg-white rounded-md px-3 py-1 shadow-sm font-medium text-blue-700' : 'px-3 py-1 text-gray-500'}
                  data-testid="btn-mode-round-trip"
                >
                  Pulang Pergi
                </button>
              </div>
            )}

            {showCargoWaybill ? (
              <>
                <button
                  onClick={handleBackFromPrint}
                  className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                  data-testid="breadcrumb-back-cargo"
                >
                  Kargo
                </button>
                <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-500">Resi</span>
              </>
            ) : showPrint ? (
              <>
                <button
                  onClick={handleBackFromPrint}
                  className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                  data-testid="breadcrumb-back-book"
                >
                  Kursi
                </button>
                <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-500">Tiket</span>
              </>
            ) : phase === 'book' ? (
              <>
                <button
                  onClick={handleBackToSelect}
                  className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                  data-testid="breadcrumb-back-select"
                >
                  Jadwal
                </button>
                <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-500 whitespace-nowrap">Kursi & Penumpang</span>
              </>
            ) : (
              <span className="text-xs text-gray-500 whitespace-nowrap">Jadwal & Rute</span>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 ml-2">
            {phase === 'book' && !showPrint && (
              <button
                onClick={handleBackToSelect}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-gray-200"
                data-testid="btn-back-select"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            )}
            {showPrint && (
              <button
                onClick={handleBackFromPrint}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-gray-200"
                data-testid="btn-back-booking"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            )}
            <div className="flex items-center gap-1.5 md:gap-3 text-[10px] md:text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-400" />
                <span className="hidden sm:inline">Online</span>
              </div>
              <span className="hidden md:inline">CSO User</span>
              <span className="font-mono">{nowDate}</span>
            </div>
          </div>
        </div>
      </div>

      {assignModeInfo && !rescheduleModeInfo && (
        <div className="bg-amber-50 border-b-2 border-amber-300 px-3 md:px-5 py-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Armchair className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs font-bold text-amber-700">Mode Assign Kursi</span>
              <span className="text-[10px] text-amber-600">Klik kursi yang tersedia</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ModeTimer
                key={`assign-${assignModeInfo.passengerId}`}
                onExpire={() => setAssignModeInfo(null)}
                colorClass="text-amber-600"
              />
              <button
                onClick={() => setAssignModeInfo(null)}
                className="p-1 rounded-md text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 px-6">
            <User className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <div className="text-[11px] text-gray-700 min-w-0">
              <span className="font-semibold">{assignModeInfo.passengerName}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="font-mono text-amber-600">{assignModeInfo.bookingCode}</span>
              {assignModeInfo.ticketNumber && (
                <>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="font-mono text-gray-500">{assignModeInfo.ticketNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {rescheduleModeInfo && (
        <div className="bg-amber-50 border-b-2 border-amber-300 px-3 md:px-5 py-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarClock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs font-bold text-amber-700">Mode Reschedule</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ModeTimer
                key={`reschedule-${rescheduleModeInfo.passengerId}`}
                onExpire={() => setRescheduleModeInfo(null)}
                colorClass="text-amber-600"
              />
              <button
                onClick={() => setRescheduleModeInfo(null)}
                className="p-1 rounded-md text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 px-6">
            <User className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <div className="text-[11px] text-gray-700 min-w-0">
              <span className="font-semibold">{rescheduleModeInfo.passengerName}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="font-mono text-amber-600">{rescheduleModeInfo.bookingCode}</span>
              {rescheduleModeInfo.ticketNumber && (
                <>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="font-mono text-gray-500">{rescheduleModeInfo.ticketNumber}</span>
                </>
              )}
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-gray-500">
                Kursi {rescheduleModeInfo.seatNo} ({rescheduleModeInfo.originStopName} → {rescheduleModeInfo.destinationStopName})
              </span>
            </div>
          </div>
          {rescheduleModeInfo.reason && (
            <p className="text-[10px] text-amber-500 mt-0.5 px-6 italic">
              Alasan: {rescheduleModeInfo.reason}
            </p>
          )}
          {phase === 'select' && (
            <p className="text-[10px] text-amber-600 font-medium mt-1 px-6">
              Pilih jadwal dan rute tujuan baru, lalu klik kursi yang tersedia
            </p>
          )}
        </div>
      )}

      {showCargoWaybill ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-lg mx-auto">
            <CargoWaybillPreview
              shipment={cargoResult!}
              onNewShipment={handleNewCargo}
              onPrint={() => window.print()}
            />
          </div>
        </div>
      ) : showPrint ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-lg mx-auto">
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
            <div className="bg-blue-50 border-b border-blue-100 px-3 md:px-5 py-2 flex items-center justify-between flex-shrink-0 gap-2">
              <div className="flex items-center gap-2 md:gap-3 text-xs text-gray-600 min-w-0 flex-wrap">
                <span className="font-semibold text-blue-700">{formatTime(selectedCsoTrip.departAtAtOutlet)}</span>
                <span className="truncate">{state.originStop.name} <ArrowRight className="w-3 h-3 inline" /> {state.destinationStop.name}</span>
                {selectedCsoTrip.vehicle?.code && (
                  <span className="text-gray-400 hidden sm:inline">{selectedCsoTrip.vehicle.code}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
                  <button
                    onClick={() => setCsoMode('penumpang')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                      csoMode === 'penumpang'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    data-testid="mode-penumpang"
                  >
                    <Ticket className="w-3 h-3" />
                    <span className="hidden sm:inline">Penumpang</span>
                  </button>
                  <button
                    onClick={() => setCsoMode('kargo')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                      csoMode === 'kargo'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    data-testid="mode-kargo"
                  >
                    <Package className="w-3 h-3" />
                    <span className="hidden sm:inline">Kargo</span>
                  </button>
                </div>
                <button
                  onClick={() => setManifestDialogTripId(selectedCsoTrip.tripId ?? null)}
                  className="px-2 md:px-3 py-1.5 bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                  data-testid="btn-cetak-manifest"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak Manifest</span>
                  <span className="sm:hidden">Manifest</span>
                </button>
                <CanAccess flag="action.trip.close">
                  {confirmCloseTrip ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-300 rounded-lg">
                      <span className="text-[11px] text-red-700 font-medium whitespace-nowrap">Yakin tutup trip?</span>
                      <button
                        onClick={async () => {
                          if (!selectedCsoTrip?.tripId) return;
                          setConfirmCloseTrip(false);
                          setBatchRescheduleState(prev => ({ ...prev, checking: true }));
                          try {
                            const res = await fetch(`/api/trips/${selectedCsoTrip.tripId}/active-passengers`, { credentials: 'include' });
                            if (!res.ok) {
                              setBatchRescheduleState({ show: false, passengers: [], checking: false });
                              toast({ title: 'Gagal mengecek penumpang', description: `HTTP ${res.status}`, variant: 'destructive' });
                              return;
                            }
                            const passengers = await res.json();
                            if (passengers.length > 0) {
                              setBatchRescheduleState({ show: true, passengers, checking: false });
                            } else {
                              setBatchRescheduleState({ show: false, passengers: [], checking: false });
                              closeTripMutation.mutate(selectedCsoTrip.tripId);
                            }
                          } catch (err) {
                            setBatchRescheduleState({ show: false, passengers: [], checking: false });
                            toast({ title: 'Gagal mengecek penumpang', description: err instanceof Error ? err.message : 'Terjadi kesalahan', variant: 'destructive' });
                          }
                        }}
                        disabled={closeTripMutation.isPending || batchRescheduleState.checking}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition-colors disabled:opacity-50"
                        data-testid="btn-confirm-close-trip"
                      >
                        {(closeTripMutation.isPending || batchRescheduleState.checking) ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ya'}
                      </button>
                      <button
                        onClick={() => setConfirmCloseTrip(false)}
                        className="px-2 py-0.5 bg-white hover:bg-gray-100 text-gray-600 rounded text-[11px] font-semibold border border-gray-200 transition-colors"
                        data-testid="btn-cancel-close-trip"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmCloseTrip(true)}
                      disabled={closeTripMutation.isPending || selectedCsoTrip?.status === 'closed'}
                      className="px-2 md:px-3 py-1.5 bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-600 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="btn-close-trip"
                    >
                      {closeTripMutation.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Lock className="w-3.5 h-3.5" />
                      }
                      <span className="hidden sm:inline">Tutup Trip</span>
                      <span className="sm:hidden">Tutup</span>
                    </button>
                  )}
                </CanAccess>
                <button
                  onClick={handleBackToSelect}
                  className="px-2 md:px-3 py-1.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                  data-testid="btn-change-route"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Ubah Rute</span><span className="sm:hidden">Ubah</span>
                </button>
              </div>
            </div>
          )}

          {phase === 'select' && (
            <>
              <div className="md:hidden flex-shrink-0 bg-white border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setMobilePanel('left')}
                    className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                      mobilePanel === 'left'
                        ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    data-testid="mobile-tab-trips"
                  >
                    Pilih Jadwal
                  </button>
                  <button
                    onClick={() => setMobilePanel('right')}
                    className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                      mobilePanel === 'right'
                        ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    data-testid="mobile-tab-route"
                  >
                    Pilih Rute
                  </button>
                </div>
              </div>

              {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {bookingMode === 'round-trip' && <RoundTripStepper currentStep={ppStep} />}

        <div className="flex-1 flex overflow-hidden">
          <div className={`flex-1 border-r border-gray-200 overflow-y-auto p-3 md:p-5 ${mobilePanel === 'left' ? 'block' : 'hidden md:block'}`} data-testid="panel-trip-selector">
            <TripSelector
              selectedOutlet={state.outlet}
              selectedTrip={selectedCsoTrip}
              onOutletSelect={handleOutletSelect}
              onTripSelect={handleTripSelect}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              initialOutletId={initialOutletId || (can('action.cso.cross_outlet') ? scopedOutletId ?? undefined : undefined)}
              lockedOutletId={scopedOutletId && !can('action.cso.cross_outlet') ? scopedOutletId : undefined}
              initialTripId={initialTripId}
              onInitialConsumed={() => navigate('/cso', { replace: true })}
              canViewClosed={can('page.cso.view_closed')}
            />
          </div>

          <div className={`flex-1 overflow-y-auto p-3 md:p-5 ${mobilePanel === 'right' ? 'block' : 'hidden md:block'}`} data-testid="panel-route-timeline">
            {state.trip?.id ? (
              <RouteTimeline
                trip={state.trip}
                selectedOrigin={state.originStop}
                selectedDestination={state.destinationStop}
                onOriginSelect={handleOriginSelect}
                onDestinationSelect={handleDestinationSelect}
                onProceed={handleProceedToBook}
                initialOriginStopId={pendingRouteAutoSelect?.originStopId}
                initialDestinationStopId={pendingRouteAutoSelect?.destinationStopId}
                onInitialRouteConsumed={() => {
                  setPendingRouteAutoSelect(null);
                  setTimeout(() => {
                    setPhase('book');
                    setCurrentStep(3);
                    setMobilePanel('left');
                  }, 100);
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 py-12 md:py-0">
                <MapPin className="w-8 h-8 text-gray-300 mb-1.5" />
                <p className="text-xs text-gray-400">Pilih jadwal terlebih dahulu</p>
              </div>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {phase === 'book' && csoMode === 'penumpang' && (
            <>
              <div className="md:hidden flex-shrink-0 bg-white border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setMobilePanel('left')}
                    className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                      mobilePanel === 'left'
                        ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    data-testid="mobile-tab-seats"
                  >
                    {bookingMode === 'round-trip' && ppStep === 2
                    ? (returnSubStep === 'seat' ? 'Pilih Kursi Pulang' : 'Pilih Jadwal Pulang')
                    : `Pilih Kursi${selectedSeats.length > 0 ? ` (${selectedSeats.length})` : ''}`}
                  </button>
                  <button
                    onClick={() => setMobilePanel('right')}
                    className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                      mobilePanel === 'right'
                        ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    data-testid="mobile-tab-passenger"
                  >
                    {bookingMode === 'round-trip' && ppStep === 2
                      ? 'Pilih Rute Pulang'
                      : bookingMode === 'round-trip' ? 'Penumpang & Bayar' : `Data & Bayar${totalAmount > 0 ? ` (${fmtCurrency(totalAmount)})` : ''}`}
                  </button>
                </div>
              </div>

              {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {bookingMode === 'round-trip' && <RoundTripStepper currentStep={ppStep} />}

          <div className="flex-1 flex overflow-hidden">

            {/* LEFT PANEL */}
            <div className={`flex-1 border-r border-gray-200 overflow-y-auto p-3 md:p-5 ${mobilePanel === 'left' ? 'block' : 'hidden md:block'}`} data-testid="panel-seat-map">
              {bookingMode === 'round-trip' && ppStep >= 3 ? (
                /* Steps 3-4: ringkasan pergi & pulang */
                <div className="flex flex-col gap-3 h-full">
                  {roundTripFlow.state.outboundTrip && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-[10px] text-blue-500 uppercase tracking-wider font-bold mb-2">Pergi</p>
                      <p className="text-sm font-semibold text-gray-800">{roundTripFlow.state.outboundTrip.patternPath}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatTime(roundTripFlow.state.outboundTrip.departAtAtOutlet)}
                        {roundTripFlow.state.outboundOriginStop && roundTripFlow.state.outboundDestinationStop && (
                          <> &mdash; {roundTripFlow.state.outboundOriginStop.name} <ArrowRight className="w-3 h-3 inline" /> {roundTripFlow.state.outboundDestinationStop.name}</>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {roundTripFlow.state.outboundSeats.map(s => (
                          <span key={s} className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-bold">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {roundTripFlow.state.returnTrip && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                      <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mb-2">Pulang</p>
                      <p className="text-sm font-semibold text-gray-800">{roundTripFlow.state.returnTrip.patternPath}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatTime(roundTripFlow.state.returnTrip.departAtAtOutlet)}
                        {roundTripFlow.state.returnOriginStop && roundTripFlow.state.returnDestinationStop && (
                          <> &mdash; {roundTripFlow.state.returnOriginStop.name} <ArrowRight className="w-3 h-3 inline" /> {roundTripFlow.state.returnDestinationStop.name}</>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {roundTripFlow.state.returnSeats.map(s => (
                          <span key={s} className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : bookingMode === 'round-trip' && ppStep === 2 ? (
                returnSubStep === 'route' ? (
                  /* Sub-step rute: kiri = pilih jadwal pulang */
                  <TripSelector
                    selectedOutlet={returnOutlet}
                    selectedTrip={returnSelectedTrip}
                    onOutletSelect={setReturnOutlet}
                    onTripSelect={handleReturnTripSelect}
                    selectedDate={returnDate}
                    onDateChange={setReturnDate}
                    initialOutletId={returnInitialOutletId}
                  />
                ) : (
                  /* Sub-step kursi: kiri = seat map return */
                  roundTripFlow.state.returnTrip && roundTripFlow.state.returnOriginSeq !== undefined && roundTripFlow.state.returnDestinationSeq !== undefined ? (
                    <SeatMap
                      trip={{ id: roundTripFlow.state.returnTrip.tripId, ...roundTripFlow.state.returnTrip } as any}
                      originSeq={roundTripFlow.state.returnOriginSeq}
                      destinationSeq={roundTripFlow.state.returnDestinationSeq}
                      selectedSeats={roundTripFlow.state.returnSeats}
                      onSeatSelect={(seat) => {
                        const needed = roundTripFlow.state.outboundSeats.length;
                        const current = roundTripFlow.state.returnSeats;
                        if (current.length < needed) {
                          const updated = [...current, seat];
                          roundTripFlow.setReturnSeats(updated);
                          if (updated.length === needed) {
                            handleReturnNext(updated);
                          }
                        }
                      }}
                      onSeatDeselect={(seat) => roundTripFlow.setReturnSeats(roundTripFlow.state.returnSeats.filter(s => s !== seat))}
                      originStopId={returnOriginStopSel?.id}
                      destinationStopId={returnDestStopSel?.id}
                    />
                  ) : null
                )
              ) : (
                <>
                  {state.trip?.id && state.originSeq !== undefined && state.destinationSeq !== undefined ? (
                    <SeatMap
                      trip={state.trip}
                      originSeq={state.originSeq}
                      destinationSeq={state.destinationSeq}
                      selectedSeats={state.selectedSeats}
                      onSeatSelect={handleSeatSelect}
                      onSeatDeselect={handleSeatDeselect}
                      isPastTrip={isPastCsoTrip}
                      externalAssignMode={assignModeInfo}
                      onAssignModeChange={(mode) => {
                        setAssignModeInfo(mode);
                        if (!mode) navigate('/cso');
                      }}
                      rescheduleMode={rescheduleModeInfo}
                      onRescheduleComplete={() => {
                        setRescheduleModeInfo(null);
                        navigate('/cso');
                      }}
                      onStartReschedule={(info) => {
                        setRescheduleModeInfo(info);
                      }}
                      originStopId={state.originStop?.id}
                      destinationStopId={state.destinationStop?.id}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                      <Armchair className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Data kursi tidak tersedia</p>
                    </div>
                  )}
                  {selectedSeats.length > 0 && (
                    <button
                      onClick={() => bookingMode === 'round-trip' ? handleProceedToReturnTrip() : setMobilePanel('right')}
                      className="md:hidden w-full mt-3 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                      data-testid="mobile-btn-to-passenger"
                    >
                      {bookingMode === 'round-trip' ? 'Lanjut ke Jadwal Pulang' : 'Lanjut Isi Data'} <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* RIGHT PANEL */}
            <div className={`flex-1 overflow-hidden flex-col relative ${mobilePanel === 'right' ? 'flex' : 'hidden md:flex'}`}>
              {bookingMode === 'round-trip' && ppStep === 3 ? (
                /* Step 3: form penumpang & bayar */
                roundTripFlow.state.outboundTrip && roundTripFlow.state.returnTrip &&
                roundTripFlow.state.outboundOriginStop && roundTripFlow.state.outboundDestinationStop ? (
                  <div className="flex-1 overflow-y-auto">
                    <PassengerForm
                      selectedSeats={roundTripFlow.state.outboundSeats}
                      returnSeats={roundTripFlow.state.returnSeats}
                      passengers={roundTripFlow.state.outboundSeats.map((seatNo, i) => ({
                        fullName: roundTripFlow.state.passengers[i]?.name || '',
                        phone: '',
                        idNumber: '',
                        seatNo,
                      }))}
                      onPassengersUpdate={(updated: PassengerData[]) => {
                        roundTripFlow.setPassengers(updated.map((p, i) => ({
                          name: p.fullName,
                          seatNoOutbound: p.seatNo,
                          seatNoReturn: roundTripFlow.state.returnSeats[i] || '',
                        })));
                      }}
                      outboundContext={{
                        trip: roundTripFlow.state.outboundTrip,
                        originStop: roundTripFlow.state.outboundOriginStop,
                        destinationStop: roundTripFlow.state.outboundDestinationStop,
                      }}
                      returnContext={{
                        trip: roundTripFlow.state.returnTrip,
                        originStop: roundTripFlow.state.returnOriginStop ?? roundTripFlow.state.outboundDestinationStop,
                        destinationStop: roundTripFlow.state.returnDestinationStop ?? roundTripFlow.state.outboundOriginStop,
                      }}
                      totalAmount={(ppFares.outbound + ppFares.return) * roundTripFlow.state.outboundSeats.length}
                      onPay={handleRoundTripPayAndBook}
                      onPaymentUpdate={() => {}}
                      onBack={() => setPpStep(2)}
                      loading={isProcessing}
                      promoCode={state.promoCode}
                      discountAmount={state.discountAmount || 0}
                      onApplyPromo={applyPromoCode}
                      onClearPromo={clearPromoCode}
                    />
                  </div>
                ) : null
              ) : bookingMode === 'round-trip' && ppStep === 4 ? (
                /* Step 4: print preview */
                ppResult ? (
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                    <RoundTripPrintPreview
                      group={ppResult}
                      outboundBooking={ppResult.outboundBooking}
                      returnBooking={ppResult.returnBooking}
                      printPayloads={ppResult.printPayloads || []}
                      onNewBooking={handleNewRoundTrip}
                      onPrint={() => window.print()}
                    />
                  </div>
                ) : null
              ) : bookingMode === 'round-trip' && ppStep === 2 ? (
                returnSubStep === 'route' ? (
                  /* Sub-step rute: kanan = RouteTimeline pilih rute pulang */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-3 md:p-5">
                      {returnSelectedTrip ? (
                        <RouteTimeline
                          trip={{ id: returnSelectedTrip.tripId, ...returnSelectedTrip } as any}
                          selectedOrigin={returnOriginStopSel}
                          selectedDestination={returnDestStopSel}
                          onOriginSelect={(stop, seq) => { setReturnOriginStopSel(stop); setReturnOriginSeqSel(seq); }}
                          onDestinationSelect={(stop, seq) => { setReturnDestStopSel(stop); setReturnDestSeqSel(seq); }}
                          onProceed={handleReturnProceedToSeat}
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300">
                          <MapPin className="w-10 h-10 mb-2" />
                          <p className="text-sm text-gray-400 text-center font-medium">Pilih jadwal pulang<br />di panel kiri</p>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 p-3 border-t border-gray-100">
                      <button
                        onClick={() => { setPpStep(1); setMobilePanel('left'); }}
                        className="h-10 px-4 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm flex items-center gap-1.5 hover:bg-gray-200"
                        data-testid="btn-return-back-route"
                      >
                        <ChevronLeft className="w-4 h-4" /> Kembali ke Pergi
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Sub-step kursi: kanan = loading saja, langsung lanjut ke form penumpang */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                          <p className="text-sm text-gray-500 font-medium">Memuat harga...</p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-300">
                          <Armchair className="w-10 h-10" />
                          <p className="text-sm text-gray-400 text-center">Pilih kursi di panel kiri</p>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 p-3 border-t border-gray-100">
                      <button
                        onClick={() => { setReturnSubStep('route'); setMobilePanel('right'); roundTripFlow.setReturnSeats([]); }}
                        className="h-10 px-4 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm flex items-center gap-1.5 hover:bg-gray-200"
                        data-testid="btn-return-back-to-route"
                      >
                        <ChevronLeft className="w-4 h-4" /> Ganti Rute
                      </button>
                    </div>
                  </div>
                )
              ) : bookingMode === 'round-trip' ? (
                /* Step 1 RT right: selected seats + proceed */
                <div className="flex-1 overflow-y-auto p-3 md:p-5 flex flex-col gap-3">
                  {state.selectedSeats.length > 0 ? (
                    <>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Kursi Pergi Terpilih</p>
                        <div className="flex flex-wrap gap-1.5">
                          {state.selectedSeats.map(seat => (
                            <span key={seat} className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">{seat}</span>
                          ))}
                        </div>
                        {state.originStop && state.destinationStop && (
                          <p className="text-xs text-gray-500 mt-2">
                            {state.originStop.name} <ArrowRight className="w-3 h-3 inline" /> {state.destinationStop.name}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto pt-2">
                        <button
                          onClick={handleProceedToReturnTrip}
                          disabled={isProcessing}
                          className="w-full h-11 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm disabled:opacity-50"
                          data-testid="btn-proceed-to-return"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                          Pilih Jadwal Pulang
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                      <Armchair className="w-10 h-10 mb-2" />
                      <p className="text-sm text-gray-400 text-center">Pilih kursi keberangkatan terlebih dahulu</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Single mode: PassengerForm */
                <div className="flex-1 overflow-y-auto p-3 md:p-5">
                  <PassengerForm
                    selectedSeats={selectedSeats}
                    passengers={selectedSeats.map(seatNo => ({
                      fullName: (state.passengers as any[]).find((p: any) => p.seatNo === seatNo)?.fullName || '',
                      phone: (state.passengers as any[]).find((p: any) => p.seatNo === seatNo)?.phone || '',
                      idNumber: (state.passengers as any[]).find((p: any) => p.seatNo === seatNo)?.idNumber || '',
                      seatNo,
                    }))}
                    onPassengersUpdate={handlePassengersUpdate}
                    totalAmount={totalAmount}
                    onBook={handleBookWithData}
                    onPay={handlePayWithData}
                    onPaymentUpdate={handlePaymentUpdate}
                    payment={state.payment}
                    onBack={handleBackToSelect}
                    loading={isProcessing}
                    promoCode={state.promoCode}
                    discountAmount={state.discountAmount || 0}
                    onApplyPromo={applyPromoCode}
                    onClearPromo={clearPromoCode}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}

    {phase === 'book' && csoMode === 'kargo' && (
            <CsoCargoPanel
              state={state as any}
              selectedCsoTrip={selectedCsoTrip}
              mobileCargoPanel={mobileCargoPanel}
              onMobileCargoPanelChange={setMobileCargoPanel}
              onCargoSuccess={handleCargoSuccess}
            />
          )}

          <div className="bg-white border-t border-gray-200 flex items-center justify-between px-3 md:px-5 py-1.5 md:py-0 md:h-8 flex-shrink-0">
            <div className="flex items-center gap-2 md:gap-4 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> <span className="hidden sm:inline">Transity</span> v1.0</span>
              {selectedCsoTrip && (
                <span className="hidden lg:inline">Jadwal: <span className="font-semibold text-gray-600">
                  {formatTime(selectedCsoTrip.departAtAtOutlet)} {selectedCsoTrip.patternPath}
                </span></span>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-3 text-[10px] text-gray-400">
              {state.originStop && <span>Naik: <span className="font-semibold text-emerald-600 hidden sm:inline">{state.originStop.name}</span><span className="font-semibold text-emerald-600 sm:hidden">{state.originStop.code || state.originStop.name.slice(0, 3)}</span></span>}
              {state.destinationStop && <span>Turun: <span className="font-semibold text-rose-600 hidden sm:inline">{state.destinationStop.name}</span><span className="font-semibold text-rose-600 sm:hidden">{state.destinationStop.code || state.destinationStop.name.slice(0, 3)}</span></span>}
              {sortedSeats.length > 0 && (
                <span>
                  <span className="hidden sm:inline">Kursi: </span>
                  <span className="font-semibold text-blue-600">{sortedSeats.join(', ')}</span>
                  <span className="mx-0.5">|</span>
                  <span className="font-bold text-blue-700">{fmtCurrency(totalAmount)}</span>
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg flex items-center gap-3 shadow-xl">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-700">Memproses booking...</span>
          </div>
        </div>
      )}

      <ManifestDialog
        tripId={manifestDialogTripId}
        open={!!manifestDialogTripId}
        onOpenChange={(open) => { if (!open) setManifestDialogTripId(null); }}
      />

      {batchRescheduleState.show && selectedCsoTrip?.tripId && state.outlet && (
        <BatchRescheduleDialog
          tripId={selectedCsoTrip.tripId}
          tripLabel={`${selectedCsoTrip.patternCode} — ${selectedCsoTrip.vehicle?.plate || '-'}`}
          outletId={state.outlet.id}
          selectedDate={selectedDate}
          passengers={batchRescheduleState.passengers}
          onClose={() => {
            setBatchRescheduleState({ show: false, passengers: [], checking: false });
            queryClient.invalidateQueries({ queryKey: ['/api/cso/available-trips'] });
          }}
          onCloseOnly={() => {
            setBatchRescheduleState({ show: false, passengers: [], checking: false });
            closeTripMutation.mutate(selectedCsoTrip.tripId!);
          }}
          onRescheduleComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/cso/available-trips'] });
            queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
          }}
          isClosing={closeTripMutation.isPending}
          canBatchReschedule={can('action.trip.batch_reschedule')}
        />
      )}
    </div>
  );
}
