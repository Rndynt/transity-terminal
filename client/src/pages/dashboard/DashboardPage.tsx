import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bus, Ticket, DollarSign, Package, AlertTriangle,
  ChevronRight, LayoutDashboard,
  CalendarDays, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { fmtCurrency, BOOKING_STATUS_MAP } from '@/lib/constants';
import { useLocation } from 'wouter';

interface DashboardData {
  trips: { total: number; scheduled: number; completed: number; canceled: number; no_driver: number };
  bookings: { total: number; paid: number; pending: number; canceled: number };
  revenue: number;
  cargo: { total: number; totalWeight: number; revenue: number };
  alerts: { tripsNoDriver: number; pendingBookingsOld: number; spjOverdue: number };
  avgLoadFactor: number;
  recentBookings: Array<{
    id: string;
    booking_code: string;
    status: string;
    total_amount: number | string;
    channel: string;
    created_at: string;
    origin_name: string;
    dest_name: string;
  }>;
}

export default function DashboardPage() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard/today'],
  });

  const trips = data?.trips ?? { total: 0, scheduled: 0, completed: 0, canceled: 0, no_driver: 0 };
  const bookings = data?.bookings ?? { total: 0, paid: 0, pending: 0, canceled: 0 };
  const revenue = data?.revenue ?? 0;
  const cargo = data?.cargo ?? { total: 0, totalWeight: 0, revenue: 0 };
  const alerts = data?.alerts ?? { tripsNoDriver: 0, pendingBookingsOld: 0, spjOverdue: 0 };
  const avgLoadFactor = data?.avgLoadFactor ?? 0;
  const recentBookings = data?.recentBookings ?? [];

  const hasAlerts = alerts.tripsNoDriver > 0 || alerts.pendingBookingsOld > 0 || alerts.spjOverdue > 0;

  return (
    <div className="flex flex-col h-full bg-background" data-testid="dashboard-page">
      <div className="border-b px-4 md:px-6 py-3 md:py-4 shrink-0">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 py-4 pb-20 space-y-5">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-trips-today">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Trips Hari Ini</p>
                      <p className="text-2xl font-bold">{trips.total}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">{trips.scheduled} jadwal</span>
                        <span className="text-xs text-muted-foreground">/ {trips.completed} selesai</span>
                        <span className="text-xs text-muted-foreground">/ {trips.canceled} batal</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                      <Bus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-bookings-today">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Booking Hari Ini</p>
                      <p className="text-2xl font-bold">{bookings.total}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">{bookings.paid} lunas</span>
                        <span className="text-xs text-muted-foreground">/ {bookings.pending} pending</span>
                        <span className="text-xs text-muted-foreground">/ {bookings.canceled} batal</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0">
                      <Ticket className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-revenue-today">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue Hari Ini</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtCurrency(revenue)}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-cargo-today">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Kargo Hari Ini</p>
                      <p className="text-2xl font-bold">{cargo.total}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">{cargo.totalWeight} kg</span>
                        <span className="text-xs text-muted-foreground">/ {fmtCurrency(cargo.revenue)}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {hasAlerts && (
              <Card data-testid="card-alerts">
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-base">Peringatan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    {alerts.tripsNoDriver > 0 && (
                      <Badge variant="destructive" data-testid="badge-alert-no-driver">
                        {alerts.tripsNoDriver} trip tanpa driver
                      </Badge>
                    )}
                    {alerts.pendingBookingsOld > 0 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" data-testid="badge-alert-pending-old">
                        {alerts.pendingBookingsOld} booking pending &gt;30 menit
                      </Badge>
                    )}
                    {alerts.spjOverdue > 0 && (
                      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" data-testid="badge-alert-spj-overdue">
                        {alerts.spjOverdue} SPJ overdue
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card data-testid="card-load-factor">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Load Factor Rata-rata</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative w-28 h-28">
                      <svg className="w-full h-full" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          className="text-muted/20"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          className="text-primary"
                          strokeWidth="3"
                          strokeDasharray={`${Math.min(avgLoadFactor, 100)}, 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold" data-testid="text-load-factor">{avgLoadFactor.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2" data-testid="card-quick-actions">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Aksi Cepat</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="justify-start h-auto py-3"
                      onClick={() => navigate('/cso')}
                      data-testid="button-quick-booking"
                    >
                      <Ticket className="w-4 h-4 mr-2 shrink-0" />
                      <div className="text-left">
                        <p className="font-medium">Buat Booking</p>
                        <p className="text-xs text-muted-foreground">Mulai transaksi baru</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
                    </Button>

                    <Button
                      variant="outline"
                      className="justify-start h-auto py-3"
                      onClick={() => navigate('/schedule')}
                      data-testid="button-quick-schedule"
                    >
                      <CalendarDays className="w-4 h-4 mr-2 shrink-0" />
                      <div className="text-left">
                        <p className="font-medium">Jadwal Harian</p>
                        <p className="text-xs text-muted-foreground">Lihat jadwal hari ini</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
                    </Button>

                    <Button
                      variant="outline"
                      className="justify-start h-auto py-3"
                      onClick={() => navigate('/reports/revenue')}
                      data-testid="button-quick-reports"
                    >
                      <FileText className="w-4 h-4 mr-2 shrink-0" />
                      <div className="text-left">
                        <p className="font-medium">Laporan</p>
                        <p className="text-xs text-muted-foreground">Revenue & analisa</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-recent-bookings">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">Booking Terbaru</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/bookings')}
                  data-testid="button-view-all-bookings"
                >
                  Lihat Semua
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {recentBookings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kode</TableHead>
                          <TableHead>Rute</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                          <TableHead>Waktu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentBookings.map((b) => {
                          const statusInfo = BOOKING_STATUS_MAP[b.status as keyof typeof BOOKING_STATUS_MAP];
                          return (
                            <TableRow key={b.id} data-testid={`row-booking-${b.id}`}>
                              <TableCell className="font-mono text-sm" data-testid={`text-booking-code-${b.id}`}>
                                {b.booking_code}
                              </TableCell>
                              <TableCell className="text-sm">
                                {b.origin_name || '—'} → {b.dest_name || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{b.channel || '—'}</Badge>
                              </TableCell>
                              <TableCell>
                                {statusInfo ? (
                                  <Badge variant="outline" className={`text-xs ${statusInfo.color} ${statusInfo.bg}`}>
                                    {statusInfo.label}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">{b.status}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {fmtCurrency(b.total_amount)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {b.created_at
                                  ? format(new Date(b.created_at), 'HH:mm', { locale: id })
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Belum ada booking hari ini</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
