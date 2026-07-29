import { cn } from '@/lib/utils';

interface StopTimeFieldProps {
  /** Combined local value in 'YYYY-MM-DDTHH:mm' format, or '' when empty. */
  value: string;
  onChange: (value: string) => void;
  /** Lower bound (previous stop's effective time) in the same format. Used to block backwards entry and as the one-tap suggestion. */
  minValue?: string;
  /** Trip service date 'YYYY-MM-DD', used only if minValue is unavailable. */
  fallbackDate: string;
  disabled?: boolean;
  hasError?: boolean;
  testId?: string;
}

function splitValue(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const [date, time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

function formatShort(value: string): string {
  const { date, time } = splitValue(value);
  if (!date) return '';
  const [, m, d] = date.split('-');
  return `${d}/${m} ${time.replace(':', '.')}`;
}

export default function StopTimeField({
  value,
  onChange,
  minValue,
  fallbackDate,
  disabled,
  hasError,
  testId,
}: StopTimeFieldProps) {
  const { date, time } = splitValue(value);
  const anchor = splitValue(minValue || '');
  const minDate = anchor.date || fallbackDate || undefined;
  const minTime = date && anchor.date && date === anchor.date ? anchor.time : undefined;

  const handleDateChange = (newDate: string) => {
    if (!newDate) { onChange(''); return; }
    onChange(`${newDate}T${time || anchor.time || '00:00'}`);
  };

  const handleTimeChange = (newTime: string) => {
    if (!newTime) { onChange(''); return; }
    onChange(`${date || anchor.date || fallbackDate}T${newTime}`);
  };

  const showSuggestion = !value && !!minValue;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1">
        <input
          type="date"
          value={date}
          min={minDate}
          disabled={disabled}
          onChange={e => handleDateChange(e.target.value)}
          className={cn(
            'h-8 rounded-md border bg-background px-1.5 text-[11px] w-[5.7rem] focus:outline-none focus:ring-1 focus:ring-ring',
            hasError ? 'border-destructive' : 'border-input'
          )}
          data-testid={testId ? `${testId}-date` : undefined}
        />
        <input
          type="time"
          value={time}
          min={minTime}
          disabled={disabled}
          onChange={e => handleTimeChange(e.target.value)}
          className={cn(
            'h-8 rounded-md border bg-background px-1.5 text-xs font-medium w-[4.6rem] focus:outline-none focus:ring-1 focus:ring-ring',
            hasError ? 'border-destructive' : 'border-input'
          )}
          data-testid={testId ? `${testId}-time` : undefined}
        />
      </div>
      {showSuggestion && (
        <button
          type="button"
          onClick={() => minValue && onChange(minValue)}
          className="text-[10px] text-primary hover:underline self-start"
          data-testid={testId ? `${testId}-suggestion` : undefined}
        >
          Gunakan {formatShort(minValue!)} →
        </button>
      )}
    </div>
  );
}
