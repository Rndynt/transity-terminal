import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronRight, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react';
import { RowActionsMenu } from './RowActionsMenu';

interface TripBase {
  id: string;
  patternId: string;
  code?: string;
  name: string;
  active: boolean;
  timezone: string;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
  validFrom?: string;
  validTo?: string;
  defaultLayoutId?: string;
  defaultVehicleId?: string;
  capacity?: number;
  channelFlags: any;
  defaultStopTimes: any[];
  createdAt: string;
  updatedAt: string;
}

interface TripPattern {
  id: string;
  code: string;
  name: string;
  note?: string;
}

interface Layout {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  code: string;
  plate: string;
}

interface TripBaseGroupListProps {
  filteredTripBases: TripBase[];
  patterns: TripPattern[];
  layouts: Layout[];
  vehicles: Vehicle[];
  expandedGroups: Set<string>;
  onToggleGroup: (patternId: string) => void;
  onToggleAll: (expanded: boolean, patternIds: string[]) => void;
  onEdit: (base: TripBase) => void;
  onDelete: (id: string) => void;
}

const getOriginDepartTime = (defaultStopTimes: any[]): string => {
  if (!defaultStopTimes || defaultStopTimes.length === 0) return '-';
  const firstStop = defaultStopTimes.find((st: any) => st.stopSequence === 1);
  return firstStop?.departAt || '-';
};

const getDowBadges = (base: TripBase) => {
  const days = [
    { key: 'sun', label: 'Mg', active: base.sun },
    { key: 'mon', label: 'Sn', active: base.mon },
    { key: 'tue', label: 'Sl', active: base.tue },
    { key: 'wed', label: 'Rb', active: base.wed },
    { key: 'thu', label: 'Km', active: base.thu },
    { key: 'fri', label: 'Jm', active: base.fri },
    { key: 'sat', label: 'Sb', active: base.sat }
  ];

  return (
    <div className="flex gap-0.5">
      {days.map(day => (
        <span
          key={day.key}
          className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-semibold leading-none transition-colors ${
            day.active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground/40'
          }`}
        >
          {day.label}
        </span>
      ))}
    </div>
  );
};

export default function TripBaseGroupList({
  filteredTripBases,
  patterns,
  layouts,
  vehicles,
  expandedGroups,
  onToggleGroup,
  onToggleAll,
  onEdit,
  onDelete,
}: TripBaseGroupListProps) {
  const timeToMinutes = (t: string) => {
    if (!t || t === '-') return 9999;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const groups: { pattern: TripPattern | undefined; patternId: string; bases: TripBase[] }[] = [];
  const seen = new Set<string>();
  filteredTripBases.forEach((base: TripBase) => {
    if (!seen.has(base.patternId)) {
      seen.add(base.patternId);
      groups.push({
        patternId: base.patternId,
        pattern: patterns.find((p: TripPattern) => p.id === base.patternId),
        bases: [],
      });
    }
    groups.find(g => g.patternId === base.patternId)!.bases.push(base);
  });
  groups.sort((a, b) => (a.pattern?.code || '').localeCompare(b.pattern?.code || ''));
  groups.forEach(g => {
    g.bases.sort((a, b) =>
      timeToMinutes(getOriginDepartTime(a.defaultStopTimes)) -
      timeToMinutes(getOriginDepartTime(b.defaultStopTimes))
    );
  });

  const allExpanded = groups.every(g => expandedGroups.has(g.patternId));

  return (
    <div className="rounded-md border overflow-hidden divide-y">
      <div className="flex items-center justify-end px-4 py-2 bg-muted/20">
        <button
          type="button"
          onClick={() => onToggleAll(!allExpanded, groups.map(g => g.patternId))}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allExpanded ? 'Tutup semua' : 'Buka semua'}
        </button>
      </div>

      {groups.map(({ pattern, patternId, bases }) => {
        const isExpanded = expandedGroups.has(patternId);
        const activeCnt = bases.filter(b => b.active).length;
        const times = bases.map(b => getOriginDepartTime(b.defaultStopTimes)).filter(t => t !== '-');
        const firstTime = times[0];
        const lastTime = times[times.length - 1];

        return (
          <div key={patternId} data-testid={`group-${patternId}`}>
            <button
              type="button"
              onClick={() => onToggleGroup(patternId)}
              className="sticky top-0 z-20 h-16 w-full flex items-center justify-between gap-3 px-4 bg-card hover:bg-muted/40 transition-colors text-left border-b"
              data-testid={`group-toggle-${patternId}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-nowrap min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {pattern?.name || 'Unknown'}
                    </span>
                    {pattern?.code && (
                      <span className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                        {pattern.code}
                      </span>
                    )}
                  </div>
                  {firstTime && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {firstTime}{lastTime && lastTime !== firstTime ? ` — ${lastTime}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-[10px] h-5">
                  {activeCnt}/{bases.length} aktif
                </Badge>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t bg-muted/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-16 z-10 bg-muted">
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left px-4 py-2 font-medium">Nama</th>
                      <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Kode</th>
                      <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Berangkat</th>
                      <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Hari</th>
                      <th className="text-left px-3 py-2 font-medium hidden xl:table-cell">Layout</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bases.map(base => {
                      const layout = base.defaultLayoutId ? layouts.find(l => l.id === base.defaultLayoutId) : null;
                      const vehicle = base.defaultVehicleId ? vehicles.find(v => v.id === base.defaultVehicleId) : null;
                      const departTime = getOriginDepartTime(base.defaultStopTimes);

                      return (
                        <tr
                          key={base.id}
                          className="hover:bg-muted/20 transition-colors"
                          data-testid={`row-base-${base.id}`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-foreground leading-tight">{base.name}</div>
                            {vehicle && (
                              <span className="text-[11px] text-muted-foreground">
                                {vehicle.code} · {vehicle.plate}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            {base.code ? (
                              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{base.code}</span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            {departTime !== '-' ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-semibold tabular-nums text-foreground">{departTime}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 hidden lg:table-cell">
                            {getDowBadges(base)}
                          </td>
                          <td className="px-3 py-2.5 hidden xl:table-cell">
                            {layout ? (
                              <span className="text-xs">{layout.name}</span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge
                              variant={base.active ? 'default' : 'secondary'}
                              className={`text-[10px] h-5 ${base.active ? '' : 'opacity-50'}`}
                            >
                              {base.active ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <RowActionsMenu
                              actions={[
                                { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => onEdit(base) },
                                { label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => onDelete(base.id), variant: 'destructive' },
                              ]}
                              data-testid={`actions-base-${base.id}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
