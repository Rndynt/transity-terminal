import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, ChevronRight, ChevronsUpDown, Pencil, Trash2, FileText, ClipboardList, Route, Grid3X3, User, Bus } from 'lucide-react';
import { RowActionsMenu } from './RowActionsMenu';
import { TripStatusBadge } from '@/components/shared/StatusBadges';
import type { Trip, TripPattern, Vehicle } from '@/types';

interface TripsGroupListProps {
  trips: Trip[];
  patterns: TripPattern[];
  getVehicle: (vehicleId: string) => Vehicle | undefined;
  getDepartureTime: (trip: any) => string | null;
  formatServiceDate: (dateStr: string) => string;
  expandedGroups: Set<string>;
  onToggleGroup: (patternId: string) => void;
  onToggleAll: (expanded: boolean, patternIds: string[]) => void;
  onEdit: (trip: Trip) => void;
  onDelete: (id: string) => void;
  onScheduling: (trip: Trip) => void;
  onManifest: (tripId: string) => void;
  onCreateSpj: (tripId: string) => void;
  onDeriveLegs: (tripId: string) => void;
  onPrecomputeInventory: (tripId: string) => void;
  isDeleting: boolean;
  isCreatingSpj: boolean;
  isDerivingLegs: boolean;
  isPrecomputingInventory: boolean;
  // Bulk selection
  selectedTripIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onGroupSelect: (patternId: string, tripIds: string[], checked: boolean) => void;
  canDelete: boolean;
}

