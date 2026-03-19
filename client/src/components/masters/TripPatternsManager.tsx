import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { tripPatternsApi, layoutsApi, stopsApi, patternStopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, MapPin, Filter, X } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import { RowActionsMenu } from './RowActionsMenu';
import type { TripPattern, Layout, Stop } from '@/types';

interface TripPatternFormData {
  code: string;
  name: string;
  note: string;
  vehicleClass: string;
  defaultLayoutId: string;
  active: boolean;
  tags: string;
}

interface StopSequenceItem {
  stopId: string;
  stopSequence: number;
  dwellSeconds: number;
  boardingAllowed?: boolean;
  alightingAllowed?: boolean;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function TripPatternsManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStopsDialogOpen, setIsStopsDialogOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<TripPattern | null>(null);
  const [selectedPatternForStops, setSelectedPatternForStops] = useState<TripPattern | null>(null);
  const [formData, setFormData] = useState<TripPatternFormData>({
    code: '',
    name: '',
    note: '',
    vehicleClass: '',
    defaultLayoutId: '',
    active: true,
    tags: ''
  });
  const [filterCity, setFilterCity] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCodeSuggestions, setShowCodeSuggestions] = useState(false);
  const codeInputRef = useRef<HTMLDivElement>(null);
  const [patternStops, setPatternStops] = useState<StopSequenceItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll
  });

  const { data: layouts = [] } = useQuery({
    queryKey: ['/api/layouts'],
    queryFn: layoutsApi.getAll
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const layoutOptions = layouts.map(l => ({
    value: l.id,
    label: l.name,
    badge: `${l.rows}×${l.cols}`
  }));

  const stopOptions = [...stops]
    .sort((a, b) => (a.city || 'Lainnya').localeCompare(b.city || 'Lainnya'))
    .map(s => ({
      value: s.id,
      label: s.name,
      badge: s.code,
      subtitle: s.city || undefined,
      group: s.city || 'Lainnya'
    }));

  const createMutation = useMutation({
    mutationFn: tripPatternsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Berhasil', description: 'Pola perjalanan berhasil dibuat' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal membuat pola perjalanan', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tripPatternsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingPattern(null);
      toast({ title: 'Berhasil', description: 'Pola perjalanan berhasil diperbarui' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal memperbarui pola perjalanan', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: tripPatternsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns'] });
      setDeleteTarget(null);
      toast({ title: 'Berhasil', description: 'Pola perjalanan berhasil dihapus' });
    },
    onError: (error) => {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menghapus pola perjalanan', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ code: '', name: '', note: '', vehicleClass: '', defaultLayoutId: '', active: true, tags: '' });
  };

  const handleCreate = () => {
    setEditingPattern(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (pattern: TripPattern) => {
    setEditingPattern(pattern);
    setFormData({
      code: pattern.code,
      name: pattern.name,
      note: pattern.note || '',
      vehicleClass: pattern.vehicleClass || '',
      defaultLayoutId: pattern.defaultLayoutId || '',
      active: pattern.active !== false,
      tags: pattern.tags ? pattern.tags.join(', ') : ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicateCode) return;
    const submitData = { ...formData, tags: formData.tags.split(',').map(t => t.trim()).filter(t => t) };
    if (editingPattern) {
      updateMutation.mutate({ id: editingPattern.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);
  const confirmDelete = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget); };

  const getLayoutName = (layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId);
    return layout ? layout.name : '-';
  };

  const handleManageStops = (pattern: TripPattern) => {
    setSelectedPatternForStops(pattern);
    setIsStopsDialogOpen(true);
    tripPatternsApi.getStops(pattern.id).then(stops => {
      setPatternStops(stops.map(stop => ({
        stopId: stop.stopId,
        stopSequence: stop.stopSequence,
        dwellSeconds: stop.dwellSeconds || 0,
        boardingAllowed: stop.boardingAllowed,
        alightingAllowed: stop.alightingAllowed
      })));
    });
  };

  const addPatternStop = () => {
    const nextSequence = Math.max(0, ...patternStops.map(s => s.stopSequence)) + 1;
    setPatternStops(prev => [...prev, { stopId: '', stopSequence: nextSequence, dwellSeconds: 0, boardingAllowed: true, alightingAllowed: true }]);
  };

  const removePatternStop = (index: number) => {
    setPatternStops(prev => prev.filter((_, i) => i !== index));
  };

  const updatePatternStop = (index: number, field: keyof StopSequenceItem, value: any) => {
    setPatternStops(prev => prev.map((stop, i) => i === index ? { ...stop, [field]: value } : stop));
  };

  const savePatternStops = async () => {
    if (!selectedPatternForStops) return;
    try {
      const validStops = patternStops.filter(stop => stop.stopId).map(stop => ({
        patternId: selectedPatternForStops.id,
        stopId: stop.stopId,
        stopSequence: stop.stopSequence,
        dwellSeconds: stop.dwellSeconds,
        boardingAllowed: stop.boardingAllowed !== false,
        alightingAllowed: stop.alightingAllowed !== false
      }));
      await patternStopsApi.bulkReplace(selectedPatternForStops.id, validStops);
      queryClient.invalidateQueries({ queryKey: ['/api/trip-patterns', selectedPatternForStops.id, 'stops'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setIsStopsDialogOpen(false);
      setPatternStops([]);
      toast({ title: 'Berhasil', description: 'Daftar halte berhasil disimpan' });
    } catch (error) {
      toast({ title: 'Gagal', description: error instanceof Error ? error.message : 'Gagal menyimpan halte pola', variant: 'destructive' });
    }
  };

  const isDuplicateCode = useMemo(() => {
    const code = formData.code.trim();
    if (!code) return false;
    return patterns.some(p => p.code === code && p.id !== editingPattern?.id);
  }, [formData.code, patterns, editingPattern]);

  const codeSuggestions = useMemo(() => {
    const code = formData.code.trim();
    if (!code || code.length < 1) return [];
    const lower = code.toLowerCase();
    return patterns
      .filter(p => p.id !== editingPattern?.id && p.code.toLowerCase().includes(lower))
      .slice(0, 6);
  }, [formData.code, patterns, editingPattern]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    patterns.forEach(p => {
      p.name.split(' → ').forEach(city => {
        const trimmed = city.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort();
  }, [patterns]);

  const filteredPatterns = patterns.filter(pattern => {
    const matchesSearch =
      pattern.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCity = !filterCity ||
      pattern.name.split(' → ').some(c => c.trim() === filterCity);

    return matchesSearch && matchesCity;
  });

  const activeFilterCount = filterCity ? 1 : 0;

  return (
    <div className="space-y-5" data-testid="trip-patterns-manager">
      <MasterPageHeader
        title="Pola Perjalanan"
        description="Kelola pola rute dan urutan pemberhentian"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari kode atau nama pola..."
        count={filteredPatterns.length}
        action={
          <Button onClick={handleCreate} data-testid="add-pattern-button">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Pola
          </Button>
        }
        filterButton={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="toggle-pattern-filters"
              className={showFilters || activeFilterCount > 0 ? 'border-primary text-primary bg-primary/5' : ''}
            >
              <Filter className="h-4 w-4 mr-1.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilterCity('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" />
                Hapus Filter
              </Button>
            )}
          </div>
        }
      />

      {/* Collapsible filter panel */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Kota</Label>
              <SearchableSelect
                value={filterCity || 'all'}
                options={[
                  { value: 'all', label: 'Semua kota' },
                  ...availableCities.map(city => ({ value: city, label: city }))
                ]}
                placeholder="Semua kota"
                searchPlaceholder="Cari kota..."
                onChange={v => setFilterCity(v === 'all' ? '' : v)}
                data-testid="filter-city"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active filter pill */}
      {filterCity && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter aktif:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            Kota: {filterCity}
            <button onClick={() => setFilterCity('')} className="hover:text-primary/60 ml-0.5"><X className="w-3 h-3" /></button>
          </span>
        </div>
      )}

      <MasterFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingPattern ? 'Edit Pola Perjalanan' : 'Tambah Pola Perjalanan'}
        description={editingPattern ? 'Ubah informasi pola rute perjalanan.' : 'Tambah pola rute perjalanan baru.'}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        data-testid="pattern-dialog"
      >
        <SectionDivider label="Identitas Pola" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Kode Pola <span className="text-destructive">*</span></Label>
            <div ref={codeInputRef} className="relative">
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }));
                  setShowCodeSuggestions(true);
                }}
                onFocus={() => setShowCodeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCodeSuggestions(false), 150)}
                placeholder="Contoh: JKT-BDG-C"
                required
                autoComplete="off"
                className={isDuplicateCode ? 'border-destructive focus-visible:ring-destructive' : ''}
                data-testid="input-code"
              />
              {showCodeSuggestions && codeSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                  <p className="text-[10px] text-muted-foreground px-2.5 pt-1.5 pb-0.5 uppercase tracking-wide font-medium">Kode yang sudah ada</p>
                  {codeSuggestions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => {
                        setFormData(prev => ({ ...prev, code: p.code }));
                        setShowCodeSuggestions(false);
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-1.5 text-sm hover:bg-accent text-left"
                      data-testid={`suggestion-${p.code}`}
                    >
                      <span className="font-mono font-medium text-foreground">{p.code}</span>
                      <span className="text-muted-foreground text-xs truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isDuplicateCode && (
              <p className="text-xs text-destructive flex items-center gap-1" data-testid="error-duplicate-code">
                <span>⚠</span> Kode <span className="font-mono font-medium">"{formData.code}"</span> sudah digunakan oleh pola lain.
              </p>
            )}
            {!isDuplicateCode && formData.code.trim() && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1" data-testid="info-code-available">
                <span>✓</span> Kode tersedia
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Pola <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Contoh: Jakarta → Bandung"
              required
              data-testid="input-name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">
            Note <span className="text-muted-foreground text-xs">(opsional)</span>
          </Label>
          <Input
            id="note"
            value={formData.note}
            onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
            placeholder="Contoh: Via Cirebon, Semarang · Eksekutif"
            data-testid="input-note"
          />
        </div>

        <SectionDivider label="Konfigurasi Armada" />
        <div className="space-y-1.5">
          <Label htmlFor="vehicleClass">Kelas Kendaraan</Label>
          <Input
            id="vehicleClass"
            value={formData.vehicleClass}
            onChange={(e) => setFormData(prev => ({ ...prev, vehicleClass: e.target.value }))}
            placeholder="Contoh: standard, executive, sleeper"
            data-testid="input-vehicle-class"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Layout Default</Label>
          <SearchableSelect
            value={formData.defaultLayoutId}
            options={layoutOptions}
            placeholder="Pilih layout kursi default..."
            searchPlaceholder="Cari layout..."
            onChange={(v) => setFormData(prev => ({ ...prev, defaultLayoutId: v }))}
            data-testid="select-layout"
          />
        </div>

        <SectionDivider label="Tambahan" />
        <div className="space-y-1.5">
          <Label htmlFor="tags">Tag (pisahkan dengan koma)</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="Contoh: intercity, express, overnight"
            data-testid="input-tags"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">Pola Aktif</p>
            <p className="text-xs text-muted-foreground">Pola yang tidak aktif tidak akan tersedia untuk pembuatan trip</p>
          </div>
          <Switch
            id="active"
            checked={formData.active}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
            data-testid="switch-active"
          />
        </div>
      </MasterFormDialog>

      {/* Stops Management Dialog */}
      <Dialog open={isStopsDialogOpen} onOpenChange={setIsStopsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0" data-testid="stops-dialog">
          <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <DialogTitle>Kelola Halte — {selectedPatternForStops?.name}</DialogTitle>
            <DialogDescription>Atur urutan dan konfigurasi pemberhentian untuk rute ini.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">Urutan Halte</p>
                <p className="text-xs text-muted-foreground">{patternStops.length} halte ditambahkan</p>
              </div>
              <Button onClick={addPatternStop} size="sm" data-testid="add-pattern-stop">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Halte
              </Button>
            </div>

            <div className="space-y-3">
              {patternStops.map((stop, index) => (
                <div key={index} className="border rounded-xl bg-card overflow-hidden">
                  {/* Card header: sequence + delete */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-primary bg-primary/10 rounded-md px-2 py-0.5">
                        #{stop.stopSequence}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">Pemberhentian ke-{index + 1}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removePatternStop(index)}
                      data-testid={`remove-stop-${index}`}
                      className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Card body: fields with labels */}
                  <div className="p-4 space-y-4">
                    {/* Halte selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Halte <span className="text-destructive">*</span>
                      </Label>
                      <SearchableSelect
                        value={stop.stopId}
                        options={stopOptions}
                        placeholder="Pilih halte..."
                        searchPlaceholder="Cari nama halte atau kota..."
                        onChange={(value) => updatePatternStop(index, 'stopId', value)}
                      />
                      {!stop.stopId && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Pilih halte untuk pemberhentian ini</p>
                      )}
                    </div>

                    {/* Dwell time */}
                    <div className="space-y-1.5">
                      <Label htmlFor={`dwell-${index}`} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Waktu Berhenti di Halte
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`dwell-${index}`}
                          type="number"
                          value={stop.dwellSeconds}
                          onChange={(e) => updatePatternStop(index, 'dwellSeconds', parseInt(e.target.value, 10) || 0)}
                          min="0"
                          className="w-32"
                          data-testid={`input-dwell-${index}`}
                        />
                        <span className="text-sm text-muted-foreground">detik</span>
                        {stop.dwellSeconds > 0 && (
                          <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                            ≈ {Math.floor(stop.dwellSeconds / 60)} menit {stop.dwellSeconds % 60} dtk
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Berapa lama kendaraan berhenti di halte ini. Isi 0 jika hanya lewat.</p>
                    </div>

                    {/* Boarding / Alighting */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Izin Penumpang
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-background">
                          <div>
                            <p className="text-sm font-medium">Naik</p>
                            <p className="text-xs text-muted-foreground">Penumpang boleh naik</p>
                          </div>
                          <Switch
                            id={`boarding-${index}`}
                            checked={stop.boardingAllowed !== false}
                            onCheckedChange={(checked) => updatePatternStop(index, 'boardingAllowed', checked)}
                            data-testid={`switch-boarding-${index}`}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-background">
                          <div>
                            <p className="text-sm font-medium">Turun</p>
                            <p className="text-xs text-muted-foreground">Penumpang boleh turun</p>
                          </div>
                          <Switch
                            id={`alighting-${index}`}
                            checked={stop.alightingAllowed !== false}
                            onCheckedChange={(checked) => updatePatternStop(index, 'alightingAllowed', checked)}
                            data-testid={`switch-alighting-${index}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {patternStops.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada halte. Klik "Tambah Halte" untuk mulai.</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-5 py-4 border-t shrink-0 bg-background flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setIsStopsDialogOpen(false)}>Batal</Button>
            <Button onClick={savePatternStops} data-testid="save-pattern-stops">Simpan Perubahan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Pola Perjalanan"
        description="Apakah Anda yakin ingin menghapus pola ini? Tindakan ini tidak dapat dibatalkan."
        isPending={deleteMutation.isPending}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table data-testid="patterns-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kelas Kendaraan</TableHead>
                  <TableHead>Layout Default</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead className="w-32">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatterns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada pola perjalanan'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatterns.map(pattern => (
                    <TableRow key={pattern.id} data-testid={`pattern-row-${pattern.code}`}>
                      <TableCell className="font-mono font-medium">{pattern.code}</TableCell>
                      <TableCell>
                        <p className="font-medium">{pattern.name}</p>
                        {pattern.note && (
                          <p className="text-xs text-muted-foreground mt-0.5">{pattern.note}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{pattern.vehicleClass || '-'}</TableCell>
                      <TableCell>{getLayoutName(pattern.defaultLayoutId || '')}</TableCell>
                      <TableCell>
                        {pattern.active ? (
                          <Badge variant="secondary">Aktif</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Nonaktif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pattern.tags?.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RowActionsMenu
                          actions={[
                            { label: 'Kelola Halte', icon: <MapPin className="h-3.5 w-3.5" />, onClick: () => handleManageStops(pattern) },
                            { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(pattern) },
                            { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(pattern.id), variant: 'destructive', disabled: deleteMutation.isPending },
                          ]}
                          data-testid={`actions-pattern-${pattern.code}`}
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
