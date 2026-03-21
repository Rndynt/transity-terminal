import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Ticket, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportFilters, { type ReportFilterValues } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';
import { fmtCurrency } from '@/lib/constants';
import { BookingStatusBadge, ChannelBadge } from '@/components/shared/StatusBadges';

function buildQuery(f: ReportFilterValues) {
  const params = new URLSearchParams({ dateFrom: f.dateFrom, dateTo: f.dateTo });
  if (f.outletId) params.set('outletId', f.outletId);
  if (f.channel) params.set('channel', f.channel);
  if (f.patternId) params.set('patternId', f.patternId);
  return params.toString();
}

export default function SalesReportPage() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: thirtyDaysAgo, dateTo: today });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/sales', filters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const summary = data?.summary;
  const byStatus = data?.byStatus || [];
  const byChannel = data?.byChannel || [];
  const byOutlet = data?.byOutlet || [];
  const daily = data?.daily || [];
  const recent = data?.recent || [];

  const chartData = daily.map((d: any) => ({
    date: d.date?.slice(5),
    paid: Number(d.paid),
    canceled: Number(d.canceled),
  }));

  return (
    <ReportPageLayout
      title="Laporan Penjualan"
      description="Detail penjualan tiket per periode dengan breakdown status dan channel."
      icon={Ticket}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Total Booking', value: Number(summary?.total_bookings || 0).toLocaleString(), icon: Ticket, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Lunas (Paid)', value: Number(summary?.paid_count || 0).toLocaleString(), icon: CheckCircle, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
        { label: 'Dibatalkan', value: Number(summary?.canceled_count || 0).toLocaleString(), icon: XCircle, iconBg: 'bg-red-100', iconColor: 'text-red-600' },
        { label: 'Total Revenue', value: fmtCurrency(Number(summary?.total_revenue || 0)), icon: DollarSign, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
      ]} />

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tren Penjualan Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="paid" fill="#22c55e" name="Lunas" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="canceled" fill="#ef4444" name="Batal" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Jumlah</TableHead>
                  <TableHead className="text-xs text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byStatus.map((s: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell><BookingStatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-sm text-right">{s.count}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(s.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Per Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs text-right">Jumlah</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byChannel.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell><ChannelBadge channel={c.channel} /></TableCell>
                    <TableCell className="text-sm text-right">{c.count}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(c.revenue))}</TableCell>
                  </TableRow>
                ))}
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Outlet</TableHead>
                  <TableHead className="text-xs text-right">Jumlah</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOutlet.map((o: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{o.outlet_name}</TableCell>
                    <TableCell className="text-sm text-right">{o.count}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(o.revenue))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Booking Terbaru (100 terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Kode</TableHead>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs">Outlet</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length > 0 ? recent.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.booking_code}</TableCell>
                    <TableCell className="text-sm">{b.origin_name} → {b.destination_name}</TableCell>
                    <TableCell className="text-sm">{b.service_date}</TableCell>
                    <TableCell><ChannelBadge channel={b.channel} /></TableCell>
                    <TableCell className="text-sm">{b.outlet_name}</TableCell>
                    <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(b.total_amount))}</TableCell>
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
