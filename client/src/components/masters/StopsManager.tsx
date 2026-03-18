import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, CheckCircle, XCircle, MapPin } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import { RowActionsMenu } from './RowActionsMenu';
import type { Stop } from '@/types';

interface StopFormData {
  code: string;
  name: string;
  city: string;
  lat: string;
  lng: string;
  isOutlet: boolean;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function StopsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<StopFormData>({
    code: '',
    name: '',
    city: '',
    lat: '',
    lng: '',
    isOutlet: false
  });
  const { toast } = useToast();

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const filteredData = stops.filter(stop =>
    stop.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (stop.city && stop.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const createMutation = useMutation({
    mutationFn: stopsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stops'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Berhasil', description: 'Halte berhasil ditambahkan' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menambahkan halte', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => stopsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stops'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingStop(null);
      toast({ title: 'Berhasil', description: 'Halte berhasil diperbarui' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal memperbarui halte', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: stopsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stops'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Halte berhasil dihapus' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghapus halte', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ code: '', name: '', city: '', lat: '', lng: '', isOutlet: false });
  };

  const handleCreate = () => {
    setEditingStop(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (stop: Stop) => {
    setEditingStop(stop);
    setFormData({
      code: stop.code,
      name: stop.name,
      city: stop.city || '',
      lat: stop.lat || '',
      lng: stop.lng || '',
      isOutlet: Boolean(stop.isOutlet)
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      lat: formData.lat ? parseFloat(formData.lat) : null,
      lng: formData.lng ? parseFloat(formData.lng) : null
    };
    if (editingStop) {
      updateMutation.mutate({ id: editingStop.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };

  return (
    <div className="space-y-6" data-testid="stops-manager">
      <MasterPageHeader
        title="Halte & Terminal"
        description="Kelola lokasi halte dan terminal bus"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari kode, nama, atau kota..."
        count={filteredData.length}
        action={
          <Button onClick={handleCreate} data-testid="add-stop-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Halte
          </Button>
        }
      />

      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingStop ? 'Edit Halte' : 'Tambah Halte'}
        description={editingStop ? 'Perbarui informasi halte atau terminal.' : 'Tambahkan halte atau terminal baru ke dalam sistem.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        data-testid="stop-dialog"
      >
        <SectionDivider label="Informasi Dasar" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Kode <span className="text-destructive">*</span></Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="Contoh: JKT"
              required
              data-testid="input-code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Contoh: Terminal Jakarta"
              required
              data-testid="input-name"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">Kota</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            placeholder="Contoh: Jakarta"
            data-testid="input-city"
          />
        </div>

        <SectionDivider label="Koordinat" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="lat">Lintang (Latitude)</Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={formData.lat}
              onChange={(e) => setFormData(prev => ({ ...prev, lat: e.target.value }))}
              placeholder="Contoh: -6.2088"
              data-testid="input-lat"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lng">Bujur (Longitude)</Label>
            <Input
              id="lng"
              type="number"
              step="any"
              value={formData.lng}
              onChange={(e) => setFormData(prev => ({ ...prev, lng: e.target.value }))}
              placeholder="Contoh: 106.8456"
              data-testid="input-lng"
            />
          </div>
        </div>

        <SectionDivider label="Konfigurasi" />
        <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">Ini adalah Outlet</p>
            <p className="text-xs text-muted-foreground">Halte ini berfungsi sebagai outlet penjualan tiket</p>
          </div>
          <Switch
            id="isOutlet"
            checked={formData.isOutlet}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOutlet: checked }))}
            data-testid="switch-outlet"
          />
        </div>
      </MasterFormDialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Halte"
        description="Apakah Anda yakin ingin menghapus halte ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table data-testid="stops-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kota</TableHead>
                  <TableHead>Koordinat</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada data halte'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map(stop => (
                    <TableRow key={stop.id} data-testid={`stop-row-${stop.code}`}>
                      <TableCell className="font-mono font-medium">{stop.code}</TableCell>
                      <TableCell className="font-medium">{stop.name}</TableCell>
                      <TableCell>{stop.city || '-'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {stop.lat && stop.lng ? `${stop.lat}, ${stop.lng}` : '-'}
                      </TableCell>
                      <TableCell>
                        {stop.isOutlet ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Ya
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <XCircle className="h-3 w-3" />
                            Tidak
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu
                          actions={[
                            { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(stop) },
                            { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(stop.id), variant: 'destructive', disabled: deleteMutation.isPending },
                          ]}
                          data-testid={`actions-stop-${stop.code}`}
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
    </div>
  );
}
