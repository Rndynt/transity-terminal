import { useState } from 'react';
import { 
  ArrowRight, Calendar, Clock, CreditCard, 
  Banknote, QrCode, Wallet, Building2, ChevronLeft, 
  Loader2, CheckCircle2, Tag, X, AlertCircle
} from 'lucide-react';
import type { Stop, CsoAvailableTrip } from '@/types';
import { fmtCurrency } from '@/lib/constants';

interface RoundTripReviewProps {
  outboundTrip: CsoAvailableTrip;
  outboundOriginStop: Stop;
  outboundDestinationStop: Stop;
  outboundSeats: string[];
  returnTrip: CsoAvailableTrip;
  returnOriginStop: Stop;
  returnDestinationStop: Stop;
  returnSeats: string[];
  passengers: { name: string; seatNoOutbound: string; seatNoReturn: string }[];
  outboundFarePerSeat: number;
  returnFarePerSeat: number;
  payment?: { method: 'cash' | 'qr' | 'ewallet' | 'bank'; amount: number };
  onPaymentChange: (payment: { method: 'cash' | 'qr' | 'ewallet' | 'bank'; amount: number }) => void;
  onBack: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  promoCode?: string;
  discountAmount?: number;
  onApplyPromo?: (code: string) => Promise<void>;
  onClearPromo?: () => void;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'qr', label: 'QRIS', icon: QrCode, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'bank', label: 'Transfer', icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
];

function getCashPresets(total: number): number[] {
  const denominations = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const presets = new Set<number>();
  for (const d of denominations) {
    const rounded = Math.ceil(total / d) * d;
    if (rounded >= total && rounded <= total * 3) presets.add(rounded);
  }
  for (const n of [50000, 100000, 200000, 500000, 1000000]) {
    if (n >= total && n <= total * 3) presets.add(n);
  }
  return Array.from(presets).sort((a, b) => a - b).slice(0, 4);
}

const formatTime = (isoString: string | null): string => {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    });
  } catch { return '--:--'; }
};

const formatDate = (isoString: string | null): string => {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleDateString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch { return '-'; }
};

