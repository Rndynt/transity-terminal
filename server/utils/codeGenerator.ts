// Character set: uppercase consonants + digits — no vowels (avoid bad words), no 0/1/I/O (avoid confusion)
const CHARSET = 'BCDFGHJKLMNPQRSTVWXYZ23456789';

function randomChars(n: number): string {
  return Array.from({ length: n }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
}

function datePart(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Generate Booking Code / PNR (transaction level)
 * Format: TRV-YYYYMMDD-XXXXX
 * Example: TRV-20240319-K7RFN
 */
export function generateBookingCode(date: Date = new Date()): string {
  return `TRV-${datePart(date)}-${randomChars(5)}`;
}

/**
 * Generate Ticket Number (per-passenger level)
 * Format: TKT-YYYYMMDD-XXXXX
 * Example: TKT-20240319-MV3BQ
 */
export function generateTicketNumber(date: Date = new Date()): string {
  return `TKT-${datePart(date)}-${randomChars(5)}`;
}
