import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoRatesApi, cargoTypesApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign, Plus, Pencil, Trash2, X, Loader2, Check, ArrowRight
} from 'lucide-react';
import type { CargoType, CargoRate, Stop } from '@/types';

const fmt = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

export default function CargoRatesPage() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterTypeId, setFilterTypeId] = useState('');
  const [form, setForm] = useState({
    cargoTypeId: '', originStopId: '', destinationStopId: '',
    pricePerKg: '', minCharge: '', isActive: true
  });

  const { data: cargoTypes = [] } = useQuery<CargoType[]>({
    queryKey: ['/api/cargo-types'],
    queryFn: cargoTypesApi.getAll
  });

  const { data: allStops = [] } = useQuery<Stop[]>({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const { data: cargoRates = [], isLoading } = useQuery<CargoRate[]>({
    queryKey: ['/api/cargo-rates', filterTypeId],
    queryFn: () => cargoRatesApi.getAll(filterTypeId || undefined)
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => cargoRatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates'] });
      toast({ title: 'Berhasil', description: 'Tarif kargo berhasil dibuat' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cargoRatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates'] });
      toast({ title: 'Berhasil', description: 'Tarif diperbarui' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cargoRatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates'] });
      toast({ title: 'Dihapus', description: 'Tarif berhasil dihapus' });
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const resetForm = () => {
    setForm({ cargoTypeId: '', originStopId: '', destinationStopId: '', pricePerKg: '', minCharge: '', isActive: true });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (cr: CargoRate) => {
    setForm({
      cargoTypeId: cr.cargoTypeId,
      originStopId: cr.originStopId || '',
      destinationStopId: cr.destinationStopId || '',
      pricePerKg: cr.pricePerKg,
      minCharge: cr.minCharge,
      isActive: cr.isActive !== false
    });
    setEditId(cr.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.cargoTypeId || !form.pricePerKg) return;
    const payload = {
      cargoTypeId: form.cargoTypeId,
      originStopId: form.originStopId || null,
      destinationStopId: form.destinationStopId || null,
      pricePerKg: form.pricePerKg,
      minCharge: form.minCharge || '0',
      isActive: form.isActive
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getTypeName = (id: string) => cargoTypes.find(ct => ct.id === id)?.name || '-';
  const getTypeCode = (id: string) => cargoTypes.find(ct => ct.id === id)?.code || '-';
  const getStopName = (id: string | null) => id ? (allStops.find(s => s.id === id)?.name || '-') : 'Semua';

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="cargo-rates-page">
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between px-3 md:px-5 h-11 md:h-12">
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-gray-800">Tarif Kargo</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1">
              {cargoRates.length} tarif
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterTypeId}
              onChange={e => setFilterTypeId(e.target.value)}
              className="h-8 px-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600"
              data-testid="filter-rate-type"
            >
              <option value="">Semua Jenis</option>
              {cargoTypes.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="h-8 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              data-testid="btn-add-cargo-rate"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {showForm && (
          <div className="max-w-xl mx-auto mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">{editId ? 'Edit Tarif' : 'Tambah Tarif'}</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Jenis Kargo *</label>
                <select
                  value={form.cargoTypeId}
                  onChange={e => setForm(f => ({ ...f, cargoTypeId: e.target.value }))}
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                  data-testid="select-rate-cargo-type"
                >
                  <option value="">Pilih jenis...</option>
                  {cargoTypes.map(ct => (
                    <option key={ct.id} value={ct.id}>{ct.name} ({ct.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Asal (opsional)</label>
                  <select
                    value={form.originStopId}
                    onChange={e => setForm(f => ({ ...f, originStopId: e.target.value }))}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                    data-testid="select-rate-origin"
                  >
                    <option value="">Semua asal</option>
                    {allStops.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Tujuan (opsional)</label>
                  <select
                    value={form.destinationStopId}
                    onChange={e => setForm(f => ({ ...f, destinationStopId: e.target.value }))}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                    data-testid="select-rate-dest"
                  >
                    <option value="">Semua tujuan</option>
                    {allStops.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Harga/kg *</label>
                  <input
                    type="number"
                    value={form.pricePerKg}
                    onChange={e => setForm(f => ({ ...f, pricePerKg: e.target.value }))}
                    placeholder="15000"
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                    data-testid="input-rate-price-per-kg"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Min. Biaya</label>
                  <input
                    type="number"
                    value={form.minCharge}
                    onChange={e => setForm(f => ({ ...f, minCharge: e.target.value }))}
                    placeholder="25000"
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800"
                    data-testid="input-rate-min-charge"
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
                    data-testid="input-rate-active"
                  />
                  Aktif
                </label>
                <button
                  onClick={handleSubmit}
                  disabled={isPending || !form.cargoTypeId || !form.pricePerKg}
                  className="h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  data-testid="btn-save-cargo-rate"
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
        ) : cargoRates.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">Belum ada tarif kargo</p>
            <p className="text-xs text-gray-300 mt-1">Tambahkan tarif berdasarkan jenis dan rute</p>
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-2">
            {cargoRates.map((cr: CargoRate) => (
              <div
                key={cr.id}
                className={`bg-white border rounded-xl p-3 ${cr.isActive !== false ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                data-testid={`cargo-rate-${cr.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{getTypeCode(cr.cargoTypeId)}</span>
                      <span className="text-sm font-medium text-gray-800">{getTypeName(cr.cargoTypeId)}</span>
                      {cr.isActive === false && <span className="text-[10px] text-red-500 font-medium">Nonaktif</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span>{getStopName(cr.originStopId)}</span>
                      <ArrowRight className="w-3 h-3 text-gray-300" />
                      <span>{getStopName(cr.destinationStopId)}</span>
                    </div>
                    <div className="flex gap-3 text-[11px] text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">{fmt(parseFloat(cr.pricePerKg))}/kg</span>
                      {parseFloat(cr.minCharge) > 0 && <span>Min. {fmt(parseFloat(cr.minCharge))}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(cr)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                      data-testid={`btn-edit-cargo-rate-${cr.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Hapus tarif ini?')) deleteMutation.mutate(cr.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      data-testid={`btn-del-cargo-rate-${cr.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
