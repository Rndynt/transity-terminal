import { Input } from '@/components/ui/input';

export interface MatrixGridRow {
  stopId: string;
  stopName: string;
  stopCode?: string;
  city?: string | null;
  sequence: number;
}

export interface MatrixGridCellData<T = number> {
  originStopId: string;
  destinationStopId: string;
  value: T;
}

interface PriceGridProps<T = number> {
  rows: MatrixGridRow[];
  cells: MatrixGridCellData<T>[];
  onChange: (originStopId: string, destinationStopId: string, value: T) => void;
  /** Override how a single editable cell renders — lets cargo (Prompt #2)
   * plug in a different cell type (e.g. weight-tiered pricing) without
   * forking this grid. Defaults to a plain numeric price input. */
  renderCell?: (value: T, onChange: (next: T) => void, ctx: { originStopId: string; destinationStopId: string }) => React.ReactNode;
  disabled?: boolean;
  emptyLabel?: string;
  /** When true (pattern has NOT enabled allow_intra_city_booking):
   * - a stop is dropped from the ROW axis entirely if EVERY later stop is
   *   the same city as it (there is then no different-city destination it
   *   could ever reach — the whole row would be dead cells).
   * - a stop is dropped from the COLUMN axis entirely if EVERY earlier
   *   stop is the same city as it (nothing could ever validly arrive there).
   * Any same-city pair that still survives both filters (e.g. two stops in
   * the same middle city-cluster of a 3+-cluster pattern) is rendered as a
   * small non-editable "dalam kota" cell rather than a numeric input. */
  disableSameCityCells?: boolean;
}

function defaultNumericCell(value: number, onChange: (v: number) => void, disabled?: boolean) {
  return (
    <Input
      type="number"
      min={0}
      value={value > 0 ? value : ''}
      placeholder="0"
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-8 text-xs text-right px-2"
      data-testid="input-matrix-cell"
    />
  );
}

/** A stop can never be a useful ORIGIN if every stop after it shares its
 * city — there is no different-city destination left for it to reach. */
function hasLaterDifferentCity(stop: MatrixGridRow, sorted: MatrixGridRow[]): boolean {
  return sorted.some(other => other.sequence > stop.sequence && other.city && stop.city && other.city !== stop.city);
}

/** A stop can never be a useful DESTINATION if every stop before it shares
 * its city — nothing could validly have come from elsewhere to reach it. */
function hasEarlierDifferentCity(stop: MatrixGridRow, sorted: MatrixGridRow[]): boolean {
  return sorted.some(other => other.sequence < stop.sequence && other.city && stop.city && other.city !== stop.city);
}

/**
 * Generic upper-triangular OD-pair grid: rows = origin (in sequence
 * order), columns = destination (in sequence order), only forward cells
 * (origin.sequence < dest.sequence) are editable. Built domain-agnostic
 * via `renderCell` so cargo's matrix editor (Prompt #2) can reuse this
 * exact component with its own cell type instead of forking it.
 */
export function PriceGrid<T = number>({
  rows,
  cells,
  onChange,
  renderCell,
  disabled,
  emptyLabel = 'Tambahkan minimal 2 halte ke pola ini untuk mengisi matrix harga.',
  disableSameCityCells = false,
}: PriceGridProps<T>) {
  if (rows.length < 2) {
    return <div className="text-xs text-muted-foreground p-4 text-center border rounded-lg bg-muted/20">{emptyLabel}</div>;
  }

  const sorted = [...rows].sort((a, b) => a.sequence - b.sequence);
  const cellMap = new Map(cells.map(c => [`${c.originStopId}|${c.destinationStopId}`, c.value]));

  // Full candidate axes (unfiltered): every stop but the last can be an
  // origin row, every stop but the first can be a destination column.
  let originRows = sorted.slice(0, -1);
  let destCols = sorted.slice(1);

  if (disableSameCityCells) {
    // Drop rows/columns that would be 100% dead weight: every cell in
    // them would be either same-city (blocked) or backward/self (never
    // rendered anyway). Keeping them just clutters the grid with empty
    // boxes for combinations that can never be booked or even exist in
    // the forward direction.
    originRows = originRows.filter(r => hasLaterDifferentCity(r, sorted));
    destCols = destCols.filter(r => hasEarlierDifferentCity(r, sorted));
  }

  if (originRows.length === 0 || destCols.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-4 text-center border rounded-lg bg-muted/20">
        Semua halte di pola ini berada di kota yang sama, jadi tidak ada pasangan asal-tujuan lintas kota untuk diberi
        harga selama "Izinkan Rute Pendek Dalam Kota" belum diaktifkan.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-muted p-2 text-left border-b border-r font-medium min-w-[120px]">
              Asal \ Tujuan
            </th>
            {destCols.map(col => (
              <th key={col.stopId} className="p-2 text-center border-b font-medium min-w-[100px] whitespace-nowrap">
                {col.stopName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {originRows.map(originRow => (
            <tr key={originRow.stopId}>
              <td className="sticky left-0 z-10 bg-background p-2 font-medium border-r border-b whitespace-nowrap">
                {originRow.stopName}
              </td>
              {destCols.map(destRow => {
                if (destRow.sequence <= originRow.sequence) {
                  return <td key={destRow.stopId} className="bg-muted/30 border-b" />;
                }

                const sameCity = disableSameCityCells
                  && !!originRow.city && !!destRow.city
                  && originRow.city === destRow.city;

                if (sameCity) {
                  // Only reachable here for a middle city-cluster on a
                  // 3+-cluster pattern (e.g. two stops in the same
                  // mid-route city) — both survived the row/column filter
                  // above because each individually has SOME valid
                  // cross-city cell elsewhere, but this specific pair
                  // between them is still same-city and stays blocked.
                  return (
                    <td key={destRow.stopId} className="p-1 border-b bg-muted/40">
                      <div
                        className="h-8 flex items-center justify-center text-muted-foreground/60 text-[11px] rounded border border-dashed"
                        title={`${originRow.stopName} dan ${destRow.stopName} sama-sama di kota ${originRow.city} — rute pendek dalam kota nonaktif untuk pola ini`}
                        data-testid="cell-intra-city-disabled"
                      >
                        dalam kota
                      </div>
                    </td>
                  );
                }

                const key = `${originRow.stopId}|${destRow.stopId}`;
                const value = (cellMap.get(key) ?? (0 as unknown as T));
                return (
                  <td key={destRow.stopId} className="p-1 border-b">
                    {renderCell
                      ? renderCell(value, (next) => onChange(originRow.stopId, destRow.stopId, next), {
                          originStopId: originRow.stopId,
                          destinationStopId: destRow.stopId,
                        })
                      : defaultNumericCell(
                          value as unknown as number,
                          (next) => onChange(originRow.stopId, destRow.stopId, next as unknown as T),
                          disabled,
                        )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
