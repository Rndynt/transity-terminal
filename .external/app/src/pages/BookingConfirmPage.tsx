import { useState } from 'react';
import { useNav, useAuth } from '@/App';
import { tripsApi, bookingsApi, type CreateBookingData } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, ArrowRight, ShieldCheck, CalendarDays, Bus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Terjemahkan error teknis dari Console/Terminal ke pesan ramah user
function translateBookingError(err: any): string {
  const msg: string = err?.message || '';
  const code: string = err?.code || '';

  if (code === 'TERMINAL_UNAVAILABLE' || msg.includes('timeout') || msg.includes('unavailable')) {
    return 'Koneksi ke operator timeout. Silakan coba lagi.';
  }
  if (code === 'SEAT_UNAVAILABLE' || msg.includes('currently held') || msg.includes('held by another')) {
    return 'Kursi sedang diproses penumpang lain. Silakan kembali dan pilih kursi lain.';
  }
  if (msg.includes('already booked') || msg.includes('no longer available')) {
    return 'Kursi sudah tidak tersedia. Silakan kembali dan pilih kursi lain.';
  }
  if (code === 'TERMINAL_ERROR' || msg.includes('sistem operator')) {
    return 'Sistem operator sedang bermasalah. Silakan coba beberapa menit lagi.';
  }
  if (code === 'DB_ERROR') {
    return 'Terjadi gangguan sistem. Tim kami sedang menangani. Silakan coba lagi.';
  }
  if (msg.includes('Validation') || msg.includes('validation')) {
    return 'Data penumpang tidak lengkap. Periksa kembali nama dan nomor HP.';
  }
  return msg || 'Gagal memesan kursi. Silakan coba lagi.';
}

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

export default function BookingConfirmPage({ tripId, serviceDate, originStopId, destStopId, originSeq, destSeq, seats, tripLabel, fare, originStopName, destStopName, originTime, destTime }: Props) {
  const { goBack, resetTo } = useNav();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [passengers, setPassengers] = useState(
    seats.map((s, i) => ({
      seatNo: s,
      fullName: i === 0 ? (user?.fullName || '') : '',
      phone: i === 0 ? (user?.phone || '') : '',
    })),
  );
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const { data: tripDetail } = useQuery({
    queryKey: ['trip-detail', tripId, serviceDate],
    queryFn: () => tripsApi.getDetail(tripId, serviceDate),
  });

  const createBookingMutation = useMutation({
    mutationFn: (data: CreateBookingData) => bookingsApi.create(data),
    onSuccess: (booking) => {
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['seatmap'] });
      queryClient.invalidateQueries({ queryKey: ['trips-search-infinite'] });
      resetTo({
        name: 'payment',
        tripId, serviceDate, originStopId, destStopId: destStopId, originSeq, destSeq: destSeq,
        seats, tripLabel, fare,
        originStopName, destStopName, originTime, destTime,
        passengers: passengers.map((p) => ({ fullName: p.fullName.trim(), phone: p.phone || undefined, seatNo: p.seatNo })),
        bookingId: booking.bookingId,
        holdExpiresAt: booking.holdExpiresAt ?? null,
      });
    },
    onError: (err: any) => {
      setBookingError(translateBookingError(err));
    },
  });

  const updatePassenger = (idx: number, field: 'fullName' | 'phone', value: string) => {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleProceed = () => {
    if (passengers.some((p) => !p.fullName.trim())) {
      setError('Nama penumpang wajib diisi');
      return;
    }
    setError('');
    setBookingError('');
    setShowConfirm(true);
  };

  const handleConfirmBooking = () => {
    setBookingError('');
    createBookingMutation.mutate({
      tripId, serviceDate, originStopId, destinationStopId: destStopId, originSeq, destinationSeq: destSeq,
      passengers: passengers.map((p) => ({ fullName: p.fullName.trim(), phone: p.phone || undefined, seatNo: p.seatNo })),
    });
  };

  const originStopFromApi = tripDetail?.stops?.find((s) => s.stopId === originStopId);
  const destStopFromApi = tripDetail?.stops?.find((s) => s.stopId === destStopId);
  const displayOriginName = originStopName || originStopFromApi?.name || 'Keberangkatan';
  const displayDestName = destStopName || destStopFromApi?.name || 'Tujuan';
  const displayOriginTime = originTime || originStopFromApi?.departAt;
  const displayDestTime = destTime || destStopFromApi?.arriveAt;

  return (
    <div className="anim-fade">
      <PageHeader title="Konfirmasi Pemesanan" onBack={goBack} />

      <div className="px-4 pt-4 safe-pb-36">
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden anim-slide-up">
          <div className="px-4 pt-4 pb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Perjalanan</p>
            {serviceDate && (
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <p className="text-[13px] font-semibold text-slate-700">
                  {(() => { try { return format(parseISO(serviceDate), 'EEEE, d MMMM yyyy', { locale: idLocale }); } catch { return serviceDate; } })()}
                </p>
              </div>
            )}
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-teal-500" />
                <div className="w-[1.5px] h-8 bg-gradient-to-b from-teal-400 to-emerald-400 my-0.5" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="font-semibold text-[14px] text-slate-800">{displayOriginName}</p>
                  <p className="text-[12px] text-slate-400 tabular-nums">{fmtTime(displayOriginTime)}</p>
                </div>
                <div>
                  <p className="font-semibold text-[14px] text-slate-800">{displayDestName}</p>
                  <p className="text-[12px] text-slate-400 tabular-nums">{fmtTime(displayDestTime)}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-100">
              {seats.map((s) => (
                <span key={s} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-[11px] font-bold">{s}</span>
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
                <p className="text-[11px] font-bold text-teal-700 mb-2.5">Penumpang {idx + 1} — Kursi {p.seatNo}</p>
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
              <p className="font-display font-extrabold text-[20px] text-teal-800">{fmtCurrency(fare * seats.length)}</p>
            </div>
            <Button
              className="h-12 px-6 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[14px] font-bold shadow-lg shadow-emerald-600/15 transition-all active:scale-[0.97] gap-2"
              onClick={handleProceed}
              data-testid="button-confirm"
            >
              <ArrowRight className="w-4 h-4" />
              Pilih Pembayaran
            </Button>
          </div>
        </div>
      </div>

      <ConfirmSheet
        open={showConfirm}
        onOpenChange={(v) => { if (!createBookingMutation.isPending) setShowConfirm(v); }}
        title="Lanjutkan Pemesanan?"
        description={`Kursi ${seats.join(', ')} akan dipesan atas namamu. Kamu punya waktu terbatas untuk menyelesaikan pembayaran.`}
        icon={
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-teal-600" />
          </div>
        }
        confirmLabel="Lanjut Pesan"
        cancelLabel="Tidak, Kembali"
        onConfirm={handleConfirmBooking}
        onCancel={() => setShowConfirm(false)}
        loading={createBookingMutation.isPending}
        error={bookingError}
      />
    </div>
  );
}
