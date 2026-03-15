import { useState, type ComponentType } from "react";
import {
  MapPin, Calendar, Clock, Bus, Users, CreditCard, Printer,
  ChevronRight, Check, Timer, ArrowRight, ArrowDown,
  Armchair, RotateCcw, QrCode, Banknote, Wallet, Building2,
  Circle, Store, Ticket, CheckCircle2, X, List,
  LayoutGrid, Route, DollarSign, Truck,
  type LucideProps
} from "lucide-react";

type LucideIcon = ComponentType<LucideProps>;

const MOCK_TRIPS = [
  { id: "1", route: "Jakarta \u2192 Bandung", depart: "06:00", arrive: "09:30", vehicle: "BUS-001", seats: 32, available: 24, status: "active" as const, stops: ["Jakarta Terminal", "Purwakarta", "Bandung Terminal"], price: 75000 },
  { id: "2", route: "Jakarta \u2192 Bandung", depart: "08:30", arrive: "12:00", vehicle: "BUS-003", seats: 40, available: 8, status: "active" as const, stops: ["Jakarta Terminal", "Purwakarta", "Bandung Terminal"], price: 75000 },
  { id: "3", route: "Jakarta \u2192 Semarang", depart: "07:00", arrive: "14:00", vehicle: "BUS-005", seats: 40, available: 36, status: "active" as const, stops: ["Jakarta Terminal", "Cirebon", "Pekalongan", "Semarang"], price: 120000 },
  { id: "4", route: "Jakarta \u2192 Semarang", depart: "20:00", arrive: "03:00", vehicle: "TBD", seats: 40, available: 40, status: "virtual" as const, stops: ["Jakarta Terminal", "Cirebon", "Pekalongan", "Semarang"], price: 120000 },
];

const SEAT_LAYOUT: (string | null)[][] = [
  ["1A","1B",null,"1C","1D"],
  ["2A","2B",null,"2C","2D"],
  ["3A","3B",null,"3C","3D"],
  ["4A","4B",null,"4C","4D"],
  ["5A","5B",null,"5C","5D"],
  ["6A","6B",null,"6C","6D"],
  ["7A","7B",null,"7C","7D"],
  ["8A","8B",null,"8C","8D"],
  ["9A","9B",null,"9C","9D"],
  ["10A","10B",null,"10C","10D"],
];

const BOOKED_SEATS = new Set(["1A","2C","3B","4D","5A","5B","7C","8D","9C","10A"]);
const HELD_SEATS = new Set(["2A","6D"]);
const HELD_SEAT_TIMERS: Record<string, number> = { "2A": 182, "6D": 47 };

type Phase = "select" | "book";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const NAV_SECTIONS: { title: string; items: { name: string; icon: LucideIcon; active?: boolean }[] }[] = [
  {
    title: "OPERATIONS",
    items: [
      { name: "Reservasi", icon: Ticket, active: true },
      { name: "All Bookings", icon: List },
    ],
  },
  {
    title: "MASTERS",
    items: [
      { name: "Stops", icon: MapPin },
      { name: "Outlets", icon: Store },
      { name: "Vehicles", icon: Truck },
      { name: "Layouts", icon: LayoutGrid },
      { name: "Trip Patterns", icon: Route },
      { name: "Trips", icon: Calendar },
      { name: "Price Rules", icon: DollarSign },
    ],
  },
];

