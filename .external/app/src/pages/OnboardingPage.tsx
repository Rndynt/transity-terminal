import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 't_onboarding_done';

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function markOnboardingDone(): void {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

interface Slide {
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  dotColor: string;
}

const slides: Slide[] = [
  {
    illustration: (
      <svg viewBox="0 0 280 220" fill="none" className="w-full h-full">
        <rect x="40" y="140" width="200" height="8" rx="4" fill="#e2e8f0" />
        <rect x="60" y="50" width="160" height="90" rx="16" fill="url(#bus1)" />
        <rect x="72" y="62" width="32" height="24" rx="6" fill="white" fillOpacity="0.9" />
        <rect x="112" y="62" width="32" height="24" rx="6" fill="white" fillOpacity="0.9" />
        <rect x="152" y="62" width="32" height="24" rx="6" fill="white" fillOpacity="0.9" />
        <rect x="72" y="94" width="56" height="6" rx="3" fill="white" fillOpacity="0.4" />
        <rect x="72" y="106" width="36" height="6" rx="3" fill="white" fillOpacity="0.25" />
        <circle cx="90" cy="140" r="14" fill="#334155" stroke="white" strokeWidth="4" />
        <circle cx="90" cy="140" r="5" fill="#94a3b8" />
        <circle cx="190" cy="140" r="14" fill="#334155" stroke="white" strokeWidth="4" />
        <circle cx="190" cy="140" r="5" fill="#94a3b8" />
        <rect x="195" y="68" width="20" height="14" rx="4" fill="white" fillOpacity="0.3" />
        <path d="M200 68V58c0-4 4-8 10-8h10v18" stroke="white" strokeWidth="2.5" strokeOpacity="0.5" />
        <circle cx="48" cy="80" r="6" fill="#5eead4" fillOpacity="0.5" />
        <circle cx="240" cy="100" r="8" fill="#a78bfa" fillOpacity="0.4" />
        <circle cx="230" cy="60" r="4" fill="#fbbf24" fillOpacity="0.6" />
        <path d="M30 120 Q60 110 50 130" stroke="#5eead4" strokeWidth="2" strokeOpacity="0.3" fill="none" />
        <path d="M240 130 Q250 120 260 135" stroke="#a78bfa" strokeWidth="2" strokeOpacity="0.3" fill="none" />
        <defs>
          <linearGradient id="bus1" x1="60" y1="50" x2="220" y2="140">
            <stop stopColor="#0f766e" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>
    ),
    title: 'Shuttle Bus\nDalam Genggaman',
    subtitle: 'Cari dan pesan tiket shuttle bus antarkota langsung dari HP-mu',
    accent: 'from-teal-600 to-emerald-500',
    dotColor: 'bg-teal-500',
  },
  {
    illustration: (
      <svg viewBox="0 0 280 220" fill="none" className="w-full h-full">
        <rect x="70" y="30" width="64" height="76" rx="14" fill="url(#card1)" />
        <rect x="82" y="44" width="40" height="4" rx="2" fill="white" fillOpacity="0.6" />
        <rect x="82" y="54" width="28" height="4" rx="2" fill="white" fillOpacity="0.35" />
        <circle cx="102" cy="80" r="10" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5" />
        <path d="M97 80l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        <rect x="146" y="50" width="64" height="76" rx="14" fill="url(#card2)" />
        <rect x="158" y="64" width="40" height="4" rx="2" fill="white" fillOpacity="0.6" />
        <rect x="158" y="74" width="28" height="4" rx="2" fill="white" fillOpacity="0.35" />
        <circle cx="178" cy="100" r="10" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5" />
        <path d="M173 100l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        <rect x="108" y="110" width="64" height="76" rx="14" fill="url(#card3)" />
        <rect x="120" y="124" width="40" height="4" rx="2" fill="white" fillOpacity="0.6" />
        <rect x="120" y="134" width="28" height="4" rx="2" fill="white" fillOpacity="0.35" />
        <circle cx="140" cy="160" r="10" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5" />
        <path d="M135 160l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        <path d="M134 82 L146 74" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M134 130 L146 122" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />

        <circle cx="50" cy="100" r="5" fill="#fbbf24" fillOpacity="0.5" />
        <circle cx="240" cy="80" r="7" fill="#5eead4" fillOpacity="0.4" />
        <circle cx="60" cy="170" r="4" fill="#a78bfa" fillOpacity="0.4" />
        <defs>
          <linearGradient id="card1" x1="70" y1="30" x2="134" y2="106">
            <stop stopColor="#0f766e" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="card2" x1="146" y1="50" x2="210" y2="126">
            <stop stopColor="#7c3aed" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="card3" x1="108" y1="110" x2="172" y2="186">
            <stop stopColor="#f59e0b" />
            <stop offset="1" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>
    ),
    title: 'Banyak Operator,\nSatu Aplikasi',
    subtitle: 'Bandingkan jadwal dan harga dari berbagai operator shuttle terpercaya',
    accent: 'from-violet-500 to-purple-500',
    dotColor: 'bg-violet-500',
  },
  {
    illustration: (
      <svg viewBox="0 0 280 220" fill="none" className="w-full h-full">
        <rect x="90" y="20" width="100" height="170" rx="20" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2" />
        <rect x="100" y="34" width="80" height="10" rx="5" fill="#e2e8f0" />
        <rect x="120" y="14" width="40" height="8" rx="4" fill="#cbd5e1" />

        <rect x="106" y="56" width="68" height="48" rx="10" fill="url(#ticket1)" />
        <rect x="116" y="68" width="30" height="3" rx="1.5" fill="white" fillOpacity="0.7" />
        <rect x="116" y="76" width="20" height="3" rx="1.5" fill="white" fillOpacity="0.4" />
        <circle cx="160" cy="74" r="8" fill="white" fillOpacity="0.2" />
        <path d="M156 74l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        <rect x="106" y="112" width="68" height="14" rx="7" fill="url(#payBtn)" />
        <rect x="126" y="117" width="28" height="4" rx="2" fill="white" fillOpacity="0.9" />

        <rect x="106" y="134" width="68" height="40" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
        <rect x="116" y="144" width="24" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="116" y="152" width="36" height="3" rx="1.5" fill="#e2e8f0" />
        <rect x="116" y="160" width="18" height="3" rx="1.5" fill="#e2e8f0" />

        <circle cx="54" cy="60" r="20" fill="#5eead4" fillOpacity="0.15" />
        <path d="M46 60l5 5 10-10" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <circle cx="232" cy="140" r="18" fill="#fbbf24" fillOpacity="0.12" />
        <path d="M226 140h12M232 134v12" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

        <circle cx="60" cy="170" r="6" fill="#a78bfa" fillOpacity="0.3" />
        <circle cx="230" cy="60" r="5" fill="#fb923c" fillOpacity="0.4" />
        <path d="M42 120 Q52 100 48 130" stroke="#5eead4" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
        <defs>
          <linearGradient id="ticket1" x1="106" y1="56" x2="174" y2="104">
            <stop stopColor="#0f766e" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="payBtn" x1="106" y1="112" x2="174" y2="126">
            <stop stopColor="#0d9488" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
    ),
    title: 'Pesan Mudah,\nPerjalanan Nyaman',
    subtitle: 'Pilih kursi, bayar online, dan dapatkan e-tiket instan tanpa ribet',
    accent: 'from-teal-600 to-emerald-500',
    dotColor: 'bg-emerald-500',
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingPage({ onDone }: Props) {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    if (current < slides.length - 1) {
      setSlideDirection('left');
      setCurrent(c => c + 1);
    } else {
      markOnboardingDone();
      onDone();
    }
  }, [current, onDone]);

  const goTo = useCallback((idx: number) => {
    setSlideDirection(idx > current ? 'left' : 'right');
    setCurrent(idx);
  }, [current]);

  const skip = useCallback(() => {
    markOnboardingDone();
    onDone();
  }, [onDone]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0].clientX - touchStart);
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > 60) {
      if (touchDelta < 0 && current < slides.length - 1) {
        setSlideDirection('left');
        setCurrent(c => c + 1);
      } else if (touchDelta > 0 && current > 0) {
        setSlideDirection('right');
        setCurrent(c => c - 1);
      }
    }
    setTouchStart(null);
    setTouchDelta(0);
    setSwiping(false);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventScroll = (e: TouchEvent) => { e.preventDefault(); };
    el.addEventListener('touchmove', preventScroll, { passive: false });
    return () => el.removeEventListener('touchmove', preventScroll);
  }, []);

  useEffect(() => {
    if (slideDirection) {
      const t = setTimeout(() => setSlideDirection(null), 500);
      return () => clearTimeout(t);
    }
  }, [slideDirection, current]);

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-white overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-teal-50/80" />
        <div className="absolute top-1/4 -left-16 w-[200px] h-[200px] rounded-full bg-emerald-50/60" />
        <div className="absolute bottom-20 right-[-40px] w-[180px] h-[180px] rounded-full bg-violet-50/40" />
      </div>

      <div className="flex items-center justify-between px-5 relative z-10 safe-top-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
              <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
            </svg>
          </div>
          <span className="font-display font-bold text-[15px] text-slate-800">Transity</span>
        </div>
        {!isLast && (
          <button
            onClick={skip}
            className="text-[13px] font-medium text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5 rounded-full"
          >
            Lewati
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <div
          className="w-full max-w-[320px] aspect-[280/220] mb-6"
          style={{
            transform: swiping ? `translateX(${touchDelta * 0.4}px)` : 'translateX(0)',
            transition: swiping ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div key={current} className="w-full h-full onboarding-slide-in">
            {slide.illustration}
          </div>
        </div>

        <div key={`text-${current}`} className="text-center onboarding-text-in">
          <h1 className="text-[28px] leading-[1.2] font-extrabold text-slate-900 mb-3 font-display whitespace-pre-line">
            {slide.title}
          </h1>
          <p className="text-[15px] leading-relaxed text-slate-500 max-w-[300px] mx-auto">
            {slide.subtitle}
          </p>
        </div>
      </div>

      <div className="px-6 pb-8 safe-bottom relative z-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'rounded-full transition-all duration-500 ease-out',
                i === current
                  ? `w-8 h-2 ${s.dotColor}`
                  : 'w-2 h-2 bg-slate-200 hover:bg-slate-300',
              )}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className={cn(
            'w-full h-[54px] rounded-2xl text-[15px] font-bold transition-all duration-300 active:scale-[0.97]',
            'bg-gradient-to-r shadow-lg text-white',
            slide.accent,
            isLast ? 'shadow-emerald-500/25' : 'shadow-slate-300/30',
          )}
        >
          {isLast ? 'Mulai Sekarang' : 'Lanjut'}
        </button>

        {isLast && (
          <p className="text-center text-[12px] text-slate-400 mt-3">
            Dengan melanjutkan, kamu menyetujui ketentuan layanan kami
          </p>
        )}
      </div>
    </div>
  );
}
