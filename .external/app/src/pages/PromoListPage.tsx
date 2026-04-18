import { useState } from 'react';
import { useNav } from '@/App';
import { PROMOS } from '@/lib/promos';
import PageHeader from '@/components/PageHeader';
import { Clock, Copy, Check, ArrowRight } from 'lucide-react';

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

export default function PromoListPage() {
  const { goBack, navigate } = useNav();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = (e: React.MouseEvent, promoId: string, code: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    setCopiedId(promoId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#f8fafa] safe-pb-24 anim-fade">
      <PageHeader title="Semua Promo" subtitle="Jangan sampai terlewat!" onBack={goBack} />

      <div className="px-4 mt-4 space-y-3">
        {PROMOS.map((promo) => {
          const daysLeft = getDaysLeft(promo.validUntil);
          return (
            <button
              key={promo.id}
              onClick={() => navigate({ name: 'promo-detail', promoId: promo.id })}
              className="w-full text-left active:scale-[0.98] transition-all"
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
                      <h4 className="font-display font-extrabold text-[16px] text-slate-800 leading-[1.2] line-clamp-2">
                        {promo.title}
                      </h4>
                      <p className="text-slate-400 text-[10px] leading-snug mt-0.5 line-clamp-2">
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
                    onClick={(e) => copyCode(e, promo.id, promo.code)}
                    className="flex items-center gap-1.5 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-2.5 py-[5px]"
                  >
                    {copiedId === promo.id ? (
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
        })}
      </div>
    </div>
  );
}
