import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { tripsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Save, Zap, AlertTriangle, Clock, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trip, TripStopTimeWithEffectiveFlags } from '@shared/schema';

function utcToLocalDatetime(utcTimestamp: string | Date | null): string {
  if (!utcTimestamp) return '';
  const date = new Date(utcTimestamp);
  const year = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' });
  const month = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', month: '2-digit' });
  const day = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', day: '2-digit' });
  const hours = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false });
  const minutes = date.toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', minute: '2-digit' });
  return `${year}-${month}-${day}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

interface TripScheduleEditorProps {
  trip: Trip;
  onClose: () => void;
}

interface StopTimeFormData {
  id?: string;
  stopId: string;
  stopSequence: number;
  arriveAt: string;
  departAt: string;
  dwellSeconds: number;
  boardingAllowed?: boolean | null;
  alightingAllowed?: boolean | null;
}

function calcLegDuration(from: string, to: string): string | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return 'Invalid';
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

type OverrideState = boolean | null;

function OverridePill({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: OverrideState;
  onChange: (v: OverrideState) => void;
  testId?: string;
}) {
  const cycle = () => {
    if (value === null) onChange(true);
    else if (value === true) onChange(false);
    else onChange(null);
  };
  return (
    <button
      type="button"
      onClick={cycle}
      data-testid={testId}
      title={value === null ? `${label}: warisi pola` : value ? `${label}: izinkan (override)` : `${label}: larang (override)`}
      className={cn(
        'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors select-none cursor-pointer',
        value === null
          ? 'bg-muted text-muted-foreground border-border'
          : value === true
          ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400'
      )}
    >
      {label}
      {value === null ? '' : value ? ' ✓' : ' ✗'}
    </button>
  );
}

export default function TripScheduleEditor({ trip, onClose }: TripScheduleEditorProps) {
  const [stopTimes, setStopTimes] = useState<StopTimeFormData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [backendErrors, setBackendErrors] = useState<Array<{ stopSequence: number; field: string; message: string }>>([]);
  const { toast } = useToast();

  const { data: stopTimesData = [], isLoading } = useQuery({
    queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'],
    queryFn: () => tripsApi.getStopTimesWithEffectiveFlags(trip.id),
  });

  const bulkUpsertMutation = useMutation({
    mutationFn: async (data: { tripId: string; stopTimes: any[]; precompute?: boolean }) => {
      const url = `/api/trips/${data.tripId}/stop-times/bulk-upsert${data.precompute ? '?precompute=true' : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.stopTimes),
      });
      const responseData = await response.json();
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        (error as any).responseData = responseData;
        throw error;
      }
      return responseData;
    },
    onSuccess: (_, variables) => {
      setBackendErrors([]);
      queryClient.invalidateQueries({ queryKey: ['/api/trips', trip.id, 'stop-times'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: variables.precompute ? 'Jadwal & inventori tersimpan' : 'Jadwal tersimpan',
        description: variables.precompute
          ? 'Jadwal berhasil disimpan dan inventori kursi telah dihitung.'
          : 'Jadwal halte berhasil diperbarui.',
      });
    },
    onError: (error: any) => {
      setBackendErrors([]);
      if (error.responseData?.code === 'invalid-stop-times' && error.responseData?.errors) {
        setBackendErrors(error.responseData.errors);
        toast({
          title: 'Validasi gagal',
          description: 'Ada kesalahan pada data waktu halte. Periksa kembali.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Gagal menyimpan',
          description: error.responseData?.error || error.message || 'Terjadi kesalahan.',
          variant: 'destructive',
        });
      }
    },
  });

  useEffect(() => {
    if (stopTimesData.length > 0) {
      const formData = [...stopTimesData]
        .sort((a: TripStopTimeWithEffectiveFlags, b: TripStopTimeWithEffectiveFlags) => a.stopSequence - b.stopSequence)
        .map((st: TripStopTimeWithEffectiveFlags) => ({
          id: st.id,
          stopId: st.stopId,
          stopSequence: st.stopSequence,
          arriveAt: utcToLocalDatetime(st.arriveAt),
          departAt: utcToLocalDatetime(st.departAt),
          dwellSeconds: st.dwellSeconds || 0,
          boardingAllowed: st.boardingAllowed,
          alightingAllowed: st.alightingAllowed,
        }));
      setStopTimes(formData);
    }
  }, [stopTimesData]);

  const validate = () => {
    const errs: Record<number, string[]> = {};
    let prevDepart: Date | null = null;
    for (let i = 0; i < stopTimes.length; i++) {
      const st = stopTimes[i];
      const arrive = st.arriveAt ? new Date(st.arriveAt) : null;
      const depart = st.departAt ? new Date(st.departAt) : null;
      const isFirst = i === 0;
      const isLast = i === stopTimes.length - 1;
      const rowErrs: string[] = [];

      if (isFirst && !st.departAt) rowErrs.push('Waktu berangkat wajib diisi di halte pertama');
      if (isLast && !st.arriveAt) rowErrs.push('Waktu tiba wajib diisi di halte terakhir');
      if (prevDepart && arrive && arrive < prevDepart) rowErrs.push('Waktu tiba harus setelah keberangkatan halte sebelumnya');
      if (arrive && depart && depart < arrive) rowErrs.push('Waktu berangkat harus setelah waktu tiba');

      if (rowErrs.length) errs[i] = rowErrs;
      prevDepart = depart || arrive || null;
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  useEffect(() => {
    if (stopTimes.length > 0) {
      validate();
      setBackendErrors([]);
    }
  }, [stopTimes]);

  const updateStop = (index: number, field: keyof StopTimeFormData, value: any) => {
    setStopTimes(prev => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSave = (precompute = false) => {
    if (!validate()) return;
    const payload = stopTimes.map(st => ({
      stopId: st.stopId,
      stopSequence: st.stopSequence,
      arriveAt: st.arriveAt ? new Date(st.arriveAt) : null,
      departAt: st.departAt ? new Date(st.departAt) : null,
      dwellSeconds: st.dwellSeconds,
      boardingAllowed: st.boardingAllowed,
      alightingAllowed: st.alightingAllowed,
    }));
    bulkUpsertMutation.mutate({ tripId: trip.id, stopTimes: payload, precompute });
  };

  const hasErrors = Object.keys(validationErrors).length > 0;

  const getStopInfo = (stopId: string) => {
    const st = stopTimesData.find((s: TripStopTimeWithEffectiveFlags) => s.stopId === stopId);
    return {
      name: st?.stopName || 'Halte tidak dikenal',
      code: st?.stopCode || '',
      effectiveBoarding: st?.effectiveBoardingAllowed ?? true,
      effectiveAlighting: st?.effectiveAlightingAllowed ?? true,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Clock className="w-4 h-4 animate-spin" />
        <span className="text-sm">Memuat jadwal...</span>
      </div>
    );
  }

  if (stopTimes.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Tidak ada halte ditemukan untuk trip ini. Pastikan pola rute memiliki halte.</AlertDescription>
      </Alert>
    );
  }

  const hasNoScheduleYet = stopTimes.every(st => !st.arriveAt && !st.departAt);
  const globalBackendError = backendErrors.find(e => e.stopSequence === 0);

  return (
    <div className="flex flex-col gap-4" data-testid="trip-schedule-editor">
      {hasNoScheduleYet && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>Jadwal belum diatur.</strong> Trip ini tidak akan tampil di reservasi hingga waktu keberangkatan setiap halte diisi. Isi jadwal di bawah lalu klik <em>Simpan & Bangun Inventori</em>.
          </AlertDescription>
        </Alert>
      )}

      {globalBackendError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{globalBackendError.message}</AlertDescription>
        </Alert>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />

        <div className="space-y-0">
          {stopTimes.map((st, index) => {
            const info = getStopInfo(st.stopId);
            const isFirst = index === 0;
            const isLast = index === stopTimes.length - 1;
            const rowErrs = validationErrors[index] || [];
            const beErrors = backendErrors.filter(e => e.stopSequence === st.stopSequence);
            const allErrs = [...rowErrs, ...beErrors.map(e => e.message)];
            const hasErr = allErrs.length > 0;

            const nextStop = stopTimes[index + 1];
            const legDur = nextStop
              ? calcLegDuration(st.departAt || st.arriveAt, nextStop.arriveAt || nextStop.departAt)
              : null;

            return (
              <div key={`${st.stopId}-${index}`}>
                {/* Stop row */}
                <div className={cn(
                  'relative flex gap-3 pl-10 pr-2 py-3 rounded-lg transition-colors',
                  hasErr ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/40'
                )}>
                  {/* Dot */}
                  <div className={cn(
                    'absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 bg-background shrink-0',
                    isFirst ? 'border-primary' : isLast ? 'border-green-500' : 'border-border'
                  )} />

                  {/* Stop info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {st.stopSequence}
                      </span>
                      <span className="font-semibold text-sm text-foreground truncate">{info.name}</span>
                      {info.code && (
                        <span className="text-[10px] text-muted-foreground font-mono">{info.code}</span>
                      )}
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <OverridePill
                          label="Naik"
                          value={st.boardingAllowed}
                          onChange={v => updateStop(index, 'boardingAllowed', v)}
                          testId={`boarding-override-${index}`}
                        />
                        <OverridePill
                          label="Turun"
                          value={st.alightingAllowed}
                          onChange={v => updateStop(index, 'alightingAllowed', v)}
                          testId={`alighting-override-${index}`}
                        />
                      </div>
                    </div>

                    {/* Time inputs */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isFirst && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-medium w-9 text-right">Tiba</span>
                          <Input
                            type="datetime-local"
                            value={st.arriveAt}
                            onChange={e => updateStop(index, 'arriveAt', e.target.value)}
                            className="h-7 text-xs w-44 px-2"
                            data-testid={`arrive-time-${index}`}
                          />
                        </div>
                      )}
                      {!isLast && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-medium w-9 text-right">
                            Brkt{isFirst ? '*' : ''}
                          </span>
                          <Input
                            type="datetime-local"
                            value={st.departAt}
                            onChange={e => updateStop(index, 'departAt', e.target.value)}
                            className={cn('h-7 text-xs w-44 px-2', isFirst && !st.departAt && 'border-amber-400')}
                            data-testid={`depart-time-${index}`}
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium w-9 text-right">Singgah</span>
                        <Input
                          type="number"
                          value={st.dwellSeconds}
                          onChange={e => updateStop(index, 'dwellSeconds', parseInt(e.target.value) || 0)}
                          min="0"
                          className="h-7 text-xs w-20 px-2"
                          data-testid={`dwell-${index}`}
                        />
                        <span className="text-[10px] text-muted-foreground">dtk</span>
                      </div>
                    </div>

                    {/* Inline errors */}
                    {allErrs.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {allErrs.map((err, i) => (
                          <p key={i} className="text-[10px] text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Leg duration between stops */}
                {!isLast && (
                  <div className="flex items-center gap-2 pl-10 py-0.5">
                    <ArrowDown className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    {legDur ? (
                      <span className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full',
                        legDur === 'Invalid'
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/20'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {legDur}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">— belum ada waktu —</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Override legend */}
      <p className="text-[10px] text-muted-foreground px-1">
        Pill <strong>Naik</strong> / <strong>Turun</strong>: klik untuk override aturan pola. Abu = warisi pola, Hijau = izinkan, Merah = larang.
      </p>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="close-button">
          Tutup
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={bulkUpsertMutation.isPending || hasErrors}
            data-testid="save-schedule-button"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {bulkUpsertMutation.isPending ? 'Menyimpan...' : 'Simpan Jadwal'}
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave(true)}
            disabled={bulkUpsertMutation.isPending || hasErrors}
            data-testid="save-and-build-button"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {bulkUpsertMutation.isPending ? 'Memproses...' : 'Simpan & Bangun Inventori'}
          </Button>
        </div>
      </div>
    </div>
  );
}
