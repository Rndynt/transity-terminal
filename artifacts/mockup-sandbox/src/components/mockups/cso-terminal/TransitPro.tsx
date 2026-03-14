import { useState, type ComponentType } from "react";
import {
  MapPin, Calendar, Clock, Bus, Users, CreditCard, Printer,
  ChevronRight, Check, Timer, ArrowRight, ArrowDown,
  Armchair, RotateCcw, QrCode, Banknote, Wallet, Building2,
  Plus, Circle, Store, Ticket,
  CheckCircle2, type LucideProps
} from "lucide-react";

type LucideIcon = ComponentType<LucideProps>;

const MOCK_TRIPS = [
  { id: "1", route: "Jakarta \u2192 Bandung", depart: "06:00", arrive: "09:30", vehicle: "BUS-001", seats: 32, available: 24, status: "active" as const, stops: ["Jakarta", "Purwakarta", "Bandung"] },
  { id: "2", route: "Jakarta \u2192 Bandung", depart: "08:30", arrive: "12:00", vehicle: "BUS-003", seats: 40, available: 8, status: "active" as const, stops: ["Jakarta", "Purwakarta", "Bandung"] },
  { id: "3", route: "Jakarta \u2192 Semarang", depart: "07:00", arrive: "14:00", vehicle: "BUS-005", seats: 40, available: 36, status: "active" as const, stops: ["Jakarta", "Cirebon", "Pekalongan", "Semarang"] },
  { id: "4", route: "Jakarta \u2192 Semarang", depart: "20:00", arrive: "03:00", vehicle: "TBD", seats: 40, available: 40, status: "virtual" as const, stops: ["Jakarta", "Cirebon", "Pekalongan", "Semarang"] },
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

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: { id: Step; label: string; icon: LucideIcon }[] = [
  { id: 1, label: "Jadwal", icon: Calendar },
  { id: 2, label: "Rute", icon: MapPin },
  { id: 3, label: "Kursi", icon: Armchair },
  { id: 4, label: "Penumpang", icon: Users },
  { id: 5, label: "Bayar", icon: CreditCard },
  { id: 6, label: "Tiket", icon: Ticket },
];

function StepIndicator({ step, currentStep, onClick }: { step: typeof STEPS[0]; currentStep: Step; onClick: () => void }) {
  const isActive = step.id === currentStep;
  const isCompleted = step.id < currentStep;
  const Icon = step.icon;

  return (
    <button onClick={onClick} className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 ${
      isActive ? "bg-amber-500/15 text-amber-400" :
      isCompleted ? "text-emerald-400 hover:bg-white/5" :
      "text-slate-500 hover:bg-white/5"
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
        isActive ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/25" :
        isCompleted ? "bg-emerald-500/20 text-emerald-400" :
        "bg-slate-700/50 text-slate-500"
      }`}>
        {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </div>
      <span className={`text-sm font-medium ${isActive ? "text-amber-400" : isCompleted ? "text-emerald-400" : "text-slate-500"}`}>
        {step.label}
      </span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
    </button>
  );
}

function LiveSummary({
  outlet, trip, origin, destination, seats, total
}: {
  outlet?: string; trip?: typeof MOCK_TRIPS[0]; origin?: string; destination?: string; seats: string[]; total: number;
}) {
  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center">
          <Ticket className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Ringkasan</span>
      </div>

      <div className="space-y-2">
        <SummaryRow label="Outlet" value={outlet || "-"} />
        {trip && <SummaryRow label="Keberangkatan" value={trip.depart} highlight />}
        {trip && <SummaryRow label="Kendaraan" value={trip.vehicle} />}
        {origin && destination && (
          <div className="flex items-center gap-2 py-1.5 px-2.5 bg-slate-700/30 rounded-lg">
            <span className="text-xs text-slate-400">{origin}</span>
            <ArrowRight className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-slate-400">{destination}</span>
          </div>
        )}
        {seats.length > 0 && (
          <div className="py-1.5 px-2.5 bg-slate-700/30 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Kursi</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {seats.map(s => (
                <span key={s} className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-mono font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {seats.length > 0 && (
        <div className="pt-2 border-t border-slate-700/50">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">{seats.length} penumpang</span>
            <span className="text-lg font-bold text-amber-400 font-mono">{fmt(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-xs font-medium ${highlight ? "text-amber-300 font-mono" : "text-slate-300"}`}>{value}</span>
    </div>
  );
}

