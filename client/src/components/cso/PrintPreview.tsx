import { CheckCircle2, Printer, RotateCcw, AlertCircle } from 'lucide-react';
import ETicketCard from './ETicketCard';

interface PrintPreviewProps {
  booking: any;
  printPayload: any;
  onNewBooking: () => void;
  onPrint: () => void;
}

export default function PrintPreview({ booking, onNewBooking, onPrint }: PrintPreviewProps) {
  if (!booking) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Memuat data booking...</p>
      </div>
    );
  }

  const isPaid = booking.status === 'paid';
  const bookingRef = booking.bookingCode || booking.id?.slice(0, 8).toUpperCase() || '-';

  return (
    <div className="space-y-5 flex flex-col items-center" data-testid="print-preview-container">
      <div className="text-center no-print">
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
          Kode: <span className="font-mono text-blue-600 font-semibold">{bookingRef}</span>
        </p>
      </div>

      <div className="w-full max-w-lg">
        <ETicketCard
          booking={booking}
          showPaymentSection={true}
          showFareColumn={true}
        />
      </div>

      <div className="flex gap-3 w-full max-w-lg no-print">
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
