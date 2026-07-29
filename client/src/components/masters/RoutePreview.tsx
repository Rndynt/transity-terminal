import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle2, XCircle, Route as RouteIcon } from 'lucide-react';
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
              <h4 className="text-sm font-semibold mb-3">Harga per Titik Asal → Tujuan</h4>
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
