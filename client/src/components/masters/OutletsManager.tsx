import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { outletsApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Store } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import { RowActionsMenu } from './RowActionsMenu';
import type { Outlet, Stop } from '@/types';

interface OutletFormData {
  stopId: string;
  name: string;
  address: string;
  phone: string;
  printerProfileId: string;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function OutletsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<OutletFormData>({
    stopId: '',
    name: '',
    address: '',
    phone: '',
    printerProfileId: ''
  });
  const { toast } = useToast();

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['/api/outlets'],
    queryFn: outletsApi.getAll
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const stopOptions = stops.filter(s => s.isOutlet).map(s => ({
    value: s.id,
    label: s.name,
    badge: s.code,
    subtitle: s.city || undefined
  }));

  const getStopName = (stopId: string) => {
    const stop = stops.find(s => s.id === stopId);
    return stop ? `${stop.name} (${stop.code})` : '-';
  };

  const filteredData = outlets.filter(outlet =>
    outlet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getStopName(outlet.stopId).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: outletsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outlets'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Berhasil', description: 'Outlet berhasil ditambahkan' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menambahkan outlet', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => outletsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outlets'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingOutlet(null);
      toast({ title: 'Berhasil', description: 'Outlet berhasil diperbarui' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal memperbarui outlet', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: outletsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outlets'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Outlet berhasil dihapus' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghapus outlet', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ stopId: '', name: '', address: '', phone: '', printerProfileId: '' });
  };

  const handleCreate = () => {
    setEditingOutlet(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setFormData({
      stopId: outlet.stopId,
      name: outlet.name,
      address: outlet.address || '',
      phone: outlet.phone || '',
      printerProfileId: outlet.printerProfileId || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOutlet) {
      updateMutation.mutate({ id: editingOutlet.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };

  return (
    <div className="space-y-6" data-testid="outlets-manager">
      <MasterPageHeader
        title="Outlet Penjualan"
        description="Kelola outlet penjualan tiket dan konfigurasinya"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari nama outlet atau halte..."
        count={filteredData.length}
        action={
          <Button onClick={handleCreate} data-testid="add-outlet-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Outlet
          </Button>
        }
      />

      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingOutlet ? 'Edit Outlet' : 'Tambah Outlet'}
        description={editingOutlet ? 'Perbarui informasi outlet penjualan.' : 'Tambahkan outlet penjualan tiket baru.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        data-testid="outlet-dialog"
      >
        <SectionDivider label="Lokasi & Identitas" />
        <div className="space-y-1.5">
          <Label>Halte / Terminal <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={formData.stopId}
            options={stopOptions}
            placeholder="Pilih halte yang menjadi lokasi outlet..."
            searchPlaceholder="Cari halte atau kota..."
            emptyLabel="Tidak ada halte dengan status outlet"
            onChange={(v) => setFormData(prev => ({ ...prev, stopId: v }))}
            data-testid="select-stop"
          />
          <p className="text-xs text-muted-foreground">Hanya halte yang bertanda outlet yang ditampilkan</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Nama Outlet <span className="text-destructive">*</span></Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Contoh: Terminal Jakarta — Loket 1"
            required
            data-testid="input-name"
          />
        </div>

        <SectionDivider label="Kontak & Alamat" />
        <div className="space-y-1.5">
          <Label htmlFor="address">Alamat Lengkap</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Jl. Contoh No. 1, Jakarta"
            data-testid="input-address"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Nomor Telepon</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+62-21-1234567"
            data-testid="input-phone"
          />
        </div>

        <SectionDivider label="Konfigurasi" />
        <div className="space-y-1.5">
          <Label htmlFor="printerProfileId">Profil Printer</Label>
          <Input
            id="printerProfileId"
            value={formData.printerProfileId}
            onChange={(e) => setFormData(prev => ({ ...prev, printerProfileId: e.target.value }))}
            placeholder="default"
            data-testid="input-printer"
          />
          <p className="text-xs text-muted-foreground">Kosongkan untuk menggunakan profil printer default</p>
        </div>
      </MasterFormDialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Outlet"
        description="Apakah Anda yakin ingin menghapus outlet ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      <DataTable
        data-testid="outlets-table"
        data={filteredData}
        keyExtractor={(o) => o.id}
        isLoading={isLoading}
        emptyIcon={<Store className="w-7 h-7" />}
        emptyMessage="Belum ada data outlet"
        searchQuery={searchQuery}
        rowTestId={(o) => `outlet-row-${o.id}`}
        columns={[
          {
            key: 'name', header: 'Nama Outlet',
            className: 'font-medium',
            render: (o) => o.name,
          },
          {
            key: 'stop', header: 'Halte / Terminal',
            className: 'text-muted-foreground',
            render: (o) => getStopName(o.stopId),
          },
          {
            key: 'address', header: 'Alamat', hideOnMobile: true,
            className: 'text-muted-foreground max-w-[200px]',
            render: (o) => o.address ? (
              <span className="line-clamp-2 text-[12px] leading-relaxed">{o.address}</span>
            ) : '—',
          },
          {
            key: 'phone', header: 'Telepon', hideOnMobile: true,
            className: 'tabular-nums text-muted-foreground',
            render: (o) => o.phone || '—',
          },
          {
            key: 'printer', header: 'Printer', hideOnMobile: true,
            className: 'font-mono text-[11px] text-muted-foreground',
            render: (o) => o.printerProfileId || 'default',
          },
          {
            key: 'actions', header: 'Aksi',
            headerClassName: 'text-right', className: 'text-right w-16',
            render: (o) => (
              <RowActionsMenu
                actions={[
                  { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(o) },
                  { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(o.id), variant: 'destructive', disabled: deleteMutation.isPending },
                ]}
                data-testid={`actions-outlet-${o.id}`}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
