import { useState } from 'react';
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
import { Plus, Pencil, Trash2, Clock, Route, Grid3X3, CalendarDays, FileText } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
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

  const layoutOptions = [
    { value: '', label: 'Gunakan default kendaraan', badge: 'Default' },
    ...layouts.map(l => ({ value: l.id, label: l.name, badge: `${l.rows}×${l.cols}` }))
  ];

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

  const getPatternName = (patternId: string) => patterns.find(p => p.id === patternId)?.name || '-';
  const getPatternCode = (patternId: string) => patterns.find(p => p.id === patternId)?.code || '';
  const getVehicleName = (vehicleId: string) => {
    const v = vehicles.find(v => v.id === vehicleId);
    return v ? `${v.code} (${v.plate})` : '-';
  };
  const getLayoutName = (layoutId: string) => layouts.find(l => l.id === layoutId)?.name || 'Default';

  const getScheduleDisplay = (trip: any) => {
    if (trip.scheduleTime) {
      const departTime = new Date(trip.scheduleTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
      return `Berangkat: ${departTime}`;
    }
    return 'Jadwal belum diatur';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return <Badge variant="secondary">Terjadwal</Badge>;
      case 'canceled': return <Badge variant="destructive">Dibatalkan</Badge>;
      case 'closed': return <Badge variant="outline">Ditutup</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTrips = trips.filter(trip => {
    const q = searchQuery.toLowerCase();
    return getPatternName(trip.patternId).toLowerCase().includes(q) ||
      getVehicleName(trip.vehicleId).toLowerCase().includes(q) ||
      trip.id.slice(-8).toLowerCase().includes(q) ||
      trip.serviceDate.toLowerCase().includes(q) ||
      (trip.status || 'scheduled').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="trips-manager">
      <MasterPageHeader
        title="Perjalanan Terjadwal"
        description="Kelola trip dan jadwal keberangkatan"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari pola, kendaraan, atau tanggal..."
        count={filteredTrips.length}
        action={
          <Button onClick={handleCreate} data-testid="add-trip-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Trip
          </Button>
        }
      />

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
            options={layoutOptions.slice(1)}
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

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Trip"
        description="Apakah Anda yakin ingin menghapus trip ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table data-testid="trips-table">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Rute & Jadwal</TableHead>
                  <TableHead>Tgl. Layanan</TableHead>
                  <TableHead>Kendaraan</TableHead>
                  <TableHead>Kapasitas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada data trip'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrips.map(trip => (
                    <TableRow key={trip.id} data-testid={`trip-row-${trip.id}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{trip.id.slice(-8)}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">{getPatternName(trip.patternId)}</div>
                          <div className="text-xs text-muted-foreground">{getScheduleDisplay(trip)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{trip.serviceDate}</TableCell>
                      <TableCell className="text-sm">{getVehicleName(trip.vehicleId)}</TableCell>
                      <TableCell className="text-sm">{trip.capacity} kursi</TableCell>
                      <TableCell>{getStatusBadge(trip.status || 'scheduled')}</TableCell>
                      <TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <DialogTitle>Jadwal Keberangkatan — {schedulingTrip && getPatternName(schedulingTrip.patternId)}</DialogTitle>
            <DialogDescription>Atur waktu tiba dan berangkat untuk setiap halte dalam trip ini.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {schedulingTrip && (
              <div className="bg-muted/40 border border-border rounded-xl p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="font-medium text-muted-foreground">Tanggal:</span> <span className="ml-1">{schedulingTrip.serviceDate}</span></div>
                  <div><span className="font-medium text-muted-foreground">Kendaraan:</span> <span className="ml-1">{getVehicleName(schedulingTrip.vehicleId)}</span></div>
                  <div><span className="font-medium text-muted-foreground">Kapasitas:</span> <span className="ml-1">{schedulingTrip.capacity} kursi</span></div>
                  <div className="flex items-center gap-1"><span className="font-medium text-muted-foreground">Status:</span> <span className="ml-1">{getStatusBadge(schedulingTrip.status || 'scheduled')}</span></div>
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
