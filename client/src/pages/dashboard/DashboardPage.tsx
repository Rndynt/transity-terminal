import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Ticket, Users, TrendingUp, DollarSign, Calendar, 
  MapPin, Bus, Store, ChevronRight, Clock 
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

interface DashboardStats {
  todayBookings: number;
  todayRevenue: number;
  topOutlet: { name: string; count: number } | null;
  topTrip: { route: string; count: number } | null;
  recentBookings: any[];
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats?date=${selectedDate}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(amount || 0);

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '--:--';
    return format(new Date(timestamp), 'HH:mm', { locale: id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Booking Hari Ini */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Booking</p>
                <p className="text-2xl font-bold">{stats?.todayBookings || 0}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Ticket className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.todayRevenue || 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Outlet */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outlet Terlaris</p>
                <p className="text-lg font-bold truncate max-w-[150px]">
                  {stats?.topOutlet?.name || '-'}
                </p>
                {stats?.topOutlet && (
                  <p className="text-xs text-muted-foreground">
                    {stats.topOutlet.count} booking
                  </p>
                )}
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Store className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Trip */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trip Terlaris</p>
                <p className="text-lg font-bold truncate max-w-[150px]">
                  {stats?.topTrip?.route || '-'}
                </p>
                {stats?.topTrip && (
                  <p className="text-xs text-muted-foreground">
                    {stats.topTrip.count} booking
                  </p>
                )}
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Bus className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => window.location.href = '/cso'}
            >
              <Ticket className="w-4 h-4 mr-2" />
              <div className="text-left">
                <p className="font-medium">Buat Booking Baru</p>
                <p className="text-xs text-muted-foreground">Mulai transaksi baru</p>
              </div>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>

            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => window.location.href = '/masters?tab=trips'}
            >
              <Calendar className="w-4 h-4 mr-2" />
              <div className="text-left">
                <p className="font-medium">Kelola Jadwal</p>
                <p className="text-xs text-muted-foreground">Atur jadwal trip</p>
              </div>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>

            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => window.location.href = '/masters'}
            >
              <Users className="w-4 h-4 mr-2" />
              <div className="text-left">
                <p className="font-medium">Master Data</p>
                <p className="text-xs text-muted-foreground">Kelola data master</p>
              </div>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Booking Terbaru</Card>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/masters?tab=bookings'}
            >
              Lihat Semua
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats?.recentBookings && stats.recentBookings.length > 0 ? (
            <div className="space-y-3">
              {stats.recentBookings.map((booking: any) => (
                <div 
                  key={booking.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Ticket className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {booking.passengers?.[0]?.fullName || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.originStop?.code} ? {booking.destinationStop?.code}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(booking.totalAmount)}
                    </p>
                    <Badge 
                      variant={booking.status === 'paid' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {booking.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Belum ada booking hari ini</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}