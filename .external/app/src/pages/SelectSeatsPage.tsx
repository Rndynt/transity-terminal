import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNav, useAuth } from '@/App';
import { tripsApi, bookingsApi, type CreateBookingData } from '@/lib/api';
import { fmtCurrency, fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, ArrowRight, X, Users, ShieldCheck, User } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import { cn } from '@/lib/utils';
import { SeatGridSkeleton } from '@/components/ui/skeleton';

function translateBookingError(err: any): string {
  const msg: string = err?.message || '';
  const code: string = err?.code || '';
  if (code === 'TERMINAL_UNAVAILABLE' || msg.includes('timeout') || msg.includes('unavailable'))
    return 'Koneksi ke operator timeout. Silakan coba lagi.';
  if (code === 'SEAT_UNAVAILABLE' || msg.includes('currently held') || msg.includes('held by another'))
    return 'Kursi sedang diproses penumpang lain. Silakan kembali dan pilih kursi lain.';
  if (msg.includes('already booked') || msg.includes('no longer available'))
    return 'Kursi sudah tidak tersedia. Silakan kembali dan pilih kursi lain.';
  if (code === 'TERMINAL_ERROR' || msg.includes('sistem operator'))
    return 'Sistem operator sedang bermasalah. Silakan coba beberapa menit lagi.';
  if (code === 'DB_ERROR')
    return 'Terjadi gangguan sistem. Tim kami sedang menangani. Silakan coba lagi.';
  if (msg.includes('Validation') || msg.includes('validation'))
    return 'Data penumpang tidak lengkap. Periksa kembali nama dan nomor HP.';
  return msg || 'Gagal memesan kursi. Silakan coba lagi.';
}

interface Props {
  tripId: string;
  serviceDate: string;
  originStopId: string;
  destStopId: string;
  originSeq: number;
  destSeq: number;
  passengers: number;
  tripLabel: string;
  fare: number;
  originStopName?: string;
  destStopName?: string;
  originTime?: string;
  destTime?: string;
}

