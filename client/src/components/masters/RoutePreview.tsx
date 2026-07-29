import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle2, XCircle, Route as RouteIcon, ListOrdered, AlertTriangle, Info } from 'lucide-react';
import { tripPatternsApi, tripBasesApi, tripsApi, priceRulesApi } from '@/lib/api';
import { PriceGrid, type MatrixGridRow } from './PriceGrid';
import MasterPageHeader from './MasterPageHeader';
import type { TripPattern, TripBase, PatternStop, Stop, TripWithDetails } from '@/types';
import type { TripStopTimeWithEffectiveFlags } from '@shared/schema';

type PatternStopWithStop = PatternStop & { stop: Stop | null };
type Selection = { kind: 'base' | 'trip'; id: string } | null;

interface DefaultStopTime {
  stopSequence: number;
  arriveAt: string | null;
  departAt: string | null;
}

interface ResolvedStopRow {
  stopId: string;
  stopSequence: number;
  stopName: string;
  stopCode?: string | null;
  city?: string | null;
  boardingAllowed: boolean;
  alightingAllowed: boolean;
  arriveAt: string | null; // HH:MM (local)
  departAt: string | null; // HH:MM (local)
  overridden: boolean; // true when a trip's actual naik/turun beda dari default pola
}

interface SegmentRow {
  key: string;
  originSeq: number;
  originName: string;
  destSeq: number;
  destName: string;
  departAt: string | null;
  arriveAt: string | null;
  price: number | null;
}

const CHANNELS = ['CSO', 'WEB', 'APP', 'OTA'] as const;
const DAY_LABEL: Record<string, string> = { mon: 'Sen', tue: 'Sel', wed: 'Rab', thu: 'Kam', fri: 'Jum', sat: 'Sab', sun: 'Min' };
const STATUS_LABEL: Record<string, string> = { scheduled: 'Terjadwal', cancelled: 'Dibatalkan', closed: 'Ditutup' };

function timeLabel(v: string | null | undefined) {
  return v || '—';
}

function clockFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return null;
  }
}

function dateLabel(v: string | null | undefined) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return v;
  }
}

