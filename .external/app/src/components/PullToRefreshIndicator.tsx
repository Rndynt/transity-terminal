import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  isPastThreshold: boolean;
}

export default function PullToRefreshIndicator({ pullDistance, isRefreshing, progress, isPastThreshold }: Props) {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
      style={{ height: isRefreshing ? 48 : pullDistance }}
    >
      <div className={cn(
        'flex items-center gap-2 px-4 py-1.5 rounded-full transition-all',
        isPastThreshold || isRefreshing ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-400',
      )}>
        {isRefreshing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[12px] font-semibold">Memperbarui...</span>
          </>
        ) : (
          <>
            <ArrowDown
              className="w-4 h-4 transition-transform duration-200"
              style={{
                transform: `rotate(${isPastThreshold ? 180 : 0}deg)`,
                opacity: Math.max(0.3, progress),
              }}
            />
            <span className="text-[12px] font-semibold">
              {isPastThreshold ? 'Lepas untuk refresh' : 'Tarik untuk refresh'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
