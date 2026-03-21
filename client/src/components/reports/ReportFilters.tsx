import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, X } from 'lucide-react';

interface FilterOptions {
  outlets: { id: string; name: string }[];
  patterns: { id: string; code: string; name: string }[];
  channels: string[];
}

export interface ReportFilterValues {
  dateFrom: string;
  dateTo: string;
  outletId?: string;
  channel?: string;
  patternId?: string;
}

interface ReportFiltersProps {
  value: ReportFilterValues;
  onChange: (v: ReportFilterValues) => void;
  showOutlet?: boolean;
  showChannel?: boolean;
  showRoute?: boolean;
}

const PRESETS = [
  { label: 'Hari Ini', getValue: () => { const d = new Date().toISOString().split('T')[0]; return { dateFrom: d, dateTo: d }; } },
  { label: '7 Hari', getValue: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 6); return { dateFrom: f.toISOString().split('T')[0], dateTo: t.toISOString().split('T')[0] }; } },
  { label: '30 Hari', getValue: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 29); return { dateFrom: f.toISOString().split('T')[0], dateTo: t.toISOString().split('T')[0] }; } },
  { label: 'Bulan Ini', getValue: () => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth(), 1); return { dateFrom: f.toISOString().split('T')[0], dateTo: t.toISOString().split('T')[0] }; } },
];

export default function ReportFilters({ value, onChange, showOutlet = true, showChannel = true, showRoute = true }: ReportFiltersProps) {
  const { data: options } = useQuery<FilterOptions>({
    queryKey: ['/api/reports/filter-options'],
    queryFn: async () => {
      const res = await fetch('/api/reports/filter-options');
      if (!res.ok) throw new Error('Failed to fetch filter options');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const hasActiveFilters = value.outletId || value.channel || value.patternId;

  const clearFilters = () => {
    onChange({ ...value, outletId: undefined, channel: undefined, patternId: undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 mr-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
            className="border rounded-md px-2 py-1.5 text-sm h-9"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <input
            type="date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
            className="border rounded-md px-2 py-1.5 text-sm h-9"
          />
        </div>

        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const range = p.getValue();
                onChange({ ...value, ...range });
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showRoute && options?.patterns && (
          <select
            value={value.patternId || ''}
            onChange={(e) => onChange({ ...value, patternId: e.target.value || undefined })}
            className="border rounded-md px-2 py-1.5 text-sm h-9 min-w-[160px]"
          >
            <option value="">Semua Rute</option>
            {options.patterns.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        )}

        {showOutlet && options?.outlets && (
          <select
            value={value.outletId || ''}
            onChange={(e) => onChange({ ...value, outletId: e.target.value || undefined })}
            className="border rounded-md px-2 py-1.5 text-sm h-9 min-w-[160px]"
          >
            <option value="">Semua Outlet</option>
            {options.outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}

        {showChannel && (
          <select
            value={value.channel || ''}
            onChange={(e) => onChange({ ...value, channel: e.target.value || undefined })}
            className="border rounded-md px-2 py-1.5 text-sm h-9 min-w-[120px]"
          >
            <option value="">Semua Channel</option>
            {options?.channels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="w-3 h-3 mr-1" /> Reset Filter
          </Button>
        )}
      </div>
    </div>
  );
}
