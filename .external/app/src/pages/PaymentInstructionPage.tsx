import { useState } from 'react';
import { useNav } from '@/App';
import { bookingsApi, type PayBookingData } from '@/lib/api';
import { fmtCurrency } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, CheckCircle2, AlertTriangle, QrCode, Building2, Smartphone, LogOut } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import PaymentLogo from '@/components/PaymentLogo';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  bookingId: string;
  paymentMethod: string;
  paymentMethodName: string;
  paymentMethodType: string;
  total: number;
  holdExpiresAt: string | null;
}

// Mock data per metode pembayaran
function getMockPaymentData(method: string, amount: number) {
  const ref = `TRN${Date.now().toString().slice(-8)}`;
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  if (method === 'qris') {
    return {
      type: 'qris',
      qrValue: `00020101021226580014ID.CO.TRANSITY.WWW0118936008981700000016303C3B5204599953033605406${amount}5802ID5912Transity OTA6013Jakarta Pusat62070703${ref}6304MOCK`,
      instructions: [
        'Buka aplikasi e-wallet atau m-banking',
        'Pilih menu "Scan QR" atau "QRIS"',
        'Arahkan kamera ke QR Code di atas',
        'Periksa detail pembayaran, lalu konfirmasi',
      ],
    };
  }

  if (method.startsWith('va_')) {
    const bankMap: Record<string, { bank: string; va: string; logo: string }> = {
      va_bca:     { bank: 'BCA',     va: `88508${Math.floor(Math.random() * 9000000000 + 1000000000)}`, logo: 'BCA' },
      va_mandiri: { bank: 'Mandiri', va: `${Math.floor(Math.random() * 9000000000 + 1000000000)}`, logo: 'Mandiri' },
      va_bni:     { bank: 'BNI',     va: `988${Math.floor(Math.random() * 9000000000 + 1000000000)}`, logo: 'BNI' },
    };
    const bank = bankMap[method] || { bank: 'Bank', va: `${Math.floor(Math.random() * 9999999999 + 1000000000)}`, logo: 'Bank' };
    return {
      type: 'va',
      bank: bank.bank,
      vaNumber: bank.va,
      amount,
      expiry,
      instructions: [
        `Buka aplikasi atau ATM ${bank.bank}`,
        'Pilih Transfer → Virtual Account',
        `Masukkan nomor VA di atas`,
        `Pastikan jumlah transfer tepat ${fmtCurrency(amount)}`,
        'Selesaikan pembayaran sebelum batas waktu',
      ],
    };
  }

  if (method === 'bank_transfer') {
    return {
      type: 'transfer',
      accountName: 'PT TRANSITY INDONESIA',
      accounts: [
        { bank: 'BCA',     no: '1234567890', name: 'PT TRANSITY INDONESIA' },
        { bank: 'Mandiri', no: '1230009876543', name: 'PT TRANSITY INDONESIA' },
        { bank: 'BNI',     no: '0987654321', name: 'PT TRANSITY INDONESIA' },
      ],
      amount,
      ref,
      expiry,
      instructions: [
        'Transfer sesuai jumlah tepat (termasuk kode unik)',
        `Wajib cantumkan kode: ${ref} di berita transfer`,
        'Pembayaran diverifikasi dalam 1×24 jam kerja',
      ],
    };
  }

  // Ewallet (GoPay, OVO, DANA, ShopeePay)
  const ewalletMap: Record<string, string> = {
    ewallet_gopay:     'GoPay',
    ewallet_ovo:       'OVO',
    ewallet_dana:      'DANA',
    ewallet_shopeepay: 'ShopeePay',
  };
  const walletName = ewalletMap[method] || 'E-Wallet';
  return {
    type: 'ewallet',
    walletName,
    amount,
    expiry,
    instructions: [
      `Buka aplikasi ${walletName} di HP kamu`,
      'Pilih menu Bayar / Pay',
      `Masukkan nomor: 0812-3456-7890 (Transity)`,
      `Transfer tepat ${fmtCurrency(amount)}`,
      `Cantumkan kode: ${ref}`,
    ],
  };
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
    </button>
  );
}

