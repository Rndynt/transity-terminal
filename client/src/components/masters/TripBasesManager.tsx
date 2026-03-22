import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { tripBasesApi, tripPatternsApi, layoutsApi, vehiclesApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Clock, Filter, X, Search } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import TripBaseFormDialog from './TripBaseFormDialog';
import TripBaseGroupList from './TripBaseGroupList';

interface TripBase {
  id: string;
  patternId: string;
  code?: string;
  name: string;
  active: boolean;
  timezone: string;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
  validFrom?: string;
  validTo?: string;
  defaultLayoutId?: string;
  defaultVehicleId?: string;
  capacity?: number;
  channelFlags: any;
  defaultStopTimes: any[];
  createdAt: string;
  updatedAt: string;
}

interface TripPattern {
  id: string;
  code: string;
  name: string;
  note?: string;
}

interface Layout {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  code: string;
  plate: string;
}

interface PatternStop {
  id: string;
  stopSequence: number;
  stopId: string;
  patternId: string;
  stop?: { name: string; code: string };
}

interface TripBaseFormData {
  patternId: string;
  code: string;
  name: string;
  active: boolean;
  timezone: string;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
  validFrom: string;
  validTo: string;
  defaultLayoutId: string;
  defaultVehicleId: string;
  capacity: string;
  channelFlags: any;
  defaultStopTimes: Array<{
    stopSequence: number;
    arriveAt: string;
    departAt: string;
  }>;
}

interface DefaultStopTime {
  stopSequence: number;
  stopName?: string;
  stopCode?: string;
  arriveAt: string;
  departAt: string;
}

