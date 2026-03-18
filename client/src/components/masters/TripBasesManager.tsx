import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { tripBasesApi, tripPatternsApi, layoutsApi, vehiclesApi, patternStopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, Clock, MapPin } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import { RowActionsMenu } from './RowActionsMenu';

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
  const editingStopTimesRef = useRef<DefaultStopTime[]>([]);
  const { toast } = useToast();

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

  const getDowBadges = (base: TripBase) => {
    const days = [
      { key: 'sun', label: 'Mg', active: base.sun },
      { key: 'mon', label: 'Sn', active: base.mon },
      { key: 'tue', label: 'Sl', active: base.tue },
      { key: 'wed', label: 'Rb', active: base.wed },
      { key: 'thu', label: 'Km', active: base.thu },
      { key: 'fri', label: 'Jm', active: base.fri },
      { key: 'sat', label: 'Sb', active: base.sat }
    ];

    return (
      <div className="flex gap-0.5">
        {days.map(day => (
          <span
            key={day.key}
            className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-semibold leading-none transition-colors ${
              day.active
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground/40'
            }`}
          >
            {day.label}
          </span>
        ))}
      </div>
    );
  };

  const getOriginDepartTime = (defaultStopTimes: any[]): string => {
    if (!defaultStopTimes || defaultStopTimes.length === 0) return '-';
    const firstStop = defaultStopTimes.find(st => st.stopSequence === 1);
    return firstStop?.departAt || '-';
  };

  const updateStopTime = (sequence: number, field: 'arriveAt' | 'departAt', value: string) => {
    setStopTimes(prev => prev.map(st => 
      st.stopSequence === sequence ? { ...st, [field]: value } : st
    ));
  };

  const filteredTripBases = tripBases.filter((base: TripBase) => {
    const pattern = patterns.find(p => p.id === base.patternId);
    const searchLower = searchQuery.toLowerCase();
    return (
      base.name.toLowerCase().includes(searchLower) ||
      (base.code && base.code.toLowerCase().includes(searchLower)) ||
      (pattern && (pattern.code.toLowerCase().includes(searchLower) || pattern.name.toLowerCase().includes(searchLower)))
    );
  });

  return (
    <div className="space-y-6" data-testid="trip-bases-manager">
      <MasterPageHeader
        title="Trip Bases Management"
        description="Manage virtual scheduling templates for trips"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cari trip base..."
        count={filteredTripBases.length}
        action={
          <Button onClick={openCreateDialog} data-testid="button-create-trip-base">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Trip Base
          </Button>
        }
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Delete Trip Base"
        description="Are you sure you want to delete this trip base? This action cannot be undone."
        isPending={deleteMutation.isPending}
      />

      {/* Trip Bases Table */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4 min-w-[200px]">Name</TableHead>
                    <TableHead className="w-1/5 min-w-[150px]">Pattern</TableHead>
                    <TableHead className="w-16">DOW</TableHead>
                    <TableHead className="w-1/6 min-w-[120px]">Valid Period</TableHead>
                    <TableHead className="w-20">Origin Depart</TableHead>
                    <TableHead className="w-16">Active</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTripBases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? `Tidak ada hasil untuk '${searchQuery}'` : 'Belum ada data'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTripBases.map((base: TripBase) => {
                      const pattern = patterns.find(p => p.id === base.patternId);
                      return (
                        <TableRow key={base.id} data-testid={`row-trip-base-${base.id}`}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{base.name}</div>
                              {base.code && <div className="text-sm text-muted-foreground">{base.code}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-mono text-sm">{pattern?.code}</div>
                              <div className="text-sm text-muted-foreground">{pattern?.name}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getDowBadges(base)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {base.validFrom && base.validTo 
                                ? `${base.validFrom} – ${base.validTo}`
                                : base.validFrom 
                                  ? `From ${base.validFrom}`
                                  : base.validTo
                                    ? `Until ${base.validTo}`
                                    : 'Always'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {getOriginDepartTime(base.defaultStopTimes)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={base.active ? 'default' : 'secondary'}>
                              {base.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <RowActionsMenu
                              actions={[
                                { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEditDialog(base) },
                                { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(base.id), variant: 'destructive' },
                              ]}
                              data-testid={`actions-base-${base.id}`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <DialogTitle>
              {editingBase ? 'Edit Trip Base' : 'Tambah Trip Base'}
            </DialogTitle>
            <DialogDescription>
              {editingBase
                ? 'Ubah informasi template penjadwalan virtual.'
                : 'Buat template penjadwalan virtual baru yang menghasilkan perjalanan nyata sesuai permintaan.'}
            </DialogDescription>
          </DialogHeader>

          <form id="trip-base-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

            {/* ── INFORMASI DASAR ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi Dasar</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pattern">Trip Pattern <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.patternId}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, patternId: value }));
                      setSelectedPatternId(value);
                    }}
                  >
                    <SelectTrigger data-testid="select-pattern">
                      <SelectValue placeholder="Pilih pola perjalanan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patterns.map((pattern: TripPattern) => (
                        <SelectItem key={pattern.id} value={pattern.id}>
                          {pattern.code} — {pattern.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nama <span className="text-destructive">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Contoh: Pagi Express Slot 1"
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="code">Kode <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="Kode unik"
                      data-testid="input-code"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Status Aktif</p>
                    <p className="text-xs text-muted-foreground">Trip base ini aktif menghasilkan perjalanan</p>
                  </div>
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                    data-testid="switch-active"
                  />
                </div>
              </div>
            </div>

            {/* ── HARI OPERASI ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hari Operasi</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {([
                  { key: 'mon', label: 'Sen' },
                  { key: 'tue', label: 'Sel' },
                  { key: 'wed', label: 'Rab' },
                  { key: 'thu', label: 'Kam' },
                  { key: 'fri', label: 'Jum' },
                  { key: 'sat', label: 'Sab' },
                  { key: 'sun', label: 'Min' },
                ] as { key: keyof TripBaseFormData; label: string }[]).map(day => {
                  const isOn = formData[day.key] as boolean;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, [day.key]: !isOn }))}
                      className={`w-10 h-10 rounded-md text-sm font-medium border transition-colors ${isOn ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted hover:text-foreground'}`}
                      data-testid={`toggle-${day.key}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── PERIODE BERLAKU ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Periode Berlaku</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="validFrom">Berlaku Dari</Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                    data-testid="input-valid-from"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="validTo">Berlaku Sampai</Label>
                  <Input
                    id="validTo"
                    type="date"
                    value={formData.validTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, validTo: e.target.value }))}
                    data-testid="input-valid-to"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Kosongkan keduanya jika berlaku tanpa batas waktu</p>
            </div>

            {/* ── NILAI DEFAULT ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nilai Default</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Layout</Label>
                  <Select
                    value={formData.defaultLayoutId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, defaultLayoutId: value }))}
                  >
                    <SelectTrigger data-testid="select-layout">
                      <SelectValue placeholder="Pilih layout..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Tidak ada —</SelectItem>
                      {layouts.map((layout: Layout) => (
                        <SelectItem key={layout.id} value={layout.id}>{layout.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kendaraan</Label>
                  <Select
                    value={formData.defaultVehicleId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, defaultVehicleId: value }))}
                  >
                    <SelectTrigger data-testid="select-vehicle">
                      <SelectValue placeholder="Pilih kendaraan..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Tidak ada —</SelectItem>
                      {vehicles.map((vehicle: Vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.code} — {vehicle.plate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="capacity">Override Kapasitas</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    placeholder="Maks penumpang"
                    data-testid="input-capacity"
                  />
                </div>
              </div>
            </div>

            {/* ── WAKTU HENTI DEFAULT ── */}
            {stopTimes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Waktu Henti Default</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Henti pertama wajib isi <strong>Berangkat</strong>, henti terakhir wajib isi <strong>Tiba</strong>.
                </p>
                <div className="rounded-lg border overflow-hidden">
                  {stopTimes.map((stopTime, index) => {
                    const isFirst = index === 0;
                    const isLast = index === stopTimes.length - 1;
                    const role = isFirst ? 'Asal' : isLast ? 'Tujuan' : 'Transit';
                    const roleColor = isFirst ? 'bg-primary/10 text-primary border-primary/20' : isLast ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-muted text-muted-foreground border-border';
                    return (
                      <div
                        key={stopTime.stopSequence}
                        className={`flex flex-wrap items-center gap-3 px-4 py-3 ${index < stopTimes.length - 1 ? 'border-b' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-[120px] flex-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${roleColor}`}>
                            {role}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            #{stopTime.stopSequence} {stopTime.stopName && stopTime.stopName !== `Stop ${stopTime.stopSequence}` ? `— ${stopTime.stopName}` : ''}
                          </span>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          <div className="space-y-1">
                            <Label htmlFor={`arrive-${stopTime.stopSequence}`} className="text-xs text-muted-foreground">
                              Tiba{isLast ? ' *' : ''}
                            </Label>
                            <Input
                              id={`arrive-${stopTime.stopSequence}`}
                              type="time"
                              step="60"
                              value={stopTime.arriveAt}
                              onChange={(e) => updateStopTime(stopTime.stopSequence, 'arriveAt', e.target.value)}
                              disabled={isFirst}
                              className="h-8 w-28 text-sm disabled:opacity-30"
                              data-testid={`input-arrive-${stopTime.stopSequence}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`depart-${stopTime.stopSequence}`} className="text-xs text-muted-foreground">
                              Berangkat{isFirst ? ' *' : ''}
                            </Label>
                            <Input
                              id={`depart-${stopTime.stopSequence}`}
                              type="time"
                              step="60"
                              value={stopTime.departAt}
                              onChange={(e) => updateStopTime(stopTime.stopSequence, 'departAt', e.target.value)}
                              disabled={isLast}
                              className="h-8 w-28 text-sm disabled:opacity-30"
                              data-testid={`input-depart-${stopTime.stopSequence}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stopTimes.length === 0 && formData.patternId && (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                <MapPin className="h-5 w-5 mx-auto mb-2 opacity-40" />
                Memuat data henti dari pola perjalanan...
              </div>
            )}

            {stopTimes.length === 0 && !formData.patternId && (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                <MapPin className="h-5 w-5 mx-auto mb-2 opacity-40" />
                Pilih trip pattern terlebih dahulu untuk mengatur waktu henti
              </div>
            )}

          </form>

          <DialogFooter className="px-5 py-4 border-t shrink-0 bg-background">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
              Batal
            </Button>
            <Button
              type="submit"
              form="trip-base-form"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}