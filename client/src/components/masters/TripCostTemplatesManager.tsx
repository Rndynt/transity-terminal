import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { costTemplatesApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { fmtCurrency } from '@/lib/constants';
import {
  Wallet, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Fuel, CircleDollarSign, Utensils, ParkingSquare, MoreHorizontal
} from 'lucide-react';
import { RowActionsMenu } from './RowActionsMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import type { TripPattern, TripCostTemplate, TripCostItem } from '@shared/schema';

const CATEGORY_LABELS: Record<string, string> = {
  bbm: 'BBM',
  tol: 'Tol',
  makan: 'Uang Makan',
  parkir: 'Parkir',
  lainnya: 'Lainnya',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bbm: <Fuel className="w-3.5 h-3.5" />,
  tol: <CircleDollarSign className="w-3.5 h-3.5" />,
  makan: <Utensils className="w-3.5 h-3.5" />,
  parkir: <ParkingSquare className="w-3.5 h-3.5" />,
  lainnya: <MoreHorizontal className="w-3.5 h-3.5" />,
};

type TemplateWithItems = TripCostTemplate & { items?: TripCostItem[] };

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: TripCostItem;
  onEdit: (item: TripCostItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
      data-testid={`cost-item-${item.id}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-muted-foreground">{CATEGORY_ICONS[item.category]}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.isAdvance ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
              {item.isAdvance ? 'Uang Muka' : 'Reimbursable'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-foreground">{fmtCurrency(item.amount)}</span>
        <RowActionsMenu
          actions={[
            { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => onEdit(item) },
            { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => onDelete(item.id), variant: 'destructive' },
          ]}
          data-testid={`actions-cost-item-${item.id}`}
        />
      </div>
    </div>
  );
}

export default function TripCostTemplatesManager() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPatternId, setFilterPatternId] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ patternId: '', name: '', isActive: true });

  // Item form state
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    category: 'bbm' as string,
    label: '',
    amount: '',
    isAdvance: true,
    notes: '',
  });

  const { data: patterns = [] } = useQuery<TripPattern[]>({
    queryKey: ['/api/trip-patterns'],
    queryFn: () => fetch('/api/trip-patterns').then(r => r.json())
  });

  const { data: templates = [], isLoading } = useQuery<TemplateWithItems[]>({
    queryKey: ['/api/cost-templates'],
    queryFn: () => costTemplatesApi.getAll()
  });

  const patternOptions = patterns.map(p => ({ value: p.id, label: p.name, badge: p.code }));

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => costTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-templates'] });
      toast({ title: 'Berhasil', description: 'Template biaya berhasil dibuat' });
      resetTemplateForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => costTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-templates'] });
      toast({ title: 'Berhasil', description: 'Template diperbarui' });
      resetTemplateForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => costTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-templates'] });
      toast({ title: 'Dihapus', description: 'Template beserta semua item biaya dihapus' });
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  // Item mutations
  const createItemMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: any }) =>
      costTemplatesApi.createItem(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-templates'] });
      toast({ title: 'Berhasil', description: 'Item biaya ditambahkan' });
      resetItemForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => costTemplatesApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-templates'] });
      toast({ title: 'Berhasil', description: 'Item biaya diperbarui' });
      resetItemForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => costTemplatesApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-templates'] });
      toast({ title: 'Dihapus', description: 'Item biaya dihapus' });
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' })
  });

  const resetTemplateForm = () => {
    setTemplateForm({ patternId: '', name: '', isActive: true });
    setEditTemplateId(null);
    setShowTemplateForm(false);
  };

  const resetItemForm = () => {
    setItemForm({ category: 'bbm', label: '', amount: '', isAdvance: true, notes: '' });
    setEditItemId(null);
    setActiveTemplateId(null);
    setShowItemForm(false);
  };

  const startEditTemplate = (t: TripCostTemplate) => {
    setTemplateForm({ patternId: t.patternId, name: t.name, isActive: t.isActive });
    setEditTemplateId(t.id);
    setShowTemplateForm(true);
  };

  const startAddItem = (templateId: string) => {
    resetItemForm();
    setActiveTemplateId(templateId);
    setShowItemForm(true);
  };

  const startEditItem = (item: TripCostItem) => {
    setItemForm({
      category: item.category,
      label: item.label,
      amount: item.amount,
      isAdvance: item.isAdvance,
      notes: item.notes || '',
    });
    setEditItemId(item.id);
    setActiveTemplateId(item.templateId);
    setShowItemForm(true);
  };

  const handleSubmitTemplate = () => {
    if (!templateForm.patternId || !templateForm.name.trim()) return;
    if (editTemplateId) {
      updateTemplateMutation.mutate({ id: editTemplateId, data: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleSubmitItem = () => {
    if (!itemForm.label.trim() || !itemForm.amount || !activeTemplateId) return;
    const payload = { ...itemForm, amount: itemForm.amount };
    if (editItemId) {
      updateItemMutation.mutate({ id: editItemId, data: payload });
    } else {
      createItemMutation.mutate({ templateId: activeTemplateId, data: payload });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPatternName = (id: string) => patterns.find(p => p.id === id)?.name || '-';
  const getPatternCode = (id: string) => patterns.find(p => p.id === id)?.code || '-';

  const filtered = templates.filter(t => {
    const matchSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getPatternName(t.patternId).toLowerCase().includes(searchQuery.toLowerCase());
    const matchPattern = filterPatternId === 'all' || t.patternId === filterPatternId;
    return matchSearch && matchPattern;
  });

  const isTemplatePending = createTemplateMutation.isPending || updateTemplateMutation.isPending;
  const isItemPending = createItemMutation.isPending || updateItemMutation.isPending;

  return (
    <div data-testid="trip-cost-templates-manager" className="space-y-4">
      <MasterPageHeader
        title="Template Biaya Perjalanan"
        description="Kelola komponen biaya standar per rute sebagai dasar SPJ"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari nama template atau rute..."
        count={filtered.length}
        action={
          <Button
            onClick={() => { resetTemplateForm(); setShowTemplateForm(true); }}
            data-testid="btn-add-cost-template"
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah Template
          </Button>
        }
      />

      <div className="flex justify-end">
        <div className="w-full sm:w-[260px]">
          <SearchableSelect
            value={filterPatternId}
            options={[
              { value: 'all', label: 'Semua Rute' },
              ...patterns.map(p => ({ value: p.id, label: p.name, badge: p.code }))
            ]}
            placeholder="Semua Rute"
            searchPlaceholder="Cari rute..."
            onChange={setFilterPatternId}
            clearValue="all"
            data-testid="filter-template-pattern"
          />
        </div>
      </div>

      {/* Template Form Dialog */}
      <MasterFormDialog
        open={showTemplateForm}
        onOpenChange={open => !open && resetTemplateForm()}
        title={editTemplateId ? 'Edit Template' : 'Tambah Template Biaya'}
        description="Template biaya digunakan sebagai nilai awal saat membuat SPJ."
        onSubmit={e => { e.preventDefault(); handleSubmitTemplate(); }}
        isPending={isTemplatePending}
        data-testid="template-form-dialog"
      >
        <SectionDivider label="Informasi Template" />
        <div className="space-y-1.5">
          <Label>Rute (Pola Trip) <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={templateForm.patternId}
            options={patternOptions}
            placeholder="Pilih rute..."
            searchPlaceholder="Cari rute..."
            onChange={v => setTemplateForm(f => ({ ...f, patternId: v }))}
            data-testid="select-template-pattern"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="templateName">Nama Template <span className="text-destructive">*</span></Label>
          <Input
            id="templateName"
            value={templateForm.name}
            onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Contoh: Standar Jakarta - Bandung"
            data-testid="input-template-name"
          />
        </div>
        <SectionDivider label="Status" />
        <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">Aktif</p>
            <p className="text-xs text-muted-foreground">Template tersedia saat membuat SPJ</p>
          </div>
          <Switch
            checked={templateForm.isActive}
            onCheckedChange={v => setTemplateForm(f => ({ ...f, isActive: v }))}
            data-testid="switch-template-active"
          />
        </div>
      </MasterFormDialog>

      {/* Item Form Dialog */}
      <MasterFormDialog
        open={showItemForm}
        onOpenChange={open => !open && resetItemForm()}
        title={editItemId ? 'Edit Item Biaya' : 'Tambah Item Biaya'}
        description="Tambahkan komponen biaya ke template ini."
        onSubmit={e => { e.preventDefault(); handleSubmitItem(); }}
        isPending={isItemPending}
        data-testid="item-form-dialog"
      >
        <SectionDivider label="Detail Item" />
        <div className="space-y-1.5">
          <Label>Kategori <span className="text-destructive">*</span></Label>
          <Select
            value={itemForm.category}
            onValueChange={v => {
              const defaultLabel = CATEGORY_LABELS[v] || '';
              setItemForm(f => ({ ...f, category: v, label: f.label || defaultLabel }));
            }}
          >
            <SelectTrigger data-testid="select-item-category">
              <SelectValue placeholder="Pilih kategori..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([val, lbl]) => (
                <SelectItem key={val} value={val}>
                  <span className="flex items-center gap-2">
                    {CATEGORY_ICONS[val]}
                    {lbl}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="itemLabel">Label / Keterangan <span className="text-destructive">*</span></Label>
          <Input
            id="itemLabel"
            value={itemForm.label}
            onChange={e => setItemForm(f => ({ ...f, label: e.target.value }))}
            placeholder="Contoh: BBM Perjalanan PP"
            data-testid="input-item-label"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="itemAmount">Estimasi Nominal (Rp) <span className="text-destructive">*</span></Label>
          <Input
            id="itemAmount"
            type="number"
            value={itemForm.amount}
            onChange={e => setItemForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="200000"
            data-testid="input-item-amount"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="itemNotes">Catatan</Label>
          <Input
            id="itemNotes"
            value={itemForm.notes}
            onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Opsional"
            data-testid="input-item-notes"
          />
        </div>
        <SectionDivider label="Tipe Pembayaran" />
        <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">{itemForm.isAdvance ? 'Uang Muka' : 'Reimbursable'}</p>
            <p className="text-xs text-muted-foreground">
              {itemForm.isAdvance
                ? 'Diberikan di awal sebelum keberangkatan'
                : 'Dibayar setelah ada bukti pengeluaran'}
            </p>
          </div>
          <Switch
            checked={itemForm.isAdvance}
            onCheckedChange={v => setItemForm(f => ({ ...f, isAdvance: v }))}
            data-testid="switch-item-advance"
          />
        </div>
      </MasterFormDialog>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada template biaya'}
          </p>
          {!searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              Buat template biaya per rute untuk mempermudah pembuatan SPJ
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(template => {
            const expanded = expandedIds.has(template.id);
            const items: TripCostItem[] = (template as any).items || [];
            const totalEstimasi = items.reduce((sum, i) => sum + Number(i.amount), 0);
            const uangMuka = items.filter(i => i.isAdvance).reduce((sum, i) => sum + Number(i.amount), 0);

            return (
              <div
                key={template.id}
                className={`border rounded-xl overflow-hidden transition-all ${template.isActive ? 'border-border' : 'border-border/50 opacity-60'}`}
                data-testid={`template-${template.id}`}
              >
                {/* Template Header */}
                <div
                  className="flex items-center justify-between p-3 bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => toggleExpand(template.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="text-muted-foreground shrink-0" data-testid={`expand-template-${template.id}`}>
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {getPatternCode(template.patternId)}
                        </span>
                        <span className="text-sm font-semibold text-foreground truncate">{template.name}</span>
                        {!template.isActive && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Nonaktif</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{getPatternName(template.patternId)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">{items.length} item</p>
                      <p className="text-sm font-semibold text-foreground">{fmtCurrency(totalEstimasi)}</p>
                    </div>
                    <RowActionsMenu
                      actions={[
                        { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: (((e: Event) => { e.stopPropagation(); startEditTemplate(template); }) as () => void) },
                        { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: (((e: Event) => { e.stopPropagation(); setDeleteTemplateId(template.id); }) as () => void), variant: 'destructive' },
                      ]}
                      data-testid={`actions-template-${template.id}`}
                    />
                  </div>
                </div>

                {/* Expanded Items */}
                {expanded && (
                  <div className="border-t bg-muted/10 p-3 space-y-2">
                    {/* Summary */}
                    <div className="flex gap-4 text-xs text-muted-foreground pb-2 flex-wrap">
                      <span>Total estimasi: <strong className="text-foreground">{fmtCurrency(totalEstimasi)}</strong></span>
                      <span>Uang muka: <strong className="text-blue-600 dark:text-blue-400">{fmtCurrency(uangMuka)}</strong></span>
                      <span>Reimbursable: <strong className="text-orange-600 dark:text-orange-400">{fmtCurrency(totalEstimasi - uangMuka)}</strong></span>
                    </div>

                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">Belum ada item biaya. Tambahkan item di bawah.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map(item => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            onEdit={startEditItem}
                            onDelete={(id) => setDeleteItemId(id)}
                          />
                        ))}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-1"
                      onClick={() => startAddItem(template.id)}
                      data-testid={`btn-add-item-${template.id}`}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Tambah Item Biaya
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Template */}
      <DeleteConfirmDialog
        open={!!deleteTemplateId}
        onOpenChange={open => !open && setDeleteTemplateId(null)}
        onConfirm={() => {
          if (deleteTemplateId) {
            deleteTemplateMutation.mutate(deleteTemplateId);
            setDeleteTemplateId(null);
          }
        }}
        isPending={deleteTemplateMutation.isPending}
      />

      {/* Delete Item */}
      <DeleteConfirmDialog
        open={!!deleteItemId}
        onOpenChange={open => !open && setDeleteItemId(null)}
        onConfirm={() => {
          if (deleteItemId) {
            deleteItemMutation.mutate(deleteItemId);
            setDeleteItemId(null);
          }
        }}
        isPending={deleteItemMutation.isPending}
      />
    </div>
  );
}
