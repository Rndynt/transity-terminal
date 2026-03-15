import { useState, useEffect } from 'react';
import { Check, CreditCard, Clock, Loader2, Banknote, QrCode, Wallet, Building2 } from 'lucide-react';

interface PassengerData { fullName: string; phone?: string; idNumber?: string; seatNo: string }

function generateCashPresets(total: number): number[] {
  if (total <= 0) return [];
  const denominations = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const roundUp = (val: number, denom: number) => Math.ceil(val / denom) * denom;
  const presets = new Set<number>();
  for (const d of denominations) {
    const rounded = roundUp(total, d);
    if (rounded >= total && rounded <= total * 3) presets.add(rounded);
  }
  const nextRound = [50000, 100000, 200000, 500000, 1000000];
  for (const n of nextRound) {
    if (n >= total && n <= total * 3) presets.add(n);
  }
  const sorted = Array.from(presets).sort((a, b) => a - b);
  if (sorted.length > 5) return sorted.slice(0, 5);
  return sorted;
}

interface PassengerFormProps {
  selectedSeats: string[];
  passengers: Array<PassengerData>;
  onPassengersUpdate: (passengers: Array<PassengerData>) => void;
  totalAmount: number;
  onBook: (passengers: Array<PassengerData>) => void;
  onPay: (passengers: Array<PassengerData>, payment: { method: string; amount: number }) => void;
  onPaymentUpdate: (payment: { method: string; amount: number }) => void;
  payment?: { method: string; amount: number } | null;
  onBack: () => void;
  loading?: boolean;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qr', label: 'QRIS', icon: QrCode },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
  { id: 'bank', label: 'Transfer', icon: Building2 },
];

