import { useState } from 'react';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { usePermissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { XCircle, UserMinus, ArrowRightLeft, History, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ReportFilters, { type ReportFilterValues, type DateModeOption } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';
import { HISTORY_ACTION_MAP, fmtDate } from '@/lib/constants';

const DATE_MODES: DateModeOption[] = [
  { value: 'paid', label: 'Tanggal Batal' },
  { value: 'created', label: 'Tanggal Booking' },
];

function buildQuery(f: ReportFilterValues) {
  const params = new URLSearchParams({ dateFrom: f.dateFrom, dateTo: f.dateTo });
  if (f.dateMode) params.set('dateMode', f.dateMode);
  if (f.outletId) params.set('outletId', f.outletId);
  if (f.channel) params.set('channel', f.channel);
  if (f.patternId) params.set('patternId', f.patternId);
  return params.toString();
}

const ACTION_COLORS: Record<string, string> = {
  canceled: '#ef4444',
  unseated: '#f97316',
  rescheduled: '#8b5cf6',
  reassigned: '#3b82f6',
  status_change: '#6b7280',
};

function ActionBadge({ action }: { action: string }) {
  const info = HISTORY_ACTION_MAP[action as keyof typeof HISTORY_ACTION_MAP];
  if (!info) return <Badge variant="outline" className="text-xs">{action}</Badge>;
  return (
    <Badge variant="outline" className={`text-xs ${info.color} border-current`}>
      {info.label}
    </Badge>
  );
}

function extractReason(details: any): string {
  if (!details) return '-';
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch { return details; }
  }
  return details.reason || details.cancelReason || details.notes || '-';
}

export default function CancellationsReportPage() {
  usePageTitle("Laporan Pembatalan", "Data pembatalan & unseat booking");
  const { outletId: scopedOutletId } = usePermissions();
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: thirtyDaysAgo, dateTo: today, dateMode: 'paid' });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/cancellations', buildQuery(filters)],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cancellations?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const summary = data?.summary;
  const byAction = data?.byAction || [];
  const daily = data?.daily || [];
  const byRoute = data?.byRoute || [];
  const recent = data?.recent || [];

  const chartData = daily.map((d: any) => ({
    date: d.date?.slice(5),
    canceled: Number(d.canceled),
    unseated: Number(d.unseated),
    rescheduled: Number(d.rescheduled),
    reassigned: Number(d.reassigned),
  }));

  return (
    <ReportPageLayout
      title="Laporan Pembatalan & Unseat"
      description="Tracking pembatalan, unseat, reschedule, dan pindah kursi beserta alasannya."
      icon={AlertTriangle}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} lockedOutletId={scopedOutletId ?? undefined} dateModeOptions={DATE_MODES} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Total Event', value: Number(summary?.total_events || 0).toLocaleString(), icon: History, iconBg: 'bg-gray-100', iconColor: 'text-gray-600' },
        { label: 'Dibatalkan', value: Number(summary?.canceled_count || 0).toLocaleString(), icon: XCircle, iconBg: 'bg-red-100', iconColor: 'text-red-600' },
        { label: 'Unseat', value: Number(summary?.unseated_count || 0).toLocaleString(), icon: UserMinus, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
        { label: 'Reschedule / Pindah', value: (Number(summary?.rescheduled_count || 0) + Number(summary?.reassigned_count || 0)).toLocaleString(), icon: ArrowRightLeft, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
      ]} />

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tren Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="canceled" stackId="a" fill={ACTION_COLORS.canceled} name="Batal" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unseated" stackId="a" fill={ACTION_COLORS.unseated} name="Unseat" />
                  <Bar dataKey="rescheduled" stackId="a" fill={ACTION_COLORS.rescheduled} name="Reschedule" />
                  <Bar dataKey="reassigned" stackId="a" fill={ACTION_COLORS.reassigned} name="Pindah" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Tipe Aksi</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Aksi</TableHead>
                  <TableHead className="text-xs text-right">Jumlah</TableHead>
                  <TableHead className="text-xs text-right">Booking Terdampak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byAction.length > 0 ? byAction.map((a: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell><ActionBadge action={a.action} /></TableCell>
                    <TableCell className="text-sm text-right">{a.count}</TableCell>
                    <TableCell className="text-sm text-right">{a.booking_count}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Rute</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">Batal</TableHead>
                  <TableHead className="text-xs text-right">Unseat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRoute.length > 0 ? byRoute.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.route_name}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{r.total}</TableCell>
                    <TableCell className="text-sm text-right text-red-600">{r.canceled}</TableCell>
                    <TableCell className="text-sm text-right text-orange-600">{r.unseated}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Riwayat Terbaru (100 terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Booking</TableHead>
                  <TableHead className="text-xs">Penumpang</TableHead>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs">Aksi</TableHead>
                  <TableHead className="text-xs">Alasan</TableHead>
                  <TableHead className="text-xs">Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length > 0 ? recent.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap">{r.created_at ? fmtDate(r.created_at) : r.service_date}</TableCell>
                    <TableCell className="font-mono text-xs">{r.booking_code}</TableCell>
                    <TableCell className="text-sm">{r.passenger_name || '-'}</TableCell>
                    <TableCell className="text-sm">{r.route_name || '-'}</TableCell>
                    <TableCell><ActionBadge action={r.action} /></TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{extractReason(r.details)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.performed_by || '-'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}
