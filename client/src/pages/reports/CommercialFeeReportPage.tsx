import { useState } from 'react';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { usePermissions } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt, Ticket, Package, TrendingDown, Percent, Calculator, RotateCcw, BadgePercent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import ReportFilters, { type ReportFilterValues, type DateModeOption } from '@/components/reports/ReportFilters';
import { SummaryCardsGrid } from '@/components/reports/SummaryCards';
import ReportPageLayout from '@/components/reports/ReportPageLayout';
import { fmtCurrency } from '@/lib/constants';
import { todayStr, localDateStr } from '@/lib/date';

const DATE_MODES: DateModeOption[] = [
  { value: 'paid', label: 'Tanggal Bayar' },
  { value: 'departure', label: 'Tanggal Keberangkatan' },
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

function fmtPct(v: number) {
  return `${(v * 100).toFixed(2)}%`;
}

function fmtTierRange(min: number, tiers: any[], idx: number) {
  const next = idx > 0 ? tiers[idx - 1] : null;
  if (min === 0) return `Hingga ${fmtCurrency(tiers.length > 1 ? tiers[tiers.length - 2]?.min || 200_000_000 : 200_000_000)}`;
  if (!next) return `> ${fmtCurrency(min)}`;
  return `${fmtCurrency(min)} — ${fmtCurrency(next.min)}`;
}

export default function CommercialFeeReportPage() {
  usePageTitle("Laporan Commercial Fee", "Rekap fee per agen & tier");
  const { outletId: scopedOutletId } = usePermissions();
  const [filters, setFilters] = useState<ReportFilterValues>({ dateFrom: localDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), dateTo: todayStr(), dateMode: 'paid' });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/reports/commercial-fee', buildQuery(filters)],
    queryFn: async () => {
      const res = await fetch(`/api/reports/commercial-fee?${buildQuery(filters)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  const summary = data?.summary;
  const daily = data?.daily || [];
  const ticketByRoute = data?.ticketByRoute || [];
  const cargoByRoute = data?.cargoByRoute || [];
  const ticketByOutlet = data?.ticketByOutlet || [];
  const volumeTiers = data?.volumeTiers || [];

  const chartData = daily.map((d: any) => ({
    date: d.date?.slice(5),
    tiket: d.ticket_gross,
    kargo: d.cargo_gross,
    fee: d.fee,
  }));

  return (
    <ReportPageLayout
      title="Laporan Commercial Fee"
      description="Rekap commercial fee berdasarkan transaksi tiket dan kargo. Tarif progresif sesuai PKS."
      icon={Receipt}
      isLoading={isLoading}
      filterBar={<ReportFilters value={filters} onChange={setFilters} lockedOutletId={scopedOutletId ?? undefined} dateModeOptions={DATE_MODES} />}
    >
      <SummaryCardsGrid items={[
        { label: 'Total Transaksi (Gross)', value: fmtCurrency(summary?.total_gross || 0), icon: Calculator, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: `Commercial Fee (${fmtPct(summary?.fee_rate || 0.03)})`, value: fmtCurrency(summary?.fee_amount || 0), icon: Receipt, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', subtitle: summary?.tier_label || '' },
        { label: 'Kredit Refund', value: summary?.refund_credit > 0 ? `-${fmtCurrency(summary?.refund_fee_credit || 0)}` : 'Tidak ada', icon: RotateCcw, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
        { label: 'Total Tagihan + PPN', value: fmtCurrency(summary?.total_charge || 0), icon: Percent, iconBg: 'bg-red-100', iconColor: 'text-red-600' },
      ]} />

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-blue-700 font-medium mb-1">
                <Ticket className="w-3.5 h-3.5" /> Tiket
              </div>
              <p className="text-lg font-bold text-blue-900" data-testid="text-ticket-gross">{fmtCurrency(summary?.ticket_gross || 0)}</p>
              <p className="text-xs text-blue-600">{summary?.total_bookings || 0} booking</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-purple-700 font-medium mb-1">
                <Package className="w-3.5 h-3.5" /> Kargo
              </div>
              <p className="text-lg font-bold text-purple-900" data-testid="text-cargo-gross">{fmtCurrency(summary?.cargo_gross || 0)}</p>
              <p className="text-xs text-purple-600">{summary?.total_shipments || 0} shipment</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-indigo-700 font-medium mb-1">
                <BadgePercent className="w-3.5 h-3.5" /> Tier & Tarif
              </div>
              <p className="text-lg font-bold text-indigo-900" data-testid="text-tier">{summary?.tier_label || 'Tier 1'}</p>
              <p className="text-xs text-indigo-600">Tarif: {fmtPct(summary?.fee_rate || 0.03)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-amber-700 font-medium mb-1 text-xs">Fee Setelah Kredit</div>
              <p className="text-lg font-bold text-amber-900" data-testid="text-fee-after-credit">{fmtCurrency(summary?.fee_after_credit || 0)}</p>
              <p className="text-xs text-amber-600">
                {summary?.refund_credit > 0
                  ? `Kredit refund: -${fmtCurrency(summary?.refund_fee_credit || 0)}`
                  : `Rate: ${fmtPct(summary?.fee_rate || 0.03)}`
                }
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-red-700 font-medium mb-1 text-xs">PPN (11%)</div>
              <p className="text-lg font-bold text-red-900" data-testid="text-ppn">{fmtCurrency(summary?.ppn_amount || 0)}</p>
              <p className="text-xs text-red-600">Total: {fmtCurrency(summary?.total_charge || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tren Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} className="text-muted-foreground" />
                  <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`} className="text-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} labelFormatter={(l) => `Tanggal: ${l}`} />
                  <Legend />
                  <Bar dataKey="tiket" stackId="a" fill="#3b82f6" name="Tiket" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="kargo" stackId="a" fill="#8b5cf6" name="Kargo" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tren Commercial Fee Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} className="text-muted-foreground" />
                  <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} labelFormatter={(l) => `Tanggal: ${l}`} />
                  <Line type="monotone" dataKey="fee" stroke="#f59e0b" strokeWidth={2} name={`Fee (${fmtPct(summary?.fee_rate || 0.03)})`} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Fee Tiket per Rute</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs text-right">Trx</TableHead>
                  <TableHead className="text-xs text-right">Gross</TableHead>
                  <TableHead className="text-xs text-right">Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketByRoute.length > 0 ? ticketByRoute.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.route_name || '-'}</TableCell>
                    <TableCell className="text-sm text-right">{r.count}</TableCell>
                    <TableCell className="text-sm text-right">{fmtCurrency(r.gross_amount)}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-amber-700">{fmtCurrency(r.fee)}</TableCell>
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
            <CardTitle className="text-sm font-semibold">Fee Kargo per Rute</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Rute</TableHead>
                  <TableHead className="text-xs text-right">Trx</TableHead>
                  <TableHead className="text-xs text-right">Gross</TableHead>
                  <TableHead className="text-xs text-right">Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargoByRoute.length > 0 ? cargoByRoute.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.route_name || '-'}</TableCell>
                    <TableCell className="text-sm text-right">{r.count}</TableCell>
                    <TableCell className="text-sm text-right">{fmtCurrency(r.gross_amount)}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-amber-700">{fmtCurrency(r.fee)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {ticketByOutlet.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Fee Tiket per Outlet</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Outlet</TableHead>
                  <TableHead className="text-xs text-right">Trx</TableHead>
                  <TableHead className="text-xs text-right">Gross</TableHead>
                  <TableHead className="text-xs text-right">Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketByOutlet.map((o: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{o.outlet_name || 'Tanpa Outlet'}</TableCell>
                    <TableCell className="text-sm text-right">{o.count}</TableCell>
                    <TableCell className="text-sm text-right">{fmtCurrency(o.gross_amount)}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-amber-700">{fmtCurrency(o.fee)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Skema Tarif Progresif (per PKS)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tier</TableHead>
                <TableHead className="text-xs">Volume Transaksi Bulanan</TableHead>
                <TableHead className="text-xs text-right">Tarif Fee</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volumeTiers.slice().reverse().map((t: any, i: number) => {
                const isActive = summary && summary.fee_rate === t.rate;
                return (
                  <TableRow key={i} className={isActive ? 'bg-amber-50' : ''} data-testid={`tier-row-${i}`}>
                    <TableCell className="text-sm font-medium">{t.label}</TableCell>
                    <TableCell className="text-sm">
                      {t.min === 0
                        ? `Hingga ${fmtCurrency(200_000_000)}`
                        : t.min >= 1_000_000_000
                        ? `> ${fmtCurrency(t.min)}`
                        : `${fmtCurrency(t.min)} — ${fmtCurrency(
                            t.min === 200_000_000 ? 500_000_000 : 1_000_000_000
                          )}`
                      }
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmtPct(t.rate)}</TableCell>
                    <TableCell className="text-sm text-center">
                      {isActive && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-800">Aktif</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground mt-2">
            Tarif diterapkan secara keseluruhan (flat rate) berdasarkan total volume transaksi bulan tersebut, bukan bertingkat per tier. Belum termasuk PPN 11%.
          </p>
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}
