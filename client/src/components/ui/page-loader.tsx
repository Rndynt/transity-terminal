export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 gap-3 select-none">
      <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
      <p className="text-xs text-gray-400 tracking-wide">Memuat…</p>
    </div>
  );
}