export default function SelectSeatsPage({ tripId, serviceDate, originStopId, destStopId, originSeq, destSeq, passengers, tripLabel, fare, originStopName, destStopName, originTime, destTime }: Props) {
  const { navigate, goBack, resetTo } = useNav();
  const { isLoggedIn, user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [passengerData, setPassengerData] = useState<Array<{ seatNo: string; fullName: string; phone: string }>>([]);
  const [formError, setFormError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seatmap', tripId, originSeq, destSeq],
    queryFn: () => tripsApi.getSeatmap(tripId, originSeq, destSeq),
    retry: false,
  });

  const syncPassengerData = (seats: string[]) => {
    setPassengerData((prev) => {
      return seats.map((seatNo, i) => {
        const existing = prev.find((p) => p.seatNo === seatNo);
        if (existing) return existing;
        return {
          seatNo,
          fullName: i === 0 && prev.length === 0 ? (user?.fullName || '') : '',
          phone: i === 0 && prev.length === 0 ? (user?.phone || '') : '',
        };
      });
    });
  };

  const toggleSeat = (label: string) => {
    setSelected((prev) => {
      let next: string[];
      if (prev.includes(label)) {
        next = prev.filter((s) => s !== label);
      } else {
        if (prev.length >= passengers) return prev;
        next = [...prev, label];
      }
      syncPassengerData(next);
      return next;
    });
  };

  const updatePassenger = (idx: number, field: 'fullName' | 'phone', value: string) => {
    setPassengerData((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const createBookingMutation = useMutation({
    mutationFn: (data: CreateBookingData) => bookingsApi.create(data),
    onSuccess: (booking) => {
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['seatmap'] });
      queryClient.invalidateQueries({ queryKey: ['trips-search-infinite'] });
      resetTo({
        name: 'payment',
        tripId, serviceDate, originStopId, destStopId, originSeq, destSeq,
        seats: selected, tripLabel, fare,
        originStopName, destStopName, originTime, destTime,
        passengers: passengerData.map((p) => ({ fullName: p.fullName.trim(), phone: p.phone || undefined, seatNo: p.seatNo })),
        bookingId: booking.bookingId,
        holdExpiresAt: booking.holdExpiresAt ?? null,
      });
    },
    onError: (err: any) => {
      setBookingError(translateBookingError(err));
    },
  });

  const handleProceed = () => {
    if (selected.length !== passengers) return;
    if (passengerData.some((p) => !p.fullName.trim())) {
      setFormError('Nama penumpang wajib diisi');
      return;
    }
    if (!isLoggedIn) {
      navigate({
        name: 'auth',
        returnTo: {
          name: 'booking-confirm',
          tripId, serviceDate, originStopId, destStopId, originSeq, destSeq,
          seats: selected, tripLabel, fare,
          originStopName, destStopName, originTime, destTime,
        },
      });
      return;
    }
    setFormError('');
    setBookingError('');
    setShowConfirm(true);
  };

  const handleConfirmBooking = () => {
    setBookingError('');
    createBookingMutation.mutate({
      tripId, serviceDate, originStopId, destinationStopId: destStopId, originSeq, destinationSeq: destSeq,
      passengers: passengerData.map((p) => ({ fullName: p.fullName.trim(), phone: p.phone || undefined, seatNo: p.seatNo })),
    });
  };

  const rawLayout = data?.layout;
  const availability = data?.seatAvailability || {};

  const seatMap = rawLayout?.seatMap?.map((s: any) => ({
    row: s.row,
    col: s.col,
    label: s.label || s.seat_no || '',
    type: s.type || 'seat',
  })) || [];

  const maxRow = seatMap.length > 0 ? Math.max(...seatMap.map((s) => s.row)) : 0;
  const maxCol = seatMap.length > 0 ? Math.max(...seatMap.map((s) => s.col)) : 0;

  type SeatItem = { row: number; col: number; label: string; type: string };
  const seatGrid: (SeatItem | null)[][] = [];
  if (seatMap.length > 0) {
    for (let r = 1; r <= maxRow; r++) {
      const rowArr: (SeatItem | null)[] = [];
      for (let c = 1; c <= maxCol; c++) {
        rowArr.push(seatMap.find((s) => s.row === r && s.col === c) || null);
      }
      seatGrid.push(rowArr);
    }
  }

  const hasSeatData = seatGrid.length > 0;
  const isVirtualTrip = !!error;

  const availableCount = seatMap.filter((s: SeatItem) => {
    if (s.type !== 'seat') return false;
    const avail = availability[s.label];
    return avail ? (avail.available && !avail.held) : true;
  }).length;

  const allFilled = selected.length === passengers && passengerData.every((p) => p.fullName.trim());

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa]">
      <PageHeader
        title="Pilih Kursi"
        subtitle={originStopName && destStopName ? `${originStopName} → ${destStopName}` : undefined}
        onBack={goBack}
        rightContent={!isVirtualTrip ? (
          <div className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-full">
            <span className="text-white text-[13px] font-bold">{selected.length}/{passengers}</span>
          </div>
        ) : undefined}
      >
        {(originStopName || destStopName) && (
          <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-300" />
                <span className="text-[11px] text-white/80 truncate">{originStopName || '-'}</span>
                {originTime && <span className="text-[10px] text-teal-300 font-bold ml-1">{fmtTime(originTime)}</span>}
              </div>
            </div>
            <ArrowRight className="w-3 h-3 text-white/50 shrink-0" />
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center justify-end gap-1">
                {destTime && <span className="text-[10px] text-coral-300 font-bold mr-1">{fmtTime(destTime)}</span>}
                <span className="text-[11px] text-white/80 truncate">{destStopName || '-'}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-coral-300" />
              </div>
            </div>
          </div>
        )}
      </PageHeader>

      <div className="px-4 pt-4 safe-pb-36">
        {isLoading && (
          <div className="anim-fade">
            <SeatGridSkeleton />
          </div>
        )}

        {!isLoading && isVirtualTrip && (
          <div className="bg-white rounded-2xl shadow-soft p-6 anim-slide-up text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-amber-500" />
            </div>
            <p className="font-bold text-[16px] text-slate-800 mb-1">Perjalanan Virtual</p>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-5">
              Nomor kursi akan ditentukan oleh operator saat keberangkatan. Lanjutkan pemesanan tanpa memilih kursi.
            </p>
            <Button
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[14px] font-bold"
              onClick={() => {
                syncPassengerData([]);
                setShowConfirm(true);
              }}
              data-testid="button-continue-virtual"
            >
              Lanjutkan Tanpa Pilih Kursi
            </Button>
          </div>
        )}

        {!isLoading && !error && !hasSeatData && (
          <p className="text-center py-16 text-[14px] text-slate-400">Denah kursi tidak tersedia</p>
        )}

        {hasSeatData && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-white border-2 border-slate-200" />
                  <span className="text-[10px] font-semibold text-slate-500">Tersedia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-teal-600" />
                  <span className="text-[10px] font-semibold text-slate-500">Dipilih</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-slate-200" />
                  <span className="text-[10px] font-semibold text-slate-500">Terisi</span>
                </div>
              </div>
              <div className="bg-teal-50 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-teal-700">{availableCount} tersedia</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft anim-slide-up overflow-hidden">
              <div className="bg-gradient-to-b from-slate-50 to-white px-5 pt-5 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-[3px] rounded-full bg-slate-200" />
                  <div className="w-10 h-5 rounded-md bg-slate-200 flex items-center justify-center">
                    <div className="w-6 h-2 rounded-sm bg-slate-300" />
                  </div>
                  <div className="flex-1 h-[3px] rounded-full bg-slate-200" />
                </div>
                <div className="flex justify-center">
                  <svg viewBox="0 0 120 20" className="w-24 h-5 text-slate-300" fill="none">
                    <rect x="10" y="5" width="100" height="10" rx="5" fill="currentColor" opacity="0.3" />
                    <circle cx="60" cy="10" r="3" fill="currentColor" opacity="0.5" />
                  </svg>
                </div>
              </div>

              <div className="px-3 pb-5">
                <div className="flex flex-col items-center gap-1.5">
                  {seatGrid.map((row, ri) => (
                    <div key={ri} className="flex gap-1.5 justify-center items-center">
                      {row.map((seat, ci) => {
                        if (!seat) return <div key={ci} className="w-[44px] h-[44px]" />;
                        if (seat.type !== 'seat') {
                          return (
                            <div key={ci} className="w-[44px] h-[44px] flex items-center justify-center">
                              {seat.type === 'driver' && (
                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="9" />
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        }
                        const avail = availability[seat.label];
                        const isAvailable = avail ? (avail.available && !avail.held) : true;
                        const isSel = selected.includes(seat.label);
                        return (
                          <button
                            key={ci}
                            onClick={() => isAvailable && toggleSeat(seat.label)}
                            disabled={!isAvailable}
                            className={cn(
                              'w-[44px] h-[44px] rounded-xl text-[12px] font-bold transition-all duration-200 relative',
                              isAvailable && !isSel && 'bg-white border-2 border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700 active:scale-90',
                              isSel && 'bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-600/30 scale-[1.05] border-2 border-teal-400',
                              !isAvailable && 'bg-slate-100 text-slate-300 cursor-not-allowed border-2 border-transparent',
                            )}
                            data-testid={`seat-${seat.label}`}
                          >
                            {seat.label}
                            {isSel && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 flex items-center justify-center">
                                  <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 5l2 2 4-4" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selected.length > 0 && (
              <div className="mt-4 bg-white rounded-2xl shadow-soft overflow-hidden anim-fade">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Data Penumpang</span>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  {passengerData.map((p, idx) => (
                    <div key={p.seatNo} className={cn(
                      'rounded-xl p-3',
                      idx % 2 === 0 ? 'bg-slate-50/80' : 'bg-white',
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-teal-700">Kursi {p.seatNo}</span>
                        <button
                          onClick={() => toggleSeat(p.seatNo)}
                          className="text-[10px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-0.5"
                        >
                          <X className="w-3 h-3" />
                          Hapus
                        </button>
                      </div>
                      <input
                        value={p.fullName}
                        onChange={(e) => updatePassenger(idx, 'fullName', e.target.value)}
                        placeholder="Nama lengkap penumpang *"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-500/40 transition-all"
                        data-testid={`input-name-${idx}`}
                      />
                      <input
                        value={p.phone}
                        onChange={(e) => updatePassenger(idx, 'phone', e.target.value)}
                        placeholder="No. HP (opsional)"
                        type="tel"
                        className="w-full h-10 px-3 mt-2 rounded-xl border border-slate-200 bg-white text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-500/40 transition-all"
                        data-testid={`input-phone-${idx}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formError && (
              <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200/60 rounded-2xl text-[13px] text-red-600 font-medium anim-scale">
                {formError}
              </div>
            )}

            <div className="mt-4 bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Harga per kursi</span>
                  <span className="text-[15px] font-bold text-slate-700">{fmtCurrency(fare)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-medium block">Subtotal ({selected.length} kursi)</span>
                  <span className="text-[18px] font-extrabold font-display text-teal-700">{fmtCurrency(fare * selected.length)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!isVirtualTrip && !isLoading && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-100 safe-bottom z-40">
          <div className="px-4 py-3">
            <Button
              className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[15px] font-bold shadow-lg shadow-emerald-600/15 transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
              disabled={!allFilled}
              onClick={handleProceed}
              data-testid="button-continue"
            >
              {selected.length !== passengers
                ? `Pilih ${passengers - selected.length} kursi lagi`
                : !passengerData.every((p) => p.fullName.trim())
                  ? 'Lengkapi nama penumpang'
                  : (
                    <>
                      Lanjut Bayar — {fmtCurrency(fare * selected.length)}
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </>
                  )
              }
            </Button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={showConfirm}
        onOpenChange={(v) => { if (!createBookingMutation.isPending) setShowConfirm(v); }}
        title="Lanjutkan Pemesanan?"
        description={selected.length > 0
          ? `Kursi ${selected.join(', ')} akan dipesan atas namamu. Kamu punya waktu terbatas untuk menyelesaikan pembayaran.`
          : 'Pesanan akan dibuat. Kamu punya waktu terbatas untuk menyelesaikan pembayaran.'
        }
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
