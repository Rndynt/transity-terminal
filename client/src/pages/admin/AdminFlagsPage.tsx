import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/lib/permissions';

interface Role {
  id: string;
  name: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  category: string;
}

interface RoleFlag {
  roleId: string;
  flagId: string;
  enabled: boolean;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
  return res.json();
}

const CATEGORY_LABELS: Record<string, string> = {
  page: 'Halaman',
  report: 'Laporan',
  master: 'Master Data',
  action: 'Aksi',
  admin: 'Admin',
};

const CATEGORY_COLORS: Record<string, string> = {
  page: 'bg-blue-50 text-blue-700 border-blue-200',
  report: 'bg-green-50 text-green-700 border-green-200',
  master: 'bg-purple-50 text-purple-700 border-purple-200',
  action: 'bg-orange-50 text-orange-700 border-orange-200',
  admin: 'bg-red-50 text-red-700 border-red-200',
};

const ROLE_ORDER = ['owner', 'finance', 'manager', 'spv_operations', 'operations', 'spv_cso', 'cso'];
const CATEGORY_ORDER = ['page', 'report', 'master', 'action', 'admin'];

export default function AdminFlagsPage() {
  const { toast } = useToast();
  const { refresh: refreshPermissions } = usePermissions();
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());

  const { data: rolesList = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['/api/admin/roles'],
    queryFn: () => apiFetch('/api/admin/roles'),
  });

  const { data: flagsList = [], isLoading: flagsLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/admin/flags'],
    queryFn: () => apiFetch('/api/admin/flags'),
  });

  const { data: roleFlagsList = [], isLoading: matrixLoading, refetch: refetchMatrix } = useQuery<RoleFlag[]>({
    queryKey: ['/api/admin/role-flags'],
    queryFn: () => apiFetch('/api/admin/role-flags'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ roleId, flagId, enabled }: { roleId: string; flagId: string; enabled: boolean }) =>
      apiFetch(`/api/admin/role-flags/${roleId}/${flagId}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
    onSuccess: async (_data, vars) => {
      setPendingToggles(prev => { const s = new Set(prev); s.delete(`${vars.roleId}:${vars.flagId}`); return s; });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/role-flags'] });
      await refreshPermissions();
    },
    onError: (e: Error, vars) => {
      setPendingToggles(prev => { const s = new Set(prev); s.delete(`${vars.roleId}:${vars.flagId}`); return s; });
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    },
  });

  const isEnabled = useCallback((roleId: string, flagId: string) => {
    return roleFlagsList.some(rf => rf.roleId === roleId && rf.flagId === flagId && rf.enabled);
  }, [roleFlagsList]);

  const handleToggle = (roleId: string, flagId: string) => {
    const key = `${roleId}:${flagId}`;
    if (pendingToggles.has(key)) return;
    const currentlyEnabled = isEnabled(roleId, flagId);
    setPendingToggles(prev => new Set(prev).add(key));
    toggleMutation.mutate({ roleId, flagId, enabled: !currentlyEnabled });
  };

  const isLoading = rolesLoading || flagsLoading || matrixLoading;

  const sortedRoles = [...rolesList].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.id);
    const bi = ROLE_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const flagsByCategory = CATEGORY_ORDER.reduce<Record<string, FeatureFlag[]>>((acc, cat) => {
    acc[cat] = flagsList.filter(f => f.category === cat);
    return acc;
  }, {});

  const allFlagIds = new Set(flagsList.map(f => f.id));

  const getParentFlagId = (flagId: string): string | null => {
    const parts = flagId.split('.');
    if (parts.length <= 2) return null;
    const parentId = parts.slice(0, 2).join('.');
    return allFlagIds.has(parentId) ? parentId : null;
  };

  const isSubFlag = (flagId: string): boolean => getParentFlagId(flagId) !== null;

  const getSubLabel = (flagId: string): string => {
    const parts = flagId.split('.');
    return parts.slice(2).join('.');
  };

  const orderFlagsWithSubs = (flags: FeatureFlag[]): FeatureFlag[] => {
    const parentFlags = flags.filter(f => !isSubFlag(f.id));
    const subFlags = flags.filter(f => isSubFlag(f.id));
    const result: FeatureFlag[] = [];
    for (const parent of parentFlags) {
      result.push(parent);
      const children = subFlags.filter(s => getParentFlagId(s.id) === parent.id);
      result.push(...children);
    }
    const orphans = subFlags.filter(s => !parentFlags.some(p => p.id === getParentFlagId(s.id)));
    result.push(...orphans);
    return result;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="admin-flags-page">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-full mx-auto w-full p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-600" /> Feature Flags
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Toggle permission per role secara real-time. Perubahan langsung berlaku tanpa restart.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchMatrix()} className="gap-1.5">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {CATEGORY_ORDER.map(cat => {
                const flags = orderFlagsWithSubs(flagsByCategory[cat] || []);
                if (flags.length === 0) return null;
                return (
                  <Card key={cat} className="overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b bg-gray-50">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs border font-bold ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                        <span className="text-gray-400 font-normal">{flags.length} flags</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left py-2 px-3 font-semibold text-gray-600 w-52 sticky left-0 bg-gray-50 border-r border-gray-200">
                              Flag
                            </th>
                            {sortedRoles.map(role => (
                              <th key={role.id} className="text-center py-2 px-2 font-semibold text-gray-600 min-w-[80px]">
                                {role.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {flags.map((flag, idx) => {
                            const isSub = isSubFlag(flag.id);
                            return (
                            <tr key={flag.id} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                              <td className="py-2 px-3 sticky left-0 bg-inherit border-r border-gray-200">
                                <div className={isSub ? 'pl-4 border-l-2 border-gray-200 ml-1' : ''}>
                                  {isSub ? (
                                    <>
                                      <p className="font-mono text-[11px] text-gray-500">
                                        <span className="text-gray-300">{getParentFlagId(flag.id)}.</span>{getSubLabel(flag.id)}
                                      </p>
                                      <p className="text-gray-400 text-[10px]">{flag.name}</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-mono text-[11px] text-gray-700">{flag.id}</p>
                                      <p className="text-gray-400 text-[10px]">{flag.name}</p>
                                    </>
                                  )}
                                </div>
                              </td>
                              {sortedRoles.map(role => {
                                const key = `${role.id}:${flag.id}`;
                                const enabled = isEnabled(role.id, flag.id);
                                const pending = pendingToggles.has(key);
                                return (
                                  <td key={role.id} className="text-center py-2 px-2">
                                    <button
                                      onClick={() => handleToggle(role.id, flag.id)}
                                      disabled={pending}
                                      className="inline-flex items-center justify-center w-6 h-6 rounded transition-all hover:scale-110 disabled:opacity-50"
                                      title={`${role.name}: ${enabled ? 'Nonaktifkan' : 'Aktifkan'} ${flag.id}`}
                                      data-testid={`toggle-${role.id}-${flag.id}`}
                                    >
                                      {pending ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                      ) : enabled ? (
                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                                      )}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-400 pt-2">
            <span className="flex items-center gap-1"><CheckSquare className="w-4 h-4 text-blue-500" /> = Aktif</span>
            <span className="flex items-center gap-1"><Square className="w-4 h-4 text-gray-300" /> = Nonaktif</span>
            <span>· Klik untuk toggle · Perubahan langsung disimpan ke database</span>
          </div>
        </div>
      </div>
    </div>
  );
}