function StopsMiniTimeline({ stops }: { stops: string[] }) {
  return (
    <div className="flex items-center gap-0.5 mt-2">
      {stops.map((stop, i) => (
        <div key={stop} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-emerald-400" : i === stops.length - 1 ? "bg-rose-400" : "bg-slate-500"}`} />
            <span className="text-[9px] text-slate-500 mt-0.5 max-w-[50px] truncate text-center leading-tight">{stop}</span>
          </div>
          {i < stops.length - 1 && <div className="w-4 h-px bg-slate-600 mx-0.5 -mt-3" />}
        </div>
      ))}
    </div>
  );
}

function TripSelectorPanel({ onSelect, selectedId }: { onSelect: (t: typeof MOCK_TRIPS[0]) => void; selectedId?: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">Pilih Jadwal</h2>
        <p className="text-sm text-slate-400">Cari keberangkatan yang tersedia</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Store className="w-3 h-3" /> Outlet
          </label>
          <div className="h-10 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 flex items-center text-sm text-slate-200">
            Jakarta Terminal
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Tanggal
          </label>
          <div className="h-10 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 flex items-center text-sm text-slate-200">
            15 Mar 2026
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Bus className="w-3 h-3" /> Jadwal Tersedia
          </span>
          <span className="text-[10px] text-slate-500">{MOCK_TRIPS.length} jadwal</span>
        </div>

        <div className="space-y-2">
          {MOCK_TRIPS.map(trip => {
            const isSelected = selectedId === trip.id;
            const seatPct = Math.round((trip.available / trip.seats) * 100);
            return (
              <button key={trip.id} onClick={() => onSelect(trip)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20"
                    : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800"
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-slate-100 font-mono tracking-tight">{trip.depart}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-400 font-mono">{trip.arrive}</span>
                  </div>
                  {trip.status === "virtual" ? (
                    <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-md text-[10px] font-medium">Jadwal Virtual</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-md text-[10px] font-medium">Aktif</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{trip.route}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Bus className="w-3 h-3 text-slate-500" />
                      <span className="text-[11px] text-slate-500">{trip.vehicle}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Armchair className="w-3 h-3 text-slate-500" />
                      <span className={`text-[11px] font-medium ${trip.available > 10 ? "text-emerald-400" : trip.available > 0 ? "text-amber-400" : "text-red-400"}`}>
                        {trip.available}/{trip.seats}
                      </span>
                    </div>
                  </div>
                </div>
                <StopsMiniTimeline stops={trip.stops} />
                <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${seatPct > 50 ? "bg-emerald-500" : seatPct > 20 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${seatPct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RouteTimelinePanel({
  stops, origin, destination, onOriginSelect, onDestinationSelect
}: {
  stops: string[]; origin?: string; destination?: string;
  onOriginSelect: (s: string) => void; onDestinationSelect: (s: string) => void;
}) {
  const times = ["06:00", "07:15", "08:00", "09:30"];
  const distances = ["85 km", "45 km", "120 km"];

  const originIdx = origin ? stops.indexOf(origin) : -1;
  const destIdx = destination ? stops.indexOf(destination) : -1;
  const legCount = originIdx >= 0 && destIdx > originIdx ? destIdx - originIdx : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">Pilih Rute</h2>
        <p className="text-sm text-slate-400">Tentukan titik naik dan turun</p>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-3 mb-4">
        <p className="text-xs text-slate-400">Klik <span className="text-emerald-400 font-medium">Naik</span> untuk titik keberangkatan dan <span className="text-rose-400 font-medium">Turun</span> untuk tujuan</p>
      </div>

      <div className="relative pl-6">
        <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-emerald-500 via-slate-600 to-rose-500" />

        {stops.map((stop, i) => {
          const isFirst = i === 0;
          const isLast = i === stops.length - 1;
          const isOrigin = origin === stop;
          const isDestination = destination === stop;
          const time = times[i] || "--:--";
          const distance = distances[i];

          return (
            <div key={stop}>
              <div className="relative flex items-start gap-4 pb-2">
                <div className={`absolute left-[-13px] w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                  isOrigin ? "bg-emerald-500 ring-4 ring-emerald-500/20" :
                  isDestination ? "bg-rose-500 ring-4 ring-rose-500/20" :
                  isFirst ? "bg-emerald-500/80" :
                  isLast ? "bg-rose-500/80" :
                  "bg-slate-600 border-2 border-slate-500"
                }`}>
                  {isOrigin || isDestination ? <Check className="w-3 h-3 text-white" /> :
                    <Circle className="w-2.5 h-2.5 text-slate-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className={`font-semibold ${isOrigin || isDestination ? "text-slate-100" : "text-slate-300"}`}>{stop}</p>
                      <p className="text-xs text-slate-500 font-mono">{time}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isLast && (
                      <button onClick={() => onOriginSelect(stop)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                          isOrigin ? "bg-emerald-500 text-white" : "bg-slate-700/50 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400"
                        }`}>
                        {isOrigin ? "Naik \u2713" : "Naik"}
                      </button>
                    )}
                    {!isFirst && (
                      <button onClick={() => onDestinationSelect(stop)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                          isDestination ? "bg-rose-500 text-white" : "bg-slate-700/50 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                        }`}>
                        {isDestination ? "Turun \u2713" : "Turun"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!isLast && distance && (
                <div className="flex items-center gap-1.5 ml-6 mb-3 text-[10px] text-slate-500">
                  <ArrowDown className="w-2.5 h-2.5" />
                  <span>{distance}</span>
                  <span className="text-slate-600">\u00b7</span>
                  <span>1 leg</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {origin && destination && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-rose-500/10 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Dari</p>
              <p className="font-bold text-slate-100">{origin}</p>
            </div>
            <div className="flex flex-col items-center gap-1 px-3">
              <div className="flex items-center gap-2">
                <div className="h-px w-6 bg-slate-600" />
                <Clock className="w-4 h-4 text-amber-400" />
                <div className="h-px w-6 bg-slate-600" />
              </div>
              <span className="text-[10px] text-amber-400 font-medium">{legCount} leg</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Ke</p>
              <p className="font-bold text-slate-100">{destination}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeatMapPanel({
  selectedSeats, onToggle
}: { selectedSeats: Set<string>; onToggle: (s: string) => void }) {
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
    available: "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-500/20 hover:border-indigo-400/50 hover:text-indigo-300 cursor-pointer",
    selected: "bg-amber-500 border-amber-400 text-slate-900 shadow-lg shadow-amber-500/20 cursor-pointer",
    booked: "bg-red-500/20 border-red-500/30 text-red-400/60 cursor-not-allowed",
    held: "bg-yellow-500/20 border-yellow-500/30 text-yellow-500 cursor-pointer",
  };

  const formatSeatTimer = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const available = SEAT_LAYOUT.flat().filter(s => s && !BOOKED_SEATS.has(s) && !HELD_SEATS.has(s)).length;
  const total = SEAT_LAYOUT.flat().filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">Pilih Kursi</h2>
          <p className="text-sm text-slate-400">{available} dari {total} kursi tersedia</p>
        </div>
        <button className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-4 py-2 px-4 bg-slate-800/30 rounded-xl">
        <LegendItem color="bg-slate-700/50 border-slate-600" label="Tersedia" />
        <LegendItem color="bg-amber-500 border-amber-400" label="Dipilih" />
        <LegendItem color="bg-yellow-500/20 border-yellow-500/30" label="Dipegang" />
        <LegendItem color="bg-red-500/20 border-red-500/30" label="Terisi" />
      </div>

      <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/30">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4">
          <div className="flex-1 h-px bg-slate-700" />
          <Bus className="w-4 h-4" />
          <span className="font-medium">DEPAN</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {SEAT_LAYOUT.map((row, ri) => (
            <div key={ri} className="flex items-center gap-1.5">
              {row.map((seat, ci) => {
                if (seat === null) return <div key={`gap-${ci}`} className="w-10 h-10" />;
                const status = getSeatStatus(seat);
                const isHeld = HELD_SEATS.has(seat);
                const heldTimer = HELD_SEAT_TIMERS[seat];
                return (
                  <div key={seat} className="relative">
                    <button onClick={() => status !== "booked" && onToggle(seat)}
                      className={`w-10 h-10 rounded-lg border text-xs font-bold font-mono transition-all duration-150 ${seatColors[status]}`}>
                      {seat}
                    </button>
                    {isHeld && heldTimer !== undefined && (
                      <span className={`absolute -top-1.5 -right-1.5 px-1 py-px rounded text-[8px] font-mono font-bold z-10 ${
                        heldTimer < 60 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-500 text-slate-900"
                      }`}>
                        {formatSeatTimer(heldTimer)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="font-medium">BELAKANG</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>
      </div>

      {selectedSeats.size > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-200">Kursi Terpilih</span>
            </div>
            <div className="flex gap-1">
              {Array.from(selectedSeats).sort().map(s => (
                <span key={s} className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-mono font-bold">{s}</span>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Timer className="w-3.5 h-3.5" />
                <span>Waktu pegang</span>
              </div>
              <span className="font-mono font-bold text-amber-400">{minutes}:{String(seconds).padStart(2, "0")}</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(holdTimer / 300) * 100}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-4 h-4 rounded border ${color}`} />
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  );
}

type PassengerField = "name" | "phone" | "id";

function PassengerFormPanel({
  seats,
}: { seats: string[] }) {
  const [passengers, setPassengers] = useState(
    seats.map(s => ({ seatNo: s, name: "", phone: "", id: "" }))
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const update = (i: number, field: PassengerField, val: string) => {
    setPassengers(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  };

  const markTouched = (key: string) => {
    setTouched(prev => ({ ...prev, [key]: true }));
  };

  const getNameError = (name: string, key: string): string | null => {
    if (!touched[key]) return null;
    if (!name.trim()) return "Nama wajib diisi";
    if (name.trim().length < 3) return "Minimal 3 karakter";
    return null;
  };

  const getPhoneError = (phone: string, key: string): string | null => {
    if (!touched[key] || !phone) return null;
    if (!/^0[0-9]{9,12}$/.test(phone)) return "Format: 08xxxxxxxxxx";
    return null;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">Data Penumpang</h2>
        <p className="text-sm text-slate-400">Isi data untuk {seats.length} penumpang</p>
      </div>

      <div className="space-y-3">
        {passengers.map((p, i) => {
          const nameKey = `name-${i}`;
          const phoneKey = `phone-${i}`;
          const nameError = getNameError(p.name, nameKey);
          const phoneError = getPhoneError(p.phone, phoneKey);

          return (
            <div key={p.seatNo} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-400">{i + 1}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-200">Penumpang {i + 1}</span>
                </div>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-mono font-bold">
                  {p.seatNo}
                </span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-1 block">Nama Lengkap *</label>
                  <input value={p.name}
                    onChange={e => update(i, "name", e.target.value)}
                    onBlur={() => markTouched(nameKey)}
                    placeholder="Nama lengkap penumpang"
                    className={`w-full h-9 px-3 bg-slate-700/40 border rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 ${
                      nameError ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" : "border-slate-600/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                    }`} />
                  {nameError && <p className="text-[10px] text-red-400 mt-1">{nameError}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-1 block">No. Telepon</label>
                    <input value={p.phone}
                      onChange={e => update(i, "phone", e.target.value)}
                      onBlur={() => markTouched(phoneKey)}
                      placeholder="08xxxxxxxxxx"
                      className={`w-full h-9 px-3 bg-slate-700/40 border rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 ${
                        phoneError ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" : "border-slate-600/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                      }`} />
                    {phoneError && <p className="text-[10px] text-red-400 mt-1">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-1 block">No. Identitas</label>
                    <input value={p.id} onChange={e => update(i, "id", e.target.value)}
                      placeholder="KTP/Paspor"
                      className="w-full h-9 px-3 bg-slate-700/40 border border-slate-600/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentPanelContent({ total }: { total: number }) {
  const [method, setMethod] = useState<string | null>(null);
  const [cashInput, setCashInput] = useState("");
  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const methods: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "cash", label: "Tunai", icon: Banknote },
    { id: "qris", label: "QRIS", icon: QrCode },
    { id: "ewallet", label: "E-Wallet", icon: Wallet },
    { id: "bank", label: "Transfer", icon: Building2 },
  ];

  const cashReceived = parseFloat(cashInput) || 0;
  const change = Math.max(0, cashReceived - total);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100 mb-1">Pembayaran</h2>
        <p className="text-sm text-slate-400">Pilih metode dan selesaikan transaksi</p>
      </div>

      <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-300">Total Pembayaran</span>
          <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">{fmt(total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {methods.map(m => {
          const Icon = m.icon;
          const isActive = method === m.id;
          return (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? "bg-amber-500/10 border-amber-500/40"
                  : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
              }`}>
              <Icon className={`w-5 h-5 mb-1 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
              <span className={`text-sm font-medium ${isActive ? "text-amber-300" : "text-slate-300"}`}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {method === "cash" && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 block">Uang Diterima</label>
            <input type="number" value={cashInput} onChange={e => setCashInput(e.target.value)}
              placeholder="Masukkan nominal"
              className="w-full h-11 px-4 bg-slate-700/40 border border-slate-600/50 rounded-xl text-lg text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20" />
          </div>
          {cashReceived >= total && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <span className="text-xs text-slate-400 block mb-1">Kembalian</span>
              <span className="text-3xl font-black text-emerald-400 font-mono">{fmt(change)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrintPreviewPanel() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 mb-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-1">Booking Berhasil!</h2>
        <p className="text-sm text-slate-400">ID: <span className="font-mono text-amber-400">A3F8BC21</span></p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-lg tracking-wide">E-Ticket</span>
          <span className="px-2.5 py-0.5 bg-emerald-400/20 text-emerald-200 rounded-md text-xs font-bold">LUNAS</span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="text-center">
              <p className="text-3xl font-black text-slate-100 tracking-wider">JKT</p>
              <p className="text-xs text-slate-500 mt-0.5">Jakarta Terminal</p>
              <p className="text-xs text-slate-400 font-mono mt-1">06:00</p>
            </div>
            <div className="flex-1 mx-4 flex flex-col items-center">
              <div className="flex items-center w-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="flex-1 border-t-2 border-dashed border-slate-600 mx-1" />
                <Bus className="w-5 h-5 text-amber-400" />
                <div className="flex-1 border-t-2 border-dashed border-slate-600 mx-1" />
                <div className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
              <span className="text-[10px] text-slate-500 mt-1">3j 30m</span>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-slate-100 tracking-wider">BDG</p>
              <p className="text-xs text-slate-500 mt-0.5">Bandung Terminal</p>
              <p className="text-xs text-slate-400 font-mono mt-1">09:30</p>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-700 my-4" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoCell icon={Calendar} label="Tanggal" value="Sabtu, 15 Mar 2026" />
            <InfoCell icon={Bus} label="Kendaraan" value="BUS-001" />
            <InfoCell icon={Store} label="Outlet" value="Jakarta Terminal" />
            <InfoCell icon={Users} label="Penumpang" value="2 orang" />
          </div>

          <div className="border-t border-dashed border-slate-700 my-4" />

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="text-left py-1.5 font-medium">Nama</th>
                <th className="text-center py-1.5 font-medium w-16">Kursi</th>
                <th className="text-right py-1.5 font-medium w-28">Tarif</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-t border-slate-700/30">
                <td className="py-2 font-medium">Budi Santoso</td>
                <td className="py-2 text-center"><span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 rounded text-xs font-mono">3A</span></td>
                <td className="py-2 text-right font-mono">Rp50.000</td>
              </tr>
              <tr className="border-t border-slate-700/30">
                <td className="py-2 font-medium">Siti Rahayu</td>
                <td className="py-2 text-center"><span className="px-2 py-0.5 bg-amber-500/15 text-amber-300 rounded text-xs font-mono">3C</span></td>
                <td className="py-2 text-right font-mono">Rp50.000</td>
              </tr>
            </tbody>
          </table>

          <div className="border-t border-dashed border-slate-700 my-3" />

          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-300">Total Bayar</span>
            <span className="text-xl font-black text-amber-400 font-mono">Rp100.000</span>
          </div>
        </div>

        <div className="border-t border-slate-700/50 bg-slate-800/30 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-500">Tunai</span>
          </div>
          <div className="w-16 h-16 bg-slate-700/50 rounded-lg flex items-center justify-center border border-slate-600/50">
            <QrCode className="w-8 h-8 text-slate-500" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors">
          <Printer className="w-4 h-4" /> Cetak Tiket
        </button>
        <button className="flex-1 h-11 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border border-slate-600/50 transition-colors">
          <Plus className="w-4 h-4" /> Booking Baru
        </button>
      </div>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-medium text-slate-300">{value}</p>
      </div>
    </div>
  );
}

export function TransitPro() {
  const [step, setStep] = useState<Step>(1);
  const [selectedTrip, setSelectedTrip] = useState<typeof MOCK_TRIPS[0] | undefined>();
  const [origin, setOrigin] = useState<string>();
  const [destination, setDestination] = useState<string>();
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());

  const handleTripSelect = (t: typeof MOCK_TRIPS[0]) => {
    setSelectedTrip(t);
    setStep(2);
  };

  const handleOriginSelect = (s: string) => {
    setOrigin(s);
    if (destination && destination === s) setDestination(undefined);
  };

  const handleDestinationSelect = (s: string) => {
    if (origin && s !== origin) {
      setDestination(s);
      setStep(3);
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

  const handleStepClick = (s: Step) => {
    if (s <= step) setStep(s);
  };

  const total = selectedSeats.size * 50000;
  const seats = Array.from(selectedSeats).sort();

  const goNext = () => {
    if (step < 6) setStep((step + 1) as Step);
  };
  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  return (
    <div className="flex h-screen bg-slate-950 font-['Inter',sans-serif] text-slate-200">
      <div className="w-56 bg-slate-900/80 border-r border-slate-800/50 flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bus className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 tracking-tight">Transity</h1>
              <p className="text-[10px] text-slate-500">Booking Terminal</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-3 py-4 space-y-1">
          {STEPS.map(s => (
            <StepIndicator key={s.id} step={s} currentStep={step} onClick={() => handleStepClick(s.id)} />
          ))}
        </div>

        <div className="px-3 pb-4">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <LiveSummary
              outlet={selectedTrip ? "Jakarta Terminal" : undefined}
              trip={selectedTrip}
              origin={origin}
              destination={destination}
              seats={seats}
              total={total}
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800/50 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">CSO User</p>
            <p className="text-[10px] text-slate-500">Operator</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-slate-800/50 bg-slate-900/40 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-200">CSO Booking Terminal</h2>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-xs text-slate-400">{STEPS.find(s => s.id === step)?.label}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Terhubung</span>
            </div>
            <span>15/3/2026</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {step === 1 && <TripSelectorPanel onSelect={handleTripSelect} selectedId={selectedTrip?.id} />}
            {step === 2 && selectedTrip && (
              <RouteTimelinePanel
                stops={selectedTrip.stops}
                origin={origin} destination={destination}
                onOriginSelect={handleOriginSelect} onDestinationSelect={handleDestinationSelect}
              />
            )}
            {step === 3 && <SeatMapPanel selectedSeats={selectedSeats} onToggle={toggleSeat} />}
            {step === 4 && <PassengerFormPanel seats={seats} />}
            {step === 5 && <PaymentPanelContent total={total} />}
            {step === 6 && <PrintPreviewPanel />}

            {step > 1 && step < 6 && (
              <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-800/40">
                <button onClick={goBack}
                  className="px-5 h-10 bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 rotate-180" /> Kembali
                </button>
                <div className="flex gap-2">
                  {step === 4 && (
                    <button className="px-5 h-10 bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Booking Saja
                    </button>
                  )}
                  {step < 5 && (
                    <button onClick={goNext}
                      className="px-5 h-10 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 transition-colors flex items-center gap-2">
                      {step === 4 ? (
                        <><CreditCard className="w-4 h-4" /> Bayar Sekarang</>
                      ) : (
                        <>Lanjut <ChevronRight className="w-4 h-4" /></>
                      )}
                    </button>
                  )}
                  {step === 5 && (
                    <button onClick={goNext}
                      className="px-6 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-colors flex items-center gap-2">
                      <Check className="w-4 h-4" /> Konfirmasi Bayar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
