import { useState } from 'react';
import { useNav, useAuth } from '@/App';
import { bookingsApi, tripsApi, type CreateBookingData } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, MapPin, User, CreditCard } from 'lucide-react';

interface Props {
  tripId: string;
  originStopId: string;
  destStopId: string;
  originSeq: number;
  destSeq: number;
  seats: string[];
  tripLabel: string;
  fare: number;
}

export default function BookingConfirmPage({ tripId, originStopId, destStopId, originSeq, destSeq, seats, tripLabel, fare }: Props) {
  const { navigate, goBack } = useNav();
  const { user } = useAuth();
  const [passengers, setPassengers] = useState(
    seats.map((s, i) => ({
      seatNo: s,
      fullName: i === 0 ? (user?.name || '') : '',
      phone: i === 0 ? (user?.phone || '') : '',
    })),
  );
  const [error, setError] = useState('');

  const { data: tripDetail } = useQuery({
    queryKey: ['trip-detail', tripId],
    queryFn: () => tripsApi.getDetail(tripId),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateBookingData) => bookingsApi.create(data),
    onSuccess: (booking) => navigate({ name: 'booking-detail', bookingId: booking.id }),
    onError: (err: Error) => setError(err.message),
  });

  const updatePassenger = (idx: number, field: 'fullName' | 'phone', value: string) => {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const confirm = () => {
    if (passengers.some((p) => !p.fullName.trim())) {
      setError('Nama penumpang wajib diisi');
      return;
    }
    setError('');
    mutation.mutate({
      tripId, originStopId, destinationStopId: destStopId, originSeq, destinationSeq: destSeq,
      passengers: passengers.map((p) => ({ fullName: p.fullName.trim(), phone: p.phone || undefined, seatNo: p.seatNo })),
      paymentMethod: 'cash',
    });
  };

  const originStop = tripDetail?.stops?.find((s) => s.stopId === originStopId);
  const destStop = tripDetail?.stops?.find((s) => s.stopId === destStopId);

  return (
    <div className="anim-fade">
      <div className="bg-teal-900 px-4 pt-3 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <p className="text-white font-semibold text-[15px]">Konfirmasi Pemesanan</p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-36">
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up">
          <div className="px-4 pt-4 pb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Perjalanan</p>
            <p className="font-bold text-[15px] text-slate-800">{tripLabel}</p>
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-teal-500" />
                <div className="w-[1.5px] h-8 bg-gradient-to-b from-teal-400 to-coral-400 my-0.5" />
                <div className="w-2.5 h-2.5 rounded-full bg-coral-500" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="font-semibold text-[14px]">{originStop?.name || 'Keberangkatan'}</p>
                  <p className="text-[12px] text-slate-400">{fmtTime(originStop?.departAt)}</p>
                </div>
                <div>
                  <p className="font-semibold text-[14px]">{destStop?.name || 'Tujuan'}</p>
                  <p className="text-[12px] text-slate-400">{fmtTime(destStop?.arriveAt)}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 mt-3">
              {seats.map((s) => (
                <span key={s} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-[11px] font-bold">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft mt-3 overflow-hidden anim-slide-up delay-1">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-teal-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Penumpang</p>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-4">
            {passengers.map((p, idx) => (
              <div key={p.seatNo}>
                {idx > 0 && <Separator className="mb-4 bg-slate-100" />}
                <p className="text-[11px] font-bold text-teal-700 mb-2.5">
                  Penumpang {idx + 1} — Kursi {p.seatNo}
                </p>
                <div className="space-y-2.5">
                  <div>
                    <Label className="text-[11px] text-slate-400 font-semibold">Nama Lengkap *</Label>
                    <input
                      value={p.fullName}
                      onChange={(e) => updatePassenger(idx, 'fullName', e.target.value)}
                      placeholder="Nama sesuai identitas"
                      className="w-full h-11 px-3 mt-1 rounded-xl border border-slate-200 bg-slate-50/50 text-[14px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all"
                      data-testid={`input-name-${idx}`}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-400 font-semibold">No. HP</Label>
                    <input
                      value={p.phone}
                      onChange={(e) => updatePassenger(idx, 'phone', e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      type="tel"
                      className="w-full h-11 px-3 mt-1 rounded-xl border border-slate-200 bg-slate-50/50 text-[14px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all"
                      data-testid={`input-phone-${idx}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200/60 rounded-2xl text-[13px] text-red-600 font-medium anim-scale" data-testid="text-error">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Total Bayar</p>
              <p className="font-display font-extrabold text-[20px] text-teal-900">{fmtCurrency(fare * seats.length)}</p>
            </div>
            <Button
              className="h-12 px-6 rounded-2xl bg-teal-900 hover:bg-teal-950 text-[14px] font-bold shadow-lg shadow-teal-900/15 transition-all active:scale-[0.97] gap-2"
              onClick={confirm}
              disabled={mutation.isPending}
              data-testid="button-confirm"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Pesan Sekarang
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
