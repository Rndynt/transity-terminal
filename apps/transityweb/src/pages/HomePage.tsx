import { useState, useEffect, useRef } from 'react';
import { useNav, useAuth } from '@/App';
import { tripsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowDownUp, Search, Loader2, MapPin, CalendarDays, Users, Zap, ShieldCheck, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const { navigate } = useNav();
  const { user } = useAuth();
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [passengers, setPassengers] = useState(1);
  const [sheetFor, setSheetFor] = useState<'origin' | 'destination' | null>(null);

  useEffect(() => {
    tripsApi.getCities()
      .then((res) => setCities(res.map((c) => c.city)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const swap = () => { setOrigin(destination); setDestination(origin); };
  const search = () => {
    if (!origin || !destination || !date) return;
    navigate({ name: 'search-results', originCity: origin, destinationCity: destination, date, passengers });
  };

  const selectCity = (city: string) => {
    if (sheetFor === 'origin') setOrigin(city);
    else if (sheetFor === 'destination') setDestination(city);
    setSheetFor(null);
  };

  return (
    <div className="anim-fade pb-28">
      <div className="hero-mesh relative overflow-hidden rounded-b-[2rem]">
        <div className="px-5 pt-14 pb-28 relative z-10">
          <div className="mb-2">
            <span className="font-display font-extrabold text-2xl text-white tracking-tight">Transity</span>
          </div>
          <p className="text-teal-200/90 text-[15px] leading-snug max-w-[260px]">
            {user
              ? <>Hai <span className="font-semibold text-white">{user.name.split(' ')[0]}</span>, mau ke mana hari ini?</>
              : 'Temukan & pesan tiket bus favoritmu dalam hitungan detik.'
            }
          </p>
        </div>
      </div>

      <div className="px-4 -mt-20 relative z-20">
        <div className="bg-white rounded-[1.25rem] shadow-float overflow-visible anim-slide-up">
          <div className="p-5">
            <div className="relative">
              <div className="space-y-0 border border-slate-200/80 rounded-2xl overflow-hidden">
                <CityField
                  label="DARI"
                  placeholder="Kota keberangkatan"
                  value={origin}
                  onClick={() => setSheetFor('origin')}
                  testId="input-origin"
                  dotClass="border-2 border-teal-600"
                />
                <div className="relative h-0">
                  <div className="absolute inset-x-4 border-t border-dashed border-slate-200" />
                  <button
                    onClick={swap}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-teal-50 border-2 border-teal-600/20 flex items-center justify-center hover:bg-teal-100 transition-all active:scale-90"
                    data-testid="button-swap"
                  >
                    <ArrowDownUp className="w-4 h-4 text-teal-700" />
                  </button>
                </div>
                <CityField
                  label="KE"
                  placeholder="Kota tujuan"
                  value={destination}
                  onClick={() => setSheetFor('destination')}
                  testId="input-destination"
                  dotClass="bg-coral-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-1.5 block">Tanggal</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-teal-600 pointer-events-none" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200/80 bg-slate-50/50 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all"
                    data-testid="input-date"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-1.5 block">Penumpang</Label>
                <div className="flex items-center h-12 rounded-xl border border-slate-200/80 bg-slate-50/50 overflow-hidden">
                  <button
                    onClick={() => setPassengers(Math.max(1, passengers - 1))}
                    className="w-11 h-full text-lg font-bold text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors active:bg-teal-100"
                    data-testid="button-passenger-minus"
                  >−</button>
                  <div className="flex-1 flex items-center justify-center gap-1.5">
                    <Users className="w-[18px] h-[18px] text-teal-600" />
                    <span className="font-bold text-[16px]" data-testid="text-passenger-count">{passengers}</span>
                  </div>
                  <button
                    onClick={() => setPassengers(Math.min(10, passengers + 1))}
                    className="w-11 h-full text-lg font-bold text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors active:bg-teal-100"
                    data-testid="button-passenger-plus"
                  >+</button>
                </div>
              </div>
            </div>

            <Button
              onClick={search}
              size="lg"
              className="w-full mt-5 h-[54px] text-[15px] font-bold rounded-2xl bg-teal-900 hover:bg-teal-950 shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98]"
              disabled={!origin || !destination || !date || loading}
              data-testid="button-search"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 mr-1" />}
              Cari Tiket
            </Button>
          </div>
        </div>

        <div className="flex gap-2.5 mt-5 anim-slide-up delay-1">
          {[
            { icon: Zap, text: 'Pesan\nInstan', accent: 'text-amber-500', bg: 'bg-amber-50' },
            { icon: ShieldCheck, text: 'Bayar\nAman', accent: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: Clock, text: 'Support\n24/7', accent: 'text-violet-500', bg: 'bg-violet-50' },
          ].map((f) => (
            <div key={f.text} className="flex-1 bg-white rounded-2xl p-3 shadow-soft text-center">
              <div className={cn('w-9 h-9 rounded-xl mx-auto mb-1.5 flex items-center justify-center', f.bg)}>
                <f.icon className={cn('w-[18px] h-[18px]', f.accent)} />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 leading-tight whitespace-pre-line">{f.text}</p>
            </div>
          ))}
        </div>

        {cities.length > 0 && (
          <div className="mt-5 anim-slide-up delay-2">
            <h3 className="text-[13px] font-bold text-slate-700 mb-2.5 px-0.5">Rute Populer</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
              {cities.slice(0, 8).map((city) => (
                <button
                  key={city}
                  onClick={() => setOrigin(city)}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-full text-[13px] font-medium text-slate-600 hover:border-teal-400 hover:text-teal-800 hover:bg-teal-50/50 transition-all active:scale-95 shadow-sm"
                  data-testid={`chip-city-${city}`}
                >
                  <MapPin className="w-3 h-3 text-teal-500 shrink-0" />
                  {city}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <CityBottomSheet
        open={sheetFor !== null}
        title={sheetFor === 'origin' ? 'Kota Keberangkatan' : 'Kota Tujuan'}
        cities={cities}
        onSelect={selectCity}
        onClose={() => setSheetFor(null)}
      />
    </div>
  );
}

function CityField({ label, placeholder, value, onClick, testId, dotClass }: {
  label: string; placeholder: string; value: string;
  onClick: () => void; testId: string; dotClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative w-full text-left h-[62px] flex items-center hover:bg-teal-50/30 transition-colors"
      data-testid={testId}
    >
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <div className={cn('w-[10px] h-[10px] rounded-full', dotClass)} />
      </div>
      <div className="pl-11 pr-4 pt-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] block">{label}</span>
        {value ? (
          <span className="text-[15px] font-semibold text-slate-900 block mt-0.5">{value}</span>
        ) : (
          <span className="text-[15px] text-slate-300 block mt-0.5">{placeholder}</span>
        )}
      </div>
    </button>
  );
}

function CityBottomSheet({ open, title, cities, onSelect, onClose }: {
  open: boolean; title: string; cities: string[];
  onSelect: (city: string) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const filtered = cities.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-[1.5rem] transition-transform duration-300 ease-out',
          'max-h-[85vh] flex flex-col',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-[16px] font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            data-testid="button-close-sheet"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-300 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Cari kota..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-[14px] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/40 transition-all"
              data-testid="input-search-city"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2">
              <MapPin className="w-10 h-10 text-slate-200" />
              <p className="text-[13px] text-slate-400">Kota tidak ditemukan</p>
            </div>
          ) : (
            filtered.map((city) => (
              <button
                key={city}
                onClick={() => onSelect(city)}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-teal-50/50 active:bg-teal-50 transition-colors text-left"
                data-testid={`sheet-city-${city}`}
              >
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-[16px] h-[16px] text-teal-600" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-slate-800">{city}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Kota</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
