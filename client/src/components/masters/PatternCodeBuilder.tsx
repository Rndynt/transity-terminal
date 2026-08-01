import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchableSelectOption } from '@/components/ui/searchable-select';
import { computeNextPatternSeq, buildPatternCode } from '@/lib/patternCode';

export interface PatternForSeq {
  id: string;
  code: string;
}

export interface PickedStop {
  code: string;
  name: string;
}

type ChipRole = 'origin' | 'destination';

interface PatternCodeBuilderProps {
  /** Same shape already produced by TripPatternsManager's `stopOptions` (value=stopId, badge=stop code). */
  stopOptions: SearchableSelectOption[];
  /** All existing patterns (excluding the one being edited handles itself via editingPatternId), used to compute SEQ. */
  patterns: PatternForSeq[];
  editingPatternId?: string;
  /** True once the parent's computed-code duplicate check fires for the current code. */
  isDuplicateCode?: boolean;
  /** Fires with the fully-formed code every time it changes, once both endpoints are picked. */
  onCodeChange: (code: string) => void;
  /** Fires whenever the origin/destination pick changes, so the parent can drive the Nama Pola auto-fill. */
  onOriginDestChange?: (origin: PickedStop | null, dest: PickedStop | null) => void;
  'data-testid'?: string;
}

/**
 * Structured Kode Pola builder: pick an origin + destination stop (never hand-typed),
 * auto-computes the next sequence number for that exact pair, and leaves only an
 * optional free-form suffix editable. Renders as one bordered control so it reads
 * as a single field, not three separate inputs.
 *
 * Note on portals: this lives inside MasterFormDialog (a Radix Dialog). Radix Dialog
 * marks sibling document.body children inert while open (see the long comment in
 * searchable-select.tsx about the same issue), so the origin/destination dropdown
 * panels here are deliberately plain absolutely-positioned children (like the
 * existing codeSuggestions dropdown in TripPatternsManager.tsx) rather than
 * Radix Popover/PopoverContent, which portals to document.body by default and
 * would risk landing in an inert subtree and becoming unresponsive.
 */
export default function PatternCodeBuilder({
  stopOptions,
  patterns,
  editingPatternId,
  isDuplicateCode,
  onCodeChange,
  onOriginDestChange,
  ...props
}: PatternCodeBuilderProps) {
  const [originId, setOriginId] = useState('');
  const [destId, setDestId] = useState('');
  const [suffix, setSuffix] = useState('');
  const [openPicker, setOpenPicker] = useState<ChipRole | null>(null);

  const originOpt = useMemo(() => stopOptions.find(o => o.value === originId) || null, [stopOptions, originId]);
  const destOpt = useMemo(() => stopOptions.find(o => o.value === destId) || null, [stopOptions, destId]);
  const originCode = originOpt?.badge;
  const destCode = destOpt?.badge;

  const seq = useMemo(() => {
    if (!originCode || !destCode) return null;
    return computeNextPatternSeq(originCode, destCode, patterns, editingPatternId);
  }, [originCode, destCode, patterns, editingPatternId]);

  const computedCode = useMemo(() => {
    if (!originCode || !destCode || !seq) return null;
    return buildPatternCode(originCode, destCode, seq, suffix);
  }, [originCode, destCode, seq, suffix]);

  // Report the fully-formed code up the moment both endpoints are picked, and
  // keep re-reporting as seq/suffix shift. This is the "computed value overwrites
  // the code field" behavior from the spec — formData.code stays the single
  // source of truth in the parent either way.
  useEffect(() => {
    if (computedCode) onCodeChange(computedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedCode]);

  const lastNotifiedKey = useRef<string>('');
  useEffect(() => {
    const key = `${originId}|${destId}`;
    if (key === lastNotifiedKey.current) return;
    lastNotifiedKey.current = key;
    onOriginDestChange?.(
      originCode ? { code: originCode, name: originOpt!.label } : null,
      destCode ? { code: destCode, name: destOpt!.label } : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originId, destId]);

  const handleSuffixChange = (raw: string) => {
    setSuffix(raw.toUpperCase().replace(/^-+/, '').replace(/[^A-Z0-9-]/g, ''));
  };

  const reset = () => {
    setOriginId('');
    setDestId('');
    setSuffix('');
  };

  // Race-safe: two chips share one open/close slot. A stale blur-close timeout
  // from chip A must not clobber chip B if B has since taken over as the open one.
  const makeOpenHandler = (role: ChipRole) => (open: boolean) =>
    setOpenPicker(prev => (open ? role : prev === role ? null : prev));

  const bothPicked = !!(originCode && destCode);
  const showDuplicateWarning = !!(isDuplicateCode && computedCode);

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex items-stretch h-9 rounded-xl border bg-background transition-shadow',
          showDuplicateWarning ? 'border-destructive' : 'border-input focus-within:ring-1 focus-within:ring-primary/30'
        )}
        data-testid={props['data-testid'] || 'pattern-code-builder'}
      >
        <StopChip
          ariaLabel="Pilih halte asal"
          placeholder="Asal"
          options={stopOptions}
          excludeValue={destId}
          value={originId}
          onChange={setOriginId}
          isOpen={openPicker === 'origin'}
          onOpenChange={makeOpenHandler('origin')}
          testId="pattern-origin-chip"
        />
        <Separator />
        <StopChip
          ariaLabel="Pilih halte tujuan"
          placeholder="Tujuan"
          options={stopOptions}
          excludeValue={originId}
          value={destId}
          onChange={setDestId}
          isOpen={openPicker === 'destination'}
          onOpenChange={makeOpenHandler('destination')}
          testId="pattern-dest-chip"
        />
        <Separator />
        <div
          className="flex items-center px-2 font-mono text-xs font-semibold text-muted-foreground bg-muted/60 select-none whitespace-nowrap"
          title="Nomor urut otomatis untuk pasangan asal-tujuan ini"
          data-testid="pattern-seq"
        >
          {seq ?? '··'}
        </div>
        <Separator />
        <input
          value={suffix}
          onChange={(e) => handleSuffixChange(e.target.value)}
          disabled={!bothPicked}
          placeholder="opsional"
          title="Tambahan opsional, mis. REG atau STD"
          className="w-[4.5rem] px-1.5 bg-transparent text-xs font-mono focus:outline-none placeholder:text-muted-foreground/40 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="input-code-suffix"
        />
      </div>

      <div className="flex items-center justify-between gap-2 min-h-[1rem]">
        {showDuplicateWarning ? (
          <p className="text-xs text-destructive flex items-center gap-1" data-testid="error-duplicate-code">
            <span>⚠</span> Kode <span className="font-mono font-medium">"{computedCode}"</span> sudah digunakan oleh pola lain.
          </p>
        ) : (
          <p className="text-xs font-mono text-muted-foreground truncate">
            {computedCode ?? 'Pilih halte asal & tujuan…'}
          </p>
        )}
        {(originId || destId || suffix) && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            data-testid="pattern-code-reset"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>
    </div>
  );
}

