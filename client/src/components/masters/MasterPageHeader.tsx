import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MasterPageHeaderProps {
  title: string;
  description: string;
  action: ReactNode;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  count?: number;
}

export default function MasterPageHeader({
  title,
  description,
  action,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  count,
}: MasterPageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {count !== undefined && (
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{count}</span>
            )}
          </div>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
          <Input
            type="text"
            value={searchValue ?? ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? 'Cari...'}
            className="pl-9 pr-9"
            data-testid="master-search-input"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              data-testid="master-search-clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
