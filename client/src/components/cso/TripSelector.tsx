import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Store, Calendar, Bus, Loader2, Search, ChevronDown,
  ArrowRight, Armchair, Route, X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { tripsApi, outletsApi } from '@/lib/api';
import type { Outlet, CsoAvailableTrip } from '@/types';

interface TripSelectorProps {
  selectedOutlet?: Outlet;
  selectedTrip?: CsoAvailableTrip;
  onOutletSelect: (outlet: Outlet) => void;
  onTripSelect: (trip: CsoAvailableTrip) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

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
      try { await materializeMutation.mutateAsync(trip.baseId); } catch {}
    } else {
      onTripSelect(trip);
    }
  };

  const formatDepartTime = (isoString: string | null): string => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    } catch { return '--:--'; }
  };

  const formatArriveTime = (trip: CsoAvailableTrip): string => {
    if (!trip.finalArrivalAt) return '--:--';
    try {
      const date = new Date(trip.finalArrivalAt);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    } catch { return '--:--'; }
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
    const groups: Record<string, CsoAvailableTrip[]> = {};
    for (const trip of filteredTrips) {
      const routeName = trip.patternPath || 'Unknown Route';
      (groups[routeName] ??= []).push(trip);
    }
    return Object.entries(groups).map(([route, trips]) => ({ route, trips }));
  }, [filteredTrips]);

  const toggleRouteCollapse = (routeName: string) => {
    setCollapsedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeName)) next.delete(routeName); else next.add(routeName);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Pilih Jadwal</h3>
        <span className="text-[10px] text-gray-400">{filteredTrips.length} jadwal</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Store className="w-3 h-3" /> Outlet
          </label>
          <select
            value={selectedOutlet?.id || ''}
            onChange={(e) => {
              const outlet = outlets.find(o => o.id === e.target.value);
              if (outlet) onOutletSelect(outlet);
            }}
            className="w-full h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
            data-testid="select-outlet"
          >
            <option value="">Pilih outlet...</option>
            {outlets.map(outlet => (
              <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Tanggal
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
            data-testid="input-date"
          />
        </div>
      </div>

      {selectedOutlet && (trips || []).length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari rute, kota, atau kode kendaraan..."
            className="w-full h-9 pl-9 pr-8 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
            data-testid="input-search-trip"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {!selectedOutlet ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
            <Store className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
            <p className="text-xs text-gray-400">Pilih outlet terlebih dahulu</p>
          </div>
        ) : tripsLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-500" />
            <p className="text-xs text-gray-400 mt-1.5">Memuat jadwal...</p>
          </div>
        ) : groupedTrips.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Tidak ada jadwal ditemukan</p>
            <p className="text-xs text-gray-300 mt-0.5">Coba ubah kata kunci pencarian</p>
          </div>
        ) : (
          groupedTrips.map(group => (
            <div key={group.route}>
              <button
                onClick={() => toggleRouteCollapse(group.route)}
                className="w-full flex items-center justify-between py-1.5 mb-1.5 group"
                data-testid={`route-group-${group.route.slice(0, 15)}`}
              >
                <div className="flex items-center gap-2">
                  <Route className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-bold text-gray-700">{group.route}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{group.trips.length} jadwal</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedRoutes.has(group.route) ? '-rotate-90' : ''}`} />
              </button>
              {!collapsedRoutes.has(group.route) && (
                <div className="space-y-2">
                  {group.trips
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
                      const totalSeats = trip.capacity ?? 40;
                      const seatPct = totalSeats > 0 ? Math.round((seatCount / totalSeats) * 100) : 0;

                      return (
                        <button
                          key={trip.tripId || trip.baseId}
                          onClick={() => !isDisabled && !isMaterializing && handleTripSelect(trip)}
                          disabled={isDisabled || isMaterializing}
                          data-testid={`trip-card-${trip.tripId || trip.baseId}`}
                          className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                            isDisabled
                              ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                              : isSelected
                                ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {isMaterializing ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              ) : (
                                <>
                                  <span className="text-lg font-bold text-gray-900 font-mono tracking-tight">
                                    {formatDepartTime(trip.departAtAtOutlet)}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-sm text-gray-500 font-mono">
                                    {formatArriveTime(trip)}
                                  </span>
                                </>
                              )}
                            </div>
                            {trip.isVirtual ? (
                              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md text-[10px] font-semibold">Jadwal Virtual</span>
                            ) : trip.status === 'closed' ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-semibold">Ditutup</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-semibold">Aktif</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[11px] text-gray-400">
                              <span className="flex items-center gap-1"><Bus className="w-3 h-3" />{trip.vehicle?.code || 'TBD'}</span>
                              <span className={`flex items-center gap-1 font-medium ${
                                seatCount > 10 ? 'text-emerald-600' : seatCount > 0 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                <Armchair className="w-3 h-3" />{seatCount}/{totalSeats}
                              </span>
                            </div>
                            {(trip as any).pricePerSeat != null && (
                              <span className="text-xs font-bold text-gray-700 font-mono">{fmt((trip as any).pricePerSeat)}</span>
                            )}
                          </div>

                          <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                seatPct > 50 ? 'bg-emerald-400' : seatPct > 20 ? 'bg-amber-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${seatPct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
