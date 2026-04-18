import { useState, useEffect, useRef } from 'react';
import { useNav } from '@/App';
import { bookingsApi, paymentsApi, type PayBookingData, type PaymentMethod } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Wallet, QrCode, Building2, Smartphone, Tag, X, Check, ChevronRight, TicketPercent, Clock, AlertTriangle, LogOut, Bus, CalendarDays, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import PaymentLogo from '@/components/PaymentLogo';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Props {
  tripId: string;
  serviceDate: string;
  originStopId: string;
  destStopId: string;
  originSeq: number;
  destSeq: number;
  seats: string[];
  tripLabel: string;
  fare: number;
  originStopName?: string;
  destStopName?: string;
  originTime?: string;
  destTime?: string;
  passengers: Array<{ fullName: string; phone?: string; seatNo: string }>;
  bookingId: string;
  holdExpiresAt: string | null;
}

// Fallback jika API /gateway/payments/methods tidak tersedia
// ID harus match persis dengan CONSOLE_PAYMENT_METHODS di gateway.proxy.ts
const FALLBACK_METHODS: PaymentMethod[] = [
  { id: 'qris',              name: 'QRIS',                   type: 'qris',            description: 'Scan QR dari e-wallet atau m-banking', enabled: true },
  { id: 'ewallet_gopay',     name: 'GoPay',                  type: 'ewallet',         description: 'Bayar via GoPay', enabled: true },
  { id: 'ewallet_ovo',       name: 'OVO',                    type: 'ewallet',         description: 'Bayar via OVO', enabled: true },
  { id: 'ewallet_dana',      name: 'DANA',                   type: 'ewallet',         description: 'Bayar via DANA', enabled: true },
  { id: 'ewallet_shopeepay', name: 'ShopeePay',              type: 'ewallet',         description: 'Bayar via ShopeePay', enabled: true },
  { id: 'va_bca',            name: 'Virtual Account BCA',    type: 'virtual_account', description: 'Pembayaran via VA BCA', enabled: true },
  { id: 'va_mandiri',        name: 'Virtual Account Mandiri',type: 'virtual_account', description: 'Pembayaran via VA Mandiri', enabled: true },
  { id: 'va_bni',            name: 'Virtual Account BNI',    type: 'virtual_account', description: 'Pembayaran via VA BNI', enabled: true },
  { id: 'bank_transfer',     name: 'Transfer Bank',          type: 'bank_transfer',   description: 'BCA, Mandiri, BNI, BRI', enabled: true },
];

function getMethodIcon(type: PaymentMethod['type']) {
  switch (type) {
    case 'qris': return QrCode;
    case 'ewallet': return Wallet;
    case 'bank_transfer': return Building2;
    case 'virtual_account': return Smartphone;
    default: return CreditCard;
  }
}

function getMethodGroupLabel(type: PaymentMethod['type']) {
  switch (type) {
    case 'qris': return 'QRIS';
    case 'ewallet': return 'E-Wallet';
    case 'bank_transfer': return 'Transfer Bank';
    case 'virtual_account': return 'Virtual Account';
    default: return 'Lainnya';
  }
}

