export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 gap-4 select-none">
      <svg
        className="w-12 h-12 animate-spin"
        viewBox="0 0 48 48"
        fill="none"
        style={{ animationDuration: "0.8s", animationTimingFunction: "linear" }}
      >
        {/* Track */}
        <circle cx="24" cy="24" r="20" stroke="#dbeafe" strokeWidth="4" />
        {/* Arc — fixed partial length, spins with the SVG */}
        <circle
          cx="24" cy="24" r="20"
          stroke="#2563eb"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="94.25"
          strokeDashoffset="62.83"
        />
      </svg>
      <p className="text-xs text-gray-400 tracking-wide">Memuat…</p>
    </div>
  );
}