export default function TripBasesManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<TripBase | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string>('');
  const [formData, setFormData] = useState<TripBaseFormData>({
    patternId: '',
    code: '',
    name: '',
    active: true,
    timezone: 'Asia/Jakarta',
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true,
    sun: true,
    validFrom: '',
    validTo: '',
    defaultLayoutId: 'none',
    defaultVehicleId: 'none',
    capacity: '',
    channelFlags: { CSO: true, WEB: false, APP: false, OTA: false },
    defaultStopTimes: []
  });
  const [stopTimes, setStopTimes] = useState<DefaultStopTime[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dialogOpenKey, setDialogOpenKey] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterPattern, setFilterPattern] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const editingStopTimesRef = useRef<DefaultStopTime[]>([]);
  const { toast } = useToast();

  const toggleGroup = (patternId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(patternId)) next.delete(patternId);
      else next.add(patternId);
      return next;
    });
  };

  const { data: tripBases = [], isLoading } = useQuery({
    queryKey: ['/api/trip-bases'],
    queryFn: tripBasesApi.getAll
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll
  });

  const { data: layouts = [] } = useQuery({
    queryKey: ['/api/layouts'],
    queryFn: layoutsApi.getAll
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: vehiclesApi.getAll
  });

  const { data: patternStops = [] } = useQuery({
    queryKey: ['/api/pattern-stops', selectedPatternId],
    queryFn: () => selectedPatternId ? tripPatternsApi.getStops(selectedPatternId) : Promise.resolve([]),
    enabled: !!selectedPatternId
  });

  const createMutation = useMutation({
    mutationFn: tripBasesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-bases'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Success', description: 'Trip base created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create trip base', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tripBasesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-bases'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Success', description: 'Trip base updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update trip base', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: tripBasesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-bases'] });
      setDeleteTarget(null);
      toast({ title: 'Success', description: 'Trip base deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete trip base', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      patternId: '',
      code: '',
      name: '',
      active: true,
      timezone: 'Asia/Jakarta',
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: true,
      sun: true,
      validFrom: '',
      validTo: '',
      defaultLayoutId: 'none',
      defaultVehicleId: 'none',
      capacity: '',
      channelFlags: { CSO: true, WEB: false, APP: false, OTA: false },
      defaultStopTimes: []
    });
    setStopTimes([]);
    setSelectedPatternId('');
    setEditingBase(null);
    editingStopTimesRef.current = [];
  };

  const openCreateDialog = () => {
    resetForm();
    editingStopTimesRef.current = [];
    setDialogOpenKey(k => k + 1);
    setIsDialogOpen(true);
  };

  const openEditDialog = (base: TripBase) => {
    const normalizeTime = (t: string | null | undefined): string => {
      if (!t) return '';
      return t.length > 5 ? t.substring(0, 5) : t;
    };

    const existingTimes: DefaultStopTime[] = base.defaultStopTimes?.map((st: any) => ({
      stopSequence: st.stopSequence,
      arriveAt: normalizeTime(st.arriveAt),
      departAt: normalizeTime(st.departAt),
    })) || [];

    editingStopTimesRef.current = existingTimes;

    setEditingBase(base);
    setSelectedPatternId(base.patternId);
    setFormData({
      patternId: base.patternId,
      code: base.code || '',
      name: base.name,
      active: base.active,
      timezone: base.timezone || 'Asia/Jakarta',
      mon: base.mon,
      tue: base.tue,
      wed: base.wed,
      thu: base.thu,
      fri: base.fri,
      sat: base.sat,
      sun: base.sun,
      validFrom: base.validFrom || '',
      validTo: base.validTo || '',
      defaultLayoutId: base.defaultLayoutId || 'none',
      defaultVehicleId: base.defaultVehicleId || 'none',
      capacity: base.capacity?.toString() || '',
      channelFlags: base.channelFlags || { CSO: true, WEB: false, APP: false, OTA: false },
      defaultStopTimes: base.defaultStopTimes || []
    });
    // Set immediately so stops show right away (names will be enriched once patternStops loads)
    setStopTimes(existingTimes);
    setDialogOpenKey(k => k + 1);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.patternId || !formData.name) {
      toast({ title: 'Error', description: 'Pattern and name are required', variant: 'destructive' });
      return;
    }

    // Validate stop times
    if (stopTimes.length === 0) {
      toast({ title: 'Error', description: 'Default stop times are required', variant: 'destructive' });
      return;
    }

    // First stop must have departAt, last stop must have arriveAt
    const firstStop = stopTimes[0];
    const lastStop = stopTimes[stopTimes.length - 1];
    
    if (!firstStop.departAt) {
      toast({ title: 'Error', description: 'First stop must have departure time', variant: 'destructive' });
      return;
    }
    
    if (!lastStop.arriveAt) {
      toast({ title: 'Error', description: 'Last stop must have arrival time', variant: 'destructive' });
      return;
    }

    const data = {
      ...formData,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      validFrom: formData.validFrom || null,
      validTo: formData.validTo || null,
      defaultLayoutId: formData.defaultLayoutId === 'none' ? null : formData.defaultLayoutId,
      defaultVehicleId: formData.defaultVehicleId === 'none' ? null : formData.defaultVehicleId,
      defaultStopTimes: stopTimes
    };

    if (editingBase) {
      updateMutation.mutate({ id: editingBase.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget);
    }
  };

  // Rebuild stop times whenever pattern stops load OR dialog opens (dialogOpenKey)
  useEffect(() => {
    if (patternStops.length === 0) return;
    const existingTimes = editingStopTimesRef.current;
    const merged: DefaultStopTime[] = patternStops.map((ps: any) => {
      const existing = existingTimes.find(st => st.stopSequence === ps.stopSequence);
      return {
        stopSequence: ps.stopSequence,
        stopName: ps.stop?.name || ps.stopName || `Stop ${ps.stopSequence}`,
        stopCode: ps.stop?.code || ps.stopCode || '',
        arriveAt: existing?.arriveAt || '',
        departAt: existing?.departAt || '',
      };
    });
    setStopTimes(merged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternStops, dialogOpenKey]);

  const updateStopTime = (sequence: number, field: 'arriveAt' | 'departAt', value: string) => {
    setStopTimes(prev => prev.map(st => 
      st.stopSequence === sequence ? { ...st, [field]: value } : st
    ));
  };

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    patterns.forEach((p: TripPattern) => {
      p.name.split(' → ').forEach(city => {
        const trimmed = city.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort();
  }, [patterns]);

  const activeFilterCount = (filterCity ? 1 : 0) + (filterPattern ? 1 : 0);

  const filteredTripBases = tripBases.filter((base: TripBase) => {
    const pattern = patterns.find((p: TripPattern) => p.id === base.patternId);
    const searchLower = searchQuery.toLowerCase();

    const matchesSearch = !searchQuery || (
      base.name.toLowerCase().includes(searchLower) ||
      (base.code && base.code.toLowerCase().includes(searchLower)) ||
      (pattern && (pattern.code.toLowerCase().includes(searchLower) || pattern.name.toLowerCase().includes(searchLower)))
    );

    const matchesCity = !filterCity || (() => {
      if (!pattern) return false;
      return pattern.name.split(' → ').some(c => c.trim() === filterCity);
    })();

    const matchesPattern = !filterPattern || base.patternId === filterPattern;

    return matchesSearch && matchesCity && matchesPattern;
  });

  return (
    <div className="space-y-5" data-testid="trip-bases-manager">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Dasar Trip</h3>
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{filteredTripBases.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Template jadwal berulang berdasarkan pola rute</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-trip-base">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Dasar Trip
        </Button>
      </div>

      {/* Search + Filter button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama, kode, atau rute..."
            className="pl-9 pr-9"
            data-testid="tripbase-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          data-testid="toggle-tripbase-filters"
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
          <Button variant="ghost" size="sm" onClick={() => { setFilterCity(''); setFilterPattern(''); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5 mr-1" />
            Hapus Filter
          </Button>
        )}
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rute / Pola</Label>
                <SearchableSelect
                  value={filterPattern || 'all'}
                  options={[
                    { value: 'all', label: 'Semua rute' },
                    ...patterns.map((p: TripPattern) => ({
                      value: p.id,
                      label: p.name,
                      badge: p.code || undefined,
                    }))
                  ]}
                  placeholder="Semua rute"
                  searchPlaceholder="Cari nama atau kode rute..."
                  onChange={v => setFilterPattern(v === 'all' ? '' : v)}
                  clearValue="all"
                  data-testid="filter-pattern"
                />
              </div>

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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter aktif:</span>
          {filterPattern && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Rute: {patterns.find((p: TripPattern) => p.id === filterPattern)?.name || filterPattern}
              <button onClick={() => setFilterPattern('')} className="hover:text-primary/60 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterCity && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Kota: {filterCity}
              <button onClick={() => setFilterCity('')} className="hover:text-primary/60 ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Delete Trip Base"
        description="Are you sure you want to delete this trip base? This action cannot be undone."
        isPending={deleteMutation.isPending}
      />

      {/* Trip Bases Table — collapsible groups by route */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredTripBases.length === 0 ? (
        <div className="rounded-md border">
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Belum ada trip base'}
            </p>
          </div>
        </div>
      ) : (
        <TripBaseGroupList
          filteredTripBases={filteredTripBases}
          patterns={patterns}
          layouts={layouts}
          vehicles={vehicles}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onToggleAll={(expanded, ids) => setExpandedGroups(expanded ? new Set(ids) : new Set())}
          onEdit={openEditDialog}
          onDelete={handleDelete}
        />
      )}

      <TripBaseFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingBase={editingBase}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        patterns={patterns}
        layouts={layouts}
        vehicles={vehicles}
        stopTimes={stopTimes}
        updateStopTime={updateStopTime}
        onPatternChange={setSelectedPatternId}
      />
    </div>
  );
}
