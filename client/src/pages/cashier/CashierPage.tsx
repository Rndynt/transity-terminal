import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { fmtCurrency, fmtDate, CASHIER_STATUS_MAP, type CashierSessionStatus } from '@/lib/constants';
import { cashierApi } from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Wallet, DoorOpen, DoorClosed, Clock, CheckCircle, Eye,
  AlertTriangle, Banknote, CreditCard, Smartphone
} from 'lucide-react';

type CashierSession = {
  id: string;
  outletId: string;
  staffId: string;
  staffName: string | null;
  openedAt: string;
  closedAt: string | null;
  openingBalance: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
};

type CashierSettlement = {
  id: string;
  sessionId: string;
  paymentMethod: string;
  systemAmount: string;
  actualAmount: string;
  difference: string;
  notes: string | null;
};

type TransactionRow = {
  id: string;
  amount: string;
  method: string;
  status: string;
  created_at: string;
  booking_code: string;
};

type SummaryRow = {
  method: string;
  count: number;
  total: string;
};

type ActiveSummary = {
  session: CashierSession | null;
  summary: SummaryRow[];
  transactions: TransactionRow[];
};

type SessionDetail = {
  session: CashierSession | null;
  settlements: CashierSettlement[];
  transactions: TransactionRow[];
};

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Tunai', icon: Banknote },
  { key: 'qris', label: 'QRIS', icon: Smartphone },
  { key: 'transfer', label: 'Transfer', icon: CreditCard },
];

function StatusBadge({ status }: { status: string }) {
  const info = CASHIER_STATUS_MAP[status as CashierSessionStatus];
  if (info) {
    return <Badge variant="outline" className={`${info.color} ${info.bg}`} data-testid={`badge-status-${status}`}>{info.label}</Badge>;
  }
  return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{status}</Badge>;
}

