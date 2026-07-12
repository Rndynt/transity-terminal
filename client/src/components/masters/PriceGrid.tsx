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
  /** When true, cells where origin.city === destination.city are rendered
   * as non-editable/greyed instead of a normal input — those OD pairs can
   * never actually be booked (see trip_patterns.allow_intra_city_booking),
   * so offering an editable price for them is just confusing clutter.
   * Pass `false` (or omit) for patterns that DO sell intra-city hops. */
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

  const cellMap = new Map(cells.map(c => [`${c.originStopId}|${c.destinationStopId}`, c.value]));
  const originRows = rows.slice(0, -1);
  const destCols = rows.slice(1);

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
                  return (
                    <td key={destRow.stopId} className="p-1 border-b bg-muted/40">
                      <div
                        className="h-8 flex items-center justify-center text-muted-foreground/60 text-[11px] rounded border border-dashed"
                        title={`${originRow.stopName} dan ${destRow.stopName} sama-sama di kota ${originRow.city} — rute pendek dalam kota nonaktif untuk pola ini (lihat toggle "Izinkan Rute Pendek Dalam Kota" di Pola Perjalanan)`}
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
