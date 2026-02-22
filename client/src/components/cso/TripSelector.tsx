import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { tripsApi, outletsApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Calendar, Bus, Clock, MapPin, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Outlet, CsoAvailableTrip } from '@/types';

interface TripSelectorProps {
  selectedOutlet?: Outlet;
  selectedTrip?: CsoAvailableTrip;
  onOutletSelect: (outlet: Outlet) => void;
  onTripSelect: (trip: CsoAvailableTrip) => void;
}

// Format time in Asia/Jakarta timezone
const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta'
  }) + ' WIB';
};

// Calculate duration between two timestamps
const calculateDuration = (departAt: string | null, arriveAt: string | null): string => {
  if (!departAt || !arriveAt) return '--';
  
  const depart = new Date(departAt);
  const arrive = new Date(arriveAt);
  const diffMs = arrive.getTime() - depart.getTime();
  
  if (diffMs < 0) return '--';
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}j ${minutes}m`;
  }
  return `${minutes} menit`;
};

export default function TripSelector({ 
  selectedOutlet, 
  selectedTrip, 
  onOutletSelect, 
  onTripSelect 
}: TripSelectorProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [materializingBaseId, setMaterializingBaseId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: outlets = [] } = useQuery({
    queryKey: ['/api/outlets'],
    queryFn: outletsApi.getAll
  });

  const { data: trips = [], isLoading: tripsLoading, refetch: refetchTrips } = useQuery<CsoAvailableTrip[]>({
    queryKey: ['/api/cso/available-trips', selectedDate, selectedOutlet?.id],
    queryFn: () => tripsApi.getCsoAvailableTrips(selectedDate, selectedOutlet!.id),
    enabled: !!selectedDate && !!selectedOutlet?.id,
    refetchInterval: 30000, // Simple polling every 30 seconds
  });

  // Materialize trip mutation
  const materializeMutation = useMutation({
    mutationFn: async (baseId: string) => {
      setMaterializingBaseId(baseId);
      const response = await fetch('/api/cso/materialize-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId, serviceDate: selectedDate })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.code || 'Gagal membuat trip');
      }
      
      const result = await response.json();
      
      if (result.tripId) {
        const tripResponse = await fetch(`/api/trips/${result.tripId}`);
        if (tripResponse.ok) {
          const tripData = await tripResponse.json();
          return { ...result, materializedTrip: tripData };
        }
      }
      
      return result;
    },
    onSuccess: (data) => {
      setMaterializingBaseId(null);
      toast({ title: "Trip Tersedia", description: "Trip berhasil dibuat dan siap untuk booking." });
      
      refetchTrips().then((result) => {
        if (data.tripId && result.data) {
          const materializedTrip = result.data.find(t => t.tripId === data.tripId);
          if (materializedTrip) {
            onTripSelect(materializedTrip);
          }
        }
      });
    },
    onError: (error: Error) => {
      setMaterializingBaseId(null);
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    }
  });

  const handleTripSelect = async (trip: CsoAvailableTrip) => {
    if (trip.status === 'closed') {
      toast({ title: "Trip Ditutup", description: "Trip ini sudah ditutup.", variant: "destructive" });
      return;
    }

    if (trip.status === 'canceled') {
      toast({ title: "Trip Dibatalkan", description: "Trip ini sudah dibatalkan.", variant: "destructive" });
      return;
    }

    if (trip.isVirtual && trip.baseId) {
      try {
        await materializeMutation.mutateAsync(trip.baseId);
      } catch (error) {
        // Error handled in onError
      }
    } else {
      onTripSelect(trip);
    }
  };

  const isSelected = (trip: CsoAvailableTrip): boolean => {
    if (!selectedTrip) return false;
    if (trip.isVirtual) {
      return selectedTrip.isVirtual && selectedTrip.baseId === trip.baseId;
    }
    return selectedTrip.tripId === trip.tripId;
  };

  // Group trips by route
  const groupedTrips = trips.reduce((groups: Record<string, CsoAvailableTrip[]>, trip) => {
    const routeName = trip.patternPath;
    if (!groups[routeName]) {
      groups[routeName] = [];
    }
    groups[routeName].push(trip);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      {/* Outlet & Date Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Store className="w-4 h-4 text-muted-foreground" />
            Lokasi Keberangkatan
          </Label>
          <Select 
            value={selectedOutlet?.id} 
            onValueChange={(value) => {
              const outlet = outlets.find(o => o.id === value);
              if (outlet) onOutletSelect(outlet);
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Pilih outlet..." />
            </SelectTrigger>
            <SelectContent>
              {outlets.map(outlet => (
                <SelectItem key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Tanggal Keberangkatan
          </Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      {/* Available Trips */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Bus className="w-4 h-4 text-muted-foreground" />
          Jadwal Tersedia
        </Label>
        
        <div className="border rounded-lg overflow-hidden">
          {!selectedOutlet ? (
            <div className="text-center py-8 px-4 bg-muted/30">
              <Store className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Pilih outlet untuk melihat jadwal</p>
            </div>
          ) : tripsLoading ? (
            <div className="text-center py-8 px-4">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Memuat jadwal...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8 px-4 bg-muted/30">
              <Bus className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Tidak ada jadwal tersedia</p>
              <p className="text-xs text-muted-foreground mt-1">Coba tanggal atau outlet lain</p>
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(groupedTrips).map(([routeName, routeTrips]) => (
                <div key={routeName}>
                  {/* Route Header */}
                  <div className="px-3 py-2 bg-muted/50 text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    {routeName}
                  </div>
                  
                  {/* Trips List */}
                  <div className="divide-y">
                    {routeTrips
                      .sort((a, b) => {
                        if (!a.departAtAtOutlet) return 1;
                        if (!b.departAtAtOutlet) return -1;
                        return new Date(a.departAtAtOutlet).getTime() - new Date(b.departAtAtOutlet).getTime();
                      })
                      .map(trip => {
                        const selected = isSelected(trip);
                        const disabled = trip.status === 'closed' || trip.status === 'canceled';
                        const isMaterializing = materializingBaseId === trip.baseId;
                        
                        return (
                          <button
                            key={trip.tripId || trip.baseId}
                            className={`w-full p-3 text-left transition-colors ${
                              disabled 
                                ? 'bg-muted/30 cursor-not-allowed opacity-60'
                                : selected
                                  ? 'bg-primary/10 border-l-2 border-l-primary'
                                  : 'hover:bg-muted/30'
                            }`}
                            onClick={() => !disabled && !isMaterializing && handleTripSelect(trip)}
                            disabled={disabled || isMaterializing}
                          >
                            <div className="flex items-center gap-3">
                              {/* Departure Time */}
                              <div className="text-center min-w-[70px]">
                                <div className="text-lg font-bold text-foreground">
                                  {formatTime(trip.departAtAtOutlet).replace(' WIB', '')}
                                </div>
                                <div className="text-[10px] text-muted-foreground">WIB</div>
                              </div>
                              
                              {/* Arrow */}
                              <div className="flex-shrink-0">
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                              
                              {/* Arrival Time & Duration */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {trip.isVirtual ? (
                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                      Virtual
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                      Aktif
                                    </Badge>
                                  )}
                                  
                                  {trip.status === 'closed' && (
                                    <Badge variant="destructive" className="text-[10px]">Ditutup</Badge>
                                  )}
                                  {trip.status === 'canceled' && (
                                    <Badge variant="secondary" className="text-[10px]">Dibatalkan</Badge>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{calculateDuration(trip.departAtAtOutlet, trip.finalArrivalAt)}</span>
                                  {trip.finalArrivalAt && (
                                    <>
                                      <span>·</span>
                                      <span>Tiba {formatTime(trip.finalArrivalAt).replace(' WIB', '')}</span>
                                    </>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <Users className="w-3 h-3" />
                                  <span className={trip.isVirtual ? 'text-blue-600' : 'text-green-600 font-medium'}>
                                    {trip.isVirtual ? '~' : ''}{trip.availableSeats ?? trip.capacity ?? '?'} kursi
                                  </span>
                                  {trip.vehicle && (
                                    <>
                                      <span>·</span>
                                      <span>{trip.vehicle.code}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* Select Indicator */}
                              <div className="flex-shrink-0">
                                {isMaterializing ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                ) : selected ? (
                                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
