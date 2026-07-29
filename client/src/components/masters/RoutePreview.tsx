import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle2, XCircle, Route as RouteIcon, ListOrdered, AlertTriangle } from 'lucide-react';
import { tripPatternsApi, tripBasesApi, priceRulesApi } from '@/lib/api';
import { PriceGrid, type MatrixGridRow } from './PriceGrid';
import MasterPageHeader from './MasterPageHeader';
import type { TripPattern, TripBase, PatternStop, Stop } from '@/types';

type PatternStopWithStop = PatternStop & { stop: Stop | null };

interface DefaultStopTime {
  stopSequence: number;
  arriveAt: string | null;
  departAt: string | null;
}

function timeLabel(v: string | null | undefined) {
  return v || '—';
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

export default function RoutePreview() {
  const [patternId, setPatternId] = useState<string>('');
  const [baseId, setBaseId] = useState<string>('');

  const patternsQuery = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
  });

  const stopsQuery = useQuery({
    queryKey: ['/api/trip-patterns', patternId, 'stops'],
    queryFn: () => tripPatternsApi.getStops(patternId),
    enabled: !!patternId,
  });

  const allBasesQuery = useQuery({
    queryKey: ['/api/trip-bases'],
    queryFn: tripBasesApi.getAll,
  });

  const gridQuery = useQuery({
    queryKey: ['/api/price-rules/pattern', patternId],
    queryFn: () => priceRulesApi.getPatternGrid(patternId, 'regular'),
    enabled: !!patternId,
  });

  const patterns: TripPattern[] = patternsQuery.data ?? [];
  const stops: PatternStopWithStop[] = useMemo(
    () => [...(stopsQuery.data ?? [])].sort((a, b) => a.stopSequence - b.stopSequence),
    [stopsQuery.data]
  );
  const basesForPattern: TripBase[] = useMemo(
    () => (allBasesQuery.data ?? []).filter((b: TripBase) => b.patternId === patternId),
    [allBasesQuery.data, patternId]
  );

  const selectedBase: TripBase | undefined =
    basesForPattern.find(b => b.id === baseId) ?? basesForPattern[0];
  const stopTimes: DefaultStopTime[] = (selectedBase?.defaultStopTimes as DefaultStopTime[] | undefined) ?? [];
  const timeByStopSeq = new Map(stopTimes.map(t => [t.stopSequence, t]));

  const selectedPattern = patterns.find(p => p.id === patternId);
  const priceRows: MatrixGridRow[] = gridQuery.data?.rows ?? [];
  const priceCells = (gridQuery.data?.cells ?? []).map(
    (c: { originStopId: string; destinationStopId: string; price: number }) => ({
      originStopId: c.originStopId,
      destinationStopId: c.destinationStopId,
      value: c.price,
    })
  );

  // "Hasil generate" — daftar semua kombinasi asal->tujuan yang valid untuk
  // rute ini (naik & turun diizinkan, bukan pasangan dalam-kota yang
  // diblokir), diurutkan sequence asal lalu sequence tujuan — persis alur
  // yang akan customer lihat, tapi dibaca sekali jalan tanpa perlu klik
  // satu-satu ke CSO/App.
  const allowIntraCity = !!selectedPattern?.allowIntraCityBooking;
  const segments: SegmentRow[] = useMemo(() => {
    if (stops.length < 2) return [];
    const cellMap = new Map(priceCells.map((c: any) => [`${c.originStopId}|${c.destinationStopId}`, c.value as number]));
    const list: SegmentRow[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const origin = stops[i];
      if (!origin.boardingAllowed) continue;
      for (let j = i + 1; j < stops.length; j++) {
        const dest = stops[j];
        if (!dest.alightingAllowed) continue;
        const sameCity = !allowIntraCity && !!origin.stop?.city && !!dest.stop?.city && origin.stop.city === dest.stop.city;
        if (sameCity) continue;
        const originTime = timeByStopSeq.get(origin.stopSequence);
        const destTime = timeByStopSeq.get(dest.stopSequence);
        const price = cellMap.get(`${origin.stopId}|${dest.stopId}`);
        list.push({
          key: `${origin.id}-${dest.id}`,
          originSeq: origin.stopSequence,
          originName: origin.stop?.name ?? '(halte terhapus)',
          destSeq: dest.stopSequence,
          destName: dest.stop?.name ?? '(halte terhapus)',
          departAt: originTime?.departAt ?? null,
          arriveAt: destTime?.arriveAt ?? null,
          price: price ?? null,
        });
      }
    }
    return list;
  }, [stops, priceCells, selectedBase, allowIntraCity]);

  const missingPriceCount = segments.filter(s => !s.price || s.price <= 0).length;

  return (
    <div className="space-y-4">
      <MasterPageHeader
        title="Preview Rute"
        description="Cek cepat data rute yang sudah dibuat — titik naik/turun, jam, dan harga — tanpa perlu buka CSO/App."
        action={<></>}
      />

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rute (Pola Perjalanan)</label>
              <Select
                value={patternId}
                onValueChange={(v) => { setPatternId(v); setBaseId(''); }}
              >
                <SelectTrigger data-testid="select-preview-pattern">
                  <SelectValue placeholder="Pilih rute..." />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Jadwal (Dasar Trip)</label>
              <Select
                value={selectedBase?.id ?? ''}
                onValueChange={setBaseId}
                disabled={!patternId || basesForPattern.length === 0}
              >
                <SelectTrigger data-testid="select-preview-base">
                  <SelectValue placeholder={
                    !patternId
                      ? 'Pilih rute dulu...'
                      : basesForPattern.length === 0
                        ? 'Belum ada jadwal untuk rute ini'
                        : 'Pilih jadwal...'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {basesForPattern.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}{b.code ? ` (${b.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPattern && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={selectedPattern.active ? 'default' : 'secondary'}>
                {selectedPattern.active ? 'Aktif' : 'Nonaktif'}
              </Badge>
              {selectedPattern.vehicleClass && <Badge variant="outline">{selectedPattern.vehicleClass}</Badge>}
              <Badge variant="outline">
                {selectedPattern.allowIntraCityBooking ? 'Izinkan rute dalam kota' : 'Rute dalam kota diblokir'}
              </Badge>
              {selectedBase && (
                <Badge variant="outline">
                  Hari aktif:{' '}
                  {(['mon','tue','wed','thu','fri','sat','sun'] as const)
                    .filter(d => (selectedBase as any)[d])
                    .map(d => ({mon:'Sen',tue:'Sel',wed:'Rab',thu:'Kam',fri:'Jum',sat:'Sab',sun:'Min'}[d]))
                    .join(', ') || 'Tidak ada'}
                </Badge>
              )}
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
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Titik Naik / Turun
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
                    {stops.map(ps => {
                      const t = timeByStopSeq.get(ps.stopSequence);
                      return (
                        <tr key={ps.id} data-testid={`row-preview-stop-${ps.stopSequence}`}>
                          <td className="p-2 border-b text-muted-foreground">{ps.stopSequence}</td>
                          <td className="p-2 border-b font-medium">
                            {ps.stop?.name ?? '(halte terhapus)'}
                            {ps.stop?.code && <span className="text-muted-foreground font-normal ml-1">({ps.stop.code})</span>}
                          </td>
                          <td className="p-2 border-b text-muted-foreground">{ps.stop?.city ?? '—'}</td>
                          <td className="p-2 border-b text-center">
                            {ps.boardingAllowed
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" />
                              : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}
                          </td>
                          <td className="p-2 border-b text-center">
                            {ps.alightingAllowed
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" />
                              : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 inline" />}
                          </td>
                          <td className="p-2 border-b text-center">{timeLabel(t?.arriveAt)}</td>
                          <td className="p-2 border-b text-center">{timeLabel(t?.departAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!selectedBase && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Belum ada jadwal (Dasar Trip) untuk rute ini, jadi kolom jam masih kosong — buat jadwal dulu di tab
                  "Dasar Trip" untuk melihat jam per titik.
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
                Ini gabungan tabel titik + jam + harga di atas, dipecah per pasangan asal→tujuan sesuai urutan sequence
                — supaya kelihatan langsung kombinasi mana yang sudah lengkap dan mana yang belum, tanpa perlu cek satu-satu ke CSO/App.
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
                    {segments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          Belum ada kombinasi asal→tujuan yang valid — cek boarding/alighting dan pengaturan dalam-kota di pola rute ini.
                        </td>
                      </tr>
                    ) : segments.map((s, idx) => {
                      const noPrice = !s.price || s.price <= 0;
                      return (
                        <tr
                          key={s.key}
                          data-testid={`row-segment-${s.originSeq}-${s.destSeq}`}
                          className={noPrice ? 'bg-destructive/5' : undefined}
                        >
                          <td className="p-2 border-b text-muted-foreground">{idx + 1}</td>
                          <td className="p-2 border-b font-medium">
                            <span className="text-muted-foreground font-normal mr-1">{s.originSeq}.</span>{s.originName}
                          </td>
                          <td className="p-2 border-b font-medium">
                            <span className="text-muted-foreground font-normal mr-1">{s.destSeq}.</span>{s.destName}
                          </td>
                          <td className="p-2 border-b text-center">{timeLabel(s.departAt)}</td>
                          <td className="p-2 border-b text-center">{timeLabel(s.arriveAt)}</td>
                          <td className="p-2 border-b text-center text-muted-foreground">{durationLabel(s.departAt, s.arriveAt)}</td>
                          <td className="p-2 border-b text-right">
                            {noPrice
                              ? <span className="text-destructive font-medium">Belum diset</span>
                              : <span className="font-medium">{formatPrice(s.price!)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold mb-3">Harga per Titik Asal → Tujuan (Grid)</h4>
              {gridQuery.isLoading ? (
                <div className="text-sm text-muted-foreground text-center p-4">Memuat harga...</div>
              ) : (
                <PriceGrid
                  rows={priceRows}
                  cells={priceCells}
                  onChange={() => {}}
                  disabled
                  disableSameCityCells={!selectedPattern?.allowIntraCityBooking}
                  emptyLabel="Belum ada harga diset untuk rute ini."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
