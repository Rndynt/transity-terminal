import { useState } from 'react';
import { usePermissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Bus, Percent, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import ReportFilters, { type ReportFilterValues } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';

function buildQuery(f: ReportFilterValues) {
  const params = new URLSearchParams({ dateFrom: f.dateFrom, dateTo: f.dateTo });
  if (f.patternId) params.set('patternId', f.patternId);
  return params.toString();
}

function getLoadFactorColor(pct: number) {
  if (pct >= 80) return 'bg-green-100 text-green-800 border-green-200';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (pct >= 20) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export default function LoadFactorPage() {
  const { outletId: scopedOutletId } = usePermissions();
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: thirtyDaysAgo, dateTo: today });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/load-factor', buildQuery(filters)],
    queryFn: async () => {
      const res = await fetch(`/api/reports/load-factor?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const summary = data?.summary;
  const byRoute = data?.byRoute || [];
  const daily = data?.daily || [];
  const trips = data?.trips || [];

  const avgLF = Number(summary?.avg_load_factor_pct || 0);

  const chartData = daily.map((d: any) => ({
    date: d.date?.slice(5),
    load_factor: Number(d.load_factor_pct),
  }));

  const routeChartData = byRoute.map((r: any) => ({
    name: r.route_code || r.route_name?.slice(0, 15),
    load_factor: Number(r.avg_load_factor_pct),
  }));

  return (
    <ReportPageLayout
      title="Load Factor / Occupancy"
      description="Analisis tingkat keterisian kursi per trip dan rute."
      icon={Users}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} showOutlet={false} showChannel={false} lockedOutletId={scopedOutletId ?? undefined} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Rata-rata Load Factor', value: `${avgLF}%`, icon: Percent, iconBg: avgLF >= 60 ? 'bg-green-100' : 'bg-orange-100', iconColor: avgLF >= 60 ? 'text-green-600' : 'text-orange-600' },
        { label: 'Total Penumpang', value: Number(summary?.total_passengers || 0).toLocaleString(), icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Total Kapasitas', value: Number(summary?.total_capacity || 0).toLocaleString(), icon: Bus, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
        { label: 'Total Trip', value: Number(summary?.total_trips || 0).toLocaleString(), icon: BarChart3, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      ]} />

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tren Load Factor Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Line type="monotone" dataKey="load_factor" stroke="hsl(var(--primary))" strokeWidth={2} name="Load Factor" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {routeChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Load Factor per Rute</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routeChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="load_factor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Load Factor" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Detail per Trip</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs">Supir</TableHead>
                  <TableHead className="text-xs text-right">Kapasitas</TableHead>
                  <TableHead className="text-xs text-right">Penumpang</TableHead>
                  <TableHead className="text-xs text-right">Load Factor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length > 0 ? trips.map((t: any) => {
                  const lf = Number(t.load_factor_pct);
                  return (
                    <TableRow key={t.trip_id}>
                      <TableCell className="text-sm">{t.service_date}</TableCell>
                      <TableCell className="text-sm font-medium">{t.route_name || '-'}</TableCell>
                      <TableCell className="text-sm">{t.driver_name || '-'}</TableCell>
                      <TableCell className="text-sm text-right">{t.capacity}</TableCell>
                      <TableCell className="text-sm text-right">{t.passenger_count}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`text-xs font-mono ${getLoadFactorColor(lf)}`}>
                          {lf}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}
