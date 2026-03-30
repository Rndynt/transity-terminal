import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNav, useAuth } from '@/App';
import { tripsApi } from '@/lib/api';
import { fmtCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tripId: string;
  originStopId: string;
  destStopId: string;
  originSeq: number;
  destSeq: number;
  passengers: number;
  tripLabel: string;
  fare: number;
}

export default function SelectSeatsPage({ tripId, originStopId, destStopId, originSeq, destSeq, passengers, tripLabel, fare }: Props) {
  const { navigate, goBack } = useNav();
  const { isLoggedIn } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seatmap', tripId, originSeq, destSeq],
    queryFn: () => tripsApi.getSeatmap(tripId, originSeq, destSeq),
  });

  const toggleSeat = (label: string) => {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((s) => s !== label);
      if (prev.length >= passengers) return prev;
      return [...prev, label];
    });
  };

  const proceed = () => {
    const target = {
      name: 'booking-confirm' as const,
      tripId, originStopId, destStopId, originSeq, destSeq, seats: selected, tripLabel, fare,
    };
    if (!isLoggedIn) {
      navigate({ name: 'auth', returnTo: target });
      return;
    }
    navigate(target);
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

  return (
    <div className="anim-fade min-h-screen bg-slate-50">
      <div className="bg-teal-900 px-4 pt-3 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-[15px]">Pilih Kursi</p>
            <p className="text-teal-300 text-[12px] mt-0.5 truncate">{tripLabel}</p>
          </div>
          <div className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-full">
            <span className="text-white text-[13px] font-bold">{selected.length}/{passengers}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-32">
        {isLoading && (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-[13px] text-slate-400 font-medium">Memuat denah kursi...</p>
          </div>
        )}

        {error && <p className="text-center py-16 text-[14px] text-slate-400">Gagal memuat denah kursi</p>}

        {!isLoading && !error && !hasSeatData && (
          <p className="text-center py-16 text-[14px] text-slate-400">Denah kursi tidak tersedia</p>
        )}

        {hasSeatData && (
          <div className="bg-white rounded-2xl shadow-soft p-5 anim-slide-up">
            <div className="flex items-center justify-center gap-5 mb-5 text-[11px] font-semibold text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-lg bg-white border border-slate-200" /> Tersedia</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-lg bg-teal-600" /> Dipilih</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-lg bg-slate-200/70" /> Terisi</span>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-2.5 rounded-full bg-slate-200" />
              </div>

              <div className="flex flex-col items-center gap-2">
                {seatGrid.map((row, ri) => (
                  <div key={ri} className="flex gap-2 justify-center">
                    {row.map((seat, ci) => {
                      if (!seat) return <div key={ci} className="w-11 h-11" />;
                      if (seat.type !== 'seat') {
                        return <div key={ci} className="w-11 h-11 flex items-center justify-center text-[10px] text-slate-300">{seat.type === 'driver' ? '🚌' : ''}</div>;
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
                            'w-11 h-11 rounded-xl text-[12px] font-bold transition-all duration-200',
                            isAvailable && !isSel && 'bg-white border border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700 active:scale-90',
                            isSel && 'bg-teal-600 text-white shadow-md shadow-teal-600/30 scale-105',
                            !isAvailable && 'bg-slate-200/60 text-slate-300 cursor-not-allowed',
                          )}
                          data-testid={`seat-${seat.label}`}
                        >
                          {seat.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {selected.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {selected.map((s) => (
                  <span key={s} className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg text-[12px] font-bold">
                    Kursi {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Total ({selected.length} kursi)</p>
              <p className="font-display font-extrabold text-[20px] text-teal-900">{fmtCurrency(fare * selected.length)}</p>
            </div>
            <Button
              className="h-12 px-8 rounded-2xl bg-teal-900 hover:bg-teal-950 text-[14px] font-bold shadow-lg shadow-teal-900/15 transition-all active:scale-[0.97]"
              disabled={selected.length !== passengers}
              onClick={proceed}
              data-testid="button-continue"
            >
              Lanjutkan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
