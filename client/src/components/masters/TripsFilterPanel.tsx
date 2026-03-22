import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Search, X, Filter } from 'lucide-react';
import type { TripPattern } from '@/types';

const DATE_PRESETS = [
  { key: 'today',      label: 'Hari Ini' },
  { key: 'tomorrow',   label: 'Besok' },
  { key: 'this_week',  label: 'Minggu Ini' },
  { key: 'this_month', label: 'Bulan Ini' },
  { key: 'next_month', label: 'Bulan Depan' },
  { key: 'custom',     label: 'Kustom' },
] as const;

function ActiveFilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      {label}
      <button onClick={onRemove} className="hover:text-primary/60 transition-colors ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

interface TripsFilterPanelProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterPatternId: string;
  onFilterPatternChange: (id: string) => void;
  filterDateFrom: string;
  filterDateTo: string;
  onFilterDateFromChange: (v: string) => void;
  onFilterDateToChange: (v: string) => void;
  datePreset: string;
  onDatePresetChange: (preset: string) => void;
  showFilters: boolean;
  onShowFiltersChange: (show: boolean) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  uniquePatterns: TripPattern[];
  getPatternName: (id: string) => string | undefined;
}

export default function TripsFilterPanel({
  searchQuery,
  onSearchChange,
  filterPatternId,
  onFilterPatternChange,
  filterDateFrom,
  filterDateTo,
  onFilterDateFromChange,
  onFilterDateToChange,
  datePreset,
  onDatePresetChange,
  showFilters,
  onShowFiltersChange,
  activeFilterCount,
  onClearAll,
  uniquePatterns,
  getPatternName,
}: TripsFilterPanelProps) {
  const applyDatePreset = (preset: string) => {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    onDatePresetChange(preset);
    if (preset === 'today') {
      onFilterDateFromChange(fmt(today));
      onFilterDateToChange(fmt(today));
    } else if (preset === 'tomorrow') {
      const d = new Date(today); d.setDate(d.getDate() + 1);
      onFilterDateFromChange(fmt(d));
      onFilterDateToChange(fmt(d));
    } else if (preset === 'this_week') {
      const day = today.getDay();
      const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      onFilterDateFromChange(fmt(mon));
      onFilterDateToChange(fmt(sun));
    } else if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      onFilterDateFromChange(fmt(start));
      onFilterDateToChange(fmt(end));
    } else if (preset === 'next_month') {
      const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const end   = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      onFilterDateFromChange(fmt(start));
      onFilterDateToChange(fmt(end));
    } else if (preset === 'custom') {
      onFilterDateFromChange('');
      onFilterDateToChange('');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Cari rute, kode, atau plat kendaraan..."
            className="pl-9 pr-9"
            data-testid="trip-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowFiltersChange(!showFilters)}
          data-testid="toggle-filters-button"
          className={showFilters || activeFilterCount > 0 ? 'border-primary text-primary bg-primary/5' : ''}
        >
          <Filter className="h-4 w-4 mr-1.5" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5 mr-1" />
            Hapus Filter
          </Button>
        )}
      </div>

      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rute / Pola</Label>
              <SearchableSelect
                value={filterPatternId}
                options={[
                  { value: 'all', label: 'Semua rute' },
                  ...uniquePatterns.map(p => ({
                    value: p.id,
                    label: p.name,
                    badge: p.code || undefined,
                    subtitle: p.vehicleClass || undefined,
                  }))
                ]}
                placeholder="Semua rute"
                searchPlaceholder="Cari nama atau kode rute..."
                onChange={onFilterPatternChange}
                clearValue="all"
                data-testid="filter-pattern-select"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rentang Tanggal</Label>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyDatePreset(key)}
                    data-testid={`preset-${key}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      datePreset === key
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(datePreset === 'custom' || (!datePreset && (filterDateFrom || filterDateTo))) && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Dari</Label>
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={e => { onFilterDateFromChange(e.target.value); onDatePresetChange('custom'); }}
                      data-testid="filter-date-from"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Sampai</Label>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={e => { onFilterDateToChange(e.target.value); onDatePresetChange('custom'); }}
                      data-testid="filter-date-to"
                    />
                  </div>
                </div>
              )}

              {datePreset && datePreset !== 'custom' && (filterDateFrom || filterDateTo) && (
                <p className="text-xs text-muted-foreground">
                  {filterDateFrom === filterDateTo
                    ? filterDateFrom
                    : `${filterDateFrom} — ${filterDateTo}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter aktif:</span>
          {filterPatternId !== 'all' && (
            <ActiveFilterPill
              label={`Rute: ${getPatternName(filterPatternId) || filterPatternId}`}
              onRemove={() => onFilterPatternChange('all')}
            />
          )}
          {(filterDateFrom || filterDateTo) && (
            <ActiveFilterPill
              label={(() => {
                const preset = DATE_PRESETS.find(p => p.key === datePreset);
                if (preset && datePreset !== 'custom') return `Tanggal: ${preset.label}`;
                if (filterDateFrom === filterDateTo && filterDateFrom) return `Tanggal: ${filterDateFrom}`;
                if (filterDateFrom && filterDateTo) return `${filterDateFrom} — ${filterDateTo}`;
                if (filterDateFrom) return `Dari: ${filterDateFrom}`;
                return `Sampai: ${filterDateTo}`;
              })()}
              onRemove={() => { onFilterDateFromChange(''); onFilterDateToChange(''); onDatePresetChange(''); }}
            />
          )}
        </div>
      )}
    </>
  );
}
