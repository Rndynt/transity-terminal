import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import type { PriceRule, TripPattern, Trip } from '@/types';

interface PriceRuleFormData {
  scope: 'pattern' | 'trip' | 'leg' | 'time';
  patternId: string;
  tripId: string;
  legIndex: string;
  ruleJson: string;
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
  pattern: 'Pola Perjalanan',
  trip: 'Trip Spesifik',
  leg: 'Leg Trip',
  time: 'Berbasis Waktu'
};

export default function PriceRulesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState<PriceRuleFormData>({
    scope: 'pattern',
    patternId: '',
    tripId: '',
    legIndex: '',
    ruleJson: '',
    validFrom: undefined,
    validTo: undefined,
    priority: '1'
  });
  const [searchQuery, setSearchQuery] = useState('');
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
    badge: p.code
  }));

  const tripOptions = trips.slice(0, 50).map(t => ({
    value: t.id,
    label: `Trip ${t.id.slice(-8)}`,
    badge: t.serviceDate
  }));

  const createMutation = useMutation({
    mutationFn: priceRulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-rules'] });
      setIsDialogOpen(false);
      resetForm();
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
      resetForm();
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

  const resetForm = () => {
    setFormData({ scope: 'pattern', patternId: '', tripId: '', legIndex: '', ruleJson: '', validFrom: undefined, validTo: undefined, priority: '1' });
  };

  const handleCreate = () => {
    setEditingRule(null);
    resetForm();
    setFormData(prev => ({ ...prev, ruleJson: JSON.stringify({ basePricePerLeg: 25000, currency: 'IDR', multiplier: 1.0 }, null, 2) }));
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: PriceRule) => {
    setEditingRule(rule);
    setFormData({
      scope: rule.scope,
      patternId: rule.patternId || '',
      tripId: rule.tripId || '',
      legIndex: rule.legIndex?.toString() || '',
      ruleJson: JSON.stringify(rule.rule, null, 2),
      validFrom: rule.validFrom ? new Date(rule.validFrom) : undefined,
      validTo: rule.validTo ? new Date(rule.validTo) : undefined,
      priority: (rule.priority || 0).toString()
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rule = JSON.parse(formData.ruleJson);
      const submitData = {
        scope: formData.scope,
        patternId: formData.patternId || null,
        tripId: formData.tripId || null,
        legIndex: formData.legIndex ? parseInt(formData.legIndex, 10) : null,
        rule,
        validFrom: formData.validFrom ? formData.validFrom.toISOString() : null,
        validTo: formData.validTo ? formData.validTo.toISOString() : null,
        priority: parseInt(formData.priority, 10)
      };
      if (editingRule) {
        updateMutation.mutate({ id: editingRule.id, data: submitData });
      } else {
        createMutation.mutate(submitData);
      }
    } catch {
      toast({ title: 'JSON Tidak Valid', description: 'Pastikan konfigurasi aturan adalah JSON yang valid', variant: 'destructive' });
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };

  const handleScopeChange = (scope: 'pattern' | 'trip' | 'leg' | 'time') => {
    setFormData(prev => ({ ...prev, scope, patternId: '', tripId: '', legIndex: '' }));
  };

  const getPatternName = (patternId: string) => patterns.find(p => p.id === patternId)?.name || '-';
  const getTripName = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    return trip ? `Trip ${trip.id.slice(-8)} (${trip.serviceDate})` : '-';
  };

  const getScopeBadge = (scope: string) => {
    const variants = { pattern: 'secondary', trip: 'default', leg: 'outline', time: 'destructive' } as const;
    return <Badge variant={variants[scope as keyof typeof variants] || 'outline'}>{SCOPE_LABELS[scope] || scope}</Badge>;
  };

  const formatRule = (rule: any) => {
    if (typeof rule === 'object') return Object.entries(rule).map(([k, v]) => `${k}: ${v}`).join(', ');
    return String(rule);
  };

  const filteredPriceRules = priceRules.filter(rule => {
    const q = searchQuery.toLowerCase();
    const scope = rule.scope.toLowerCase();
    const target = (
      rule.scope === 'pattern' && rule.patternId ? getPatternName(rule.patternId) :
      rule.scope === 'trip' && rule.tripId ? getTripName(rule.tripId) : ''
    ).toLowerCase();
    return scope.includes(q) || target.includes(q);
  });

  return (
    <div className="space-y-6" data-testid="price-rules-manager">
      <MasterPageHeader
        title="Aturan Harga"
        description="Kelola aturan penetapan harga untuk pola perjalanan dan trip"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari scope atau target..."
        count={filteredPriceRules.length}
        action={
          <Button onClick={handleCreate} data-testid="add-price-rule-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Aturan
          </Button>
        }
      />

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
        <SectionDivider label="Cakupan Aturan" />
        <div className="space-y-1.5">
          <Label>Tipe Scope <span className="text-destructive">*</span></Label>
          <Select value={formData.scope} onValueChange={handleScopeChange}>
            <SelectTrigger data-testid="select-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pattern">Pola Perjalanan</SelectItem>
              <SelectItem value="trip">Trip Spesifik</SelectItem>
              <SelectItem value="leg">Leg Trip</SelectItem>
              <SelectItem value="time">Berbasis Waktu</SelectItem>
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

        {formData.scope === 'trip' && (
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
        )}

        {formData.scope === 'leg' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Trip <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={formData.tripId}
                options={tripOptions}
                placeholder="Pilih trip..."
                searchPlaceholder="Cari trip..."
                onChange={(v) => setFormData(prev => ({ ...prev, tripId: v }))}
                data-testid="select-trip-leg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legIndex">Indeks Leg <span className="text-destructive">*</span></Label>
              <Input
                id="legIndex"
                type="number"
                value={formData.legIndex}
                onChange={(e) => setFormData(prev => ({ ...prev, legIndex: e.target.value }))}
                placeholder="Contoh: 1"
                min="1"
                required
                data-testid="input-leg-index"
              />
            </div>
          </div>
        )}

        <SectionDivider label="Periode Berlaku" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Kosongkan keduanya jika aturan berlaku tanpa batas waktu</p>

        <SectionDivider label="Konfigurasi Tarif" />
        <div className="space-y-1.5">
          <Label htmlFor="priority">Prioritas <span className="text-destructive">*</span></Label>
          <Input
            id="priority"
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
            placeholder="Contoh: 1"
            min="0"
            required
            data-testid="input-priority"
          />
          <p className="text-xs text-muted-foreground">Nilai lebih tinggi = prioritas lebih tinggi</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ruleJson">Konfigurasi Aturan (JSON) <span className="text-destructive">*</span></Label>
          <Textarea
            id="ruleJson"
            value={formData.ruleJson}
            onChange={(e) => setFormData(prev => ({ ...prev, ruleJson: e.target.value }))}
            placeholder='{"basePricePerLeg": 25000, "currency": "IDR", "multiplier": 1.0}'
            rows={8}
            className="font-mono text-sm"
            required
            data-testid="input-rule-json"
          />
          <p className="text-xs text-muted-foreground">Contoh: {`{ "basePricePerLeg": 25000, "currency": "IDR", "multiplier": 1.0 }`}</p>
        </div>
      </MasterFormDialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Aturan Harga"
        description="Apakah Anda yakin ingin menghapus aturan harga ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table data-testid="price-rules-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Prioritas</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Konfigurasi</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPriceRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada aturan harga'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPriceRules.map(rule => (
                    <TableRow key={rule.id} data-testid={`price-rule-${rule.id}`}>
                      <TableCell>{getScopeBadge(rule.scope)}</TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-sm truncate block">
                          {rule.scope === 'pattern' && rule.patternId ? getPatternName(rule.patternId) :
                           rule.scope === 'trip' && rule.tripId ? getTripName(rule.tripId) :
                           rule.scope === 'leg' && rule.tripId ? `${getTripName(rule.tripId)} — Leg ${rule.legIndex}` :
                           rule.scope === 'time' ? 'Berbasis waktu' : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{rule.priority || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rule.validFrom ? format(new Date(rule.validFrom), 'dd/MM/yy') : '—'} → {rule.validTo ? format(new Date(rule.validTo), 'dd/MM/yy') : '∞'}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-xs text-muted-foreground font-mono truncate block">{formatRule(rule.rule)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu
                          actions={[
                            { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(rule) },
                            { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(rule.id), variant: 'destructive', disabled: deleteMutation.isPending },
                          ]}
                          data-testid={`actions-price-rule-${rule.id}`}
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
