import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarCheck, Clock, MapPin, Truck, UserX } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { usePageTitle } from '@/components/layout/LayoutContext';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { TRIP_STATUS_MAP, type TripStatus } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface DriverProfile {
  id: string;
  code: string;
  name: string;
}

interface DriverScheduleTrip {
  tripId: string;
  serviceDate: string;
  departureTime: string | null;
  status: string | null;
  patternName: string | null;
  patternCode: string | null;
  vehiclePlate: string | null;
  originStop: string | null;
  destinationStop: string | null;
}

interface DriverSchedule {
  past: DriverScheduleTrip[];
  upcoming: DriverScheduleTrip[];
}

function TripRow({ trip }: { trip: DriverScheduleTrip }) {
  const statusInfo = trip.status && trip.status in TRIP_STATUS_MAP
    ? TRIP_STATUS_MAP[trip.status as TripStatus]
    : null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0" data-testid={`trip-row-${trip.tripId}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 truncate">
          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">
            {trip.originStop || '—'} <span className="text-gray-400">→</span> {trip.destinationStop || '—'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
          <span>{trip.patternName || trip.patternCode || 'Trip'}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(parseISO(trip.serviceDate), 'dd MMM yyyy', { locale: idLocale })}
            {trip.departureTime ? ` · ${trip.departureTime}` : ''}
          </span>
          <span className="flex items-center gap-1">
            <Truck className="w-3 h-3" />
            {trip.vehiclePlate || '—'}
          </span>
        </div>
      </div>
      {statusInfo && (
        <span className={cn('text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap flex-shrink-0', statusInfo.color, statusInfo.bg)}>
          {statusInfo.label}
        </span>
      )}
    </div>
  );
}

function ScheduleSection({ title, trips }: { title: string; trips: DriverScheduleTrip[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      {trips.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={CalendarCheck} title="Belum ada jadwal" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {trips.map(trip => <TripRow key={trip.tripId} trip={trip} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MySchedulePage() {
  usePageTitle('Jadwal Saya', 'Trip yang ditugaskan untuk Anda');

  const { data: profileData, isLoading: profileLoading } = useQuery<{ driver: DriverProfile | null }>({
    queryKey: ['/api/driver/me'],
  });

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<DriverSchedule>({
    queryKey: ['/api/driver/my-schedule'],
  });

  const isLoading = profileLoading || scheduleLoading;
  const driver = profileData?.driver ?? null;
  const past = scheduleData?.past ?? [];
  const upcoming = scheduleData?.upcoming ?? [];

  return (
    <div className="flex flex-col h-full bg-background" data-testid="my-schedule-page">
      <PageHeader icon={CalendarCheck} title="Jadwal Saya" subtitle="Trip yang ditugaskan untuk Anda" />

      <div className="flex-1 overflow-auto px-4 md:px-6 py-4 pb-20 space-y-5">
        {isLoading ? (
          <LoadingState size="lg" />
        ) : !driver ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={UserX}
                title="Akun Anda belum terhubung ke data driver"
                description="Hubungi administrator untuk menautkan akun Anda ke data driver agar jadwal dapat ditampilkan."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <ScheduleSection title="Jadwal Mendatang" trips={upcoming} />
            <ScheduleSection title="Jadwal Lewat" trips={past} />
          </>
        )}
      </div>
    </div>
  );
}
