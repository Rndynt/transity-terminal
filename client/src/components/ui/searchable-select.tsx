import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  group?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  clearValue?: string;
  'data-testid'?: string;
}

export function SearchableSelect({
  value,
  options,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyLabel,
  onChange,
  disabled = false,
  className,
  clearValue = '',
  ...props
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const upward = spaceBelow < 300 && spaceAbove > spaceBelow;
      setOpenUpward(upward);

      // Radix Dialog/AlertDialog calls aria-hidden's hideOthers() on its own
      // Content node, marking every OTHER document.body child inert. A dropdown
      // portaled straight to document.body would land in one of those inert
      // siblings and become unresponsive to touch/click/scroll (looks "frozen").
      // Fix: reparent into the enclosing dialog's Content node (role="dialog"/
      // "alertdialog") — it lives inside the kept-visible subtree. That node
      // also carries the transform Radix uses for centering, which becomes the
      // containing block for `position: fixed` descendants, so we compute the
      // dropdown's offset relative to it instead of the viewport.
      const dialogAncestor = containerRef.current.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement | null;
      setPortalTarget(dialogAncestor ?? document.body);
      const containerBox = dialogAncestor
        ? dialogAncestor.getBoundingClientRect()
        : { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };

      setDropdownRect({
        top: upward ? undefined : rect.bottom - containerBox.top + 4,
        bottom: upward ? containerBox.bottom - rect.top + 4 : undefined,
        left: rect.left - containerBox.left,
        width: rect.width
      });
    };

    updatePosition();

    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      clearTimeout(t);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.subtitle?.toLowerCase().includes(q) ||
      o.badge?.toLowerCase().includes(q) ||
      o.group?.toLowerCase().includes(q)
    );
  }, [options, search]);

  const grouped = useMemo(() => {
    const hasGroups = filtered.some(o => o.group);
    if (!hasGroups) return [{ group: null, items: filtered }];
    const map = new Map<string, SearchableSelectOption[]>();
    for (const o of filtered) {
      const g = o.group ?? '';
      const arr = map.get(g) ?? [];
      arr.push(o);
      map.set(g, arr);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group: group || null, items }));
  }, [filtered]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(clearValue);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        data-testid={props['data-testid']}
        className={cn(
          'w-full h-10 bg-white border rounded-xl px-3 flex items-center gap-2 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          open
            ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
            : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <span className={cn('flex-1 text-left truncate', selected ? 'text-foreground' : 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        {selected && selected.badge && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
            {selected.badge}
          </span>
        )}
        {selected && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && dropdownRect && portalTarget && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] bg-background border border-border rounded-xl shadow-lg flex flex-col overflow-hidden"
          style={{
            top: dropdownRect.top,
            bottom: dropdownRect.bottom,
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: '280px'
          }}
        >
          <div className="p-2 border-b border-border flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-8 pl-8 pr-3 bg-muted/50 border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {emptyLabel ?? 'Tidak ada hasil'}
              </div>
            ) : (
              grouped.map(({ group, items }, gi) => (
                <div key={gi}>
                  {group && (
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-background border-b border-border/50 sticky top-0 z-10">
                      {group}
                    </div>
                  )}
                  {items.map(opt => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          'w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-muted/60 transition-colors',
                          isSelected && 'bg-primary/8'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm truncate', isSelected ? 'text-primary font-medium' : 'text-foreground')}>
                            {opt.label}
                          </div>
                          {opt.subtitle && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{opt.subtitle}</div>
                          )}
                        </div>
                        {opt.badge && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
}
