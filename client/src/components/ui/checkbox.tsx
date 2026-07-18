import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Set to "indeterminate" to show the mixed state indicator */
  'data-state'?: 'checked' | 'unchecked' | 'indeterminate';
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, 'data-state': dataState, ...props }, ref) => {
    const isIndeterminate = dataState === 'indeterminate';

    const inputRef = React.useRef<HTMLInputElement>(null);

    // Merge refs
    React.useEffect(() => {
      const el = inputRef.current;
      if (el) el.indeterminate = isIndeterminate;
    }, [isIndeterminate]);

    return (
      <input
        type="checkbox"
        ref={(node) => {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }}
        checked={isIndeterminate ? false : checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          'h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'accent-primary cursor-pointer',
          className
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
