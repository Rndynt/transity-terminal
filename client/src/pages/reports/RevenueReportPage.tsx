import { useState } from 'react';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { usePermissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Ticket, TrendingUp, Bus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import ReportFilters, { type ReportFilterValues, type DateModeOption } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';
import { fmtCurrency, CHANNEL_MAP } from '@/lib/constants';
import { todayStr, daysAgoStr } from '@/lib/date';

const DATE_MODES: DateModeOption[] = [
  { value: 'paid', label: 'Tanggal Bayar' },
  { value: 'created', label: 'Tanggal Transaksi' },
];

function buildQuery(f: ReportFilterValues) {
  const params = new URLSearchParams({ dateFrom: f.dateFrom, dateTo: f.dateTo });
  if (f.dateMode) params.set('dateMode', f.dateMode);
  if (f.outletId) params.set('outletId', f.outletId);
  if (f.channel) params.set('channel', f.channel);
  if (f.salesChannelCode) params.set('salesChannelCode', f.salesChannelCode);
  if (f.patternId) params.set('patternId', f.patternId);
  return params.toString();
}

export default function RevenueReportPage() {
  usePageTitle("Laporan Pendapatan", "Ringkasan pendapatan per kanal & rute");
  const { outletId: scopedOutletId } = usePermissions();
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: daysAgoStr(29), dateTo: todayStr(), dateMode: 'paid' });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/revenue', buildQuery(filters)],
    queryFn: async () => {
      const res = await fetch(`/api/reports/revenue?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const summary = data?.summary;
  const daily = data?.daily || [];
  const byChannel = data?.byChannel || [];
  const bySalesChannel = data?.bySalesChannel || [];
  const byOutlet = data?.byOutlet || [];
  const byRoute = data?.byRoute || [];

  const chartData = daily.map((d: any) => ({
    date: d.date?.slice(5),
    revenue: Number(d.revenue),
    bookings: Number(d.bookings),
  }));

  return (
    <ReportPageLayout
      title="Laporan Pendapatan"
      description="Analisis pendapatan berdasarkan periode, rute, outlet, dan channel."
      icon={DollarSign}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} lockedOutletId={scopedOutletId ?? undefined} dateModeOptions={DATE_MODES} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Total Pendapatan', value: fmtCurrency(Number(summary?.total_revenue || 0)), icon: DollarSign, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
        { label: 'Total Booking', value: Number(summary?.total_bookings || 0).toLocaleString(), icon: Ticket, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Rata-rata / Booking', value: fmtCurrency(Number(summary?.avg_per_booking || 0)), icon: TrendingUp, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
        { label: 'Jumlah Trip', value: Number(summary?.total_trips || 0).toLocaleString(), icon: Bus, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      ]} />

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tren Pendapatan Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} className="text-muted-foreground" />
                  <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} labelFormatter={(l) => `Tanggal: ${l}`} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Pendapatan" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {byChannel.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byChannel.map((c: any) => ({ ...c, revenue: Number(c.revenue), label: CHANNEL_MAP[c.channel as keyof typeof CHANNEL_MAP]?.label || c.channel }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Pendapatan" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">Tidak ada data</p>
            )}
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
                  <TableHead className="text-xs text-right">Booking</TableHead>
                  <TableHead className="text-xs text-right">Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRoute.length > 0 ? byRoute.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.route_name || '-'}</TableCell>
                    <TableCell className="text-sm text-right">{r.bookings}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(r.revenue))}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {bySalesChannel.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per OTA Partner</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">OTA</TableHead>
                  <TableHead className="text-xs text-right">Booking</TableHead>
                  <TableHead className="text-xs text-right">Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySalesChannel.map((s: any, i: number) => (
                  <TableRow key={i} data-testid={`row-revenue-ota-${s.code}`}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{s.code}</div>
                      {s.name && s.name !== s.code && <div className="text-xs text-muted-foreground">{s.name}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-right">{s.bookings}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(s.revenue))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                  <TableHead className="text-xs text-right">Booking</TableHead>
                  <TableHead className="text-xs text-right">Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOutlet.map((o: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{o.outlet_name || 'Tanpa Outlet'}</TableCell>
                    <TableCell className="text-sm text-right">{o.bookings}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(o.revenue))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </ReportPageLayout>
  );
}
