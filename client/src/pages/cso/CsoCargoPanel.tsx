import { useQuery } from '@tanstack/react-query';
import { cargoApi } from '@/lib/api';
import CargoForm from '@/components/cso/CargoForm';
import {
  Package, Clock, ArrowRight, Loader2, Download, Upload,
  RotateCcw, CheckCircle2, Truck, XCircle
} from 'lucide-react';
import type { CsoAvailableTrip, CargoShipmentWithStops } from '@/types';

interface CsoCargoState {
  trip: any;
  originStop: any;
  destinationStop: any;
  outlet: any;
}

interface CsoCargoPanelProps {
  state: CsoCargoState;
  selectedCsoTrip?: CsoAvailableTrip;
  mobileCargoPanel: 'left' | 'right';
  onMobileCargoPanelChange: (panel: 'left' | 'right') => void;
  onCargoSuccess: (shipment: CargoShipmentWithStops) => void;
}

export default function CsoCargoPanel({
  state,
  selectedCsoTrip,
  mobileCargoPanel,
  onMobileCargoPanelChange,
  onCargoSuccess,
}: CsoCargoPanelProps) {
  const tripId = state.trip?.id;

  const { data: tripShipments = [], isLoading: tripShipmentsLoading, isError: tripShipmentsError } = useQuery<CargoShipmentWithStops[]>({
    queryKey: ['/api/cargo', tripId],
    queryFn: () => cargoApi.getAll({ tripId: tripId! }),
    enabled: !!tripId,
    refetchInterval: 15000
  });

  return (
    <>
      <div className="md:hidden flex-shrink-0 bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => onMobileCargoPanelChange('left')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
              mobileCargoPanel === 'left'
                ? 'text-amber-700 border-b-2 border-amber-600 bg-amber-50/50'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            data-testid="mobile-tab-cargo-form"
          >
            Form Kargo
          </button>
          <button
            onClick={() => onMobileCargoPanelChange('right')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
              mobileCargoPanel === 'right'
                ? 'text-amber-700 border-b-2 border-amber-600 bg-amber-50/50'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            data-testid="mobile-tab-cargo-list"
          >
            Daftar Paket {tripShipments.length > 0 && `(${tripShipments.length})`}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-3 md:p-5 border-r border-gray-100 ${mobileCargoPanel === 'left' ? 'block' : 'hidden md:block'}`} data-testid="panel-cargo-form">
          <div className="max-w-2xl mx-auto">
            {state.trip?.id ? (
              <CargoForm
                trip={state.trip}
                originStop={state.originStop}
                destinationStop={state.destinationStop}
                outletId={state.outlet?.id}
                outlet={state.outlet}
                csoTrip={selectedCsoTrip}
                onSuccess={(s) => { onCargoSuccess(s); onMobileCargoPanelChange('right'); }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 py-12">
                <Package className="w-12 h-12 mb-3" />
                <p className="text-sm font-medium text-gray-400">Data trip tidak tersedia</p>
              </div>
            )}
          </div>
        </div>

        <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 overflow-y-auto bg-gray-50/50 border-l border-gray-200 ${mobileCargoPanel === 'right' ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`} data-testid="panel-cargo-list">
          <div className="px-3 md:px-4 py-2.5 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-bold text-gray-700">Paket pada Jadwal Ini</span>
            </div>
            <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded">
              {tripShipments.length} paket
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {tripShipmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              </div>
            ) : tripShipmentsError ? (
              <div className="flex flex-col items-center justify-center py-10 text-red-300">
                <XCircle className="w-8 h-8 mb-2 text-red-300" />
                <p className="text-xs text-red-500 font-medium">Gagal memuat data kargo</p>
                <p className="text-[10px] text-red-400 mt-0.5">Coba muat ulang halaman</p>
              </div>
            ) : tripShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <Package className="w-8 h-8 mb-2 text-gray-200" />
                <p className="text-xs text-gray-400">Belum ada paket</p>
                <p className="text-[10px] text-gray-300 mt-0.5">pada jadwal ini</p>
              </div>
            ) : (
              tripShipments.map(s => {
                const statusStyles: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
                  pending: { label: 'Menunggu', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
                  received: { label: 'Diterima', color: 'text-orange-700', bg: 'bg-orange-100', icon: Download },
                  loaded: { label: 'Dimuat', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Upload },
                  in_transit: { label: 'Perjalanan', color: 'text-blue-700', bg: 'bg-blue-100', icon: Truck },
                  arrived: { label: 'Tiba', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
                  delivered: { label: 'Terkirim', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
                  returned: { label: 'Kembali', color: 'text-purple-700', bg: 'bg-purple-100', icon: RotateCcw },
                  canceled: { label: 'Batal', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
                };
                const st = statusStyles[s.status || 'pending'] || statusStyles.pending;
                const Icon = st.icon;
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl border border-gray-200 p-2.5 shadow-sm"
                    data-testid={`trip-cargo-item-${s.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-amber-700 truncate flex-1">{s.waybillNumber}</span>
                      <span className={`ml-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${st.bg} ${st.color} flex-shrink-0`}>
                        <Icon className="w-2.5 h-2.5" />
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-600 mb-0.5">
                      <span className="font-medium truncate">{s.senderName}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                      <span className="font-medium truncate">{s.recipientName}</span>
                    </div>
                    {(s.originStopName || s.destinationStopName) && (
                      <div className="flex items-center gap-1 text-[9px] text-gray-400">
                        <span>{s.originStopCode || s.originStopName}</span>
                        <ArrowRight className="w-2 h-2" />
                        <span>{s.destinationStopCode || s.destinationStopName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400 truncate flex-1">{s.itemDescription}</span>
                      <span className="text-[10px] font-bold text-gray-700 ml-2 flex-shrink-0">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseFloat(s.totalAmount))}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
