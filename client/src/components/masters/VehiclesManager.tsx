import { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { vehiclesApi, layoutsApi, maintenanceApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Bus, Wrench, AlertTriangle } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import { RowActionsMenu } from './RowActionsMenu';
import type { Vehicle, Layout } from '@/types';

const VehicleMaintenanceTab = lazy(() => import('./VehicleMaintenanceTab'));

interface VehicleFormData {
  code: string;
  plate: string;
  layoutId: string;
  capacity: string;
  notes: string;
}

interface MaintenanceAlert {
  id: string;
  vehicle_id: string;
  vehicle_code: string;
  plate: string;
  type: string;
  status: string;
  scheduled_date: string | null;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function VehiclesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>({
    code: '',
    plate: '',
    layoutId: '',
    capacity: '',
    notes: ''
  });
  const { toast } = useToast();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: vehiclesApi.getAll
  });

  const { data: layouts = [] } = useQuery({
    queryKey: ['/api/layouts'],
    queryFn: layoutsApi.getAll
  });

  const { data: alerts = [] } = useQuery<MaintenanceAlert[]>({
    queryKey: ['/api/maintenance/alerts'],
    queryFn: maintenanceApi.getAlerts,
    staleTime: 60_000,
  });

  const alertsByVehicle = useMemo(() => {
    const map = new Map<string, { overdue: number; upcoming: number }>();
    for (const a of alerts) {
      if (!a.vehicle_id) continue;
      const entry = map.get(a.vehicle_id) ?? { overdue: 0, upcoming: 0 };
      if (a.status === 'overdue') entry.overdue++;
      else entry.upcoming++;
      map.set(a.vehicle_id, entry);
    }
    return map;
  }, [alerts]);

  const layoutOptions = layouts.map(l => ({
    value: l.id,
    label: l.name,
    badge: `${l.rows}×${l.cols}`,
    subtitle: `${(l.seatMap as unknown[]).length} kursi`
  }));

  const filteredData = vehicles.filter(vehicle =>
    vehicle.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (vehicle.notes && vehicle.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const createMutation = useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Berhasil', description: 'Kendaraan berhasil ditambahkan' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menambahkan kendaraan', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vehiclesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingVehicle(null);
      toast({ title: 'Berhasil', description: 'Kendaraan berhasil diperbarui' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal memperbarui kendaraan', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: vehiclesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Kendaraan berhasil dihapus' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghapus kendaraan', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ code: '', plate: '', layoutId: '', capacity: '', notes: '' });
  };

  const handleCreate = () => {
    setEditingVehicle(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      code: vehicle.code,
      plate: vehicle.plate,
      layoutId: vehicle.layoutId,
      capacity: vehicle.capacity.toString(),
      notes: vehicle.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData, capacity: parseInt(formData.capacity, 10) };
    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };

  const getLayoutName = (layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId);
    return layout ? `${layout.name} (${layout.rows}×${layout.cols})` : '-';
  };

  return (
    <div className="space-y-6" data-testid="vehicles-manager">
      <MasterPageHeader
        title="Armada Kendaraan"
        description="Kelola armada bus dan konfigurasi kendaraan"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari kode atau plat nomor..."
        count={filteredData.length}
        action={
          <Button onClick={handleCreate} data-testid="add-vehicle-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Kendaraan
          </Button>
        }
      />

      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingVehicle ? 'Edit Kendaraan' : 'Tambah Kendaraan'}
        description={editingVehicle ? 'Perbarui informasi kendaraan.' : 'Daftarkan kendaraan baru ke dalam armada.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        data-testid="vehicle-dialog"
      >
        <SectionDivider label="Identitas Kendaraan" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Kode Kendaraan <span className="text-destructive">*</span></Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="Contoh: BUS-001"
              required
              data-testid="input-code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plate">Plat Nomor <span className="text-destructive">*</span></Label>
            <Input
              id="plate"
              value={formData.plate}
              onChange={(e) => setFormData(prev => ({ ...prev, plate: e.target.value }))}
              placeholder="Contoh: B 1234 ABC"
              required
              data-testid="input-plate"
            />
          </div>
        </div>

        <SectionDivider label="Konfigurasi" />
        <div className="space-y-1.5">
          <Label>Tata Letak Kursi <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={formData.layoutId}
            options={layoutOptions}
            placeholder="Pilih tata letak kursi..."
            searchPlaceholder="Cari layout..."
            onChange={(v) => setFormData(prev => ({ ...prev, layoutId: v }))}
            data-testid="select-layout"
          />
        </div>

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
          <p className="text-xs text-muted-foreground">Jumlah maksimum penumpang</p>
        </div>

        <SectionDivider label="Catatan" />
        <div className="space-y-1.5">
          <Label htmlFor="notes">Catatan Tambahan</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Informasi tambahan tentang kendaraan ini..."
            rows={3}
            data-testid="input-notes"
          />
        </div>
      </MasterFormDialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Kendaraan"
        description="Apakah Anda yakin ingin menghapus kendaraan ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      <DataTable
        data-testid="vehicles-table"
        data={filteredData}
        keyExtractor={(v) => v.id}
        isLoading={isLoading}
        emptyIcon={<Bus className="w-7 h-7" />}
        emptyMessage="Belum ada data kendaraan"
        searchQuery={searchQuery}
        rowTestId={(v) => `vehicle-row-${v.code}`}
        columns={[
          {
            key: 'code', header: 'Kode',
            className: 'font-mono font-medium text-primary/80 whitespace-nowrap',
            render: (v) => (
              <div className="flex items-center gap-2">
                <span>{v.code}</span>
                {(() => {
                  const a = alertsByVehicle.get(v.id);
                  if (!a) return null;
                  if (a.overdue > 0) return (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 bg-red-50 border-red-200" data-testid={`badge-overdue-${v.code}`}>
                      <AlertTriangle className="w-3 h-3 mr-0.5" />Overdue
                    </Badge>
                  );
                  return (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 bg-amber-50 border-amber-200" data-testid={`badge-upcoming-${v.code}`}>
                      <Wrench className="w-3 h-3 mr-0.5" />Service
                    </Badge>
                  );
                })()}
              </div>
            ),
          },
          {
            key: 'plate', header: 'Plat Nomor',
            className: 'font-mono whitespace-nowrap',
            render: (v) => v.plate,
          },
          {
            key: 'layout', header: 'Layout', hideOnMobile: true,
            render: (v) => <span className="text-muted-foreground">{getLayoutName(v.layoutId)}</span>,
          },
          {
            key: 'capacity', header: 'Kapasitas',
            className: 'tabular-nums',
            render: (v) => <><span className="font-medium">{v.capacity}</span> <span className="text-[11px] text-muted-foreground">kursi</span></>,
          },
          {
            key: 'notes', header: 'Catatan', hideOnMobile: true,
            className: 'text-muted-foreground max-w-[200px]',
            render: (v) => v.notes ? (
              <span className="line-clamp-2 text-[12px] leading-relaxed">{v.notes}</span>
            ) : '—',
          },
          {
            key: 'actions', header: 'Aksi',
            headerClassName: 'text-right', className: 'text-right w-16',
            render: (v) => (
              <RowActionsMenu
                actions={[
                  { label: 'Maintenance', icon: <Wrench className="h-3.5 w-3.5" />, onClick: () => setMaintenanceVehicle(v) },
                  { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(v) },
                  { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(v.id), variant: 'destructive', disabled: deleteMutation.isPending },
                ]}
                data-testid={`actions-vehicle-${v.code}`}
              />
            ),
          },
        ]}
      />

      <Dialog open={!!maintenanceVehicle} onOpenChange={(open) => { if (!open) setMaintenanceVehicle(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Maintenance — {maintenanceVehicle?.code} ({maintenanceVehicle?.plate})
            </DialogTitle>
          </DialogHeader>
          {maintenanceVehicle && (
            <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div>}>
              <VehicleMaintenanceTab vehicleId={maintenanceVehicle.id} vehiclePlate={maintenanceVehicle.plate} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
