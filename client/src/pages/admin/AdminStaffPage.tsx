import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
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
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Users, Plus, Pencil, PowerOff, Shield, Store, Loader2, Search, RefreshCw, Eye, EyeOff
} from 'lucide-react';

interface StaffMember {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
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
  stopId?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
  return res.json();
}

const ROLE_COLORS: Record<string, string> = {
  owner:          'bg-purple-100 text-purple-700',
  finance:        'bg-blue-100 text-blue-700',
  manager:        'bg-indigo-100 text-indigo-700',
  spv_operations: 'bg-orange-100 text-orange-700',
  operations:     'bg-amber-100 text-amber-700',
  spv_cso:        'bg-green-100 text-green-700',
  cso:            'bg-teal-100 text-teal-700',
};

const EMPTY_CREATE = { name: '', email: '', password: '', roleId: '', outletId: '' };
const EMPTY_EDIT   = { roleId: '', outletId: '' };

export default function AdminStaffPage() {
  usePageTitle("Kelola Staff", "Manajemen akun & role tim");
  const { toast } = useToast();
  const [search, setSearch]         = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editForm, setEditForm]     = useState(EMPTY_EDIT);

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
    mutationFn: (data: typeof EMPTY_CREATE) =>
      apiFetch('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          name:     data.name.trim(),
          email:    data.email.trim(),
          password: data.password,
          roleId:   data.roleId,
          outletId: data.outletId || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/staff'] });
      toast({ title: 'Staff berhasil ditambahkan', description: 'Akun login sudah dibuat otomatis.' });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: 'Gagal menambahkan staff', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { roleId?: string; outletId?: string | null; isActive?: boolean } }) =>
      apiFetch(`/api/admin/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/staff'] });
      toast({ title: 'Staff berhasil diperbarui' });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/admin/staff/${id}`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/staff'] }); },
    onError: (e: Error) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
  });

  const closeDialog = () => {
    setShowDialog(false);
    setEditTarget(null);
    setCreateForm(EMPTY_CREATE);
    setEditForm(EMPTY_EDIT);
    setShowPassword(false);
  };

  const openCreate = () => {
    setEditTarget(null);
    setCreateForm(EMPTY_CREATE);
    setShowDialog(true);
  };

  const openEdit = (staff: StaffMember) => {
    setEditTarget(staff);
    setEditForm({ roleId: staff.roleId, outletId: staff.outletId || '' });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        data: { roleId: editForm.roleId, outletId: editForm.outletId || null },
      });
    } else {
      createMutation.mutate(createForm);
    }
  };

  const isCreateValid =
    createForm.name.trim().length > 0 &&
    createForm.email.trim().length > 0 &&
    createForm.password.length >= 8 &&
    createForm.roleId.length > 0;

  const isEditValid = editForm.roleId.length > 0;

  const filtered = staffList.filter(s => {
    const q = search.toLowerCase();
    return (
      (s.name  ?? '').toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      s.roleId.toLowerCase().includes(q)
    );
  });

  const getRoleName   = (roleId: string)           => rolesList.find(r => r.id === roleId)?.name || roleId;
  const getOutletName = (outletId: string | null)  => outletId ? (outlets.find(o => o.id === outletId)?.name || outletId.slice(0, 8) + '…') : 'Semua Outlet';

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="admin-staff-page">
      <PageHeader icon={Users} title="Kelola Staff" subtitle="Manajemen akun & role tim" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full p-4 md:p-6 space-y-4">
          <div className="hidden lg:block" />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Cari nama, email, atau role..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9"
                    data-testid="input-search-staff"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Badge variant="outline">{filtered.length} staff</Badge>
                <Button size="sm" onClick={openCreate} data-testid="btn-add-staff">
                  <Plus className="w-4 h-4 mr-1" /> Tambah Staff
                </Button>
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
                      <TableHead className="text-xs">Nama</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Outlet Scope</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(staff => (
                      <TableRow key={staff.id} className={!staff.isActive ? 'opacity-50' : ''} data-testid={`row-staff-${staff.id}`}>
                        <TableCell className="font-medium text-sm">
                          {staff.name || <span className="text-gray-400 text-xs font-mono">{staff.userId.slice(0, 12)}…</span>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {staff.email || '—'}
                        </TableCell>
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

      <Dialog open={showDialog} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Role & Outlet Staff' : 'Tambah Staff Baru'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editTarget ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nama Lengkap</label>
                  <Input
                    placeholder="Budi Santoso"
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    data-testid="input-staff-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input
                    type="email"
                    placeholder="budi@transity.id"
                    value={createForm.email}
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    data-testid="input-staff-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 karakter"
                      value={createForm.password}
                      onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                      className="pr-9"
                      data-testid="input-staff-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {createForm.password.length > 0 && createForm.password.length < 8 && (
                    <p className="text-xs text-red-500">Password minimal 8 karakter</p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-gray-50 border px-4 py-3 space-y-0.5">
                <p className="text-sm font-medium">{editTarget.name || 'Tanpa nama'}</p>
                <p className="text-xs text-gray-500">{editTarget.email || editTarget.userId}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <Select
                value={editTarget ? editForm.roleId : createForm.roleId}
                onValueChange={v => editTarget
                  ? setEditForm(f => ({ ...f, roleId: v }))
                  : setCreateForm(f => ({ ...f, roleId: v }))
                }
              >
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
              <label className="text-sm font-medium text-gray-700">Outlet <span className="text-gray-400 font-normal">(opsional)</span></label>
              <Select
                value={(editTarget ? editForm.outletId : createForm.outletId) || '__all__'}
                onValueChange={v => {
                  const val = v === '__all__' ? '' : v;
                  editTarget ? setEditForm(f => ({ ...f, outletId: val })) : setCreateForm(f => ({ ...f, outletId: val }));
                }}
              >
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
                        {o.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Kosongkan untuk akses semua outlet</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button
              onClick={handleSave}
              disabled={isPending || (editTarget ? !isEditValid : !isCreateValid)}
              data-testid="btn-save-staff"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editTarget ? 'Simpan Perubahan' : 'Tambah & Buat Akun'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
