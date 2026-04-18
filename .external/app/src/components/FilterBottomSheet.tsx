import { useState, useEffect, useRef, useMemo } from 'react';
import { X, CheckCircle2, Bus, ArrowUpDown, MapPin, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import OperatorLogo from '@/components/OperatorLogo';
import { useSheet } from '@/App';
import type { OperatorInfo, TripSearchResult } from '@/lib/api';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'depart-asc' | 'depart-desc';

interface FilterState {
  operator: string | null;
  sort: SortOption;
  pickupStop: string | null;
  dropStop: string | null;
}

interface Props {
  open: boolean;
  operators: OperatorInfo[];
  trips: TripSearchResult[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onClose: () => void;
}

interface StopOption {
  name: string;
  city: string;
  count: number;
}

function extractStops(trips: TripSearchResult[], type: 'pickup' | 'drop'): StopOption[] {
  const map = new Map<string, StopOption>();
  for (const trip of trips) {
    const raw = (trip as unknown as { raw?: { stops?: Array<{ name: string; city: string; boardingAllowed?: boolean; alightingAllowed?: boolean }> } }).raw;
    const stops = raw?.stops || [];
    for (const s of stops) {
      const allowed = type === 'pickup' ? s.boardingAllowed !== false : s.alightingAllowed !== false;
      if (!allowed) continue;
      const key = s.name;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { name: s.name, city: s.city, count: 1 });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

const SORT_OPTIONS: { value: SortOption; label: string; desc: string }[] = [
  { value: 'default', label: 'Standar', desc: 'Urutan default' },
  { value: 'price-asc', label: 'Harga Terendah', desc: 'Termurah di atas' },
  { value: 'price-desc', label: 'Harga Tertinggi', desc: 'Termahal di atas' },
  { value: 'depart-asc', label: 'Berangkat Paling Awal', desc: 'Jadwal paling pagi' },
  { value: 'depart-desc', label: 'Berangkat Paling Akhir', desc: 'Jadwal paling malam' },
];

export type { FilterState, SortOption };

export default function FilterBottomSheet({ open, operators, trips, filters, onChange, onClose }: Props) {
  const [local, setLocal] = useState<FilterState>(filters);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { setSheetOpen } = useSheet();

  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  useEffect(() => {
    setSheetOpen(open);
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; setSheetOpen(false); };
  }, [open, setSheetOpen]);

  const pickupStops = useMemo(() => extractStops(trips, 'pickup'), [trips]);
  const dropStops = useMemo(() => extractStops(trips, 'drop'), [trips]);

  const activeCount = [
    local.operator !== null,
    local.sort !== 'default',
    local.pickupStop !== null,
    local.dropStop !== null,
  ].filter(Boolean).length;

  const handleApply = () => {
    onChange(local);
    onClose();
  };

  const handleReset = () => {
    const reset: FilterState = { operator: null, sort: 'default', pickupStop: null, dropStop: null };
    setLocal(reset);
    onChange(reset);
    onClose();
  };

  const toggleSection = (s: string) => setExpandedSection(expandedSection === s ? null : s);

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
        ref={sheetRef}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-[1.5rem] transition-transform duration-300 ease-out shadow-[0_-4px_30px_rgba(0,0,0,0.12)]',
          'flex flex-col',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ height: '85vh' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-slate-800">Filter & Urutkan</h2>
            {activeCount > 0 && (
              <span className="bg-teal-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeCount}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          <div className="mb-3">
            <button
              onClick={() => toggleSection('sort')}
              className="w-full flex items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', local.sort !== 'default' ? 'bg-teal-50' : 'bg-slate-100')}>
                  <ArrowUpDown className={cn('w-4 h-4', local.sort !== 'default' ? 'text-teal-600' : 'text-slate-400')} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-700">Urutkan</p>
                  <p className="text-[11px] text-slate-400">{SORT_OPTIONS.find(s => s.value === local.sort)?.label || 'Standar'}</p>
                </div>
              </div>
              {expandedSection === 'sort' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedSection === 'sort' && (
              <div className="pb-2 space-y-0.5 anim-fade">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLocal(p => ({ ...p, sort: opt.value }))}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                      local.sort === opt.value ? 'bg-teal-50' : 'hover:bg-slate-50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[13px] font-medium', local.sort === opt.value ? 'text-teal-700' : 'text-slate-700')}>{opt.label}</p>
                      <p className="text-[10px] text-slate-400">{opt.desc}</p>
                    </div>
                    {local.sort === opt.value && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 mb-3" />

          <div className="mb-3">
            <button
              onClick={() => toggleSection('operator')}
              className="w-full flex items-center justify-between py-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', local.operator ? 'bg-teal-50' : 'bg-slate-100')}>
                  <Bus className={cn('w-4 h-4', local.operator ? 'text-teal-600' : 'text-slate-400')} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-700">Operator</p>
                  <p className="text-[11px] text-slate-400">
                    {local.operator ? operators.find(o => o.slug === local.operator)?.name || local.operator : 'Semua operator'}
                  </p>
                </div>
              </div>
              {expandedSection === 'operator' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedSection === 'operator' && (
              <div className="pb-2 space-y-0.5 anim-fade">
                <button
                  onClick={() => setLocal(p => ({ ...p, operator: null }))}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                    local.operator === null ? 'bg-teal-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', local.operator === null ? 'bg-teal-600' : 'bg-slate-100')}>
                    <Bus className={cn('w-4 h-4', local.operator === null ? 'text-white' : 'text-slate-400')} />
                  </div>
                  <p className={cn('text-[13px] font-medium flex-1', local.operator === null ? 'text-teal-700' : 'text-slate-700')}>Semua Operator</p>
                  {local.operator === null && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                </button>
                {operators.map(op => (
                  <button
                    key={op.slug}
                    onClick={() => setLocal(p => ({ ...p, operator: op.slug }))}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                      local.operator === op.slug ? 'bg-teal-50' : 'hover:bg-slate-50'
                    )}
                  >
                    <OperatorLogo name={op.name} logo={op.logo} color={op.color} size="sm" className="!w-8 !h-8 !rounded-lg" />
                    <p className={cn('text-[13px] font-medium flex-1', local.operator === op.slug ? 'text-teal-700' : 'text-slate-700')}>{op.name}</p>
                    {local.operator === op.slug && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {pickupStops.length > 1 && (
            <>
              <div className="border-t border-slate-100 mb-3" />
              <div className="mb-3">
                <button
                  onClick={() => toggleSection('pickup')}
                  className="w-full flex items-center justify-between py-3 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', local.pickupStop ? 'bg-teal-50' : 'bg-slate-100')}>
                      <MapPin className={cn('w-4 h-4', local.pickupStop ? 'text-teal-600' : 'text-slate-400')} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-700">Titik Naik</p>
                      <p className="text-[11px] text-slate-400">{local.pickupStop || 'Semua titik naik'}</p>
                    </div>
                  </div>
                  {expandedSection === 'pickup' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSection === 'pickup' && (
                  <div className="pb-2 space-y-0.5 anim-fade">
                    <button
                      onClick={() => setLocal(p => ({ ...p, pickupStop: null }))}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                        local.pickupStop === null ? 'bg-teal-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <p className={cn('text-[13px] font-medium flex-1', local.pickupStop === null ? 'text-teal-700' : 'text-slate-700')}>Semua Titik Naik</p>
                      {local.pickupStop === null && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                    </button>
                    {pickupStops.map(stop => (
                      <button
                        key={stop.name}
                        onClick={() => setLocal(p => ({ ...p, pickupStop: stop.name }))}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                          local.pickupStop === stop.name ? 'bg-teal-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-[13px] font-medium', local.pickupStop === stop.name ? 'text-teal-700' : 'text-slate-700')}>{stop.name}</p>
                          <p className="text-[10px] text-slate-400">{stop.city}</p>
                        </div>
                        {local.pickupStop === stop.name && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {dropStops.length > 1 && (
            <>
              <div className="border-t border-slate-100 mb-3" />
              <div className="mb-3">
                <button
                  onClick={() => toggleSection('drop')}
                  className="w-full flex items-center justify-between py-3 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', local.dropStop ? 'bg-emerald-50' : 'bg-slate-100')}>
                      <MapPin className={cn('w-4 h-4', local.dropStop ? 'text-emerald-600' : 'text-slate-400')} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-700">Titik Turun</p>
                      <p className="text-[11px] text-slate-400">{local.dropStop || 'Semua titik turun'}</p>
                    </div>
                  </div>
                  {expandedSection === 'drop' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSection === 'drop' && (
                  <div className="pb-2 space-y-0.5 anim-fade">
                    <button
                      onClick={() => setLocal(p => ({ ...p, dropStop: null }))}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                        local.dropStop === null ? 'bg-teal-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <p className={cn('text-[13px] font-medium flex-1', local.dropStop === null ? 'text-teal-700' : 'text-slate-700')}>Semua Titik Turun</p>
                      {local.dropStop === null && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                    </button>
                    {dropStops.map(stop => (
                      <button
                        key={stop.name}
                        onClick={() => setLocal(p => ({ ...p, dropStop: stop.name }))}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                          local.dropStop === stop.name ? 'bg-teal-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-[13px] font-medium', local.dropStop === stop.name ? 'text-teal-700' : 'text-slate-700')}>{stop.name}</p>
                          <p className="text-[10px] text-slate-400">{stop.city}</p>
                        </div>
                        {local.dropStop === stop.name && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="h-4" />
        </div>

        <div className="shrink-0 px-5 pt-3 pb-6 border-t border-slate-100 bg-white safe-bottom">
          <div className="flex gap-3">
            {activeCount > 0 && (
              <button
                onClick={handleReset}
                className="h-12 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-2 active:scale-[0.97]"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
            <button
              onClick={handleApply}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white text-[14px] font-bold transition-colors active:scale-[0.97]"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