export default function TripsGroupList({
  trips,
  patterns,
  getVehicle,
  getDepartureTime,
  formatServiceDate,
  expandedGroups,
  onToggleGroup,
  onToggleAll,
  onEdit,
  onDelete,
  onScheduling,
  onManifest,
  onCreateSpj,
  onDeriveLegs,
  onPrecomputeInventory,
  isDeleting,
  isCreatingSpj,
  isDerivingLegs,
  isPrecomputingInventory,
  selectedTripIds,
  onToggleSelect,
  onGroupSelect,
  canDelete,
}: TripsGroupListProps) {
  const groups: { pattern: TripPattern | undefined; patternId: string; trips: Trip[] }[] = [];
  const seen = new Set<string>();
  trips.forEach((trip) => {
    if (!seen.has(trip.patternId)) {
      seen.add(trip.patternId);
      groups.push({
        patternId: trip.patternId,
        pattern: patterns.find((p) => p.id === trip.patternId),
        trips: [],
      });
    }
    groups.find((g) => g.patternId === trip.patternId)!.trips.push(trip);
  });

  // Sort groups by earliest upcoming date/time within the group
  groups.forEach((g) => {
    g.trips.sort((a, b) => {
      if (a.serviceDate !== b.serviceDate) return a.serviceDate.localeCompare(b.serviceDate);
      const aTime = getDepartureTime(a) || '';
      const bTime = getDepartureTime(b) || '';
      return aTime.localeCompare(bTime);
    });
  });
  groups.sort((a, b) => {
    const aFirst = a.trips[0];
    const bFirst = b.trips[0];
    if (!aFirst || !bFirst) return (a.pattern?.code || '').localeCompare(b.pattern?.code || '');
    if (aFirst.serviceDate !== bFirst.serviceDate) return aFirst.serviceDate.localeCompare(bFirst.serviceDate);
    return (a.pattern?.code || '').localeCompare(b.pattern?.code || '');
  });

  const allExpanded = groups.length > 0 && groups.every((g) => expandedGroups.has(g.patternId));

  return (
    <div className="divide-y" data-testid="trips-group-list">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/20">
        <span className="text-xs text-muted-foreground">{groups.length} rute</span>
        <button
          type="button"
          onClick={() => onToggleAll(!allExpanded, groups.map((g) => g.patternId))}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="toggle-all-trip-groups"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allExpanded ? 'Tutup semua' : 'Buka semua'}
        </button>
      </div>

      {groups.map(({ pattern, patternId, trips: groupTrips }) => {
        const isExpanded = expandedGroups.has(patternId);
        const scheduledCnt = groupTrips.filter((t) => (t.status || 'scheduled') === 'scheduled').length;
        const dates = groupTrips.map((t) => t.serviceDate);
        const minDate = dates.reduce((a, b) => (a < b ? a : b));
        const maxDate = dates.reduce((a, b) => (a > b ? a : b));

        const groupTripIds = groupTrips.map((t) => t.id);
        const allGroupSelected = groupTripIds.length > 0 && groupTripIds.every((id) => selectedTripIds.has(id));
        const someGroupSelected = groupTripIds.some((id) => selectedTripIds.has(id));

        return (
          <div key={patternId} data-testid={`trip-group-${patternId}`}>
            <button
              type="button"
              onClick={() => onToggleGroup(patternId)}
              className="sticky top-0 z-20 h-16 w-full flex items-center justify-between gap-3 px-4 bg-card hover:bg-muted/40 transition-colors text-left border-b"
              data-testid={`trip-group-toggle-${patternId}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Group-level checkbox — stop propagation so click doesn't toggle expand */}
                <span
                  onClick={(e) => { e.stopPropagation(); onGroupSelect(patternId, groupTripIds, !allGroupSelected); }}
                  className="shrink-0"
                >
                  <Checkbox
                    checked={allGroupSelected}
                    data-state={someGroupSelected && !allGroupSelected ? 'indeterminate' : undefined}
                    className="pointer-events-none"
                  />
                </span>
                <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-nowrap min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {pattern?.name || 'Rute tidak ditemukan'}
                    </span>
                    {pattern?.code && (
                      <span className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                        {pattern.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {minDate === maxDate ? formatServiceDate(minDate) : `${formatServiceDate(minDate)} — ${formatServiceDate(maxDate)}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-[10px] h-5">
                  {groupTrips.length} trip
                </Badge>
                <Badge variant="outline" className="text-[10px] h-5 hidden sm:inline-flex">
                  {scheduledCnt} terjadwal
                </Badge>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t bg-muted/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-16 z-10 bg-muted">
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="w-10 px-4 py-2" />
                      <th className="text-left px-4 py-2 font-medium">Tanggal</th>
                      <th className="text-left px-3 py-2 font-medium">Berangkat</th>
                      <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Kendaraan</th>
                      <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Driver</th>
                      <th className="text-center px-3 py-2 font-medium hidden lg:table-cell">Kursi</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groupTrips.map((trip) => {
                      const vehicle = getVehicle(trip.vehicleId);
                      const departTime = getDepartureTime(trip);
                      const isSelected = selectedTripIds.has(trip.id);

                      return (
                        <tr
                          key={trip.id}
                          className={`hover:bg-muted/20 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                          data-testid={`trip-row-${trip.id}`}
                        >
                          <td className="px-4 py-2.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => onToggleSelect(trip.id)}
                            />
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                            {formatServiceDate(trip.serviceDate)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {departTime ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-semibold tabular-nums text-foreground">{departTime}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                                Belum diatur
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            {vehicle ? (
                              <div className="flex items-center gap-1.5">
                                <Bus className="h-3 w-3 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="font-medium">{vehicle.code}</span>
                                  <span className="text-[11px] text-muted-foreground font-mono ml-1.5">{vehicle.plate}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            {(trip as any).driverName ? (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-medium">{(trip as any).driverName}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                                Belum
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center hidden lg:table-cell tabular-nums font-medium">
                            {trip.capacity}
                          </td>
                          <td className="px-3 py-2.5">
                            <TripStatusBadge status={trip.status || 'scheduled'} />
                          </td>
                          <td className="px-3 py-2.5">
                            <RowActionsMenu
                              actions={[
                                { label: 'Lihat Manifest', icon: <FileText className="h-3.5 w-3.5" />, onClick: () => onManifest(trip.id) },
                                { label: 'Buat SPJ', icon: <ClipboardList className="h-3.5 w-3.5" />, onClick: () => onCreateSpj(trip.id), disabled: isCreatingSpj },
                                { label: 'Atur Jadwal', icon: <Clock className="h-3.5 w-3.5" />, onClick: () => onScheduling(trip) },
                                { label: 'Turunkan Leg', icon: <Route className="h-3.5 w-3.5" />, onClick: () => onDeriveLegs(trip.id), disabled: isDerivingLegs },
                                { label: 'Hitung Inventori', icon: <Grid3X3 className="h-3.5 w-3.5" />, onClick: () => onPrecomputeInventory(trip.id), disabled: isPrecomputingInventory },
                                { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => onEdit(trip) },
                                ...(canDelete ? [{ label: 'Hapus', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => onDelete(trip.id), variant: 'destructive' as const, disabled: isDeleting }] : []),
                              ]}
                              data-testid={`actions-trip-${trip.id}`}
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
