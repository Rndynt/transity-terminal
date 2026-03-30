import { useState } from 'react';
import { useNav } from '@/App';
import type { TripStopInfo } from '@/lib/api';
import { fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CircleDot, Flag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tripId: string;
  passengers: number;
  tripLabel: string;
  fare: number;
  stops: TripStopInfo[];
  originCity: string;
  destCity: string;
  originSeq: number;
  destSeq: number;
}

export default function SelectStopsPage({ tripId, passengers, tripLabel, fare, stops, originCity, destCity, originSeq, destSeq }: Props) {
  const { navigate, goBack } = useNav();
  const [pickupStopId, setPickupStopId] = useState<string | null>(null);
  const [dropStopId, setDropStopId] = useState<string | null>(null);
  const [mode, setMode] = useState<'pickup' | 'drop'>('pickup');

  const pickupStops = stops.filter(s => s.city ? s.city === originCity : s.sequence < destSeq);
  const dropStops = stops.filter(s => s.city ? s.city === destCity : s.sequence >= destSeq);

  const pickupStop = pickupStopId ? stops.find(s => s.stopId === pickupStopId) : null;
  const dropStop = dropStopId ? stops.find(s => s.stopId === dropStopId) : null;
  const canProceed = !!pickupStop && !!dropStop;

  const handlePickup = (stop: TripStopInfo) => {
    setPickupStopId(stop.stopId);
    setMode('drop');
  };

  const handleDrop = (stop: TripStopInfo) => {
    setDropStopId(stop.stopId);
  };

  const proceed = () => {
    if (!pickupStop || !dropStop) return;
    navigate({
      name: 'select-seats',
      tripId,
      originStopId: pickupStop.stopId,
      destStopId: dropStop.stopId,
      originSeq: pickupStop.sequence,
      destSeq: dropStop.sequence,
      passengers,
      tripLabel,
      fare,
    });
  };

  const activeStops = mode === 'pickup' ? pickupStops : dropStops;

  return (
    <div className="anim-fade min-h-screen bg-slate-50">
      <div className="bg-teal-900 px-4 pt-3 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-[15px]">Pilih Titik Naik & Turun</p>
            <p className="text-teal-300 text-[12px] mt-0.5 truncate">{tripLabel}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-32">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('pickup')}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all',
              mode === 'pickup'
                ? 'bg-teal-900 text-white shadow-md'
                : 'bg-white text-slate-500 border border-slate-200',
            )}
            data-testid="tab-pickup"
          >
            <CircleDot className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Titik Naik
            {pickupStop && <span className="ml-1 opacity-70">✓</span>}
          </button>
          <button
            onClick={() => setMode('drop')}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all',
              mode === 'drop'
                ? 'bg-coral-500 text-white shadow-md'
                : 'bg-white text-slate-500 border border-slate-200',
            )}
            data-testid="tab-drop"
          >
            <Flag className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Titik Turun
            {dropStop && <span className="ml-1 opacity-70">✓</span>}
          </button>
        </div>

        {pickupStop && dropStop && (
          <div className="bg-teal-50 border border-teal-200/60 rounded-2xl p-3.5 mb-4 anim-fade">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] text-teal-600 font-bold uppercase tracking-wider mb-0.5">
                  <CircleDot className="w-3 h-3" /> Naik
                </div>
                <p className="font-bold text-[14px] text-teal-900">{pickupStop.name}</p>
                <p className="text-[12px] text-teal-700 font-medium">{fmtTime(pickupStop.departAt)}</p>
              </div>
              <div className="text-teal-300 text-lg font-bold">→</div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-end gap-1.5 text-[10px] text-coral-600 font-bold uppercase tracking-wider mb-0.5">
                  <Flag className="w-3 h-3" /> Turun
                </div>
                <p className="font-bold text-[14px] text-teal-900">{dropStop.name}</p>
                <p className="text-[12px] text-teal-700 font-medium">{fmtTime(dropStop.arriveAt)}</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          {mode === 'pickup'
            ? `Pilih titik naik (${pickupStops.length} halte)`
            : `Pilih titik turun (${dropStops.length} halte)`
          }
        </p>

        <div className="grid gap-2.5">
          {activeStops.map((stop) => {
            const isPickup = pickupStopId === stop.stopId;
            const isDrop = dropStopId === stop.stopId;
            const isSelected = (mode === 'pickup' && isPickup) || (mode === 'drop' && isDrop);
            const time = mode === 'pickup' ? stop.departAt : stop.arriveAt;

            return (
              <button
                key={stop.stopId}
                onClick={() => {
                  if (mode === 'pickup') handlePickup(stop);
                  else handleDrop(stop);
                }}
                className={cn(
                  'w-full rounded-2xl p-4 text-left transition-all duration-200 border-2',
                  isSelected && mode === 'pickup' && 'bg-teal-50 border-teal-500 shadow-md shadow-teal-500/10',
                  isSelected && mode === 'drop' && 'bg-coral-50 border-coral-400 shadow-md shadow-coral-400/10',
                  !isSelected && 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm active:scale-[0.98]',
                )}
                data-testid={`stop-${stop.code}`}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                    isSelected && mode === 'pickup' && 'bg-teal-600',
                    isSelected && mode === 'drop' && 'bg-coral-500',
                    !isSelected && 'bg-slate-100',
                  )}>
                    {isSelected ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <span className="text-[14px] font-bold text-slate-400">{stop.code}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-[15px] truncate',
                      isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-700',
                    )}>
                      {stop.name}
                    </p>
                    {isSelected && mode === 'pickup' && <span className="text-[11px] font-bold text-teal-600">Titik naik dipilih</span>}
                    {isSelected && mode === 'drop' && <span className="text-[11px] font-bold text-coral-600">Titik turun dipilih</span>}
                    {!isSelected && (
                      <span className="text-[11px] text-slate-400">Halte {stop.sequence}</span>
                    )}
                  </div>

                  <div className={cn(
                    'shrink-0 px-3 py-1.5 rounded-lg',
                    isSelected && mode === 'pickup' && 'bg-teal-600',
                    isSelected && mode === 'drop' && 'bg-coral-500',
                    !isSelected && 'bg-slate-50',
                  )}>
                    <span className={cn(
                      'text-[16px] font-bold tabular-nums',
                      isSelected ? 'text-white' : 'text-slate-700',
                    )}>
                      {fmtTime(time)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
        <div className="px-4 py-3">
          <Button
            className="w-full h-12 rounded-2xl bg-teal-900 hover:bg-teal-950 text-[14px] font-bold shadow-lg shadow-teal-900/15 transition-all active:scale-[0.97]"
            disabled={!canProceed}
            onClick={proceed}
            data-testid="button-continue-stops"
          >
            {!canProceed
              ? (pickupStopId === null ? 'Pilih titik naik dulu' : 'Pilih titik turun')
              : 'Lanjut Pilih Kursi'
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
