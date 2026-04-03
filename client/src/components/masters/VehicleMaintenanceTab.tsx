import { useState } from 'react';
import { todayStr } from '@/lib/date';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { fmtCurrency, fmtShortDate, MAINTENANCE_STATUS_MAP, type MaintenanceStatus } from '@/lib/constants';
import { maintenanceApi } from '@/lib/api';
import { Plus, Pencil, Trash2, Wrench, Play, CheckCircle } from 'lucide-react';

interface VehicleMaintenanceTabProps {
  vehicleId: string;
  vehiclePlate: string;
}

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: string;
  description: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  odometerKm: number | null;
  cost: string | null;
  vendorName: string | null;
  status: string;
  nextServiceKm: number | null;
  nextServiceDate: string | null;
  createdBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const MAINTENANCE_TYPES = [
  { value: 'routine_service', label: 'Servis Rutin' },
  { value: 'repair', label: 'Perbaikan' },
  { value: 'inspection', label: 'Inspeksi' },
  { value: 'tire_change', label: 'Ganti Ban' },
  { value: 'oil_change', label: 'Ganti Oli' },
  { value: 'other', label: 'Lainnya' },
];


const getTypeLabel = (type: string) => MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;

interface FormData {
  type: string;
  description: string;
  scheduledDate: string;
  odometerKm: string;
  cost: string;
  vendorName: string;
  notes: string;
}

const emptyForm: FormData = {
  type: 'routine_service',
  description: '',
  scheduledDate: '',
  odometerKm: '',
  cost: '',
  vendorName: '',
  notes: '',
};

export default function VehicleMaintenanceTab({ vehicleId, vehiclePlate }: VehicleMaintenanceTabProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [statusForm, setStatusForm] = useState({ status: '', completedDate: '', odometerKm: '' });
  const { toast } = useToast();

  const { data: records = [], isLoading } = useQuery<MaintenanceRecord[]>({
    queryKey: ['/api/vehicles', vehicleId, 'maintenance'],
    queryFn: () => maintenanceApi.getByVehicle(vehicleId),
    enabled: !!vehicleId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await maintenanceApi.create(vehicleId, {
        type: data.type,
        description: data.description || null,
        scheduledDate: data.scheduledDate || null,
        odometerKm: data.odometerKm ? parseInt(data.odometerKm) : null,
        cost: data.cost || null,
        vendorName: data.vendorName || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles', vehicleId, 'maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/alerts'] });
      setIsAddOpen(false);
      setFormData({ ...emptyForm });
      toast({ title: 'Berhasil', description: 'Data perawatan berhasil ditambahkan' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await maintenanceApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles', vehicleId, 'maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/alerts'] });
      setStatusDialog(null);
      toast({ title: 'Berhasil', description: 'Status perawatan berhasil diperbarui' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await maintenanceApi.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles', vehicleId, 'maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/alerts'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Data perawatan berhasil dihapus' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    },
  });

  const handleAdd = () => {
    createMutation.mutate(formData);
  };

  const handleStatusUpdate = () => {
    if (!statusDialog) return;
    const data: any = { status: statusForm.status };
    if (statusForm.completedDate) data.completedDate = statusForm.completedDate;
    if (statusForm.odometerKm) data.odometerKm = parseInt(statusForm.odometerKm);
    updateStatusMutation.mutate({ id: statusDialog.id, data });
  };

  const openStatusDialog = (record: MaintenanceRecord, newStatus: string) => {
    setStatusDialog(record);
    setStatusForm({
      status: newStatus,
      completedDate: newStatus === 'completed' ? todayStr() : '',
      odometerKm: record.odometerKm?.toString() || '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium" data-testid="text-vehicle-plate">{vehiclePlate}</span>
          <span className="text-sm text-muted-foreground">— Riwayat Perawatan</span>
        </div>
        <Button size="sm" onClick={() => { setFormData({ ...emptyForm }); setIsAddOpen(true); }} data-testid="button-add-maintenance">
          <Plus className="w-4 h-4 mr-1" /> Tambah
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6 text-center text-muted-foreground text-sm">Memuat data...</Card>
      ) : records.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground text-sm">Belum ada data perawatan</Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipe</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Tgl Jadwal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Odometer</TableHead>
                <TableHead className="text-right">Biaya</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const st = MAINTENANCE_STATUS_MAP[r.status as MaintenanceStatus] || MAINTENANCE_STATUS_MAP.scheduled;
                return (
                  <TableRow key={r.id} data-testid={`row-maintenance-${r.id}`}>
                    <TableCell className="font-medium text-sm">{getTypeLabel(r.type)}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.description || '—'}</TableCell>
                    <TableCell className="text-sm">{r.scheduledDate || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${st.color} ${st.bg}`} data-testid={`badge-status-${r.id}`}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.odometerKm != null ? `${r.odometerKm.toLocaleString()} km` : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{fmtCurrency(r.cost)}</TableCell>
                    <TableCell className="text-sm">{r.vendorName || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {r.status === 'scheduled' && (
                          <Button size="icon" variant="ghost" onClick={() => openStatusDialog(r, 'in_progress')} data-testid={`button-start-${r.id}`} title="Mulai">
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {r.status === 'in_progress' && (
                          <Button size="icon" variant="ghost" onClick={() => openStatusDialog(r, 'completed')} data-testid={`button-complete-${r.id}`} title="Selesai">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(r.id)} data-testid={`button-delete-${r.id}`} title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Perawatan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipe</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="select-maintenance-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} data-testid="input-maintenance-description" />
            </div>
            <div>
              <Label>Tanggal Jadwal</Label>
              <Input type="date" value={formData.scheduledDate} onChange={e => setFormData(f => ({ ...f, scheduledDate: e.target.value }))} data-testid="input-maintenance-date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Odometer (km)</Label>
                <Input type="number" value={formData.odometerKm} onChange={e => setFormData(f => ({ ...f, odometerKm: e.target.value }))} data-testid="input-maintenance-odometer" />
              </div>
              <div>
                <Label>Biaya (Rp)</Label>
                <Input type="number" value={formData.cost} onChange={e => setFormData(f => ({ ...f, cost: e.target.value }))} data-testid="input-maintenance-cost" />
              </div>
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={formData.vendorName} onChange={e => setFormData(f => ({ ...f, vendorName: e.target.value }))} data-testid="input-maintenance-vendor" />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} data-testid="input-maintenance-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} data-testid="button-cancel-maintenance">Batal</Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid="button-save-maintenance">
              {createMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusForm.status === 'in_progress' ? 'Mulai Perawatan' : 'Selesaikan Perawatan'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {statusForm.status === 'completed' && (
              <div>
                <Label>Tanggal Selesai</Label>
                <Input type="date" value={statusForm.completedDate} onChange={e => setStatusForm(f => ({ ...f, completedDate: e.target.value }))} data-testid="input-status-completed-date" />
              </div>
            )}
            <div>
              <Label>Odometer (km)</Label>
              <Input type="number" value={statusForm.odometerKm} onChange={e => setStatusForm(f => ({ ...f, odometerKm: e.target.value }))} data-testid="input-status-odometer" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)} data-testid="button-cancel-status">Batal</Button>
            <Button onClick={handleStatusUpdate} disabled={updateStatusMutation.isPending} data-testid="button-confirm-status">
              {updateStatusMutation.isPending ? 'Menyimpan...' : 'Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Data Perawatan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Yakin ingin menghapus data perawatan ini? Tindakan ini tidak dapat dibatalkan.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} data-testid="button-cancel-delete">Batal</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
