import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { tripsApi, tripPatternsApi, driversApi, spjApi } from '@/lib/api';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import ManifestDialog from '@/components/manifest/ManifestDialog';
import {
  CalendarDays, ChevronLeft, ChevronRight, Search, Bus, Clock, Users, MapPin,
  User, FileText, ClipboardList, AlertCircle, CheckCircle
} from 'lucide-react';
import type { TripWithDetails, TripPattern, Driver, SpjWithDetails } from '@/types';

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function TripStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: 'Terjadwal', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    canceled:  { label: 'Batal',     cls: 'bg-red-100 text-red-700 border-red-200' },
    closed:    { label: 'Ditutup',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>{s.label}</span>;
}

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [manifestTripId, setManifestTripId] = useState<string | null>(null);
  const [driverDialogTrip, setDriverDialogTrip] = useState<TripWithDetails | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const { toast } = useToast();

  const { data: trips = [], isLoading } = useQuery<TripWithDetails[]>({
    queryKey: ['/api/trips', selectedDate],
    queryFn: () => tripsApi.getAll(selectedDate),
  });

  const { data: patterns = [] } = useQuery<TripPattern[]>({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
  });

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
    queryFn: driversApi.getAll,
  });

  const { data: allSpj = [] } = useQuery<SpjWithDetails[]>({
    queryKey: ['/api/spj'],
    queryFn: spjApi.getAll,
  });

  const spjByTripId = new Map(allSpj.map(s => [s.tripId, s]));

  const getPatternName = (patternId: string) => patterns.find(p => p.id === patternId)?.name ?? '—';
  const getPatternCode = (patternId: string) => patterns.find(p => p.id === patternId)?.code ?? '';

  const filtered = trips.filter(t => {
    const name = getPatternName(t.patternId).toLowerCase();
    const code = getPatternCode(t.patternId).toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || code.includes(q)
      || ((t as any).vehiclePlate || '').toLowerCase().includes(q)
      || ((t as any).driverName || '').toLowerCase().includes(q);
  });

  const tripsNoDriver = trips.filter(t => !t.driverId);
  const tripsNoSpj = trips.filter(t => !spjByTripId.has(t.id));

  const assignDriverMutation = useMutation({
    mutationFn: async ({ tripId, driverId }: { tripId: string; driverId: string }) => {
      const res = await apiRequest('PUT', `/api/trips/${tripId}`, { driverId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setDriverDialogTrip(null);
      setSelectedDriverId('');
      toast({ title: 'Driver berhasil ditugaskan' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menugaskan driver', description: err?.message, variant: 'destructive' });
    },
  });

  const createSpjMutation = useMutation({
    mutationFn: (tripId: string) => spjApi.create({ tripId }),
    onSuccess: (spj: SpjWithDetails) => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj'] });
      toast({ title: 'SPJ berhasil dibuat', description: `Nomor: ${spj.spjNumber}` });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal membuat SPJ', description: err?.message, variant: 'destructive' });
    },
  });

  const openDriverDialog = (trip: TripWithDetails) => {
    setDriverDialogTrip(trip);
    setSelectedDriverId(trip.driverId || '');
  };

  const prevDate = () => setSelectedDate(d => addDays(d, -1));
  const nextDate = () => setSelectedDate(d => addDays(d, 1));
  const goToday = () => setSelectedDate(todayStr());

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold" data-testid="page-title-schedule">Jadwal Harian</h1>
        </div>
        <p className="text-sm text-muted-foreground">Kelola operasional harian — assign driver, buka manifest, dan buat SPJ.</p>
      </div>

      <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={prevDate} data-testid="btn-prev-date">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col items-center min-w-[180px]">
              <span className="text-sm font-semibold">{formatDisplayDate(selectedDate)}</span>
            </div>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={nextDate} data-testid="btn-next-date">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="ml-2 h-8 text-xs" onClick={goToday} data-testid="btn-today">
              Hari Ini
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-8 w-36 text-xs"
              data-testid="input-date-picker"
            />
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari rute, kendaraan, driver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
              data-testid="input-search-schedule"
            />
          </div>
        </div>

        {trips.length > 0 && (
          <div className="flex gap-3 mt-3 flex-wrap">
            <Badge variant="outline" className="text-xs" data-testid="badge-total-trips">
              {trips.length} trip
            </Badge>
            {tripsNoDriver.length > 0 && (
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50" data-testid="badge-no-driver">
                <AlertCircle className="w-3 h-3 mr-1" />
                {tripsNoDriver.length} belum ada driver
              </Badge>
            )}
            {tripsNoSpj.length > 0 && (
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50" data-testid="badge-no-spj">
                <ClipboardList className="w-3 h-3 mr-1" />
                {tripsNoSpj.length} belum ada SPJ
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Tidak ada trip pada tanggal ini"
            description="Coba pilih tanggal lain atau tambahkan trip di Master Data."
          />
        ) : (
          <div className="space-y-3" data-testid="schedule-trip-list">
            {filtered.map(trip => {
              const patternName = getPatternName(trip.patternId);
              const patternCode = getPatternCode(trip.patternId);
              const departTime = (trip as any).originDepartHHMM || null;
              const driverName = (trip as any).driverName || null;
              const vehiclePlate = (trip as any).vehiclePlate || null;
              const vehicleCode = (trip as any).vehicleCode || null;
              const hasDriver = !!trip.driverId;
              const existingSpj = spjByTripId.get(trip.id);

              return (
                <Card
                  key={trip.id}
                  className="border hover:shadow-sm transition-shadow"
                  data-testid={`schedule-trip-${trip.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">{patternName}</span>
                            {patternCode && (
                              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{patternCode}</span>
                            )}
                            <TripStatusBadge status={trip.status ?? 'scheduled'} />
                          </div>

                          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                            {departTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span className="font-semibold tabular-nums text-foreground">{departTime}</span>
                              </span>
                            )}
                            {vehicleCode && (
                              <span className="flex items-center gap-1">
                                <Bus className="w-3 h-3" />
                                {vehicleCode} · {vehiclePlate}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {trip.capacity} kursi
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-3 flex-wrap">
                            {hasDriver ? (
                              <button
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
                                onClick={() => openDriverDialog(trip)}
                                data-testid={`btn-driver-${trip.id}`}
                              >
                                <User className="w-3 h-3" />
                                <span className="font-medium">{driverName}</span>
                              </button>
                            ) : (
                              <button
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                                onClick={() => openDriverDialog(trip)}
                                data-testid={`btn-driver-${trip.id}`}
                              >
                                <AlertCircle className="w-3 h-3" />
                                <span className="font-medium">Assign Driver</span>
                              </button>
                            )}

                            {existingSpj ? (
                              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                <CheckCircle className="w-3 h-3" />
                                SPJ: {existingSpj.spjNumber}
                              </span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => createSpjMutation.mutate(trip.id)}
                                disabled={createSpjMutation.isPending || !hasDriver}
                                data-testid={`btn-create-spj-${trip.id}`}
                              >
                                <ClipboardList className="w-3 h-3" />
                                Buat SPJ
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="shrink-0 gap-1.5 self-start"
                        onClick={() => setManifestTripId(trip.id)}
                        data-testid={`btn-manifest-${trip.id}`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Manifest
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ManifestDialog
        tripId={manifestTripId}
        open={!!manifestTripId}
        onOpenChange={(open) => { if (!open) setManifestTripId(null); }}
      />

      <Dialog open={!!driverDialogTrip} onOpenChange={(open) => { if (!open) { setDriverDialogTrip(null); setSelectedDriverId(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Assign Driver
            </DialogTitle>
            <DialogDescription>
              Tugaskan driver ke trip <strong>{driverDialogTrip ? getPatternName(driverDialogTrip.patternId) : ''}</strong> ({selectedDate}).
            </DialogDescription>
          </DialogHeader>

          {driverDialogTrip && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{getPatternName(driverDialogTrip.patternId)}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground pl-5">
                  {(driverDialogTrip as any).originDepartHHMM && (
                    <span><Clock className="w-3 h-3 inline mr-1" />{(driverDialogTrip as any).originDepartHHMM}</span>
                  )}
                  {(driverDialogTrip as any).vehiclePlate && (
                    <span><Bus className="w-3 h-3 inline mr-1" />{(driverDialogTrip as any).vehiclePlate}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pilih Driver</label>
                {drivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg border border-dashed text-center">
                    Belum ada driver. Tambahkan di Master Data → Driver.
                  </p>
                ) : (
                  <SearchableSelect
                    value={selectedDriverId}
                    onValueChange={setSelectedDriverId}
                    options={drivers.map(d => ({
                      value: d.id,
                      label: `${d.name} (${d.code})`,
                      searchText: `${d.name} ${d.code} ${d.phone || ''}`
                    }))}
                    placeholder="Cari driver..."
                    emptyText="Driver tidak ditemukan"
                    data-testid="select-driver-schedule"
                  />
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDriverDialogTrip(null); setSelectedDriverId(''); }}>Batal</Button>
            {driverDialogTrip?.driverId && (
              <Button
                variant="ghost"
                className="text-amber-700"
                onClick={() => {
                  assignDriverMutation.mutate({ tripId: driverDialogTrip!.id, driverId: null as any });
                }}
                disabled={assignDriverMutation.isPending}
              >
                Hapus Driver
              </Button>
            )}
            <Button
              onClick={() => {
                if (driverDialogTrip && selectedDriverId)
                  assignDriverMutation.mutate({ tripId: driverDialogTrip.id, driverId: selectedDriverId });
              }}
              disabled={!selectedDriverId || assignDriverMutation.isPending}
              data-testid="btn-save-driver"
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
