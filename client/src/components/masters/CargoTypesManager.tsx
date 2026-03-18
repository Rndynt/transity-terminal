import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoTypesApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Pencil, Trash2 } from 'lucide-react';
import { RowActionsMenu } from './RowActionsMenu';
import type { CargoType } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';

export default function CargoTypesManager() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', maxWeightKg: '', isActive: true });

  const { data: cargoTypes = [], isLoading } = useQuery<CargoType[]>({
    queryKey: ['/api/cargo-types'],
    queryFn: cargoTypesApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CargoType>) => cargoTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-types'] });
      toast({ title: 'Berhasil', description: 'Jenis kargo berhasil dibuat' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CargoType> }) => cargoTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-types'] });
      toast({ title: 'Berhasil', description: 'Jenis kargo diperbarui' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cargoTypesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-types'] });
      toast({ title: 'Dihapus', description: 'Jenis kargo berhasil dihapus' });
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const resetForm = () => {
    setForm({ code: '', name: '', description: '', maxWeightKg: '', isActive: true });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (ct: CargoType) => {
    setForm({
      code: ct.code,
      name: ct.name,
      description: ct.description || '',
      maxWeightKg: ct.maxWeightKg || '',
      isActive: ct.isActive !== false
    });
    setEditId(ct.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.code.trim() || !form.name.trim()) return;
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      maxWeightKg: form.maxWeightKg ? form.maxWeightKg : null,
      isActive: form.isActive
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredData = cargoTypes.filter(ct => {
    const s = searchQuery.toLowerCase();
    return (
      ct.code.toLowerCase().includes(s) ||
      ct.name.toLowerCase().includes(s) ||
      (ct.description?.toLowerCase().includes(s) ?? false)
    );
  });

  return (
    <div data-testid="cargo-types-manager" className="space-y-4">
      <MasterPageHeader 
        title="Jenis Kargo" 
        description="Kelola jenis dan kategori kargo" 
        searchValue={searchQuery} 
        onSearchChange={setSearchQuery} 
        searchPlaceholder="Cari kode atau nama..." 
        count={filteredData.length} 
        action={
          <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="btn-add-cargo-type">
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </Button>
        } 
      />

      <MasterFormDialog 
        open={showForm} 
        onOpenChange={(open) => !open && resetForm()} 
        title={editId ? 'Edit Jenis Kargo' : 'Tambah Jenis Kargo'} 
        description="Isi informasi jenis kargo di bawah ini." 
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} 
        isPending={isPending}
        data-testid="cargo-type-form-dialog"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Kode *</Label>
            <Input
              id="code"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="PKT"
              data-testid="input-cargo-type-code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nama *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Paket Reguler"
              data-testid="input-cargo-type-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Input
              id="description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Paket umum, max 50kg"
              data-testid="input-cargo-type-desc"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxWeight">Maks. Berat (kg)</Label>
            <Input
              id="maxWeight"
              type="number"
              value={form.maxWeightKg}
              onChange={e => setForm(f => ({ ...f, maxWeightKg: e.target.value }))}
              placeholder="50"
              data-testid="input-cargo-type-max-weight"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Aktif</p>
            </div>
            <Switch
              id="isActive"
              checked={form.isActive}
              onCheckedChange={checked => setForm(f => ({ ...f, isActive: !!checked }))}
              data-testid="input-cargo-type-active"
            />
          </div>
        </div>
      </MasterFormDialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
          <p className="text-sm font-medium">
            {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada jenis kargo'}
          </p>
          {!searchQuery && <p className="text-xs text-muted-foreground/60 mt-1">Tambahkan jenis kargo untuk mengelola tarif</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredData.map((ct: CargoType) => (
            <div
              key={ct.id}
              className={`bg-card border rounded-lg p-3 flex items-center justify-between ${ct.isActive !== false ? 'border-border' : 'border-border/60 opacity-60'}`}
              data-testid={`cargo-type-${ct.id}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{ct.code}</span>
                  <span className="text-sm font-medium text-foreground">{ct.name}</span>
                  {ct.isActive === false && <span className="text-[10px] text-destructive font-medium">Nonaktif</span>}
                </div>
                <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                  {ct.description && <span>{ct.description}</span>}
                  {ct.maxWeightKg && <span>Maks. {ct.maxWeightKg} kg</span>}
                </div>
              </div>
              <RowActionsMenu
                actions={[
                  { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => startEdit(ct) },
                  { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteConfirmId(ct.id), variant: 'destructive' },
                ]}
                data-testid={`actions-cargo-type-${ct.id}`}
              />
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteMutation.mutate(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
