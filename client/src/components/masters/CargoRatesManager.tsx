import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoRatesApi, cargoTypesApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign, Plus, Pencil, Trash2, Loader2, ArrowRight, Search, X
} from 'lucide-react';
import type { CargoType, CargoRate, Stop, TripPattern, Trip } from '@shared/schema';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DeleteConfirmDialog from './DeleteConfirmDialog';

const fmt = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  pattern: 'Pola Trip',
  trip: 'Trip Spesifik'
};

export default function CargoRatesManager() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterTypeId, setFilterTypeId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({
    cargoTypeId: '', scope: 'global' as string, scopeRefId: '',
    originStopId: '', destinationStopId: '',
    pricePerKg: '', pricePerLeg: '', minCharge: '', isActive: true
  });

  const { data: cargoTypes = [] } = useQuery<CargoType[]>({
    queryKey: ['/api/cargo-types'],
    queryFn: cargoTypesApi.getAll
  });

  const { data: allStops = [] } = useQuery<Stop[]>({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const { data: patterns = [] } = useQuery<TripPattern[]>({
    queryKey: ['/api/trip-patterns'],
    queryFn: () => fetch('/api/trip-patterns').then(r => r.json())
  });

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['/api/trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json())
  });

  const { data: cargoRates = [], isLoading } = useQuery<CargoRate[]>({
    queryKey: ['/api/cargo-rates', filterTypeId === 'all' ? '' : filterTypeId],
    queryFn: () => cargoRatesApi.getAll(filterTypeId === 'all' ? undefined : filterTypeId)
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CargoRate>) => cargoRatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cargo-rates'] });
      toast({ title: 'Berhasil', description: 'Tarif kargo berhasil dibuat' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CargoRate> }) => cargoRatesApi.update(id, data),
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
    setForm({ cargoTypeId: '', scope: 'global', scopeRefId: '', originStopId: '', destinationStopId: '', pricePerKg: '', pricePerLeg: '', minCharge: '', isActive: true });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (cr: CargoRate) => {
    setForm({
      cargoTypeId: cr.cargoTypeId,
      scope: cr.scope || 'global',
      scopeRefId: cr.scopeRefId || '',
      originStopId: cr.originStopId || '',
      destinationStopId: cr.destinationStopId || '',
      pricePerKg: cr.pricePerKg,
      pricePerLeg: cr.pricePerLeg || '0',
      minCharge: cr.minCharge,
      isActive: cr.isActive !== false
    });
    setEditId(cr.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.cargoTypeId || !form.pricePerKg) return;
    if (form.scope !== 'global' && !form.scopeRefId) {
      toast({ title: 'Validasi', description: `Pilih ${form.scope === 'pattern' ? 'Pola Trip' : 'Trip'} untuk scope ini`, variant: 'destructive' });
      return;
    }
    const payload = {
      cargoTypeId: form.cargoTypeId,
      scope: form.scope as 'global' | 'pattern' | 'trip',
      scopeRefId: (form.scope !== 'global' && form.scopeRefId) ? form.scopeRefId : null,
      originStopId: form.originStopId || null,
      destinationStopId: form.destinationStopId || null,
      pricePerKg: form.pricePerKg,
      pricePerLeg: form.pricePerLeg || '0',
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
  const getScopeRefName = (scope: string | null, refId: string | null) => {
    if (!scope || scope === 'global' || !refId) return '';
    if (scope === 'pattern') return patterns.find(p => p.id === refId)?.name || refId;
    if (scope === 'trip') return trips.find(t => t.id === refId)?.id?.slice(0,8) || refId;
    return '';
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredData = cargoRates.filter(cr => {
    const s = searchQuery.toLowerCase();
    const typeName = getTypeName(cr.cargoTypeId).toLowerCase();
    const originName = getStopName(cr.originStopId).toLowerCase();
    const destName = getStopName(cr.destinationStopId).toLowerCase();
    const scopeLabel = (SCOPE_LABELS[cr.scope || 'global']).toLowerCase();

    return (
      typeName.includes(s) ||
      originName.includes(s) ||
      destName.includes(s) ||
      scopeLabel.includes(s)
    );
  });

  return (
    <div data-testid="cargo-rates-manager" className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Tarif Kargo</h3>
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {filteredData.length}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowForm(true); }}
            data-testid="btn-add-cargo-rate"
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari jenis, rute, atau scope..."
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
          <Select value={filterTypeId} onValueChange={setFilterTypeId}>
            <SelectTrigger className="w-full sm:w-[180px] h-9" data-testid="filter-rate-type">
              <SelectValue placeholder="Semua Jenis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              {cargoTypes.map(ct => (
                <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent data-testid="cargo-rate-form-dialog">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Tarif' : 'Tambah Tarif'}</DialogTitle>
            <DialogDescription>
              Konfigurasi tarif kargo berdasarkan jenis dan jangkauan rute.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Jenis Kargo *</Label>
              <div className="col-span-3">
                <Select
                  value={form.cargoTypeId}
                  onValueChange={v => setForm(f => ({ ...f, cargoTypeId: v }))}
                >
                  <SelectTrigger data-testid="select-rate-cargo-type">
                    <SelectValue placeholder="Pilih jenis..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cargoTypes.map(ct => (
                      <SelectItem key={ct.id} value={ct.id}>{ct.name} ({ct.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Scope</Label>
              <div className="col-span-3">
                <Select
                  value={form.scope}
                  onValueChange={v => setForm(f => ({ ...f, scope: v, scopeRefId: '' }))}
                >
                  <SelectTrigger data-testid="select-rate-scope">
                    <SelectValue placeholder="Pilih scope..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="pattern">Pola Trip</SelectItem>
                    <SelectItem value="trip">Trip Spesifik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.scope === 'pattern' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Pola Trip</Label>
                <div className="col-span-3">
                  <Select
                    value={form.scopeRefId}
                    onValueChange={v => setForm(f => ({ ...f, scopeRefId: v }))}
                  >
                    <SelectTrigger data-testid="select-rate-pattern">
                      <SelectValue placeholder="Pilih pola..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patterns.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {form.scope === 'trip' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Trip</Label>
                <div className="col-span-3">
                  <Select
                    value={form.scopeRefId}
                    onValueChange={v => setForm(f => ({ ...f, scopeRefId: v }))}
                  >
                    <SelectTrigger data-testid="select-rate-trip">
                      <SelectValue placeholder="Pilih trip..." />
                    </SelectTrigger>
                    <SelectContent>
                      {trips.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.id.slice(0,8)}...</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Asal</Label>
              <div className="col-span-3">
                <Select
                  value={form.originStopId || 'all'}
                  onValueChange={v => setForm(f => ({ ...f, originStopId: v === 'all' ? '' : v }))}
                >
                  <SelectTrigger data-testid="select-rate-origin">
                    <SelectValue placeholder="Semua asal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua asal</SelectItem>
                    {allStops.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tujuan</Label>
              <div className="col-span-3">
                <Select
                  value={form.destinationStopId || 'all'}
                  onValueChange={v => setForm(f => ({ ...f, destinationStopId: v === 'all' ? '' : v }))}
                >
                  <SelectTrigger data-testid="select-rate-dest">
                    <SelectValue placeholder="Semua tujuan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua tujuan</SelectItem>
                    {allStops.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pricePerKg" className="text-right">Harga/kg *</Label>
              <Input
                id="pricePerKg"
                type="number"
                value={form.pricePerKg}
                onChange={e => setForm(f => ({ ...f, pricePerKg: e.target.value }))}
                placeholder="15000"
                className="col-span-3"
                data-testid="input-rate-price-per-kg"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pricePerLeg" className="text-right">Harga/leg</Label>
              <Input
                id="pricePerLeg"
                type="number"
                value={form.pricePerLeg}
                onChange={e => setForm(f => ({ ...f, pricePerLeg: e.target.value }))}
                placeholder="5000"
                className="col-span-3"
                data-testid="input-rate-price-per-leg"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="minCharge" className="text-right">Min. Biaya</Label>
              <Input
                id="minCharge"
                type="number"
                value={form.minCharge}
                onChange={e => setForm(f => ({ ...f, minCharge: e.target.value }))}
                placeholder="25000"
                className="col-span-3"
                data-testid="input-rate-min-charge"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActiveRate" className="text-right cursor-pointer">Aktif</Label>
              <div className="col-span-3">
                <Checkbox
                  id="isActiveRate"
                  checked={form.isActive}
                  onCheckedChange={checked => setForm(f => ({ ...f, isActive: !!checked }))}
                  data-testid="input-rate-active"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="btn-cancel-cargo-rate">
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !form.cargoTypeId || !form.pricePerKg}
              data-testid="btn-save-cargo-rate"
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
          <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">
            {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada tarif kargo'}
          </p>
          {!searchQuery && <p className="text-xs text-gray-300 mt-1">Tambahkan tarif berdasarkan jenis dan rute</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredData.map((cr: CargoRate) => (
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{SCOPE_LABELS[cr.scope || 'global']}</span>
                    {cr.scopeRefId && (
                      <span className="text-[10px] text-gray-400">{getScopeRefName(cr.scope, cr.scopeRefId)}</span>
                    )}
                    {cr.isActive === false && <span className="text-[10px] text-red-500 font-medium">Nonaktif</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span>{getStopName(cr.originStopId)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                    <span>{getStopName(cr.destinationStopId)}</span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-gray-500 mt-1">
                    <span className="font-semibold text-gray-700">{fmt(parseFloat(cr.pricePerKg))}/kg</span>
                    {parseFloat(cr.pricePerLeg || '0') > 0 && <span>{fmt(parseFloat(cr.pricePerLeg))}/leg</span>}
                    {parseFloat(cr.minCharge) > 0 && <span>Min. {fmt(parseFloat(cr.minCharge))}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(cr)}
                    className="h-7 w-7 p-0 rounded-lg"
                    data-testid={`btn-edit-cargo-rate-${cr.id}`}
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmId(cr.id)}
                    className="h-7 w-7 p-0 rounded-lg hover:text-red-600 hover:bg-red-50"
                    data-testid={`btn-del-cargo-rate-${cr.id}`}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
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
