import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MasterFormDialog from './MasterFormDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RowActionsMenu } from './RowActionsMenu';
import { useToast } from '@/hooks/use-toast';
import { priceRulesApi, tripPatternsApi, tripsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, DollarSign, Tag, ArrowUpDown, X } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import type { PriceRule, TripPattern, Trip, TripWithDetails } from '@/types';

interface PriceRuleFormData {
  scope: 'pattern' | 'trip' | 'leg' | 'time';
  patternId: string;
  tripId: string;
  legIndex: string;
  pricingMode: 'per_leg' | 'flat';
  basePricePerLeg: string;
  currency: string;
  multiplier: string;
  validFrom: Date | undefined;
  validTo: Date | undefined;
  priority: string;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  pattern: 'Pola',
  trip: 'Trip',
  leg: 'Segmen',
  time: 'Waktu'
};

const SCOPE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pattern: 'secondary',
  trip: 'default',
  leg: 'outline',
  time: 'destructive',
};

const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const PRICING_MODE_LABELS: Record<string, string> = {
  per_leg: 'Legs',
  flat: 'Flat',
};

const DEFAULT_FORM: PriceRuleFormData = {
  scope: 'pattern',
  patternId: '',
  tripId: '',
  legIndex: '',
  pricingMode: 'per_leg',
  basePricePerLeg: '',
  currency: 'IDR',
  multiplier: '1',
  validFrom: undefined,
  validTo: undefined,
  priority: '1',
};

