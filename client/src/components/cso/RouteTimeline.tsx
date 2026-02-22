import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { tripsApi, stopsApi } from '@/lib/api';
import { Route, Circle, Clock, ArrowDown, MapPin, Users } from 'lucide-react';
import type { Trip, Stop } from '@/types';

interface RouteTimelineProps {
  trip: Trip;
  selectedOrigin?: Stop;
  selectedDestination?: Stop;
  onOriginSelect: (stop: Stop, sequence: number) => void;
  onDestinationSelect: (stop: Stop, sequence: number) => void;
}

// Format time in Asia/Jakarta timezone
const formatTime = (timestamp: string | Date | null): string => {
  if (!timestamp) return '--:--';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta'
  });
};

// Calculate duration in minutes between two timestamps
const calculateDuration = (depart: Date | null, arrive: Date | null): number | null => {
  if (!depart || !arrive) return null;
  const diffMs = arrive.getTime() - depart.getTime();
  return Math.round(diffMs / (1000 * 60));
};

export default function RouteTimeline({
  trip,
  selectedOrigin,
  selectedDestination,
  onOriginSelect,
  onDestinationSelect
}: RouteTimelineProps) {
  const { data: stopTimes = [] } = useQuery({
    queryKey: ['/api/trips', trip.id, 'stop-times', 'effective'],
    queryFn: () => tripsApi.getStopTimesWithEffectiveFlags(trip.id),
    enabled: !!trip.id
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const getStopById = (stopId: string) => stops.find(s => s.id === stopId);

  const sortedStopTimes = [...stopTimes].sort((a: any, b: any) => a.stopSequence - b.stopSequence);

  // Calculate journey duration
  const getJourneyDuration = (): string => {
    if (sortedStopTimes.length < 2) return '--';
    const first = sortedStopTimes[0];
    const last = sortedStopTimes[sortedStopTimes.length - 1];
    const duration = calculateDuration(first.departAt, last.arriveAt);
    if (!duration) return '--';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes} menit`;
  };

  return (
    <div className="space-y-4">
      {/* Route Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Route className="w-4 h-4 text-primary" />
          Pilih Rute
        </h3>
        {selectedOrigin && selectedDestination && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Clock className="w-3 h-3 mr-1" />
            {getJourneyDuration()}
          </Badge>
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <p>Pilih <strong>titik keberangkatan</strong> dan <strong>tujuan</strong> dengan menekan tombol di bawah.</p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline connector line */}
        <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-border"></div>
        
        {sortedStopTimes.map((stopTime: any, index: number) => {
          const stop = getStopById(stopTime.stopId);
          if (!stop) return null;

          const isFirst = index === 0;
          const isLast = index === sortedStopTimes.length - 1;
          
          const isOrigin = selectedOrigin?.id === stop.id;
          const isDestination = selectedDestination?.id === stop.id;
          
          const canBoard = stopTime.effectiveBoardingAllowed !== false;
          const canAlight = stopTime.effectiveAlightingAllowed !== false;

          // Calculate leg duration to next stop
          const nextStopTime = sortedStopTimes[index + 1];
          const legDuration = nextStopTime 
            ? calculateDuration(stopTime.departAt, nextStopTime.arriveAt) 
            : null;

          return (
            <div key={stopTime.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {/* Timeline dot */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 flex-shrink-0 ${
                isFirst ? 'bg-primary text-primary-foreground' :
                isLast ? 'bg-destructive text-destructive-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {isFirst ? (
                  <MapPin className="w-4 h-4" />
                ) : isLast ? (
                  <MapPin className="w-4 h-4" />
                ) : (
                  <Circle className="w-3 h-3 fill-current" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Stop Info */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-foreground">{stop.name}</p>
                    <p className="text-xs text-muted-foreground">{stop.code}</p>
                  </div>
                  
                  {/* Time */}
                  <div className="text-right">
                    {isFirst ? (
                      <div className="text-sm">
                        <span className="text-xs text-muted-foreground">Berangkat</span>
                        <p className="font-mono font-bold">{formatTime(stopTime.departAt)}</p>
                      </div>
                    ) : isLast ? (
                      <div className="text-sm">
                        <span className="text-xs text-muted-foreground">Tiba</span>
                        <p className="font-mono font-bold">{formatTime(stopTime.arriveAt)}</p>
                      </div>
                    ) : (
                      <div className="text-xs">
                        <p className="font-mono">{formatTime(stopTime.arriveAt)}</p>
                        <p className="font-mono text-muted-foreground">{formatTime(stopTime.departAt)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pickup/Drop Info */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {canBoard ? (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                      Bisa Naik
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                      Tidak Bisa Naik
                    </Badge>
                  )}
                  
                  {canAlight ? (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                      Bisa Turun
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                      Tidak Bisa Turun
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {!isLast && (
                    <Button
                      size="sm"
                      variant={isOrigin ? "default" : "outline"}
                      onClick={() => canBoard && onOriginSelect(stop, stopTime.stopSequence)}
                      disabled={!canBoard}
                      className={`h-7 text-xs px-2 ${!canBoard ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={!canBoard ? "Tidak bisa naik di sini" : "Pilih sebagai titik keberangkatan"}
                    >
                      {isOrigin ? 'Terpilih' : 'Keberangkatan'}
                    </Button>
                  )}
                  
                  {!isFirst && (
                    <Button
                      size="sm"
                      variant={isDestination ? "default" : "outline"}
                      onClick={() => canAlight && onDestinationSelect(stop, stopTime.stopSequence)}
                      disabled={!canAlight}
                      className={`h-7 text-xs px-2 ${!canAlight ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={!canAlight ? "Tidak bisa turun di sini" : "Pilih sebagai tujuan"}
                    >
                      {isDestination ? 'Terpilih' : 'Tujuan'}
                    </Button>
                  )}
                </div>

                {/* Leg Duration */}
                {legDuration && !isLast && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <ArrowDown className="w-3 h-3" />
                    <span>
                      {legDuration >= 60 
                        ? `${Math.floor(legDuration / 60)}j ${legDuration % 60}m` 
                        : `${legDuration} menit`
                      } ke stop berikutnya
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Journey Summary */}
      {selectedOrigin && selectedDestination && (
        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Ringkasan Perjalanan</h4>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1">
              <span className="text-muted-foreground">Dari:</span>
              <p className="font-medium">{selectedOrigin.name}</p>
            </div>
            <ArrowDown className="w-4 h-4 text-primary rotate-[-90deg]" />
            <div className="flex-1 text-right">
              <span className="text-muted-foreground">Ke:</span>
              <p className="font-medium">{selectedDestination.name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
