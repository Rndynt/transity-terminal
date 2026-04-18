import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNav } from '@/App';
import { tripsApi, type TripStopInfo } from '@/lib/api';
import { fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CircleDot, MapPin, Check, Loader2, ChevronRight, Clock, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { StopCardSkeleton } from '@/components/ui/skeleton';

interface Props {
  tripId: string;
  serviceDate: string;
  passengers: number;
  tripLabel: string;
  fare: number;
  stops?: TripStopInfo[];
  originCity: string;
  destCity: string;
  originSeq: number;
  destSeq: number;
}

export default function SelectStopsPage({ tripId, serviceDate, passengers, tripLabel, fare, stops: passedStops, originCity, destCity, originSeq, destSeq }: Props) {
  const { navigate, goBack } = useNav();
  const [pickupStopId, setPickupStopId] = useState<string | null>(null);
  const [dropStopId, setDropStopId] = useState<string | null>(null);
  const [mode, setMode] = useState<'pickup' | 'drop'>('pickup');

  const needsFetch = !passedStops || passedStops.length === 0;

  const { data: tripDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['trip-detail', tripId],
    queryFn: () => tripsApi.getDetail(tripId),
    enabled: needsFetch,
  });

  const stops: TripStopInfo[] = needsFetch
    ? (tripDetail?.stops?.map((s) => ({
        stopId: s.stopId,
        name: s.name,
        code: s.code,
        city: s.city || undefined,
        sequence: s.sequence,
        arriveAt: s.arriveAt,
        departAt: s.departAt,
      })) || [])
    : passedStops!;

  const hasBoardingFlags = stops.some(s => s.boardingAllowed !== undefined);
  const pickupStops = stops.filter(s =>
    hasBoardingFlags ? s.boardingAllowed : (s.city ? s.city === originCity : s.sequence <= originSeq)
  );
  const dropStops = stops.filter(s =>
    hasBoardingFlags ? s.alightingAllowed : (s.city ? s.city === destCity : s.sequence >= destSeq)
  );

  const pickupStop = pickupStopId ? stops.find(s => s.stopId === pickupStopId) : null;
  const dropStop = dropStopId ? stops.find(s => s.stopId === dropStopId) : null;
  const canProceed = !!pickupStop && !!dropStop;

  const handlePickup = (stop: TripStopInfo) => {
    setPickupStopId(stop.stopId);
  };

  const handleDrop = (stop: TripStopInfo) => {
    setDropStopId(stop.stopId);
  };

  const isVirtual = tripId.includes('virtual-');

  const materializeMut = useMutation({
    mutationFn: () => tripsApi.materialize(tripId, serviceDate),
    onSuccess: (result) => {
      if (!pickupStop || !dropStop) return;
      const realTripId = result.tripId.includes(':')
        ? result.tripId
        : `${tripId.split(':')[0] || ''}:${result.tripId}`.replace(/^:/, '');
      navigate({
        name: 'select-seats',
        tripId: realTripId,
        serviceDate,
        originStopId: pickupStop.stopId,
        destStopId: dropStop.stopId,
        originSeq: pickupStop.sequence,
        destSeq: dropStop.sequence,
        passengers,
        tripLabel,
        fare,
        originStopName: pickupStop.name,
        destStopName: dropStop.name,
        originTime: pickupStop.departAt || undefined,
        destTime: dropStop.arriveAt || undefined,
      });
    },
  });

  const proceed = () => {
    if (!pickupStop || !dropStop) return;
    if (isVirtual) {
      materializeMut.mutate();
    } else {
      navigate({
        name: 'select-seats',
        tripId,
        serviceDate,
        originStopId: pickupStop.stopId,
        destStopId: dropStop.stopId,
        originSeq: pickupStop.sequence,
        destSeq: dropStop.sequence,
        passengers,
        tripLabel,
        fare,
        originStopName: pickupStop.name,
        destStopName: dropStop.name,
        originTime: pickupStop.departAt || undefined,
        destTime: dropStop.arriveAt || undefined,
      });
    }
  };

  const activeStops = mode === 'pickup' ? pickupStops : dropStops;

  if (detailLoading) {
    return (
      <div className="anim-fade min-h-screen bg-[#f8fafa]">
        <PageHeader title="Pilih Titik Naik & Turun" onBack={goBack} />
        <div className="px-4 pt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <StopCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa]">
      <PageHeader title="Pilih Titik Naik & Turun" subtitle={`${originCity} → ${destCity}`} onBack={goBack}>
        <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-2xl p-1.5 flex gap-1">
          <button
            onClick={() => setMode('pickup')}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5',
              mode === 'pickup'
                ? 'bg-white text-teal-700 shadow-lg'
                : 'text-white/70 hover:text-white',
            )}
            data-testid="tab-pickup"
          >
            <CircleDot className="w-3.5 h-3.5" />
            Titik Naik
            {pickupStop && <Check className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <button
            onClick={() => setMode('drop')}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5',
              mode === 'drop'
                ? 'bg-white text-coral-600 shadow-lg'
                : 'text-white/70 hover:text-white',
            )}
            data-testid="tab-drop"
          >
            <MapPin className="w-3.5 h-3.5" />
            Titik Turun
            {dropStop && <Check className="w-3.5 h-3.5 ml-0.5" />}
          </button>
        </div>
      </PageHeader>

      <div className="px-4 pt-4 safe-pb-36">
        {(pickupStop || dropStop) && (
          <div className="bg-white rounded-2xl shadow-soft p-4 mb-4 anim-fade">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-teal-500" />
                  <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Naik</span>
                </div>
                {pickupStop ? (
                  <>
                    <p className="font-bold text-[13px] text-slate-800 leading-tight">{pickupStop.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-[11px] text-slate-500 font-medium">{fmtTime(pickupStop.departAt)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-slate-300 italic mt-0.5">Belum dipilih</p>
                )}
              </div>

              <div className="shrink-0 px-1">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-teal-100 to-coral-100 flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>

              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-coral-500" />
                  <span className="text-[10px] text-coral-600 font-bold uppercase tracking-wider">Turun</span>
                </div>
                {dropStop ? (
                  <>
                    <p className="font-bold text-[13px] text-slate-800 leading-tight">{dropStop.name}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-[11px] text-slate-500 font-medium">{fmtTime(dropStop.arriveAt)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-slate-300 italic mt-0.5">Belum dipilih</p>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          {mode === 'pickup'
            ? `Pilih titik naik (${pickupStops.length} halte)`
            : `Pilih titik turun (${dropStops.length} halte)`
          }
        </p>

        {activeStops.length === 0 && (
          <div className="bg-white rounded-2xl shadow-soft text-center py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-[13px] text-slate-400 font-medium">Tidak ada halte tersedia untuk kota ini</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          {activeStops.map((stop, idx) => {
            const isPickup = pickupStopId === stop.stopId;
            const isDrop = dropStopId === stop.stopId;
            const isSelected = (mode === 'pickup' && isPickup) || (mode === 'drop' && isDrop);
            const time = mode === 'pickup' ? stop.departAt : stop.arriveAt;
            const isLast = idx === activeStops.length - 1;
            const lineColor = mode === 'pickup' ? 'bg-teal-200' : 'bg-coral-200';
            const lineColorSelected = mode === 'pickup' ? 'bg-teal-400' : 'bg-coral-400';

            return (
              <button
                key={stop.stopId}
                onClick={() => {
                  if (mode === 'pickup') handlePickup(stop);
                  else handleDrop(stop);
                }}
                className={cn(
                  'w-full text-left transition-all duration-200 relative',
                  'flex items-start gap-3 pl-5 pr-4 py-4',
                  isSelected
                    ? mode === 'pickup' ? 'bg-teal-50/60' : 'bg-coral-50/60'
                    : 'bg-white active:bg-slate-50',
                  !isLast && 'border-b border-slate-100/60',
                )}
                data-testid={`stop-${stop.code}`}
              >
                <div className="flex flex-col items-center shrink-0 relative" style={{ width: '18px' }}>
                  <div className={cn(
                    'w-[18px] h-[18px] rounded-full flex items-center justify-center relative z-[2] transition-all',
                    isSelected && mode === 'pickup' && 'bg-teal-600 ring-[3px] ring-teal-200',
                    isSelected && mode === 'drop' && 'bg-coral-500 ring-[3px] ring-coral-200',
                    !isSelected && 'bg-white border-[2.5px]',
                    !isSelected && mode === 'pickup' && 'border-teal-300',
                    !isSelected && mode === 'drop' && 'border-coral-300',
                  )}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {!isLast && (
                    <div className={cn(
                      'w-[2px] flex-1 mt-1 rounded-full min-h-[24px]',
                      isSelected ? lineColorSelected : lineColor,
                    )} />
                  )}
                </div>

                <div className="flex-1 min-w-0 pt-px">
                  <p className={cn(
                    'text-[14px] truncate leading-tight',
                    isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-600',
                  )}>
                    {stop.name}
                  </p>
                  {!isSelected && stop.city && (
                    <span className="text-[11px] text-slate-400 mt-0.5 block">{stop.city}</span>
                  )}
                  {isSelected && mode === 'pickup' && (
                    <span className="text-[10px] font-bold text-teal-600 mt-0.5 block uppercase tracking-wide">Titik naik dipilih</span>
                  )}
                  {isSelected && mode === 'drop' && (
                    <span className="text-[10px] font-bold text-coral-600 mt-0.5 block uppercase tracking-wide">Titik turun dipilih</span>
                  )}
                </div>

                <span className={cn(
                  'text-[14px] font-bold tabular-nums shrink-0 pt-px',
                  isSelected && mode === 'pickup' && 'text-teal-700',
                  isSelected && mode === 'drop' && 'text-coral-600',
                  !isSelected && 'text-slate-500',
                )}>
                  {fmtTime(time)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-100 safe-bottom z-40">
        <div className="max-w-lg mx-auto px-4 py-3">
          {materializeMut.isError && (
            <p className="text-red-500 text-[12px] text-center mb-2 font-medium">Gagal memproses jadwal. Silakan coba lagi.</p>
          )}
          {pickupStop && !dropStop ? (
            <Button
              className="w-full h-[52px] rounded-2xl bg-coral-500 hover:bg-coral-600 text-[15px] font-bold shadow-lg shadow-coral-500/15 transition-all active:scale-[0.97]"
              onClick={() => setMode('drop')}
              data-testid="button-goto-drop"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Lanjut Pilih Titik Turun
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-[15px] font-bold shadow-lg shadow-emerald-600/15 transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
              disabled={!canProceed || materializeMut.isPending}
              onClick={proceed}
              data-testid="button-continue-stops"
            >
              {materializeMut.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Memproses jadwal...</>
              ) : !pickupStop
                ? 'Pilih titik naik dulu'
                : (
                  <>
                    Lanjut Pilih Kursi
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
