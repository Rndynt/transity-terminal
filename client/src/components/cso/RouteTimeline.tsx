import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tripsApi, stopsApi } from '@/lib/api';
import { Route, Circle, Clock, ArrowDown, MapPin } from 'lucide-react';
import type { Trip, Stop } from '@/types';

interface RouteTimelineProps {
  trip: Trip;
  selectedOrigin?: Stop;
  selectedDestination?: Stop;
  onOriginSelect: (stop: Stop, sequence: number) => void;
  onDestinationSelect: (stop: Stop, sequence: number) => void;
}

// Safe time formatting with null checks
const formatTime = (timestamp: string | Date | null | undefined): string => {
  if (!timestamp) return '--:--';
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    });
  } catch {
    return '--:--';
  }
};

// Safe duration calculation
const calculateDuration = (depart: Date | string | null | undefined, arrive: Date | string | null | undefined): number | null => {
  if (!depart || !arrive) return null;
  try {
    const departDate = depart instanceof Date ? depart : new Date(depart);
    const arriveDate = arrive instanceof Date ? arrive : new Date(arrive);
    if (isNaN(departDate.getTime()) || isNaN(arriveDate.getTime())) return null;
    const diffMs = arriveDate.getTime() - departDate.getTime();
    return Math.round(diffMs / (1000 * 60));
  } catch {
    return null;
  }
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
    <div className="space-y-3">
      {/* Instructions */}
      <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg p-2.5">
        <p>Pilih <strong>titik keberangkatan</strong> dan <strong>tujuan</strong>:</p>
      </div>

      {/* Timeline */}
      <div className="relative">
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

          // Calculate leg duration
          const nextStopTime = sortedStopTimes[index + 1];
          const legDuration = nextStopTime 
            ? calculateDuration(stopTime.departAt, nextStopTime.arriveAt) 
            : null;

          return (
            <div key={stopTime.id} className="relative flex items-start gap-3 pb-3 last:pb-0">
              {/* Timeline dot */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 flex-shrink-0 ${
                isFirst ? 'bg-primary text-primary-foreground' :
                isLast ? 'bg-red-500 text-white' :
                'bg-muted text-muted-foreground'
              }`}>
                <MapPin className="w-4 h-4" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <p className="font-medium">{stop.name}</p>
                    <p className="text-xs text-muted-foreground">{stop.code}</p>
                  </div>
                  
                  {/* Time */}
                  <div className="text-right">
                    {isFirst ? (
                      <div>
                        <span className="text-[10px] text-muted-foreground">Berangkat</span>
                        <p className="font-mono font-bold text-sm">{formatTime(stopTime.departAt)}</p>
                      </div>
                    ) : isLast ? (
                      <div>
                        <span className="text-[10px] text-muted-foreground">Tiba</span>
                        <p className="font-mono font-bold text-sm">{formatTime(stopTime.arriveAt)}</p>
                      </div>
                    ) : (
                      <div className="text-xs">
                        <p className="font-mono">{formatTime(stopTime.arriveAt)}</p>
                        <p className="font-mono text-muted-foreground">{formatTime(stopTime.departAt)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pickup/Drop badges */}
                <div className="flex gap-1 mb-2">
                  {canBoard && !isLast && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">Naik ✓</Badge>
                  )}
                  {canAlight && !isFirst && (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">Turun ✓</Badge>
                  )}
                  {!canBoard && !isLast && (
                    <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-500">No Naik</Badge>
                  )}
                  {!canAlight && !isFirst && (
                    <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-500">No Turun</Badge>
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
                      className="h-7 text-xs px-2"
                    >
                      {isOrigin ? '✓ Terpilih' : 'Keberangkatan'}
                    </Button>
                  )}
                  
                  {!isFirst && (
                    <Button
                      size="sm"
                      variant={isDestination ? "default" : "outline"}
                      onClick={() => canAlight && onDestinationSelect(stop, stopTime.stopSequence)}
                      disabled={!canAlight}
                      className="h-7 text-xs px-2"
                    >
                      {isDestination ? '✓ Terpilih' : 'Tujuan'}
                    </Button>
                  )}
                </div>

                {/* Leg Duration */}
                {legDuration && !isLast && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                    <ArrowDown className="w-2.5 h-2.5" />
                    <span>
                      {legDuration >= 60 
                        ? `${Math.floor(legDuration / 60)}j ${legDuration % 60}m` 
                        : `${legDuration}m`
                      }
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
        <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Dari</span>
              <p className="font-medium">{selectedOrigin.name}</p>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {getJourneyDuration()}
              </Badge>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground text-xs">Ke</span>
              <p className="font-medium">{selectedDestination.name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
