import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Package, MapPin, Search, ArrowRight, Weight, Hash, Ruler, ShieldCheck,
  User, Banknote, QrCode, Wallet, Building2,
  Loader2, Bus, Clock, Calendar, ChevronRight, Truck, Route,
  CheckCircle2, AlertCircle, RotateCcw, Printer, Copy
} from 'lucide-react';
import { outletsApi, stopsApi, cargoTypesApi, cargoApi } from '@/lib/api';
import { fmtCurrency } from '@/lib/constants';
import { queryClient } from '@/lib/queryClient';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Stop, Outlet, CargoType, CargoAvailableTrip } from '@/types';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qr', label: 'QRIS', icon: QrCode },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
  { id: 'bank', label: 'Transfer', icon: Building2 },
];

const formatTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    });
  } catch { return '--:--'; }
};

const formatDateLabel = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  if (d.getTime() === today.getTime()) return 'Hari Ini';
  if (d.getTime() === tomorrow.getTime()) return 'Besok';
  if (d.getTime() === dayAfter.getTime()) return 'Lusa';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
};

const getDateStr = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

type TripWithTariff = CargoAvailableTrip & {
  date: string;
  tariff?: { found: boolean; calculatedAmount: number; pricePerKg: number; pricePerLeg: number; minCharge: number; legCount: number } | null;
};

