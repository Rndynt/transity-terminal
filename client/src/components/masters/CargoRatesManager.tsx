import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cargoRatesApi, cargoTypesApi, stopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign, Plus, Pencil, Trash2, ArrowRight
} from 'lucide-react';
import type { CargoType, CargoRate, Stop, TripPattern, Trip } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';

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
      <MasterPageHeader
        title="Tarif Kargo"
        description="Kelola tarif pengiriman kargo berdasarkan jenis dan rute"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari jenis, rute, atau scope..."
        count={filteredData.length}
        action={
          <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="btn-add-cargo-rate">
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </Button>
        }
      />

      <div className="flex justify-end">
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

      <MasterFormDialog
        open={showForm}
        onOpenChange={(open) => !open && resetForm()}
        title={editId ? 'Edit Tarif' : 'Tambah Tarif'}
        description="Konfigurasi tarif kargo berdasarkan jenis dan jangkauan rute."
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        isPending={isPending}
        data-testid="cargo-rate-form-dialog"
      >
        <div className="space-y-2">
          <Label>Jenis Kargo *</Label>
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

        <div className="space-y-2">
          <Label>Scope</Label>
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

        {form.scope === 'pattern' && (
          <div className="space-y-2">
            <Label>Pola Trip</Label>
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
        )}

        {form.scope === 'trip' && (
          <div className="space-y-2">
            <Label>Trip</Label>
            <Select
              value={form.scopeRefId}
              onValueChange={v => setForm(f => ({ ...f, scopeRefId: v }))}
            >
              <SelectTrigger data-testid="select-rate-trip">
                <SelectValue placeholder="Pilih trip..." />
              </SelectTrigger>
              <SelectContent>
                {trips.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.id.slice(0, 8)}...</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Asal</Label>
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
          <div className="space-y-2">
            <Label>Tujuan</Label>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pricePerKg">Harga/kg *</Label>
            <Input
              id="pricePerKg"
              type="number"
              value={form.pricePerKg}
              onChange={e => setForm(f => ({ ...f, pricePerKg: e.target.value }))}
              placeholder="15000"
              data-testid="input-rate-price-per-kg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricePerLeg">Harga/leg</Label>
            <Input
              id="pricePerLeg"
              type="number"
              value={form.pricePerLeg}
              onChange={e => setForm(f => ({ ...f, pricePerLeg: e.target.value }))}
              placeholder="5000"
              data-testid="input-rate-price-per-leg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minCharge">Min. Biaya</Label>
            <Input
              id="minCharge"
              type="number"
              value={form.minCharge}
              onChange={e => setForm(f => ({ ...f, minCharge: e.target.value }))}
              placeholder="25000"
              data-testid="input-rate-min-charge"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">Aktif</p>
          </div>
          <Switch
            id="isActiveRate"
            checked={form.isActive}
            onCheckedChange={checked => setForm(f => ({ ...f, isActive: checked }))}
            data-testid="input-rate-active"
          />
        </div>
      </MasterFormDialog>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada tarif kargo'}
          </p>
          {!searchQuery && <p className="text-xs text-muted-foreground mt-1">Tambahkan tarif berdasarkan jenis dan rute</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredData.map((cr: CargoRate) => (
            <div
              key={cr.id}
              className={`bg-card border rounded-lg p-3 ${cr.isActive !== false ? 'border-border' : 'border-border/60 opacity-60'}`}
              data-testid={`cargo-rate-${cr.id}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{getTypeCode(cr.cargoTypeId)}</span>
                    <span className="text-sm font-medium text-foreground">{getTypeName(cr.cargoTypeId)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{SCOPE_LABELS[cr.scope || 'global']}</span>
                    {cr.scopeRefId && (
                      <span className="text-[10px] text-muted-foreground">{getScopeRefName(cr.scope, cr.scopeRefId)}</span>
                    )}
                    {cr.isActive === false && <span className="text-[10px] text-destructive font-medium">Nonaktif</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{getStopName(cr.originStopId)}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                    <span>{getStopName(cr.destinationStopId)}</span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">{fmt(parseFloat(cr.pricePerKg))}/kg</span>
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
                    <Pencil className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmId(cr.id)}
                    className="h-7 w-7 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                    data-testid={`btn-del-cargo-rate-${cr.id}`}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
