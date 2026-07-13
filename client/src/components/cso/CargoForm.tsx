import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cargoApi, cargoTypesApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import {
  Package, Banknote, QrCode, Wallet, Building2, Loader2, ArrowRight
} from 'lucide-react';
import { fmtCurrency } from '@/lib/constants';
import { SearchableSelect } from '@/components/ui/searchable-select';
import CargoDetailsForm, { EMPTY_CARGO_DETAILS, isCargoDetailsValid, type CargoDetailsValue } from '@/components/cargo/CargoDetailsForm';
import type { Stop, Outlet, CsoAvailableTrip, CargoType, CargoShipmentWithStops } from '@/types';

interface CargoFormProps {
  trip: { id: string };
  originStop?: Stop;
  destinationStop?: Stop;
  outletId?: string;
  outlet?: Outlet;
  csoTrip?: CsoAvailableTrip;
  onSuccess: (shipment: CargoShipmentWithStops) => void;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qr', label: 'QRIS', icon: QrCode },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
  { id: 'bank', label: 'Transfer', icon: Building2 },
];

export default function CargoForm({ trip, originStop, destinationStop, outletId, outlet, csoTrip, onSuccess }: CargoFormProps) {
  const { toast } = useToast();
  const [details, setDetails] = useState<CargoDetailsValue>(EMPTY_CARGO_DETAILS);
  const {
    senderName, senderPhone, recipientName, recipientPhone,
    itemDescription, quantity, weightKg, lengthCm, widthCm, heightCm,
    declaredValue, notes, cargoTypeId,
  } = details;
  const updateDetails = (patch: Partial<CargoDetailsValue>) => setDetails(prev => ({ ...prev, ...patch }));
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [tariffQuote, setTariffQuote] = useState<{ found: boolean; calculatedAmount: number; pricePerKg?: number; minCharge?: number } | null>(null);

  const { data: allStops = [], isLoading: stopsLoading } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const { data: cargoTypes = [], isLoading: cargoTypesLoading } = useQuery<CargoType[]>({
    queryKey: ['/api/cargo-types'],
    queryFn: cargoTypesApi.getAll
  });

  const [selectedOriginId, setSelectedOriginId] = useState(originStop?.id || '');
  const [selectedDestId, setSelectedDestId] = useState(destinationStop?.id || '');

  const actualOriginId = selectedOriginId || originStop?.id;
  const actualDestId = selectedDestId || destinationStop?.id;

  useEffect(() => {
    if (cargoTypeId && actualOriginId && actualDestId && parseFloat(weightKg) > 0) {
      cargoApi.quoteTariff(cargoTypeId, actualOriginId, actualDestId, parseFloat(weightKg), trip.id)
        .then(result => {
          setTariffQuote(result);
          if (result.found) {
            setTotalAmount(String(result.calculatedAmount));
          }
        })
        .catch(() => setTariffQuote(null));
    } else {
      setTariffQuote(null);
    }
  }, [cargoTypeId, actualOriginId, actualDestId, weightKg]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => cargoApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo'] });
      toast({ title: 'Berhasil', description: `Resi ${result.waybillNumber} berhasil dibuat` });

      const enriched: CargoShipmentWithStops = {
        ...result,
        originStopName: originStop?.name || allStops.find((s: any) => s.id === result.originStopId)?.name,
        originStopCode: originStop?.code || allStops.find((s: any) => s.id === result.originStopId)?.code,
        destinationStopName: destinationStop?.name || allStops.find((s: any) => s.id === result.destinationStopId)?.name,
        destinationStopCode: destinationStop?.code || allStops.find((s: any) => s.id === result.destinationStopId)?.code,
        outletName: outlet?.name,
        vehiclePlate: csoTrip?.vehicle?.plate || undefined,
        tripDepartAt: csoTrip?.departAtAtOutlet || undefined,
      };
      onSuccess(enriched);
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    }
  });

  const isValid =
    isCargoDetailsValid(details) &&
    parseFloat(totalAmount) > 0 &&
    paymentMethod &&
    actualOriginId &&
    actualDestId;

  const handleSubmit = () => {
    if (!isValid) return;
    createMutation.mutate({
      tripId: trip.id,
      originStopId: actualOriginId,
      destinationStopId: actualDestId,
      outletId: outletId || null,
      cargoTypeId: cargoTypeId || null,
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      itemDescription: itemDescription.trim(),
      quantity: parseInt(quantity),
      weightKg: weightKg ? weightKg : null,
      lengthCm: lengthCm ? lengthCm : null,
      widthCm: widthCm ? widthCm : null,
      heightCm: heightCm ? heightCm : null,
      declaredValue: declaredValue ? declaredValue : null,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      paidAt: new Date().toISOString(),
      notes: notes.trim() || null,
      channel: 'CSO'
    });
  };

  const originStopName = originStop?.name || allStops.find(s => s.id === selectedOriginId)?.name;
  const destStopName = destinationStop?.name || allStops.find(s => s.id === selectedDestId)?.name;

  if (stopsLoading || cargoTypesLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <p className="text-xs text-gray-400 mt-1.5">Memuat data kargo...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Kirim Paket</h3>
          <p className="text-[11px] text-gray-400">Isi data pengirim, penerima & barang</p>
        </div>
        {originStopName && destStopName && (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
            <span className="font-semibold text-emerald-600">{originStopName}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-semibold text-rose-600">{destStopName}</span>
          </div>
        )}
      </div>

      {!originStop && (
        <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Kota Asal</label>
            <SearchableSelect
              value={selectedOriginId}
              options={allStops.map((s: Stop) => ({ value: s.id, label: s.name, badge: s.code, subtitle: s.city || undefined }))}
              placeholder="Pilih asal..."
              searchPlaceholder="Cari halte..."
              onChange={setSelectedOriginId}
              data-testid="select-cargo-origin"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Kota Tujuan</label>
            <SearchableSelect
              value={selectedDestId}
              options={allStops.map((s: Stop) => ({ value: s.id, label: s.name, badge: s.code, subtitle: s.city || undefined }))}
              placeholder="Pilih tujuan..."
              searchPlaceholder="Cari halte..."
              onChange={setSelectedDestId}
              data-testid="select-cargo-dest"
            />
          </div>
        </div>
      )}

      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        <CargoDetailsForm value={details} onChange={updateDetails} cargoTypes={cargoTypes} />
      </div>

      <div className="border-t border-gray-200 pt-3 mt-3 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Biaya Pengiriman</h3>
        </div>

        {tariffQuote?.found && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-700">
            Tarif otomatis: {fmtCurrency(tariffQuote.pricePerKg || 0)}/kg
            {tariffQuote.minCharge && parseFloat(String(tariffQuote.minCharge)) > 0 ? ` (min. ${fmtCurrency(tariffQuote.minCharge)})` : ''}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Total Biaya *</label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="Masukkan biaya..."
              className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
              data-testid="input-total-amount"
            />
          </div>
          {parseFloat(totalAmount) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-center">
              <span className="text-lg font-black text-blue-700 font-mono">{fmtCurrency(parseFloat(totalAmount))}</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Metode Pembayaran</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    paymentMethod === m.id
                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid={`cargo-pay-${m.id}`}
                >
                  <Icon className={`w-4 h-4 mx-auto mb-0.5 ${paymentMethod === m.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-medium ${paymentMethod === m.id ? 'text-blue-700' : 'text-gray-500'}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-3 mt-auto border-t border-gray-200 flex-shrink-0">
        <button
          onClick={handleSubmit}
          disabled={!isValid || createMutation.isPending}
          className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="btn-create-cargo"
        >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Package className="w-4 h-4" />
          )}
          Buat Resi & Cetak
        </button>
      </div>
    </div>
  );
}
