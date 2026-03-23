import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { X, SlidersHorizontal, ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOptions {
  outlets: { id: string; name: string }[];
  patterns: { id: string; code: string; name: string }[];
  channels: string[];
}

export type DateMode = 'departure' | 'paid' | 'created';

export interface ReportFilterValues {
  dateFrom: string;
  dateTo: string;
  dateMode?: DateMode;
  outletId?: string;
  channel?: string;
  patternId?: string;
}

export interface DateModeOption {
  value: DateMode;
  label: string;
}

interface ReportFiltersProps {
  value: ReportFilterValues;
  onChange: (v: ReportFilterValues) => void;
  showOutlet?: boolean;
  showChannel?: boolean;
  showRoute?: boolean;
  lockedOutletId?: string;
  dateModeOptions?: DateModeOption[];
}

const PRESETS = [
  { label: 'Hari Ini', getValue: () => { const d = new Date().toISOString().split('T')[0]; return { dateFrom: d, dateTo: d }; } },
  { label: '7 Hari', getValue: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 6); return { dateFrom: f.toISOString().split('T')[0], dateTo: t.toISOString().split('T')[0] }; } },
  { label: '30 Hari', getValue: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 29); return { dateFrom: f.toISOString().split('T')[0], dateTo: t.toISOString().split('T')[0] }; } },
  { label: 'Bulan Ini', getValue: () => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth(), 1); return { dateFrom: f.toISOString().split('T')[0], dateTo: t.toISOString().split('T')[0] }; } },
];

export default function ReportFilters({ value, onChange, showOutlet = true, showChannel = true, showRoute = true, lockedOutletId, dateModeOptions }: ReportFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (lockedOutletId && value.outletId !== lockedOutletId) {
      onChange({ ...value, outletId: lockedOutletId });
    }
  }, [lockedOutletId]);


  const { data: options } = useQuery<FilterOptions>({
    queryKey: ['/api/reports/filter-options'],
    queryFn: async () => {
      const res = await fetch('/api/reports/filter-options');
      if (!res.ok) throw new Error('Failed to fetch filter options');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const hasExtraFilters = showRoute || showOutlet || showChannel;
  const activeFilterCount = [value.outletId, value.channel, value.patternId].filter(Boolean).length;

  const clearFilters = () => {
    onChange({ ...value, outletId: undefined, channel: undefined, patternId: undefined });
  };

  const routeOptions = (options?.patterns || []).map(p => ({
    value: p.id,
    label: `${p.code} — ${p.name}`,
    subtitle: p.code,
  }));

  const outletOptions = (options?.outlets || []).map(o => ({
    value: o.id,
    label: o.name,
  }));

  const channelOptions = (options?.channels || []).map(c => ({
    value: c,
    label: c,
  }));

  return (
    <div className="space-y-2.5">
      {dateModeOptions && dateModeOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="date-mode-toggle">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Berdasarkan:</span>
          {dateModeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, dateMode: opt.value })}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap",
                value.dateMode === opt.value
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
              )}
              data-testid={`btn-date-mode-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Input
            type="date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
            className="h-9 text-sm min-w-0"
          />
          <span className="text-sm text-muted-foreground">—</span>
          <Input
            type="date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
            className="h-9 text-sm min-w-0"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5 sm:px-3"
              onClick={() => {
                const range = p.getValue();
                onChange({ ...value, ...range });
              }}
            >
              {p.label}
            </Button>
          ))}

          {hasExtraFilters && (
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 text-xs gap-1.5", filtersOpen && "bg-muted")}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-bold rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={cn("w-3 h-3 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
          )}
        </div>
      </div>

      {hasExtraFilters && (
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 pb-1 border-t border-border/50">
              {showRoute && (
                <div className="min-w-0">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Rute</label>
                  <SearchableSelect
                    value={value.patternId || ''}
                    onChange={(v) => onChange({ ...value, patternId: v || undefined })}
                    options={routeOptions}
                    placeholder="Semua Rute"
                    searchPlaceholder="Cari rute..."
                    emptyLabel="Rute tidak ditemukan"
                    className="w-full"
                  />
                </div>
              )}

              {showOutlet && (
                <div className="min-w-0">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    Outlet
                    {lockedOutletId && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                  </label>
                  {lockedOutletId ? (
                    <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-800">
                      <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="truncate font-medium">
                        {outletOptions.find(o => o.value === lockedOutletId)?.label || lockedOutletId}
                      </span>
                    </div>
                  ) : (
                    <SearchableSelect
                      value={value.outletId || ''}
                      onChange={(v) => onChange({ ...value, outletId: v || undefined })}
                      options={outletOptions}
                      placeholder="Semua Outlet"
                      searchPlaceholder="Cari outlet..."
                      emptyLabel="Outlet tidak ditemukan"
                      className="w-full"
                    />
                  )}
                </div>
              )}

              {showChannel && (
                <div className="min-w-0">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Channel</label>
                  <SearchableSelect
                    value={value.channel || ''}
                    onChange={(v) => onChange({ ...value, channel: v || undefined })}
                    options={channelOptions}
                    placeholder="Semua Channel"
                    searchPlaceholder="Cari channel..."
                    emptyLabel="Channel tidak ditemukan"
                    className="w-full"
                  />
                </div>
              )}

              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground gap-1" onClick={clearFilters}>
                    <X className="w-3.5 h-3.5" /> Reset Filter
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
