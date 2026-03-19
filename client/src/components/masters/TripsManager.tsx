import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RowActionsMenu } from './RowActionsMenu';
import { useToast } from '@/hooks/use-toast';
import { tripsApi, tripPatternsApi, vehiclesApi, layoutsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import {
  Plus, Pencil, Trash2, Clock, Route, Grid3X3, CalendarDays, FileText,
  Search, X, Filter, Bus, MapPin, LayoutGrid, ChevronDown
} from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterFormDialog from './MasterFormDialog';
import type { Trip, TripPattern, Vehicle, Layout } from '@/types';
import TripScheduleEditor from './TripScheduleEditor';
import ManifestDialog from '@/components/manifest/ManifestDialog';

interface TripFormData {
  patternId: string;
  serviceDate: string;
  vehicleId: string;
  layoutId: string;
  capacity: string;
  status: 'scheduled' | 'canceled' | 'closed';
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'scheduled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          Terjadwal
        </span>
      );
    case 'canceled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          Dibatalkan
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
          Ditutup
        </span>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ActiveFilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      {label}
      <button onClick={onRemove} className="hover:text-primary/60 transition-colors ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function TripsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSchedulingDialogOpen, setIsSchedulingDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [schedulingTrip, setSchedulingTrip] = useState<Trip | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [manifestTripId, setManifestTripId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TripFormData>({
    patternId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    vehicleId: '',
    layoutId: '',
    capacity: '',
    status: 'scheduled'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPatternId, setFilterPatternId] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const DATE_PRESETS = [
    { key: 'today',      label: 'Hari Ini' },
    { key: 'tomorrow',   label: 'Besok' },
    { key: 'this_week',  label: 'Minggu Ini' },
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'next_month', label: 'Bulan Depan' },
    { key: 'custom',     label: 'Kustom' },
  ] as const;

  const applyDatePreset = (preset: string) => {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setDatePreset(preset);
    if (preset === 'today') {
      setFilterDateFrom(fmt(today));
      setFilterDateTo(fmt(today));
    } else if (preset === 'tomorrow') {
      const d = new Date(today); d.setDate(d.getDate() + 1);
      setFilterDateFrom(fmt(d));
      setFilterDateTo(fmt(d));
    } else if (preset === 'this_week') {
      const day = today.getDay(); // 0=Sun
      const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterDateFrom(fmt(mon));
      setFilterDateTo(fmt(sun));
    } else if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFilterDateFrom(fmt(start));
      setFilterDateTo(fmt(end));
    } else if (preset === 'next_month') {
      const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const end   = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      setFilterDateFrom(fmt(start));
      setFilterDateTo(fmt(end));
    } else if (preset === 'custom') {
      setFilterDateFrom('');
      setFilterDateTo('');
    }
  };

  const { toast } = useToast();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['/api/trips'],
    queryFn: () => tripsApi.getAll()
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: vehiclesApi.getAll
  });

  const { data: layouts = [] } = useQuery({
    queryKey: ['/api/layouts'],
    queryFn: layoutsApi.getAll
  });

  const patternOptions = patterns.filter(p => p.active).map(p => ({
    value: p.id,
    label: p.name,
    badge: p.code,
    subtitle: p.vehicleClass || undefined
  }));

  const vehicleOptions = vehicles.map(v => ({
    value: v.id,
    label: `${v.code} — ${v.plate}`,
    badge: `${v.capacity} kursi`
  }));

  const createMutation = useMutation({
    mutationFn: tripsApi.create,
    onSuccess: (createdTrip) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Berhasil', description: 'Trip berhasil dibuat. Atur jadwal keberangkatan sekarang.' });
      setSchedulingTrip(createdTrip);
      setIsSchedulingDialogOpen(true);
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal membuat trip', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tripsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingTrip(null);
      toast({ title: 'Berhasil', description: 'Trip berhasil diperbarui' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal memperbarui trip', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: tripsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Trip berhasil dihapus' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghapus trip', variant: 'destructive' });
    }
  });

  const deriveLegsMutation = useMutation({
    mutationFn: tripsApi.deriveLegs,
    onSuccess: () => { toast({ title: 'Berhasil', description: 'Leg trip berhasil diturunkan' }); },
    onError: (error) => { toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menurunkan leg', variant: 'destructive' }); }
  });

  const precomputeSeatInventoryMutation = useMutation({
    mutationFn: tripsApi.precomputeSeatInventory,
    onSuccess: () => { toast({ title: 'Berhasil', description: 'Inventori kursi berhasil dihitung ulang' }); },
    onError: (error) => { toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghitung inventori', variant: 'destructive' }); }
  });

  const resetForm = () => {
    setFormData({ patternId: '', serviceDate: new Date().toISOString().split('T')[0], vehicleId: '', layoutId: '', capacity: '', status: 'scheduled' });
  };

  const handleCreate = () => { setEditingTrip(null); resetForm(); setIsDialogOpen(true); };

  const handleEdit = (trip: Trip) => {
    setEditingTrip(trip);
    setFormData({ patternId: trip.patternId, serviceDate: trip.serviceDate, vehicleId: trip.vehicleId, layoutId: trip.layoutId || '', capacity: trip.capacity.toString(), status: trip.status || 'scheduled' });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData, capacity: parseInt(formData.capacity, 10), channelFlags: { CSO: true, WEB: false, APP: false, OTA: false } };
    if (editingTrip) {
      updateMutation.mutate({ id: editingTrip.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };
  const handleDeriveLegs = (tripId: string) => deriveLegsMutation.mutate(tripId);
  const handlePrecomputeInventory = (tripId: string) => precomputeSeatInventoryMutation.mutate(tripId);
  const handleScheduling = (trip: Trip) => { setSchedulingTrip(trip); setIsSchedulingDialogOpen(true); };

  const getPattern = (patternId: string) => patterns.find(p => p.id === patternId);
  const getVehicle = (vehicleId: string) => vehicles.find(v => v.id === vehicleId);
  const getLayout = (layoutId: string | null) => layoutId ? layouts.find(l => l.id === layoutId) : null;

  const getDepartureTime = (trip: any): string | null => {
    if (trip.originDepartHHMM) return trip.originDepartHHMM;
    if (trip.scheduleTime) {
      return new Date(trip.scheduleTime).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
      });
    }
    return null;
  };

  const formatServiceDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const activeFilterCount = [
    filterStatus !== 'all',
    filterPatternId !== 'all',
    filterDateFrom !== '' || filterDateTo !== '',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterStatus('all');
    setFilterPatternId('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setDatePreset('');
    setSearchQuery('');
  };

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      const pattern = getPattern(trip.patternId);
      const vehicle = getVehicle(trip.vehicleId);

      if (filterStatus !== 'all' && (trip.status || 'scheduled') !== filterStatus) return false;
      if (filterPatternId !== 'all' && trip.patternId !== filterPatternId) return false;
      if (filterDateFrom && trip.serviceDate < filterDateFrom) return false;
      if (filterDateTo && trip.serviceDate > filterDateTo) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const patternName = pattern?.name?.toLowerCase() || '';
        const patternCode = pattern?.code?.toLowerCase() || '';
        const vehiclePlate = vehicle?.plate?.toLowerCase() || '';
        const vehicleCode = vehicle?.code?.toLowerCase() || '';
        if (!patternName.includes(q) && !patternCode.includes(q) && !vehiclePlate.includes(q) && !vehicleCode.includes(q) && !trip.serviceDate.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (a.serviceDate !== b.serviceDate) return b.serviceDate.localeCompare(a.serviceDate);
      const aTime = getDepartureTime(a) || '';
      const bTime = getDepartureTime(b) || '';
      return aTime.localeCompare(bTime);
    });
  }, [trips, filterStatus, filterPatternId, filterDateFrom, filterDateTo, searchQuery, patterns, vehicles]);

  const statusCounts = useMemo(() => ({
    all: trips.length,
    scheduled: trips.filter(t => (t.status || 'scheduled') === 'scheduled').length,
    canceled: trips.filter(t => t.status === 'canceled').length,
    closed: trips.filter(t => t.status === 'closed').length,
  }), [trips]);

  const uniquePatterns = useMemo(() =>
    patterns.filter(p => trips.some(t => t.patternId === p.id)),
    [patterns, trips]
  );

  return (
    <div className="space-y-5" data-testid="trips-manager">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Perjalanan Terjadwal</h3>
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{filteredTrips.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola trip dan jadwal keberangkatan</p>
        </div>
        <Button onClick={handleCreate} data-testid="add-trip-button">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Trip
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 border-b">
        {(['all', 'scheduled', 'canceled', 'closed'] as const).map(status => {
          const labels: Record<string, string> = { all: 'Semua', scheduled: 'Terjadwal', canceled: 'Dibatalkan', closed: 'Ditutup' };
          const count = statusCounts[status];
          const isActive = filterStatus === status;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              data-testid={`filter-status-${status}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {labels[status]}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari rute, kode, atau plat kendaraan..."
            className="pl-9 pr-9"
            data-testid="trip-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          data-testid="toggle-filters-button"
          className={showFilters || activeFilterCount > 0 ? 'border-primary text-primary bg-primary/5' : ''}
        >
          <Filter className="h-4 w-4 mr-1.5" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5 mr-1" />
            Hapus Filter
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-4">
            {/* Route filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rute / Pola</Label>
              <SearchableSelect
                value={filterPatternId}
                options={[
                  { value: 'all', label: 'Semua rute' },
                  ...uniquePatterns.map(p => ({
                    value: p.id,
                    label: p.name,
                    badge: p.code || undefined,
                    subtitle: p.vehicleClass || undefined,
                  }))
                ]}
                placeholder="Semua rute"
                searchPlaceholder="Cari nama atau kode rute..."
                onChange={setFilterPatternId}
                data-testid="filter-pattern-select"
              />
            </div>

            {/* Date preset buttons */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rentang Tanggal</Label>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyDatePreset(key)}
                    data-testid={`preset-${key}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      datePreset === key
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Custom date inputs — shown only when "Kustom" is selected or manually typed */}
              {(datePreset === 'custom' || (!datePreset && (filterDateFrom || filterDateTo))) && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Dari</Label>
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={e => { setFilterDateFrom(e.target.value); setDatePreset('custom'); }}
                      data-testid="filter-date-from"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Sampai</Label>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={e => { setFilterDateTo(e.target.value); setDatePreset('custom'); }}
                      data-testid="filter-date-to"
                    />
                  </div>
                </div>
              )}

              {/* Show resolved range for non-custom presets */}
              {datePreset && datePreset !== 'custom' && (filterDateFrom || filterDateTo) && (
                <p className="text-xs text-muted-foreground">
                  {filterDateFrom === filterDateTo
                    ? filterDateFrom
                    : `${filterDateFrom} — ${filterDateTo}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter aktif:</span>
          {filterPatternId !== 'all' && (
            <ActiveFilterPill
              label={`Rute: ${getPattern(filterPatternId)?.name || filterPatternId}`}
              onRemove={() => setFilterPatternId('all')}
            />
          )}
          {(filterDateFrom || filterDateTo) && (
            <ActiveFilterPill
              label={(() => {
                const preset = DATE_PRESETS.find(p => p.key === datePreset);
                if (preset && datePreset !== 'custom') return `Tanggal: ${preset.label}`;
                if (filterDateFrom === filterDateTo && filterDateFrom) return `Tanggal: ${filterDateFrom}`;
                if (filterDateFrom && filterDateTo) return `${filterDateFrom} — ${filterDateTo}`;
                if (filterDateFrom) return `Dari: ${filterDateFrom}`;
                return `Sampai: ${filterDateTo}`;
              })()}
              onRemove={() => { setFilterDateFrom(''); setFilterDateTo(''); setDatePreset(''); }}
            />
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm">Memuat data trip...</p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <CalendarDays className="w-10 h-10 opacity-25" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {searchQuery || activeFilterCount > 0 ? 'Tidak ada trip yang cocok' : 'Belum ada data trip'}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {searchQuery || activeFilterCount > 0
                    ? 'Coba ubah kata kunci atau filter yang digunakan'
                    : 'Klik "Tambah Trip" untuk membuat jadwal perjalanan baru'
                  }
                </p>
              </div>
              {(searchQuery || activeFilterCount > 0) && (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Hapus semua filter
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ── Mobile card list (< md) ── */}
              <div className="md:hidden divide-y" data-testid="trips-cards">
                {filteredTrips.map(trip => {
                  const pattern    = getPattern(trip.patternId);
                  const vehicle    = getVehicle(trip.vehicleId);
                  const layout     = getLayout(trip.layoutId || null);
                  const vehicleLayout = vehicle ? getLayout(vehicle.layoutId || null) : null;
                  const resolvedLayout = layout || vehicleLayout;
                  const departTime = getDepartureTime(trip);

                  return (
                    <div key={trip.id} className="p-4 space-y-3" data-testid={`trip-card-${trip.id}`}>
                      {/* Top row: route + actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-base text-foreground leading-snug">
                              {pattern?.name || <span className="text-muted-foreground italic text-sm">Rute tidak ditemukan</span>}
                            </div>
                            {pattern?.code && (
                              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
                                {pattern.code}
                              </span>
                            )}
                          </div>
                        </div>
                        <RowActionsMenu
                          actions={[
                            { label: 'Lihat Manifest', icon: <FileText className="h-3.5 w-3.5" />, onClick: () => setManifestTripId(trip.id) },
                            { label: 'Atur Jadwal', icon: <Clock className="h-3.5 w-3.5" />, onClick: () => handleScheduling(trip) },
                            { label: 'Turunkan Leg', icon: <Route className="h-3.5 w-3.5" />, onClick: () => handleDeriveLegs(trip.id), disabled: deriveLegsMutation.isPending },
                            { label: 'Hitung Inventori', icon: <Grid3X3 className="h-3.5 w-3.5" />, onClick: () => handlePrecomputeInventory(trip.id), disabled: precomputeSeatInventoryMutation.isPending },
                            { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(trip) },
                            { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(trip.id), variant: 'destructive', disabled: deleteMutation.isPending },
                          ]}
                          data-testid={`actions-trip-${trip.id}`}
                        />
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pl-12">
                        {/* Tanggal */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Tanggal</p>
                          <p className="text-sm font-medium">{formatServiceDate(trip.serviceDate)}</p>
                        </div>

                        {/* Jam Berangkat */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Jam Berangkat</p>
                          {departTime ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm font-bold tabular-nums">{departTime}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Belum diatur
                            </span>
                          )}
                        </div>

                        {/* Kendaraan */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Kendaraan</p>
                          {vehicle ? (
                            <div className="flex items-center gap-1.5">
                              <Bus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <span className="text-sm font-medium">{vehicle.code}</span>
                                <span className="text-xs text-muted-foreground font-mono ml-1.5">{vehicle.plate}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>

                        {/* Layout */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Layout</p>
                          <div className="flex items-center gap-1.5">
                            <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div>
                              <span className="text-sm font-medium">
                                {resolvedLayout?.name || <span className="text-muted-foreground italic">—</span>}
                              </span>
                              {layout && vehicle && layout.id !== vehicle.layoutId && (
                                <span className="text-xs text-indigo-600 ml-1">override</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Kapasitas */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Kapasitas</p>
                          <p className="text-sm font-medium">{trip.capacity} <span className="text-muted-foreground font-normal">kursi</span></p>
                        </div>

                        {/* Status */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                          <StatusBadge status={trip.status || 'scheduled'} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop table (≥ md) ── */}
              <Table className="hidden md:table" data-testid="trips-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Rute Perjalanan</TableHead>
                    <TableHead>Tgl. Layanan</TableHead>
                    <TableHead>Jam Berangkat</TableHead>
                    <TableHead>Kendaraan</TableHead>
                    <TableHead>Layout Kursi</TableHead>
                    <TableHead className="text-center">Kapasitas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map(trip => {
                    const pattern    = getPattern(trip.patternId);
                    const vehicle    = getVehicle(trip.vehicleId);
                    const layout     = getLayout(trip.layoutId || null);
                    const vehicleLayout = vehicle ? getLayout(vehicle.layoutId || null) : null;
                    const resolvedLayout = layout || vehicleLayout;
                    const departTime = getDepartureTime(trip);

                    return (
                      <TableRow key={trip.id} className="group" data-testid={`trip-row-${trip.id}`}>
                        {/* Rute */}
                        <TableCell className="pl-4 py-3">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-foreground leading-tight">
                                {pattern?.name || <span className="text-muted-foreground italic">Rute tidak ditemukan</span>}
                              </div>
                              {pattern?.code && (
                                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                  {pattern.code}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Tanggal */}
                        <TableCell className="py-3">
                          <div className="text-sm font-medium text-foreground">
                            {formatServiceDate(trip.serviceDate)}
                          </div>
                        </TableCell>

                        {/* Jam Berangkat */}
                        <TableCell className="py-3">
                          {departTime ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm font-semibold tabular-nums">{departTime}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                              Belum diatur
                            </span>
                          )}
                        </TableCell>

                        {/* Kendaraan */}
                        <TableCell className="py-3">
                          {vehicle ? (
                            <div className="flex items-center gap-1.5">
                              <Bus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{vehicle.code}</div>
                                <div className="text-xs text-muted-foreground font-mono">{vehicle.plate}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>

                        {/* Layout */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium leading-tight">
                                {resolvedLayout?.name || <span className="text-muted-foreground italic text-xs">Tidak ada</span>}
                              </div>
                              {layout && vehicle && layout.id !== vehicle.layoutId && (
                                <span className="text-xs text-indigo-600 dark:text-indigo-400">override</span>
                              )}
                              {!layout && vehicleLayout && (
                                <span className="text-xs text-muted-foreground">dari kendaraan</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Kapasitas */}
                        <TableCell className="text-center py-3">
                          <span className="text-sm font-medium tabular-nums">{trip.capacity}</span>
                          <span className="text-xs text-muted-foreground ml-0.5">kursi</span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">
                          <StatusBadge status={trip.status || 'scheduled'} />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pr-4 py-3">
                          <RowActionsMenu
                            actions={[
                              { label: 'Lihat Manifest', icon: <FileText className="h-3.5 w-3.5" />, onClick: () => setManifestTripId(trip.id) },
                              { label: 'Atur Jadwal', icon: <Clock className="h-3.5 w-3.5" />, onClick: () => handleScheduling(trip) },
                              { label: 'Turunkan Leg', icon: <Route className="h-3.5 w-3.5" />, onClick: () => handleDeriveLegs(trip.id), disabled: deriveLegsMutation.isPending },
                              { label: 'Hitung Inventori', icon: <Grid3X3 className="h-3.5 w-3.5" />, onClick: () => handlePrecomputeInventory(trip.id), disabled: precomputeSeatInventoryMutation.isPending },
                              { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(trip) },
                              { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(trip.id), variant: 'destructive', disabled: deleteMutation.isPending },
                            ]}
                            data-testid={`actions-trip-${trip.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingTrip ? 'Edit Trip' : 'Tambah Trip'}
        description={editingTrip ? 'Perbarui informasi trip ini.' : 'Buat trip baru dengan memilih pola dan kendaraan.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        data-testid="trip-dialog"
      >
        <SectionDivider label="Rute & Tanggal" />
        <div className="space-y-1.5">
          <Label>Pola Perjalanan <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={formData.patternId}
            options={patternOptions}
            placeholder="Pilih pola rute perjalanan..."
            searchPlaceholder="Cari pola..."
            onChange={(v) => setFormData(prev => ({ ...prev, patternId: v }))}
            data-testid="select-pattern"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="serviceDate">Tanggal Layanan <span className="text-destructive">*</span></Label>
          <Input
            id="serviceDate"
            type="date"
            value={formData.serviceDate}
            onChange={(e) => setFormData(prev => ({ ...prev, serviceDate: e.target.value }))}
            required
            data-testid="input-service-date"
          />
        </div>

        <SectionDivider label="Armada & Kapasitas" />
        <div className="space-y-1.5">
          <Label>Kendaraan <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={formData.vehicleId}
            options={vehicleOptions}
            placeholder="Pilih kendaraan..."
            searchPlaceholder="Cari kode atau plat..."
            onChange={(v) => setFormData(prev => ({ ...prev, vehicleId: v }))}
            data-testid="select-vehicle"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Override Layout Kursi</Label>
          <SearchableSelect
            value={formData.layoutId}
            options={layouts.map(l => ({ value: l.id, label: l.name, badge: `${l.rows}×${l.cols}` }))}
            placeholder="Gunakan default kendaraan..."
            searchPlaceholder="Cari layout..."
            onChange={(v) => setFormData(prev => ({ ...prev, layoutId: v }))}
            data-testid="select-layout"
          />
          <p className="text-xs text-muted-foreground">Kosongkan untuk menggunakan layout default kendaraan</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Kapasitas <span className="text-destructive">*</span></Label>
            <Input
              id="capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
              placeholder="Contoh: 40"
              min="1"
              required
              data-testid="input-capacity"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Terjadwal</SelectItem>
                <SelectItem value="canceled">Dibatalkan</SelectItem>
                <SelectItem value="closed">Ditutup</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </MasterFormDialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Trip"
        description="Apakah Anda yakin ingin menghapus trip ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      {/* Manifest Dialog */}
      <ManifestDialog
        tripId={manifestTripId}
        open={!!manifestTripId}
        onOpenChange={(open) => { if (!open) setManifestTripId(null); }}
      />

      {/* Scheduling Dialog */}
      <Dialog open={isSchedulingDialogOpen} onOpenChange={setIsSchedulingDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0" data-testid="scheduling-dialog">
          <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <DialogTitle>Jadwal Keberangkatan — {schedulingTrip && getPattern(schedulingTrip.patternId)?.name}</DialogTitle>
            <DialogDescription>Atur waktu tiba dan berangkat untuk setiap halte dalam trip ini.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {schedulingTrip && (
              <div className="bg-muted/40 border border-border rounded-xl p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block mb-0.5">Tanggal</span>
                    <span className="font-medium">{formatServiceDate(schedulingTrip.serviceDate)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block mb-0.5">Kendaraan</span>
                    <span className="font-medium">{(() => { const v = getVehicle(schedulingTrip.vehicleId); return v ? `${v.code} (${v.plate})` : '-'; })()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block mb-0.5">Kapasitas</span>
                    <span className="font-medium">{schedulingTrip.capacity} kursi</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block mb-0.5">Status</span>
                    <StatusBadge status={schedulingTrip.status || 'scheduled'} />
                  </div>
                </div>
              </div>
            )}
            {schedulingTrip && (
              <TripScheduleEditor trip={schedulingTrip} onClose={() => setIsSchedulingDialogOpen(false)} />
            )}
          </div>
          <div className="px-5 py-4 border-t shrink-0 bg-background flex justify-end">
            <Button variant="outline" onClick={() => setIsSchedulingDialogOpen(false)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
