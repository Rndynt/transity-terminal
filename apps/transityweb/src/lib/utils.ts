import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
}

export function fmtTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '-';
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) {
      const parts = timeStr.split(':');
      return `${parts[0]}:${parts[1]}`;
    }
    const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const h = wib.getUTCHours().toString().padStart(2, '0');
    const m = wib.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return timeStr;
  }
}
