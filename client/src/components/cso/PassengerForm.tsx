import { useState, useEffect } from 'react';
import {
  Check, CreditCard, Loader2, Banknote, QrCode, Wallet, Building2,
  Tag, X, AlertCircle, ArrowRight, MapPin,
} from 'lucide-react';
import { fmtCurrency } from '@/lib/constants';
import type { Stop, CsoAvailableTrip } from '@/types/index';

export interface PassengerData {
  fullName: string;
  phone: string;
  idNumber: string;
  seatNo: string;
}

interface TripContext {
  trip: CsoAvailableTrip;
  originStop: Stop;
  destinationStop: Stop;
}

function generateCashPresets(total: number): number[] {
  if (total <= 0) return [];
  const denominations = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const roundUp = (val: number, denom: number) => Math.ceil(val / denom) * denom;
  const presets = new Set<number>();
  for (const d of denominations) {
    const rounded = roundUp(total, d);
    if (rounded >= total && rounded <= total * 3) presets.add(rounded);
  }
  for (const n of [50000, 100000, 200000, 500000, 1000000]) {
    if (n >= total && n <= total * 3) presets.add(n);
  }
  return Array.from(presets).sort((a, b) => a - b).slice(0, 5);
}

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
    });
  } catch { return '--:--'; }
};

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qr', label: 'QRIS', icon: QrCode },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
  { id: 'bank', label: 'Transfer', icon: Building2 },
];

interface PassengerFormProps {
  selectedSeats: string[];
  passengers: PassengerData[];
  onPassengersUpdate: (passengers: PassengerData[]) => void;
  onBack: () => void;
  loading?: boolean;

  // ── Single-trip mode ──────────────────────────────────────────
  totalAmount?: number;
  onBook?: (passengers: PassengerData[]) => void;
  onPay?: (passengers: PassengerData[], payment: { method: string; amount: number }) => void;
  onPaymentUpdate?: (payment: { method: string; amount: number }) => void;
  payment?: { method: string; amount: number } | null;
  promoCode?: string;
  discountAmount?: number;
  onApplyPromo?: (code: string) => Promise<void>;
  onClearPromo?: () => void;

  // ── Round-trip mode (when returnSeats provided) ───────────────
  returnSeats?: string[];
  outboundContext?: TripContext;
  returnContext?: TripContext;
  onNext?: () => void; // proceed to review/payment step
}

