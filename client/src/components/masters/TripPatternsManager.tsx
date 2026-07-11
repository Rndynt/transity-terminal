import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { tripPatternsApi, layoutsApi, stopsApi, patternStopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, MapPin, Filter, X, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  allowIntraCityBooking: boolean;
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
    tags: '',
    allowIntraCityBooking: false
  });
  const [filterCity, setFilterCity] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCodeSuggestions, setShowCodeSuggestions] = useState(false);
  const codeInputRef = useRef<HTMLDivElement>(null);
  const [patternStops, setPatternStops] = useState<StopSequenceItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showLayoutError, setShowLayoutError] = useState(false);
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
    setFormData({ code: '', name: '', note: '', vehicleClass: '', defaultLayoutId: '', active: true, tags: '', allowIntraCityBooking: false });
    setShowLayoutError(false);
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
      tags: pattern.tags ? pattern.tags.join(', ') : '',
      allowIntraCityBooking: pattern.allowIntraCityBooking === true
    });
    setShowLayoutError(false);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicateCode) return;
    if (!formData.defaultLayoutId) {
      setShowLayoutError(true);
      toast({ title: 'Layout Default wajib dipilih', description: 'Pilih layout kursi default sebelum menyimpan pola perjalanan.', variant: 'destructive' });
      return;
    }
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

    const inlineStops = (pattern as any).patternStops as Array<any> | undefined;
    if (inlineStops && inlineStops.length > 0) {
      setPatternStops(inlineStops
        .sort((a: any, b: any) => a.stopSequence - b.stopSequence)
        .map((stop: any) => ({
          stopId: stop.stopId,
          stopSequence: stop.stopSequence,
          dwellSeconds: stop.dwellSeconds || 0,
          boardingAllowed: stop.boardingAllowed,
          alightingAllowed: stop.alightingAllowed
        })));
    } else {
      tripPatternsApi.getStops(pattern.id).then(stops => {
        setPatternStops(stops.map(stop => ({
          stopId: stop.stopId,
          stopSequence: stop.stopSequence,
          dwellSeconds: stop.dwellSeconds || 0,
          boardingAllowed: stop.boardingAllowed,
          alightingAllowed: stop.alightingAllowed
        })));
      });
    }
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
                clearValue="all"
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
          <Label>Layout Default <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={formData.defaultLayoutId}
            options={layoutOptions}
            placeholder="Pilih layout kursi default..."
            searchPlaceholder="Cari layout..."
            onChange={(v) => {
              setFormData(prev => ({ ...prev, defaultLayoutId: v }));
              if (v) setShowLayoutError(false);
            }}
            className={showLayoutError ? 'ring-1 ring-destructive rounded-xl' : undefined}
            data-testid="select-layout"
          />
          {showLayoutError && (
            <p className="text-xs text-destructive flex items-center gap-1" data-testid="error-layout-required">
              <span>⚠</span> Layout default wajib dipilih.
            </p>
          )}
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

        <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">Izinkan Rute Pendek Dalam Kota</p>
            <p className="text-xs text-muted-foreground">
              Default nonaktif: naik dan turun yang sama-sama di kota yang sama (mis. Pasteur → Dipatiukur
              pada pola Jakarta-Bandung-Karangayu) tidak ditawarkan/tidak bisa dipesan. Aktifkan hanya untuk
              pola yang memang shuttle dalam-kota dengan banyak titik.
            </p>
          </div>
          <Switch
            id="allowIntraCityBooking"
            checked={formData.allowIntraCityBooking}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowIntraCityBooking: checked }))}
            data-testid="switch-allow-intra-city-booking"
          />
        </div>
      </MasterFormDialog>

      {/* Stops Management Dialog */}
      <Dialog open={isStopsDialogOpen} onOpenChange={setIsStopsDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-[calc(100vw-2rem)] h-[85vh] max-h-[720px] flex flex-col p-0 gap-0" data-testid="stops-dialog">
          <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <DialogTitle className="text-base">Kelola Halte</DialogTitle>
            <DialogDescription className="text-xs">{selectedPatternForStops?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            <div className="flex justify-between items-center pb-1">
              <p className="text-xs text-muted-foreground">{patternStops.length} halte</p>
              <Button onClick={addPatternStop} size="sm" variant="outline" data-testid="add-pattern-stop">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Tambah Halte
              </Button>
            </div>

            <div className="space-y-2">
              {patternStops.map((stop, index) => {
                const isFirst = index === 0;
                const isLast = index === patternStops.length - 1;
                const isTransit = !isFirst && !isLast;
                const roleLabel = isFirst ? 'Asal' : isLast ? 'Tujuan' : 'Transit';
                const rolePillClass = isFirst
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : isLast
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                  : 'bg-muted text-muted-foreground border border-border';

                return (
                  <div key={index} className="rounded-xl border bg-card p-3 space-y-2">
                    {/* Row 1: role pill + stop selector + delete */}
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] font-bold px-1 py-0.5 rounded flex-shrink-0 w-[46px] text-center', rolePillClass)}>
                        {roleLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          value={stop.stopId}
                          options={stopOptions}
                          placeholder="Pilih halte..."
                          searchPlaceholder="Cari nama atau kota..."
                          onChange={(value) => updatePatternStop(index, 'stopId', value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePatternStop(index)}
                        data-testid={`remove-stop-${index}`}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Row 2: Naik/Turun dulu (selalu di posisi sama, kiri), dwell menyusul di belakang hanya untuk transit */}
                    <div className="flex items-center gap-2 pl-1 flex-wrap">
                      {/* Naik hanya relevan di titik awal & transit — bukan di titik akhir */}
                      {(isFirst || isTransit) && (
                        <button
                          type="button"
                          onClick={() => updatePatternStop(index, 'boardingAllowed', stop.boardingAllowed === false ? true : false)}
                          data-testid={`switch-boarding-${index}`}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none',
                            stop.boardingAllowed !== false
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <ArrowUp className="h-3 w-3" />
                          Naik
                        </button>
                      )}
                      {/* Turun hanya relevan di titik akhir & transit — bukan di titik awal */}
                      {(isLast || isTransit) && (
                        <button
                          type="button"
                          onClick={() => updatePatternStop(index, 'alightingAllowed', stop.alightingAllowed === false ? true : false)}
                          data-testid={`switch-alighting-${index}`}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none',
                            stop.alightingAllowed !== false
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <ArrowDown className="h-3 w-3" />
                          Turun
                        </button>
                      )}
                      {/* Dwell time hanya untuk halte transit, menyusul di belakang badge — bukan mendahului */}
                      {isTransit && (
                        <div className="flex items-center gap-1.5 ml-auto" title="Waktu singgah minimum di halte ini (antara tiba dan berangkat)">
                          <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <input
                            type="number"
                            value={stop.dwellSeconds}
                            onChange={(e) => updatePatternStop(index, 'dwellSeconds', parseInt(e.target.value, 10) || 0)}
                            min="0"
                            className="w-14 h-6 text-xs text-center rounded-md border border-input bg-background px-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
                            data-testid={`input-dwell-${index}`}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">dtk singgah</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {patternStops.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada halte. Klik "Tambah Halte" untuk mulai.</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 py-3 border-t shrink-0 bg-background flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsStopsDialogOpen(false)}>Batal</Button>
            <Button size="sm" onClick={savePatternStops} data-testid="save-pattern-stops">Simpan</Button>
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

      <DataTable
        data-testid="patterns-table"
        data={filteredPatterns}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        emptyIcon={<MapPin className="w-7 h-7" />}
        emptyMessage="Belum ada pola perjalanan"
        searchQuery={searchQuery}
        rowTestId={(p) => `pattern-row-${p.code}`}
        columns={[
          {
            key: 'route', header: 'Rute',
            className: 'min-w-[220px] max-w-[280px]',
            render: (p) => (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5 whitespace-nowrap">
                    {p.code}
                  </span>
                  {p.active ? (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Aktif</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">Nonaktif</Badge>
                  )}
                </div>
                <p className="font-medium leading-tight text-[13px]">{p.name}</p>
                {p.note && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{p.note}</p>}
              </div>
            ),
          },
          {
            key: 'stops', header: 'Titik Halte',
            className: 'min-w-[200px] max-w-[260px]',
            render: (p) => {
              const ps = (p as any).patternStops as Array<{ stopSequence: number; stop: { name: string; code: string; city: string } | null; boardingAllowed: boolean; alightingAllowed: boolean }> | undefined;
              if (!ps || ps.length === 0) return <span className="text-muted-foreground text-xs italic">Belum diatur</span>;
              const sorted = [...ps].sort((a, b) => a.stopSequence - b.stopSequence);
              return (
                <div className="space-y-0.5">
                  {sorted.map((s, i) => {
                    const isFirst = i === 0;
                    const isLast = i === sorted.length - 1;
                    return (
                      <div key={i} className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full flex-shrink-0',
                            isFirst ? 'bg-primary' : isLast ? 'bg-orange-500' : 'bg-muted-foreground/40'
                          )}
                        />
                        <span
                          className={cn(
                            'text-[12px] truncate',
                            isFirst || isLast ? 'font-medium text-foreground' : 'text-muted-foreground'
                          )}
                          title={`${s.stop?.name || '?'}${s.stop?.city ? ` · ${s.stop.city}` : ''}`}
                        >
                          {s.stop?.name || '?'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            },
          },
          {
            key: 'armada', header: 'Armada', hideOnMobile: true,
            className: 'whitespace-nowrap',
            render: (p) => (
              <div className="space-y-0.5">
                <p className="text-[12px] font-medium leading-tight">{getLayoutName(p.defaultLayoutId || '')}</p>
                {p.vehicleClass && (
                  <p className="text-[11px] text-muted-foreground leading-tight">{p.vehicleClass}</p>
                )}
              </div>
            ),
          },
          {
            key: 'tags', header: 'Tag', hideOnMobile: true,
            className: 'max-w-[160px]',
            render: (p) => {
              const tags = p.tags || [];
              const visible = tags.slice(0, 2);
              const rest = tags.length - visible.length;
              if (tags.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
              return (
                <div className="flex flex-wrap gap-1">
                  {visible.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">{tag}</Badge>
                  ))}
                  {rest > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground" title={tags.slice(2).join(', ')}>
                      +{rest}
                    </Badge>
                  )}
                </div>
              );
            },
          },
          {
            key: 'actions', header: 'Aksi',
            headerClassName: 'text-right', className: 'text-right w-16',
            render: (p) => (
              <RowActionsMenu
                actions={[
                  { label: 'Kelola Halte', icon: <MapPin className="h-3.5 w-3.5" />, onClick: () => handleManageStops(p) },
                  { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => handleEdit(p) },
                  { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(p.id), variant: 'destructive', disabled: deleteMutation.isPending },
                ]}
                data-testid={`actions-pattern-${p.code}`}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
