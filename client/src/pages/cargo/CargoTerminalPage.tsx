import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package, MapPin, Search, ArrowRight, Weight, Hash, Ruler,
  ShieldCheck, User, Phone, Banknote, QrCode, Wallet, Building2,
  Loader2, Bus, Clock, Calendar, ChevronRight, Truck, Route,
  CheckCircle2, X, AlertCircle, Send
} from 'lucide-react';
import { outletsApi, stopsApi, cargoTypesApi } from '@/lib/api';
import { fmtCurrency } from '@/lib/constants';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { Stop, Outlet, CargoType } from '@/types';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qr', label: 'QRIS', icon: QrCode },
  { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
  { id: 'bank', label: 'Transfer', icon: Building2 },
];

const STEP_LABELS = ['Tujuan & Barang', 'Pilih Jadwal', 'Pembayaran'];

interface MockTrip {
  id: string;
  patternName: string;
  departureTime: string;
  arrivalTime: string;
  vehiclePlate: string;
  vehicleName: string;
  availableCapacity: number;
  estimatedCost: number;
  legs: number;
  isVirtual: boolean;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1" data-testid="step-indicator">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;
        return (
          <div key={idx} className="flex items-center gap-1">
            {idx > 0 && (
              <ChevronRight className={`w-3 h-3 ${isDone ? 'text-emerald-400' : 'text-gray-300'}`} />
            )}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isActive
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : isDone
                  ? 'text-emerald-600'
                  : 'text-gray-400'
            }`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {isDone ? <CheckCircle2 className="w-3 h-3" /> : stepNum}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutletSelector({ value, outlets, stops, onChange }: {
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
    for (const s of stops) map[s.id] = s;
    return map;
  }, [stops]);

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
          open ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'
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
                className="w-full h-8 pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
                data-testid="input-search-outlet"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48 p-1">
            {groupedByCity.map(([city, items]) => (
              <div key={city}>
                <div className="px-2 py-1 text-[10px] text-gray-400 uppercase font-semibold tracking-wider">{city}</div>
                {items.map(o => (
                  <button
                    key={o.id}
                    onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      o.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
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
  const [selectedTripId, setSelectedTripId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

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
    const stops = originStop
      ? allStops.filter((s: Stop) => s.id !== originStop.id)
      : allStops;
    return stops
      .sort((a: Stop, b: Stop) => (a.city || '').localeCompare(b.city || '') || a.name.localeCompare(b.name))
      .map((s: Stop) => ({
        value: s.id,
        label: s.name,
        badge: s.code,
        group: s.city || 'Lainnya'
      }));
  }, [allStops, originStop]);

  const mockTrips: MockTrip[] = useMemo(() => {
    if (!selectedOutletId || !destinationStopId) return [];
    return [
      {
        id: 'mock-1',
        patternName: `${originStop?.city || 'Asal'} → ${destinationStop?.city || 'Tujuan'}`,
        departureTime: '06:00',
        arrivalTime: '12:00',
        vehiclePlate: 'B 1234 XX',
        vehicleName: 'Bus Eksekutif',
        availableCapacity: 15,
        estimatedCost: 75000,
        legs: 3,
        isVirtual: true,
      },
      {
        id: 'mock-2',
        patternName: `${originStop?.city || 'Asal'} → ${destinationStop?.city || 'Tujuan'}`,
        departureTime: '10:00',
        arrivalTime: '16:00',
        vehiclePlate: 'B 5678 YY',
        vehicleName: 'Bus Bisnis',
        availableCapacity: 22,
        estimatedCost: 60000,
        legs: 4,
        isVirtual: false,
      },
      {
        id: 'mock-3',
        patternName: `${originStop?.city || 'Asal'} → ${destinationStop?.city || 'Tujuan'}`,
        departureTime: '14:00',
        arrivalTime: '20:00',
        vehiclePlate: 'B 9012 ZZ',
        vehicleName: 'Bus Ekonomi Plus',
        availableCapacity: 8,
        estimatedCost: 50000,
        legs: 5,
        isVirtual: false,
      },
    ];
  }, [selectedOutletId, destinationStopId, originStop, destinationStop]);

  const selectedMockTrip = mockTrips.find(t => t.id === selectedTripId);

  const canProceedStep1 = selectedOutletId && destinationStopId && itemDescription.trim().length >= 2 &&
    parseInt(quantity) > 0 && senderName.trim().length >= 2 && senderPhone.trim().length >= 10 &&
    recipientName.trim().length >= 2 && recipientPhone.trim().length >= 10;

  const canProceedStep2 = !!selectedTripId;

  const canSubmit = canProceedStep2 && paymentMethod && parseFloat(totalAmount) > 0;

  const isLoading = outletsLoading || stopsLoading || cargoTypesLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p className="text-xs text-gray-400 mt-2">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="cargo-terminal-page">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Send className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800" data-testid="page-title">Kirim Kargo</h1>
            <p className="text-[10px] text-gray-400">Terminal pengiriman cepat</p>
          </div>
        </div>
        <StepIndicator currentStep={step} />
      </div>

      <div className="flex-1 overflow-hidden flex">
        {step === 1 && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
              <div className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-800">Rute Pengiriman</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">Outlet Asal</label>
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
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>Stop: <span className="font-medium text-gray-600">{originStop.name}</span> — {originStop.city}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">Tujuan Pengiriman</label>
                    <SearchableSelect
                      value={destinationStopId}
                      options={destinationOptions}
                      placeholder="Pilih kota tujuan..."
                      searchPlaceholder="Cari kota/halte..."
                      onChange={setDestinationStopId}
                      data-testid="select-cargo-destination"
                    />
                    {destinationStop && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>{destinationStop.city}</span>
                      </div>
                    )}
                  </div>
                </div>
                {originStop && destinationStop && (
                  <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-emerald-600">{originStop.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-rose-600">{destinationStop.name}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/50">
                  <div className="flex items-center gap-1.5 mb-3">
                    <User className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-gray-700">Pengirim</h3>
                  </div>
                  <div className="space-y-2">
                    <input
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      placeholder="Nama pengirim *"
                      className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                      data-testid="input-sender-name"
                    />
                    <div className="relative">
                      <Phone className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={senderPhone}
                        onChange={e => setSenderPhone(e.target.value)}
                        placeholder="Telepon pengirim *"
                        className="w-full h-9 pl-8 pr-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-sender-phone"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50">
                  <div className="flex items-center gap-1.5 mb-3">
                    <User className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-700">Penerima</h3>
                  </div>
                  <div className="space-y-2">
                    <input
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="Nama penerima *"
                      className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                      data-testid="input-recipient-name"
                    />
                    <div className="relative">
                      <Phone className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={recipientPhone}
                        onChange={e => setRecipientPhone(e.target.value)}
                        placeholder="Telepon penerima *"
                        className="w-full h-9 pl-8 pr-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-recipient-phone"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-1.5 mb-3">
                  <Package className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-bold text-gray-700">Detail Barang</h3>
                </div>
                <div className="space-y-3">
                  {activeCargoTypes.length > 0 && (
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Jenis Kargo</label>
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
                  <div>
                    <input
                      value={itemDescription}
                      onChange={e => setItemDescription(e.target.value)}
                      placeholder="Deskripsi barang *"
                      className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                      data-testid="input-item-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="relative">
                      <Hash className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        placeholder="Jumlah"
                        className="w-full h-9 pl-8 pr-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-quantity"
                      />
                    </div>
                    <div className="relative">
                      <Weight className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        step="0.1"
                        value={weightKg}
                        onChange={e => setWeightKg(e.target.value)}
                        placeholder="Berat (kg)"
                        className="w-full h-9 pl-8 pr-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-weight"
                      />
                    </div>
                    <div className="relative">
                      <Ruler className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        step="0.1"
                        value={lengthCm}
                        onChange={e => setLengthCm(e.target.value)}
                        placeholder="P (cm)"
                        className="w-full h-9 pl-8 pr-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-length"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={widthCm}
                        onChange={e => setWidthCm(e.target.value)}
                        placeholder="L (cm)"
                        className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-width"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={heightCm}
                        onChange={e => setHeightCm(e.target.value)}
                        placeholder="T (cm)"
                        className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-height"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="relative">
                      <ShieldCheck className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        value={declaredValue}
                        onChange={e => setDeclaredValue(e.target.value)}
                        placeholder="Nilai barang (Rp, opsional)"
                        className="w-full h-9 pl-8 pr-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                        data-testid="input-declared-value"
                      />
                    </div>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Catatan (opsional)"
                      rows={1}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 resize-none"
                      data-testid="input-notes"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="btn-next-step-1"
                >
                  Cari Jadwal
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-800" data-testid="text-schedule-title">Jadwal Tersedia</h2>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
                    <span className="font-medium text-emerald-600">{originStop?.name}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-medium text-rose-600">{destinationStop?.name}</span>
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  data-testid="btn-back-step-1"
                >
                  <X className="w-3 h-3" />
                  Ubah Data
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                  <span><span className="text-gray-400">Barang:</span> <span className="font-medium">{itemDescription}</span></span>
                  <span><span className="text-gray-400">Jumlah:</span> <span className="font-medium">{quantity} koli</span></span>
                  {weightKg && <span><span className="text-gray-400">Berat:</span> <span className="font-medium">{weightKg} kg</span></span>}
                  <span><span className="text-gray-400">Pengirim:</span> <span className="font-medium">{senderName}</span></span>
                  <span><span className="text-gray-400">Penerima:</span> <span className="font-medium">{recipientName}</span></span>
                </div>
              </div>

              <div className="space-y-2" data-testid="trip-list">
                {mockTrips.map(trip => (
                  <button
                    key={trip.id}
                    onClick={() => {
                      setSelectedTripId(trip.id);
                      setTotalAmount(String(trip.estimatedCost));
                    }}
                    className={`w-full text-left border rounded-xl p-4 transition-all ${
                      selectedTripId === trip.id
                        ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-200 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                    data-testid={`trip-card-${trip.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          selectedTripId === trip.id ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Bus className={`w-5 h-5 ${selectedTripId === trip.id ? 'text-blue-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{trip.departureTime}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="text-sm font-bold text-gray-800">{trip.arrivalTime}</span>
                            {trip.isVirtual && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded font-medium">Virtual</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{trip.patternName}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {trip.vehiclePlate} — {trip.vehicleName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Route className="w-3 h-3" />
                              {trip.legs} leg
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-black text-blue-700 font-mono">{fmtCurrency(trip.estimatedCost)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">est. biaya kirim</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {mockTrips.length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Tidak ada jadwal tersedia</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Coba ubah rute atau tanggal pengiriman</p>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="h-10 px-4 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                  data-testid="btn-back-step2"
                >
                  Kembali
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="btn-next-step-2"
                >
                  Lanjut Pembayaran
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800" data-testid="text-payment-title">Konfirmasi & Pembayaran</h2>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  data-testid="btn-back-step-2"
                >
                  <X className="w-3 h-3" />
                  Ubah Jadwal
                </button>
              </div>

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
                    {selectedMockTrip && (
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Jadwal</span>
                        <div className="flex items-center gap-1.5 text-gray-800 font-medium">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {selectedMockTrip.departureTime} — {selectedMockTrip.arrivalTime}
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
                    {selectedMockTrip && (
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Kendaraan</span>
                        <span className="text-gray-800 font-medium">{selectedMockTrip.vehiclePlate}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                <h3 className="text-sm font-bold text-gray-800">Biaya Pengiriman</h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Total Biaya *</label>
                    <input
                      type="number"
                      value={totalAmount}
                      onChange={e => setTotalAmount(e.target.value)}
                      placeholder="Masukkan biaya..."
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                      data-testid="input-total-amount"
                    />
                  </div>
                  {parseFloat(totalAmount) > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
                      <span className="text-xl font-black text-blue-700 font-mono">{fmtCurrency(parseFloat(totalAmount))}</span>
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
                              ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                          data-testid={`btn-pay-${m.id}`}
                        >
                          <Icon className={`w-5 h-5 mx-auto mb-1 ${paymentMethod === m.id ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className={`text-[11px] font-medium ${paymentMethod === m.id ? 'text-blue-700' : 'text-gray-500'}`}>
                            {m.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                  disabled={!canSubmit}
                  className="h-11 px-8 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="btn-submit-cargo"
                >
                  <Package className="w-4 h-4" />
                  Buat Resi & Cetak
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-4 py-1.5 flex items-center justify-between text-[10px] text-gray-400 flex-shrink-0">
        <span>Cargo Terminal v1.0</span>
        {originStop && destinationStop && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-600">{originStop.name}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium text-gray-600">{destinationStop.name}</span>
            {selectedMockTrip && (
              <>
                <span className="mx-1">|</span>
                <span className="font-mono font-medium text-blue-600">{fmtCurrency(parseFloat(totalAmount) || selectedMockTrip.estimatedCost)}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
