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
  const parts = timeStr.split(':');
  return `${parts[0]}:${parts[1]}`;
}