function useCountdown(expiresAt: string | null | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }

    const calc = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setRemaining(calc());
    intervalRef.current = setInterval(() => {
      const val = calc();
      setRemaining(val);
      if (val <= 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  if (remaining === null) return { expired: false, minutes: 0, seconds: 0, totalSeconds: null, formatted: '' };
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { expired: remaining <= 0, minutes, seconds, totalSeconds: remaining, formatted };
}

function getDuration(depart: string | null | undefined, arrive: string | null | undefined): string | null {
  if (!depart || !arrive) return null;
  try {
    const t1 = depart.includes('T') ? depart : `2000-01-01T${depart}`;
    const t2 = arrive.includes('T') ? arrive : `2000-01-01T${arrive}`;
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    let diffMs = d2.getTime() - d1.getTime();
    if (diffMs <= 0) diffMs += 86400000;
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 0 && mins > 0) return `${hours}j ${mins}m`;
    if (hours > 0) return `${hours}j`;
    return `${mins}m`;
  } catch { return null; }
}

function TripSummaryCard({ serviceDate, originStopName, destStopName, originTime, destTime, seats, passengerCount }: {
  serviceDate: string;
  originStopName?: string;
  destStopName?: string;
  originTime?: string;
  destTime?: string;
  seats: string[];
  passengerCount: number;
}) {
  const duration = getDuration(originTime, destTime);
  let dateLabel = serviceDate;
  try { dateLabel = format(parseISO(serviceDate), 'EEE, d MMM yyyy', { locale: idLocale }); } catch {}

  return (
    <div className="rounded-2xl overflow-hidden anim-slide-up" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)' }}>
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 px-4 pt-3.5 pb-4 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/[0.06]" />
        <div className="absolute bottom-2 -left-6 w-20 h-20 rounded-full bg-white/[0.04]" />

        <p className="relative text-[12px] font-semibold text-white/70 mb-3">{dateLabel}</p>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-white/40 mb-0.5">Berangkat</p>
            <p className="font-display font-black text-[24px] text-white leading-none tabular-nums">{fmtTime(originTime)}</p>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-1 px-1">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <div className="w-5 h-px bg-white/20" />
              <Bus className="w-3.5 h-3.5 text-white/40" />
              <div className="w-5 h-px bg-white/20" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
            </div>
            {duration && <span className="text-[9px] font-semibold text-white/40">{duration}</span>}
          </div>

          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] font-medium text-white/40 mb-0.5">Tiba</p>
            <p className="font-display font-black text-[24px] text-white/80 leading-none tabular-nums">{fmtTime(destTime)}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -top-[10px] -left-[10px] w-5 h-5 rounded-full bg-[#f8fafa]" />
        <div className="absolute -top-[10px] -right-[10px] w-5 h-5 rounded-full bg-[#f8fafa]" />
        <div className="absolute top-0 left-5 right-5 border-t border-dashed border-slate-200" style={{ top: '-0.5px' }} />
      </div>

      <div className="bg-white px-4 pt-4 pb-3.5">
        <div className="flex">
          <div style={{ width: 14 }} className="flex flex-col items-center shrink-0 self-stretch mr-3">
            <div className="w-2.5 h-2.5 rounded-full border-[2px] border-teal-500 bg-white mt-0.5" />
            <div className="w-[1.5px] flex-1 bg-gradient-to-b from-teal-300/60 to-emerald-300/60 my-1" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mb-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="pb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Naik</span>
                <span className="text-[11px] font-bold text-slate-400 tabular-nums">{fmtTime(originTime)}</span>
              </div>
              <p className="text-[14px] font-bold text-slate-800 mt-0.5 leading-snug">{originStopName || 'Keberangkatan'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Turun</span>
                <span className="text-[11px] font-bold text-slate-400 tabular-nums">{fmtTime(destTime)}</span>
              </div>
              <p className="text-[14px] font-bold text-slate-800 mt-0.5 leading-snug">{destStopName || 'Tujuan'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <div className="flex gap-1.5">
            {seats.map((s) => (
              <span key={s} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-[11px] font-bold">{s}</span>
            ))}
          </div>
          <span className="text-[11px] text-slate-300">·</span>
          <span className="text-[11px] text-slate-500 font-medium">{passengerCount} penumpang</span>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage({ tripId, serviceDate, originStopId, destStopId, originSeq, destSeq, seats, tripLabel, fare, originStopName, destStopName, originTime, destTime, passengers, bookingId, holdExpiresAt }: Props) {
  const { navigateReplace, resetTo } = useNav();
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherApplied, setVoucherApplied] = useState<{ code: string; discount: number } | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const countdown = useCountdown(holdExpiresAt);

  const { data: apiMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentsApi.getMethods(),
    staleTime: 5 * 60 * 1000,
  });

  const methods = (apiMethods && apiMethods.length > 0) ? apiMethods.filter(m => m.enabled) : FALLBACK_METHODS;

  const subtotal = fare * seats.length;
  const discount = voucherApplied?.discount || 0;
  const total = Math.max(0, subtotal - discount);

  const grouped = methods.reduce<Record<string, PaymentMethod[]>>((acc, m) => {
    const key = m.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const groupOrder: PaymentMethod['type'][] = ['qris', 'ewallet', 'virtual_account', 'bank_transfer', 'other'];

  const payMutation = useMutation({
    mutationFn: (data: PayBookingData) => bookingsApi.pay(bookingId, data),
    onMutate: () => setSubmitting(true),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['seatmap'] });
      queryClient.invalidateQueries({ queryKey: ['trips-search-infinite'] });
      resetTo({ name: 'booking-detail', bookingId: booking.bookingId || bookingId, source: 'gateway' });
    },
    onError: (err: any) => {
      if (err?.code === 'HOLD_EXPIRED') {
        setError('Waktu pemesanan telah habis. Silakan ulangi pemesanan.');
        setSubmitting(false);
        return;
      }
      setError(err?.message || 'Terjadi kesalahan saat memproses pembayaran');
      setSubmitting(false);
    },
  });

  const isPending = payMutation.isPending || submitting;

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError('');
    const result = await paymentsApi.validateVoucher(voucherCode.trim(), tripId, subtotal);
    setVoucherLoading(false);
    if (result.valid && result.discount > 0) {
      setVoucherApplied({ code: voucherCode.trim().toUpperCase(), discount: result.discount });
      setVoucherCode('');
    } else {
      setVoucherError(result.message || 'Kode voucher tidak valid');
    }
  };

  const handlePay = () => {
    if (!selectedMethod) {
      setError('Pilih metode pembayaran terlebih dahulu');
      return;
    }
    if (countdown.expired) {
      setError('Waktu pemesanan telah habis. Silakan ulangi pemesanan.');
      return;
    }
    setError('');
    // Navigasi ke halaman instruksi pembayaran (bukan langsung bayar)
    const selectedMethodObj = methods.find(m => m.id === selectedMethod);
    navigateReplace({
      name: 'payment-instruction',
      bookingId,
      paymentMethod: selectedMethod,
      paymentMethodName: selectedMethodObj?.name || selectedMethod,
      paymentMethodType: selectedMethodObj?.type || 'other',
      total,
      holdExpiresAt: holdExpiresAt ?? null,
    });
  };

  const handleBack = () => {
    if (isPending) return;
    setShowExitConfirm(true);
  };

  const handleExitConfirmed = () => {
    setShowExitConfirm(false);
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['seatmap'] });
    queryClient.invalidateQueries({ queryKey: ['trips-search-infinite'] });
    resetTo({ name: 'my-trips' });
  };

  const isUrgent = countdown.totalSeconds !== null && countdown.totalSeconds <= 120 && !countdown.expired;

  return (
    <div className="anim-fade">
      <PageHeader title="Pembayaran" onBack={handleBack} />

      <div className="px-4 pt-4 safe-pb-36">
        {holdExpiresAt && (
          <div className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-2xl mb-3 anim-slide-up',
            countdown.expired
              ? 'bg-red-50 border border-red-200/60'
              : isUrgent
                ? 'bg-amber-50 border border-amber-200/60'
                : 'bg-teal-50 border border-teal-200/60',
          )}>
            {countdown.expired ? (
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            ) : (
              <Clock className={cn('w-5 h-5 shrink-0', isUrgent ? 'text-amber-500' : 'text-teal-600')} />
            )}
            <div className="flex-1">
              {countdown.expired ? (
                <>
                  <p className="text-[13px] font-bold text-red-700">Waktu pemesanan habis</p>
                  <p className="text-[11px] text-red-500">Kursi tidak lagi dipesan untukmu. Silakan ulangi pemesanan.</p>
                </>
              ) : (
                <>
                  <p className={cn('text-[11px] font-medium', isUrgent ? 'text-amber-600' : 'text-teal-600')}>Selesaikan pembayaran dalam</p>
                  <p className={cn('text-[20px] font-display font-extrabold tabular-nums', isUrgent ? 'text-amber-700' : 'text-teal-800')}>{countdown.formatted}</p>
                </>
              )}
            </div>
            {countdown.expired && (
              <Button
                variant="outline"
                className="h-9 px-4 rounded-xl text-[12px] font-bold border-red-300 text-red-600 hover:bg-red-100"
                onClick={handleExitConfirmed}
              >
                Kembali
              </Button>
            )}
          </div>
        )}

        <TripSummaryCard
          serviceDate={serviceDate}
          originStopName={originStopName}
          destStopName={destStopName}
          originTime={originTime}
          destTime={destTime}
          seats={seats}
          passengerCount={passengers.length}
        />

        <div className="bg-white rounded-2xl shadow-soft mt-3 overflow-hidden anim-slide-up delay-1">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <TicketPercent className="w-4 h-4 text-orange-500" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voucher / Promo</p>
            </div>
          </div>
          <div className="px-4 pb-4">
            {voucherApplied ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200/60 rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-[13px] font-bold text-green-700">{voucherApplied.code}</p>
                    <p className="text-[11px] text-green-600">Hemat {fmtCurrency(voucherApplied.discount)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setVoucherApplied(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-green-600" />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(''); }}
                    placeholder="Masukkan kode voucher"
                    className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-[13px] font-semibold tracking-wider uppercase placeholder:text-slate-300 placeholder:normal-case placeholder:tracking-normal placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all"
                  />
                  <Button
                    variant="outline"
                    className="h-11 px-4 rounded-xl text-[13px] font-bold border-teal-600/30 text-teal-700 hover:bg-teal-50"
                    onClick={handleApplyVoucher}
                    disabled={voucherLoading || !voucherCode.trim()}
                  >
                    {voucherLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pakai'}
                  </Button>
                </div>
                {voucherError && (
                  <p className="text-[12px] text-red-500 font-medium mt-2">{voucherError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft mt-3 overflow-hidden anim-slide-up delay-2">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-teal-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metode Pembayaran</p>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-4">
            {groupOrder.map((type) => {
              const group = grouped[type];
              if (!group || group.length === 0) return null;
              return (
                <div key={type}>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{getMethodGroupLabel(type)}</p>
                  <div className="space-y-1.5">
                    {group.map((m) => {
                      const isSelected = selectedMethod === m.id;
                      const isDisabled = countdown.expired;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMethod(m.id)}
                          disabled={isDisabled}
                          className={cn(
                            'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left',
                            isDisabled
                              ? 'opacity-50 cursor-not-allowed border-slate-150 bg-slate-50'
                              : isSelected
                                ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20'
                                : 'border-slate-150 bg-white hover:bg-slate-50/80',
                          )}
                        >
                          <PaymentLogo methodId={m.id} size="sm" selected={isSelected} />
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-[13px] font-semibold', isSelected ? 'text-teal-800' : 'text-slate-700')}>{m.name}</p>
                            {m.description && (
                              <p className="text-[11px] text-slate-400 truncate">{m.description}</p>
                            )}
                          </div>
                          {isSelected ? (
                            <Check className="w-5 h-5 text-teal-600 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft mt-3 overflow-hidden anim-slide-up delay-3">
          <div className="px-4 py-4 space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-500">Harga tiket ({seats.length}x)</span>
              <span className="font-semibold text-slate-700">{fmtCurrency(subtotal)}</span>
            </div>
            {voucherApplied && (
              <div className="flex justify-between text-[13px]">
                <span className="text-green-600">Diskon voucher</span>
                <span className="font-semibold text-green-600">-{fmtCurrency(discount)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between">
              <span className="text-[14px] font-bold text-slate-800">Total</span>
              <span className="text-[16px] font-extrabold font-display text-teal-800">{fmtCurrency(total)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200/60 rounded-2xl anim-scale">
            <p className="text-[13px] text-red-600 font-medium">{error}</p>
            {submitting && (
              <Button
                variant="outline"
                className="mt-3 w-full h-10 rounded-xl border-teal-300 text-teal-700 hover:bg-teal-50 text-[13px] font-bold"
                onClick={() => resetTo({ name: 'my-trips' })}
              >
                Cek Pesanan Saya
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Button
            className="w-full h-13 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[15px] font-bold shadow-lg shadow-emerald-600/15 transition-all active:scale-[0.97] gap-2"
            onClick={handlePay}
            disabled={isPending || !selectedMethod || countdown.expired}
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )}
            {countdown.expired ? 'Waktu Habis' : `Lanjut ke Pembayaran`}
          </Button>
        </div>
      </div>

      <ConfirmSheet
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title="Keluar dari Pembayaran?"
        description="Pesananmu akan tetap tersimpan dan bisa dibayar nanti sebelum batas waktu habis."
        icon={
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <LogOut className="w-7 h-7 text-amber-600" />
          </div>
        }
        confirmLabel="Keluar"
        cancelLabel="Lanjut Transaksi"
        onConfirm={handleExitConfirmed}
        onCancel={() => setShowExitConfirm(false)}
        variant="warning"
      />
    </div>
  );
}
