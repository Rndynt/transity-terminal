import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { tripsApi, tripPatternsApi, vehiclesApi, layoutsApi, driversApi, spjApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, CalendarDays } from 'lucide-react';
import { useLocation } from 'wouter';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterFormDialog from './MasterFormDialog';
import TripsFilterPanel from './TripsFilterPanel';
import TripsGroupList from './TripsGroupList';
import type { Trip, TripPattern, Vehicle, Layout, Driver } from '@/types';
import { todayStr } from '@/lib/date';
import { TripStatusBadge } from '@/components/shared/StatusBadges';
import TripScheduleEditor from './TripScheduleEditor';
import ManifestDialog from '@/components/manifest/ManifestDialog';

interface TripFormData {
  patternId: string;
  serviceDate: string;
  vehicleId: string;
  layoutId: string;
  capacity: string;
  driverId: string;
  status: 'scheduled' | 'cancelled' | 'closed';
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
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
    serviceDate: todayStr(),
    vehicleId: '',
    layoutId: '',
    capacity: '',
    driverId: '',
    status: 'scheduled'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPatternId, setFilterPatternId] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (patternId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(patternId)) next.delete(patternId);
      else next.add(patternId);
      return next;
    });
  };

  const { toast } = useToast();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['/api/trips'],
    queryFn: () => tripsApi.getAll()
  });

  const { data: patterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: vehiclesApi.getAll
  });

  const { data: layouts = [], isLoading: layoutsLoading } = useQuery({
    queryKey: ['/api/layouts'],
    queryFn: layoutsApi.getAll
  });

  const { data: driversList = [], isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
    queryFn: driversApi.getAll
  });

  const patternOptions = patterns.map(p => ({
    value: p.id,
    label: p.active ? p.name : `${p.name} (Nonaktif)`,
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
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Leg trip berhasil diturunkan' });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
    },
    onError: (error) => { toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menurunkan leg', variant: 'destructive' }); }
  });

  const precomputeSeatInventoryMutation = useMutation({
    mutationFn: tripsApi.precomputeSeatInventory,
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Inventori kursi berhasil dihitung ulang' });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
    },
    onError: (error) => { toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghitung inventori', variant: 'destructive' }); }
  });

  const resetForm = () => {
    setFormData({ patternId: '', serviceDate: todayStr(), vehicleId: '', layoutId: '', capacity: '', driverId: '', status: 'scheduled' });
  };

  const handleCreate = () => { setEditingTrip(null); resetForm(); setIsDialogOpen(true); };

  const handleEdit = (trip: Trip) => {
    setEditingTrip(trip);
    setFormData({ patternId: trip.patternId, serviceDate: trip.serviceDate, vehicleId: trip.vehicleId, layoutId: trip.layoutId || '', capacity: trip.capacity.toString(), driverId: trip.driverId || '', status: trip.status || 'scheduled' });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData, capacity: parseInt(formData.capacity, 10) || 0, layoutId: formData.layoutId || null, vehicleId: formData.vehicleId || null, driverId: formData.driverId || null, channelFlags: { CSO: true, WEB: false, APP: false, OTA: false } };
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

  const [, setLocation] = useLocation();

  const createSpjMutation = useMutation({
    mutationFn: (tripId: string) => spjApi.create({ tripId }),
    onSuccess: () => {
      toast({ title: 'SPJ berhasil dibuat', description: 'Mengalihkan ke halaman SPJ...' });
      setLocation('/spj');
    },
    onError: (err: any) => {
      toast({ title: 'Gagal membuat SPJ', description: err?.message || 'Terjadi kesalahan', variant: 'destructive' });
    },
  });

  const handleCreateSpj = async (tripId: string) => {
    try {
      const existing = await spjApi.getByTripId(tripId);
      if (existing) {
        toast({ title: 'SPJ sudah ada', description: `SPJ ${existing.spjNumber} sudah dibuat untuk trip ini. Mengalihkan...` });
        setLocation('/spj');
        return;
      }
    } catch {}
    createSpjMutation.mutate(tripId);
  };

  const getPattern = (patternId: string) => patterns.find(p => p.id === patternId);
  const getVehicle = (vehicleId: string) => vehicles.find(v => v.id === vehicleId);

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
    cancelled: trips.filter(t => t.status === 'cancelled').length,
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
        {(['all', 'scheduled', 'cancelled', 'closed'] as const).map(status => {
          const labels: Record<string, string> = { all: 'Semua', scheduled: 'Terjadwal', cancelled: 'Dibatalkan', closed: 'Ditutup' };
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

      <TripsFilterPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterPatternId={filterPatternId}
        onFilterPatternChange={setFilterPatternId}
        filterDateFrom={filterDateFrom}
        filterDateTo={filterDateTo}
        onFilterDateFromChange={setFilterDateFrom}
        onFilterDateToChange={setFilterDateTo}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        showFilters={showFilters}
        onShowFiltersChange={setShowFilters}
        activeFilterCount={activeFilterCount}
        onClearAll={clearAllFilters}
        uniquePatterns={uniquePatterns}
        getPatternName={(id) => getPattern(id)?.name}
      />

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
            <TripsGroupList
              trips={filteredTrips}
              patterns={patterns}
              getVehicle={getVehicle}
              getDepartureTime={getDepartureTime}
              formatServiceDate={formatServiceDate}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onToggleAll={(expanded, ids) => setExpandedGroups(expanded ? new Set(ids) : new Set())}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onScheduling={handleScheduling}
              onManifest={(id) => setManifestTripId(id)}
              onCreateSpj={handleCreateSpj}
              onDeriveLegs={handleDeriveLegs}
              onPrecomputeInventory={handlePrecomputeInventory}
              isDeleting={deleteMutation.isPending}
              isCreatingSpj={createSpjMutation.isPending}
              isDerivingLegs={deriveLegsMutation.isPending}
              isPrecomputingInventory={precomputeSeatInventoryMutation.isPending}
            />
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
            placeholder={patternsLoading ? "Memuat pola..." : "Pilih pola rute perjalanan..."}
            searchPlaceholder="Cari pola..."
            onChange={(v) => setFormData(prev => ({ ...prev, patternId: v }))}
            disabled={patternsLoading}
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

        <SectionDivider label="Armada & Pengemudi" />
        <div className="space-y-1.5">
          <Label>Kendaraan <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={formData.vehicleId}
            options={vehicleOptions}
            placeholder={vehiclesLoading ? "Memuat kendaraan..." : "Pilih kendaraan..."}
            searchPlaceholder="Cari kode atau plat..."
            onChange={(v) => setFormData(prev => ({ ...prev, vehicleId: v }))}
            disabled={vehiclesLoading}
            data-testid="select-vehicle"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Driver / Pengemudi</Label>
          <SearchableSelect
            value={formData.driverId}
            options={driversList.filter(d => d.status === 'active').map(d => ({
              value: d.id,
              label: d.name,
              badge: d.code || undefined,
              subtitle: d.phone || undefined
            }))}
            placeholder={driversLoading ? "Memuat driver..." : "Pilih driver..."}
            searchPlaceholder="Cari nama atau kode..."
            onChange={(v) => setFormData(prev => ({ ...prev, driverId: v }))}
            disabled={driversLoading}
            clearValue=""
            data-testid="select-driver"
          />
          <p className="text-xs text-muted-foreground">Opsional — bisa diassign nanti</p>
        </div>

        <SectionDivider label="Kapasitas" />
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
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
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
                    <TripStatusBadge status={schedulingTrip.status || 'scheduled'} />
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
