import { randomBytes } from 'crypto';

const CHARSET = 'BCDFGHJKLMNPQRSTVWXYZ23456789';
const CHARSET_LEN = CHARSET.length;
const MAX_VALID = Math.floor(256 / CHARSET_LEN) * CHARSET_LEN;

function randomChars(n: number): string {
  const result: string[] = [];
  while (result.length < n) {
    const bytes = randomBytes(n - result.length + 4);
    for (const b of bytes) {
      if (b < MAX_VALID && result.length < n) {
        result.push(CHARSET[b % CHARSET_LEN]);
      }
    }
  }
  return result.join('');
}

function datePart(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function generateBookingCode(date: Date = new Date()): string {
  return `TRV-${datePart(date)}-${randomChars(5)}`;
}

export function generateTicketNumber(date: Date = new Date()): string {
  return `TKT-${datePart(date)}-${randomChars(5)}`;
}
