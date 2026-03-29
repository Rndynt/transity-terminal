import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { fmtCurrency, fmtDate, CUSTOMER_TAG_MAP, type CustomerTag } from '@/lib/constants';
import { customersApi } from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Contact, Search, X, Loader2, Plus, Pencil, Eye, Phone, Mail, CreditCard, MapPin
} from 'lucide-react';

interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  idNumber: string | null;
  totalTrips: number;
  totalSpent: string;
  firstTripDate: string | null;
  lastTripDate: string | null;
  preferredSeat: string | null;
  preferredRoute: string | null;
  tag: CustomerTag;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerDetail extends Customer {
  bookings: Array<{
    id: string;
    booking_code: string;
    status: string;
    total_amount: string;
    channel: string;
    created_at: string;
    origin_name: string;
    dest_name: string;
  }>;
}

const ALL_TAGS: CustomerTag[] = ['regular', 'vip', 'frequent', 'blacklist'];

function TagBadge({ tag }: { tag: CustomerTag }) {
  const cfg = CUSTOMER_TAG_MAP[tag] || CUSTOMER_TAG_MAP.regular;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cfg.color} ${cfg.bg}`} data-testid={`badge-tag-${tag}`}>
      {cfg.label}
    </span>
  );
}

function CustomerFormDialog({
  isOpen,
  onClose,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
}) {
  const { toast } = useToast();
  const isEdit = !!customer;

  const [fullName, setFullName] = useState(customer?.fullName || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [idNumber, setIdNumber] = useState(customer?.idNumber || '');
  const [tag, setTag] = useState<CustomerTag>(customer?.tag || 'regular');
  const [notes, setNotes] = useState(customer?.notes || '');

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { fullName, phone, email: email || null, idNumber: idNumber || null, tag, notes: notes || null };
      if (isEdit) {
        await customersApi.update(customer!.id, payload);
      } else {
        await customersApi.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: isEdit ? 'Pelanggan diperbarui' : 'Pelanggan ditambahkan' });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nama Lengkap *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" data-testid="input-customer-name" />
          </div>
          <div>
            <Label>Telepon *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" data-testid="input-customer-phone" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" data-testid="input-customer-email" />
          </div>
          <div>
            <Label>No. Identitas</Label>
            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="KTP / SIM" data-testid="input-customer-id-number" />
          </div>
          <div>
            <Label>Tag</Label>
            <Select value={tag} onValueChange={(v) => setTag(v as CustomerTag)}>
              <SelectTrigger data-testid="select-customer-tag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_TAGS.map((t) => (
                  <SelectItem key={t} value={t}>{CUSTOMER_TAG_MAP[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Catatan</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tentang pelanggan" data-testid="input-customer-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-customer">Batal</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!fullName || !phone || mutation.isPending}
            data-testid="button-save-customer"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {isEdit ? 'Simpan' : 'Tambah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetailDialog({
  customerId,
  isOpen,
  onClose,
}: {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery<CustomerDetail>({
    queryKey: ['/api/customers', customerId],
    enabled: isOpen && !!customerId,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Pelanggan</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <LoadingState message="Memuat data pelanggan..." />
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold" data-testid="text-detail-name">{detail.fullName}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{detail.phone}</span>
                  {detail.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{detail.email}</span>}
                  {detail.idNumber && <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" />{detail.idNumber}</span>}
                </div>
              </div>
              <TagBadge tag={detail.tag} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Total Trip</div>
                <div className="text-lg font-semibold" data-testid="text-detail-trips">{detail.totalTrips}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Total Spent</div>
                <div className="text-lg font-semibold" data-testid="text-detail-spent">{fmtCurrency(detail.totalSpent)}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Trip Pertama</div>
                <div className="text-sm font-medium">{detail.firstTripDate || '—'}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Trip Terakhir</div>
                <div className="text-sm font-medium">{detail.lastTripDate || '—'}</div>
              </Card>
            </div>

            {detail.notes && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                {detail.notes}
              </div>
            )}

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Riwayat Booking ({detail.bookings?.length || 0})</h4>
              {detail.bookings && detail.bookings.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detail.bookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 p-2 rounded-md border text-sm flex-wrap" data-testid={`row-booking-${b.id}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-medium">{b.booking_code}</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {b.origin_name} → {b.dest_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{b.status}</Badge>
                        <span className="text-xs text-muted-foreground">{fmtCurrency(b.total_amount)}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(b.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada riwayat booking</p>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="Data tidak ditemukan" />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CustomersPage() {
  usePageTitle("Pelanggan", "Data pelanggan & kategori");
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<CustomerTag | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers', { search }],
    queryFn: () => customersApi.getAll(search || undefined),
  });

  const filtered = activeTag === 'all' ? customers : customers.filter((c) => c.tag === activeTag);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="customers-page">
      <PageHeader icon={Contact} title="Pelanggan" subtitle="Data pelanggan & kategori" />

      <div className="p-3 md:p-4 space-y-3 flex-shrink-0 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / telepon..."
              className="w-full h-9 pl-9 pr-8 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              data-testid="input-search-customer"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" data-testid="button-clear-search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={() => { setEditCustomer(null); setFormOpen(true); }} data-testid="button-add-customer">
            <Plus className="w-4 h-4 mr-1" /> Tambah
          </Button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTag('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${activeTag === 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
            data-testid="filter-tag-all"
          >
            Semua
          </button>
          {ALL_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${activeTag === t ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
              data-testid={`filter-tag-${t}`}
            >
              {CUSTOMER_TAG_MAP[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState message="Memuat data pelanggan..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="Tidak ada pelanggan ditemukan" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-customers">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Nama</th>
                  <th className="px-3 py-2 font-medium">Telepon</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Email</th>
                  <th className="px-3 py-2 font-medium text-right">Total Trip</th>
                  <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Total Spent</th>
                  <th className="px-3 py-2 font-medium">Tag</th>
                  <th className="px-3 py-2 font-medium hidden lg:table-cell">Last Trip</th>
                  <th className="px-3 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b hover-elevate" data-testid={`row-customer-${c.id}`}>
                    <td className="px-3 py-2 font-medium">{c.fullName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.phone}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{c.email || '—'}</td>
                    <td className="px-3 py-2 text-right">{c.totalTrips}</td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">{fmtCurrency(c.totalSpent)}</td>
                    <td className="px-3 py-2"><TagBadge tag={c.tag} /></td>
                    <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">{c.lastTripDate || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setDetailId(c.id)} data-testid={`button-view-customer-${c.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditCustomer(c); setFormOpen(true); }} data-testid={`button-edit-customer-${c.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <CustomerFormDialog
          isOpen={formOpen}
          onClose={() => { setFormOpen(false); setEditCustomer(null); }}
          customer={editCustomer}
        />
      )}

      <CustomerDetailDialog
        customerId={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
