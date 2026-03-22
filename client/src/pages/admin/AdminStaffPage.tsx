import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, Plus, Pencil, PowerOff, Shield, Store, Loader2, Search, RefreshCw
} from 'lucide-react';

interface StaffMember {
  id: string;
  userId: string;
  roleId: string;
  outletId: string | null;
  isActive: boolean;
  createdAt: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Outlet {
  id: string;
  name: string;
  code: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
  return res.json();
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  finance: 'bg-blue-100 text-blue-700',
  manager: 'bg-indigo-100 text-indigo-700',
  spv_operations: 'bg-orange-100 text-orange-700',
  operations: 'bg-amber-100 text-amber-700',
  spv_cso: 'bg-green-100 text-green-700',
  cso: 'bg-teal-100 text-teal-700',
};

export default function AdminStaffPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ userId: '', roleId: '', outletId: '' });

  const { data: staffList = [], isLoading, refetch } = useQuery<StaffMember[]>({
    queryKey: ['/api/admin/staff'],
    queryFn: () => apiFetch('/api/admin/staff'),
  });

  const { data: rolesList = [] } = useQuery<Role[]>({
    queryKey: ['/api/admin/roles'],
    queryFn: () => apiFetch('/api/admin/roles'),
  });

  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['/api/outlets'],
    queryFn: () => apiFetch('/api/outlets'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { userId: string; roleId: string; outletId: string | null }) =>
      apiFetch('/api/admin/staff', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/staff'] });
      toast({ title: 'Staff berhasil ditambahkan' });
      setShowDialog(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { roleId?: string; outletId?: string | null; isActive?: boolean } }) =>
      apiFetch(`/api/admin/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/staff'] });
      toast({ title: 'Staff berhasil diperbarui' });
      setShowDialog(false);
      setEditTarget(null);
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/admin/staff/${id}`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/staff'] }); },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const resetForm = () => setForm({ userId: '', roleId: '', outletId: '' });

  const openCreate = () => {
    setEditTarget(null);
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (staff: StaffMember) => {
    setEditTarget(staff);
    setForm({ userId: staff.userId, roleId: staff.roleId, outletId: staff.outletId || '' });
    setShowDialog(true);
  };

  const handleSave = () => {
    const payload = { userId: form.userId.trim(), roleId: form.roleId, outletId: form.outletId || null };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: { roleId: payload.roleId, outletId: payload.outletId } });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = staffList.filter(s =>
    s.userId.toLowerCase().includes(search.toLowerCase()) ||
    s.roleId.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleName = (roleId: string) => rolesList.find(r => r.id === roleId)?.name || roleId;
  const getOutletName = (outletId: string | null) => outletId ? (outlets.find(o => o.id === outletId)?.name || outletId.slice(0, 8) + '…') : 'Semua Outlet';

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="admin-staff-page">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" /> Kelola Staff
              </h1>
              <p className="text-sm text-gray-500 mt-1">Kelola anggota tim dan assignment role serta outlet mereka.</p>
            </div>
            <Button onClick={openCreate} data-testid="btn-add-staff">
              <Plus className="w-4 h-4 mr-1.5" /> Tambah Staff
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Cari user ID atau role..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Badge variant="outline">{filtered.length} staff</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">Belum ada staff terdaftar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">User ID</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Outlet Scope</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(staff => (
                      <TableRow key={staff.id} className={!staff.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-mono text-xs text-gray-600">{staff.userId}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[staff.roleId] || 'bg-gray-100 text-gray-700'}`}>
                            <Shield className="w-3 h-3" /> {getRoleName(staff.roleId)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <Store className="w-3 h-3 text-gray-400" />
                            {getOutletName(staff.outletId)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={staff.isActive ? 'default' : 'secondary'} className="text-xs">
                            {staff.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(staff)} data-testid={`btn-edit-staff-${staff.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 w-7 p-0 ${staff.isActive ? 'text-red-400 hover:text-red-600' : 'text-green-400 hover:text-green-600'}`}
                              onClick={() => toggleActiveMutation.mutate({ id: staff.id, isActive: !staff.isActive })}
                              data-testid={`btn-toggle-staff-${staff.id}`}
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={open => { setShowDialog(open); if (!open) { setEditTarget(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Staff' : 'Tambah Staff Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">User ID</label>
              <Input
                placeholder="e.g. user-abc123"
                value={form.userId}
                onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                disabled={!!editTarget}
                data-testid="input-staff-userid"
              />
              {!editTarget && <p className="text-xs text-gray-400">ID unik dari sistem autentikasi</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <Select value={form.roleId} onValueChange={v => setForm(f => ({ ...f, roleId: v }))}>
                <SelectTrigger data-testid="select-staff-role">
                  <SelectValue placeholder="Pilih role..." />
                </SelectTrigger>
                <SelectContent>
                  {rolesList.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-gray-400" />
                        {r.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Outlet (opsional)</label>
              <Select value={form.outletId || '__all__'} onValueChange={v => setForm(f => ({ ...f, outletId: v === '__all__' ? '' : v }))}>
                <SelectTrigger data-testid="select-staff-outlet">
                  <SelectValue placeholder="Semua Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Store className="w-3.5 h-3.5" /> Semua Outlet (tidak terbatas)
                    </span>
                  </SelectItem>
                  {outlets.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-gray-400" />
                        {o.name} {o.code && <span className="text-gray-400 text-xs">({o.code})</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Kosongkan untuk akses semua outlet</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditTarget(null); resetForm(); }}>Batal</Button>
            <Button
              onClick={handleSave}
              disabled={!form.userId.trim() || !form.roleId || createMutation.isPending || updateMutation.isPending}
              data-testid="btn-save-staff"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editTarget ? 'Simpan Perubahan' : 'Tambah Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
