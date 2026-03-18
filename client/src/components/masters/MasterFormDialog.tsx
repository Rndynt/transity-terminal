import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface MasterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  isPending?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  'data-testid'?: string;
}

export default function MasterFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  isPending = false,
  submitLabel = 'Simpan',
  cancelLabel = 'Batal',
  size = 'md',
  ...props
}: MasterFormDialogProps) {
  const sizeClass = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }[size];

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription>{description}</DialogDescription>
        )}
      </DialogHeader>
      <div className="space-y-4 py-1">{children}</div>
      {onSubmit && (
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="dialog-cancel-btn"
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            data-testid="dialog-submit-btn"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPending ? 'Menyimpan...' : submitLabel}
          </Button>
        </DialogFooter>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${sizeClass} max-h-[92vh] flex flex-col p-0 gap-0`}
        data-testid={props['data-testid']}
      >
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
            <DialogHeader className="px-5 pt-5 pb-4 border-b border-gray-200 shrink-0">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
            <DialogFooter className="px-5 py-4 border-t border-gray-200 shrink-0 bg-white gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="dialog-cancel-btn"
              >
                {cancelLabel}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="dialog-submit-btn"
              >
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isPending ? 'Menyimpan...' : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col min-h-0 flex-1">
            <DialogHeader className="px-5 pt-5 pb-4 border-b border-gray-200 shrink-0">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
