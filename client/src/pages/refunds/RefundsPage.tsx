import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { fmtCurrency, fmtDate, REFUND_STATUS_MAP, type RefundStatus } from '@/lib/constants';
import { refundsApi } from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
import {
  RotateCcw, Search, X, Loader2, Eye, Check, XCircle,
  ArrowRight, Plus, CreditCard, Building2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

interface RefundRow {
  id: string;
  booking_id: string;
  passenger_id: string | null;
  original_amount: string;
  refund_amount: string;
  admin_fee: string;
  reason: string | null;
  refund_method: string | null;
  status: RefundStatus;
  requested_by: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  processed_by: string | null;
  processed_at: string | null;
  bank_account: string | null;
  bank_name: string | null;
  notes: string | null;
  created_at: string;
  booking_code: string | null;
  passenger_name: string | null;
}

interface RefundDetail extends RefundRow {
  booking_total: string | null;
  booking_status: string | null;
  ticket_number: string | null;
}

const STATUS_PILLS: { value: RefundStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Semua' },
  { value: 'pending',   label: REFUND_STATUS_MAP.pending.label },
  { value: 'approved',  label: REFUND_STATUS_MAP.approved.label },
  { value: 'processed', label: REFUND_STATUS_MAP.processed.label },
  { value: 'rejected',  label: REFUND_STATUS_MAP.rejected.label },
];

export default function RefundsPage() {
  usePageTitle("Manajemen Refund", "Kelola pembatalan & pengembalian");
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RefundStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const [form, setForm] = useState({
    bookingId: '',
    passengerId: '',
    originalAmount: '',
    refundAmount: '',
    adminFee: '0',
    reason: '',
    refundMethod: 'cash',
    bankAccount: '',
    bankName: '',
    notes: '',
  });

  const { data: refundsList, isLoading } = useQuery<RefundRow[]>({
    queryKey: ['/api/refunds'],
  });

  const { data: detail, isLoading: detailLoading } = useQuery<RefundDetail>({
    queryKey: ['/api/refunds', selectedId],
    enabled: !!selectedId && detailOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      await refundsApi.create({
        bookingId: data.bookingId,
        passengerId: data.passengerId || null,
        originalAmount: parseFloat(data.originalAmount) || 0,
        refundAmount: parseFloat(data.refundAmount) || 0,
        adminFee: parseFloat(data.adminFee) || 0,
        reason: data.reason,
        refundMethod: data.refundMethod,
        bankAccount: data.bankAccount || null,
        bankName: data.bankName || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/refunds'] });
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Refund berhasil dibuat' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal membuat refund', description: err.message, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await refundsApi.approve(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/refunds'] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ['/api/refunds', selectedId] });
      toast({ title: 'Refund disetujui' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal approve', description: err.message, variant: 'destructive' });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      await refundsApi.process(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/refunds'] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ['/api/refunds', selectedId] });
      toast({ title: 'Refund diproses' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal proses', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      await refundsApi.reject(id, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/refunds'] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ['/api/refunds', selectedId] });
      setRejectOpen(false);
      setRejectId(null);
      setRejectNotes('');
      toast({ title: 'Refund ditolak' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal reject', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setForm({
      bookingId: '', passengerId: '', originalAmount: '', refundAmount: '',
      adminFee: '0', reason: '', refundMethod: 'cash', bankAccount: '', bankName: '', notes: '',
    });
  };

  const filtered = (refundsList || []).filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = [r.booking_code, r.passenger_name, r.reason].filter(Boolean).join(' ').toLowerCase();
      if (!match.includes(q)) return false;
    }
    return true;
  });

  if (isLoading) return <LoadingState message="Memuat data refund..." />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="refunds-page">
      <PageHeader
        icon={RotateCcw}
        title="Manajemen Refund"
        subtitle="Kelola pembatalan & pengembalian"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-create-refund">
            <Plus className="w-4 h-4 mr-1" /> Buat Refund
          </Button>
        }
      />

      <div className="p-3 md:p-4 space-y-3 flex-shrink-0 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Cari kode booking, nama..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              data-testid="input-search-refunds"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" data-testid="button-clear-search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {STATUS_PILLS.map(p => (
            <button
              key={p.value}
              onClick={() => setStatusFilter(p.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                statusFilter === p.value
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              data-testid={`pill-status-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={RotateCcw} title="Tidak ada refund" description="Belum ada data refund yang sesuai filter." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3 font-medium">Kode Booking</th>
                      <th className="p-3 font-medium">Nama</th>
                      <th className="p-3 font-medium text-right">Original</th>
                      <th className="p-3 font-medium text-right">Refund</th>
                      <th className="p-3 font-medium text-right">Admin Fee</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Tanggal</th>
                      <th className="p-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const sc = REFUND_STATUS_MAP[r.status as RefundStatus];
                      return (
                        <tr key={r.id} className="border-b last:border-0" data-testid={`row-refund-${r.id}`}>
                          <td className="p-3 font-mono text-xs" data-testid={`text-booking-code-${r.id}`}>
                            {r.booking_code || '—'}
                          </td>
                          <td className="p-3" data-testid={`text-passenger-${r.id}`}>
                            {r.passenger_name || '—'}
                          </td>
                          <td className="p-3 text-right">{fmtCurrency(r.original_amount)}</td>
                          <td className="p-3 text-right font-medium">{fmtCurrency(r.refund_amount)}</td>
                          <td className="p-3 text-right">{fmtCurrency(r.admin_fee)}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={sc ? `${sc.color} ${sc.bg}` : ''} data-testid={`badge-status-${r.id}`}>
                              {sc?.label ?? r.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{fmtDate(r.requested_at)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => { setSelectedId(r.id); setDetailOpen(true); }}
                                data-testid={`button-detail-${r.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {r.status === 'pending' && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => approveMutation.mutate(r.id)}
                                    disabled={approveMutation.isPending}
                                    data-testid={`button-approve-${r.id}`}
                                  >
                                    <Check className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => { setRejectId(r.id); setRejectOpen(true); }}
                                    data-testid={`button-reject-${r.id}`}
                                  >
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                              {r.status === 'approved' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => processMutation.mutate(r.id)}
                                  disabled={processMutation.isPending}
                                  data-testid={`button-process-${r.id}`}
                                >
                                  <ArrowRight className="w-4 h-4 text-blue-600" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Refund Baru</DialogTitle>
            <DialogDescription>Isi data refund untuk booking yang akan di-refund.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Booking ID</Label>
              <Input
                value={form.bookingId}
                onChange={e => setForm(f => ({ ...f, bookingId: e.target.value }))}
                placeholder="UUID booking"
                data-testid="input-booking-id"
              />
            </div>
            <div>
              <Label>Passenger ID (opsional)</Label>
              <Input
                value={form.passengerId}
                onChange={e => setForm(f => ({ ...f, passengerId: e.target.value }))}
                placeholder="UUID penumpang"
                data-testid="input-passenger-id"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Original Amount</Label>
                <Input
                  type="number"
                  value={form.originalAmount}
                  onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))}
                  data-testid="input-original-amount"
                />
              </div>
              <div>
                <Label>Refund Amount</Label>
                <Input
                  type="number"
                  value={form.refundAmount}
                  onChange={e => setForm(f => ({ ...f, refundAmount: e.target.value }))}
                  data-testid="input-refund-amount"
                />
              </div>
              <div>
                <Label>Admin Fee</Label>
                <Input
                  type="number"
                  value={form.adminFee}
                  onChange={e => setForm(f => ({ ...f, adminFee: e.target.value }))}
                  data-testid="input-admin-fee"
                />
              </div>
            </div>
            <div>
              <Label>Alasan Refund</Label>
              <Textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Alasan refund..."
                className="resize-none"
                data-testid="input-reason"
              />
            </div>
            <div>
              <Label>Metode Refund</Label>
              <Select value={form.refundMethod} onValueChange={v => setForm(f => ({ ...f, refundMethod: v }))}>
                <SelectTrigger data-testid="select-refund-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.refundMethod === 'transfer' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Nama Bank</Label>
                  <Input
                    value={form.bankName}
                    onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                    placeholder="BCA, BRI, dll"
                    data-testid="input-bank-name"
                  />
                </div>
                <div>
                  <Label>No. Rekening</Label>
                  <Input
                    value={form.bankAccount}
                    onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))}
                    placeholder="1234567890"
                    data-testid="input-bank-account"
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Catatan</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan tambahan..."
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }} data-testid="button-cancel-create">
              Batal
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.bookingId || !form.originalAmount || !form.refundAmount}
              data-testid="button-submit-refund"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Buat Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={o => { setDetailOpen(o); if (!o) setSelectedId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Refund</DialogTitle>
            <DialogDescription>Informasi lengkap refund dan aksi yang tersedia.</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Kode Booking</span>
                  <p className="font-mono font-medium" data-testid="text-detail-booking-code">{detail.booking_code || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Penumpang</span>
                  <p className="font-medium" data-testid="text-detail-passenger">{detail.passenger_name || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tiket</span>
                  <p className="font-mono text-xs">{detail.ticket_number || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status Booking</span>
                  <p>{detail.booking_status || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Original</span>
                  <p className="font-medium">{fmtCurrency(detail.original_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Refund</span>
                  <p className="font-medium text-green-700">{fmtCurrency(detail.refund_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Admin Fee</span>
                  <p className="font-medium text-red-700">{fmtCurrency(detail.admin_fee)}</p>
                </div>
              </div>

              <div className="text-sm space-y-2">
                <div>
                  <span className="text-muted-foreground">Alasan</span>
                  <p>{detail.reason || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Metode:</span>
                  {detail.refund_method === 'transfer' ? (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Transfer — {detail.bank_name} {detail.bank_account}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> Tunai
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant="outline" className={`${REFUND_STATUS_MAP[detail.status]?.color} ${REFUND_STATUS_MAP[detail.status]?.bg}`}>
                    {REFUND_STATUS_MAP[detail.status]?.label ?? detail.status}
                  </Badge>
                </div>
                {detail.notes && (
                  <div>
                    <span className="text-muted-foreground">Catatan:</span>
                    <p className="text-xs">{detail.notes}</p>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Diminta oleh: {detail.requested_by || '—'} — {fmtDate(detail.requested_at)}</p>
                {detail.approved_by && <p>Disetujui oleh: {detail.approved_by} — {fmtDate(detail.approved_at)}</p>}
                {detail.processed_by && <p>Diproses oleh: {detail.processed_by} — {fmtDate(detail.processed_at)}</p>}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                {detail.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => { approveMutation.mutate(detail.id); }}
                      disabled={approveMutation.isPending}
                      data-testid="button-detail-approve"
                    >
                      {approveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setRejectId(detail.id); setRejectOpen(true); }}
                      data-testid="button-detail-reject"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                {detail.status === 'approved' && (
                  <Button
                    size="sm"
                    onClick={() => { processMutation.mutate(detail.id); }}
                    disabled={processMutation.isPending}
                    data-testid="button-detail-process"
                  >
                    {processMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1" />}
                    Proses Refund
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Data tidak ditemukan.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={o => { setRejectOpen(o); if (!o) { setRejectId(null); setRejectNotes(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tolak Refund</DialogTitle>
            <DialogDescription>Berikan alasan penolakan refund ini.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Alasan Penolakan</Label>
            <Textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              placeholder="Alasan penolakan..."
              className="resize-none"
              data-testid="input-reject-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectId(null); setRejectNotes(''); }} data-testid="button-cancel-reject">
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (rejectId) rejectMutation.mutate({ id: rejectId, notes: rejectNotes }); }}
              disabled={rejectMutation.isPending || !rejectNotes.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Tolak Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
