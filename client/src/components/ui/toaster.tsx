import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-24px)] pointer-events-none">
      {toasts.map((t) => {
        const isError = t.variant === "destructive";
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${
              t.dismissing
                ? "opacity-0 translate-x-4 scale-95"
                : "opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-5"
            } ${
              isError
                ? "bg-red-50/95 border-red-200 text-red-800"
                : "bg-white/95 border-gray-200 text-gray-800"
            }`}
            role="alert"
          >
            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 flex-shrink-0 ${isError ? "text-red-500" : "text-emerald-500"}`}>
                {isError ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {t.title && (
                  <p className="text-sm font-semibold leading-tight">{t.title}</p>
                )}
                {t.description && (
                  <p className={`text-xs mt-0.5 leading-relaxed ${isError ? "text-red-600/80" : "text-gray-500"}`}>
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className={`flex-shrink-0 p-0.5 rounded-md transition-colors ${
                  isError
                    ? "text-red-400 hover:text-red-600 hover:bg-red-100"
                    : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
                }`}
                data-testid={`dismiss-toast-${t.id}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
