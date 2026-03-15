import {
  CheckCircle2, Printer, RotateCcw, AlertCircle,
  Calendar, Bus, Store, Users, CreditCard, QrCode
} from 'lucide-react';

interface PrintPreviewProps {
  booking: any;
  printPayload: any;
  onNewBooking: () => void;
  onPrint: () => void;
}

const fmt = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

export default function PrintPreview({ booking, onNewBooking, onPrint }: PrintPreviewProps) {
  if (!booking) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Memuat data booking...</p>
      </div>
    );
  }

  const isPaid = booking.status === 'paid';
  const bookingIdShort = booking.id?.slice(0, 8).toUpperCase() || '-';

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('id-ID', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Jakarta'
      });
    } catch { return '-'; }
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
      });
    } catch { return '-'; }
  };

  const originCode = booking.originStop?.code || 'ORI';
  const destCode = booking.destinationStop?.code || 'DST';

  return (
    <div className="space-y-5 flex flex-col items-center" data-testid="print-preview-container">
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${isPaid ? 'bg-emerald-100' : 'bg-amber-100'}`}>
          {isPaid ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          ) : (
            <AlertCircle className="w-7 h-7 text-amber-600" />
          )}
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {isPaid ? 'Booking Berhasil!' : 'Booking Tersimpan'}
        </h2>
        <p className="text-sm text-gray-500">
          ID: <span className="font-mono text-blue-600 font-semibold">{bookingIdShort}</span>
        </p>
      </div>

      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm" data-testid="eticket-card">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-base tracking-wide">E-Ticket</span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            isPaid ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/20 text-white/80'
          }`}>
            {isPaid ? 'LUNAS' : 'BELUM BAYAR'}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900 tracking-wider">{originCode}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{booking.originStop?.name}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">{formatTime(booking.departAt || booking.createdAt)}</p>
            </div>
            <div className="flex-1 mx-4 flex flex-col items-center">
              <div className="flex items-center w-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                <Bus className="w-4 h-4 text-blue-500" />
                <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                <div className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900 tracking-wider">{destCode}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{booking.destinationStop?.name}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">{formatTime(booking.arriveAt || '')}</p>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoCell icon={Calendar} label="Tanggal" value={formatDate(booking.tripDetails?.serviceDate || booking.createdAt)} />
            <InfoCell icon={Bus} label="Kendaraan" value={booking.tripDetails?.vehicleCode || booking.vehicle?.code || '-'} />
            <InfoCell icon={Store} label="Outlet" value={booking.outlet?.name || '-'} />
            <InfoCell icon={Users} label="Penumpang" value={`${booking.passengers?.length || 0} orang`} />
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          {booking.passengers && booking.passengers.length > 0 && (
            <>
              <table className="w-full text-sm" data-testid="passenger-table">
                <thead>
                  <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                    <th className="text-left py-1 font-medium">Nama</th>
                    <th className="text-center py-1 font-medium w-14">Kursi</th>
                    <th className="text-right py-1 font-medium w-24">Tarif</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {booking.passengers.map((p: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100" data-testid={`passenger-row-${i}`}>
                      <td className="py-1.5 font-medium">{p.fullName}</td>
                      <td className="py-1.5 text-center">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono font-bold">{p.seatNo}</span>
                      </td>
                      <td className="py-1.5 text-right font-mono text-gray-600">{fmt(p.fareAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-gray-200 my-3" />
            </>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-600">Total</span>
            <span className="text-lg font-black text-blue-700 font-mono">{fmt(booking.totalAmount)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            {booking.payments && booking.payments.length > 0
              ? <span className="capitalize">{booking.payments[0].method}</span>
              : 'Belum dibayar'
            }
          </span>
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-200" data-testid="qr-placeholder">
            <QrCode className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-lg">
        {isPaid ? (
          <button
            onClick={onPrint}
            className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            data-testid="button-print"
          >
            <Printer className="w-4 h-4" /> Cetak Tiket
          </button>
        ) : (
          <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2" data-testid="unpaid-notice">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">Belum dibayar — tiket dicetak setelah pembayaran.</p>
          </div>
        )}
        <button
          onClick={onNewBooking}
          className="flex-1 h-10 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-gray-200 transition-colors"
          data-testid="button-new-booking"
        >
          <RotateCcw className="w-4 h-4" /> Booking Baru
        </button>
      </div>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-[11px] font-medium text-gray-700">{value}</p>
      </div>
    </div>
  );
}
