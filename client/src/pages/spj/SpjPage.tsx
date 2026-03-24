import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { spjApi, tripsApi, tripPatternsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ClipboardList, Search, Eye, CheckCircle, Trash2, ArrowLeft, Printer,
  User, Bus, MapPin, Calendar, FileText, Wallet, Plus, Pencil, X,
  ChevronLeft, ChevronRight, CircleDollarSign, TrendingUp, Banknote, Clock, Route
} from 'lucide-react';
import type { SpjWithDetails, SpjCostLine, TripWithDetails, TripPattern } from '@/types';
import { SpjStatusBadge } from '@/components/shared/StatusBadges';
import { fmtCurrency } from '@/lib/constants';
import { CanAccess } from '@/components/rbac/CanAccess';

function formatDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

const CATEGORY_LABELS: Record<string, string> = {
  bbm: 'BBM',
  tol: 'Tol',
  makan: 'Makan',
  parkir: 'Parkir',
  lainnya: 'Lainnya',
};

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function SpjPage() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDate, setCreateDate] = useState(todayStr());
  const [tripSearch, setTripSearch] = useState('');
  const { toast } = useToast();

  const { data: spjList = [], isLoading } = useQuery<SpjWithDetails[]>({
    queryKey: ['/api/spj'],
    queryFn: spjApi.getAll,
  });

  const { data: tripsForCreate = [] } = useQuery<TripWithDetails[]>({
    queryKey: ['/api/trips', createDate],
    queryFn: () => tripsApi.getAll(createDate),
    enabled: showCreateDialog,
  });

  const { data: patterns = [] } = useQuery<TripPattern[]>({
    queryKey: ['/api/trip-patterns'],
    queryFn: tripPatternsApi.getAll,
    enabled: showCreateDialog,
  });

  const getPatternName = (patternId: string) => patterns.find(p => p.id === patternId)?.name ?? '—';

  const existingTripIds = new Set(spjList.map(s => s.tripId));

  const filteredTripsForCreate = tripsForCreate.filter(t => {
    const name = getPatternName(t.patternId).toLowerCase();
    return name.includes(tripSearch.toLowerCase()) || (t as any).vehiclePlate?.toLowerCase().includes(tripSearch.toLowerCase());
  });

  const createSpjMutation = useMutation({
    mutationFn: (tripId: string) => spjApi.create({ tripId }),
    onSuccess: (spj: SpjWithDetails) => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj'] });
      setShowCreateDialog(false);
      toast({ title: 'SPJ berhasil dibuat', description: `Nomor: ${spj.spjNumber}` });
      setSelectedId(spj.id);
      setView('detail');
    },
    onError: (err: any) => {
      toast({ title: 'Gagal membuat SPJ', description: err?.message || 'Terjadi kesalahan', variant: 'destructive' });
    },
  });

  const filtered = spjList.filter(s => {
    const q = search.toLowerCase();
    return s.spjNumber.toLowerCase().includes(q)
      || (s.driverName || '').toLowerCase().includes(q)
      || (s.tripPatternName || '').toLowerCase().includes(q)
      || (s.vehiclePlate || '').toLowerCase().includes(q);
  });

  const openDetail = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  if (view === 'detail' && selectedId) {
    return <SpjDetail id={selectedId} onBack={() => setView('list')} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold" data-testid="page-title-spj">Surat Perintah Jalan</h1>
            </div>
            <p className="text-sm text-muted-foreground">Kelola SPJ untuk setiap trip perjalanan. Biaya perjalanan dicatat dan diselesaikan di sini.</p>
          </div>
          <CanAccess flag="action.spj.create">
            <Button onClick={() => setShowCreateDialog(true)} data-testid="btn-create-spj">
              <Plus className="w-4 h-4 mr-1.5" /> Buat SPJ
            </Button>
          </CanAccess>
        </div>
      </div>

      <div className="px-6 py-4 border-b bg-muted/20 shrink-0">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nomor SPJ, driver, rute..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-spj"
            />
          </div>
          <Badge variant="outline" className="text-xs" data-testid="spj-count">
            {filtered.length} SPJ
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Belum ada SPJ"
            description="Klik tombol 'Buat SPJ' di atas untuk membuat SPJ baru."
          />
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {filtered.map(s => (
                <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(s.id)} data-testid={`spj-card-${s.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm font-mono">{s.spjNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.tripPatternName || '—'}</p>
                      </div>
                      <SpjStatusBadge status={s.status || 'draft'} />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.driverName || '—'}</span>
                      <span className="flex items-center gap-1"><Bus className="w-3 h-3" />{s.vehiclePlate || '—'}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(s.tripServiceDate)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Table className="hidden md:table" data-testid="spj-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">No. SPJ</TableHead>
                  <TableHead>Rute</TableHead>
                  <TableHead>Tgl. Trip</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Kendaraan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id} className="group cursor-pointer" onClick={() => openDetail(s.id)} data-testid={`spj-row-${s.id}`}>
                    <TableCell className="pl-4 py-3 font-mono text-sm font-medium">{s.spjNumber}</TableCell>
                    <TableCell className="py-3">
                      <div className="text-sm font-medium">{s.tripPatternName || '—'}</div>
                      {s.tripPatternCode && <span className="text-xs text-muted-foreground font-mono">{s.tripPatternCode}</span>}
                    </TableCell>
                    <TableCell className="py-3 text-sm">{formatDate(s.tripServiceDate)}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{s.driverName || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm font-mono">{s.vehiclePlate || '—'}</TableCell>
                    <TableCell className="py-3"><SpjStatusBadge status={s.status || 'draft'} /></TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                    <TableCell className="py-3">
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" data-testid={`btn-view-spj-${s.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Buat SPJ Baru
            </DialogTitle>
            <DialogDescription>Pilih trip yang akan dibuatkan Surat Perintah Jalan.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCreateDate(d => addDays(d, -1))} data-testid="btn-prev-date-spj">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex flex-col items-center min-w-[180px]">
                <span className="text-sm font-semibold">
                  {(() => { try { return new Date(createDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return createDate; } })()}
                </span>
              </div>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCreateDate(d => addDays(d, 1))} data-testid="btn-next-date-spj">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="ml-2 h-8 text-xs" onClick={() => setCreateDate(todayStr())}>
                Hari Ini
              </Button>
              <Input
                type="date"
                value={createDate}
                onChange={e => setCreateDate(e.target.value)}
                className="h-8 w-36 text-xs"
                data-testid="input-date-spj-create"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari rute, kendaraan..."
                value={tripSearch}
                onChange={e => setTripSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-search-trip-for-spj"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded-lg">
            {filteredTripsForCreate.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                Tidak ada trip pada tanggal ini.
              </div>
            ) : (
              <div className="divide-y">
                {filteredTripsForCreate.map(trip => {
                  const hasSpj = existingTripIds.has(trip.id);
                  const patternName = getPatternName(trip.patternId);
                  const departTime = (trip as any).originDepartHHMM || null;
                  return (
                    <div
                      key={trip.id}
                      className={`p-3 flex items-center justify-between gap-3 ${hasSpj ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/30 cursor-pointer'}`}
                      data-testid={`trip-for-spj-${trip.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate">{patternName}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground pl-5">
                          {departTime && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{departTime}</span>
                          )}
                          {(trip as any).vehiclePlate && (
                            <span className="flex items-center gap-1"><Bus className="w-3 h-3" />{(trip as any).vehiclePlate}</span>
                          )}
                          {(trip as any).driverName && (
                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{(trip as any).driverName}</span>
                          )}
                          {!(trip as any).driverName && (
                            <span className="text-amber-600">Driver belum ditugaskan</span>
                          )}
                        </div>
                      </div>
                      {hasSpj ? (
                        <Badge variant="outline" className="text-xs shrink-0">SPJ ada</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => createSpjMutation.mutate(trip.id)}
                          disabled={createSpjMutation.isPending}
                          data-testid={`btn-create-spj-for-trip-${trip.id}`}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Buat SPJ
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpjDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { toast } = useToast();
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editActual, setEditActual] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);
  const [addForm, setAddForm] = useState({ category: 'lainnya', label: '', estimatedAmount: '', isAdvance: true, notes: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);

  const { data: spjData, isLoading } = useQuery<SpjWithDetails>({
    queryKey: ['/api/spj', id],
    queryFn: () => spjApi.getById(id),
  });

  const { data: profit } = useQuery({
    queryKey: ['/api/spj/trip', spjData?.tripId, 'profit'],
    queryFn: () => spjApi.getTripProfit(spjData!.tripId),
    enabled: !!spjData?.tripId,
  });

  const issueMutation = useMutation({
    mutationFn: () => spjApi.issue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj'] });
      toast({ title: 'SPJ diterbitkan' });
    },
  });

  const settleMutation = useMutation({
    mutationFn: () => spjApi.settle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj'] });
      toast({ title: 'SPJ diselesaikan' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => spjApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj'] });
      toast({ title: 'SPJ dihapus' });
      onBack();
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: any }) => spjApi.updateCostLine(lineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj', id] });
      setEditingLine(null);
      toast({ title: 'Biaya diperbarui' });
    },
  });

  const addLineMutation = useMutation({
    mutationFn: (data: any) => spjApi.addCostLine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj', id] });
      setShowAddLine(false);
      setAddForm({ category: 'lainnya', label: '', estimatedAmount: '', isAdvance: true, notes: '' });
      toast({ title: 'Baris biaya ditambahkan' });
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: string) => spjApi.deleteCostLine(lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spj', id] });
      toast({ title: 'Baris biaya dihapus' });
    },
  });

  if (isLoading || !spjData) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="border-b px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Kembali</Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const costLines = spjData.costLines || [];
  const totalEstimated = costLines.reduce((s, l) => s + parseFloat(l.estimatedAmount || '0'), 0);
  const totalActual = costLines.reduce((s, l) => s + parseFloat(l.actualAmount || '0'), 0);
  const totalAdvance = costLines.filter(l => l.isAdvance).reduce((s, l) => s + parseFloat(l.estimatedAmount || '0'), 0);
  const settlement = totalAdvance - totalActual;
  const isDraft = spjData.status === 'draft';
  const isIssued = spjData.status === 'issued';
  const isSettled = spjData.status === 'settled';

  const startEdit = (line: SpjCostLine) => {
    setEditingLine(line.id);
    setEditActual(line.actualAmount || '');
    setEditNotes(line.notes || '');
  };

  const saveEdit = (lineId: string) => {
    updateLineMutation.mutate({ lineId, data: { actualAmount: editActual || null, notes: editNotes || null } });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-4 md:px-6 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={onBack} data-testid="btn-back-spj" className="shrink-0 px-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-lg font-semibold font-mono truncate" data-testid="spj-detail-number">{spjData.spjNumber}</h2>
                <SpjStatusBadge status={spjData.status || 'draft'} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1 print:hidden" data-testid="btn-print-spj">
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak</span>
            </Button>
            {isDraft && (
              <CanAccess flag="action.spj.issue">
                <Button size="sm" onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending} data-testid="btn-issue-spj">
                  <CheckCircle className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Terbitkan</span>
                </Button>
              </CanAccess>
            )}
            {(isIssued || spjData.status === 'on_trip') && (
              <CanAccess flag="action.spj.settle">
                <Button size="sm" variant="default" onClick={() => setShowSettleConfirm(true)} disabled={settleMutation.isPending} data-testid="btn-settle-spj">
                  <Wallet className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Selesaikan</span>
                </Button>
              </CanAccess>
            )}
            {isDraft && (
              <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)} data-testid="btn-delete-spj">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Trip</CardTitle></CardHeader>
            <CardContent className="pb-4">
              <p className="font-semibold text-sm">{spjData.tripPatternName || '—'}</p>
              {spjData.tripPatternCode && <p className="text-xs text-muted-foreground font-mono">{spjData.tripPatternCode}</p>}
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(spjData.tripServiceDate)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Driver</CardTitle></CardHeader>
            <CardContent className="pb-4">
              <p className="font-semibold text-sm">{spjData.driverName || '—'}</p>
              {spjData.driverCode && <p className="text-xs text-muted-foreground font-mono">{spjData.driverCode}</p>}
              {spjData.driverPhone && <p className="text-xs text-muted-foreground">{spjData.driverPhone}</p>}
              {spjData.driverLicenseNo && <p className="text-xs text-muted-foreground">SIM: {spjData.driverLicenseNo}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Bus className="w-3.5 h-3.5" /> Kendaraan</CardTitle></CardHeader>
            <CardContent className="pb-4">
              <p className="font-semibold text-sm">{spjData.vehicleCode || '—'}</p>
              <p className="text-xs text-muted-foreground font-mono">{spjData.vehiclePlate || '—'}</p>
            </CardContent>
          </Card>
        </div>

        {profit && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard icon={CircleDollarSign} label="Pendapatan Tiket" value={fmtCurrency(profit.ticketRevenue)} color="text-green-600" />
            <SummaryCard icon={Banknote} label="Total Biaya (Estimasi)" value={fmtCurrency(totalEstimated)} color="text-amber-600" />
            <SummaryCard icon={Banknote} label="Total Biaya (Aktual)" value={fmtCurrency(totalActual)} color="text-red-600" />
            <SummaryCard icon={TrendingUp} label="Laba Bersih" value={fmtCurrency(profit.ticketRevenue + profit.cargoRevenue - totalActual)} color="text-primary" />
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" /> Rincian Biaya Perjalanan
              </CardTitle>
              {!isSettled && (
                <Button size="sm" variant="outline" onClick={() => setShowAddLine(true)} data-testid="btn-add-cost-line">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {costLines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada rincian biaya.</p>
            ) : (
              <div className="overflow-auto">
                <Table data-testid="cost-lines-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Kategori</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Estimasi</TableHead>
                      <TableHead className="text-right">Aktual</TableHead>
                      <TableHead className="text-center">Uang Muka</TableHead>
                      <TableHead>Catatan</TableHead>
                      {!isSettled && <TableHead className="w-20" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costLines.map(line => (
                      <TableRow key={line.id} data-testid={`cost-line-${line.id}`}>
                        <TableCell className="pl-4">
                          <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[line.category] || line.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{line.label}</TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">{fmtCurrency(line.estimatedAmount)}</TableCell>
                        <TableCell className="text-right">
                          {editingLine === line.id ? (
                            <Input
                              type="number"
                              value={editActual}
                              onChange={e => setEditActual(e.target.value)}
                              className="w-28 h-7 text-sm text-right"
                              data-testid="input-actual-amount"
                            />
                          ) : (
                            <span className={`text-sm font-medium tabular-nums ${line.actualAmount ? '' : 'text-muted-foreground'}`}>
                              {line.actualAmount ? fmtCurrency(line.actualAmount) : '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {line.isAdvance ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Ya</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Tidak</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                          {editingLine === line.id ? (
                            <Input
                              value={editNotes}
                              onChange={e => setEditNotes(e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Catatan..."
                              data-testid="input-line-notes"
                            />
                          ) : (
                            line.notes || '—'
                          )}
                        </TableCell>
                        {!isSettled && (
                          <TableCell>
                            <div className="flex gap-1">
                              {editingLine === line.id ? (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveEdit(line.id)} data-testid="btn-save-line">
                                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingLine(null)}>
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(line)} data-testid={`btn-edit-line-${line.id}`}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteLineMutation.mutate(line.id)} data-testid={`btn-delete-line-${line.id}`}>
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell className="pl-4" colSpan={2}>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCurrency(totalEstimated)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCurrency(totalActual)}</TableCell>
                      <TableCell />
                      <TableCell />
                      {!isSettled && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-4 p-3 rounded-lg bg-muted/30 border space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uang muka (advance)</span>
                <span className="font-medium tabular-nums">{fmtCurrency(totalAdvance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total biaya aktual</span>
                <span className="font-medium tabular-nums">{fmtCurrency(totalActual)}</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span>{settlement >= 0 ? 'Sisa dikembalikan' : 'Kurang bayar'}</span>
                <span className={`tabular-nums ${settlement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtCurrency(Math.abs(settlement))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {(spjData as any).stops?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" /> Titik Pickup & Drop
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-0">
                {((spjData as any).stops as any[]).map((stop: any, idx: number, arr: any[]) => {
                  const isFirst = idx === 0;
                  const isLast = idx === arr.length - 1;
                  const typeLabel = stop.boardingAllowed && stop.alightingAllowed ? 'Pickup & Drop'
                    : stop.boardingAllowed ? 'Pickup' : 'Drop';
                  return (
                    <div key={idx} className="flex items-start gap-3" data-testid={`spj-stop-${idx}`}>
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${isFirst ? 'bg-primary border-primary' : isLast ? 'bg-destructive border-destructive' : 'bg-background border-muted-foreground'}`} />
                        {!isLast && <div className="w-0.5 h-8 bg-border" />}
                      </div>
                      <div className="pb-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" data-testid={`spj-stop-name-${idx}`}>{stop.stopName}</span>
                          <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{stop.stopCode}</span>
                          <Badge variant="outline" className={`text-[10px] py-0 ${stop.boardingAllowed ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950' : 'border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950'}`} data-testid={`spj-stop-type-${idx}`}>{typeLabel}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {spjData.notes && (
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground mb-1">Catatan:</p>
              <p className="text-sm">{spjData.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ThermalSpj spjData={spjData} costLines={costLines} totalEstimated={totalEstimated} totalActual={totalActual} totalAdvance={totalAdvance} settlement={settlement} />


      <Dialog open={showAddLine} onOpenChange={setShowAddLine}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Baris Biaya</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Kategori</label>
              <select
                className="w-full h-9 px-3 rounded-lg border bg-background text-sm"
                value={addForm.category}
                onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                data-testid="select-cost-category"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Keterangan</label>
              <Input value={addForm.label} onChange={e => setAddForm({ ...addForm, label: e.target.value })} placeholder="Misal: Tol Cipularang" data-testid="input-cost-label" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Estimasi (Rp)</label>
              <Input type="number" value={addForm.estimatedAmount} onChange={e => setAddForm({ ...addForm, estimatedAmount: e.target.value })} placeholder="0" data-testid="input-cost-estimated" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={addForm.isAdvance} onChange={e => setAddForm({ ...addForm, isAdvance: e.target.checked })} id="is-advance" />
              <label htmlFor="is-advance" className="text-sm">Termasuk uang muka</label>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Catatan (opsional)</label>
              <Input value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} placeholder="Catatan..." data-testid="input-cost-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLine(false)}>Batal</Button>
            <Button
              onClick={() => addLineMutation.mutate(addForm)}
              disabled={!addForm.label || !addForm.estimatedAmount || addLineMutation.isPending}
              data-testid="btn-save-cost-line"
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettleConfirm} onOpenChange={setShowSettleConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selesaikan SPJ?</DialogTitle>
            <DialogDescription>
              Konfirmasi penyelesaian Surat Perintah Jalan ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              SPJ <strong>{spjData.spjNumber}</strong> akan ditandai sebagai <strong>Selesai</strong>. Setelah diselesaikan, biaya tidak dapat diubah lagi.
            </p>
            <div className="p-3 rounded-lg bg-muted/30 border space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uang muka</span>
                <span className="font-medium tabular-nums">{fmtCurrency(totalAdvance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total biaya aktual</span>
                <span className="font-medium tabular-nums">{fmtCurrency(totalActual)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-sm font-semibold">
                <span>{settlement >= 0 ? 'Sisa dikembalikan' : 'Kurang bayar'}</span>
                <span className={`tabular-nums ${settlement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtCurrency(Math.abs(settlement))}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettleConfirm(false)}>Batal</Button>
            <Button
              onClick={() => { settleMutation.mutate(); setShowSettleConfirm(false); }}
              disabled={settleMutation.isPending}
              data-testid="btn-confirm-settle-spj"
            >
              <CheckCircle className="w-4 h-4 mr-1" /> Ya, Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus SPJ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">SPJ <strong>{spjData.spjNumber}</strong> akan dihapus beserta seluruh rincian biayanya. Tindakan ini tidak dapat dibatalkan.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Batal</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="btn-confirm-delete-spj">
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTimePrint(isoStr: string | null) {
  if (!isoStr) return '-';
  try {
    return new Date(isoStr).toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  } catch {
    return isoStr;
  }
}

const STATUS_LABELS_PRINT: Record<string, string> = {
  draft: 'DRAFT',
  issued: 'DITERBITKAN',
  on_trip: 'DALAM PERJALANAN',
  settled: 'SELESAI',
};

function ThermalSpj({ spjData, costLines, totalEstimated, totalActual, totalAdvance, settlement }: {
  spjData: SpjWithDetails;
  costLines: SpjCostLine[];
  totalEstimated: number;
  totalActual: number;
  totalAdvance: number;
  settlement: number;
}) {
  const line = '————————————————————————————————————————————————';
  const doubleLine = '================================================';
  const stops = (spjData as any).stops as any[] | undefined;

  return (
    <div id="thermal-manifest" className="hidden print:block font-mono text-[11pt] leading-relaxed whitespace-pre-wrap">
      <div className="text-center font-bold text-[14pt]">SURAT PERINTAH JALAN</div>
      <div className="text-center font-bold text-[11pt]">TRANSITY SHUTTLE</div>
      <div>{doubleLine}</div>
      <div>No SPJ  : {spjData.spjNumber}</div>
      <div>Status  : {STATUS_LABELS_PRINT[spjData.status || 'draft']}</div>
      <div>Tanggal : {formatDateShort(spjData.tripServiceDate as string)}</div>
      <div>{line}</div>
      <div>Rute    : {spjData.tripPatternName || '-'}</div>
      {spjData.tripPatternCode && <div>Kode    : {spjData.tripPatternCode}</div>}
      <div>Plat    : {spjData.vehiclePlate || '-'} ({spjData.vehicleCode || '-'})</div>
      <div>Driver  : {spjData.driverName || '-'}</div>
      {spjData.driverLicenseNo && <div>SIM     : {spjData.driverLicenseNo}</div>}
      {spjData.driverPhone && <div>HP      : {spjData.driverPhone}</div>}
      <div>{doubleLine}</div>

      {stops && stops.length > 0 && (
        <>
          <div className="font-bold">TITIK PICKUP & DROP</div>
          <div>{line}</div>
          {stops.map((stop: any, i: number) => {
            const type = stop.boardingAllowed && stop.alightingAllowed ? 'P/D'
              : stop.boardingAllowed ? 'Pickup' : 'Drop';
            return (
              <div key={i}>
                {String(i + 1).padStart(2, ' ')}. {stop.stopName} ({stop.stopCode}) [{type}]
              </div>
            );
          })}
          <div>{doubleLine}</div>
        </>
      )}

      <div className="font-bold">RINCIAN BIAYA</div>
      <div>{line}</div>
      {costLines.length === 0 ? (
        <div>  (Belum ada rincian biaya)</div>
      ) : (
        costLines.map((cl, i) => (
          <div key={cl.id} style={{ marginBottom: '4pt' }}>
            <div>{String(i + 1).padStart(2, ' ')}. [{CATEGORY_LABELS[cl.category] || cl.category}] {cl.label}</div>
            <div>   Est: {fmtCurrency(cl.estimatedAmount)}{cl.actualAmount ? ` | Aktual: ${fmtCurrency(cl.actualAmount)}` : ''}{cl.isAdvance ? ' [UM]' : ''}</div>
            {cl.notes && <div>   {cl.notes}</div>}
          </div>
        ))
      )}
      <div>{line}</div>
      <div>Total Estimasi : {fmtCurrency(totalEstimated)}</div>
      <div>Total Aktual   : {fmtCurrency(totalActual)}</div>
      <div>{doubleLine}</div>
      <div>Uang Muka      : {fmtCurrency(totalAdvance)}</div>
      <div>Biaya Aktual   : {fmtCurrency(totalActual)}</div>
      <div className="font-bold">{settlement >= 0 ? 'Sisa Kembali' : 'Kurang Bayar'}   : {fmtCurrency(Math.abs(settlement))}</div>
      <div>{doubleLine}</div>

      {spjData.notes && (
        <>
          <div>Catatan: {spjData.notes}</div>
          <div>{line}</div>
        </>
      )}

      <div style={{ marginTop: '8pt' }}>Dicetak: {formatDateTimePrint(new Date().toISOString())}</div>
      {spjData.issuedAt && <div>Diterbitkan: {formatDateTimePrint(spjData.issuedAt as string)}</div>}
      {spjData.settledAt && <div>Diselesaikan: {formatDateTimePrint(spjData.settledAt as string)}</div>}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
