import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { vehiclesApi, layoutsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Bus } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import type { Vehicle, Layout } from '@/types';

interface VehicleFormData {
  code: string;
  plate: string;
  layoutId: string;
  capacity: string;
  notes: string;
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

  const layoutOptions = layouts.map(l => ({
    value: l.id,
    label: l.name,
    badge: `${l.rows}×${l.cols}`,
    subtitle: `${(l.seatMap as any[]).length} kursi`
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
    mutationFn: ({ id, data }: { id: string; data: any }) => vehiclesApi.update(id, data),
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table data-testid="vehicles-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Plat Nomor</TableHead>
                  <TableHead>Layout</TableHead>
                  <TableHead>Kapasitas</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Bus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada data kendaraan'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map(vehicle => (
                    <TableRow key={vehicle.id} data-testid={`vehicle-row-${vehicle.code}`}>
                      <TableCell className="font-mono font-medium">{vehicle.code}</TableCell>
                      <TableCell className="font-mono">{vehicle.plate}</TableCell>
                      <TableCell>{getLayoutName(vehicle.layoutId)}</TableCell>
                      <TableCell>{vehicle.capacity} kursi</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{vehicle.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(vehicle)}
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10"
                                  data-testid={`edit-vehicle-${vehicle.code}`}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Edit kendaraan</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(vehicle.id)}
                                  disabled={deleteMutation.isPending}
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-destructive/10 disabled:opacity-50"
                                  data-testid={`delete-vehicle-${vehicle.code}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Hapus kendaraan</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
