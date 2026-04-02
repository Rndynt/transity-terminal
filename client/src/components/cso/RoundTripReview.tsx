import { useState, useMemo } from 'react';
import { 
  ArrowRight, MapPin, Calendar, Clock, CreditCard, 
  Banknote, QrCode, Wallet, Building2, ChevronLeft, 
  Loader2, CheckCircle2, AlertCircle
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
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'qr', label: 'QRIS', icon: QrCode, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'bank', label: 'Transfer', icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
];

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
  isLoading
}: RoundTripReviewProps) {
  const [cashReceived, setCashReceived] = useState<string>('');

  const totalOutbound = outboundFarePerSeat * outboundSeats.length;
  const totalReturn = returnFarePerSeat * returnSeats.length;
  const grandTotal = totalOutbound + totalReturn;

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

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-100 p-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          Ringkasan Pemesanan Pulang Pergi
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-3xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Perjalanan Pergi</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">
                {outboundSeats.length} Kursi
              </span>
            </div>
            
            <div className="flex items-center gap-2 font-black text-gray-900">
              <div className="flex flex-col items-center">
                <span className="text-lg">{outboundOriginStop.code}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300" />
              <div className="flex flex-col items-center">
                <span className="text-lg">{outboundDestinationStop.code}</span>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-gray-200/50 pt-3">
              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(outboundTrip.departAtAtOutlet)}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(outboundTrip.departAtAtOutlet)} — {outboundTrip.vehicle?.code}
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
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">
                {returnSeats.length} Kursi
              </span>
            </div>
            
            <div className="flex items-center gap-2 font-black text-gray-900">
              <div className="flex flex-col items-center">
                <span className="text-lg">{returnOriginStop.code}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300" />
              <div className="flex flex-col items-center">
                <span className="text-lg">{returnDestinationStop.code}</span>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-gray-200/50 pt-3">
              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(returnTrip.departAtAtOutlet)}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(returnTrip.departAtAtOutlet)} — {returnTrip.vehicle?.code}
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

        <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-xl shadow-blue-100 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1">Total Pulang Pergi</p>
              <p className="text-3xl font-black font-mono tracking-tighter">{fmtCurrency(grandTotal)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Metode Pembayaran</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon;
              const isSelected = payment?.method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleMethodSelect(m.id as any)}
                  className={`
                    p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5
                    ${isSelected ? 'bg-blue-50 border-blue-600 ring-4 ring-blue-50 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}
                  `}
                  data-testid={`pay-${m.id}`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? m.color : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-tight ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          {payment?.method === 'cash' && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-4 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Uang Tunai Diterima</label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="Masukkan nominal..."
                    className="w-full h-11 pl-10 pr-4 bg-white border border-emerald-200 rounded-2xl text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-100"
                    data-testid="input-cash-pp"
                  />
                </div>
              </div>
              {parseFloat(cashReceived) >= grandTotal && (
                <div className="flex-1 bg-white/50 rounded-2xl p-3 flex flex-col items-center justify-center border border-emerald-200/50">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase">Kembalian</span>
                  <span className="text-xl font-black text-emerald-700 font-mono">{fmtCurrency(cashChange)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="h-11 px-6 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-gray-200"
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
            <>
              <CheckCircle2 className="w-5 h-5" /> KONFIRMASI & BAYAR
            </>
          )}
        </button>
      </div>
    </div>
  );
}