const fmt = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export default function PassengerForm({
  selectedSeats,
  passengers,
  onPassengersUpdate,
  totalAmount,
  onBook,
  onPay,
  onPaymentUpdate,
  payment,
  onBack,
  loading = false
}: PassengerFormProps) {
  const [formData, setFormData] = useState<Array<{ fullName: string; phone: string; idNumber: string; seatNo: string }>>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedMethod, setSelectedMethod] = useState<string>(payment?.method || '');
  const [cashReceived, setCashReceived] = useState<string>('');

  useEffect(() => {
    setFormData(prev => {
      const existing = new Map(prev.map(p => [p.seatNo, p]));
      return selectedSeats.map(seatNo =>
        existing.get(seatNo) || {
          fullName: passengers.find(p => p.seatNo === seatNo)?.fullName || '',
          phone: passengers.find(p => p.seatNo === seatNo)?.phone || '',
          idNumber: passengers.find(p => p.seatNo === seatNo)?.idNumber || '',
          seatNo
        }
      );
    });
  }, [selectedSeats]);

  const handleInputChange = (index: number, field: 'fullName' | 'phone' | 'idNumber', value: string) => {
    setFormData(current => {
      const updated = [...current];
      if (updated[index]) updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const markTouched = (key: string) => setTouched(prev => ({ ...prev, [key]: true }));

  const getNameError = (name: string, key: string): string | null => {
    if (!touched[key]) return null;
    if (!name.trim()) return 'Wajib diisi';
    if (name.trim().length < 3) return 'Min. 3 karakter';
    return null;
  };

  const getPhoneError = (phone: string, key: string): string | null => {
    if (!touched[key] || !phone) return null;
    if (!/^0[0-9]{9,12}$/.test(phone)) return 'Format: 08xxxxxxxxxx';
    return null;
  };

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    onPaymentUpdate({ method, amount: totalAmount });
  };

  const filledCount = formData.filter(p => p.fullName.trim().length >= 3).length;
  const isPassengerValid = formData.length > 0 && formData.every(p => p.fullName.trim().length >= 3);

  const isPaymentValid = () => {
    if (!selectedMethod) return false;
    if (selectedMethod === 'cash') return parseFloat(cashReceived) >= totalAmount;
    return true;
  };

  const cashChange = selectedMethod === 'cash' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - totalAmount)
    : 0;

  const handleBookOnly = () => {
    if (!isPassengerValid) return;
    onPassengersUpdate(formData);
    onBook(formData);
  };

  const handlePayAndPrint = () => {
    if (!isPassengerValid || !isPaymentValid()) return;
    onPassengersUpdate(formData);
    onPay(formData, { method: selectedMethod, amount: totalAmount });
  };

  const pricePerSeat = selectedSeats.length > 0 ? Math.round(totalAmount / selectedSeats.length) : 0;

  const MAX_VISIBLE = 4;
  const FORM_CARD_HEIGHT = 118;
  const formContainerMaxH = selectedSeats.length > MAX_VISIBLE
    ? FORM_CARD_HEIGHT * MAX_VISIBLE + 30
    : undefined;

  if (selectedSeats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Tidak ada kursi yang dipilih</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Data Penumpang</h3>
          <p className="text-[11px] text-gray-400">{filledCount}/{selectedSeats.length} terisi</p>
        </div>
        {selectedSeats.length > MAX_VISIBLE && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            Scroll untuk lihat semua
          </span>
        )}
      </div>

      <div
        className="space-y-2 overflow-y-auto flex-shrink-0 pr-1"
        style={formContainerMaxH ? { maxHeight: `${formContainerMaxH}px` } : undefined}
      >
        {formData.map((passenger, index) => {
          const nameKey = `name-${passenger.seatNo}`;
          const phoneKey = `phone-${passenger.seatNo}`;
          const nameError = getNameError(passenger.fullName, nameKey);
          const phoneError = getPhoneError(passenger.phone, phoneKey);
          const isFilled = passenger.fullName.trim().length >= 3;
          return (
            <div
              key={passenger.seatNo}
              className={`border rounded-xl p-3 transition-colors ${
                isFilled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
              }`}
              data-testid={`passenger-form-${index}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${
                    isFilled ? 'bg-emerald-100' : 'bg-blue-100'
                  }`}>
                    {isFilled
                      ? <Check className="w-3 h-3 text-emerald-600" />
                      : <span className="text-[10px] font-bold text-blue-600">{index + 1}</span>
                    }
                  </div>
                  <span className="text-xs font-semibold text-gray-700">Penumpang {index + 1}</span>
                </div>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-mono font-bold">
                  {passenger.seatNo}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-[2]">
                  <input
                    value={passenger.fullName}
                    onChange={(e) => handleInputChange(index, 'fullName', e.target.value)}
                    onBlur={() => markTouched(nameKey)}
                    placeholder="Nama lengkap *"
                    className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                      nameError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                    }`}
                    data-testid={`input-name-${index}`}
                  />
                  {nameError && <p className="text-[10px] text-red-500 mt-0.5">{nameError}</p>}
                </div>
                <div className="flex-1">
                  <input
                    value={passenger.phone}
                    onChange={(e) => handleInputChange(index, 'phone', e.target.value)}
                    onBlur={() => markTouched(phoneKey)}
                    placeholder="Telepon"
                    className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                      phoneError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                    }`}
                    data-testid={`input-phone-${index}`}
                  />
                  {phoneError && <p className="text-[10px] text-red-500 mt-0.5">{phoneError}</p>}
                </div>
                <div className="flex-1">
                  <input
                    value={passenger.idNumber}
                    onChange={(e) => handleInputChange(index, 'idNumber', e.target.value)}
                    placeholder="KTP/Paspor"
                    className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                    data-testid={`input-id-${index}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 pt-3 mt-3 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Pembayaran</h3>
          <span className="text-[10px] text-gray-400">{selectedSeats.length} penumpang</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
            <span className="text-xs text-gray-500">Harga per kursi</span>
            <span className="text-xs font-semibold text-gray-700 font-mono">{fmt(pricePerSeat)}</span>
          </div>
          <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
            <span className="text-xs text-gray-500">Jumlah kursi</span>
            <span className="text-xs font-semibold text-gray-700">{selectedSeats.length} kursi</span>
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between bg-blue-50">
            <span className="text-sm font-bold text-gray-700">Total</span>
            <span className="text-lg font-black text-blue-700 font-mono">{fmt(totalAmount)}</span>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Metode Pembayaran</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => handleMethodSelect(m.id)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    selectedMethod === m.id
                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid={`pay-${m.id}`}
                >
                  <Icon className={`w-4 h-4 mx-auto mb-0.5 ${selectedMethod === m.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-medium ${selectedMethod === m.id ? 'text-blue-700' : 'text-gray-500'}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedMethod === 'cash' && (
          <div className="space-y-2">
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Uang Diterima</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Masukkan jumlah..."
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                  data-testid="input-cash"
                />
              </div>
              {parseFloat(cashReceived) >= totalAmount && (
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                  <span className="text-[10px] text-gray-500 block">Kembalian</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">{fmt(cashChange)}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {generateCashPresets(totalAmount).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCashReceived(String(preset))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                    cashReceived === String(preset)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                  data-testid={`cash-preset-${preset}`}
                >
                  {fmt(preset)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashReceived(String(totalAmount))}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  cashReceived === String(totalAmount)
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300'
                }`}
                data-testid="cash-preset-exact"
              >
                Uang Pas
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-3 mt-auto border-t border-gray-200 flex-shrink-0">
        <button
          onClick={handleBookOnly}
          disabled={!isPassengerValid || loading}
          className="flex-1 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="btn-book-only"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
          Booking Saja
        </button>
        <button
          onClick={handlePayAndPrint}
          disabled={!isPassengerValid || !isPaymentValid() || loading}
          className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="btn-pay-confirm"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          Bayar & Cetak
        </button>
      </div>
    </div>
  );
}
