import { CheckCircle2, Printer, RotateCcw, Bus, MapPin, ChevronRight, User, Hash, Calendar, Armchair, ArrowRight } from 'lucide-react';
import { fmtCurrency } from '@/lib/constants';

interface RoundTripPrintPreviewProps {
  group: any;
  outboundBooking: any;
  returnBooking: any;
  printPayloads: any[];
  onNewBooking: () => void;
  onPrint: () => void;
}

export default function RoundTripPrintPreview({
  group,
  outboundBooking,
  returnBooking,
  onNewBooking,
  onPrint
}: RoundTripPrintPreviewProps) {
  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('id-ID', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta'
      });
    } catch { return '-'; }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
      });
    } catch { return '--:--'; }
  };

  const TicketCard = ({ booking, title, color }: { booking: any, title: string, color: string }) => (
    <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col print-section mb-4">
      <div className={`px-5 py-3 ${color} flex items-center justify-between`}>
        <span className="text-white font-black text-xs uppercase tracking-widest">{title}</span>
        <span className="px-2 py-0.5 bg-white/20 rounded-md text-[9px] font-bold text-white uppercase tracking-tighter">
          {booking?.bookingCode || 'TICKET'}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 text-center">
            <p className="text-xl font-black text-gray-900 leading-none">{booking?.originStop?.code || 'ORI'}</p>
            <p className="text-[9px] text-gray-400 mt-1 truncate">{booking?.originStop?.name}</p>
            <p className="text-[10px] font-mono font-bold text-blue-600 mt-1">{formatTime(booking?.departAt)}</p>
          </div>
          <div className="px-4 flex flex-col items-center">
            <div className="flex items-center w-20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <div className="flex-1 border-t border-dashed border-gray-200 mx-1" />
              <Bus className="w-3.5 h-3.5 text-gray-300" />
              <div className="flex-1 border-t border-dashed border-gray-200 mx-1" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xl font-black text-gray-900 leading-none">{booking?.destinationStop?.code || 'DST'}</p>
            <p className="text-[9px] text-gray-400 mt-1 truncate">{booking?.destinationStop?.name}</p>
            <p className="text-[10px] font-mono font-bold text-gray-400 mt-1">{formatTime(booking?.arriveAt || '')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 mb-4">
          <div className="flex items-start gap-1.5">
            <Calendar className="w-3 h-3 text-gray-400 mt-0.5" />
            <div>
              <p className="text-[8px] text-gray-400 uppercase font-bold tracking-tight">Tanggal</p>
              <p className="text-[10px] font-bold text-gray-700">{formatDate(booking?.departAt)}</p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Bus className="w-3 h-3 text-gray-400 mt-0.5" />
            <div>
              <p className="text-[8px] text-gray-400 uppercase font-bold tracking-tight">Armada</p>
              <p className="text-[10px] font-bold text-gray-700">{booking?.vehicle?.plate || 'BUS'}</p>
            </div>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">
              <th className="text-left py-1">Penumpang</th>
              <th className="text-center py-1">Kursi</th>
              <th className="text-right py-1">Tiket</th>
            </tr>
          </thead>
          <tbody>
            {booking?.passengers?.map((p: any, idx: number) => (
              <tr key={idx} className="border-t border-gray-50">
                <td className="py-2 text-[10px] font-bold text-gray-700 truncate max-w-[120px]">{p.fullName}</td>
                <td className="py-2 text-center">
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-black">{p.seatNo}</span>
                </td>
                <td className="py-2 text-right font-mono text-[9px] text-blue-600 font-bold">{p.ticketNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12" data-testid="round-trip-print-preview">
      <div className="text-center no-print py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-3xl mb-4 shadow-sm shadow-emerald-50">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Pemesanan PP Berhasil!</h2>
        <div className="flex items-center justify-center gap-1.5 text-blue-600 font-black font-mono tracking-tighter">
          <Hash className="w-4 h-4" />
          <span>{group?.groupCode || 'PP-CODE'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TicketCard booking={outboundBooking} title="Tiket Pergi [1/2]" color="bg-blue-600" />
        <TicketCard booking={returnBooking} title="Tiket Pulang [2/2]" color="bg-emerald-600" />
      </div>

      <div className="flex gap-3 no-print">
        <button
          onClick={onPrint}
          className="flex-1 h-12 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
          data-testid="btn-print-tickets"
        >
          <Printer className="w-4 h-4" /> CETAK TIKET
        </button>
        <button
          onClick={onNewBooking}
          className="flex-1 h-12 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all active:scale-[0.98]"
          data-testid="btn-new-pp-booking"
        >
          <RotateCcw className="w-4 h-4" /> BOOKING BARU
        </button>
      </div>
    </div>
  );
}
