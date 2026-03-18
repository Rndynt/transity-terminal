import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { tripPatternsApi, layoutsApi, stopsApi, patternStopsApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MasterPageHeader from './MasterPageHeader';
import MasterFormDialog from './MasterFormDialog';
import { RowActionsMenu } from './RowActionsMenu';
import type { TripPattern, Layout, Stop } from '@/types';

interface TripPatternFormData {
  code: string;
  name: string;
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
    vehicleClass: '',
    defaultLayoutId: '',
    active: true,
    tags: ''
  });
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

  const stopOptions = stops.map(s => ({
    value: s.id,
    label: s.name,
    badge: s.code,
    subtitle: s.city || undefined
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
    setFormData({ code: '', name: '', vehicleClass: '', defaultLayoutId: '', active: true, tags: '' });
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
      vehicleClass: pattern.vehicleClass || '',
      defaultLayoutId: pattern.defaultLayoutId || '',
      active: pattern.active !== false,
      tags: pattern.tags ? pattern.tags.join(', ') : ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const filteredPatterns = patterns.filter(pattern =>
    pattern.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pattern.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="trip-patterns-manager">
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
      />

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
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              placeholder="Contoh: JKT-BDG-C"
              required
              data-testid="input-code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Pola <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Contoh: Jakarta–Bandung via Purwakarta"
              required
              data-testid="input-name"
            />
          </div>
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
        <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0" data-testid="stops-dialog">
          <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
            <DialogTitle>Halte & Urutan — {selectedPatternForStops?.name}</DialogTitle>
            <DialogDescription>Kelola daftar pemberhentian untuk pola rute ini.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Urutan Halte</span>
              <Button onClick={addPatternStop} size="sm" data-testid="add-pattern-stop">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Halte
              </Button>
            </div>

            <div className="space-y-3">
              {patternStops.map((stop, index) => (
                <div key={index} className="flex flex-col space-y-3 p-3 border rounded-xl bg-card">
                  <div className="flex items-center gap-2">
                    <div className="w-10 text-center font-mono font-bold text-sm text-primary bg-primary/10 rounded-lg py-1.5 flex-shrink-0">
                      {stop.stopSequence}
                    </div>
                    <div className="flex-1">
                      <SearchableSelect
                        value={stop.stopId}
                        options={stopOptions}
                        placeholder="Pilih halte..."
                        searchPlaceholder="Cari halte..."
                        onChange={(value) => updatePatternStop(index, 'stopId', value)}
                      />
                    </div>
                    <div className="w-28 flex-shrink-0">
                      <Input
                        type="number"
                        value={stop.dwellSeconds}
                        onChange={(e) => updatePatternStop(index, 'dwellSeconds', parseInt(e.target.value, 10) || 0)}
                        placeholder="Waktu (dtk)"
                        min="0"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removePatternStop(index)}
                      data-testid={`remove-stop-${index}`}
                      className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-6 pl-12">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`boarding-${index}`}
                        checked={stop.boardingAllowed !== false}
                        onCheckedChange={(checked) => updatePatternStop(index, 'boardingAllowed', checked)}
                        data-testid={`switch-boarding-${index}`}
                      />
                      <Label htmlFor={`boarding-${index}`} className="text-sm cursor-pointer">Naik penumpang</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`alighting-${index}`}
                        checked={stop.alightingAllowed !== false}
                        onCheckedChange={(checked) => updatePatternStop(index, 'alightingAllowed', checked)}
                        data-testid={`switch-alighting-${index}`}
                      />
                      <Label htmlFor={`alighting-${index}`} className="text-sm cursor-pointer">Turun penumpang</Label>
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
                      <TableCell>{pattern.name}</TableCell>
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
