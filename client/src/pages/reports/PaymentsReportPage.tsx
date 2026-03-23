import { useState } from 'react';
import { usePermissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import ReportFilters, { type ReportFilterValues, type DateModeOption } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';
import { fmtCurrency, getPaymentLabel } from '@/lib/constants';
import { ChannelBadge } from '@/components/shared/StatusBadges';

const DATE_MODES: DateModeOption[] = [
  { value: 'paid', label: 'Tanggal Bayar' },
  { value: 'created', label: 'Tanggal Transaksi' },
];

function buildQuery(f: ReportFilterValues) {
  const params = new URLSearchParams({ dateFrom: f.dateFrom, dateTo: f.dateTo });
  if (f.dateMode) params.set('dateMode', f.dateMode);
  if (f.outletId) params.set('outletId', f.outletId);
  if (f.channel) params.set('channel', f.channel);
  if (f.patternId) params.set('patternId', f.patternId);
  return params.toString();
}

const METHOD_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

const PAYMENT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  success: { label: 'Sukses', variant: 'default' },
  pending: { label: 'Pending', variant: 'secondary' },
  failed: { label: 'Gagal', variant: 'destructive' },
};

export default function PaymentsReportPage() {
  const { outletId: scopedOutletId } = usePermissions();
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: thirtyDaysAgo, dateTo: today, dateMode: 'paid' });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/payments', buildQuery(filters)],
    queryFn: async () => {
      const res = await fetch(`/api/reports/payments?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const summary = data?.summary;
  const byMethod = data?.byMethod || [];
  const byStatus = data?.byStatus || [];
  const daily = data?.daily || [];
  const byOutlet = data?.byOutlet || [];
  const recent = data?.recent || [];

  const chartData = daily.map((d: any) => ({
    date: d.date?.slice(5),
    amount: Number(d.amount),
    payments: Number(d.payments),
  }));

  const pieData = byMethod.map((m: any, i: number) => ({
    name: getPaymentLabel(m.method),
    value: Number(m.amount),
    color: METHOD_COLORS[i % METHOD_COLORS.length],
  }));

  return (
    <ReportPageLayout
      title="Laporan Pembayaran"
      description="Breakdown pembayaran per metode, status, dan outlet."
      icon={CreditCard}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} lockedOutletId={scopedOutletId ?? undefined} dateModeOptions={DATE_MODES} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Total Pembayaran', value: Number(summary?.total_payments || 0).toLocaleString(), icon: CreditCard, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Total Nominal', value: fmtCurrency(Number(summary?.success_amount || 0)), icon: DollarSign, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
        { label: 'Sukses', value: Number(summary?.success_count || 0).toLocaleString(), icon: CheckCircle, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
        { label: 'Pending / Gagal', value: `${Number(summary?.pending_count || 0)} / ${Number(summary?.failed_count || 0)}`, icon: Clock, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {chartData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Tren Pembayaran Harian</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Nominal" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribusi Metode Bayar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Metode</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Metode</TableHead>
                  <TableHead className="text-xs text-right">Jumlah</TableHead>
                  <TableHead className="text-xs text-right">Sukses</TableHead>
                  <TableHead className="text-xs text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byMethod.map((m: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{getPaymentLabel(m.method)}</TableCell>
                    <TableCell className="text-sm text-right">{m.count}</TableCell>
                    <TableCell className="text-sm text-right">{m.success_count}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(m.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Status</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Jumlah</TableHead>
                  <TableHead className="text-xs text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byStatus.map((s: any, i: number) => {
                  const info = PAYMENT_STATUS_MAP[s.status] || { label: s.status, variant: 'outline' as const };
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant={info.variant} className="text-xs">{info.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right">{s.count}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(s.amount))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {byOutlet.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Outlet</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Outlet</TableHead>
                  <TableHead className="text-xs text-right">Jumlah</TableHead>
                  <TableHead className="text-xs text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOutlet.map((o: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{o.outlet_name}</TableCell>
                    <TableCell className="text-sm text-right">{o.count}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(o.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Transaksi Terbaru (100 terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Booking</TableHead>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs">Metode</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Nominal</TableHead>
                  <TableHead className="text-xs">Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length > 0 ? recent.map((r: any) => {
                  const info = PAYMENT_STATUS_MAP[r.status] || { label: r.status, variant: 'outline' as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.booking_code}</TableCell>
                      <TableCell className="text-sm">{r.service_date}</TableCell>
                      <TableCell className="text-sm">{r.route_name || '-'}</TableCell>
                      <TableCell><ChannelBadge channel={r.channel} /></TableCell>
                      <TableCell className="text-sm">{getPaymentLabel(r.method)}</TableCell>
                      <TableCell>
                        <Badge variant={info.variant} className="text-xs">{info.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(r.amount))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{r.provider_ref || '-'}</TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}
