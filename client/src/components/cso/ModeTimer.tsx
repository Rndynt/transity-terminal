import { useState, useEffect, useRef } from 'react';

const MODE_TIMEOUT_SECONDS = 60;

export default function ModeTimer({ onExpire, colorClass = 'text-amber-600' }: { onExpire: () => void; colorClass?: string }) {
  const [remaining, setRemaining] = useState(MODE_TIMEOUT_SECONDS);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(MODE_TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = remaining / MODE_TIMEOUT_SECONDS;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="relative w-9 h-9">
        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-200" />
          <circle
            cx="18" cy="18" r={radius} fill="none" strokeWidth="2.5"
            stroke="currentColor"
            className={`${colorClass} transition-all duration-1000 ease-linear`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${colorClass}`}>
          {remaining}
        </span>
      </div>
    </div>
  );
}