function durationLabel(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return '—';
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // lewat tengah malam
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function formatPrice(v: number) {
  return `Rp ${v.toLocaleString('id-ID')}`;
}

function ChannelBadges({ flags }: { flags: any }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {CHANNELS.map(c => {
        const on = !!flags?.[c];
        return (
          <span
            key={c}
            className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
              on ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground/50 border-transparent line-through'
            }`}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}

export default function RoutePreview() {
  const [patternId, setPatternId] = useState<string>('');
  const [selection, setSelection] = useState<Selection>(null);

  const patternsQuery = useQuery({ queryKey: ['/api/trip-patterns'], queryFn: tripPatternsApi.getAll });

  const stopsQuery = useQuery({
    queryKey: ['/api/trip-patterns', patternId, 'stops'],
    queryFn: () => tripPatternsApi.getStops(patternId),
    enabled: !!patternId,
  });

  const allBasesQuery = useQuery({ queryKey: ['/api/trip-bases'], queryFn: tripBasesApi.getAll });
  const allTripsQuery = useQuery({ queryKey: ['/api/trips'], queryFn: () => tripsApi.getAll() });

  const gridQuery = useQuery({
    queryKey: ['/api/price-rules/pattern', patternId],
    queryFn: () => priceRulesApi.getPatternGrid(patternId, 'regular'),
    enabled: !!patternId && selection?.kind !== 'trip',
  });

  const tripStopTimesQuery = useQuery({
    queryKey: ['/api/trips', selection?.id, 'stop-times', 'effective'],
    queryFn: () => tripsApi.getStopTimesWithEffectiveFlags(selection!.id) as Promise<TripStopTimeWithEffectiveFlags[]>,
    enabled: selection?.kind === 'trip',
  });

  const tripMatrixQuery = useQuery({
    queryKey: ['/api/pricing/trip-matrix', selection?.id],
    queryFn: () => priceRulesApi.getTripPricedMatrix(selection!.id),
    enabled: selection?.kind === 'trip',
  });

  const patterns: TripPattern[] = patternsQuery.data ?? [];
  const selectedPattern = patterns.find(p => p.id === patternId);
  const allowIntraCity = !!selectedPattern?.allowIntraCityBooking;

  const stops: PatternStopWithStop[] = useMemo(
    () => [...(stopsQuery.data ?? [])].sort((a, b) => a.stopSequence - b.stopSequence),
    [stopsQuery.data]
  );

  const basesForPattern: TripBase[] = useMemo(
    () => (allBasesQuery.data ?? []).filter((b: TripBase) => b.patternId === patternId),
    [allBasesQuery.data, patternId]
  );

  const tripsForPattern: TripWithDetails[] = useMemo(
    () => (allTripsQuery.data ?? []).filter((t: TripWithDetails) => t.patternId === patternId),
    [allTripsQuery.data, patternId]
  );

  // Auto-pilih pertama kali data rute ini kelar dimuat — prioritaskan
  // jadwal berkala (paling umum), tapi kalau rute ini cuma punya trip
  // ad-hoc (dibuat langsung di tab Trip tanpa Dasar Trip), itu yang dipilih.
  useEffect(() => {
    if (!patternId || selection) return;
    if (basesForPattern.length > 0) setSelection({ kind: 'base', id: basesForPattern[0].id });
    else if (tripsForPattern.length > 0) setSelection({ kind: 'trip', id: tripsForPattern[0].id });
  }, [patternId, selection, basesForPattern, tripsForPattern]);

  const selectedBase = selection?.kind === 'base' ? basesForPattern.find(b => b.id === selection.id) : undefined;
  const selectedTrip = selection?.kind === 'trip' ? tripsForPattern.find(t => t.id === selection.id) : undefined;
  const selectedTripBaseName = selectedTrip?.baseId ? basesForPattern.find(b => b.id === selectedTrip.baseId)?.name : null;

  const baseStopTimes: DefaultStopTime[] = (selectedBase?.defaultStopTimes as DefaultStopTime[] | undefined) ?? [];
  const baseTimeByStopSeq = new Map(baseStopTimes.map(t => [t.stopSequence, t]));

  const priceRows: MatrixGridRow[] = gridQuery.data?.rows ?? [];
  const patternCellMap = useMemo(() => {
    const cells: Array<{ originStopId: string; destinationStopId: string; price: number }> = gridQuery.data?.cells ?? [];
    return new Map(cells.map(c => [`${c.originStopId}|${c.destinationStopId}`, c.price]));
  }, [gridQuery.data]);
  const priceCellsForGrid = useMemo(
    () => [...patternCellMap.entries()].map(([key, value]) => {
      const [originStopId, destinationStopId] = key.split('|');
      return { originStopId, destinationStopId, value };
    }),
    [patternCellMap]
  );

  // Baris master topologi (selalu dari pola rute) digabung dengan jam &
  // status naik/turun dari sumber yang sedang dipilih — Dasar Trip
  // (default per pola) ATAU trip spesifik/ad-hoc (actual, termasuk override
  // per-trip kalau ada).
  const resolvedRows: ResolvedStopRow[] = useMemo(() => {
    if (selection?.kind === 'trip' && tripStopTimesQuery.data) {
      const byStopId = new Map(stops.map(ps => [ps.stopId, ps]));
      return [...tripStopTimesQuery.data]
        .sort((a, b) => a.stopSequence - b.stopSequence)
        .map(t => {
          const ps = byStopId.get(t.stopId);
          const patternBoarding = !!ps?.boardingAllowed;
          const patternAlighting = !!ps?.alightingAllowed;
          return {
            stopId: t.stopId,
            stopSequence: t.stopSequence,
            stopName: t.stopName || ps?.stop?.name || '(halte tidak dikenal)',
            stopCode: t.stopCode || ps?.stop?.code,
            city: ps?.stop?.city ?? null,
            boardingAllowed: t.effectiveBoardingAllowed,
            alightingAllowed: t.effectiveAlightingAllowed,
            arriveAt: clockFromIso(t.arriveAt as unknown as string),
            departAt: clockFromIso(t.departAt as unknown as string),
            overridden: t.effectiveBoardingAllowed !== patternBoarding || t.effectiveAlightingAllowed !== patternAlighting,
          };
        });
    }
    return stops.map(ps => {
      const t = selection?.kind === 'base' ? baseTimeByStopSeq.get(ps.stopSequence) : undefined;
      return {
        stopId: ps.stopId,
        stopSequence: ps.stopSequence,
        stopName: ps.stop?.name ?? '(halte terhapus)',
        stopCode: ps.stop?.code,
        city: ps.stop?.city ?? null,
        boardingAllowed: !!ps.boardingAllowed,
        alightingAllowed: !!ps.alightingAllowed,
        arriveAt: t?.arriveAt ?? null,
        departAt: t?.departAt ?? null,
        overridden: false,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, selection, baseStopTimes, tripStopTimesQuery.data]);

  const sequenceGaps = useMemo(() => {
    const seqs = stops.map(s => s.stopSequence).sort((a, b) => a - b);
    const gaps: string[] = [];
    for (let i = 1; i < seqs.length; i++) {
      if (seqs[i] - seqs[i - 1] > 1) gaps.push(`#${seqs[i - 1]} → #${seqs[i]}`);
    }
    return gaps;
  }, [stops]);

  const priceFor = (originStopId: string, destStopId: string): number | null => {
    if (selection?.kind === 'trip') {
      const v = tripMatrixQuery.data?.[originStopId]?.[destStopId];
      return v ?? null;
    }
    return patternCellMap.get(`${originStopId}|${destStopId}`) ?? null;
  };

  const segments: SegmentRow[] = useMemo(() => {
    if (resolvedRows.length < 2) return [];
    const list: SegmentRow[] = [];
    for (let i = 0; i < resolvedRows.length - 1; i++) {
      const origin = resolvedRows[i];
      if (!origin.boardingAllowed) continue;
      for (let j = i + 1; j < resolvedRows.length; j++) {
        const dest = resolvedRows[j];
        if (!dest.alightingAllowed) continue;
        if (selection?.kind !== 'trip') {
          const sameCity = !allowIntraCity && !!origin.city && !!dest.city && origin.city === dest.city;
          if (sameCity) continue;
        }
        list.push({
          key: `${origin.stopId}-${dest.stopId}`,
          originSeq: origin.stopSequence,
          originName: origin.stopName,
          destSeq: dest.stopSequence,
          destName: dest.stopName,
          departAt: origin.departAt,
          arriveAt: dest.arriveAt,
          price: priceFor(origin.stopId, dest.stopId),
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRows, selection, patternCellMap, tripMatrixQuery.data, allowIntraCity]);

  const missingPriceCount = segments.filter(s => !s.price || s.price <= 0).length;
  const isLoadingSelection =
    (selection?.kind === 'base' && gridQuery.isLoading) ||
    (selection?.kind === 'trip' && (tripStopTimesQuery.isLoading || tripMatrixQuery.isLoading));

  return (
    <div className="space-y-4">
      <MasterPageHeader
        title="Preview Rute"
        description="Cek cepat data rute yang sudah dibuat — titik naik/turun, jam, harga, dan flag channel — tanpa perlu buka CSO/App."
        action={<></>}
      />

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rute (Pola Perjalanan)</label>
              <Select value={patternId} onValueChange={(v) => { setPatternId(v); setSelection(null); }}>
                <SelectTrigger data-testid="select-preview-pattern">
                  <SelectValue placeholder="Pilih rute..." />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Jadwal / Trip</label>
              <Select
                value={selection ? `${selection.kind}:${selection.id}` : ''}
                onValueChange={(v) => {
                  const [kind, id] = v.split(':');
                  setSelection({ kind: kind as 'base' | 'trip', id });
                }}
                disabled={!patternId || (basesForPattern.length === 0 && tripsForPattern.length === 0)}
              >
                <SelectTrigger data-testid="select-preview-schedule">
                  <SelectValue placeholder={
                    !patternId
                      ? 'Pilih rute dulu...'
                      : (basesForPattern.length === 0 && tripsForPattern.length === 0)
                        ? 'Belum ada Dasar Trip maupun Trip untuk rute ini'
                        : 'Pilih jadwal/trip...'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {basesForPattern.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Jadwal Berkala (Dasar Trip)</SelectLabel>
                      {basesForPattern.map(b => (
                        <SelectItem key={b.id} value={`base:${b.id}`}>{b.name}{b.code ? ` (${b.code})` : ''}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {tripsForPattern.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Trip / Tanggal Spesifik{tripsForPattern.some(t => !t.baseId) ? ' (termasuk non-berkala)' : ''}</SelectLabel>
                      {tripsForPattern.map(t => (
                        <SelectItem key={t.id} value={`trip:${t.id}`}>
                          {dateLabel(t.serviceDate)} · {t.originDepartHHMM || clockFromIso(t.scheduleTime as any) || '—'}
                          {!t.baseId ? ' · non-berkala' : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPattern && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={selectedPattern.active ? 'default' : 'secondary'}>{selectedPattern.active ? 'Aktif' : 'Nonaktif'}</Badge>
              {selectedPattern.vehicleClass && <Badge variant="outline">{selectedPattern.vehicleClass}</Badge>}
              <Badge variant="outline">{allowIntraCity ? 'Izinkan rute dalam kota' : 'Rute dalam kota diblokir'}</Badge>
              {(selectedPattern.tags ?? []).map(tag => <Badge key={tag} variant="outline">#{tag}</Badge>)}
            </div>
          )}

          {selectedBase && (
            <div className="flex flex-wrap items-center gap-2 border-t mt-2 pt-2">
              <span className="text-[11px] text-muted-foreground">Dasar Trip:</span>
              <Badge variant="outline">
                Hari aktif: {(['mon','tue','wed','thu','fri','sat','sun'] as const).filter(d => (selectedBase as any)[d]).map(d => DAY_LABEL[d]).join(', ') || 'Tidak ada'}
              </Badge>
              {selectedBase.capacity != null && <Badge variant="outline">Kapasitas: {selectedBase.capacity}</Badge>}
              <ChannelBadges flags={selectedBase.channelFlags} />
            </div>
          )}

          {selectedTrip && (
            <div className="flex flex-wrap items-center gap-2 border-t mt-2 pt-2">
              <span className="text-[11px] text-muted-foreground">Trip:</span>
              <Badge variant={selectedTrip.status === 'cancelled' ? 'destructive' : selectedTrip.status === 'closed' ? 'secondary' : 'default'}>
                {STATUS_LABEL[selectedTrip.status ?? 'scheduled'] ?? selectedTrip.status}
              </Badge>
              <Badge variant="outline">{dateLabel(selectedTrip.serviceDate)}</Badge>
              {selectedTrip.capacity != null && <Badge variant="outline">Kapasitas: {selectedTrip.capacity}</Badge>}
              {selectedTrip.vehiclePlate && <Badge variant="outline">{selectedTrip.vehiclePlate}</Badge>}
              {selectedTrip.driverName && <Badge variant="outline">{selectedTrip.driverName}</Badge>}
              <Badge variant={selectedTrip.baseId ? 'outline' : 'secondary'}>
                {selectedTrip.baseId ? `Dari Dasar Trip: ${selectedTripBaseName ?? '—'}` : 'Non-berkala (dibuat langsung di Trip)'}
              </Badge>
              <ChannelBadges flags={selectedTrip.channelFlags} />
            </div>
          )}
        </CardContent>
      </Card>

      {!patternId ? (
        <div className="text-sm text-muted-foreground text-center p-8 border rounded-lg bg-muted/20">
          <RouteIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
          Pilih rute di atas untuk melihat breakdown titik naik/turun, jam, dan harga.
        </div>
      ) : stopsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground text-center p-8">Memuat data rute...</div>
      ) : (
        <>
          {sequenceGaps.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Ada gap urutan sequence di pola ini ({sequenceGaps.join(', ')}) — biasanya karena ada halte yang pernah
                dihapus dari rute. Bukan berarti error, tapi cek ulang kalau ini tidak disengaja.
              </span>
            </div>
          )}

          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Titik Naik / Turun
                {selection?.kind === 'trip' && <span className="text-[11px] font-normal text-muted-foreground">(jam &amp; status aktual trip ini)</span>}
                {selection?.kind === 'base' && <span className="text-[11px] font-normal text-muted-foreground">(jam default dari Dasar Trip)</span>}
              </h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left border-b font-medium w-10">#</th>
                      <th className="p-2 text-left border-b font-medium">Halte</th>
                      <th className="p-2 text-left border-b font-medium">Kota</th>
                      <th className="p-2 text-center border-b font-medium">Naik</th>
                      <th className="p-2 text-center border-b font-medium">Turun</th>
                      <th className="p-2 text-center border-b font-medium">Jam Tiba</th>
                      <th className="p-2 text-center border-b font-medium">Jam Berangkat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedRows.map(row => (
                      <tr key={row.stopId} data-testid={`row-preview-stop-${row.stopSequence}`} className={row.overridden ? 'bg-amber-50' : undefined}>
                        <td className="p-2 border-b text-muted-foreground">{row.stopSequence}</td>
                        <td className="p-2 border-b font-medium">
                          {row.stopName}
                          {row.stopCode && <span className="text-muted-foreground font-normal ml-1">({row.stopCode})</span>}
                          {row.overridden && <span title="Naik/turun di trip ini beda dari default pola" className="ml-1 text-amber-600">•diubah</span>}
                        </td>
                        <td className="p-2 border-b text-muted-foreground">{row.city ?? '—'}</td>
                        <td className="p-2 border-b text-center">
                          {row.boardingAllowed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}
                        </td>
                        <td className="p-2 border-b text-center">
                          {row.alightingAllowed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}
                        </td>
                        <td className="p-2 border-b text-center">{timeLabel(row.arriveAt)}</td>
                        <td className="p-2 border-b text-center">{timeLabel(row.departAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!selection && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Belum ada Dasar Trip maupun Trip untuk rute ini, jadi kolom jam masih kosong. Kalau jadwalnya memang
                  bukan berkala, buat langsung di tab "Trip" (tidak wajib bikin Dasar Trip dulu) — nanti otomatis
                  muncul di sini di grup "Trip / Tanggal Spesifik".
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <ListOrdered className="w-4 h-4" /> Jadwal Hasil Generate — Semua Kombinasi Titik
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{segments.length} kombinasi</Badge>
                  {missingPriceCount > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {missingPriceCount} belum ada harga
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Gabungan titik + jam + harga di atas, dipecah per pasangan asal→tujuan sesuai urutan sequence — supaya
                kelihatan langsung kombinasi mana yang sudah lengkap dan mana yang belum.
              </p>
              <div className="overflow-x-auto border rounded-lg max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted">
                      <th className="p-2 text-left border-b font-medium w-10">#</th>
                      <th className="p-2 text-left border-b font-medium">Asal</th>
                      <th className="p-2 text-left border-b font-medium">Tujuan</th>
                      <th className="p-2 text-center border-b font-medium">Jam Berangkat</th>
                      <th className="p-2 text-center border-b font-medium">Jam Tiba</th>
                      <th className="p-2 text-center border-b font-medium">Durasi</th>
                      <th className="p-2 text-right border-b font-medium">Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingSelection ? (
                      <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Memuat...</td></tr>
                    ) : segments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          Belum ada kombinasi asal→tujuan yang valid — cek boarding/alighting dan pengaturan dalam-kota di pola rute ini.
                        </td>
                      </tr>
                    ) : segments.map((s, idx) => {
                      const noPrice = !s.price || s.price <= 0;
                      return (
                        <tr key={s.key} data-testid={`row-segment-${s.originSeq}-${s.destSeq}`} className={noPrice ? 'bg-destructive/5' : undefined}>
                          <td className="p-2 border-b text-muted-foreground">{idx + 1}</td>
                          <td className="p-2 border-b font-medium"><span className="text-muted-foreground font-normal mr-1">{s.originSeq}.</span>{s.originName}</td>
                          <td className="p-2 border-b font-medium"><span className="text-muted-foreground font-normal mr-1">{s.destSeq}.</span>{s.destName}</td>
                          <td className="p-2 border-b text-center">{timeLabel(s.departAt)}</td>
                          <td className="p-2 border-b text-center">{timeLabel(s.arriveAt)}</td>
                          <td className="p-2 border-b text-center text-muted-foreground">{durationLabel(s.departAt, s.arriveAt)}</td>
                          <td className="p-2 border-b text-right">
                            {noPrice ? <span className="text-destructive font-medium">Belum diset</span> : <span className="font-medium">{formatPrice(s.price!)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {selection?.kind !== 'trip' && (
            <Card>
              <CardContent className="pt-4">
                <h4 className="text-sm font-semibold mb-3">Harga per Titik Asal → Tujuan (Grid)</h4>
                {gridQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground text-center p-4">Memuat harga...</div>
                ) : (
                  <PriceGrid
                    rows={priceRows}
                    cells={priceCellsForGrid}
                    onChange={() => {}}
                    disabled
                    disableSameCityCells={!allowIntraCity}
                    emptyLabel="Belum ada harga diset untuk rute ini."
                  />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