function OutletSelector({ value, outlets, stops: stopsList, onChange }: {
  value: string;
  outlets: Outlet[];
  stops: Stop[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => { document.removeEventListener('mousedown', handler); clearTimeout(t); };
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const stopMap = useMemo(() => {
    const map: Record<string, Stop> = {};
    for (const s of stopsList) map[s.id] = s;
    return map;
  }, [stopsList]);

  const selectedOutlet = outlets.find(o => o.id === value);

  const filteredOutlets = useMemo(() => {
    if (!search.trim()) return outlets;
    const q = search.toLowerCase();
    return outlets.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (stopMap[o.stopId]?.city || '').toLowerCase().includes(q)
    );
  }, [outlets, search, stopMap]);

  const groupedByCity = useMemo(() => {
    const groups: Record<string, Outlet[]> = {};
    for (const o of filteredOutlets) {
      const city = stopMap[o.stopId]?.city || 'Lainnya';
      (groups[city] ??= []).push(o);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Lainnya') return 1;
      if (b === 'Lainnya') return -1;
      return a.localeCompare(b);
    });
  }, [filteredOutlets, stopMap]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-10 bg-white border rounded-xl px-3 flex items-center gap-2 text-sm transition-all ${
          open ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'
        }`}
        data-testid="select-cargo-outlet"
      >
        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className={selectedOutlet ? 'text-gray-800 font-medium truncate' : 'text-gray-400 truncate'}>
          {selectedOutlet ? selectedOutlet.name : 'Pilih outlet asal...'}
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari outlet..."
                className="w-full h-8 pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-200"
                data-testid="input-search-outlet"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48 p-1">
            {groupedByCity.map(([city, items]) => (
              <div key={city}>
                <div className="px-2 py-1 text-[10px] text-gray-400 uppercase font-semibold tracking-wider bg-background z-10 sticky top-0">{city}</div>
                {items.map(o => (
                  <button
                    key={o.id}
                    onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      o.id === value ? 'bg-amber-50 text-amber-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                    data-testid={`outlet-option-${o.id}`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            ))}
            {filteredOutlets.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400">Outlet tidak ditemukan</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CargoTerminalPage() {
  const [step, setStep] = useState(1);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [destinationStopId, setDestinationStopId] = useState('');
  const [cargoTypeId, setCargoTypeId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');
  const [notes, setNotes] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedTripKey, setSelectedTripKey] = useState('');
  const [selectedTripDate, setSelectedTripDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [createdShipment, setCreatedShipment] = useState<any>(null);

  const { data: outlets = [], isLoading: outletsLoading } = useQuery({
    queryKey: ['/api/outlets'],
    queryFn: outletsApi.getAll
  });

  const { data: allStops = [], isLoading: stopsLoading } = useQuery({
    queryKey: ['/api/stops'],
    queryFn: stopsApi.getAll
  });

  const { data: cargoTypes = [], isLoading: cargoTypesLoading } = useQuery<CargoType[]>({
    queryKey: ['/api/cargo-types'],
    queryFn: cargoTypesApi.getAll
  });

  const activeCargoTypes = useMemo(() =>
    cargoTypes.filter((ct: CargoType) => ct.isActive !== false),
    [cargoTypes]
  );

  const selectedOutlet = outlets.find((o: Outlet) => o.id === selectedOutletId);
  const originStop = allStops.find((s: Stop) => s.id === selectedOutlet?.stopId);
  const destinationStop = allStops.find((s: Stop) => s.id === destinationStopId);

  const destinationOptions = useMemo(() => {
    const stps = originStop
      ? allStops.filter((s: Stop) => s.id !== originStop.id)
      : allStops;
    return stps
      .sort((a: Stop, b: Stop) => (a.city || '').localeCompare(b.city || '') || a.name.localeCompare(b.name))
      .map((s: Stop) => ({
        value: s.id,
        label: s.name,
        badge: s.code,
        group: s.city || 'Lainnya'
      }));
  }, [allStops, originStop]);

  const dates3 = useMemo(() => [getDateStr(0), getDateStr(1), getDateStr(2)], []);

  const originStopId = originStop?.id;
  const tripsEnabled = !!originStopId && !!destinationStopId && !!cargoTypeId && itemDescription.trim().length >= 2;
  const { data: rawTripsDay0 = [], isLoading: loadingDay0, refetch: refetchDay0 } = useQuery<CargoAvailableTrip[]>({
    queryKey: ['/api/cargo/available-trips', dates3[0], originStopId, destinationStopId],
    queryFn: () => cargoApi.getAvailableTrips(dates3[0], originStopId!, destinationStopId),
    enabled: tripsEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: rawTripsDay1 = [], isLoading: loadingDay1, refetch: refetchDay1 } = useQuery<CargoAvailableTrip[]>({
    queryKey: ['/api/cargo/available-trips', dates3[1], originStopId, destinationStopId],
    queryFn: () => cargoApi.getAvailableTrips(dates3[1], originStopId!, destinationStopId),
    enabled: tripsEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: rawTripsDay2 = [], isLoading: loadingDay2, refetch: refetchDay2 } = useQuery<CargoAvailableTrip[]>({
    queryKey: ['/api/cargo/available-trips', dates3[2], originStopId, destinationStopId],
    queryFn: () => cargoApi.getAvailableTrips(dates3[2], originStopId!, destinationStopId),
    enabled: tripsEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const tripsLoading = loadingDay0 || loadingDay1 || loadingDay2;
  const refetchAllTrips = useCallback(() => {
    refetchDay0(); refetchDay1(); refetchDay2();
  }, [refetchDay0, refetchDay1, refetchDay2]);

  const tripsDay0 = useMemo(() => rawTripsDay0.filter(t => !t.isVirtual), [rawTripsDay0]);
  const tripsDay1 = useMemo(() => rawTripsDay1.filter(t => !t.isVirtual), [rawTripsDay1]);
  const tripsDay2 = useMemo(() => rawTripsDay2.filter(t => !t.isVirtual), [rawTripsDay2]);

  const {
    subscribeToTrip, unsubscribeFromTrip,
    subscribeToBase, unsubscribeFromBase,
    subscribeToCso, unsubscribeFromCso,
    addEventListener
  } = useWebSocket();

  const subscribedTripIdsRef = useRef<Set<string>>(new Set());
  const subscribedBaseIdsRef = useRef<Set<string>>(new Set());
  const subscribedCsoRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const allRaw = [...rawTripsDay0, ...rawTripsDay1, ...rawTripsDay2];
    const realTripIds = allRaw.filter(t => !t.isVirtual && t.tripId).map(t => t.tripId as string);
    const baseIds = [...new Set(allRaw.filter(t => t.baseId).map(t => t.baseId as string))];

    const prevTrips = subscribedTripIdsRef.current;
    const nextTrips = new Set(realTripIds);
    for (const id of Array.from(prevTrips)) {
      if (!nextTrips.has(id)) { unsubscribeFromTrip(id); prevTrips.delete(id); }
    }
    for (const id of Array.from(nextTrips)) {
      if (!prevTrips.has(id)) { subscribeToTrip(id); prevTrips.add(id); }
    }

    const prevBases = subscribedBaseIdsRef.current;
    const nextBases = new Set(baseIds);
    for (const id of Array.from(prevBases)) {
      if (!nextBases.has(id)) { unsubscribeFromBase(id); prevBases.delete(id); }
    }
    for (const id of Array.from(nextBases)) {
      if (!prevBases.has(id)) { subscribeToBase(id); prevBases.add(id); }
    }
  }, [rawTripsDay0, rawTripsDay1, rawTripsDay2, subscribeToTrip, unsubscribeFromTrip, subscribeToBase, unsubscribeFromBase]);

  useEffect(() => {
    if (!selectedOutletId) return;
    const prevCso = subscribedCsoRef.current;
    const nextCsoKeys = new Set(dates3.map(d => `${selectedOutletId}|${d}`));

    for (const key of Array.from(prevCso)) {
      if (!nextCsoKeys.has(key)) {
        const [o, d] = key.split('|');
        unsubscribeFromCso(o, d);
        prevCso.delete(key);
      }
    }
    for (const key of Array.from(nextCsoKeys)) {
      if (!prevCso.has(key)) {
        const [o, d] = key.split('|');
        subscribeToCso(o, d);
        prevCso.add(key);
      }
    }

    return () => {
      for (const key of Array.from(subscribedCsoRef.current)) {
        const [o, d] = key.split('|');
        unsubscribeFromCso(o, d);
      }
      subscribedCsoRef.current.clear();
      for (const id of Array.from(subscribedTripIdsRef.current)) unsubscribeFromTrip(id);
      subscribedTripIdsRef.current.clear();
      for (const id of Array.from(subscribedBaseIdsRef.current)) unsubscribeFromBase(id);
      subscribedBaseIdsRef.current.clear();
    };
  }, [selectedOutletId, dates3, subscribeToCso, unsubscribeFromCso, unsubscribeFromTrip, unsubscribeFromBase]);

  useEffect(() => {
    const currentTripIds = subscribedTripIdsRef.current;
    const handleInventoryUpdate = (data: { tripId: string }) => {
      if (currentTripIds.has(data.tripId)) refetchAllTrips();
    };
    const handleRefetch = () => refetchAllTrips();

    const r1 = addEventListener('INVENTORY_UPDATED', handleInventoryUpdate);
    const r2 = addEventListener('HOLDS_RELEASED', handleInventoryUpdate);
    const r3 = addEventListener('STOP_EXCEPTION_CHANGED', handleRefetch);
    const r4 = addEventListener('TRIP_MATERIALIZED', handleRefetch);
    const r5 = addEventListener('TRIP_STATUS_CHANGED', handleRefetch);

    return () => { r1(); r2(); r3(); r4(); r5(); };
  }, [addEventListener, refetchAllTrips]);

  const [tariffCache, setTariffCache] = useState<Record<string, any>>({});
  const groupedTrips = useMemo(() => {
    const now = new Date();
    const groups: { date: string; label: string; trips: TripWithTariff[] }[] = [];
    const rawByDate: [string, CargoAvailableTrip[]][] = [
      [dates3[0], tripsDay0],
      [dates3[1], tripsDay1],
      [dates3[2], tripsDay2],
    ];

    for (const [date, trips] of rawByDate) {
      const filtered = trips.filter(t => {
        if (t.status === 'canceled' || t.status === 'closed') return false;
        if (!t.departAtOrigin) return true;
        return new Date(t.departAtOrigin) > now;
      });
      if (filtered.length === 0) continue;
      groups.push({
        date,
        label: formatDateLabel(date),
        trips: filtered.map(t => {
          const key = `${t.tripId || t.baseId}-${date}`;
          return { ...t, date, tariff: tariffCache[key] };
        })
      });
    }
    return groups;
  }, [dates3, tripsDay0, tripsDay1, tripsDay2, tariffCache]);

  const selectedTrip = useMemo((): TripWithTariff | null => {
    if (!selectedTripKey || !selectedTripDate) return null;
    for (const group of groupedTrips) {
      if (group.date !== selectedTripDate) continue;
      const found = group.trips.find(t => (t.tripId || t.baseId) === selectedTripKey);
      if (found) {
        const key = `${selectedTripKey}-${selectedTripDate}`;
        return { ...found, tariff: tariffCache[key] };
      }
    }
    return null;
  }, [selectedTripKey, selectedTripDate, groupedTrips, tariffCache]);

  const fetchTariffForTrip = useCallback(async (trip: CargoAvailableTrip, date: string) => {
    if (!cargoTypeId || !originStopId || !destinationStopId) return;
    const w = parseFloat(weightKg) || 1;
    const tripId = trip.tripId;
    const result = await cargoApi.quoteTariff(cargoTypeId, originStopId, destinationStopId, w, tripId);
    const key = `${trip.tripId || trip.baseId}-${date}`;
    setTariffCache(prev => ({ ...prev, [key]: result }));
  }, [cargoTypeId, originStopId, destinationStopId, weightKg]);

  const showTripsPanel = !!(cargoTypeId && originStopId && destinationStopId && itemDescription.trim().length >= 2);

  useEffect(() => {
    if (!showTripsPanel && step !== 2) return;
    if (!cargoTypeId || !originStopId || !destinationStopId) return;
    const allTrips = [...tripsDay0, ...tripsDay1, ...tripsDay2];
    for (const t of allTrips) {
      const dateForTrip = tripsDay0.includes(t) ? dates3[0] : tripsDay1.includes(t) ? dates3[1] : dates3[2];
      const key = `${t.tripId || t.baseId}-${dateForTrip}`;
      if (!tariffCache[key]) {
        fetchTariffForTrip(t, dateForTrip);
      }
    }
  }, [step, showTripsPanel, tripsDay0, tripsDay1, tripsDay2, cargoTypeId, originStopId, destinationStopId, fetchTariffForTrip, dates3, tariffCache]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => cargoApi.create(data),
    onSuccess: (result) => {
      setCreatedShipment(result);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['/api/cargo'] });
    }
  });

  const canProceedStep1 = selectedOutletId && destinationStopId && cargoTypeId &&
    itemDescription.trim().length >= 2 && parseInt(quantity) > 0 &&
    senderName.trim().length >= 2 && senderPhone.trim().length >= 8 &&
    recipientName.trim().length >= 2 && recipientPhone.trim().length >= 8;

  const canProceedStep2 = !!selectedTrip;

  const tariffAmount = selectedTrip?.tariff?.found
    ? selectedTrip.tariff.calculatedAmount
    : 0;

  const canSubmit = canProceedStep2 && paymentMethod && tariffAmount > 0;

  const handleSubmit = () => {
    if (!canSubmit || !selectedTrip || !originStopId) return;

    const tripId = selectedTrip.tripId;
    if (!tripId) return;

    createMutation.mutate({
      tripId,
      originStopId,
      destinationStopId,
      outletId: selectedOutletId,
      cargoTypeId,
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      itemDescription: itemDescription.trim(),
      quantity: parseInt(quantity),
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      lengthCm: lengthCm ? parseFloat(lengthCm) : undefined,
      widthCm: widthCm ? parseFloat(widthCm) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
      totalAmount: String(tariffAmount),
      paymentMethod,
      notes: notes.trim() || undefined,
      channel: 'CSO',
      status: 'received',
    });
  };

  const resetForm = () => {
    setStep(1);
    setDestinationStopId('');
    setCargoTypeId('');
    setWeightKg('');
    setItemDescription('');
    setQuantity('1');
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setDeclaredValue('');
    setNotes('');
    setSenderName('');
    setSenderPhone('');
    setRecipientName('');
    setRecipientPhone('');
    setSelectedTripKey('');
    setSelectedTripDate('');
    setPaymentMethod('');
    setCreatedShipment(null);
    setTariffCache({});
  };

  const isLoading = outletsLoading || stopsLoading || cargoTypesLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <p className="text-xs text-gray-400 mt-2">Memuat data...</p>
      </div>
    );
  }

  const stepLabels = ['Data Kiriman', 'Pilih Jadwal', 'Pembayaran'];

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="cargo-terminal-page">
      <div className="flex items-center justify-between px-3 md:px-4 h-11 md:h-12 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-bold text-gray-800 hidden sm:inline">Cargo Terminal</span>
          {step <= 3 && stepLabels.map((label, idx) => {
            const s = idx + 1;
            const isActive = step === s;
            const isDone = step > s;
            return (
              <div key={idx} className="flex items-center gap-1">
                <ChevronRight className={`w-3 h-3 ${isDone ? 'text-emerald-400' : 'text-gray-300'}`} />
                <button
                  onClick={() => { if (isDone) setStep(s); }}
                  disabled={!isDone}
                  className={`text-[10px] md:text-xs font-medium px-1.5 py-0.5 rounded transition-colors ${
                    isActive ? 'text-amber-700 bg-amber-50 border border-amber-200' :
                    isDone ? 'text-emerald-600 hover:text-emerald-700 cursor-pointer' : 'text-gray-400'
                  }`}
                  data-testid={`step-${s}`}
                >
                  {isDone && <CheckCircle2 className="w-3 h-3 inline mr-0.5" />}
                  <span className="hidden md:inline">{label}</span>
                  <span className="md:hidden">{s}</span>
                </button>
              </div>
            );
          })}
          {step === 4 && (
            <>
              <ChevronRight className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-600">Selesai</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono hidden md:inline">
            {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {step <= 3 && originStop && destinationStop && (
        <div className="bg-amber-50 border-b border-amber-100 px-3 md:px-4 py-1.5 flex items-center gap-3 text-xs flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-emerald-700">{originStop.name}</span>
            <ArrowRight className="w-3 h-3 text-gray-400" />
            <span className="font-semibold text-rose-700">{destinationStop.name}</span>
          </div>
          {selectedTrip && (
            <>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1 text-amber-700">
                <Clock className="w-3 h-3" />
                <span className="font-medium">{formatTime(selectedTrip.departAtOrigin)}</span>
              </div>
              {tariffAmount > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-bold text-amber-800 font-mono">{fmtCurrency(tariffAmount)}</span>
                </>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {(step === 1 || step === 2) && (
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            <div className={`${step === 2 ? 'hidden lg:block' : ''} lg:w-[420px] xl:w-[460px] lg:border-r lg:border-gray-200 overflow-y-auto flex-shrink-0`}>
              <div className="p-3 md:p-4 space-y-3">
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-gray-700">Rute Pengiriman</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Outlet Asal *</label>
                    <OutletSelector
                      value={selectedOutletId}
                      outlets={outlets}
                      stops={allStops}
                      onChange={(id) => {
                        setSelectedOutletId(id);
                        setDestinationStopId('');
                      }}
                    />
                    {originStop && (
                      <div className="mt-1 text-[10px] text-gray-400 truncate">
                        {originStop.name} — {originStop.city}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Tujuan Pengiriman *</label>
                    <SearchableSelect
                      value={destinationStopId}
                      options={destinationOptions}
                      placeholder="Pilih kota tujuan..."
                      searchPlaceholder="Cari kota/halte..."
                      onChange={setDestinationStopId}
                      data-testid="select-cargo-destination"
                    />
                    {destinationStop && (
                      <div className="mt-1 text-[10px] text-gray-400 truncate">
                        {destinationStop.city}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-semibold text-gray-700">Pengirim</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-[2]">
                      <input
                        value={senderName}
                        onChange={e => setSenderName(e.target.value)}
                        placeholder="Nama pengirim *"
                        className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                        data-testid="input-sender-name"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        value={senderPhone}
                        onChange={e => setSenderPhone(e.target.value)}
                        placeholder="Telepon *"
                        className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                        data-testid="input-sender-phone"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700">Penerima</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-[2]">
                      <input
                        value={recipientName}
                        onChange={e => setRecipientName(e.target.value)}
                        placeholder="Nama penerima *"
                        className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-recipient-name"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        value={recipientPhone}
                        onChange={e => setRecipientPhone(e.target.value)}
                        placeholder="Telepon *"
                        className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-recipient-phone"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700">Detail Barang</span>
                </div>
                <div className="space-y-2">
                  {activeCargoTypes.length > 0 && (
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Jenis Kargo *</label>
                      <SearchableSelect
                        value={cargoTypeId}
                        options={activeCargoTypes.map((ct: CargoType) => ({ value: ct.id, label: ct.name, badge: ct.code }))}
                        placeholder="Pilih jenis..."
                        searchPlaceholder="Cari jenis kargo..."
                        onChange={setCargoTypeId}
                        data-testid="select-cargo-type"
                      />
                    </div>
                  )}
                  <input
                    value={itemDescription}
                    onChange={e => setItemDescription(e.target.value)}
                    placeholder="Deskripsi barang *"
                    className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                    data-testid="input-item-description"
                  />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        placeholder="Jml"
                        className="w-full h-8 pl-7 pr-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                        data-testid="input-quantity"
                      />
                    </div>
                    <div className="relative flex-1">
                      <Weight className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        step="0.1"
                        value={weightKg}
                        onChange={e => setWeightKg(e.target.value)}
                        placeholder="Berat (kg)"
                        className="w-full h-8 pl-7 pr-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                        data-testid="input-weight"
                      />
                    </div>
                    <div className="relative flex-1">
                      <Ruler className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        step="0.1"
                        value={lengthCm}
                        onChange={e => setLengthCm(e.target.value)}
                        placeholder="P (cm)"
                        className="w-full h-8 pl-7 pr-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                        data-testid="input-length"
                      />
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={widthCm}
                      onChange={e => setWidthCm(e.target.value)}
                      placeholder="L (cm)"
                      className="w-16 h-8 px-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                      data-testid="input-width"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={heightCm}
                      onChange={e => setHeightCm(e.target.value)}
                      placeholder="T (cm)"
                      className="w-16 h-8 px-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                      data-testid="input-height"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ShieldCheck className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        value={declaredValue}
                        onChange={e => setDeclaredValue(e.target.value)}
                        placeholder="Nilai barang (Rp, opsional)"
                        className="w-full h-8 pl-7 pr-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                        data-testid="input-declared-value"
                      />
                    </div>
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Catatan (opsional)"
                      className="flex-1 h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-200 focus:border-amber-300"
                      data-testid="input-notes"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end lg:hidden">
                <button
                  onClick={() => { setTariffCache({}); setStep(2); }}
                  disabled={!canProceedStep1}
                  className="h-9 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="btn-next-step-1"
                >
                  Cari Jadwal
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {selectedTrip && (
                <div className="hidden lg:block border border-amber-200 rounded-xl p-3 bg-amber-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs min-w-0">
                      <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span className="font-bold">{formatTime(selectedTrip.departAtOrigin)}</span>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className="font-bold">{formatTime(selectedTrip.arriveAtDestination)}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{selectedTrip.patternCode} — {formatDateLabel(selectedTrip.date)}</p>
                      {selectedTrip.tariff?.found && (
                        <div className="text-sm font-black text-amber-700 font-mono mt-1">{fmtCurrency(selectedTrip.tariff.calculatedAmount)}</div>
                      )}
                    </div>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!canProceedStep1}
                      className="h-9 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      data-testid="btn-desktop-proceed"
                    >
                      Lanjut Pembayaran
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {!selectedTrip && showTripsPanel && !tripsLoading && groupedTrips.length > 0 && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-600">
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Pilih jadwal di panel kanan untuk melanjutkan</span>
                </div>
              )}

              {!selectedTrip && showTripsPanel && !tripsLoading && groupedTrips.length === 0 && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Tidak ada trip tersedia untuk rute ini. Coba ubah tujuan pengiriman.</span>
                </div>
              )}
            </div>
            </div>

            <div className={`${step === 1 ? 'hidden lg:flex' : 'flex'} flex-1 flex-col overflow-y-auto bg-gray-50/50`}>
              <div className="p-3 md:p-4 space-y-3 flex-1">
                {step === 2 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-2.5 lg:hidden">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                      <span><span className="text-gray-400">Barang:</span> <span className="font-medium">{itemDescription}</span></span>
                      <span><span className="text-gray-400">Jumlah:</span> <span className="font-medium">{quantity} koli</span></span>
                      {weightKg && <span><span className="text-gray-400">Berat:</span> <span className="font-medium">{weightKg} kg</span></span>}
                      <span><span className="text-gray-400">Pengirim:</span> <span className="font-medium">{senderName}</span></span>
                    </div>
                  </div>
                )}

                {!showTripsPanel && step === 1 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm text-gray-400 font-medium">Isi data kiriman terlebih dahulu</p>
                    <p className="text-[11px] text-gray-300 mt-1">Pilih outlet, tujuan, dan isi detail barang</p>
                  </div>
                )}

                {(showTripsPanel || step === 2) && tripsLoading && (
                  <div className="flex flex-col items-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <p className="text-xs text-gray-400 mt-2">Mencari jadwal 3 hari ke depan...</p>
                  </div>
                )}

                {(showTripsPanel || step === 2) && !tripsLoading && groupedTrips.length === 0 && (
                  <div className="flex flex-col items-center py-12 text-center">
                    <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Tidak ada jadwal tersedia</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Tidak ada trip yang melewati rute ini dalam 3 hari ke depan</p>
                  </div>
                )}

                {(showTripsPanel || step === 2) && !tripsLoading && groupedTrips.map(group => (
                  <div key={group.date} data-testid={`trip-group-${group.date}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-bold text-gray-700">{group.label}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(group.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{group.trips.length} trip</span>
                    </div>
                    <div className="space-y-2 mb-4" data-testid="trip-list">
                      {group.trips.map((trip, idx) => {
                        const tripKey = `${trip.tripId || trip.baseId}-${trip.date}`;
                        const isSelected = selectedTripKey === trip.tripId && selectedTripDate === trip.date;
                        const tariff = trip.tariff;
                        return (
                          <button
                            key={tripKey + idx}
                            onClick={() => {
                              setSelectedTripKey(trip.tripId ?? '');
                              setSelectedTripDate(trip.date);
                            }}
                            className={`w-full text-left border rounded-xl p-3 transition-all ${
                              isSelected
                                ? 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-200 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-amber-200 hover:shadow-sm'
                            }`}
                            data-testid={`trip-card-${tripKey}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-amber-100' : 'bg-gray-100'
                                }`}>
                                  <Bus className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-gray-500'}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-bold text-gray-800">{formatTime(trip.departAtOrigin)}</span>
                                    <ArrowRight className="w-3 h-3 text-gray-400" />
                                    <span className="text-sm font-bold text-gray-800">{formatTime(trip.arriveAtDestination)}</span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 mt-0.5">{trip.patternCode} — {trip.patternPath}</p>
                                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                                    {trip.vehicle && (
                                      <span className="flex items-center gap-1">
                                        <Truck className="w-3 h-3" />
                                        {trip.vehicle.plate}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Route className="w-3 h-3" />
                                      {trip.legCount} leg
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {tariff?.found ? (
                                  <div className="text-sm font-black text-amber-700 font-mono">{fmtCurrency(tariff.calculatedAmount)}</div>
                                ) : tariff && !tariff.found ? (
                                  <div className="text-[11px] text-red-500 font-medium">Tarif belum diatur</div>
                                ) : (
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
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

              {(showTripsPanel || step === 2) && selectedTrip && (
                <div className="border-t border-gray-200 bg-white px-3 md:px-4 py-2.5 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3 text-xs min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span className="font-bold text-gray-800">{formatTime(selectedTrip.departAtOrigin)}</span>
                      <ArrowRight className="w-3 h-3 text-gray-300" />
                      <span className="font-bold text-gray-800">{formatTime(selectedTrip.arriveAtDestination)}</span>
                    </div>
                    {selectedTrip.tariff?.found && (
                      <span className="font-black text-amber-700 font-mono">{fmtCurrency(selectedTrip.tariff.calculatedAmount)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!canProceedStep1}
                    className="h-9 px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="btn-next-step-2"
                  >
                    Lanjut Pembayaran
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="border-t border-gray-200 bg-white px-3 py-2 lg:hidden flex-shrink-0">
                  <button
                    onClick={() => setStep(1)}
                    className="h-9 px-4 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                    data-testid="btn-back-step2"
                  >
                    Kembali
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-3 md:p-4 space-y-3">
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Ringkasan Pengiriman</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Rute</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-emerald-600">{originStop?.name}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-semibold text-rose-600">{destinationStop?.name}</span>
                      </div>
                    </div>
                    {selectedTrip && (
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Jadwal</span>
                        <div className="flex items-center gap-1.5 text-gray-800 font-medium">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatTime(selectedTrip.departAtOrigin)} — {formatTime(selectedTrip.arriveAtDestination)}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {formatDateLabel(selectedTrip.date)} ({new Date(selectedTrip.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })})
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Pengirim</span>
                      <span className="text-gray-800 font-medium">{senderName}</span>
                      <span className="text-gray-500 block">{senderPhone}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Penerima</span>
                      <span className="text-gray-800 font-medium">{recipientName}</span>
                      <span className="text-gray-500 block">{recipientPhone}</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Barang</span>
                      <span className="text-gray-800 font-medium">{itemDescription}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Jumlah / Berat</span>
                      <span className="text-gray-800 font-medium">{quantity} koli {weightKg ? `/ ${weightKg} kg` : ''}</span>
                    </div>
                    {selectedTrip?.vehicle && (
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Kendaraan</span>
                        <span className="text-gray-800 font-medium">{selectedTrip.vehicle.plate}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                <h3 className="text-sm font-bold text-gray-800">Biaya Pengiriman</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xl font-black text-amber-700 font-mono" data-testid="text-tariff-amount">
                      {tariffAmount > 0 ? fmtCurrency(tariffAmount) : 'Tarif tidak tersedia'}
                    </div>
                  </div>
                  {selectedTrip?.tariff?.found && (
                    <div className="text-right text-[10px] text-gray-500 space-y-0.5">
                      <div>Rp {Number(selectedTrip.tariff.pricePerKg).toLocaleString('id-ID')}/kg x {weightKg || '1'} kg</div>
                      {Number(selectedTrip.tariff.pricePerLeg) > 0 && (
                        <div>+ Rp {Number(selectedTrip.tariff.pricePerLeg).toLocaleString('id-ID')}/leg x {selectedTrip.tariff.legCount}</div>
                      )}
                      {Number(selectedTrip.tariff.minCharge) > 0 && (
                        <div>Min. charge: Rp {Number(selectedTrip.tariff.minCharge).toLocaleString('id-ID')}</div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Metode Pembayaran</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_METHODS.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setPaymentMethod(m.id)}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            paymentMethod === m.id
                              ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-200'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                          data-testid={`btn-pay-${m.id}`}
                        >
                          <Icon className={`w-5 h-5 mx-auto mb-1 ${paymentMethod === m.id ? 'text-amber-600' : 'text-gray-400'}`} />
                          <span className={`text-[11px] font-medium ${paymentMethod === m.id ? 'text-amber-700' : 'text-gray-500'}`}>
                            {m.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {createMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                    Gagal membuat resi: {(createMutation.error as Error)?.message || 'Terjadi kesalahan'}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="h-10 px-4 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                  data-testid="btn-back-step3"
                >
                  Kembali
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || createMutation.isPending}
                  className="h-11 px-8 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="btn-submit-cargo"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                  Buat Resi
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && createdShipment && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-lg mx-auto p-4 md:p-6 space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800" data-testid="text-success-title">Resi Berhasil Dibuat!</h2>
                <p className="text-sm text-gray-500 mt-1">Pengiriman telah tercatat dalam sistem</p>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Nomor Resi</div>
                    <div className="text-lg font-black text-amber-800 font-mono tracking-wider" data-testid="text-waybill">
                      {createdShipment.waybillNumber}
                    </div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(createdShipment.waybillNumber)}
                    className="h-8 px-3 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-600 flex items-center gap-1.5 transition-colors"
                    data-testid="btn-copy-waybill"
                  >
                    <Copy className="w-3 h-3" />
                    Salin
                  </button>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Rute</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-emerald-600">{originStop?.name}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-semibold text-rose-600">{destinationStop?.name}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Total Biaya</span>
                      <span className="text-base font-black text-amber-700 font-mono">{fmtCurrency(parseFloat(createdShipment.totalAmount))}</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Pengirim</span>
                      <span className="text-gray-800 font-medium">{createdShipment.senderName}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Penerima</span>
                      <span className="text-gray-800 font-medium">{createdShipment.recipientName}</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Barang</span>
                    <span className="text-gray-800 font-medium">{createdShipment.itemDescription} — {createdShipment.quantity} koli</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetForm}
                  className="flex-1 h-11 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                  data-testid="btn-new-shipment"
                >
                  <RotateCcw className="w-4 h-4" />
                  Kirim Baru
                </button>
                <button
                  className="flex-1 h-11 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  data-testid="btn-print-waybill"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Resi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-3 md:px-4 py-1.5 flex items-center justify-between text-[10px] text-gray-400 flex-shrink-0">
        <span>Cargo Terminal v2.0</span>
        {originStop && destinationStop && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-600">{originStop.name}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium text-gray-600">{destinationStop.name}</span>
            {tariffAmount > 0 && (
              <>
                <span className="mx-1">|</span>
                <span className="font-mono font-medium text-amber-600">{fmtCurrency(tariffAmount)}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
