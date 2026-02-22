import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Calendar, Bus, Loader2, MapPin, Clock, ChevronRight, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { tripsApi, outletsApi } from '@/lib/api';
import type { Outlet, CsoAvailableTrip } from '@/types';

interface TripSelectorProps {
  selectedOutlet?: Outlet;
  selectedTrip?: CsoAvailableTrip;
  onOutletSelect: (outlet: Outlet) => void;
  onTripSelect: (trip: CsoAvailableTrip) => void;
}

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
    enabled: !!selectedDate && !!selectedOutlet?.id
  });

  const materializeMutation = useMutation({
    mutationFn: async (baseId: string) => {
      setMaterializingBaseId(baseId);
      const response = await fetch('/api/cso/materialize-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId, serviceDate: selectedDate })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to materialize trip');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setMaterializingBaseId(null);
      toast({ title: "Trip Siap", description: "Trip berhasil dibuat" });
      refetchTrips().then((result) => {
        if (data.tripId && result.data) {
          const trip = result.data.find(t => t.tripId === data.tripId);
          if (trip) onTripSelect(trip);
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
      toast({ title: "Trip Ditutup", description: "Trip ini sudah ditutup", variant: "destructive" });
      return;
    }

    if (trip.isVirtual && trip.baseId) {
      try {
        const result = await materializeMutation.mutateAsync(trip.baseId);
        // Will auto-select in onSuccess
      } catch (error) {
        // Error handled in onError
      }
    } else {
      onTripSelect(trip);
    }
  };

  const formatDepartTime = (isoString: string | null): string => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
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

  // Group trips by route
  const groupedTrips = (trips || []).reduce((groups: Record<string, CsoAvailableTrip[]>, trip) => {
    const routeName = trip.patternPath || 'Unknown Route';
    if (!groups[routeName]) groups[routeName] = [];
    groups[routeName].push(trip);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      {/* Section 1: Outlet & Date - Compact */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Store className="w-3 h-3" /> Outlet
          </Label>
          <Select 
            value={selectedOutlet?.id} 
            onValueChange={(value) => {
              const outlet = outlets.find(o => o.id === value);
              if (outlet) onOutletSelect(outlet);
            }}
          >
            <SelectTrigger className="h-9 text-sm">
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
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Tanggal
          </Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Section 2: Trip Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Bus className="w-3 h-3" /> Jadwal Keberangkatan
        </Label>

        <div className="border rounded-lg overflow-hidden">
          {!selectedOutlet ? (
            <div className="p-6 text-center">
              <Store className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Pilih outlet terlebih dahulu</p>
            </div>
          ) : tripsLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Memuat jadwal...</p>
            </div>
          ) : Object.keys(groupedTrips).length === 0 ? (
            <div className="p-6 text-center">
              <Bus className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada jadwal tersedia</p>
              <p className="text-xs text-muted-foreground mt-1">Coba tanggal atau outlet lain</p>
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(groupedTrips).map(([routeName, routeTrips]) => (
                <div key={routeName}>
                  {/* Route Header */}
                  <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{routeName}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {routeTrips.length} jadwal
                    </Badge>
                  </div>
                  
                  {/* Trip List */}
                  <div className="divide-y">
                    {routeTrips
                      .sort((a, b) => {
                        if (!a.departAtAtOutlet && !b.departAtAtOutlet) return 0;
                        if (!a.departAtAtOutlet) return 1;
                        if (!b.departAtAtOutlet) return -1;
                        return new Date(a.departAtAtOutlet).getTime() - new Date(b.departAtAtOutlet).getTime();
                      })
                      .map(trip => {
                        const isSelected = selectedTrip?.tripId === trip.tripId || 
                          (trip.isVirtual && selectedTrip?.baseId === trip.baseId);
                        const isDisabled = trip.status === 'closed' || trip.status === 'canceled';
                        const isMaterializing = materializingBaseId === trip.baseId;

                        return (
                          <button
                            key={trip.tripId || trip.baseId}
                            onClick={() => !isDisabled && !isMaterializing && handleTripSelect(trip)}
                            disabled={isDisabled || isMaterializing}
                            className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                              isDisabled 
                                ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                                : isSelected 
                                  ? 'bg-primary/10 border-l-2 border-primary' 
                                  : 'hover:bg-muted/50'
                            }`}
                          >
                            {/* Time */}
                            <div className="w-14 text-center flex-shrink-0">
                              <div className="text-lg font-bold tabular-nums">
                                {isMaterializing ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : (
                                  formatDepartTime(trip.departAtAtOutlet)
                                )}
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {trip.isVirtual ? (
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                                    Virtual
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-200">
                                    Aktif
                                  </Badge>
                                )}
                                
                                {trip.status === 'closed' && (
                                  <Badge variant="destructive" className="text-[10px]">Ditutup</Badge>
                                )}
                              </div>
                              
                              <div className="text-xs text-muted-foreground">
                                {trip.vehicle ? `${trip.vehicle.code}` : 'Kendaraan TBD'}
                                {' • '}
                                <span className={trip.availableSeats && trip.availableSeats > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                                  {trip.availableSeats ?? trip.capacity ?? '?'} kursi
                                </span>
                              </div>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
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
