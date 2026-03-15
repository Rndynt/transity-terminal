import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Store, Calendar, Bus, Loader2, MapPin, ChevronRight, Armchair, Search, ChevronDown } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedRoutes, setCollapsedRoutes] = useState<Set<string>>(new Set());
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
        await materializeMutation.mutateAsync(trip.baseId);
      } catch {
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

  const filteredTrips = useMemo(() => {
    if (!searchQuery.trim()) return trips || [];
    const q = searchQuery.toLowerCase();
    return (trips || []).filter(trip =>
      (trip.patternPath || '').toLowerCase().includes(q) ||
      (trip.vehicle?.code || '').toLowerCase().includes(q)
    );
  }, [trips, searchQuery]);

  const groupedTrips = useMemo(() => {
    return filteredTrips.reduce((groups: Record<string, CsoAvailableTrip[]>, trip) => {
      const routeName = trip.patternPath || 'Unknown Route';
      if (!groups[routeName]) groups[routeName] = [];
      groups[routeName].push(trip);
      return groups;
    }, {});
  }, [filteredTrips]);

  const toggleRouteCollapse = (routeName: string) => {
    setCollapsedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeName)) next.delete(routeName);
      else next.add(routeName);
      return next;
    });
  };

  const totalTrips = filteredTrips.length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
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
              <SelectTrigger className="h-9 text-sm" data-testid="select-outlet">
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
              data-testid="input-date"
            />
          </div>
        </div>

        {selectedOutlet && (trips || []).length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari rute, kota, kendaraan..."
              className="h-8 pl-8 text-sm"
              data-testid="input-search-trip"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Bus className="w-3 h-3" /> Jadwal Keberangkatan
            </Label>
            {totalTrips > 0 && (
              <span className="text-[10px] text-muted-foreground">{totalTrips} jadwal</span>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden">
            {!selectedOutlet ? (
              <div className="p-6 text-center">
                <Store className="w-8 h-8 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Pilih outlet terlebih dahulu</p>
              </div>
            ) : tripsLoading ? (
              <div className="p-6 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                <p className="text-xs text-muted-foreground mt-1.5">Memuat jadwal...</p>
              </div>
            ) : Object.keys(groupedTrips).length === 0 ? (
              <div className="p-6 text-center">
                <Bus className="w-8 h-8 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Tidak ada jadwal tersedia</p>
              </div>
            ) : (
              <div className="divide-y">
                {Object.entries(groupedTrips).map(([routeName, routeTrips]) => (
                  <div key={routeName}>
                    <button
                      onClick={() => toggleRouteCollapse(routeName)}
                      className="w-full px-3 py-1.5 bg-muted/40 flex items-center gap-1.5 cursor-pointer hover:bg-muted/60 transition-colors"
                      data-testid={`route-header-${routeName.slice(0, 10)}`}
                    >
                      <ChevronDown className={`w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform ${collapsedRoutes.has(routeName) ? '-rotate-90' : ''}`} />
                      <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[11px] font-medium text-muted-foreground truncate flex-1 min-w-0 text-left">{routeName}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 flex-shrink-0">{routeTrips.length} jadwal</Badge>
                    </button>

                    {!collapsedRoutes.has(routeName) ? (
                      <div className="divide-y divide-dashed">
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
                            const seatCount = trip.availableSeats ?? trip.capacity ?? 0;
                            const seatsFull = typeof trip.availableSeats === 'number' && trip.availableSeats <= 0;

                            return (
                              <button
                                key={trip.tripId || trip.baseId}
                                onClick={() => !isDisabled && !isMaterializing && handleTripSelect(trip)}
                                disabled={isDisabled || isMaterializing}
                                data-testid={`trip-row-${trip.tripId || trip.baseId}`}
                                className={`w-full h-11 px-3 flex items-center gap-2 text-left transition-colors ${
                                  isDisabled
                                    ? 'opacity-40 cursor-not-allowed bg-muted/20'
                                    : isSelected
                                      ? 'bg-primary/10 border-l-2 border-l-primary'
                                      : 'hover:bg-muted/40'
                                }`}
                              >
                                <div className="w-12 flex-shrink-0">
                                  {isMaterializing ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                  ) : (
                                    <span className="text-sm font-bold tabular-nums">{formatDepartTime(trip.departAtAtOutlet)}</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                                  {trip.isVirtual ? (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200 flex-shrink-0">
                                      Virtual
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-50 text-green-600 border-green-200 flex-shrink-0">
                                      Aktif
                                    </Badge>
                                  )}
                                  {trip.status === 'closed' && (
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 flex-shrink-0">Tutup</Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {trip.vehicle ? trip.vehicle.code : 'TBD'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Armchair className="w-3 h-3 text-muted-foreground" />
                                  <span className={`text-xs font-medium tabular-nums ${seatsFull ? 'text-red-500' : 'text-green-600'}`}>
                                    {seatCount}
                                  </span>
                                </div>

                                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground/40'}`} />
                              </button>
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
