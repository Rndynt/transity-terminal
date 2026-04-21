import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { promotionsApi, vouchersApi, tripPatternsApi, tripsApi, outletsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Ticket, Copy, Ban, ChevronDown, ChevronUp, Percent, DollarSign, Check, Search, X } from 'lucide-react';
import { RowActionsMenu } from './RowActionsMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import type { Promotion, Voucher, TripPattern, TripWithDetails, Outlet } from '@shared/schema';

const CONDITION_TYPE_OPTIONS = [
  { value: 'route', label: 'Rute' },
  { value: 'trip', label: 'Trip' },
  { value: 'channel', label: 'Channel' },
  { value: 'outlet', label: 'Outlet' },
  { value: 'sales_channel', label: 'Sales Channel (OTA)' },
  { value: 'day_of_week', label: 'Hari' },
];

const CHANNEL_OPTIONS = [
  { value: 'CSO', label: 'CSO' },
  { value: 'WEB', label: 'Web' },
  { value: 'APP', label: 'App' },
  { value: 'OTA', label: 'OTA' },
];

const DAY_OPTIONS = [
  { value: '1', label: 'Senin' },
  { value: '2', label: 'Selasa' },
  { value: '3', label: 'Rabu' },
  { value: '4', label: 'Kamis' },
  { value: '5', label: 'Jumat' },
  { value: '6', label: 'Sabtu' },
  { value: '0', label: 'Minggu' },
];

interface ConditionDraft {
  type: string;
  values: string[];
}

const defaultForm = {
  code: '',
  name: '',
  description: '',
  type: 'percentage' as 'percentage' | 'fixed',
  discountValue: '',
  minPurchase: '',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '',
  requireVoucher: false,
  stackable: false,
  isActive: true,
  validFrom: '',
  validTo: '',
};