export default function CashierPage() {
  usePageTitle("Rekonsiliasi Kasir", "Buka, tutup & rekonsiliasi sesi kasir");
  const { toast } = useToast();
  const [tab, setTab] = useState('session');
  const [openBalance, setOpenBalance] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [settlements, setSettlements] = useState<Record<string, { system: number; actual: string }>>({
    cash: { system: 0, actual: '' },
    qris: { system: 0, actual: '' },
    transfer: { system: 0, actual: '' },
  });
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: activeSession, isLoading: loadingActive } = useQuery<CashierSession | null>({
    queryKey: ['/api/cashier/active'],
  });

  const { data: activeSummary, isLoading: loadingSummary } = useQuery<ActiveSummary>({
    queryKey: ['/api/cashier/active/summary'],
    enabled: !!activeSession,
    refetchInterval: 30000,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<CashierSession[]>({
    queryKey: ['/api/cashier/history'],
  });

  const { data: sessionDetail, isLoading: loadingDetail } = useQuery<SessionDetail>({
    queryKey: ['/api/cashier', selectedSessionId, 'detail'],
    enabled: !!selectedSessionId,
  });

  const openMutation = useMutation({
    mutationFn: async () => {
      return cashierApi.open({
        openingBalance: parseFloat(openBalance) || 0,
        notes: openNotes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cashier/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cashier/history'] });
      setOpenBalance('');
      setOpenNotes('');
      toast({ title: 'Sesi kasir dibuka' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal membuka sesi', description: err.message, variant: 'destructive' });
    },
  });

  const summaryByMethod = activeSummary?.summary?.reduce<Record<string, number>>((acc, s) => {
    acc[s.method] = parseFloat(s.total) || 0;
    return acc;
  }, {}) ?? {};

  const closeMutation = useMutation({
    mutationFn: async () => {
      const settlementsArr = PAYMENT_METHODS.map(pm => ({
        paymentMethod: pm.key,
        systemAmount: summaryByMethod[pm.key] || 0,
        actualAmount: parseFloat(settlements[pm.key]?.actual || '0') || 0,
      }));
      await cashierApi.close({
        sessionId: activeSession?.id ?? '',
        settlements: settlementsArr,
        notes: closeNotes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cashier/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cashier/active/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cashier/history'] });
      setCloseNotes('');
      setSettlements({
        cash: { system: 0, actual: '' },
        qris: { system: 0, actual: '' },
        transfer: { system: 0, actual: '' },
      });
      toast({ title: 'Sesi kasir ditutup, menunggu approval' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal menutup sesi', description: err.message, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await cashierApi.approve(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cashier/history'] });
      if (selectedSessionId) {
        queryClient.invalidateQueries({ queryKey: ['/api/cashier', selectedSessionId, 'detail'] });
      }
      toast({ title: 'Sesi disetujui' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal approve', description: err.message, variant: 'destructive' });
    },
  });

  function getTotalDifference() {
    return PAYMENT_METHODS.reduce((sum, pm) => {
      const s = settlements[pm.key];
      const actual = parseFloat(s?.actual || '0') || 0;
      const system = summaryByMethod[pm.key] || 0;
      return sum + (actual - system);
    }, 0);
  }

  function openDetail(id: string) {
    setSelectedSessionId(id);
    setDetailDialogOpen(true);
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader icon={Wallet} title="Rekonsiliasi Kasir" subtitle="Buka, tutup & rekonsiliasi sesi kasir" />

      <div className="flex-1 overflow-auto">
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
          <div className="px-4 md:px-6 pt-4 shrink-0 border-b">
            <TabsList data-testid="tabs-cashier">
              <TabsTrigger value="session" data-testid="tab-session">Sesi Aktif</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">Riwayat</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="session" className="px-4 md:px-6 py-4 pb-20 space-y-4">
            {loadingActive ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground">Memuat...</CardContent></Card>
            ) : !activeSession ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DoorOpen className="w-5 h-5" />
                    Buka Sesi Kasir
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Saldo Awal (Rp)</label>
                    <Input
                      data-testid="input-opening-balance"
                      type="number"
                      placeholder="0"
                      value={openBalance}
                      onChange={e => setOpenBalance(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Catatan (opsional)</label>
                    <Textarea
                      data-testid="input-open-notes"
                      placeholder="Catatan pembukaan sesi..."
                      value={openNotes}
                      onChange={e => setOpenNotes(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-open-session"
                    onClick={() => openMutation.mutate()}
                    disabled={openMutation.isPending}
                  >
                    <DoorOpen className="w-4 h-4 mr-2" />
                    {openMutation.isPending ? 'Membuka...' : 'Buka Sesi'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Clock className="w-5 h-5" />
                      Sesi Aktif
                      <StatusBadge status={activeSession.status} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Kasir</p>
                        <p className="font-medium" data-testid="text-staff-name">{activeSession.staffName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dibuka</p>
                        <p className="font-medium" data-testid="text-opened-at">{fmtDate(activeSession.openedAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Saldo Awal</p>
                        <p className="font-medium" data-testid="text-opening-balance">{fmtCurrency(activeSession.openingBalance)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <StatusBadge status={activeSession.status} />
                      </div>
                    </div>
                    {activeSession.notes && (
                      <p className="mt-3 text-sm text-muted-foreground">Catatan: {activeSession.notes}</p>
                    )}
                  </CardContent>
                </Card>

                {loadingSummary ? (
                  <Card><CardContent className="p-6 text-center text-muted-foreground">Memuat transaksi...</CardContent></Card>
                ) : (activeSummary?.transactions?.length ?? 0) > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Banknote className="w-5 h-5" />
                        Transaksi Sesi Ini ({activeSummary?.transactions?.length ?? 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-3 gap-3 px-4 pb-3">
                        {PAYMENT_METHODS.map(pm => {
                          const total = summaryByMethod[pm.key] || 0;
                          const count = activeSummary?.summary?.find(s => s.method === pm.key)?.count || 0;
                          const Icon = pm.icon;
                          return (
                            <div key={pm.key} className="rounded-md border p-3 text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <Icon className="w-3 h-3" />
                                {pm.label}
                              </div>
                              <p className="font-semibold" data-testid={`text-summary-${pm.key}`}>{fmtCurrency(total)}</p>
                              <p className="text-xs text-muted-foreground">{count} transaksi</p>
                            </div>
                          );
                        })}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kode Booking</TableHead>
                            <TableHead>Metode</TableHead>
                            <TableHead className="text-right">Jumlah</TableHead>
                            <TableHead>Waktu</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeSummary!.transactions.map(tx => (
                            <TableRow key={tx.id}>
                              <TableCell className="font-mono text-sm">{tx.booking_code || '—'}</TableCell>
                              <TableCell className="capitalize">{tx.method}</TableCell>
                              <TableCell className="text-right">{fmtCurrency(tx.amount)}</TableCell>
                              <TableCell>{fmtDate(tx.created_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-6">
                      <EmptyState
                        icon={Banknote}
                        title="Belum ada transaksi"
                        description="Transaksi pembayaran selama sesi ini akan muncul di sini secara otomatis"
                      />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DoorClosed className="w-5 h-5" />
                      Tutup Sesi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metode</TableHead>
                          <TableHead className="text-right">Sistem (Rp)</TableHead>
                          <TableHead className="text-right">Aktual (Rp)</TableHead>
                          <TableHead className="text-right">Selisih</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PAYMENT_METHODS.map(pm => {
                          const systemAmt = summaryByMethod[pm.key] || 0;
                          const s = settlements[pm.key];
                          const actual = parseFloat(s?.actual || '0') || 0;
                          const diff = actual - systemAmt;
                          const Icon = pm.icon;
                          return (
                            <TableRow key={pm.key}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-muted-foreground" />
                                  {pm.label}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium" data-testid={`text-system-${pm.key}`}>
                                {fmtCurrency(systemAmt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  data-testid={`input-actual-${pm.key}`}
                                  type="number"
                                  placeholder="0"
                                  value={s?.actual || ''}
                                  onChange={e => setSettlements(prev => ({
                                    ...prev,
                                    [pm.key]: { ...prev[pm.key], actual: e.target.value },
                                  }))}
                                  className="text-right w-32 ml-auto"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={diff < 0 ? 'text-red-600 font-medium' : diff > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                  {fmtCurrency(diff)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                      <span className="font-medium">Total Selisih</span>
                      <span
                        data-testid="text-total-difference"
                        className={`font-bold text-lg ${getTotalDifference() < 0 ? 'text-red-600' : getTotalDifference() > 0 ? 'text-green-600' : ''}`}
                      >
                        {fmtCurrency(getTotalDifference())}
                      </span>
                    </div>

                    {getTotalDifference() !== 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                        Ada selisih pada rekonsiliasi. Pastikan jumlah sudah benar.
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Catatan Penutupan</label>
                      <Textarea
                        data-testid="input-close-notes"
                        placeholder="Catatan penutupan sesi..."
                        value={closeNotes}
                        onChange={e => setCloseNotes(e.target.value)}
                      />
                    </div>

                    <Button
                      data-testid="button-close-session"
                      variant="destructive"
                      onClick={() => closeMutation.mutate()}
                      disabled={closeMutation.isPending || loadingSummary}
                    >
                      <DoorClosed className="w-4 h-4 mr-2" />
                      {closeMutation.isPending ? 'Menutup...' : loadingSummary ? 'Memuat data...' : 'Tutup Sesi'}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="px-4 md:px-6 py-4 pb-20">
            <Card>
              <CardContent className="p-0">
                {loadingHistory ? (
                  <div className="p-6 text-center text-muted-foreground">Memuat riwayat...</div>
                ) : history.length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="Belum ada riwayat sesi"
                    description="Riwayat sesi kasir akan muncul di sini"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kasir</TableHead>
                        <TableHead>Dibuka</TableHead>
                        <TableHead>Ditutup</TableHead>
                        <TableHead>Saldo Awal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approved By</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map(session => (
                        <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                          <TableCell className="font-medium">{session.staffName || '—'}</TableCell>
                          <TableCell>{fmtDate(session.openedAt)}</TableCell>
                          <TableCell>{session.closedAt ? fmtDate(session.closedAt) : '—'}</TableCell>
                          <TableCell>{fmtCurrency(session.openingBalance)}</TableCell>
                          <TableCell><StatusBadge status={session.status} /></TableCell>
                          <TableCell>{session.approvedBy || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-detail-${session.id}`}
                                onClick={() => openDetail(session.id)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {session.status === 'closing' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`button-approve-${session.id}`}
                                  onClick={() => approveMutation.mutate(session.id)}
                                  disabled={approveMutation.isPending}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Detail Sesi Kasir
            </DialogTitle>
            <DialogDescription>
              Rincian rekonsiliasi dan transaksi sesi kasir
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="p-6 text-center text-muted-foreground">Memuat detail...</div>
          ) : sessionDetail?.session ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Kasir</p>
                  <p className="font-medium">{sessionDetail.session.staffName || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <StatusBadge status={sessionDetail.session.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">Dibuka</p>
                  <p className="font-medium">{fmtDate(sessionDetail.session.openedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ditutup</p>
                  <p className="font-medium">{sessionDetail.session.closedAt ? fmtDate(sessionDetail.session.closedAt) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo Awal</p>
                  <p className="font-medium">{fmtCurrency(sessionDetail.session.openingBalance)}</p>
                </div>
                {sessionDetail.session.approvedBy && (
                  <div>
                    <p className="text-muted-foreground">Disetujui oleh</p>
                    <p className="font-medium">{sessionDetail.session.approvedBy}</p>
                  </div>
                )}
              </div>

              {sessionDetail.settlements.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Rekonsiliasi</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metode</TableHead>
                        <TableHead className="text-right">Sistem</TableHead>
                        <TableHead className="text-right">Aktual</TableHead>
                        <TableHead className="text-right">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionDetail.settlements.map(s => {
                        const diff = parseFloat(s.difference);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="capitalize">{s.paymentMethod}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(s.systemAmount)}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(s.actualAmount)}</TableCell>
                            <TableCell className={`text-right font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : ''}`}>
                              {fmtCurrency(s.difference)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {sessionDetail.transactions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Transaksi ({sessionDetail.transactions.length})</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode Booking</TableHead>
                        <TableHead>Metode</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead>Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionDetail.transactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-sm">{tx.booking_code || '—'}</TableCell>
                          <TableCell className="capitalize">{tx.method}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(tx.amount)}</TableCell>
                          <TableCell>{fmtDate(tx.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {sessionDetail.session.status === 'closing' && (
                <DialogFooter>
                  <Button
                    data-testid="button-approve-detail"
                    onClick={() => approveMutation.mutate(sessionDetail.session!.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {approveMutation.isPending ? 'Menyetujui...' : 'Setujui Sesi'}
                  </Button>
                </DialogFooter>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">Data tidak ditemukan</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
