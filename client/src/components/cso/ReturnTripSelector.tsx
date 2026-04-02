import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tripsApi, outletsApi, stopsApi } from '@/lib/api';
import { MapPin, Calendar, ArrowRight, Loader2, ChevronDown, Check, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Stop, Outlet, CsoAvailableTrip, Trip } from '@/types';
import SeatMap from './SeatMap';
import { fmtCurrency } from '@/lib/constants';

interface ReturnTripSelectorProps {
  outboundOriginStop: Stop;
  outboundDestinationStop: Stop;
  requiredSeatCount: number;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onTripSelect: (trip: CsoAvailableTrip) => void;
  onSeatsSelect: (seats: string[]) => void;
  selectedTrip?: CsoAvailableTrip;
  selectedSeats: string[];
  onBack: () => void;
  onNext: () => void;
}

export default function ReturnTripSelector({
  outboundOriginStop,
  outboundDestinationStop,
  requiredSeatCount,
  selectedDate,
  onDateChange,
  onTripSelect,
  onSeatsSelect,
  selectedTrip,
  selectedSeats,
  onBack,
  onNext
}: ReturnTripSelectorProps) {
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | undefined>();
  const [outletSearchOpen, setOutletSearchOpen] = useState(false);

  const { data: outlets = [] } = useQuery({
    queryKey: ['/api/outlets'],
    queryFn: outletsApi.getAll
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  // Pre-fill outlet based on outbound destination
  useEffect(() => {
    if (outlets.length > 0 && outboundDestinationStop && !selectedOutlet) {
      const match = outlets.find(o => o.stopId === outboundDestinationStop.id);
      if (match) setSelectedOutlet(match);
    }
  }, [outlets, outboundDestinationStop, selectedOutlet]);

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['/api/cso/available-trips', selectedDate, selectedOutlet?.id],
    queryFn: () => tripsApi.getCsoAvailableTrips(selectedDate, selectedOutlet!.id),
    enabled: !!selectedDate && !!selectedOutlet?.id,
  });

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
      });
    } catch { return '--:--'; }
  };

  const handleSeatSelect = (seatNo: string) => {
    if (selectedSeats.length < requiredSeatCount) {
      onSeatsSelect([...selectedSeats, seatNo]);
    }
  };

  const handleSeatDeselect = (seatNo: string) => {
    onSeatsSelect(selectedSeats.filter(s => s !== seatNo));
  };

  const stopMap = useMemo(() => {
    const map: Record<string, Stop> = {};
    stops.forEach(s => map[s.id] = s);
    return map;
  }, [stops]);

  const filteredOutlets = useMemo(() => {
    // Show outlets in the city of outbound destination
    const targetCity = outboundDestinationStop?.city;
    if (!targetCity) return outlets;
    return outlets.filter(o => stopMap[o.stopId]?.city === targetCity);
  }, [outlets, outboundDestinationStop, stopMap]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-100 p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-tight flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          Pilih Jadwal Pulang
        </h2>
        <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100">
          <MapPin className="w-3.5 h-3.5" />
          <span className="font-bold">{outboundDestinationStop.name}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="font-bold">{outboundOriginStop.name}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tanggal Pulang</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
              data-testid="input-return-date"
            />
          </div>
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Outlet Keberangkatan</label>
            <button
              onClick={() => setOutletSearchOpen(!outletSearchOpen)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left flex items-center justify-between hover:border-gray-300"
              data-testid="btn-return-outlet-select"
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-500" />
                <span className="truncate">{selectedOutlet?.name || 'Pilih Outlet'}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {outletSearchOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                {filteredOutlets.map(o => (
                  <button
                    key={o.id}
                    onClick={() => { setSelectedOutlet(o); setOutletSearchOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                  >
                    <span>{o.name}</span>
                    {selectedOutlet?.id === o.id && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!selectedTrip ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase ml-1">Jadwal Tersedia</p>
            {tripsLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">Mencari jadwal...</p>
              </div>
            ) : trips.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-400">Tidak ada jadwal tersedia untuk rute & tanggal ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {trips.map(trip => (
                  <button
                    key={trip.tripId}
                    onClick={() => onTripSelect(trip)}
                    className="p-3 bg-white border border-gray-200 rounded-2xl text-left hover:border-blue-400 hover:shadow-md transition-all group"
                    data-testid={`trip-${trip.tripId}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-black text-gray-900 group-hover:text-blue-600">
                        {formatTime(trip.departAtAtOutlet)}
                      </span>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                        {trip.vehicle?.code || 'BUS'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Harga Mulai</span>
                        <span className="text-xs font-bold text-emerald-600">{fmtCurrency(trip.minFare || 0)}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Kursi</span>
                        <span className="text-xs font-bold text-gray-700">{trip.availableSeats || 0} Tersedia</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-blue-600 text-white p-3 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/70 uppercase">Jadwal Terpilih</p>
                  <p className="text-sm font-black">{formatTime(selectedTrip.departAtAtOutlet)} — {selectedTrip.vehicle?.code}</p>
                </div>
              </div>
              <button
                onClick={() => onTripSelect(undefined as any)}
                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-bold transition-colors"
                data-testid="btn-change-trip"
              >
                Ganti
              </button>
            </div>

            <div className="bg-gray-50 rounded-3xl border border-gray-100 p-4">
              <SeatMap
                trip={{ id: selectedTrip.tripId } as any}
                originSeq={1} // In RT flow, simplified to full route for return
                destinationSeq={selectedTrip.totalLegs || 10}
                selectedSeats={selectedSeats}
                onSeatSelect={handleSeatSelect}
                onSeatDeselect={handleSeatDeselect}
                originStopId={outboundDestinationStop.id}
                destinationStopId={outboundOriginStop.id}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="h-11 px-6 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-gray-200"
          data-testid="btn-return-back"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="flex-1 flex flex-col items-end">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Status Kursi</span>
          <span className={`text-sm font-black ${selectedSeats.length === requiredSeatCount ? 'text-emerald-600' : 'text-blue-600'}`}>
            {selectedSeats.length}/{requiredSeatCount} Dipilih
          </span>
        </div>
        <button
          onClick={onNext}
          disabled={selectedSeats.length !== requiredSeatCount}
          className="h-11 px-8 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
          data-testid="btn-return-next"
        >
          Lanjut <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
