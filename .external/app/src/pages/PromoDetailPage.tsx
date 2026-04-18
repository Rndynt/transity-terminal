import { useState, useEffect } from 'react';
import { useNav } from '@/App';
import { PROMOS } from '@/lib/promos';
import PageHeader from '@/components/PageHeader';
import { Clock, Copy, Check, Tag, ChevronRight, MapPin, Info, ListChecks, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function PromoDetailPage({ promoId }: { promoId: string }) {
  const { goBack } = useNav();
  const [copied, setCopied] = useState(false);
  const promo = PROMOS.find((p) => p.id === promoId);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  if (!promo) {
    return (
      <div className="min-h-screen bg-[#f8fafa]">
        <PageHeader title="Promo" onBack={goBack} />
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <Info className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-400 text-[14px]">Promo tidak ditemukan</p>
        </div>
      </div>
    );
  }

  const daysLeft = getDaysLeft(promo.validUntil);

  const copyCode = () => {
    navigator.clipboard?.writeText(promo.code).catch(() => {});
    setCopied(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafa] safe-pb-32 anim-fade">
      <div className="relative">
        <img
          src={promo.image}
          alt={promo.title}
          className="w-full h-[220px] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />

        <button
          onClick={goBack}
          className="absolute top-12 left-4 z-10 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronRight className="w-5 h-5 text-white rotate-180" />
        </button>

        <div className="absolute bottom-4 left-4 right-4">
          <span className="inline-block px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-[10px] font-bold text-teal-700 uppercase tracking-wide mb-2">
            {promo.badge}
          </span>
          <h1 className="font-display font-extrabold text-[22px] text-white leading-tight drop-shadow-md">
            {promo.title}
          </h1>
        </div>
      </div>

      <div className="px-4 -mt-2 relative z-10">
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-xl p-3 text-center">
                <span className="text-[10px] text-teal-600/70 font-medium block">{promo.discountLabel}</span>
                <span className="font-display font-extrabold text-[26px] text-teal-700 leading-none mt-1 block">
                  {promo.discount}
                </span>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-400 font-medium block">Berlaku hingga</span>
                <span className="font-bold text-[14px] text-slate-700 leading-none mt-1 block">
                  {promo.validUntil}
                </span>
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] font-semibold text-amber-600">{daysLeft} hari lagi</span>
                </div>
              </div>
            </div>

            <button
              onClick={copyCode}
              className={cn(
                'w-full flex items-center justify-between rounded-xl border-2 border-dashed p-3.5 transition-all active:scale-[0.98]',
                copied
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-teal-200 bg-teal-50/50 hover:bg-teal-50',
              )}
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-teal-600" />
                <div>
                  <span className="text-[10px] text-teal-600/60 font-medium block leading-none">Kode Promo</span>
                  <span className="font-mono font-bold text-[18px] text-teal-800 tracking-wider block mt-0.5">
                    {promo.code}
                  </span>
                </div>
              </div>
              <div className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all',
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-teal-600 text-white',
              )}>
                {copied ? (
                  <><Check className="w-3.5 h-3.5" /> Tersalin</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Salin</>
                )}
              </div>
            </button>
          </div>

          <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-[12px] text-slate-500">Berlaku untuk: </span>
            <span className="text-[12px] font-semibold text-slate-700">{promo.routes}</span>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl shadow-card p-4">
          <h3 className="text-[14px] font-bold text-slate-800 mb-2">Tentang Promo</h3>
          <p className="text-[13px] text-slate-500 leading-relaxed">
            {promo.description}
          </p>
        </div>

        <div className="mt-4 bg-white rounded-2xl shadow-card p-4">
          <h3 className="text-[14px] font-bold text-slate-800 mb-3">Cara Menggunakan</h3>
          <div className="space-y-3">
            {promo.howToUse.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-white">{i + 1}</span>
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4 text-slate-400" />
            <h3 className="text-[14px] font-bold text-slate-800">Syarat & Ketentuan</h3>
          </div>
          <ul className="space-y-2">
            {promo.terms.map((term, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-[7px] shrink-0" />
                <span className="text-[12.5px] text-slate-500 leading-relaxed">{term}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-100 safe-bottom">
        <div className="px-4 py-3">
          <button
            onClick={copyCode}
            className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-white" />
                <span className="font-bold text-[15px] text-white">Kode Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 text-white" />
                <span className="font-bold text-[15px] text-white">Salin Kode Promo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
