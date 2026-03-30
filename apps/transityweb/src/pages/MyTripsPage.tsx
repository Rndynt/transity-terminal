import { useQuery } from '@tanstack/react-query';
import { useNav, useAuth } from '@/App';
import { bookingsApi, type BookingListItem } from '@/lib/api';
import { fmtCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Loader2, Ticket, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  held: { label: 'Menunggu', variant: 'warning' },
  confirmed: { label: 'Aktif', variant: 'success' },
  completed: { label: 'Selesai', variant: 'secondary' },
  cancelled: { label: 'Batal', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'destructive' },
};

export default function MyTripsPage() {
  const { navigate } = useNav();
  const { user } = useAuth();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list(),
    enabled: !!user,
  });

  return (
    <div className="anim-fade">
      <div className="px-5 pt-14 pb-4">
        <h1 className="font-display font-bold text-[22px] text-slate-800">Pesanan Saya</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Riwayat dan tiket aktif Anda</p>
      </div>

      <div className="px-4 pb-28">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        )}

        {bookings && bookings.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Ticket className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700">Belum ada pesanan</p>
            <p className="text-[13px] text-slate-400 mt-1">Yuk pesan tiket pertamamu!</p>
          </div>
        )}

        <div className="space-y-3">
          {bookings?.map((b: BookingListItem, i: number) => {
            const st = STATUS_CFG[b.status || ''] || { label: b.status, variant: 'secondary' as const };
            let dateLabel = '';
            try { if (b.serviceDate) dateLabel = format(parseISO(b.serviceDate), 'd MMM yyyy', { locale: idLocale }); } catch {}

            return (
              <button
                key={b.id}
                onClick={() => navigate({ name: 'booking-detail', bookingId: b.id })}
                className={cn(
                  'w-full text-left bg-white rounded-2xl shadow-soft overflow-hidden transition-all hover:shadow-lifted active:scale-[0.98] anim-slide-up',
                  `delay-${Math.min(i + 1, 4)}`,
                )}
                data-testid={`card-booking-${b.id}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[14px] text-slate-800 truncate">{b.patternName || b.patternCode || 'Perjalanan'}</p>
                      <p className="text-[12px] text-slate-400 mt-0.5">{dateLabel}</p>
                    </div>
                    <Badge variant={st.variant} className="rounded-lg text-[10px] font-bold shrink-0 ml-2">{st.label}</Badge>
                  </div>

                  <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 mb-2">
                    <span className="truncate max-w-[40%]">{b.origin?.name || b.origin?.city || '-'}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                    <span className="truncate max-w-[40%]">{b.destination?.name || b.destination?.city || '-'}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-100">
                    <span className="text-[12px] text-slate-400">{b.passengerCount} penumpang</span>
                    <span className="font-display font-bold text-[15px] text-teal-800">{fmtCurrency(b.totalAmount)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