export default function PassengerForm({
  selectedSeats,
  passengers,
  onPassengersUpdate,
  onBack,
  loading = false,
  // single
  totalAmount = 0,
  onBook,
  onPay,
  onPaymentUpdate,
  payment,
  promoCode,
  discountAmount = 0,
  onApplyPromo,
  onClearPromo,
  // round-trip
  returnSeats,
  outboundContext,
  returnContext,
  onNext,
}: PassengerFormProps) {
  const isRoundTrip = !!returnSeats;

  const [formData, setFormData] = useState<PassengerData[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedMethod, setSelectedMethod] = useState<string>(payment?.method || '');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  const finalAmount = totalAmount - discountAmount;

  useEffect(() => {
    setFormData(prev => {
      const existing = new Map(prev.map(p => [p.seatNo, p]));
      return selectedSeats.map(seatNo =>
        existing.get(seatNo) || {
          fullName: passengers.find(p => p.seatNo === seatNo)?.fullName || '',
          phone:    passengers.find(p => p.seatNo === seatNo)?.phone    || '',
          idNumber: passengers.find(p => p.seatNo === seatNo)?.idNumber || '',
          seatNo,
        }
      );
    });
  }, [selectedSeats]);

  const handleInputChange = (index: number, field: keyof Omit<PassengerData, 'seatNo'>, value: string) => {
    const updated = formData.map((p, i) => i === index ? { ...p, [field]: value } : p);
    setFormData(updated);
    onPassengersUpdate(updated);
  };

  const markTouched = (key: string) => setTouched(prev => ({ ...prev, [key]: true }));

  const getNameError = (name: string, key: string) => {
    if (!touched[key]) return null;
    if (!name.trim()) return 'Wajib diisi';
    if (name.trim().length < 3) return 'Min. 3 karakter';
    return null;
  };

  const getPhoneError = (phone: string, key: string) => {
    if (!touched[key] || !phone) return null;
    if (!/^0[0-9]{9,12}$/.test(phone)) return 'Format: 08xxxxxxxxxx';
    return null;
  };

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    onPaymentUpdate?.({ method, amount: finalAmount });
  };

  const filledCount = formData.filter(p => p.fullName.trim().length >= 3).length;
  const isPassengerValid = formData.length > 0 && formData.every(p => p.fullName.trim().length >= 3);

  const isPaymentValid = () => {
    if (!selectedMethod) return false;
    if (selectedMethod === 'cash') return parseFloat(cashReceived) >= finalAmount;
    return true;
  };

  const cashChange = selectedMethod === 'cash' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - finalAmount)
    : 0;

  const handleBookOnly = () => {
    if (!isPassengerValid) return;
    onPassengersUpdate(formData);
    onBook?.(formData);
  };

  const handlePayAndPrint = () => {
    if (!isPassengerValid || !isPaymentValid()) return;
    onPassengersUpdate(formData);
    onPay?.(formData, { method: selectedMethod, amount: finalAmount });
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || !onApplyPromo) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      await onApplyPromo(promoInput.trim());
      setPromoInput('');
    } catch (err: any) {
      setPromoError(err.message || 'Kode promo tidak valid');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleClearPromo = () => {
    onClearPromo?.();
    setPromoInput('');
    setPromoError('');
  };

  const pricePerSeat = selectedSeats.length > 0 ? Math.round(totalAmount / selectedSeats.length) : 0;

  if (selectedSeats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Tidak ada kursi yang dipilih</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-0 overflow-hidden">
      {/* ── Round-trip trip summary header ── */}
      {isRoundTrip && outboundContext && returnContext && (
        <div className="flex-shrink-0 grid grid-cols-2 gap-2 px-3 md:px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="bg-white border border-blue-100 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Pergi</span>
              <span className="text-[10px] font-semibold text-gray-400 font-mono">
                {formatTime(outboundContext.trip.departAtAtOutlet)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 truncate">
              <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <span className="truncate">{outboundContext.originStop.name}</span>
              <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
              <span className="truncate">{outboundContext.destinationStop.name}</span>
            </div>
          </div>
          <div className="bg-white border border-emerald-100 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Pulang</span>
              <span className="text-[10px] font-semibold text-gray-400 font-mono">
                {formatTime(returnContext.trip.departAtAtOutlet)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-700 truncate">
              <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="truncate">{returnContext.originStop.name}</span>
              <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
              <span className="truncate">{returnContext.destinationStop.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Single scrollable area: passengers + payment ── */}
      <div className="flex-1 overflow-y-auto px-3 md:px-5 py-2 min-h-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-gray-800">Data Penumpang</h3>
            <span className="text-[10px] text-gray-400">{filledCount}/{selectedSeats.length} terisi</span>
          </div>
        </div>

        <div className="space-y-1.5 mb-3">
          {formData.map((passenger, index) => {
            const nameKey = `name-${passenger.seatNo}`;
            const phoneKey = `phone-${passenger.seatNo}`;
            const nameError = getNameError(passenger.fullName, nameKey);
            const phoneError = getPhoneError(passenger.phone, phoneKey);
            const isFilled = passenger.fullName.trim().length >= 3;

            return (
              <div
                key={passenger.seatNo}
                className={`border rounded-lg p-2 transition-colors ${
                  isFilled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                }`}
                data-testid={`passenger-form-${index}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                      isFilled ? 'bg-emerald-100' : 'bg-blue-100'
                    }`}>
                      {isFilled
                        ? <Check className="w-2.5 h-2.5 text-emerald-600" />
                        : <span className="text-[8px] font-bold text-blue-600">{index + 1}</span>
                      }
                    </div>
                    <span className="text-[11px] font-semibold text-gray-600">Penumpang {index + 1}</span>
                  </div>
                  {isRoundTrip && returnSeats ? (
                    <div className="flex items-center gap-0.5">
                      <span className="px-1 py-px bg-blue-100 text-blue-700 rounded text-[9px] font-mono font-bold">
                        {passenger.seatNo}
                      </span>
                      <ArrowRight className="w-2 h-2 text-gray-300" />
                      <span className="px-1 py-px bg-emerald-100 text-emerald-700 rounded text-[9px] font-mono font-bold">
                        {returnSeats[index]}
                      </span>
                    </div>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-mono font-bold">
                      {passenger.seatNo}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <div className="flex-[2] min-w-0">
                    <input
                      value={passenger.fullName}
                      onChange={(e) => handleInputChange(index, 'fullName', e.target.value)}
                      onBlur={() => markTouched(nameKey)}
                      placeholder="Nama lengkap *"
                      className={`w-full h-7 px-2 bg-white border rounded text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                        nameError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                      }`}
                      data-testid={`input-name-${index}`}
                    />
                    {nameError && <p className="text-[9px] text-red-500 mt-0.5">{nameError}</p>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={passenger.phone}
                      onChange={(e) => handleInputChange(index, 'phone', e.target.value.replace(/[^0-9]/g, ''))}
                      onBlur={() => markTouched(phoneKey)}
                      placeholder="Telepon"
                      className={`w-full h-7 px-2 bg-white border rounded text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                        phoneError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200 focus:border-blue-300'
                      }`}
                      data-testid={`input-phone-${index}`}
                    />
                    {phoneError && <p className="text-[9px] text-red-500 mt-0.5">{phoneError}</p>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      value={passenger.idNumber}
                      onChange={(e) => handleInputChange(index, 'idNumber', e.target.value)}
                      placeholder="KTP/Paspor"
                      className="w-full h-7 px-2 bg-white border border-gray-200 rounded text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                      data-testid={`input-id-${index}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Payment section (flows after passengers) ── */}
        <div className="border-t border-gray-200 pt-2 space-y-2.5">
          {onApplyPromo && (
            <div className="flex items-center gap-1.5">
              {promoCode ? (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg flex-1">
                  <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <span className="font-mono font-bold text-[10px] text-emerald-700" data-testid="text-applied-promo-cso">{promoCode}</span>
                  <span className="text-[9px] text-emerald-600 font-semibold">-{fmtCurrency(discountAmount)}</span>
                  <button onClick={handleClearPromo} className="p-0.5 hover:bg-emerald-100 rounded ml-auto" data-testid="btn-clear-promo-cso">
                    <X className="w-3 h-3 text-emerald-600" />
                  </button>
                </div>
              ) : (
                <>
                  <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <input
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                    placeholder="Kode promo"
                    className="flex-1 h-7 px-2 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                    data-testid="input-promo-code-cso"
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={!promoInput.trim() || promoLoading}
                    className="h-7 px-2.5 bg-white border border-gray-200 rounded text-[10px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    data-testid="btn-apply-promo-cso"
                  >
                    {promoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pakai'}
                  </button>
                </>
              )}
            </div>
          )}
          {promoError && (
            <div className="flex items-center gap-1 text-[9px] text-red-500" data-testid="text-promo-error-cso">
              <AlertCircle className="w-3 h-3" /> {promoError}
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{fmtCurrency(pricePerSeat)} × {selectedSeats.length} {isRoundTrip ? 'pnp PP' : 'kursi'}</span>
            {discountAmount > 0 && (
              <span className="text-emerald-600 font-semibold text-[10px]">-{fmtCurrency(discountAmount)}</span>
            )}
            <span className="text-base font-black text-blue-700 font-mono" data-testid="text-final-total">{fmtCurrency(finalAmount)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold flex-shrink-0">Bayar:</p>
            <div className="flex gap-1 flex-1">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMethodSelect(m.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-center transition-all ${
                      selectedMethod === m.id
                        ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`pay-${m.id}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${selectedMethod === m.id ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`text-[10px] font-medium hidden sm:inline ${selectedMethod === m.id ? 'text-blue-700' : 'text-gray-500'}`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedMethod === 'cash' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Uang diterima"
                className="flex-1 h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                data-testid="input-cash"
              />
              <div className="flex gap-1 flex-wrap">
                {generateCashPresets(finalAmount).slice(0, 3).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCashReceived(String(preset))}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
                      cashReceived === String(preset)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    data-testid={`cash-preset-${preset}`}
                  >
                    {fmtCurrency(preset)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCashReceived(String(finalAmount))}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                    cashReceived === String(finalAmount)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                  }`}
                  data-testid="cash-preset-exact"
                >
                  Pas
                </button>
              </div>
              {parseFloat(cashReceived) >= finalAmount && (
                <div className="text-center flex-shrink-0">
                  <span className="text-[9px] text-gray-400 block">Kembali</span>
                  <span className="text-sm font-black text-emerald-600 font-mono">{fmtCurrency(cashChange)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!isRoundTrip && (
              <button
                onClick={handleBookOnly}
                disabled={!isPassengerValid || loading}
                className="flex-1 h-9 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="btn-book-only"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Booking
              </button>
            )}
            {isRoundTrip && (
              <button
                onClick={onBack}
                className="h-9 px-3 bg-gray-100 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-200 transition-colors flex-shrink-0"
                data-testid="btn-pax-pp-back"
              >
                Kembali
              </button>
            )}
            <button
              onClick={handlePayAndPrint}
              disabled={!isPassengerValid || !isPaymentValid() || loading}
              className="flex-[2] h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="btn-pay-confirm"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Bayar & Cetak
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
