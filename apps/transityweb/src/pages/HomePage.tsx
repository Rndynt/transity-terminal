import { useState, useEffect } from 'react';
import { useNav, useAuth } from '@/App';
import { tripsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowDownUp, Search, Loader2, MapPin, CalendarDays, Users, Zap, ShieldCheck, Clock } from 'lucide-react';
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
  const [showOriginList, setShowOriginList] = useState(false);
  const [showDestList, setShowDestList] = useState(false);

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

  const fo = cities.filter((c) => c.toLowerCase().includes(origin.toLowerCase()));
  const fd = cities.filter((c) => c.toLowerCase().includes(destination.toLowerCase()));

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
                <CityInput
                  label="Dari"
                  placeholder="Kota keberangkatan"
                  value={origin}
                  onChange={(v) => { setOrigin(v); setShowOriginList(true); }}
                  onFocus={() => setShowOriginList(true)}
                  onBlur={() => setTimeout(() => setShowOriginList(false), 200)}
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
                <CityInput
                  label="Ke"
                  placeholder="Kota tujuan"
                  value={destination}
                  onChange={(v) => { setDestination(v); setShowDestList(true); }}
                  onFocus={() => setShowDestList(true)}
                  onBlur={() => setTimeout(() => setShowDestList(false), 200)}
                  testId="input-destination"
                  dotClass="bg-coral-500"
                />
              </div>

              <Dropdown items={fo} show={showOriginList && !!origin} onSelect={(c) => { setOrigin(c); setShowOriginList(false); }} position="top" />
              <Dropdown items={fd} show={showDestList && !!destination} onSelect={(c) => { setDestination(c); setShowDestList(false); }} position="bottom" />
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
    </div>
  );
}

function CityInput({ label, placeholder, value, onChange, onFocus, onBlur, testId, dotClass }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; onFocus: () => void; onBlur: () => void;
  testId: string; dotClass: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <div className={cn('w-[10px] h-[10px] rounded-full', dotClass)} />
      </div>
      <span className="absolute left-11 top-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">{label}</span>
      <input
        className="w-full h-[62px] pl-11 pr-4 pt-4 text-[15px] font-semibold placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:bg-teal-50/20 transition-colors bg-transparent"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        data-testid={testId}
      />
    </div>
  );
}

function Dropdown({ items, show, onSelect, position }: {
  items: string[]; show: boolean; onSelect: (v: string) => void; position: 'top' | 'bottom';
}) {
  if (!show || items.length === 0) return null;
  return (
    <div className={cn(
      'absolute left-0 right-0 z-40 bg-white border border-slate-200 rounded-2xl shadow-float max-h-52 overflow-y-auto anim-scale',
      position === 'top' ? 'top-[68px]' : 'bottom-0 translate-y-[calc(100%+4px)]',
    )}>
      {items.map((c) => (
        <button key={c} className="w-full text-left px-4 py-3 text-[14px] font-medium hover:bg-teal-50 flex items-center gap-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl" onMouseDown={() => onSelect(c)}>
          <MapPin className="w-4 h-4 text-slate-300 shrink-0" />{c}
        </button>
      ))}
    </div>
  );
}
