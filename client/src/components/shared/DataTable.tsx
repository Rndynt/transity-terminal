import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string | ReactNode;
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
  render: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  searchQuery?: string;
  'data-testid'?: string;
  rowTestId?: (item: T) => string;
  onRowClick?: (item: T) => void;
  maxHeight?: string;
  compact?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyIcon,
  emptyMessage = 'Belum ada data',
  searchQuery,
  'data-testid': testId,
  rowTestId,
  onRowClick,
  maxHeight = '72vh',
  compact = true,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 bg-card rounded-lg border">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const cellPadding = compact ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const headerPadding = compact ? 'px-3 py-2.5' : 'px-4 py-3';

  return (
    <div
      className="overflow-auto rounded-lg border bg-card shadow-sm"
      style={{ maxHeight }}
      data-testid={testId}
    >
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  headerPadding,
                  'text-left align-middle font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none',
                  col.hideOnMobile && 'hidden md:table-cell',
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-10 text-muted-foreground bg-card">
                {emptyIcon && <div className="flex justify-center mb-2 opacity-25">{emptyIcon}</div>}
                <p className="text-[13px]">
                  {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : emptyMessage}
                </p>
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                data-testid={rowTestId?.(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  'border-b border-border/50 last:border-0 transition-colors hover:bg-muted/40',
                  index % 2 === 1 && 'bg-muted/15',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      cellPadding,
                      'align-middle text-[13px] leading-snug text-foreground',
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.className
                    )}
                  >
                    {col.render(item, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
