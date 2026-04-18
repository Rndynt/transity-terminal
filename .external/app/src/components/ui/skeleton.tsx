import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-shimmer rounded-lg bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 bg-[length:400%_100%]', className)}
      {...props}
    />
  );
}

function TripCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="flex-1 space-y-1.5 items-end flex flex-col">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

function BookingCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-100">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

function BookingDetailSkeleton() {
  return (
    <div className="anim-fade min-h-screen bg-[#f8fafa]">
      <div className="hero-mesh relative overflow-hidden px-4 pb-4 safe-top-sm">
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.04]" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-white/[0.03]" />
        </div>
        <div className="relative z-[2] flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl bg-white/10" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-28 bg-white/10" />
            </div>
          <Skeleton className="h-6 w-20 rounded-lg bg-white/10" />
        </div>
      </div>
      <div className="px-4 pt-4 safe-pb-24 space-y-4">
        <div className="bg-white rounded-2xl shadow-soft p-4 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-1.5 gap-0.5">
              <Skeleton className="w-2.5 h-2.5 rounded-full" />
              <Skeleton className="w-[2px] h-10" />
              <Skeleton className="w-2.5 h-2.5 rounded-full" />
            </div>
            <div className="flex-1 space-y-5">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <Skeleton className="h-px w-full" />
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StopCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <div className="flex items-center gap-3.5">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
  );
}

function SeatGridSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 16 }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-4 justify-center pt-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

function TripDetailSkeleton() {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="ml-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-3 w-12" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export {
  Skeleton,
  TripCardSkeleton,
  BookingCardSkeleton,
  BookingDetailSkeleton,
  StopCardSkeleton,
  SeatGridSkeleton,
  TripDetailSkeleton,
};
