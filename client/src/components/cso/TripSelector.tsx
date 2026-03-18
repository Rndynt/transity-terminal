import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Store, Calendar, Bus, Loader2, Search, ChevronDown,
  ArrowRight, Armchair, Route, X, Check, ChevronLeft, ChevronRight as ChevronRightIcon
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

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function CustomSelect({ value, options, placeholder, icon: Icon, onChange, testId }: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  icon: any;
  onChange: (value: string) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedLabel = options.find(o => o.value === value)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-10 bg-white border rounded-xl px-3 flex items-center gap-2 text-sm transition-all ${
          open ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'
        }`}
        data-testid={testId}
      >
        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className={`flex-1 text-left truncate ${selectedLabel ? 'text-gray-800' : 'text-gray-400'}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto py-1">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                opt.value === value
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              data-testid={`option-${opt.value}`}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
            </button>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-gray-400">Tidak ada opsi</div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomDatePicker({ value, onChange, testId }: {
  value: string;
  onChange: (date: string) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
      return `${dayName}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return dateStr; }
  };

  const isToday = (day: number) => {
    return viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const sel = new Date(value + 'T00:00:00');
    return viewYear === sel.getFullYear() && viewMonth === sel.getMonth() && day === sel.getDate();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-10 bg-white border rounded-xl px-3 flex items-center gap-2 text-sm transition-all ${
          open ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'
        }`}
        data-testid={testId}
      >
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="flex-1 text-left text-gray-800 truncate">{formatDisplayDate(value)}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={handlePrevMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800">{MONTHS_ID[viewMonth]} {viewYear}</span>
            <button type="button" onClick={handleNextMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS_ID.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => (
              <div key={i} className="aspect-square flex items-center justify-center">
                {day !== null ? (
                  <button
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      isSelected(day)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isToday(day)
                          ? 'bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-200'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {day}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                const m = String(t.getMonth() + 1).padStart(2, '0');
                const d = String(t.getDate()).padStart(2, '0');
                onChange(`${t.getFullYear()}-${m}-${d}`);
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth());
                setOpen(false);
              }}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                t.setDate(t.getDate() + 1);
                const m = String(t.getMonth() + 1).padStart(2, '0');
                const d = String(t.getDate()).padStart(2, '0');
                onChange(`${t.getFullYear()}-${m}-${d}`);
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth());
                setOpen(false);
              }}
              className="text-xs text-gray-500 font-medium hover:underline"
            >
              Besok
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  const getTripIsPast = (trip: CsoAvailableTrip): boolean => {
    if (!trip.departAtAtOutlet) return false;
    return new Date(trip.departAtAtOutlet) < new Date();
  };

  const handleTripSelect = async (trip: CsoAvailableTrip) => {
    if (trip.status === 'closed') {
      toast({ title: "Trip Ditutup", description: "Trip ini sudah ditutup", variant: "destructive" });
      return;
    }
    if (getTripIsPast(trip) && trip.isVirtual) {
      toast({ title: "Jadwal Sudah Lewat", description: "Trip virtual yang sudah lewat tidak bisa diaktifkan", variant: "destructive" });
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

  const outletOptions = outlets.map(o => ({ value: o.id, label: o.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Pilih Jadwal</h3>
        <span className="text-[10px] text-gray-400">{filteredTrips.length} jadwal</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Store className="w-3 h-3" /> Outlet
          </label>
          <CustomSelect
            value={selectedOutlet?.id || ''}
            options={outletOptions}
            placeholder="Pilih outlet..."
            icon={Store}
            onChange={(val) => {
              const outlet = outlets.find(o => o.id === val);
              if (outlet) onOutletSelect(outlet);
            }}
            testId="select-outlet"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Tanggal
          </label>
          <CustomDatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            testId="input-date"
          />
        </div>
      </div>

      {selectedOutlet && (trips || []).length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari rute, kota, atau kode..."
            className="w-full h-10 pl-9 pr-8 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
            data-testid="input-search-trip"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" data-testid="btn-clear-search">
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
                <div className="flex items-center gap-2 min-w-0">
                  <Route className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-700 truncate">{group.route}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{group.trips.length} jadwal</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${collapsedRoutes.has(group.route) ? '-rotate-90' : ''}`} />
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
                      const isSelected = (trip.tripId && selectedTrip?.tripId === trip.tripId) ||
                        (trip.isVirtual && trip.baseId && selectedTrip?.baseId === trip.baseId);
                      const isPast = getTripIsPast(trip);
                      const isPastVirtual = isPast && trip.isVirtual;
                      const isDisabled = trip.status === 'closed' || trip.status === 'canceled' || isPastVirtual;
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
                              : isPast && !trip.isVirtual
                                ? 'opacity-70 bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
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
                                  <span className={`text-lg font-bold font-mono tracking-tight ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>
                                    {formatDepartTime(trip.departAtAtOutlet)}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-sm text-gray-500 font-mono">
                                    {formatArriveTime(trip)}
                                  </span>
                                </>
                              )}
                            </div>
                            {isPast && trip.isVirtual ? (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-semibold">Sudah Lewat</span>
                            ) : isPast && !trip.isVirtual ? (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-md text-[10px] font-semibold">Sudah Lewat</span>
                            ) : trip.isVirtual ? (
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
