export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 gap-4 select-none">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="4" className="text-blue-100" />
          <circle
            cx="28" cy="28" r="22" fill="none" stroke="currentColor"
            strokeWidth="4" strokeLinecap="round" strokeDasharray="138.2"
            className="text-blue-600"
            style={{ animation: "progress-spin 1.2s cubic-bezier(0.4,0,0.2,1) infinite" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
        </span>
      </div>
      <p className="text-xs text-gray-400 tracking-wide">Memuat…</p>
      <style>{`
        @keyframes progress-spin {
          0%   { stroke-dashoffset: 138.2; }
          50%  { stroke-dashoffset: 34.6; }
          100% { stroke-dashoffset: 138.2; }
        }
      `}</style>
    </div>
  );
}