export default function PriceRulesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState<PriceRuleFormData>(DEFAULT_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterPatternId, setFilterPatternId] = useState('');
  const { toast } = useToast();

  const { data: priceRules = [], isLoading } = useQuery({
    queryKey: ['/api/price-rules'],
    queryFn: priceRulesApi.getAll
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['/api/trips'],
    queryFn: () => tripsApi.getAll()
  });

  const patternOptions = patterns.map(p => ({
    value: p.id,
    label: p.name,
    badge: p.code,
    subtitle: p.note || undefined,
  }));

  const tripOptions = trips.map((t: TripWithDetails) => {
    const patternLabel = t.patternCode || t.patternName || '';
    const dateLabel = t.serviceDate
      ? new Date(t.serviceDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    return {
      value: t.id,
      label: `${dateLabel}${t.vehiclePlate ? ` · ${t.vehiclePlate}` : ''}`,
      badge: t.status || 'scheduled',
      subtitle: patternLabel ? `${patternLabel}${t.patternName && t.patternCode ? ` — ${t.patternName}` : ''}` : undefined,
      group: patternLabel || 'Tanpa Pola',
    };
  });

  const buildRule = (data: PriceRuleFormData) => ({
    pricingMode: data.pricingMode || 'per_leg',
    basePricePerLeg: parseFloat(data.basePricePerLeg) || 0,
    currency: data.currency || 'IDR',
    multiplier: parseFloat(data.multiplier) || 1,
  });

  const parseRule = (rule: any): Partial<PriceRuleFormData> => ({
    pricingMode: rule?.pricingMode || 'per_leg',
    basePricePerLeg: rule?.basePricePerLeg?.toString() || '',
    currency: rule?.currency || 'IDR',
    multiplier: rule?.multiplier?.toString() || '1',
  });

  const createMutation = useMutation({
    mutationFn: priceRulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-rules'] });
      setIsDialogOpen(false);
      setFormData(DEFAULT_FORM);
      toast({ title: 'Berhasil', description: 'Aturan harga berhasil dibuat' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal membuat aturan harga', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => priceRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-rules'] });
      setIsDialogOpen(false);
      setFormData(DEFAULT_FORM);
      setEditingRule(null);
      toast({ title: 'Berhasil', description: 'Aturan harga berhasil diperbarui' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal memperbarui aturan harga', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: priceRulesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-rules'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Aturan harga berhasil dihapus' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghapus aturan harga', variant: 'destructive' });
    }
  });

  const handleCreate = () => {
    setEditingRule(null);
    setFormData(DEFAULT_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: PriceRule) => {
    setEditingRule(rule);
    setFormData({
      scope: rule.scope,
      patternId: rule.patternId || '',
      tripId: rule.tripId || '',
      legIndex: rule.legIndex?.toString() || '',
      ...parseRule(rule.rule),
      validFrom: rule.validFrom ? new Date(rule.validFrom) : undefined,
      validTo: rule.validTo ? new Date(rule.validTo) : undefined,
      priority: (rule.priority || 0).toString(),
    } as PriceRuleFormData);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.basePricePerLeg || isNaN(parseFloat(formData.basePricePerLeg))) {
      toast({ title: 'Harga tidak valid', description: 'Masukkan harga dasar yang valid', variant: 'destructive' });
      return;
    }
    const submitData = {
      scope: formData.scope,
      patternId: formData.patternId || null,
      tripId: formData.tripId || null,
      legIndex: formData.legIndex ? parseInt(formData.legIndex, 10) : null,
      rule: buildRule(formData),
      validFrom: formData.validFrom ? formData.validFrom.toISOString() : null,
      validTo: formData.validTo ? formData.validTo.toISOString() : null,
      priority: parseInt(formData.priority, 10) || 1,
    };
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };

  const handleScopeChange = (scope: 'pattern' | 'trip' | 'leg' | 'time') => {
    setFormData(prev => ({ ...prev, scope, patternId: '', tripId: '', legIndex: '' }));
  };

  const getPatternName = (patternId: string) => {
    const p = patterns.find(p => p.id === patternId);
    return p ? `${p.code} — ${p.name}` : '-';
  };

  const getTripLabel = (tripId: string) => {
    const t = trips.find((tr: TripWithDetails) => tr.id === tripId);
    if (!t) return tripId.slice(0, 8);
    const dateStr = t.serviceDate
      ? new Date(t.serviceDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const parts = [t.patternCode || t.patternName, dateStr, t.vehiclePlate].filter(Boolean);
    return parts.join(' · ') || tripId.slice(0, 8);
  };

  const activeFilterCount = [filterScope, filterMode, filterPatternId].filter(Boolean).length;

  const filteredPriceRules = priceRules.filter(rule => {
    if (filterScope && rule.scope !== filterScope) return false;
    const ruleMode = rule.rule?.pricingMode || 'per_leg';
    if (filterMode && ruleMode !== filterMode) return false;
    if (filterPatternId && rule.patternId !== filterPatternId) return false;

    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const scope = rule.scope.toLowerCase();
    const target = (
      rule.scope === 'pattern' && rule.patternId ? getPatternName(rule.patternId) :
      rule.scope === 'trip' && rule.tripId ? getTripLabel(rule.tripId) :
      rule.scope === 'leg' && rule.tripId ? getTripLabel(rule.tripId) : ''
    ).toLowerCase();
    return scope.includes(q) || target.includes(q);
  });

  const clearAllFilters = () => {
    setFilterScope('');
    setFilterMode('');
    setFilterPatternId('');
    setSearchQuery('');
  };

  const scopeFilterOptions = [
    { value: 'pattern', label: 'Pola' },
    { value: 'trip', label: 'Trip' },
    { value: 'leg', label: 'Segmen' },
    { value: 'time', label: 'Waktu' },
  ];

  const modeFilterOptions = [
    { value: 'per_leg', label: 'Legs' },
    { value: 'flat', label: 'Flat' },
  ];

  return (
    <div className="space-y-6" data-testid="price-rules-manager">
      <MasterPageHeader
        title="Aturan Harga"
        description="Kelola aturan penetapan harga untuk pola perjalanan dan trip"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari scope atau rute..."
        count={filteredPriceRules.length}
        action={
          <Button onClick={handleCreate} data-testid="add-price-rule-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Aturan
          </Button>
        }
      />

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect
          value={filterScope}
          options={scopeFilterOptions}
          placeholder="Cakupan"
          searchPlaceholder="Cari..."
          onChange={setFilterScope}
          className="w-32"
        />
        <SearchableSelect
          value={filterMode}
          options={modeFilterOptions}
          placeholder="Mode"
          searchPlaceholder="Cari..."
          onChange={setFilterMode}
          className="w-28"
        />
        <SearchableSelect
          value={filterPatternId}
          options={patternOptions}
          placeholder="Pola rute"
          searchPlaceholder="Cari pola..."
          onChange={setFilterPatternId}
          className="w-48"
        />
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-muted-foreground h-8">
            <X className="w-3 h-3 mr-1" />
            Reset ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* ── Form Dialog ── */}
      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingRule ? 'Edit Aturan Harga' : 'Tambah Aturan Harga'}
        description={editingRule ? 'Perbarui aturan penetapan harga.' : 'Buat aturan harga baru untuk pola atau trip tertentu.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        size="lg"
        data-testid="price-rule-dialog"
      >
        {/* ── Scope ── */}
        <SectionDivider label="Cakupan" />
        <div className="space-y-1.5">
          <Label>Tipe Scope <span className="text-destructive">*</span></Label>
          <Select value={formData.scope} onValueChange={handleScopeChange}>
            <SelectTrigger data-testid="select-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pattern">Pattern — berlaku untuk semua trip di pola ini</SelectItem>
              <SelectItem value="trip">Trip — berlaku untuk trip spesifik</SelectItem>
              <SelectItem value="leg">Leg — berlaku untuk leg tertentu di sebuah trip</SelectItem>
              <SelectItem value="time">Time-based — berlaku berdasarkan waktu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.scope === 'pattern' && (
          <div className="space-y-1.5">
            <Label>Pola Perjalanan <span className="text-destructive">*</span></Label>
            <SearchableSelect
              value={formData.patternId}
              options={patternOptions}
              placeholder="Pilih pola perjalanan..."
              searchPlaceholder="Cari pola..."
              onChange={(v) => setFormData(prev => ({ ...prev, patternId: v }))}
              data-testid="select-pattern"
            />
          </div>
        )}

        {(formData.scope === 'trip' || formData.scope === 'leg') && (
          <div className={formData.scope === 'leg' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
            <div className="space-y-1.5">
              <Label>Trip <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={formData.tripId}
                options={tripOptions}
                placeholder="Pilih trip..."
                searchPlaceholder="Cari ID atau tanggal trip..."
                onChange={(v) => setFormData(prev => ({ ...prev, tripId: v }))}
                data-testid="select-trip"
              />
            </div>
            {formData.scope === 'leg' && (
              <div className="space-y-1.5">
                <Label htmlFor="legIndex">Nomor Leg <span className="text-destructive">*</span></Label>
                <Input
                  id="legIndex"
                  type="number"
                  value={formData.legIndex}
                  onChange={(e) => setFormData(prev => ({ ...prev, legIndex: e.target.value }))}
                  placeholder="Contoh: 1"
                  min="1"
                  data-testid="input-leg-index"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Tarif ── */}
        <SectionDivider label="Tarif" />
        <div className="space-y-1.5">
          <Label>Mode Harga <span className="text-destructive">*</span></Label>
          <Select
            value={formData.pricingMode}
            onValueChange={(v: 'per_leg' | 'flat') => setFormData(prev => ({ ...prev, pricingMode: v }))}
          >
            <SelectTrigger data-testid="select-pricing-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_leg">Legs — harga × jumlah segmen</SelectItem>
              <SelectItem value="flat">Flat — harga tetap</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="basePricePerLeg">
              {formData.pricingMode === 'flat' ? 'Harga Tarif Tetap' : 'Harga Dasar per Leg'} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
              <Input
                id="basePricePerLeg"
                type="number"
                min="0"
                step="1000"
                value={formData.basePricePerLeg}
                onChange={(e) => setFormData(prev => ({ ...prev, basePricePerLeg: e.target.value }))}
                placeholder="65000"
                className="pl-9"
                required
                data-testid="input-base-price"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formData.pricingMode === 'flat'
                ? 'Harga tetap untuk seluruh perjalanan, berapa pun jumlah halte yang dilewati'
                : 'Harga yang dikenakan per segmen perjalanan (leg)'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="multiplier">Multiplier</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">×</span>
              <Input
                id="multiplier"
                type="number"
                min="0"
                step="0.1"
                value={formData.multiplier}
                onChange={(e) => setFormData(prev => ({ ...prev, multiplier: e.target.value }))}
                placeholder="1.0"
                className="pl-7"
                data-testid="input-multiplier"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        {formData.basePricePerLeg && !isNaN(parseFloat(formData.basePricePerLeg)) && (
          <div className="rounded-lg bg-muted/40 border px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formData.pricingMode === 'flat' ? 'Harga tetap per penumpang' : 'Harga efektif per leg'}
            </span>
            <span className="font-semibold text-base">
              {formatRupiah(parseFloat(formData.basePricePerLeg) * (parseFloat(formData.multiplier) || 1))}
            </span>
          </div>
        )}

        {/* ── Periode & Prioritas ── */}
        <SectionDivider label="Periode & Prioritas" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Berlaku Dari</Label>
            <DatePicker
              id="validFrom"
              date={formData.validFrom}
              onDateChange={(date) => setFormData(prev => ({ ...prev, validFrom: date }))}
              placeholder="Pilih tanggal mulai"
              data-testid="input-valid-from"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Berlaku Sampai</Label>
            <DatePicker
              id="validTo"
              date={formData.validTo}
              onDateChange={(date) => setFormData(prev => ({ ...prev, validTo: date }))}
              placeholder="Pilih tanggal akhir"
              data-testid="input-valid-to"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority">Prioritas</Label>
            <Input
              id="priority"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              placeholder="1"
              min="0"
              data-testid="input-priority"
            />
            <p className="text-xs text-muted-foreground">Lebih tinggi = lebih diprioritaskan</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Kosongkan periode jika aturan berlaku tanpa batas waktu</p>
      </MasterFormDialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Aturan Harga"
        description="Apakah Anda yakin ingin menghapus aturan harga ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      {/* ── Table ── */}
      <div className="rounded-md border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Table data-testid="price-rules-table">
            <TableHeader>
              <TableRow className="bg-muted/10 hover:bg-muted/10">
                <TableHead className="w-[90px] font-semibold text-xs uppercase tracking-wide">Cakupan</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide">Target</TableHead>
                <TableHead className="w-[80px] font-semibold text-xs uppercase tracking-wide">Mode</TableHead>
                <TableHead className="w-[160px] font-semibold text-xs uppercase tracking-wide">Harga</TableHead>
                <TableHead className="w-[70px] font-semibold text-xs uppercase tracking-wide">Mult.</TableHead>
                <TableHead className="w-[60px] font-semibold text-xs uppercase tracking-wide">Prior.</TableHead>
                <TableHead className="w-[180px] font-semibold text-xs uppercase tracking-wide">Periode</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPriceRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">
                      {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada aturan harga'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPriceRules.map(rule => {
                  const basePrice = rule.rule?.basePricePerLeg;
                  const multiplier = rule.rule?.multiplier ?? 1;
                  const pricingMode = rule.rule?.pricingMode || 'per_leg';
                  const effectivePrice = basePrice != null ? basePrice * multiplier : null;

                  return (
                    <TableRow key={rule.id} data-testid={`price-rule-${rule.id}`}>
                      {/* Scope */}
                      <TableCell>
                        <Badge
                          variant={SCOPE_VARIANTS[rule.scope] ?? 'outline'}
                          className="text-[11px] font-mono px-1.5"
                        >
                          {SCOPE_LABELS[rule.scope] ?? rule.scope}
                        </Badge>
                      </TableCell>

                      {/* Target */}
                      <TableCell>
                        <span className="text-sm">
                          {rule.scope === 'pattern' && rule.patternId
                            ? getPatternName(rule.patternId)
                            : rule.scope === 'trip' && rule.tripId
                              ? getTripLabel(rule.tripId)
                              : rule.scope === 'leg' && rule.tripId
                                ? <>{getTripLabel(rule.tripId)} <span className="text-muted-foreground">· Leg {rule.legIndex}</span></>
                                : rule.scope === 'time'
                                  ? 'Time-based'
                                  : <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>

                      {/* Pricing Mode */}
                      <TableCell>
                        <Badge
                          variant={pricingMode === 'flat' ? 'default' : 'secondary'}
                          className="text-[11px] px-1.5"
                        >
                          {PRICING_MODE_LABELS[pricingMode] || 'Per Segmen'}
                        </Badge>
                      </TableCell>

                      {/* Price */}
                      <TableCell>
                        {effectivePrice != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm tabular-nums">
                              {formatRupiah(effectivePrice)}
                            </span>
                            {multiplier !== 1 && basePrice != null && (
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                base {formatRupiah(basePrice)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>

                      {/* Multiplier */}
                      <TableCell>
                        <span className={`font-mono text-sm tabular-nums ${multiplier !== 1 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                          ×{multiplier}
                        </span>
                      </TableCell>

                      {/* Priority */}
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground tabular-nums">{rule.priority ?? 0}</span>
                      </TableCell>

                      {/* Period */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {rule.validFrom
                            ? format(new Date(rule.validFrom), 'dd MMM yy')
                            : <span className="opacity-40">∞</span>}
                          {' '}–{' '}
                          {rule.validTo
                            ? format(new Date(rule.validTo), 'dd MMM yy')
                            : <span className="opacity-40">∞</span>}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-3">
                        <RowActionsMenu
                          actions={[
                            { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(rule) },
                            { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(rule.id), variant: 'destructive', disabled: deleteMutation.isPending },
                          ]}
                          data-testid={`actions-price-rule-${rule.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
