import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { passengerPriceMatrixApi, tripPatternsApi, tripsApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { AlertTriangle, RefreshCw, Plus, Trash2, DollarSign } from 'lucide-react';
import { PriceMatrixGrid, type MatrixGridRow } from './PriceMatrixGrid';
import { format } from 'date-fns';
import type { TripPattern, TripWithDetails, Stop } from '@/types';

export default function PassengerPriceMatrixManager() {
  const [patternId, setPatternId] = useState<string>('');
  const [kind, setKind] = useState<'regular' | 'seasonal'>('regular');
  const [selectedSeasonalId, setSelectedSeasonalId] = useState<string>('');

  const { data: patterns = [] } = useQuery({ queryKey: ['/api/trip-patterns'], queryFn: tripPatternsApi.getAll });

  // Nama pola konsisten berformat "KotaAsal → KotaTujuan · via ..." atau
  // "KotaAsal - KotaTujuan - ...". Ambil token pertama sebagai kota asal
  // untuk mengelompokkan dropdown supaya tidak jadi daftar panjang datar
  // yang susah dibaca saat pola-nya banyak (mis. beberapa varian rute
  // Bandung<->Jakarta dengan "via" yang berbeda-beda).
  const getOriginCity = (name: string): string => {
    const firstSegment = name.split(/→|->|-|–|·/)[0]?.trim();
    return firstSegment || 'Lainnya';
  };

  const patternOptions = patterns
    .map((p: TripPattern) => ({
      value: p.id,
      label: p.name,
      badge: p.code,
      subtitle: p.note || undefined,
      group: getOriginCity(p.name),
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">Harga Penumpang (OD-Matrix)</h2>
          <p className="text-xs text-muted-foreground">Atur harga per pasangan asal-tujuan untuk pola dengan 3+ kota</p>
        </div>
      </div>

      <Tabs defaultValue="pattern">
        <TabsList>
          <TabsTrigger value="pattern" data-testid="tab-pattern-matrix">Matrix Pola</TabsTrigger>
          <TabsTrigger value="global" data-testid="tab-global-matrix">Fallback Global</TabsTrigger>
        </TabsList>

        <TabsContent value="pattern" className="space-y-4 pt-3">
          <div className="max-w-md">
            <Label className="text-xs mb-1 block">Pola Perjalanan</Label>
            <SearchableSelect
              value={patternId}
              options={patternOptions}
              placeholder="Pilih pola perjalanan..."
              onChange={(v) => { setPatternId(v); setKind('regular'); setSelectedSeasonalId(''); }}
              data-testid="select-matrix-pattern"
            />
          </div>

          {patternId && (
            <PatternMatrixEditor
              patternId={patternId}
              kind={kind}
              setKind={setKind}
              selectedSeasonalId={selectedSeasonalId}
              setSelectedSeasonalId={setSelectedSeasonalId}
            />
          )}

          {patternId && <TripExceptionEditor patternId={patternId} />}
        </TabsContent>

        <TabsContent value="global" className="space-y-4 pt-3">
          <GlobalMatrixEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PatternMatrixEditor({
  patternId, kind, setKind, selectedSeasonalId, setSelectedSeasonalId,
}: {
  patternId: string;
  kind: 'regular' | 'seasonal';
  setKind: (k: 'regular' | 'seasonal') => void;
  selectedSeasonalId: string;
  setSelectedSeasonalId: (id: string) => void;
}) {
  const { toast } = useToast();
  const [localCells, setLocalCells] = useState<Map<string, number> | null>(null);
  const [showSeasonalForm, setShowSeasonalForm] = useState(false);
  const [seasonalName, setSeasonalName] = useState('');
  const [seasonalFrom, setSeasonalFrom] = useState<Date>();
  const [seasonalTo, setSeasonalTo] = useState<Date>();

  const gridQuery = useQuery({
    queryKey: ['/api/pricing/matrix/pattern', patternId, kind, selectedSeasonalId],
    queryFn: () => passengerPriceMatrixApi.getPatternGrid(patternId, kind, selectedSeasonalId || undefined),
  });

  const syncStatusQuery = useQuery({
    queryKey: ['/api/pricing/matrix/pattern', patternId, 'sync-status'],
    queryFn: () => passengerPriceMatrixApi.getSyncStatus(patternId),
    enabled: kind === 'regular',
  });

  const seasonalListQuery = useQuery({
    queryKey: ['/api/pricing/matrix/pattern', patternId, 'seasonal-list'],
    queryFn: () => passengerPriceMatrixApi.listSeasonalTemplates(patternId),
  });

  const rows: MatrixGridRow[] = gridQuery.data?.rows ?? [];
  const serverCells: Array<{ originStopId: string; destinationStopId: string; price: number }> = gridQuery.data?.cells ?? [];
  const cellMap = localCells ?? new Map(serverCells.map(c => [`${c.originStopId}|${c.destinationStopId}`, c.price]));

  const handleChange = (originStopId: string, destinationStopId: string, value: number) => {
    const next = new Map(cellMap);
    next.set(`${originStopId}|${destinationStopId}`, value);
    setLocalCells(next);
  };

  const saveMutation = useMutation({
    mutationFn: () => passengerPriceMatrixApi.saveMatrix({
      scope: 'pattern',
      patternId,
      kind,
      matrixId: gridQuery.data?.matrixId || undefined,
      cells: [...cellMap.entries()].map(([key, price]) => {
        const [originStopId, destinationStopId] = key.split('|');
        return { originStopId, destinationStopId, price };
      }),
      expectedUpdatedAt: gridQuery.data?.updatedAt ?? null,
    }),
    onSuccess: () => {
      toast({ title: 'Matrix harga disimpan' });
      setLocalCells(null);
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/matrix/pattern', patternId] });
    },
    onError: (error: any) => {
      if (error?.responseData?.code === 'STALE_MATRIX' || error?.message?.includes('409')) {
        toast({ title: 'Data sudah berubah', description: 'Muat ulang halaman lalu coba simpan lagi.', variant: 'destructive' });
        queryClient.invalidateQueries({ queryKey: ['/api/pricing/matrix/pattern', patternId] });
      } else {
        toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
      }
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => passengerPriceMatrixApi.sync(patternId),
    onSuccess: () => {
      toast({ title: 'Berhasil sinkron', description: 'Pasangan OD yang belum diisi ditambahkan dengan harga 0.' });
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/matrix/pattern', patternId] });
    },
    onError: (error: any) => toast({ title: 'Gagal sync', description: error.message, variant: 'destructive' }),
  });

  const createSeasonalMutation = useMutation({
    mutationFn: () => passengerPriceMatrixApi.createSeasonalTemplate(patternId, {
      name: seasonalName,
      validFrom: seasonalFrom?.toISOString(),
      validTo: seasonalTo?.toISOString(),
      duplicateFromRegular: true,
    }),
    onSuccess: (created) => {
      toast({ title: 'Template musiman dibuat' });
      setShowSeasonalForm(false);
      setSeasonalName(''); setSeasonalFrom(undefined); setSeasonalTo(undefined);
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/matrix/pattern', patternId, 'seasonal-list'] });
      setKind('seasonal');
      setSelectedSeasonalId(created.id);
    },
    onError: (error: any) => toast({ title: 'Gagal membuat template', description: error.message, variant: 'destructive' }),
  });

  const missingCount = syncStatusQuery.data?.missingPairs?.length ?? 0;
  const seasonalTemplates = seasonalListQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={kind === 'regular' ? 'default' : 'outline'} onClick={() => { setKind('regular'); setSelectedSeasonalId(''); setLocalCells(null); }}>
          Tarif Reguler
        </Button>
        {seasonalTemplates.map((t: any) => (
          <Button
            key={t.id}
            size="sm"
            variant={kind === 'seasonal' && selectedSeasonalId === t.id ? 'default' : 'outline'}
            onClick={() => { setKind('seasonal'); setSelectedSeasonalId(t.id); setLocalCells(null); }}
          >
            {t.name} {!t.isActive && <Badge variant="secondary" className="ml-1 text-[9px]">nonaktif</Badge>}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setShowSeasonalForm(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Template Musiman
        </Button>
      </div>

      {showSeasonalForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <Label className="text-xs">Nama Template</Label>
          <Input value={seasonalName} onChange={e => setSeasonalName(e.target.value)} placeholder="Tarif Lebaran 2026" data-testid="input-seasonal-name" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Berlaku Dari</Label>
              <DatePicker date={seasonalFrom} onDateChange={setSeasonalFrom} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Berlaku Sampai</Label>
              <DatePicker date={seasonalTo} onDateChange={setSeasonalTo} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Harga akan disalin dari tarif reguler saat ini, lalu bisa diubah bebas.</p>
          <Button size="sm" onClick={() => createSeasonalMutation.mutate()} disabled={!seasonalName || !seasonalFrom || !seasonalTo || createSeasonalMutation.isPending}>
            Buat Template
          </Button>
        </div>
      )}

      {kind === 'regular' && missingCount > 0 && (
        <Alert variant="default" className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between gap-2 text-amber-800">
            <span>Pricing belum sinkron: ada {missingCount} pasangan OD belum diisi.</span>
            <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {gridQuery.isLoading ? (
        <div className="text-xs text-muted-foreground p-4">Memuat matrix...</div>
      ) : (
        <PriceMatrixGrid
          rows={rows}
          cells={[...cellMap.entries()].map(([key, price]) => {
            const [originStopId, destinationStopId] = key.split('|');
            return { originStopId, destinationStopId, value: price };
          })}
          onChange={handleChange}
        />
      )}

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !localCells} data-testid="button-save-matrix">
        {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Matrix'}
      </Button>
    </div>
  );
}

function GlobalMatrixEditor() {
  const { toast } = useToast();
  const [localRows, setLocalRows] = useState<Array<{ originStopId: string; destinationStopId: string; price: number }> | null>(null);

  const { data: stops = [] } = useQuery({ queryKey: ['/api/stops'], queryFn: stopsApi.getAll });
  const globalQuery = useQuery({ queryKey: ['/api/pricing/matrix/global'], queryFn: passengerPriceMatrixApi.getGlobalList });

  const stopOptions = stops.map((s: Stop) => ({ value: s.id, label: `${s.name} (${s.code})` }));

  const rows: Array<{ originStopId: string; destinationStopId: string; price: number }> = localRows ?? globalQuery.data?.cells ?? [];

  const saveMutation = useMutation({
    mutationFn: () => passengerPriceMatrixApi.saveMatrix({
      scope: 'global',
      kind: 'regular',
      matrixId: globalQuery.data?.matrixId || undefined,
      cells: rows,
      expectedUpdatedAt: globalQuery.data?.updatedAt ?? null,
    }),
    onSuccess: () => {
      toast({ title: 'Fallback global disimpan' });
      setLocalRows(null);
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/matrix/global'] });
    },
    onError: (error: any) => toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Fallback terakhir kalau pola tidak punya matrix sendiri untuk pasangan OD tertentu. Biasanya jarang dipakai — isi hanya jika benar-benar perlu default lintas-pola.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1"><SearchableSelect value={r.originStopId} options={stopOptions} placeholder="Asal" onChange={(v) => {
              const next = [...rows]; next[i] = { ...next[i], originStopId: v }; setLocalRows(next);
            }} /></div>
            <div className="flex-1"><SearchableSelect value={r.destinationStopId} options={stopOptions} placeholder="Tujuan" onChange={(v) => {
              const next = [...rows]; next[i] = { ...next[i], destinationStopId: v }; setLocalRows(next);
            }} /></div>
            <Input type="number" className="w-28" value={r.price || ''} placeholder="0" onChange={(e) => {
              const next = [...rows]; next[i] = { ...next[i], price: Number(e.target.value) || 0 }; setLocalRows(next);
            }} />
            <Button size="icon" variant="ghost" onClick={() => setLocalRows(rows.filter((_, idx) => idx !== i))}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setLocalRows([...rows, { originStopId: '', destinationStopId: '', price: 0 }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Pasangan
        </Button>
      </div>
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !localRows}>
        {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Fallback Global'}
      </Button>
    </div>
  );
}

function TripExceptionEditor({ patternId }: { patternId: string }) {
  const { toast } = useToast();
  const [tripId, setTripId] = useState('');
  const [originStopId, setOriginStopId] = useState('');
  const [destinationStopId, setDestinationStopId] = useState('');
  const [price, setPrice] = useState('');

  const { data: allTrips = [] } = useQuery({ queryKey: ['/api/trips'], queryFn: () => tripsApi.getAll() });
  const patternTrips = useMemo(() => allTrips.filter((t: TripWithDetails) => t.patternId === patternId), [allTrips, patternId]);
  const tripOptions = patternTrips.map((t: TripWithDetails) => ({
    value: t.id,
    label: `${format(new Date(t.serviceDate as unknown as string), 'dd/MM/yyyy')} — ${(t as any).vehicleCode || t.id.slice(0, 8)}`,
  }));

  const { data: patternStopsForPattern = [] } = useQuery({
    queryKey: ['/api/trip-patterns', patternId, 'stops'],
    queryFn: async () => (await fetch(`/api/trip-patterns/${patternId}/stops`)).json(),
    enabled: !!patternId,
  });
  const stopOptions = (patternStopsForPattern as Array<{ stopId: string; stopSequence: number; stop?: { name?: string } | null }>)
    .sort((a, b) => a.stopSequence - b.stopSequence)
    .map(ps => ({ value: ps.stopId, label: ps.stop?.name ?? ps.stopId }));

  const exceptionsQuery = useQuery({
    queryKey: ['/api/pricing/trip-exceptions', tripId],
    queryFn: () => passengerPriceMatrixApi.listTripExceptions(tripId),
    enabled: !!tripId,
  });

  const upsertMutation = useMutation({
    mutationFn: () => passengerPriceMatrixApi.upsertTripException({ tripId, originStopId, destinationStopId, price: Number(price) }),
    onSuccess: () => {
      toast({ title: 'Pengecualian harga trip disimpan' });
      setOriginStopId(''); setDestinationStopId(''); setPrice('');
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/trip-exceptions', tripId] });
    },
    onError: (error: any) => toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => passengerPriceMatrixApi.deleteTripException(id),
    onSuccess: () => {
      toast({ title: 'Pengecualian dihapus' });
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/trip-exceptions', tripId] });
    },
  });

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <h3 className="text-sm font-semibold">Pengecualian Harga per Trip</h3>
      <p className="text-xs text-muted-foreground">Override harga untuk SATU trip spesifik (mis. promo satu hari), tanpa mengubah matrix pola.</p>

      <div>
        <Label className="text-xs mb-1 block">Trip</Label>
        <SearchableSelect value={tripId} options={tripOptions} placeholder="Pilih trip..." onChange={setTripId} />
      </div>

      {tripId && (
        <>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div>
              <Label className="text-xs mb-1 block">Asal</Label>
              <SearchableSelect value={originStopId} options={stopOptions} placeholder="Asal" onChange={setOriginStopId} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Tujuan</Label>
              <SearchableSelect value={destinationStopId} options={stopOptions} placeholder="Tujuan" onChange={setDestinationStopId} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Harga</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button size="sm" onClick={() => upsertMutation.mutate()} disabled={!originStopId || !destinationStopId || !price || upsertMutation.isPending}>
            Simpan Pengecualian
          </Button>

          <div className="space-y-1 pt-2">
            {(exceptionsQuery.data ?? []).map((ex: any) => (
              <div key={ex.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                <span>{stopOptions.find(s => s.value === ex.originStopId)?.label} → {stopOptions.find(s => s.value === ex.destinationStopId)?.label}: <strong>Rp {Number(ex.price).toLocaleString('id-ID')}</strong></span>
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(ex.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