interface MSOption { value: string; label: string; sub?: string }
interface MultiSearchSelectProps {
  label?: string;
  options: MSOption[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  testId?: string;
}

function MultiSearchSelect({ label, options, selected, onToggle, placeholder = 'Cari...', emptyText = 'Tidak ada data', testId = 'multi-search' }: MultiSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
  );
  const selectedLabels = options.filter(o => selected.includes(o.value));

  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className={label ? 'mt-1' : ''}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full min-h-[36px] px-3 py-1.5 bg-background border rounded-lg text-left flex items-center gap-2 hover:border-gray-400 transition-colors"
          data-testid={`${testId}-trigger`}
        >
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          {selectedLabels.length === 0 ? (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedLabels.map(o => (
                <span key={o.value} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {o.label}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-blue-900"
                    onClick={(e) => { e.stopPropagation(); onToggle(o.value); }}
                  />
                </span>
              ))}
            </div>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="border rounded-lg mt-1 bg-background shadow-lg z-50 relative" data-testid={`${testId}-dropdown`}>
            <div className="p-2 border-b">
              <div className="flex items-center gap-2 px-2 h-8 bg-muted/50 rounded-md">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  autoFocus
                  data-testid={`${testId}-search`}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">{emptyText}</p>
              ) : (
                filtered.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onToggle(o.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-b last:border-b-0 hover:bg-muted/50 transition-colors ${
                      selected.includes(o.value) ? 'bg-blue-50' : ''
                    }`}
                    data-testid={`${testId}-item-${o.value}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selected.includes(o.value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {selected.includes(o.value) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{o.label}</span>
                      {o.sub && <span className="text-xs text-muted-foreground ml-1.5">({o.sub})</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConditionRowProps {
  index: number;
  condition: ConditionDraft;
  usedTypes: string[];
  tripPatterns: TripPattern[];
  allTrips: TripWithDetails[];
  outlets: Outlet[];
  onChange: (i: number, next: ConditionDraft) => void;
  onRemove: (i: number) => void;
}

function ConditionRow({ index, condition, usedTypes, tripPatterns, allTrips, outlets, onChange, onRemove }: ConditionRowProps) {
  const [salesInput, setSalesInput] = useState('');
  const typeOptions = CONDITION_TYPE_OPTIONS.filter(o => o.value === condition.type || !usedTypes.includes(o.value));

  const toggle = (value: string) => {
    const next = condition.values.includes(value)
      ? condition.values.filter(v => v !== value)
      : [...condition.values, value];
    onChange(index, { ...condition, values: next });
  };

  const setType = (newType: string) => {
    onChange(index, { type: newType, values: [] });
    setSalesInput('');
  };

  const addSalesChannel = () => {
    const v = salesInput.trim();
    if (!v || condition.values.includes(v)) return;
    onChange(index, { ...condition, values: [...condition.values, v] });
    setSalesInput('');
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/30 space-y-2" data-testid={`condition-row-${index}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Label className="text-xs">Tipe Kondisi</Label>
          <SearchableSelect
            value={condition.type}
            onChange={setType}
            options={typeOptions}
            placeholder="Pilih kondisi"
            data-testid={`select-condition-type-${index}`}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-red-600 mt-5"
          onClick={() => onRemove(index)}
          data-testid={`btn-remove-condition-${index}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {condition.type === 'route' && (
        <MultiSearchSelect
          options={tripPatterns.map(tp => ({ value: tp.id, label: tp.name, sub: tp.code || undefined }))}
          selected={condition.values}
          onToggle={toggle}
          placeholder="Pilih rute..."
          emptyText="Belum ada pola rute"
          testId={`condition-route-${index}`}
        />
      )}

      {condition.type === 'trip' && (
        <MultiSearchSelect
          options={allTrips.map(t => ({
            value: t.id,
            label: `${t.patternName || 'Trip'} — ${t.serviceDate}`,
            sub: t.vehiclePlate || t.vehicleCode || undefined,
          }))}
          selected={condition.values}
          onToggle={toggle}
          placeholder="Pilih trip..."
          emptyText="Belum ada trip"
          testId={`condition-trip-${index}`}
        />
      )}

      {condition.type === 'channel' && (
        <ChipPicker
          options={CHANNEL_OPTIONS}
          selected={condition.values}
          onToggle={toggle}
          testId={`condition-channel-${index}`}
        />
      )}

      {condition.type === 'outlet' && (
        <MultiSearchSelect
          options={outlets.map(o => ({ value: o.id, label: o.name }))}
          selected={condition.values}
          onToggle={toggle}
          placeholder="Pilih outlet..."
          emptyText="Belum ada outlet"
          testId={`condition-outlet-${index}`}
        />
      )}

      {condition.type === 'sales_channel' && (
        <div>
          <Label className="text-xs">Kode Sales Channel (mis. TRAVELOKA, TIKETCOM)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={salesInput}
              onChange={(e) => setSalesInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSalesChannel(); } }}
              placeholder="Ketik kode lalu Enter atau klik +"
              className="font-mono"
              data-testid={`input-sales-channel-${index}`}
            />
            <Button type="button" size="sm" onClick={addSalesChannel} data-testid={`btn-add-sales-channel-${index}`}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          {condition.values.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {condition.values.map(v => (
                <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-medium">
                  {v}
                  <X className="w-3 h-3 cursor-pointer hover:text-blue-900" onClick={() => toggle(v)} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {condition.type === 'day_of_week' && (
        <ChipPicker
          options={DAY_OPTIONS}
          selected={condition.values}
          onToggle={toggle}
          testId={`condition-dow-${index}`}
        />
      )}

      {condition.values.length === 0 && condition.type && (
        <p className="text-xs text-amber-600">Pilih minimal 1 nilai, atau hapus baris ini.</p>
      )}
    </div>
  );
}

function ChipPicker({ options, selected, onToggle, testId }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void; testId: string }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid={`${testId}-list`}>
      {options.map(opt => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
              active ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 hover:border-gray-300'
            }`}
            data-testid={`${testId}-${opt.value}`}
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
              active ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
            }`}>
              {active && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className="text-sm font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function PromosManager() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedPromo, setExpandedPromo] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [conditionsLoading, setConditionsLoading] = useState(false);

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ['/api/promotions'],
    queryFn: promotionsApi.getAll,
  });

  const { data: tripPatterns = [] } = useQuery<TripPattern[]>({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
  });

  const { data: allTrips = [] } = useQuery<TripWithDetails[]>({
    queryKey: ['/api/trips'],
    queryFn: () => tripsApi.getAll(),
  });

  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['/api/outlets'],
    queryFn: outletsApi.getAll,
  });

  const saveConditions = async (promoId: string) => {
    const cleaned = conditions
      .filter(c => c.type && c.values.length > 0)
      .map(c => ({ type: c.type, values: c.values }));
    await promotionsApi.replaceConditions(promoId, cleaned);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const promo = await promotionsApi.create(data);
      await saveConditions(promo.id);
      return promo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      toast({ title: 'Berhasil', description: 'Promo berhasil dibuat' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const promo = await promotionsApi.update(id, data);
      await saveConditions(id);
      return promo;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotions', variables.id, 'conditions'] });
      toast({ title: 'Berhasil', description: 'Promo diperbarui' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      toast({ title: 'Dihapus', description: 'Promo berhasil dihapus' });
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setForm(defaultForm);
    setConditions([]);
    setConditionsLoading(false);
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = async (p: Promotion) => {
    setConditions([]);
    setConditionsLoading(true);
    setForm({
      code: p.code,
      name: p.name,
      description: p.description || '',
      type: p.type,
      discountValue: p.discountValue,
      minPurchase: p.minPurchase || '',
      maxDiscount: p.maxDiscount || '',
      usageLimit: p.usageLimit?.toString() || '',
      perUserLimit: p.perUserLimit?.toString() || '',
      requireVoucher: p.requireVoucher ?? false,
      stackable: p.stackable ?? false,
      isActive: p.isActive ?? true,
      validFrom: p.validFrom ? new Date(p.validFrom).toISOString().slice(0, 16) : '',
      validTo: p.validTo ? new Date(p.validTo).toISOString().slice(0, 16) : '',
    });
    setEditId(p.id);
    setShowForm(true);
    try {
      const existing = await promotionsApi.getConditions(p.id);
      setEditId(currentId => {
        if (currentId === p.id) {
          setConditions(existing.map(c => ({ type: c.type, values: c.values })));
        }
        return currentId;
      });
    } catch {
      // Keep empty on fetch failure
    } finally {
      setEditId(currentId => {
        if (currentId === p.id) setConditionsLoading(false);
        return currentId;
      });
    }
  };

  const addCondition = () => {
    const used = conditions.map(c => c.type);
    const next = CONDITION_TYPE_OPTIONS.find(o => !used.includes(o.value));
    if (!next) return;
    setConditions([...conditions, { type: next.value, values: [] }]);
  };

  const updateCondition = (i: number, next: ConditionDraft) => {
    setConditions(cs => cs.map((c, idx) => idx === i ? next : c));
  };

  const removeCondition = (i: number) => {
    setConditions(cs => cs.filter((_, idx) => idx !== i));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.discountValue) return;
    if (conditionsLoading) {
      toast({ title: 'Mohon tunggu', description: 'Kondisi promo masih dimuat.', variant: 'destructive' });
      return;
    }
    const invalid = conditions.find(c => c.type && c.values.length === 0);
    if (invalid) {
      toast({ title: 'Kondisi belum lengkap', description: `Kondisi "${invalid.type}" tidak punya nilai. Hapus atau isi nilainya.`, variant: 'destructive' });
      return;
    }
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      discountValue: form.discountValue,
      minPurchase: form.minPurchase || '0',
      maxDiscount: form.maxDiscount || null,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
      perUserLimit: form.perUserLimit ? parseInt(form.perUserLimit) : null,
      requireVoucher: form.requireVoucher,
      stackable: form.stackable,
      isActive: form.isActive,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
      validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = promotions.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  const formatDiscount = (p: Promotion) => {
    if (p.type === 'percentage') return `${p.discountValue}%`;
    return `Rp ${Number(p.discountValue).toLocaleString('id-ID')}`;
  };

  const formatDate = (d: string | Date | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isPending = createMutation.isPending || updateMutation.isPending || conditionsLoading;
  const usedTypes = conditions.map(c => c.type);
  const canAddCondition = usedTypes.length < CONDITION_TYPE_OPTIONS.length;

  return (
    <div className="space-y-4">
      <MasterPageHeader
        title="Promo & Voucher"
        description="Kelola promo dan voucher diskon"
        count={filtered.length}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari kode atau nama promo..."
        action={
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} data-testid="btn-add-promo">
            <Plus className="w-4 h-4 mr-1" /> Tambah Promo
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Belum ada promo</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="border rounded-xl bg-card" data-testid={`promo-card-${p.id}`}>
              <div className="flex items-center justify-between p-3 sm:p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {p.type === 'percentage' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm" data-testid={`promo-code-${p.id}`}>{p.code}</span>
                      <Badge variant={p.isActive ? 'default' : 'secondary'} className="text-xs">
                        {p.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      {p.requireVoucher && <Badge variant="outline" className="text-xs">Perlu Voucher</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{p.name}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">{formatDiscount(p)}</span>
                      <span>{formatDate(p.validFrom)} — {formatDate(p.validTo)}</span>
                      {p.usageLimit && <span>{p.usageCount ?? 0}/{p.usageLimit} dipakai</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setExpandedPromo(expandedPromo === p.id ? null : p.id)}
                    data-testid={`btn-toggle-vouchers-${p.id}`}
                  >
                    {expandedPromo === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <RowActionsMenu
                    actions={[
                      { label: 'Edit', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => startEdit(p) },
                      { label: 'Hapus', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteConfirmId(p.id), variant: 'destructive' },
                    ]}
                  />
                </div>
              </div>

              {expandedPromo === p.id && (
                <VoucherSection promoId={p.id} promoCode={p.code} requireVoucher={p.requireVoucher ?? false} />
              )}
            </div>
          ))}
        </div>
      )}

      <MasterFormDialog
        open={showForm}
        onOpenChange={(open) => { if (!open) resetForm(); }}
        title={editId ? 'Edit Promo' : 'Tambah Promo'}
        description={editId ? 'Ubah konfigurasi promo' : 'Buat promo diskon baru'}
        onSubmit={handleSubmit}
        isPending={isPending}
        size="lg"
        data-testid="promo-form-dialog"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Kode Promo *</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="DISKON50"
              className="font-mono"
              data-testid="input-promo-code"
            />
          </div>
          <div>
            <Label>Nama *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Diskon Lebaran 50%"
              data-testid="input-promo-name"
            />
          </div>
        </div>

        <div>
          <Label>Deskripsi</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Keterangan promo..."
            rows={2}
            data-testid="input-promo-desc"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Tipe Diskon *</Label>
            <SearchableSelect
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v as 'percentage' | 'fixed' })}
              options={[
                { value: 'percentage', label: 'Persentase (%)' },
                { value: 'fixed', label: 'Nominal Tetap (Rp)' },
              ]}
              placeholder="Pilih tipe"
              data-testid="select-promo-type"
            />
          </div>
          <div>
            <Label>Nilai Diskon *</Label>
            <Input
              type="number"
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              placeholder={form.type === 'percentage' ? '50' : '25000'}
              data-testid="input-discount-value"
            />
          </div>
          <div>
            <Label>Maks. Diskon</Label>
            <Input
              type="number"
              value={form.maxDiscount}
              onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
              placeholder="100000"
              data-testid="input-max-discount"
            />
          </div>
        </div>

        <div>
          <Label>Min. Pembelian</Label>
          <Input
            type="number"
            value={form.minPurchase}
            onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
            placeholder="0"
            data-testid="input-min-purchase"
          />
        </div>

        <div className="border rounded-xl p-3 space-y-3 bg-muted/10" data-testid="conditions-builder">
          <div className="flex items-center justify-between">
            <div>
              <Label className="mb-0">Kondisi Berlaku</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Semua kondisi harus terpenuhi (AND). Kosongkan = berlaku untuk semua transaksi.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addCondition}
              disabled={!canAddCondition}
              data-testid="btn-add-condition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Kondisi
            </Button>
          </div>

          {conditions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">
              Tidak ada kondisi — promo berlaku global.
            </p>
          ) : (
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  index={i}
                  condition={c}
                  usedTypes={usedTypes}
                  tripPatterns={tripPatterns}
                  allTrips={allTrips}
                  outlets={outlets}
                  onChange={updateCondition}
                  onRemove={removeCondition}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Berlaku Dari</Label>
            <Input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              data-testid="input-valid-from"
            />
          </div>
          <div>
            <Label>Berlaku Hingga</Label>
            <Input
              type="datetime-local"
              value={form.validTo}
              onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              data-testid="input-valid-to"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Batas Penggunaan Total</Label>
            <Input
              type="number"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              placeholder="Kosongkan = unlimited"
              data-testid="input-usage-limit"
            />
          </div>
          <div>
            <Label>Batas Per User</Label>
            <Input
              type="number"
              value={form.perUserLimit}
              onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
              placeholder="Kosongkan = unlimited"
              data-testid="input-per-user-limit"
            />
          </div>
        </div>

        <div className="border rounded-xl p-3 bg-amber-50/40 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Label className="mb-0 text-sm font-semibold">Cara Pakai</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.requireVoucher
                  ? 'User harus input kode voucher manual saat booking. Generate voucher di bawah setelah simpan.'
                  : 'Promo otomatis diterapkan ke booking yang cocok dengan kondisi di atas (tanpa input kode).'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={form.requireVoucher}
                onCheckedChange={(v) => setForm({ ...form, requireVoucher: v })}
                data-testid="switch-require-voucher"
              />
              <Label className="mb-0 text-sm">Perlu Voucher</Label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              data-testid="switch-is-active"
            />
            <Label className="mb-0">Aktif</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.stackable}
              onCheckedChange={(v) => setForm({ ...form, stackable: v })}
              data-testid="switch-stackable"
            />
            <Label className="mb-0">Bisa Ditumpuk</Label>
          </div>
        </div>
      </MasterFormDialog>

      <DeleteConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteMutation.mutate(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        title="Hapus Promo?"
        description="Semua voucher terkait juga akan dihapus. Aksi ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function VoucherSection({ promoId, promoCode, requireVoucher }: { promoId: string; promoCode: string; requireVoucher: boolean }) {
  const { toast } = useToast();
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({ count: '', prefix: '' });
  const [genError, setGenError] = useState('');

  const { data: vouchers = [], isLoading } = useQuery<Voucher[]>({
    queryKey: ['/api/vouchers', promoId],
    queryFn: () => vouchersApi.getAll(promoId),
  });

  const generateMutation = useMutation({
    mutationFn: (data: any) => vouchersApi.generate(data),
    onSuccess: (newVouchers) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers', promoId] });
      toast({ title: 'Berhasil', description: `${newVouchers.length} voucher dibuat` });
      setShowGen(false);
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => vouchersApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers', promoId] });
      toast({ title: 'Voucher dicabut' });
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vouchersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers', promoId] });
      toast({ title: 'Voucher dihapus' });
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const handleGenerate = () => {
    setGenError('');
    const count = parseInt(genForm.count);
    if (!genForm.count.trim()) {
      setGenError('Jumlah wajib diisi');
      return;
    }
    if (!count || count < 1) {
      setGenError('Jumlah minimal 1');
      return;
    }
    if (count > 100) {
      setGenError('Maksimal 100 per generate');
      return;
    }
    generateMutation.mutate({
      promoId,
      count,
      prefix: genForm.prefix || undefined,
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Disalin', description: `Kode ${code} disalin ke clipboard` });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: 'Aktif', variant: 'default' },
      used: { label: 'Digunakan', variant: 'secondary' },
      expired: { label: 'Kadaluarsa', variant: 'outline' },
      revoked: { label: 'Dicabut', variant: 'destructive' },
    };
    const s = map[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={s.variant} className="text-xs">{s.label}</Badge>;
  };

  return (
    <div className="border-t px-3 sm:px-4 py-3 bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Voucher ({vouchers.length})</span>
        </div>
        {requireVoucher ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowGen(!showGen)}
            data-testid={`btn-gen-vouchers-${promoId}`}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Generate
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground italic" data-testid={`voucher-disabled-hint-${promoId}`}>
            Aktifkan "Perlu Voucher" untuk generate
          </span>
        )}
      </div>

      {showGen && (
        <div className="p-3 bg-background rounded-lg border space-y-2">
          <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Jumlah</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={genForm.count}
              onChange={(e) => { setGenForm({ ...genForm, count: e.target.value }); setGenError(''); }}
              placeholder="5"
              className={`h-8 ${genError ? 'border-red-400 focus:ring-red-200' : ''}`}
              data-testid={`input-gen-count-${promoId}`}
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Prefix (opsional)</Label>
            <Input
              value={genForm.prefix}
              onChange={(e) => setGenForm({ ...genForm, prefix: e.target.value.toUpperCase() })}
              placeholder={promoCode}
              className="h-8 font-mono"
              data-testid={`input-gen-prefix-${promoId}`}
            />
          </div>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            data-testid={`btn-gen-submit-${promoId}`}
          >
            {generateMutation.isPending ? 'Generating...' : 'Buat'}
          </Button>
          </div>
          {genError && (
            <p className="text-xs text-red-500" data-testid={`gen-error-${promoId}`}>{genError}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-muted-foreground text-center py-2">Memuat voucher...</div>
      ) : vouchers.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-2">Belum ada voucher</div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {vouchers.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 text-sm" data-testid={`voucher-row-${v.id}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-medium" data-testid={`voucher-code-${v.id}`}>{v.code}</span>
                {statusBadge(v.status || 'active')}
                {v.assignedTo && <span className="text-xs text-muted-foreground truncate">{v.assignedTo}</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(v.code)} data-testid={`btn-copy-voucher-${v.id}`}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                {v.status === 'active' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600" onClick={() => revokeMutation.mutate(v.id)} data-testid={`btn-revoke-voucher-${v.id}`}>
                    <Ban className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => deleteMutation.mutate(v.id)} data-testid={`btn-delete-voucher-${v.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
