import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cargoApi, cargoTypesApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import {
  Package, User, Phone, Weight, Hash,
  Banknote, QrCode, Wallet, Building2, Loader2,
  ArrowRight, Ruler, ShieldCheck
} from 'lucide-react';
import type { Stop, CsoAvailableTrip, CargoType } from '@/types';

interface CargoFormProps {
  trip: { id: string };
  originStop?: Stop;
  destinationStop?: Stop;
  outletId?: string;
  csoTrip?: CsoAvailableTrip;
  onSuccess: (shipment: any) => void;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qr', label: 'QRIS', icon: QrCode },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
  { id: 'bank', label: 'Transfer', icon: Building2 },
];

const fmt = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export default function CargoForm({ trip, originStop, destinationStop, outletId, csoTrip, onSuccess }: CargoFormProps) {
  const { toast } = useToast();
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [weightKg, setWeightKg] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cargoTypeId, setCargoTypeId] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tariffQuote, setTariffQuote] = useState<{ found: boolean; calculatedAmount: number; pricePerKg?: number; minCharge?: number } | null>(null);

  const { data: allStops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const { data: cargoTypes = [] } = useQuery<CargoType[]>({
    queryKey: ['/api/cargo-types'],
    queryFn: cargoTypesApi.getAll
  });

  const [selectedOriginId, setSelectedOriginId] = useState(originStop?.id || '');
  const [selectedDestId, setSelectedDestId] = useState(destinationStop?.id || '');

  const actualOriginId = selectedOriginId || originStop?.id;
  const actualDestId = selectedDestId || destinationStop?.id;

  useEffect(() => {
    if (cargoTypeId && actualOriginId && actualDestId && parseFloat(weightKg) > 0) {
      cargoApi.quoteTariff(cargoTypeId, actualOriginId, actualDestId, parseFloat(weightKg))
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
    mutationFn: (data: any) => cargoApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo'] });
      toast({ title: 'Berhasil', description: `Resi ${result.waybillNumber} berhasil dibuat` });
      onSuccess(result);
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    }
  });

  const markTouched = (key: string) => setTouched(prev => ({ ...prev, [key]: true }));

  const getError = (value: string, key: string, minLen = 2) => {
    if (!touched[key]) return null;
    if (!value.trim()) return 'Wajib diisi';
    if (value.trim().length < minLen) return `Min. ${minLen} karakter`;
    return null;
  };

  const getPhoneError = (phone: string, key: string) => {
    if (!touched[key]) return null;
    if (!phone.trim()) return 'Wajib diisi';
    if (!/^0[0-9]{9,12}$/.test(phone)) return 'Format: 08xxxxxxxxxx';
    return null;
  };

  const isValid =
    senderName.trim().length >= 2 &&
    senderPhone.trim().length >= 10 &&
    recipientName.trim().length >= 2 &&
    recipientPhone.trim().length >= 10 &&
    itemDescription.trim().length >= 2 &&
    parseInt(quantity) > 0 &&
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
  const activeCargoTypes = cargoTypes.filter((ct: CargoType) => ct.isActive !== false);

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
            <select
              value={selectedOriginId}
              onChange={(e) => setSelectedOriginId(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
              data-testid="select-cargo-origin"
            >
              <option value="">Pilih asal...</option>
              {allStops.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Kota Tujuan</label>
            <select
              value={selectedDestId}
              onChange={(e) => setSelectedDestId(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
              data-testid="select-cargo-dest"
            >
              <option value="">Pilih tujuan...</option>
              {allStops.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        <div className="border rounded-xl p-3 bg-amber-50/50 border-amber-200">
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-gray-700">Pengirim</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-[2]">
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                onBlur={() => markTouched('senderName')}
                placeholder="Nama pengirim *"
                className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                  getError(senderName, 'senderName') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                }`}
                data-testid="input-sender-name"
              />
              {getError(senderName, 'senderName') && <p className="text-[10px] text-red-500 mt-0.5">{getError(senderName, 'senderName')}</p>}
            </div>
            <div className="flex-1">
              <input
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                onBlur={() => markTouched('senderPhone')}
                placeholder="Telepon *"
                className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                  getPhoneError(senderPhone, 'senderPhone') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                }`}
                data-testid="input-sender-phone"
              />
              {getPhoneError(senderPhone, 'senderPhone') && <p className="text-[10px] text-red-500 mt-0.5">{getPhoneError(senderPhone, 'senderPhone')}</p>}
            </div>
          </div>
        </div>

        <div className="border rounded-xl p-3 bg-blue-50/50 border-blue-200">
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-gray-700">Penerima</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-[2]">
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                onBlur={() => markTouched('recipientName')}
                placeholder="Nama penerima *"
                className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                  getError(recipientName, 'recipientName') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                }`}
                data-testid="input-recipient-name"
              />
              {getError(recipientName, 'recipientName') && <p className="text-[10px] text-red-500 mt-0.5">{getError(recipientName, 'recipientName')}</p>}
            </div>
            <div className="flex-1">
              <input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                onBlur={() => markTouched('recipientPhone')}
                placeholder="Telepon *"
                className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                  getPhoneError(recipientPhone, 'recipientPhone') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                }`}
                data-testid="input-recipient-phone"
              />
              {getPhoneError(recipientPhone, 'recipientPhone') && <p className="text-[10px] text-red-500 mt-0.5">{getPhoneError(recipientPhone, 'recipientPhone')}</p>}
            </div>
          </div>
        </div>

        <div className="border rounded-xl p-3 bg-gray-50 border-gray-200">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs font-semibold text-gray-700">Detail Barang</span>
          </div>
          <div className="space-y-2">
            {activeCargoTypes.length > 0 && (
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Jenis Kargo</label>
                <select
                  value={cargoTypeId}
                  onChange={(e) => setCargoTypeId(e.target.value)}
                  className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                  data-testid="select-cargo-type"
                >
                  <option value="">Pilih jenis...</option>
                  {activeCargoTypes.map((ct: CargoType) => (
                    <option key={ct.id} value={ct.id}>{ct.name} ({ct.code})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <input
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                onBlur={() => markTouched('itemDesc')}
                placeholder="Deskripsi barang *"
                className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                  getError(itemDescription, 'itemDesc') ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                }`}
                data-testid="input-item-desc"
              />
              {getError(itemDescription, 'itemDesc') && <p className="text-[10px] text-red-500 mt-0.5">{getError(itemDescription, 'itemDesc')}</p>}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <Hash className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Jumlah"
                    className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                    data-testid="input-quantity"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <Weight className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="Berat (kg)"
                    className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                    data-testid="input-weight"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <Ruler className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    step="0.1"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                    placeholder="P (cm)"
                    className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                    data-testid="input-length"
                  />
                </div>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  placeholder="L (cm)"
                  className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                  data-testid="input-width"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="T (cm)"
                  className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                  data-testid="input-height"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <ShieldCheck className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={declaredValue}
                    onChange={(e) => setDeclaredValue(e.target.value)}
                    placeholder="Nilai barang (Rp)"
                    className="w-full h-8 pl-7 pr-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                    data-testid="input-declared-value"
                  />
                </div>
              </div>
            </div>
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan (opsional)"
                rows={2}
                className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 resize-none"
                data-testid="input-notes"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3 mt-3 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Biaya Pengiriman</h3>
        </div>

        {tariffQuote?.found && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-700">
            Tarif otomatis: {fmt(tariffQuote.pricePerKg || 0)}/kg
            {tariffQuote.minCharge && parseFloat(String(tariffQuote.minCharge)) > 0 ? ` (min. ${fmt(tariffQuote.minCharge)})` : ''}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Total Biaya *</label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              onBlur={() => markTouched('totalAmount')}
              placeholder="Masukkan biaya..."
              className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
              data-testid="input-total-amount"
            />
          </div>
          {parseFloat(totalAmount) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-center">
              <span className="text-lg font-black text-blue-700 font-mono">{fmt(parseFloat(totalAmount))}</span>
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
