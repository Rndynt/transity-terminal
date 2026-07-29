import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { tripsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Save, Zap, AlertTriangle, Clock, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trip, TripStopTimeWithEffectiveFlags } from '@shared/schema';
import StopTimeField from './StopTimeField';
import { TripStatusBadge } from '@/components/shared/StatusBadges';

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
  summary?: {
    serviceDateLabel: string;
    vehicleLabel: string;
  };
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
  icon,
  value,
  onChange,
  allowedClass,
  testId,
}: {
  label: string;
  icon: React.ReactNode;
  value: OverrideState;
  onChange: (v: OverrideState) => void;
  allowedClass: string;
  testId?: string;
}) {
  const cycle = () => {
    if (value === null) onChange(true);
    else if (value === true) onChange(false);
    else onChange(null);
  };

  const normalized = value === undefined ? null : value;

  const colorClass =
    normalized === null
      ? 'bg-muted text-muted-foreground'
      : normalized === true
      ? allowedClass
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  const title =
    normalized === null
      ? `${label}: warisi pola (klik untuk override)`
      : normalized === true
      ? `${label}: diizinkan — override aktif (klik untuk larang)`
      : `${label}: dilarang — override aktif (klik untuk reset ke pola)`;

  return (
    <button
      type="button"
      onClick={cycle}
      data-testid={testId}
      title={title}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none',
        colorClass
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export default function TripScheduleEditor({ trip, onClose, summary }: TripScheduleEditorProps) {
  const [stopTimes, setStopTimes] = useState<StopTimeFormData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [backendErrors, setBackendErrors] = useState<Array<{ stopSequence: number; field: string; message: string }>>([]);
  const { toast } = useToast();

  // Ultimate fallback lower-bound = trip's service date at 00:00 (used only
  // for the very first field, before any stop has a time set yet).
  const tripDateMin = useMemo(() => {
    if (!trip.serviceDate) return '';
    const d = String(trip.serviceDate).slice(0, 10); // "YYYY-MM-DD"
    return `${d}T00:00`;
  }, [trip.serviceDate]);

  const serviceDateOnly = tripDateMin.slice(0, 10);

  // Per-row lower bounds, cascading forward from whatever time was actually
  // set on the previous stop (not just the trip's start-of-day). This is what
  // both blocks picking a time earlier than the previous stop, and powers the
  // "gunakan waktu ini" one-tap suggestion shown on empty fields.
  const anchors = useMemo(() => {
    const result: { arriveMin: string; departMin: string }[] = [];
    let carry = tripDateMin;
    for (const st of stopTimes) {
      const arriveMin = carry;
      const departMin = st.arriveAt || arriveMin;
      result.push({ arriveMin, departMin });
      carry = st.departAt || st.arriveAt || carry;
    }
    return result;
  }, [stopTimes, tripDateMin]);

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

  const syncMutation = useMutation({
    mutationFn: () => tripsApi.syncStopTimesFromPattern(trip.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips', trip.id, 'stop-times'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'] });
      toast({
        title: 'Halte berhasil disinkronkan',
        description: `${data.stopCount} halte dimuat dari pola rute.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal sync halte',
        description: error.message || 'Terjadi kesalahan.',
        variant: 'destructive',
      });
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

  if (stopTimes.length === 0 && !isLoading) {
    return (
      <div className="space-y-3 px-4 sm:px-5 py-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Tidak ada halte ditemukan untuk trip ini. Jika Anda sudah menambahkan halte ke pola rute, klik tombol di bawah untuk memuat halte.</AlertDescription>
        </Alert>
        <Button
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', syncMutation.isPending && 'animate-spin')} />
          {syncMutation.isPending ? 'Memuat halte...' : 'Muat Halte dari Pola Rute'}
        </Button>
      </div>
    );
  }

  const hasNoScheduleYet = stopTimes.every(st => !st.arriveAt && !st.departAt);
  const globalBackendError = backendErrors.find(e => e.stopSequence === 0);

  return (
    <div className="flex flex-col flex-1 min-h-0" data-testid="trip-schedule-editor">
      {/* Fixed top: trip summary + alerts (always visible, never scrolls away) */}
      <div className="shrink-0 px-4 sm:px-5 pt-4 space-y-3">
        {summary && (
          <div className="bg-muted/40 border border-border rounded-xl p-3 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground font-medium block mb-0.5">Tanggal</span>
                <span className="font-medium">{summary.serviceDateLabel}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block mb-0.5">Kendaraan</span>
                <span className="font-medium">{summary.vehicleLabel}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block mb-0.5">Kapasitas</span>
                <span className="font-medium">{trip.capacity} kursi</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block mb-0.5">Status</span>
                <TripStatusBadge status={trip.status || 'scheduled'} />
              </div>
            </div>
          </div>
        )}

        {hasNoScheduleYet && (
          <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              <strong>Jadwal belum diatur.</strong> Isi waktu setiap halte, lalu klik <em>Simpan & Bangun Inventori</em>.
            </AlertDescription>
          </Alert>
        )}

        {globalBackendError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{globalBackendError.message}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Scrollable middle: one card per halte */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 space-y-1">
        {stopTimes.map((st, index) => {
          const info = getStopInfo(st.stopId);
          const isFirst = index === 0;
          const isLast = index === stopTimes.length - 1;
          const isTransit = !isFirst && !isLast;
          const rowErrs = validationErrors[index] || [];
          const beErrors = backendErrors.filter(e => e.stopSequence === st.stopSequence);
          const allErrs = [...rowErrs, ...beErrors.map(e => e.message)];
          const hasErr = allErrs.length > 0;

          const roleLabel = isFirst ? 'Asal' : isLast ? 'Tujuan' : 'Transit';
          const rolePillClass = isFirst
            ? 'bg-primary/10 text-primary border border-primary/20'
            : isLast
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
            : 'bg-muted text-muted-foreground border border-border';

          const nextStop = stopTimes[index + 1];
          const legDur = nextStop
            ? calcLegDuration(st.departAt || st.arriveAt, nextStop.arriveAt || nextStop.departAt)
            : null;

          return (
            <div key={`${st.stopId}-${index}`}>
              {/* Stop card */}
              <div className={cn(
                'rounded-xl border bg-card p-3 space-y-2.5',
                hasErr && 'border-destructive/50 bg-destructive/5'
              )}>
                {/* Row 1: role badge + stop name + code + override pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', rolePillClass)}>
                    {roleLabel}
                  </span>
                  <span className="font-semibold text-sm text-foreground truncate flex-1 min-w-0">
                    {info.name}
                  </span>
                  {info.code && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                      {info.code}
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                    <OverridePill
                      label="Naik"
                      icon={<ArrowUp className="h-3 w-3" />}
                      value={st.boardingAllowed ?? null}
                      onChange={v => updateStop(index, 'boardingAllowed', v)}
                      allowedClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      testId={`boarding-override-${index}`}
                    />
                    <OverridePill
                      label="Turun"
                      icon={<ArrowDown className="h-3 w-3" />}
                      value={st.alightingAllowed ?? null}
                      onChange={v => updateStop(index, 'alightingAllowed', v)}
                      allowedClass="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                      testId={`alighting-override-${index}`}
                    />
                  </div>
                </div>

                {/* Row 2: time inputs */}
                <div className="flex items-end gap-3 flex-wrap pl-1">
                  {/* Tiba */}
                  <div className="space-y-1">
                    <span className={cn(
                      'block text-xs font-medium',
                      isFirst ? 'text-muted-foreground/40' : 'text-muted-foreground'
                    )}>
                      Tiba{!isFirst && <span className="text-destructive ml-0.5">*</span>}
                    </span>
                    {isFirst ? (
                      <div className="h-8 w-44 flex items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/30">
                        <span className="text-xs text-muted-foreground/40">—</span>
                      </div>
                    ) : (
                      <StopTimeField
                        value={st.arriveAt}
                        onChange={v => updateStop(index, 'arriveAt', v)}
                        minValue={anchors[index]?.arriveMin}
                        fallbackDate={serviceDateOnly}
                        hasError={hasErr}
                        testId={`arrive-time-${index}`}
                      />
                    )}
                  </div>

                  {/* Berangkat */}
                  <div className="space-y-1">
                    <span className={cn(
                      'block text-xs font-medium',
                      isLast ? 'text-muted-foreground/40' : 'text-muted-foreground'
                    )}>
                      Berangkat{!isLast && <span className="text-destructive ml-0.5">*</span>}
                    </span>
                    {isLast ? (
                      <div className="h-8 w-44 flex items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/30">
                        <span className="text-xs text-muted-foreground/40">—</span>
                      </div>
                    ) : (
                      <StopTimeField
                        value={st.departAt}
                        onChange={v => updateStop(index, 'departAt', v)}
                        minValue={anchors[index]?.departMin}
                        fallbackDate={serviceDateOnly}
                        hasError={hasErr || (isFirst && !st.departAt)}
                        testId={`depart-time-${index}`}
                      />
                    )}
                  </div>

                  {/* Singgah — hanya transit */}
                  {isTransit && (
                    <div className="space-y-1">
                      <span className="block text-xs font-medium text-muted-foreground">
                        <Clock className="inline w-3 h-3 mr-0.5 opacity-60" />
                        Singgah
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={st.dwellSeconds}
                          onChange={e => updateStop(index, 'dwellSeconds', parseInt(e.target.value) || 0)}
                          min="0"
                          className="h-8 text-xs w-20 px-2"
                          data-testid={`dwell-${index}`}
                        />
                        <span className="text-xs text-muted-foreground">dtk</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline validation errors */}
                {allErrs.length > 0 && (
                  <div className="space-y-0.5 pl-1">
                    {allErrs.map((err, i) => (
                      <p key={i} className="text-[10px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Leg duration connector */}
              {!isLast && (
                <div className="flex items-center gap-2 px-3 py-1">
                  <div className="w-px h-3 bg-border ml-3" />
                  {legDur ? (
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      legDur === 'Invalid'
                        ? 'bg-destructive/10 text-destructive'
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

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground px-1 pt-2">
          <span className="font-semibold">Pill Naik/Turun:</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-muted border border-border" /> Abu = warisi aturan pola</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" /> Hijau = izinkan</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Merah = larang</span>
          <span className="text-muted-foreground/60">· Klik pill untuk ubah</span>
        </div>
      </div>

      {/* Fixed bottom: action bar — grid on mobile so buttons never overflow off-screen */}
      <div className="shrink-0 border-t bg-background px-4 sm:px-5 py-3">
        <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 sm:flex-none" data-testid="close-button">
              Tutup
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => {
                if (confirm('Ini akan menimpa halte trip dengan halte terbaru dari pola rute. Waktu jadwal yang sudah diisi akan direset. Lanjutkan?')) {
                  syncMutation.mutate();
                }
              }}
              disabled={syncMutation.isPending || bulkUpsertMutation.isPending}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', syncMutation.isPending && 'animate-spin')} />
              {syncMutation.isPending ? 'Sync...' : 'Sync dari Rute'}
            </Button>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => handleSave(false)}
              disabled={bulkUpsertMutation.isPending || hasErrors}
              data-testid="save-schedule-button"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {bulkUpsertMutation.isPending ? 'Menyimpan...' : 'Simpan Jadwal'}
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none whitespace-normal text-center leading-tight"
              onClick={() => handleSave(true)}
              disabled={bulkUpsertMutation.isPending || hasErrors}
              data-testid="save-and-build-button"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              {bulkUpsertMutation.isPending ? 'Memproses...' : 'Simpan & Bangun Inventori'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
