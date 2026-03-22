import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { driversApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, UserCheck } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import { RowActionsMenu } from './RowActionsMenu';
import type { Driver } from '@/types';

interface DriverFormData {
  code: string;
  name: string;
  phone: string;
  licenseNo: string;
  licenseType: string;
  status: 'active' | 'inactive' | 'suspended';
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

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active:    { label: 'Aktif',      className: 'bg-green-100 text-green-800' },
  inactive:  { label: 'Tidak Aktif', className: 'bg-gray-100 text-gray-700' },
  suspended: { label: 'Ditangguhkan', className: 'bg-red-100 text-red-800' }
};

const LICENSE_TYPES = ['A', 'B1', 'B2', 'C', 'D'];

const DEFAULT_FORM: DriverFormData = {
  code: '',
  name: '',
  phone: '',
  licenseNo: '',
  licenseType: 'B2',
  status: 'active',
  notes: ''
};

export default function DriversManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<DriverFormData>(DEFAULT_FORM);
  const { toast } = useToast();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['/api/drivers'],
    queryFn: driversApi.getAll
  });

  const filteredData = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.licenseNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: driversApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      setIsDialogOpen(false);
      setFormData(DEFAULT_FORM);
      toast({ title: 'Berhasil', description: 'Driver berhasil ditambahkan' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menambahkan driver', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => driversApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      setIsDialogOpen(false);
      setFormData(DEFAULT_FORM);
      setEditingDriver(null);
      toast({ title: 'Berhasil', description: 'Driver berhasil diperbarui' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal memperbarui driver', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: driversApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Driver berhasil dihapus' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghapus driver', variant: 'destructive' });
    }
  });

  const handleCreate = () => {
    setEditingDriver(null);
    setFormData(DEFAULT_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      code: driver.code,
      name: driver.name,
      phone: driver.phone,
      licenseNo: driver.licenseNo,
      licenseType: driver.licenseType,
      status: driver.status as 'active' | 'inactive' | 'suspended',
      notes: driver.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (editingDriver) {
      updateMutation.mutate({ id: editingDriver.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };

  return (
    <div className="space-y-6" data-testid="drivers-manager">
      <MasterPageHeader
        title="Master Driver"
        description="Kelola data pengemudi armada kendaraan"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari nama, kode, telepon, atau SIM..."
        count={filteredData.length}
        action={
          <Button onClick={handleCreate} data-testid="add-driver-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Driver
          </Button>
        }
      />

      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingDriver ? 'Edit Driver' : 'Tambah Driver'}
        description={editingDriver ? 'Perbarui informasi pengemudi.' : 'Daftarkan pengemudi baru ke dalam sistem.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        data-testid="driver-dialog"
      >
        <SectionDivider label="Identitas" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Kode Driver <span className="text-destructive">*</span></Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="Contoh: DRV-001"
              required
              data-testid="input-code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Lengkap <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nama sesuai KTP"
              required
              data-testid="input-name"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">No. Telepon <span className="text-destructive">*</span></Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="Contoh: 0812-3456-7890"
            required
            data-testid="input-phone"
          />
        </div>

        <SectionDivider label="SIM & Status" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="licenseNo">No. SIM <span className="text-destructive">*</span></Label>
            <Input
              id="licenseNo"
              value={formData.licenseNo}
              onChange={(e) => setFormData(prev => ({ ...prev, licenseNo: e.target.value }))}
              placeholder="Nomor SIM"
              required
              data-testid="input-license-no"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Jenis SIM <span className="text-destructive">*</span></Label>
            <Select
              value={formData.licenseType}
              onValueChange={(v) => setFormData(prev => ({ ...prev, licenseType: v }))}
            >
              <SelectTrigger data-testid="select-license-type">
                <SelectValue placeholder="Pilih jenis SIM" />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_TYPES.map(t => (
                  <SelectItem key={t} value={t}>SIM {t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">SIM B2 untuk kendaraan angkutan umum</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as any }))}
          >
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Tidak Aktif</SelectItem>
              <SelectItem value="suspended">Ditangguhkan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SectionDivider label="Catatan" />
        <div className="space-y-1.5">
          <Label htmlFor="notes">Catatan Tambahan</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Informasi tambahan tentang driver ini..."
            rows={3}
            data-testid="input-notes"
          />
        </div>
      </MasterFormDialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Driver"
        description="Apakah Anda yakin ingin menghapus driver ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      <DataTable
        data-testid="drivers-table"
        data={filteredData}
        keyExtractor={(d) => d.id}
        isLoading={isLoading}
        emptyIcon={<UserCheck className="w-7 h-7" />}
        emptyMessage="Belum ada data driver"
        searchQuery={searchQuery}
        rowTestId={(d) => `driver-row-${d.code}`}
        columns={[
          {
            key: 'code', header: 'Kode',
            className: 'font-mono font-medium text-primary/80 whitespace-nowrap',
            render: (d) => d.code,
          },
          {
            key: 'name', header: 'Nama',
            className: 'font-medium',
            render: (d) => d.name,
          },
          {
            key: 'phone', header: 'Telepon', hideOnMobile: true,
            className: 'tabular-nums text-muted-foreground',
            render: (d) => d.phone || '—',
          },
          {
            key: 'license', header: 'SIM',
            render: (d) => (
              <span className="whitespace-nowrap">
                <span className="font-mono text-[12px]">{d.licenseNo}</span>
                <span className="ml-1 text-[11px] text-muted-foreground">(SIM {d.licenseType})</span>
              </span>
            ),
          },
          {
            key: 'status', header: 'Status',
            render: (d) => {
              const info = STATUS_LABELS[d.status] || { label: d.status, className: 'bg-gray-100 text-gray-700' };
              return <Badge className={`${info.className} text-[11px] py-0`}>{info.label}</Badge>;
            },
          },
          {
            key: 'notes', header: 'Catatan', hideOnMobile: true,
            className: 'text-muted-foreground max-w-[200px]',
            render: (d) => d.notes ? (
              <span className="line-clamp-2 text-[12px] leading-relaxed">{d.notes}</span>
            ) : '—',
          },
          {
            key: 'actions', header: 'Aksi',
            headerClassName: 'text-right', className: 'text-right w-16',
            render: (d) => (
              <RowActionsMenu
                actions={[
                  { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(d) },
                  { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(d.id), variant: 'destructive', disabled: deleteMutation.isPending },
                ]}
                data-testid={`actions-driver-${d.code}`}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
