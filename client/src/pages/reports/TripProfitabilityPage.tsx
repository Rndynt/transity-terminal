import { useState } from 'react';
import { usePermissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Bus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportFilters, { type ReportFilterValues } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';
import { fmtCurrency } from '@/lib/constants';

function buildQuery(f: ReportFilterValues) {
  const params = new URLSearchParams({ dateFrom: f.dateFrom, dateTo: f.dateTo });
  if (f.patternId) params.set('patternId', f.patternId);
  return params.toString();
}

export default function TripProfitabilityPage() {
  const { outletId: scopedOutletId } = usePermissions();
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: thirtyDaysAgo, dateTo: today });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/trip-profitability', filters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/trip-profitability?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const summary = data?.summary;
  const trips = data?.trips || [];

  const totalRevenue = Number(summary?.total_revenue || 0);
  const totalCost = Number(summary?.total_cost || 0);
  const totalProfit = Number(summary?.total_profit || 0);
  const marginPct = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  const top10 = [...trips]
    .sort((a: any, b: any) => Number(b.profit) - Number(a.profit))
    .slice(0, 10)
    .map((t: any) => ({
      name: `${(t.route_code || '').slice(0, 8)} ${t.service_date?.slice(5)}`,
      profit: Number(t.profit),
    }));

  return (
    <ReportPageLayout
      title="Laba Rugi per Trip"
      description="Analisis profitabilitas setiap trip berdasarkan revenue vs biaya operasional."
      icon={TrendingUp}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} showOutlet={false} showChannel={false} lockedOutletId={scopedOutletId ?? undefined} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Total Revenue', value: fmtCurrency(totalRevenue), icon: DollarSign, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
        { label: 'Total Biaya', value: fmtCurrency(totalCost), icon: TrendingDown, iconBg: 'bg-red-100', iconColor: 'text-red-600' },
        { label: 'Total Laba', value: fmtCurrency(totalProfit), icon: TrendingUp, iconBg: totalProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100', iconColor: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600', subtitle: `Margin: ${marginPct}%` },
        { label: 'Total Trip', value: Number(summary?.total_trips || 0).toLocaleString(), icon: Bus, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
      ]} />

      {top10.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 Trip (Laba Tertinggi)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={110} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Bar dataKey="profit" name="Laba" fill="#16a34a" radius={[0, 4, 4, 0]} />
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
                  <TableHead className="text-xs">Kendaraan</TableHead>
                  <TableHead className="text-xs text-right">Pax</TableHead>
                  <TableHead className="text-xs text-right">Rev. Tiket</TableHead>
                  <TableHead className="text-xs text-right">Rev. Kargo</TableHead>
                  <TableHead className="text-xs text-right">Biaya</TableHead>
                  <TableHead className="text-xs text-right">Laba</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length > 0 ? trips.map((t: any) => {
                  const profit = Number(t.profit);
                  return (
                    <TableRow key={t.trip_id}>
                      <TableCell className="text-sm">{t.service_date}</TableCell>
                      <TableCell className="text-sm font-medium">{t.route_name || '-'}</TableCell>
                      <TableCell className="text-sm">{t.driver_name || '-'}</TableCell>
                      <TableCell className="text-sm">{t.vehicle_plate || '-'}</TableCell>
                      <TableCell className="text-sm text-right">{t.passenger_count}</TableCell>
                      <TableCell className="text-sm text-right">{fmtCurrency(Number(t.ticket_revenue))}</TableCell>
                      <TableCell className="text-sm text-right">{fmtCurrency(Number(t.cargo_revenue))}</TableCell>
                      <TableCell className="text-sm text-right text-red-600">{fmtCurrency(Number(t.actual_cost))}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={profit >= 0 ? 'default' : 'destructive'} className="text-xs font-mono">
                          {fmtCurrency(profit)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}
