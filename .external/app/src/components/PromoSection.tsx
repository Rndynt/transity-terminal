import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Clock, Tag, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROMOS, type PromoItem } from '@/lib/promos';
import { useNav } from '@/App';

function getDaysLeft(validUntil: string): number {
  const months: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
    'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11,
  };
  const parts = validUntil.split(' ');
  const day = parseInt(parts[0]);
  const month = months[parts[1]] ?? 0;
  const year = parseInt(parts[2]);
  const target = new Date(year, month, day);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function PromoCard({ promo, onTap }: { promo: PromoItem; onTap: () => void }) {
  const daysLeft = getDaysLeft(promo.validUntil);
  const [copied, setCopied] = useState(false);

  const copyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(promo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={onTap}
      className="snap-start shrink-0 w-[82%] max-w-[340px] text-left active:scale-[0.97] transition-transform duration-200"
    >
      <div
        className="rounded-2xl bg-white p-4 h-[152px] flex flex-col justify-between relative overflow-hidden"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)' }}
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-teal-50/70" />
        <div className="absolute -bottom-8 -right-4 w-20 h-20 rounded-full bg-teal-50/40" />

        <div className="relative">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="px-2 py-[3px] rounded-md text-[8px] font-extrabold uppercase tracking-wider bg-teal-600 text-white">
              {promo.badge}
            </span>
            <div className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5 text-slate-300" />
              <span className="text-[9px] font-medium text-slate-400">{daysLeft} hari lagi</span>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-display font-extrabold text-[15px] text-slate-800 leading-[1.2] line-clamp-2">
                {promo.title}
              </h4>
              <p className="text-slate-400 text-[10px] leading-snug mt-0.5 line-clamp-1">
                {promo.subtitle}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="font-display font-black text-[28px] leading-none text-teal-600 tracking-tight">
                {promo.discount}
              </span>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-2.5 py-[5px]"
          >
            {copied ? (
              <Check className="w-3 h-3 text-teal-500" />
            ) : (
              <Copy className="w-3 h-3 text-slate-300" />
            )}
            <span className="font-mono font-bold text-[11px] text-slate-500 tracking-wider">{promo.code}</span>
          </button>

          <div className="flex items-center gap-1 text-teal-600">
            <span className="text-[11px] font-semibold">Pakai</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function PromoSection() {
  const { navigate } = useNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.firstElementChild
        ? (container.firstElementChild as HTMLElement).offsetWidth + 12
        : 300;
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.min(index, PROMOS.length - 1));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="mt-5 anim-slide-up delay-1">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center shadow-sm">
            <Tag className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-[14px] font-bold text-slate-800">Promo Berlangsung</h3>
        </div>
        <button
          onClick={() => navigate({ name: 'promo-list' })}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-teal-600"
        >
          Lihat semua
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory"
      >
        {PROMOS.map((promo) => (
          <PromoCard
            key={promo.id}
            promo={promo}
            onTap={() => navigate({ name: 'promo-detail', promoId: promo.id })}
          />
        ))}
      </div>

      <div className="flex justify-center gap-1.5 mt-2">
        {PROMOS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-[5px] rounded-full transition-all duration-300',
              i === activeIndex
                ? 'w-5 bg-teal-600'
                : 'w-[5px] bg-slate-200',
            )}
          />
        ))}
      </div>
    </div>
  );
}
