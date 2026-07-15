import { useState, useMemo } from 'react';
import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { cargoRatesApi, cargoTypesApi, tripPatternsApi, tripsApi, outletsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { AlertTriangle, RefreshCw, Plus, Trash2, Package, Copy } from 'lucide-react';
import { PriceGrid, type MatrixGridRow } from './PriceGrid';
import { format } from 'date-fns';
import type { TripPattern, TripWithDetails, Stop, Outlet, PatternStop, CargoType } from '@/types';

/**
 * Cargo OD-matrix pricing — mirrors PriceRulesManager.tsx (passenger) with
 * one added dimension throughout: every matrix is per (pattern, cargoType),
 * not just per pattern. No "Fallback Global" tab exists here — cargo has no
 * global tier (design decision #4), pricing always needs a pattern.
 */
export default function CargoRatesManager() {
  const [patternId, setPatternId] = useState<string>('');
  const [cargoTypeId, setCargoTypeId] = useState<string>('');
  const [kind, setKind] = useState<'regular' | 'seasonal'>('regular');
  const [selectedSeasonalId, setSelectedSeasonalId] = useState<string>('');

  const { data: patterns = [] } = useQuery({ queryKey: ['/api/trip-patterns'], queryFn: tripPatternsApi.getAll });
  const { data: cargoTypes = [] } = useQuery<CargoType[]>({ queryKey: ['/api/cargo-types'], queryFn: cargoTypesApi.getAll });
  const { data: outlets = [] } = useQuery({ queryKey: ['/api/outlets'], queryFn: outletsApi.getAll });

  const getOriginCityFromStops = (
    stops: Array<PatternStop & { stop: Stop | null }> | undefined,
    patternName: string,
  ): string => {
    const firstCity = stops?.[0]?.stop?.city;
    if (firstCity) return firstCity.toUpperCase();
    const firstSegment = patternName.split(/→|->|–|·/)[0]?.trim();
    return firstSegment || 'Lainnya';
  };

  const patternStopsQueries = useQueries({
    queries: patterns.map((p: TripPattern) => ({
      queryKey: ['/api/trip-patterns', p.id, 'stops'],
      queryFn: () => tripPatternsApi.getStops(p.id),
    })),
  });

  const outletByStopId = useMemo(() => {
    const map = new Map<string, Outlet>();
    outlets.forEach((o: Outlet) => map.set(o.stopId, o));
    return map;
  }, [outlets]);

  const formatOdLabel = (
    stops: Array<PatternStop & { stop: Stop | null }> | undefined,
    fallbackName: string,
  ): string => {
    if (!stops || stops.length < 2) return fallbackName;
    const origin = stops[0].stop;
    const destination = stops[stops.length - 1].stop;
    if (!origin || !destination) return fallbackName;
    const originOutlet = outletByStopId.get(origin.id);
    const destinationOutlet = outletByStopId.get(destination.id);
    const originLabel = `${originOutlet?.name ?? origin.name} (${origin.code})`;
    const destinationLabel = `${destinationOutlet?.name ?? destination.name} (${destination.code})`;
    return `${originLabel} - ${destinationLabel}`;
  };

  const patternOptions = patterns
    .map((p: TripPattern, idx: number) => ({
      value: p.id,
      label: formatOdLabel(patternStopsQueries[idx]?.data, p.name),
      badge: p.code,
      subtitle: p.note || undefined,
      group: getOriginCityFromStops(patternStopsQueries[idx]?.data, p.name),
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));

  const cargoTypeOptions = cargoTypes
    .filter((ct: CargoType) => ct.isActive !== false)
    .map((ct: CargoType) => ({ value: ct.id, label: ct.name, badge: ct.code }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">Tarif Kargo (OD)</h2>
          <p className="text-xs text-muted-foreground">Atur tarif per-kg per pasangan asal-tujuan, per jenis kargo, untuk pola dengan 3+ kota</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div>
          <Label className="text-xs mb-1 block">Pola Perjalanan</Label>
          <SearchableSelect
            value={patternId}
            options={patternOptions}
            placeholder="Pilih pola perjalanan..."
            onChange={(v) => { setPatternId(v); setKind('regular'); setSelectedSeasonalId(''); }}
            data-testid="select-cargo-matrix-pattern"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Jenis Kargo</Label>
          <SearchableSelect
            value={cargoTypeId}
            options={cargoTypeOptions}
            placeholder="Pilih jenis kargo..."
            onChange={(v) => { setCargoTypeId(v); setKind('regular'); setSelectedSeasonalId(''); }}
            data-testid="select-cargo-matrix-type"
          />
        </div>
      </div>

      {patternId && cargoTypeId ? (
        <>
          <CargoPatternRateEditor
            patternId={patternId}
            cargoTypeId={cargoTypeId}
            cargoTypeOptions={cargoTypeOptions}
            kind={kind}
            setKind={setKind}
            selectedSeasonalId={selectedSeasonalId}
            setSelectedSeasonalId={setSelectedSeasonalId}
            allowIntraCityBooking={patterns.find((p: TripPattern) => p.id === patternId)?.allowIntraCityBooking ?? false}
          />
          <CargoTripExceptionEditor patternId={patternId} cargoTypeId={cargoTypeId} cargoTypeOptions={cargoTypeOptions} />
        </>
      ) : (
        <p className="text-xs text-muted-foreground border rounded-lg p-4 text-center bg-muted/20">
          Pilih pola perjalanan dan jenis kargo di atas untuk mengatur tarifnya.
        </p>
      )}
    </div>
  );
}

function CargoPatternRateEditor({
  patternId, cargoTypeId, cargoTypeOptions, kind, setKind, selectedSeasonalId, setSelectedSeasonalId, allowIntraCityBooking,
}: {
  patternId: string;
  cargoTypeId: string;
  cargoTypeOptions: Array<{ value: string; label: string; badge?: string }>;
  kind: 'regular' | 'seasonal';
  setKind: (k: 'regular' | 'seasonal') => void;
  selectedSeasonalId: string;
  setSelectedSeasonalId: (id: string) => void;
  allowIntraCityBooking: boolean;
}) {
  const { toast } = useToast();
  const [localCells, setLocalCells] = useState<Map<string, number> | null>(null);
  const [showSeasonalForm, setShowSeasonalForm] = useState(false);
  const [seasonalName, setSeasonalName] = useState('');
  const [seasonalFrom, setSeasonalFrom] = useState<Date>();
  const [seasonalTo, setSeasonalTo] = useState<Date>();
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
  const [duplicateTargetId, setDuplicateTargetId] = useState('');

  const gridQuery = useQuery({
    queryKey: ['/api/cargo-rates/pattern', patternId, cargoTypeId, kind, selectedSeasonalId],
    queryFn: () => cargoRatesApi.getPatternGrid(patternId, cargoTypeId, kind, selectedSeasonalId || undefined),
  });

  const syncStatusQuery = useQuery({
    queryKey: ['/api/cargo-rates/pattern', patternId, cargoTypeId, 'sync-status'],
    queryFn: () => cargoRatesApi.getSyncStatus(patternId, cargoTypeId),
    enabled: kind === 'regular',
  });

  const seasonalListQuery = useQuery({
    queryKey: ['/api/cargo-rates/pattern', patternId, cargoTypeId, 'seasonal-list'],
    queryFn: () => cargoRatesApi.listSeasonalTemplates(patternId, cargoTypeId),
  });

  const rows: MatrixGridRow[] = gridQuery.data?.rows ?? [];
  const serverCells: Array<{ originStopId: string; destinationStopId: string; pricePerKg: number }> = gridQuery.data?.cells ?? [];
  const cellMap = localCells ?? new Map(serverCells.map(c => [`${c.originStopId}|${c.destinationStopId}`, c.pricePerKg]));

  const handleChange = (originStopId: string, destinationStopId: string, value: number) => {
    const next = new Map(cellMap);
    next.set(`${originStopId}|${destinationStopId}`, value);
    setLocalCells(next);
  };

  const saveMutation = useMutation({
    mutationFn: () => cargoRatesApi.saveCargoRate({
      patternId,
      cargoTypeId,
      kind,
      matrixId: gridQuery.data?.matrixId || undefined,
      cells: [...cellMap.entries()].map(([key, pricePerKg]) => {
        const [originStopId, destinationStopId] = key.split('|');
        return { originStopId, destinationStopId, pricePerKg };
      }),
      expectedUpdatedAt: gridQuery.data?.updatedAt ?? null,
    }),
    onSuccess: () => {
      toast({ title: 'Tarif kargo disimpan' });
      setLocalCells(null);
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates/pattern', patternId, cargoTypeId] });
    },
    onError: (error: any) => {
      if (error?.responseData?.code === 'STALE_CARGO_RATE' || error?.message?.includes('409')) {
        toast({ title: 'Data sudah berubah', description: 'Muat ulang halaman lalu coba simpan lagi.', variant: 'destructive' });
        queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates/pattern', patternId, cargoTypeId] });
      } else {
        toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
      }
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => cargoRatesApi.sync(patternId, cargoTypeId),
    onSuccess: () => {
      toast({ title: 'Berhasil sinkron', description: 'Pasangan OD yang belum diisi ditambahkan dengan tarif 0.' });
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates/pattern', patternId, cargoTypeId] });
    },
    onError: (error: any) => toast({ title: 'Gagal sync', description: error.message, variant: 'destructive' }),
  });

  const createSeasonalMutation = useMutation({
    mutationFn: () => cargoRatesApi.createSeasonalTemplate(patternId, cargoTypeId, {
      name: seasonalName,
      validFrom: seasonalFrom?.toISOString(),
      validTo: seasonalTo?.toISOString(),
      duplicateFromRegular: true,
    }),
    onSuccess: (created) => {
      toast({ title: 'Template musiman dibuat' });
      setShowSeasonalForm(false);
      setSeasonalName(''); setSeasonalFrom(undefined); setSeasonalTo(undefined);
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates/pattern', patternId, cargoTypeId, 'seasonal-list'] });
      setKind('seasonal');
      setSelectedSeasonalId(created.id);
    },
    onError: (error: any) => toast({ title: 'Gagal membuat template', description: error.message, variant: 'destructive' }),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => cargoRatesApi.duplicateToCargoType(gridQuery.data?.matrixId, duplicateTargetId),
    onSuccess: (_created, _vars) => {
      const targetLabel = cargoTypeOptions.find(o => o.value === duplicateTargetId)?.label ?? 'jenis kargo tujuan';
      toast({ title: 'Matrix berhasil diduplikasi', description: `Disalin ke ${targetLabel}. Buka jenis kargo tersebut untuk mengedit deltanya.` });
      setShowDuplicateForm(false);
      setDuplicateTargetId('');
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates/pattern', patternId] });
    },
    onError: (error: any) => toast({ title: 'Gagal duplikasi', description: error.message, variant: 'destructive' }),
  });

  const missingCount = syncStatusQuery.data?.missingPairs?.length ?? 0;
  const seasonalTemplates = seasonalListQuery.data ?? [];
  const duplicateTargetOptions = cargoTypeOptions.filter(o => o.value !== cargoTypeId);
  const currentMatrixLabel = kind === 'regular' ? 'Reguler' : (seasonalTemplates.find((t: any) => t.id === selectedSeasonalId)?.name ?? 'Musiman');

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
        {gridQuery.data?.matrixId && duplicateTargetOptions.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowDuplicateForm(v => !v)} data-testid="button-duplicate-cargo-matrix">
            <Copy className="w-3.5 h-3.5 mr-1" /> Duplikasi ke Jenis Lain
          </Button>
        )}
      </div>

      {showSeasonalForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <Label className="text-xs">Nama Template</Label>
          <Input value={seasonalName} onChange={e => setSeasonalName(e.target.value)} placeholder="Tarif Lebaran 2026" data-testid="input-cargo-seasonal-name" />
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
          <p className="text-[11px] text-muted-foreground">Tarif akan disalin dari tarif reguler jenis kargo ini saat ini, lalu bisa diubah bebas.</p>
          <Button size="sm" onClick={() => createSeasonalMutation.mutate()} disabled={!seasonalName || !seasonalFrom || !seasonalTo || createSeasonalMutation.isPending}>
            Buat Template
          </Button>
        </div>
      )}

      {showDuplicateForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <Label className="text-xs">Salin matrix "{currentMatrixLabel}" ini ke jenis kargo lain</Label>
          <SearchableSelect value={duplicateTargetId} options={duplicateTargetOptions} placeholder="Pilih jenis kargo tujuan..." onChange={setDuplicateTargetId} />
          <p className="text-[11px] text-muted-foreground">Seluruh sel tarif akan MENIMPA matrix yang sudah ada di jenis kargo tujuan (kalau ada). Edit delta setelah disalin.</p>
          <Button size="sm" onClick={() => duplicateMutation.mutate()} disabled={!duplicateTargetId || duplicateMutation.isPending} data-testid="button-confirm-duplicate-cargo-matrix">
            Duplikasi
          </Button>
        </div>
      )}

      {kind === 'regular' && missingCount > 0 && (
        <Alert variant="default" className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between gap-2 text-amber-800">
            <span>Tarif belum sinkron: ada {missingCount} pasangan OD belum diisi.</span>
            <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {gridQuery.isLoading ? (
        <div className="text-xs text-muted-foreground p-4">Memuat matrix...</div>
      ) : gridQuery.isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Gagal memuat data tarif: {(gridQuery.error as Error)?.message || 'Terjadi kesalahan tak terduga.'}
            {' '}Kemungkinan skema database belum di-migrate untuk sistem tarif kargo baru — jalankan{' '}
            <code className="bg-black/10 px-1 rounded">npm run db:push</code> di server, lalu muat ulang halaman ini.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!allowIntraCityBooking && (
            <p className="text-[11px] text-muted-foreground -mt-1">
              Halte yang tidak punya pasangan lintas-kota disembunyikan dari tabel ini karena pola belum
              mengizinkan rute pendek dalam kota (lihat toggle di Pola Perjalanan).
            </p>
          )}
          <PriceGrid
            rows={rows}
            cells={[...cellMap.entries()].map(([key, pricePerKg]) => {
              const [originStopId, destinationStopId] = key.split('|');
              return { originStopId, destinationStopId, value: pricePerKg };
            })}
            onChange={handleChange}
            disableSameCityCells={!allowIntraCityBooking}
          />
        </>
      )}

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !localCells} data-testid="button-save-cargo-matrix">
        {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Tarif'}
      </Button>
    </div>
  );
}

