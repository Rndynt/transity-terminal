import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoTypesApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Package, Plus, Pencil, Trash2, X, Loader2, Check
} from 'lucide-react';
import type { CargoType } from '@shared/schema';

export default function CargoTypesManager() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  return (
    <div data-testid="cargo-types-manager">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-gray-800">Jenis Kargo</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1">
            {cargoTypes.length} jenis
          </span>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="h-8 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          data-testid="btn-add-cargo-type"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">{editId ? 'Edit Jenis Kargo' : 'Tambah Jenis Kargo'}</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Kode *</label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="PKT"
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                  data-testid="input-cargo-type-code"
                />
              </div>
              <div className="flex-[2]">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Nama *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Paket Reguler"
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                  data-testid="input-cargo-type-name"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Deskripsi</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Paket umum, max 50kg"
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                  data-testid="input-cargo-type-desc"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Maks. Berat (kg)</label>
                <input
                  type="number"
                  value={form.maxWeightKg}
                  onChange={e => setForm(f => ({ ...f, maxWeightKg: e.target.value }))}
                  placeholder="50"
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                  data-testid="input-cargo-type-max-weight"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded"
                  data-testid="input-cargo-type-active"
                />
                Aktif
              </label>
              <button
                onClick={handleSubmit}
                disabled={isPending || !form.code.trim() || !form.name.trim()}
                className="h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                data-testid="btn-save-cargo-type"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editId ? 'Perbarui' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500" />
        </div>
      ) : cargoTypes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">Belum ada jenis kargo</p>
          <p className="text-xs text-gray-300 mt-1">Tambahkan jenis kargo untuk mengelola tarif</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cargoTypes.map((ct: CargoType) => (
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
                <button
                  onClick={() => startEdit(ct)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  data-testid={`btn-edit-cargo-type-${ct.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(ct.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  data-testid={`btn-del-cargo-type-${ct.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="dialog-delete-type">
          <div className="bg-white rounded-xl p-5 shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Hapus Jenis Kargo</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Apakah Anda yakin ingin menghapus jenis kargo ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="h-8 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-cancel-delete-type"
              >
                Batal
              </button>
              <button
                onClick={() => { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); }}
                className="h-8 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="btn-confirm-delete-type"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