function Separator() {
  return <div className="flex items-center px-0.5 text-muted-foreground/40 select-none">-</div>;
}

function StopChip({
  ariaLabel,
  placeholder,
  options,
  excludeValue,
  value,
  onChange,
  isOpen,
  onOpenChange,
  testId,
}: {
  ariaLabel: string;
  placeholder: string;
  options: SearchableSelectOption[];
  excludeValue: string;
  value: string;
  onChange: (id: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  testId: string;
}) {
  const [search, setSearch] = useState('');
  const selected = options.find(o => o.value === value) || null;

  const filtered = useMemo(() => {
    // A stop already picked as the other endpoint can't also be picked here —
    // avoids nonsense zero-length "same stop to itself" patterns.
    const base = options.filter(o => o.value !== excludeValue);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.badge?.toLowerCase().includes(q) ||
      o.group?.toLowerCase().includes(q)
    );
  }, [options, excludeValue, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchableSelectOption[]>();
    for (const o of filtered) {
      const g = o.group || 'Lainnya';
      const arr = map.get(g) || [];
      arr.push(o);
      map.set(g, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
        onBlur={() => setTimeout(() => onOpenChange(false), 150)}
        className={cn(
          'w-full h-full px-2.5 flex items-center text-xs truncate transition-colors hover:bg-accent/50 rounded-xl',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:z-10',
          selected ? 'font-mono font-semibold text-foreground' : 'text-muted-foreground/70'
        )}
        data-testid={testId}
      >
        <span className="truncate">{selected ? selected.badge : placeholder}</span>
      </button>
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-64 bg-popover border rounded-lg shadow-md flex flex-col overflow-hidden">
          <div className="p-1.5 border-b shrink-0 relative">
            <Search className="h-3 w-3 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onOpenChange(false); }}
              placeholder="Cari halte..."
              className="w-full h-7 pl-6 pr-2 text-xs bg-muted/50 rounded-md focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto py-1">
            {grouped.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Tidak ditemukan</p>
            )}
            {grouped.map(([group, items]) => (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2.5 pt-1.5 pb-0.5">{group}</p>
                {items.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={() => { onChange(opt.value); onOpenChange(false); setSearch(''); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                    data-testid={`${testId}-option-${opt.badge}`}
                  >
                    <span className="font-mono font-medium text-[11px] text-primary bg-primary/10 rounded px-1 py-0.5 shrink-0">{opt.badge}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