export default function RoundTripReview({
  outboundTrip,
  outboundOriginStop,
  outboundDestinationStop,
  outboundSeats,
  returnTrip,
  returnOriginStop,
  returnDestinationStop,
  returnSeats,
  passengers,
  outboundFarePerSeat,
  returnFarePerSeat,
  payment,
  onPaymentChange,
  onBack,
  onConfirm,
  isLoading,
  promoCode,
  discountAmount = 0,
  onApplyPromo,
  onClearPromo,
}: RoundTripReviewProps) {
  const [cashReceived, setCashReceived] = useState<string>('');
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  const totalOutbound = outboundFarePerSeat * outboundSeats.length;
  const totalReturn = returnFarePerSeat * returnSeats.length;
  const grandTotal = Math.max(0, totalOutbound + totalReturn - discountAmount);

  const cashPresets = getCashPresets(grandTotal);
  const cashChange = payment?.method === 'cash' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - grandTotal)
    : 0;

  const isPaymentValid = () => {
    if (!payment?.method) return false;
    if (payment.method === 'cash') return parseFloat(cashReceived) >= grandTotal;
    return true;
  };

  const handleMethodSelect = (method: 'cash' | 'qr' | 'ewallet' | 'bank') => {
    onPaymentChange({ method, amount: grandTotal });
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || !onApplyPromo) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      await onApplyPromo(promoInput.trim());
      setPromoInput('');
    } catch {
      setPromoError('Kode promo tidak valid');
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          Ringkasan Pemesanan Pulang Pergi
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Mobile: compact side-by-side trip cards */}
          <div className="flex gap-2 md:hidden">
            <div className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-[9px] font-black text-blue-600 uppercase mb-1.5">Pergi</p>
              <p className="font-black text-sm text-gray-900">{outboundOriginStop.code} <ArrowRight className="w-3 h-3 inline text-gray-400" /> {outboundDestinationStop.code}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(outboundTrip.departAtAtOutlet)}</p>
              <p className="text-[10px] text-gray-500">{formatTime(outboundTrip.departAtAtOutlet)} · {outboundTrip.vehicle?.code}</p>
              <div className="mt-2 pt-2 border-t border-blue-100 space-y-0.5">
                {passengers.map((p, i) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span className="text-gray-600">{p.name.split(' ')[0]} ({p.seatNoOutbound})</span>
                    <span className="text-gray-500 font-mono">{fmtCurrency(outboundFarePerSeat)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[11px] font-bold text-blue-700 pt-0.5">
                  <span>Total</span>
                  <span className="font-mono">{fmtCurrency(totalOutbound)}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p className="text-[9px] font-black text-emerald-600 uppercase mb-1.5">Pulang</p>
              <p className="font-black text-sm text-gray-900">{returnOriginStop.code} <ArrowRight className="w-3 h-3 inline text-gray-400" /> {returnDestinationStop.code}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(returnTrip.departAtAtOutlet)}</p>
              <p className="text-[10px] text-gray-500">{formatTime(returnTrip.departAtAtOutlet)} · {returnTrip.vehicle?.code}</p>
              <div className="mt-2 pt-2 border-t border-emerald-100 space-y-0.5">
                {passengers.map((p, i) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span className="text-gray-600">{p.name.split(' ')[0]} ({p.seatNoReturn})</span>
                    <span className="text-gray-500 font-mono">{fmtCurrency(returnFarePerSeat)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[11px] font-bold text-emerald-700 pt-0.5">
                  <span>Total</span>
                  <span className="font-mono">{fmtCurrency(totalReturn)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: full cards side-by-side */}
          <div className="hidden md:grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-3xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Perjalanan Pergi</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">{outboundSeats.length} Kursi</span>
              </div>
              <div className="flex items-center gap-2 font-black text-gray-900">
                <span className="text-lg">{outboundOriginStop.code}</span>
                <ArrowRight className="w-4 h-4 text-gray-300" />
                <span className="text-lg">{outboundDestinationStop.code}</span>
              </div>
              <div className="space-y-1.5 border-t border-gray-200/50 pt-3">
                <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                  <Calendar className="w-3.5 h-3.5" />{formatDate(outboundTrip.departAtAtOutlet)}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                  <Clock className="w-3.5 h-3.5" />{formatTime(outboundTrip.departAtAtOutlet)} — {outboundTrip.vehicle?.code}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-2.5 space-y-1.5 border border-gray-100">
                {passengers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600 truncate mr-2 font-medium">{p.name} ({p.seatNoOutbound})</span>
                    <span className="font-mono font-bold text-gray-400">{fmtCurrency(outboundFarePerSeat)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 border-t border-gray-100 mt-1">
                  <span className="text-xs font-bold text-gray-800">Total Pergi</span>
                  <span className="text-xs font-black text-blue-600 font-mono">{fmtCurrency(totalOutbound)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-3xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Perjalanan Pulang</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">{returnSeats.length} Kursi</span>
              </div>
              <div className="flex items-center gap-2 font-black text-gray-900">
                <span className="text-lg">{returnOriginStop.code}</span>
                <ArrowRight className="w-4 h-4 text-gray-300" />
                <span className="text-lg">{returnDestinationStop.code}</span>
              </div>
              <div className="space-y-1.5 border-t border-gray-200/50 pt-3">
                <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                  <Calendar className="w-3.5 h-3.5" />{formatDate(returnTrip.departAtAtOutlet)}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                  <Clock className="w-3.5 h-3.5" />{formatTime(returnTrip.departAtAtOutlet)} — {returnTrip.vehicle?.code}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-2.5 space-y-1.5 border border-gray-100">
                {passengers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600 truncate mr-2 font-medium">{p.name} ({p.seatNoReturn})</span>
                    <span className="font-mono font-bold text-gray-400">{fmtCurrency(returnFarePerSeat)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 border-t border-gray-100 mt-1">
                  <span className="text-xs font-bold text-gray-800">Total Pulang</span>
                  <span className="text-xs font-black text-emerald-600 font-mono">{fmtCurrency(totalReturn)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Promo code input */}
          {onApplyPromo && (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Kode Promo / Voucher</p>
              {promoCode ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700 font-mono" data-testid="text-applied-promo-pp">{promoCode}</span>
                    {discountAmount > 0 && (
                      <span className="text-xs text-emerald-600">-{fmtCurrency(discountAmount)}</span>
                    )}
                  </div>
                  {onClearPromo && (
                    <button onClick={onClearPromo} className="text-emerald-400 hover:text-emerald-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                    placeholder="Masukkan kode promo..."
                    className="flex-1 h-9 px-3 bg-white border border-gray-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    data-testid="input-promo-pp"
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    className="h-9 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                    data-testid="btn-apply-promo-pp"
                  >
                    {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Pakai'}
                  </button>
                </div>
              )}
              {promoError && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {promoError}
                </div>
              )}
            </div>
          )}

          {/* Grand total card */}
          <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-100 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1">Total Pulang Pergi</p>
                  {discountAmount > 0 && (
                    <p className="text-xs text-blue-200 line-through font-mono">{fmtCurrency(totalOutbound + totalReturn)}</p>
                  )}
                  <p className="text-2xl font-black font-mono tracking-tight">{fmtCurrency(grandTotal)}</p>
                </div>
                <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/20 text-[10px] text-blue-200">
                <span>Pergi: <span className="font-bold text-white font-mono">{fmtCurrency(totalOutbound)}</span></span>
                <span className="text-blue-300">+</span>
                <span>Pulang: <span className="font-bold text-white font-mono">{fmtCurrency(totalReturn)}</span></span>
                {discountAmount > 0 && (
                  <>
                    <span className="text-blue-300">−</span>
                    <span>Diskon: <span className="font-bold text-emerald-300 font-mono">{fmtCurrency(discountAmount)}</span></span>
                  </>
                )}
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
          </div>

          {/* Payment method */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Metode Pembayaran</p>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                const isSelected = payment?.method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMethodSelect(m.id as any)}
                    className={`p-2.5 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                      isSelected ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`pay-${m.id}`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? m.color : 'text-gray-400'}`} />
                    <span className={`text-[9px] font-bold uppercase tracking-tight ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {payment?.method === 'cash' && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Uang Tunai Diterima</label>
                  <div className="relative mt-1">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Masukkan nominal..."
                      className="w-full h-11 pl-10 pr-4 bg-white border border-emerald-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-100"
                      data-testid="input-cash-pp"
                    />
                  </div>
                  {cashPresets.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {cashPresets.map(p => (
                        <button
                          key={p}
                          onClick={() => setCashReceived(String(p))}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            cashReceived === String(p)
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                          data-testid={`preset-cash-pp-${p}`}
                        >
                          {fmtCurrency(p)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {parseFloat(cashReceived) >= grandTotal && (
                  <div className="bg-white/60 rounded-xl p-2.5 flex items-center justify-between border border-emerald-200/50">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Kembalian</span>
                    <span className="text-base font-black text-emerald-700 font-mono">{fmtCurrency(cashChange)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-11 px-5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-gray-200 flex-shrink-0"
          data-testid="btn-review-back"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </button>
        <button
          onClick={onConfirm}
          disabled={!isPaymentValid() || isLoading}
          className="flex-1 h-11 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-100"
          data-testid="btn-confirm-pay-pp"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <><CheckCircle2 className="w-5 h-5" /> KONFIRMASI & BAYAR</>
          )}
        </button>
      </div>
    </div>
  );
}
