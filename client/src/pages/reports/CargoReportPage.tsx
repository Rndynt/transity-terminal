import { useState } from 'react';
import { usePermissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, Weight, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import ReportFilters, { type ReportFilterValues, type DateModeOption } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';
import { fmtCurrency, CARGO_STATUS_MAP, type CargoStatus } from '@/lib/constants';
import { CargoStatusBadge } from '@/components/shared/StatusBadges';

const DATE_MODES: DateModeOption[] = [
  { value: 'paid', label: 'Tanggal Bayar' },
  { value: 'created', label: 'Tanggal Kirim' },
];

function buildQuery(f: ReportFilterValues) {
  const params = new URLSearchParams({ dateFrom: f.dateFrom, dateTo: f.dateTo });
  if (f.dateMode) params.set('dateMode', f.dateMode);
  if (f.outletId) params.set('outletId', f.outletId);
  if (f.patternId) params.set('patternId', f.patternId);
  return params.toString();
}

export default function CargoReportPage() {
  const { outletId: scopedOutletId } = usePermissions();
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: thirtyDaysAgo, dateTo: today, dateMode: 'created' });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/cargo', filters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cargo?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const summary = data?.summary;
  const byStatus = data?.byStatus || [];
  const daily = data?.daily || [];
  const byRoute = data?.byRoute || [];
  const recent = data?.recent || [];

  const chartData = daily.map((d: any) => ({
    date: d.date?.slice(5),
    shipments: Number(d.shipments),
    revenue: Number(d.revenue),
  }));

  return (
    <ReportPageLayout
      title="Laporan Kargo"
      description="Ringkasan pengiriman kargo per periode, status, dan rute."
      icon={Package}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} showChannel={false} lockedOutletId={scopedOutletId ?? undefined} dateModeOptions={DATE_MODES} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Total Kiriman', value: Number(summary?.total_shipments || 0).toLocaleString(), icon: Package, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
        { label: 'Total Pendapatan', value: fmtCurrency(Number(summary?.total_revenue || 0)), icon: DollarSign, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
        { label: 'Total Berat', value: `${Number(summary?.total_weight_kg || 0).toLocaleString()} kg`, icon: Weight, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Terkirim', value: Number(summary?.delivered_count || 0).toLocaleString(), icon: CheckCircle, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', subtitle: `Batal: ${summary?.canceled_count || 0}` },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {chartData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Tren Pengiriman Harian</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="shipments" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Kiriman" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

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
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byStatus.length > 0 ? byStatus.map((s: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell><CargoStatusBadge status={s.status as CargoStatus} /></TableCell>
                    <TableCell className="text-sm text-right">{s.count}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(s.revenue))}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Per Rute</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Rute</TableHead>
                <TableHead className="text-xs text-right">Kiriman</TableHead>
                <TableHead className="text-xs text-right">Berat (kg)</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byRoute.length > 0 ? byRoute.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{r.route_name}</TableCell>
                  <TableCell className="text-sm text-right">{r.shipments}</TableCell>
                  <TableCell className="text-sm text-right">{Number(r.total_weight).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(r.revenue))}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Kiriman Terbaru (100 terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Resi</TableHead>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs">Pengirim</TableHead>
                  <TableHead className="text-xs">Penerima</TableHead>
                  <TableHead className="text-xs">Barang</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length > 0 ? recent.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.waybill_number}</TableCell>
                    <TableCell className="text-sm">{r.service_date}</TableCell>
                    <TableCell className="text-sm">{r.origin_name} → {r.destination_name}</TableCell>
                    <TableCell className="text-sm">{r.sender_name}</TableCell>
                    <TableCell className="text-sm">{r.recipient_name}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{r.item_description}</TableCell>
                    <TableCell><CargoStatusBadge status={r.status as CargoStatus} /></TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtCurrency(Number(r.total_amount))}</TableCell>
                  </TableRow>
                )) : (
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