function CargoTripExceptionEditor({ patternId, cargoTypeId, cargoTypeOptions }: {
  patternId: string;
  cargoTypeId: string;
  cargoTypeOptions: Array<{ value: string; label: string; badge?: string }>;
}) {
  const { toast } = useToast();
  const [tripId, setTripId] = useState('');
  const [originStopId, setOriginStopId] = useState('');
  const [destinationStopId, setDestinationStopId] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');

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
    queryKey: ['/api/cargo-rates/trip-exceptions', tripId],
    queryFn: () => cargoRatesApi.listTripExceptions(tripId),
    enabled: !!tripId,
  });
  // Satu trip bisa punya exception untuk beberapa jenis kargo sekaligus —
  // hanya tampilkan yang relevan untuk cargoType yang sedang dipilih di atas.
  const exceptionsForType = (exceptionsQuery.data ?? []).filter((ex: any) => ex.cargoTypeId === cargoTypeId);

  const upsertMutation = useMutation({
    mutationFn: () => cargoRatesApi.upsertTripException({ tripId, cargoTypeId, originStopId, destinationStopId, pricePerKg: Number(pricePerKg) }),
    onSuccess: () => {
      toast({ title: 'Pengecualian tarif kargo disimpan' });
      setOriginStopId(''); setDestinationStopId(''); setPricePerKg('');
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates/trip-exceptions', tripId] });
    },
    onError: (error: any) => toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cargoRatesApi.deleteTripException(id),
    onSuccess: () => {
      toast({ title: 'Pengecualian dihapus' });
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates/trip-exceptions', tripId] });
    },
  });

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <h3 className="text-sm font-semibold">Pengecualian Tarif Kargo per Trip</h3>
      <p className="text-xs text-muted-foreground">
        Override tarif/kg untuk SATU trip spesifik, khusus jenis kargo yang sedang dipilih ({cargoTypeOptions.find(o => o.value === cargoTypeId)?.label ?? '-'}), tanpa mengubah matrix pola.
      </p>

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
              <Label className="text-xs mb-1 block">Tarif/kg</Label>
              <Input type="number" value={pricePerKg} onChange={e => setPricePerKg(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button size="sm" onClick={() => upsertMutation.mutate()} disabled={!originStopId || !destinationStopId || !pricePerKg || upsertMutation.isPending}>
            Simpan Pengecualian
          </Button>

          <div className="space-y-1 pt-2">
            {exceptionsForType.map((ex: any) => (
              <div key={ex.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                <span>
                  {stopOptions.find(s => s.value === ex.originStopId)?.label} → {stopOptions.find(s => s.value === ex.destinationStopId)?.label}:{' '}
                  <strong>Rp {Number(ex.pricePerKg).toLocaleString('id-ID')}/kg</strong>
                </span>
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