export default function PaymentInstructionPage({ bookingId, paymentMethod, paymentMethodName, paymentMethodType, total, holdExpiresAt }: Props) {
  const { resetTo } = useNav();
  const queryClient = useQueryClient();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const mock = getMockPaymentData(paymentMethod, total);

  const payMutation = useMutation({
    mutationFn: () => bookingsApi.pay(bookingId, { paymentMethod } as PayBookingData),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['seatmap'] });
      queryClient.invalidateQueries({ queryKey: ['trips-search-infinite'] });
      resetTo({ name: 'booking-detail', bookingId: result.bookingId || bookingId, source: 'gateway' });
    },
    onError: (err: any) => {
    },
  });

  const isExpired = holdExpiresAt ? new Date(holdExpiresAt).getTime() < Date.now() : false;

  const handleBack = () => {
    if (payMutation.isPending) return;
    setShowExitConfirm(true);
  };

  const handleExitConfirmed = () => {
    setShowExitConfirm(false);
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['seatmap'] });
    queryClient.invalidateQueries({ queryKey: ['trips-search-infinite'] });
    resetTo({ name: 'my-trips' });
  };

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa]">
      <PageHeader
        title="Instruksi Pembayaran"
        subtitle={paymentMethodName}
        onBack={handleBack}
      />

      <div className="px-4 pt-4 safe-pb-36 space-y-3">
        {/* Header amount */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-600 rounded-2xl px-5 py-4 anim-slide-up">
          <p className="text-teal-300 text-[11px] font-semibold uppercase tracking-wider mb-1">Total Pembayaran</p>
          <p className="text-white font-display font-extrabold text-[28px]">{fmtCurrency(total)}</p>
          {holdExpiresAt && !isExpired && (
            <p className="text-teal-300 text-[11px] mt-1">
              Bayar sebelum {new Date(holdExpiresAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          )}
        </div>

        {/* QRIS */}
        {mock.type === 'qris' && (
          <div className="bg-white rounded-2xl shadow-soft p-5 flex flex-col items-center anim-slide-up delay-1">
            <div className="flex items-center gap-2 mb-4 self-start">
              <QrCode className="w-4 h-4 text-teal-600" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Scan QR Code</p>
            </div>
            <div className="bg-white border-4 border-teal-100 rounded-2xl p-3 shadow-sm">
              <QRCodeSVG value={mock.qrValue} size={180} level="M" />
            </div>
            <p className="text-[11px] text-slate-400 mt-3 text-center">Scan menggunakan aplikasi e-wallet atau m-banking apapun yang mendukung QRIS</p>
          </div>
        )}

        {/* Virtual Account */}
        {mock.type === 'va' && (
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up delay-1">
            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <PaymentLogo methodId={paymentMethod} size="sm" />
              <div>
                <p className="font-bold text-[14px]">Virtual Account {mock.bank}</p>
                <p className="text-[11px] text-slate-400">Berlaku hingga {mock.expiry}</p>
              </div>
            </div>
            <div className="mx-4 mb-4 bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Nomor Virtual Account</p>
                <p className="font-display font-extrabold text-[22px] text-slate-800 tracking-widest">{mock.vaNumber}</p>
              </div>
              <CopyButton value={mock.vaNumber!} />
            </div>
            <div className="mx-4 mb-4 bg-amber-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Jumlah Transfer</p>
                <p className="font-display font-extrabold text-[20px] text-amber-800">{fmtCurrency(mock.amount!)}</p>
              </div>
              <CopyButton value={String(mock.amount)} />
            </div>
          </div>
        )}

        {/* Bank Transfer */}
        {mock.type === 'transfer' && (
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up delay-1">
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-teal-600" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rekening Tujuan</p>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2.5">
              {mock.accounts?.map((acc) => (
                <div key={acc.bank} className="bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{acc.bank}</p>
                      <p className="font-display font-bold text-[18px] text-slate-800 tracking-wider">{acc.no}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{acc.name}</p>
                    </div>
                    <CopyButton value={acc.no} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mx-4 mb-4 bg-amber-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Jumlah Transfer</p>
                <p className="font-display font-extrabold text-[20px] text-amber-800">{fmtCurrency(mock.amount!)}</p>
              </div>
              <CopyButton value={String(mock.amount)} />
            </div>
            <div className="mx-4 mb-4 bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-0.5">Kode Unik (wajib cantumkan)</p>
                <p className="font-display font-extrabold text-[18px] text-blue-800 tracking-wider">{mock.ref}</p>
              </div>
              <CopyButton value={mock.ref!} />
            </div>
          </div>
        )}

        {/* E-Wallet */}
        {mock.type === 'ewallet' && (
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up delay-1">
            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <PaymentLogo methodId={paymentMethod} size="sm" />
              <div>
                <p className="font-bold text-[14px]">Bayar via {mock.walletName}</p>
                <p className="text-[11px] text-slate-400">Berlaku hingga {mock.expiry}</p>
              </div>
            </div>
            <div className="mx-4 mb-4 bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Transfer ke Nomor</p>
                <p className="font-display font-extrabold text-[22px] text-slate-800 tracking-widest">0812-3456-7890</p>
                <p className="text-[11px] text-slate-500">a/n Transity Indonesia</p>
              </div>
              <CopyButton value="081234567890" />
            </div>
            <div className="mx-4 mb-4 bg-amber-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Jumlah Transfer</p>
                <p className="font-display font-extrabold text-[20px] text-amber-800">{fmtCurrency(mock.amount!)}</p>
              </div>
              <CopyButton value={String(mock.amount)} />
            </div>
          </div>
        )}

        {/* Cara Bayar */}
        <div className="bg-white rounded-2xl shadow-soft p-4 anim-slide-up delay-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Cara Bayar</p>
          <ol className="space-y-2.5">
            {mock.instructions?.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[13px] text-slate-600 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Sandbox notice */}
        <div className="bg-amber-50 border border-amber-200/60 rounded-2xl px-4 py-3 flex items-start gap-3 anim-slide-up delay-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700 leading-relaxed">
            <span className="font-bold">Mode Demo</span> — Pembayaran belum terhubung ke payment gateway. Klik "Konfirmasi Pembayaran" untuk mensimulasikan pembayaran berhasil.
          </p>
        </div>

        {payMutation.isError && (
          <div className="bg-red-50 border border-red-200/60 rounded-2xl px-4 py-3">
            <p className="text-[13px] text-red-600 font-medium">
              {(payMutation.error as any)?.message || 'Gagal mengkonfirmasi. Coba lagi.'}
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
          <Button
            className="w-full h-13 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[15px] font-bold shadow-lg shadow-emerald-600/15 transition-all active:scale-[0.97]"
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending || isExpired}
          >
            {payMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {isExpired ? 'Waktu Pembayaran Habis' : 'Konfirmasi Pembayaran'}
          </Button>
          <p className="text-center text-[11px] text-slate-400">
            Dengan mengkonfirmasi, booking kamu akan ditandai sebagai terbayar
          </p>
        </div>
      </div>

      <ConfirmSheet
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title="Keluar dari Pembayaran?"
        description="Pesananmu akan tetap tersimpan dan bisa dibayar nanti dari halaman Pesanan Saya sebelum batas waktu habis."
        icon={
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <LogOut className="w-7 h-7 text-amber-600" />
          </div>
        }
        confirmLabel="Keluar"
        cancelLabel="Lanjut Bayar"
        onConfirm={handleExitConfirmed}
        onCancel={() => setShowExitConfirm(false)}
        variant="warning"
      />
    </div>
  );
}