function AppSidebar() {
  return (
    <div className="w-52 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-full">
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Bus className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800 leading-tight">Transity</h1>
            <p className="text-[10px] text-gray-400">Multi-Stop Travel System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {NAV_SECTIONS.map(section => (
          <div key={section.title} className="mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.name}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      item.active
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    }`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${item.active ? "text-blue-600" : "text-gray-400"}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 px-2">Demo Transport</p>
        <p className="text-[10px] text-gray-300 px-2">Version: 1.0.0-MVP</p>
      </div>
    </div>
  );
}

function TripCard({ trip, isSelected, onSelect }: {
  trip: typeof MOCK_TRIPS[0]; isSelected: boolean; onSelect: () => void;
}) {
  const seatPct = Math.round((trip.available / trip.seats) * 100);
  return (
    <button onClick={onSelect} data-testid={`trip-card-${trip.id}`}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
        isSelected
          ? "bg-blue-50 border-blue-400 ring-1 ring-blue-200"
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900 font-mono tracking-tight">{trip.depart}</span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm text-gray-500 font-mono">{trip.arrive}</span>
        </div>
        {trip.status === "virtual" ? (
          <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md text-[10px] font-semibold">Jadwal Virtual</span>
        ) : (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-semibold">Aktif</span>
        )}
      </div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          {trip.stops.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-emerald-500" : i === trip.stops.length - 1 ? "bg-rose-500" : "bg-gray-400"}`} />
              <span className="text-[10px] text-gray-500 max-w-[55px] truncate">{s.replace(" Terminal", "")}</span>
              {i < trip.stops.length - 1 && <span className="text-gray-300 text-[10px] mx-0.5">\u203a</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><Bus className="w-3 h-3" />{trip.vehicle}</span>
          <span className={`flex items-center gap-1 font-medium ${trip.available > 10 ? "text-emerald-600" : trip.available > 0 ? "text-amber-600" : "text-red-600"}`}>
            <Armchair className="w-3 h-3" />{trip.available}/{trip.seats}
          </span>
        </div>
        <span className="text-xs font-bold text-gray-700 font-mono">{fmt(trip.price)}</span>
      </div>
      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${seatPct > 50 ? "bg-emerald-400" : seatPct > 20 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${seatPct}%` }} />
      </div>
    </button>
  );
}

function RouteTimeline({ stops, origin, destination, onOriginSelect, onDestinationSelect }: {
  stops: string[]; origin?: string; destination?: string;
  onOriginSelect: (s: string) => void; onDestinationSelect: (s: string) => void;
}) {
  const times = ["06:00", "07:15", "08:00", "09:30"];
  const distances = ["85 km", "45 km", "120 km"];
  const originIdx = origin ? stops.indexOf(origin) : -1;
  const destIdx = destination ? stops.indexOf(destination) : -1;
  const legCount = originIdx >= 0 && destIdx > originIdx ? destIdx - originIdx : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Pilih Rute</h3>
        <span className="text-[10px] text-gray-400">{stops.length} pemberhentian</span>
      </div>

      <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2">
        <p className="text-[11px] text-blue-700">Klik <span className="font-bold text-emerald-600">Naik</span> untuk titik keberangkatan, <span className="font-bold text-rose-600">Turun</span> untuk tujuan</p>
      </div>

      <div className="relative pl-5">
        <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-400 via-gray-200 to-rose-400" />
        {stops.map((stop, i) => {
          const isFirst = i === 0;
          const isLast = i === stops.length - 1;
          const isOrigin = origin === stop;
          const isDest = destination === stop;
          const time = times[i] || "--:--";
          return (
            <div key={stop}>
              <div className="relative flex items-start gap-3 pb-1.5">
                <div className={`absolute left-[-13px] w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 ${
                  isOrigin ? "bg-emerald-500 border-emerald-500 ring-2 ring-emerald-200" :
                  isDest ? "bg-rose-500 border-rose-500 ring-2 ring-rose-200" :
                  isFirst ? "bg-emerald-400 border-emerald-400" :
                  isLast ? "bg-rose-400 border-rose-400" :
                  "bg-white border-gray-300"
                }`}>
                  {(isOrigin || isDest) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${isOrigin || isDest ? "text-gray-900" : "text-gray-600"}`}>{stop}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{time}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {!isLast && (
                        <button onClick={() => onOriginSelect(stop)} data-testid={`naik-${i}`}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            isOrigin ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600"
                          }`}>Naik</button>
                      )}
                      {!isFirst && (
                        <button onClick={() => onDestinationSelect(stop)} data-testid={`turun-${i}`}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            isDest ? "bg-rose-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-600"
                          }`}>Turun</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {!isLast && distances[i] && (
                <div className="flex items-center gap-1.5 ml-5 mb-2 text-[10px] text-gray-400">
                  <ArrowDown className="w-2.5 h-2.5" /><span>{distances[i]}</span><span className="text-gray-300">\u00b7</span><span>1 leg</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {origin && destination && (
        <div className="bg-gradient-to-r from-emerald-50 to-rose-50 border border-gray-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase font-medium">Dari</p>
              <p className="text-sm font-bold text-gray-900">{origin.replace(" Terminal", "")}</p>
            </div>
            <div className="flex items-center gap-1 px-2">
              <div className="h-px w-4 bg-gray-300" />
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{legCount} leg</span>
              <div className="h-px w-4 bg-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase font-medium">Ke</p>
              <p className="text-sm font-bold text-gray-900">{destination.replace(" Terminal", "")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeatMapPanel({ selectedSeats, onToggle }: { selectedSeats: Set<string>; onToggle: (s: string) => void }) {
  const [holdTimer] = useState(247);
  const minutes = Math.floor(holdTimer / 60);
  const seconds = holdTimer % 60;

  const getSeatStatus = (seat: string) => {
    if (selectedSeats.has(seat)) return "selected";
    if (BOOKED_SEATS.has(seat)) return "booked";
    if (HELD_SEATS.has(seat)) return "held";
    return "available";
  };

  const seatColors: Record<string, string> = {
    available: "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 cursor-pointer",
    selected: "bg-blue-500 border-blue-500 text-white shadow-md cursor-pointer",
    booked: "bg-red-100 border-red-200 text-red-300 cursor-not-allowed",
    held: "bg-amber-100 border-amber-300 text-amber-600 cursor-pointer",
  };

  const formatSeatTimer = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const available = SEAT_LAYOUT.flat().filter(s => s && !BOOKED_SEATS.has(s) && !HELD_SEATS.has(s)).length;
  const total = SEAT_LAYOUT.flat().filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Pilih Kursi</h3>
          <p className="text-[11px] text-gray-400">{available}/{total} tersedia</p>
        </div>
        <button className="p-1.5 rounded-lg bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" data-testid="btn-refresh-seats">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 py-1.5 px-3 bg-gray-50 rounded-lg">
        <LegendDot color="bg-white border-gray-300" label="Tersedia" />
        <LegendDot color="bg-blue-500 border-blue-500" label="Dipilih" />
        <LegendDot color="bg-amber-100 border-amber-300" label="Dipegang" />
        <LegendDot color="bg-red-100 border-red-200" label="Terisi" />
      </div>

      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 mb-3">
          <div className="flex-1 h-px bg-gray-200" />
          <Bus className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wider">Depan</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="flex flex-col items-center gap-1">
          {SEAT_LAYOUT.map((row, ri) => (
            <div key={ri} className="flex items-center gap-1">
              {row.map((seat, ci) => {
                if (seat === null) return <div key={`gap-${ci}`} className="w-9 h-9" />;
                const status = getSeatStatus(seat);
                const isHeld = HELD_SEATS.has(seat);
                const heldTimer = HELD_SEAT_TIMERS[seat];
                return (
                  <div key={seat} className="relative">
                    <button onClick={() => status !== "booked" && onToggle(seat)}
                      data-testid={`seat-${seat}`}
                      className={`w-9 h-9 rounded-lg border text-[10px] font-bold font-mono transition-all duration-100 ${seatColors[status]}`}>
                      {seat}
                    </button>
                    {isHeld && heldTimer !== undefined && (
                      <span className={`absolute -top-1.5 -right-1.5 px-1 py-px rounded text-[7px] font-mono font-bold z-10 ${
                        heldTimer < 60 ? "bg-red-500 text-white animate-pulse" : "bg-amber-400 text-amber-900"
                      }`}>{formatSeatTimer(heldTimer)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 mt-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="font-semibold uppercase tracking-wider">Belakang</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      </div>

      {selectedSeats.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-gray-700">Terpilih</span>
            </div>
            <div className="flex gap-1">
              {Array.from(selectedSeats).sort().map(s => (
                <span key={s} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-mono font-bold">{s}</span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-gray-500"><Timer className="w-3 h-3" />Hold</span>
              <span className="font-mono font-bold text-blue-600">{minutes}:{String(seconds).padStart(2, "0")}</span>
            </div>
            <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(holdTimer / 300) * 100}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-3 h-3 rounded border ${color}`} />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

type PassengerField = "name" | "phone" | "id";

function PassengerFormPanel({ seats, price }: { seats: string[]; price: number }) {
  const [passengers, setPassengers] = useState(
    seats.map(s => ({ seatNo: s, name: "", phone: "", id: "" }))
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<string | null>(null);
  const [cashInput, setCashInput] = useState("");

  const update = (i: number, field: PassengerField, val: string) => {
    setPassengers(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  };
  const markTouched = (key: string) => setTouched(prev => ({ ...prev, [key]: true }));

  const getNameError = (name: string, key: string): string | null => {
    if (!touched[key]) return null;
    if (!name.trim()) return "Wajib diisi";
    if (name.trim().length < 3) return "Min. 3 karakter";
    return null;
  };
  const getPhoneError = (phone: string, key: string): string | null => {
    if (!touched[key] || !phone) return null;
    if (!/^0[0-9]{9,12}$/.test(phone)) return "Format: 08xxxxxxxxxx";
    return null;
  };

  const total = seats.length * price;
  const cashReceived = parseFloat(cashInput) || 0;
  const change = Math.max(0, cashReceived - total);

  const methods: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "cash", label: "Tunai", icon: Banknote },
    { id: "qris", label: "QRIS", icon: QrCode },
    { id: "ewallet", label: "E-Wallet", icon: Wallet },
    { id: "bank", label: "Transfer", icon: Building2 },
  ];

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="space-y-3 flex-1 overflow-y-auto">
        <h3 className="text-sm font-bold text-gray-800">Data Penumpang</h3>
        {passengers.map((p, i) => {
          const nameKey = `name-${i}`;
          const phoneKey = `phone-${i}`;
          const nameError = getNameError(p.name, nameKey);
          const phoneError = getPhoneError(p.phone, phoneKey);
          return (
            <div key={p.seatNo} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-600">{i + 1}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">Penumpang {i + 1}</span>
                </div>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-mono font-bold">{p.seatNo}</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 block font-medium">Nama *</label>
                  <input value={p.name} onChange={e => update(i, "name", e.target.value)} onBlur={() => markTouched(nameKey)}
                    data-testid={`input-name-${i}`}
                    placeholder="Nama lengkap"
                    className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                      nameError ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-blue-200 focus:border-blue-300"
                    }`} />
                  {nameError && <p className="text-[10px] text-red-500 mt-0.5">{nameError}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 block font-medium">Telepon</label>
                    <input value={p.phone} onChange={e => update(i, "phone", e.target.value)} onBlur={() => markTouched(phoneKey)}
                      data-testid={`input-phone-${i}`}
                      placeholder="08xxx"
                      className={`w-full h-8 px-2.5 bg-white border rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 ${
                        phoneError ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-blue-200 focus:border-blue-300"
                      }`} />
                    {phoneError && <p className="text-[10px] text-red-500 mt-0.5">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 block font-medium">ID</label>
                    <input value={p.id} onChange={e => update(i, "id", e.target.value)}
                      data-testid={`input-id-${i}`}
                      placeholder="KTP/Paspor"
                      className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="border-t border-gray-200 pt-3 space-y-3">
          <h3 className="text-sm font-bold text-gray-800">Pembayaran</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm text-gray-600">{seats.length} kursi \u00d7 {fmt(price)}</span>
            <span className="text-lg font-black text-blue-700 font-mono">{fmt(total)}</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {methods.map(m => {
              const Icon = m.icon;
              return (
                <button key={m.id} onClick={() => setMethod(m.id)} data-testid={`pay-${m.id}`}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    method === m.id ? "bg-blue-50 border-blue-400" : "bg-white border-gray-200 hover:border-gray-300"
                  }`}>
                  <Icon className={`w-4 h-4 mx-auto mb-0.5 ${method === m.id ? "text-blue-600" : "text-gray-400"}`} />
                  <span className={`text-[10px] font-medium ${method === m.id ? "text-blue-700" : "text-gray-500"}`}>{m.label}</span>
                </button>
              );
            })}
          </div>

          {method === "cash" && (
            <div className="space-y-2">
              <input type="number" value={cashInput} onChange={e => setCashInput(e.target.value)}
                data-testid="input-cash"
                placeholder="Uang diterima"
                className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300" />
              {cashReceived >= total && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                  <span className="text-[10px] text-gray-500 block">Kembalian</span>
                  <span className="text-xl font-black text-emerald-600 font-mono">{fmt(change)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-200 flex-shrink-0">
        <button data-testid="btn-book-only"
          className="flex-1 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-200">
          <Clock className="w-3.5 h-3.5" /> Booking Saja
        </button>
        <button data-testid="btn-pay-confirm"
          className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm">
          <CreditCard className="w-3.5 h-3.5" /> Bayar & Cetak
        </button>
      </div>
    </div>
  );
}

function PrintPreviewPanel({ onNewBooking }: { onNewBooking: () => void }) {
  return (
    <div className="space-y-5 flex flex-col items-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Booking Berhasil!</h2>
        <p className="text-sm text-gray-500">ID: <span className="font-mono text-blue-600 font-semibold">A3F8BC21</span></p>
      </div>

      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-base tracking-wide">E-Ticket</span>
          <span className="px-2 py-0.5 bg-emerald-400/20 text-emerald-100 rounded-md text-[10px] font-bold">LUNAS</span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900 tracking-wider">JKT</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Jakarta Terminal</p>
              <p className="text-xs text-gray-500 font-mono mt-1">06:00</p>
            </div>
            <div className="flex-1 mx-4 flex flex-col items-center">
              <div className="flex items-center w-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                <Bus className="w-4 h-4 text-blue-500" />
                <div className="flex-1 border-t-2 border-dashed border-gray-300 mx-1" />
                <div className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
              <span className="text-[10px] text-gray-400 mt-1">3j 30m</span>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900 tracking-wider">BDG</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Bandung Terminal</p>
              <p className="text-xs text-gray-500 font-mono mt-1">09:30</p>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoCell icon={Calendar} label="Tanggal" value="Sab, 15 Mar 2026" />
            <InfoCell icon={Bus} label="Kendaraan" value="BUS-001" />
            <InfoCell icon={Store} label="Outlet" value="Jakarta Terminal" />
            <InfoCell icon={Users} label="Penumpang" value="2 orang" />
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                <th className="text-left py-1 font-medium">Nama</th>
                <th className="text-center py-1 font-medium w-14">Kursi</th>
                <th className="text-right py-1 font-medium w-24">Tarif</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-t border-gray-100"><td className="py-1.5 font-medium">Budi Santoso</td><td className="py-1.5 text-center"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono font-bold">3A</span></td><td className="py-1.5 text-right font-mono text-gray-600">Rp75.000</td></tr>
              <tr className="border-t border-gray-100"><td className="py-1.5 font-medium">Siti Rahayu</td><td className="py-1.5 text-center"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-mono font-bold">3C</span></td><td className="py-1.5 text-right font-mono text-gray-600">Rp75.000</td></tr>
            </tbody>
          </table>

          <div className="border-t border-dashed border-gray-200 my-3" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-600">Total</span>
            <span className="text-lg font-black text-blue-700 font-mono">Rp150.000</span>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 flex items-center gap-1"><CreditCard className="w-3 h-3" />Tunai</span>
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-200">
            <QrCode className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-lg">
        <button data-testid="btn-print"
          className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm">
          <Printer className="w-4 h-4" /> Cetak Tiket
        </button>
        <button onClick={onNewBooking} data-testid="btn-new-booking"
          className="flex-1 h-10 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-gray-200 transition-colors">
          <RotateCcw className="w-4 h-4" /> Booking Baru
        </button>
      </div>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-[11px] font-medium text-gray-700">{value}</p>
      </div>
    </div>
  );
}

export function TransitPro() {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedTrip, setSelectedTrip] = useState<typeof MOCK_TRIPS[0] | undefined>();
  const [origin, setOrigin] = useState<string>();
  const [destination, setDestination] = useState<string>();
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [showPrint, setShowPrint] = useState(false);

  const handleTripSelect = (t: typeof MOCK_TRIPS[0]) => {
    setSelectedTrip(t);
    setOrigin(undefined);
    setDestination(undefined);
  };

  const handleOriginSelect = (s: string) => {
    setOrigin(s);
    if (destination && destination === s) setDestination(undefined);
  };

  const handleDestinationSelect = (s: string) => {
    if (origin && s !== origin) {
      setDestination(s);
      setTimeout(() => setPhase("book"), 300);
    }
  };

  const toggleSeat = (s: string) => {
    setSelectedSeats(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const resetAll = () => {
    setPhase("select");
    setSelectedTrip(undefined);
    setOrigin(undefined);
    setDestination(undefined);
    setSelectedSeats(new Set());
    setShowPrint(false);
  };

  const seats = Array.from(selectedSeats).sort();

  return (
    <div className="flex h-screen bg-gray-50 font-['Inter',sans-serif]">
      <AppSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-gray-800">CSO Booking Terminal</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-xs text-gray-500">{showPrint ? "Tiket" : phase === "select" ? "Jadwal & Rute" : "Kursi & Penumpang"}</span>
          </div>
          <div className="flex items-center gap-4">
            {phase === "book" && !showPrint && (
              <button onClick={() => { setPhase("select"); setSelectedSeats(new Set()); }}
                data-testid="btn-back-select"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors">
                <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Ubah Jadwal/Rute
              </button>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Online</span>
              </div>
              <span>CSO User</span>
              <span className="font-mono">15/3/2026</span>
            </div>
          </div>
        </div>

      {showPrint ? (
        <div className="flex-1 overflow-y-auto p-6">
          <PrintPreviewPanel onNewBooking={resetAll} />
        </div>
      ) : (
        <>
          {phase === "select" && selectedTrip && origin && destination && (
            <div className="bg-blue-50 border-b border-blue-100 px-5 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="font-semibold text-blue-700">{selectedTrip.depart}</span>
                <span>{origin} &rarr; {destination}</span>
                <span className="text-gray-400">{selectedTrip.vehicle}</span>
              </div>
              <button onClick={() => setPhase("book")} data-testid="btn-proceed-book"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
                Lanjut Pilih Kursi <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex-1 flex overflow-hidden">
            {phase === "select" && (
              <>
                <div className="flex-1 border-r border-gray-200 overflow-y-auto p-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-800">Pilih Jadwal</h3>
                      <span className="text-[10px] text-gray-400">{MOCK_TRIPS.length} jadwal</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Store className="w-3 h-3" /> Outlet
                        </label>
                        <div className="h-9 bg-white border border-gray-200 rounded-lg px-3 flex items-center text-sm text-gray-700">
                          Jakarta Terminal
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Tanggal
                        </label>
                        <div className="h-9 bg-white border border-gray-200 rounded-lg px-3 flex items-center text-sm text-gray-700">
                          15 Mar 2026
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {MOCK_TRIPS.map(trip => (
                        <TripCard key={trip.id} trip={trip} isSelected={selectedTrip?.id === trip.id} onSelect={() => handleTripSelect(trip)} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {selectedTrip ? (
                    <RouteTimeline
                      stops={selectedTrip.stops}
                      origin={origin}
                      destination={destination}
                      onOriginSelect={handleOriginSelect}
                      onDestinationSelect={handleDestinationSelect}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                      <MapPin className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Pilih jadwal di sebelah kiri</p>
                      <p className="text-xs text-gray-300 mt-1">Rute akan muncul di sini</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {phase === "book" && (
              <>
                <div className="flex-1 border-r border-gray-200 overflow-y-auto p-5">
                  <SeatMapPanel selectedSeats={selectedSeats} onToggle={toggleSeat} />
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col">
                  {seats.length > 0 ? (
                    <PassengerFormPanel seats={seats} price={selectedTrip?.price ?? 75000} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                      <Armchair className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium text-gray-400">Pilih kursi di sebelah kiri</p>
                      <p className="text-xs text-gray-300 mt-1">Form penumpang akan muncul di sini</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="h-8 bg-white border-t border-gray-200 flex items-center justify-between px-5 flex-shrink-0">
            <div className="flex items-center gap-4 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Transity v1.0</span>
              {selectedTrip && <span>Jadwal: <span className="font-semibold text-gray-600">{selectedTrip.depart} {selectedTrip.route}</span></span>}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              {origin && <span>Naik: <span className="font-semibold text-emerald-600">{origin.replace(" Terminal", "")}</span></span>}
              {destination && <span>Turun: <span className="font-semibold text-rose-600">{destination.replace(" Terminal", "")}</span></span>}
              {seats.length > 0 && (
                <span>Kursi: <span className="font-semibold text-blue-600">{seats.join(", ")}</span> | Total: <span className="font-bold text-blue-700">{fmt(seats.length * (selectedTrip?.price ?? 75000))}</span></span>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
