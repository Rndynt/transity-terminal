import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { promotionsApi, vouchersApi, tripPatternsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, Pencil, Trash2, Ticket, Copy, Ban, ChevronDown, ChevronUp, Percent, DollarSign, Check } from 'lucide-react';
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
import type { Promotion, Voucher, TripPattern } from '@shared/schema';

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global (Semua)' },
  { value: 'pattern', label: 'Rute Tertentu' },
  { value: 'trip', label: 'Trip Tertentu' },
  { value: 'channel', label: 'Channel Tertentu' },
];

const CHANNEL_OPTIONS = [
  { value: 'CSO', label: 'CSO' },
  { value: 'WEB', label: 'Web' },
  { value: 'APP', label: 'App' },
  { value: 'OTA', label: 'OTA' },
];

const defaultForm = {
  code: '',
  name: '',
  description: '',
  type: 'percentage' as 'percentage' | 'fixed',
  discountValue: '',
  minPurchase: '',
  maxDiscount: '',
  scope: 'global',
  scopeRefIds: [] as string[],
  applicableChannels: [] as string[],
  usageLimit: '',
  perUserLimit: '',
  requireVoucher: false,
  stackable: false,
  isActive: true,
  validFrom: '',
  validTo: '',
};

function parseScopeRefIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return raw ? [raw] : [];
  }
}

export default function PromosManager() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedPromo, setExpandedPromo] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const [showVoucherGen, setShowVoucherGen] = useState(false);
  const [voucherGenForm, setVoucherGenForm] = useState({ count: '', prefix: '', assignedTo: '' });

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ['/api/promotions'],
    queryFn: promotionsApi.getAll,
  });

  const { data: tripPatterns = [] } = useQuery<TripPattern[]>({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => promotionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      toast({ title: 'Berhasil', description: 'Promo berhasil dibuat' });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => promotionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
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
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (p: Promotion) => {
    setForm({
      code: p.code,
      name: p.name,
      description: p.description || '',
      type: p.type,
      discountValue: p.discountValue,
      minPurchase: p.minPurchase || '',
      maxDiscount: p.maxDiscount || '',
      scope: p.scope || 'global',
      scopeRefIds: parseScopeRefIds(p.scopeRefId),
      applicableChannels: p.applicableChannels || [],
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
  };

  const toggleScopeRef = (id: string) => {
    setForm(f => ({
      ...f,
      scopeRefIds: f.scopeRefIds.includes(id)
        ? f.scopeRefIds.filter(x => x !== id)
        : [...f.scopeRefIds, id],
    }));
  };

  const toggleChannel = (ch: string) => {
    setForm(f => ({
      ...f,
      applicableChannels: f.applicableChannels.includes(ch)
        ? f.applicableChannels.filter(x => x !== ch)
        : [...f.applicableChannels, ch],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.discountValue) return;
    const scopeRefId = form.scopeRefIds.length > 0 ? JSON.stringify(form.scopeRefIds) : null;
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      discountValue: form.discountValue,
      minPurchase: form.minPurchase || '0',
      maxDiscount: form.maxDiscount || null,
      scope: form.scope,
      scopeRefId,
      applicableChannels: form.applicableChannels.length > 0 ? form.applicableChannels : null,
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

  const isPending = createMutation.isPending || updateMutation.isPending;

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
                <VoucherSection promoId={p.id} promoCode={p.code} />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <Label>Scope</Label>
            <SearchableSelect
              value={form.scope}
              onChange={(v) => setForm({ ...form, scope: v, scopeRefIds: [] })}
              options={SCOPE_OPTIONS}
              placeholder="Pilih scope"
              data-testid="select-promo-scope"
            />
          </div>
        </div>

        {form.scope === 'pattern' && (
          <div>
            <Label>Pilih Rute (bisa pilih lebih dari satu)</Label>
            <div className="border rounded-lg max-h-48 overflow-y-auto mt-1" data-testid="scope-pattern-list">
              {tripPatterns.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">Belum ada pola rute</p>
              ) : (
                tripPatterns.map(tp => (
                  <label
                    key={tp.id}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-muted/50 transition-colors ${
                      form.scopeRefIds.includes(tp.id) ? 'bg-blue-50' : ''
                    }`}
                    data-testid={`scope-pattern-${tp.id}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      form.scopeRefIds.includes(tp.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {form.scopeRefIds.includes(tp.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{tp.name}</span>
                      {tp.code && <span className="text-xs text-muted-foreground ml-1.5">({tp.code})</span>}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.scopeRefIds.includes(tp.id)}
                      onChange={() => toggleScopeRef(tp.id)}
                    />
                  </label>
                ))
              )}
            </div>
            {form.scopeRefIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{form.scopeRefIds.length} rute dipilih</p>
            )}
          </div>
        )}

        {form.scope === 'channel' && (
          <div>
            <Label>Pilih Channel (bisa pilih lebih dari satu)</Label>
            <div className="flex flex-wrap gap-2 mt-1" data-testid="scope-channel-list">
              {CHANNEL_OPTIONS.map(ch => (
                <label
                  key={ch.value}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    form.applicableChannels.includes(ch.value)
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid={`scope-channel-${ch.value}`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    form.applicableChannels.includes(ch.value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {form.applicableChannels.includes(ch.value) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-sm font-medium">{ch.label}</span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.applicableChannels.includes(ch.value)}
                    onChange={() => toggleChannel(ch.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

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
              checked={form.requireVoucher}
              onCheckedChange={(v) => setForm({ ...form, requireVoucher: v })}
              data-testid="switch-require-voucher"
            />
            <Label className="mb-0">Perlu Voucher</Label>
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

function VoucherSection({ promoId, promoCode }: { promoId: string; promoCode: string }) {
  const { toast } = useToast();
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({ count: '', prefix: '' });

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
    const count = parseInt(genForm.count);
    if (!count || count < 1) return;
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowGen(!showGen)}
          data-testid={`btn-gen-vouchers-${promoId}`}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Generate
        </Button>
      </div>

      {showGen && (
        <div className="flex items-end gap-2 p-3 bg-background rounded-lg border">
          <div className="flex-1">
            <Label className="text-xs">Jumlah</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={genForm.count}
              onChange={(e) => setGenForm({ ...genForm, count: e.target.value })}
              placeholder="5"
              className="h-8"
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
