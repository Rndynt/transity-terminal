import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bus, Users, TrendingUp } from "lucide-react";
import { fmtShortDate } from "@/lib/constants";
import { driverPerformanceApi } from "@/lib/api";

interface DriverPerformanceTabProps {
  driverId: string;
  driverName: string;
}

interface PerformanceStats {
  total_trips: number;
  total_passengers: number;
  avg_load_factor: number;
}

interface TripHistoryItem {
  id: string;
  service_date: string;
  status: string;
  pattern_name: string | null;
  vehicle_plate: string | null;
  passenger_count: number;
}

interface PerformanceData {
  stats: PerformanceStats;
  tripHistory: TripHistoryItem[];
}

const PERIOD_OPTIONS = [
  { label: "7 hari", value: 7 },
  { label: "30 hari", value: 30 },
  { label: "90 hari", value: 90 },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Terjadwal", className: "bg-blue-50 text-blue-700 border-blue-200" },
  canceled: { label: "Dibatalkan", className: "bg-red-50 text-red-700 border-red-200" },
  closed: { label: "Ditutup", className: "bg-gray-50 text-gray-600 border-gray-200" },
};

export default function DriverPerformanceTab({ driverId, driverName }: DriverPerformanceTabProps) {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/drivers", driverId, "performance", `?days=${days}`],
    queryFn: () => driverPerformanceApi.get(driverId, days),
    enabled: !!driverId,
  });

  const stats = data?.stats;
  const tripHistory = data?.tripHistory ?? [];
  const avgLf = stats ? Number(stats.avg_load_factor).toFixed(1) : "0";

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" data-testid="driver-performance-tab">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Performa <span className="font-medium text-foreground">{driverName}</span>
        </p>
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={days === opt.value ? "default" : "outline"}
              onClick={() => setDays(opt.value)}
              data-testid={`btn-period-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950">
              <Bus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Trip</p>
              <p className="text-xl font-semibold" data-testid="stat-total-trips">
                {stats?.total_trips ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Penumpang</p>
              <p className="text-xl font-semibold" data-testid="stat-total-passengers">
                {stats?.total_passengers ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Load Factor</p>
              <p className="text-xl font-semibold" data-testid="stat-avg-load-factor">
                {avgLf}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Rute</TableHead>
                <TableHead>Kendaraan</TableHead>
                <TableHead className="text-center">Penumpang</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tripHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Tidak ada data trip untuk periode ini
                  </TableCell>
                </TableRow>
              ) : (
                tripHistory.map((trip) => {
                  const st = STATUS_BADGE[trip.status] ?? { label: trip.status, className: "" };
                  return (
                    <TableRow key={trip.id} data-testid={`row-trip-${trip.id}`}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {fmtShortDate(trip.service_date)}
                      </TableCell>
                      <TableCell className="text-sm">{trip.pattern_name ?? "—"}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {trip.vehicle_plate ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm" data-testid={`text-pax-${trip.id}`}>
                        {trip.passenger_count}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={st.className}>
                          {st.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
