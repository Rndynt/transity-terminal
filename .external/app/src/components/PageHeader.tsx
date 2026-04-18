import { useState, useEffect, useRef, type RefObject } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  sticky?: boolean;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  scrollContainerRef?: RefObject<HTMLElement>;
}

export default function PageHeader({ title, subtitle, onBack, sticky = true, rightContent, children, className, scrollContainerRef }: PageHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sticky) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let observer: IntersectionObserver | null = null;

    const setup = () => {
      const root = scrollContainerRef?.current || null;
      observer = new IntersectionObserver(
        ([entry]) => setScrolled(!entry.isIntersecting),
        { threshold: 0, root },
      );
      observer.observe(sentinel);
    };

    requestAnimationFrame(setup);

    return () => { observer?.disconnect(); };
  }, [sticky, scrollContainerRef]);

  return (
    <>
      {sticky && <div ref={sentinelRef} className="h-0 w-full" />}
      <div
        className={cn(
          'hero-mesh relative overflow-hidden px-4 pb-4 transition-all duration-300 safe-top-sm',
          sticky && 'sticky top-0 z-30',
          scrolled && 'shadow-lg shadow-black/10',
          className,
        )}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.04]" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-white/[0.03]" />
        </div>
        <div className="relative z-[2] flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors shrink-0 active:scale-90"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className={cn(
              'text-white font-bold font-display truncate transition-all duration-200',
              scrolled ? 'text-[15px]' : 'text-[16px]',
            )}>{title}</h1>
            {subtitle && (
              <p className={cn(
                'text-teal-300/80 font-medium truncate transition-all duration-200',
                scrolled ? 'text-[11px] mt-0' : 'text-[12px] mt-0.5',
              )}>{subtitle}</p>
            )}
          </div>
          {rightContent}
        </div>
        <div className="relative z-[2]">{children}</div>
      </div>
    </>
  );
}
