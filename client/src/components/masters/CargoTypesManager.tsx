import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoTypesApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Package, Plus, Pencil, Trash2, Loader2, Search, X
} from 'lucide-react';
import type { CargoType } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import DeleteConfirmDialog from './DeleteConfirmDialog';

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
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Jenis Kargo</h3>
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {filteredData.length}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowForm(true); }}
            data-testid="btn-add-cargo-type"
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari kode atau nama..."
            className="pl-9 pr-9 h-9"
            data-testid="master-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="master-search-clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent data-testid="cargo-type-form-dialog">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Jenis Kargo' : 'Tambah Jenis Kargo'}</DialogTitle>
            <DialogDescription>
              Isi informasi jenis kargo di bawah ini.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">Kode *</Label>
              <Input
                id="code"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="PKT"
                className="col-span-3"
                data-testid="input-cargo-type-code"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Nama *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Paket Reguler"
                className="col-span-3"
                data-testid="input-cargo-type-name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Deskripsi</Label>
              <Input
                id="description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Paket umum, max 50kg"
                className="col-span-3"
                data-testid="input-cargo-type-desc"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxWeight" className="text-right">Maks. Berat (kg)</Label>
              <Input
                id="maxWeight"
                type="number"
                value={form.maxWeightKg}
                onChange={e => setForm(f => ({ ...f, maxWeightKg: e.target.value }))}
                placeholder="50"
                className="col-span-3"
                data-testid="input-cargo-type-max-weight"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right cursor-pointer">Aktif</Label>
              <div className="col-span-3">
                <Checkbox
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={checked => setForm(f => ({ ...f, isActive: !!checked }))}
                  data-testid="input-cargo-type-active"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="btn-cancel-cargo-type">
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !form.code.trim() || !form.name.trim()}
              data-testid="btn-save-cargo-type"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">
            {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada jenis kargo'}
          </p>
          {!searchQuery && <p className="text-xs text-gray-300 mt-1">Tambahkan jenis kargo untuk mengelola tarif</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredData.map((ct: CargoType) => (
            <div
              key={ct.id}
              className={`bg-white border rounded-xl p-3 flex items-center justify-between ${ct.isActive !== false ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
              data-testid={`cargo-type-${ct.id}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{ct.code}</span>
                  <span className="text-sm font-medium text-gray-800">{ct.name}</span>
                  {ct.isActive === false && <span className="text-[10px] text-red-500 font-medium">Nonaktif</span>}
                </div>
                <div className="flex gap-3 text-[11px] text-gray-400 mt-0.5">
                  {ct.description && <span>{ct.description}</span>}
                  {ct.maxWeightKg && <span>Maks. {ct.maxWeightKg} kg</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startEdit(ct)}
                  className="h-7 w-7 p-0 rounded-lg"
                  data-testid={`btn-edit-cargo-type-${ct.id}`}
                  aria-label="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConfirmId(ct.id)}
                  className="h-7 w-7 p-0 rounded-lg hover:text-red-600 hover:bg-red-50"
                  data-testid={`btn-del-cargo-type-${ct.id}`}
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
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
