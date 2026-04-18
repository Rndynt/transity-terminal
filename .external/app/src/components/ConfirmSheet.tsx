import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
  variant?: 'default' | 'warning';
}

export default function ConfirmSheet({
  open, onOpenChange, title, description, icon,
  confirmLabel, cancelLabel, onConfirm, onCancel,
  loading, error, variant = 'default',
}: ConfirmSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!fixed !top-auto !bottom-0 !left-0 !right-0 !translate-x-0 !translate-y-0 !max-w-none rounded-t-3xl rounded-b-none border-0 p-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100"
        onInteractOutside={(e) => { if (loading) e.preventDefault(); }}
      >
        <div className="px-6 pt-6 pb-2">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
          {icon && (
            <div className="flex justify-center mb-4">{icon}</div>
          )}
          <DialogTitle className="text-center text-[17px] font-bold text-slate-800 mb-1.5">
            {title}
          </DialogTitle>
          {description && (
            <p className="text-center text-[13px] text-slate-400 leading-relaxed">{description}</p>
          )}
          {error && (
            <div className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200/60 rounded-xl text-[12px] text-red-600 font-medium text-center">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 pb-6 pt-3 space-y-2.5 safe-bottom">
          <Button
            className={cn(
              'w-full h-13 rounded-2xl text-[15px] font-bold shadow-lg transition-all active:scale-[0.97] gap-2',
              variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/15'
                : 'bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 shadow-emerald-600/15',
            )}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {confirmLabel}
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl border-slate-200 text-slate-500 hover:bg-slate-50 text-[14px] font-semibold"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
