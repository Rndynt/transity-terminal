import { parseISO, getDay } from "date-fns";
import { fromZonedTime, formatInTimeZone, toZonedTime as dateFnsToZonedTime } from "date-fns-tz";

// Valid time format regex: HH:MM or HH:MM:SS with colon separator ONLY
const TIME_FORMAT_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

/**
 * Normalize time string to HH:MM:SS format
 * Accepts: "HH:MM", "HH:MM:SS", "HH.MM", "HH,MM"
 * Returns: "HH:MM:SS" or null if invalid
 * 
 * IMPORTANT: This function strictly validates and normalizes time formats.
 * It will convert common mistakes like "08.30" to "08:30:00"
 */
export function normalizeTimeFormat(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  
  // Trim whitespace
  let normalized = timeStr.trim();
  
  // Skip if already null-like
  if (normalized === '' || normalized === 'null' || normalized === 'undefined') {
    return null;
  }
  
  // Replace dot or comma with colon (fix common mistakes like "08.30" -> "08:30")
  normalized = normalized.replace(/[.,]/g, ':');
  
  // Validate format after normalization
  if (!TIME_FORMAT_REGEX.test(normalized)) {
    console.warn(`[TIMEZONE] Invalid time format: "${timeStr}". Expected HH:MM or HH:MM:SS`);
    return null;
  }
  
  // Ensure we have seconds component
  if (normalized.split(':').length === 2) {
    normalized = `${normalized}:00`;
  }
  
  // Validate time values (hours 0-23, minutes 0-59, seconds 0-59)
  const parts = normalized.split(':').map(Number);
  if (parts[0] > 23 || parts[1] > 59 || parts[2] > 59) {
    console.warn(`[TIMEZONE] Invalid time values: "${timeStr}"`);
    return null;
  }
  
  return normalized;
}

/**
 * Convert HH:MM time string to UTC timestamp using specified timezone
 * @param serviceDate Date string in YYYY-MM-DD format
 * @param hhmm Time string in HH:MM or HH:MM:SS format (dot/comma will be auto-corrected)
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns UTC Date object or null if time is invalid
 */
export function fromZonedHHMMToUtc(serviceDate: string, hhmm: string, tz: string = 'Asia/Jakarta'): Date | null {
  // Normalize the time format first
  const normalizedTime = normalizeTimeFormat(hhmm);
  
  if (!normalizedTime) {
    return null;
  }
  
  // Create datetime string in local timezone
  const localDateTimeStr = `${serviceDate}T${normalizedTime}`;
  
  // Parse as local time and convert to UTC using the specified timezone
  const localDateTime = parseISO(localDateTimeStr);
  
  // Convert from the specified timezone to UTC
  return fromZonedTime(localDateTime, tz);
}

/**
 * Get day of week in specified timezone
 * @param serviceDate Date string in YYYY-MM-DD format  
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns Day of week (0 = Sunday, 1 = Monday, etc.)
 */
export function getDayInTZ(serviceDate: string, tz: string = 'Asia/Jakarta'): number {
  // Parse the service date as noon to avoid DST edge cases
  const date = parseISO(`${serviceDate}T12:00:00`);
  
  // Format the date in the specified timezone to get the actual date there
  const dateInTZ = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  const dateInTZObj = parseISO(`${dateInTZ}T12:00:00`);
  
  return getDay(dateInTZObj);
}

/**
 * Format timestamp in the specified timezone as HH:MM
 * @param timestamp UTC timestamp (Date object)
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns Time string in HH:MM format
 */
export function formatTimeInTZ(timestamp: Date | null | undefined, tz: string = 'Asia/Jakarta'): string | null {
  if (!timestamp) return null;
  return formatInTimeZone(timestamp, tz, 'HH:mm');
}

/**
 * Format timestamp in the specified timezone as HH:MM:SS
 * @param timestamp UTC timestamp (Date object)
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns Time string in HH:MM:SS format
 */
export function formatTimeWithSecondsInTZ(timestamp: Date | null | undefined, tz: string = 'Asia/Jakarta'): string | null {
  if (!timestamp) return null;
  return formatInTimeZone(timestamp, tz, 'HH:mm:ss');
}

/**
 * Format timestamp in the specified timezone as full datetime string
 * @param timestamp UTC timestamp (Date object)
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns DateTime string in "yyyy-MM-dd HH:mm:ss" format
 */
export function formatDateTimeInTZ(timestamp: Date | null | undefined, tz: string = 'Asia/Jakarta'): string | null {
  if (!timestamp) return null;
  return formatInTimeZone(timestamp, tz, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Convert UTC timestamp to zoned time
 * @param utcTimestamp UTC timestamp
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns Zoned Date object
 */
export function toZonedTimeSafe(utcTimestamp: Date, tz: string = 'Asia/Jakarta'): Date {
  return dateFnsToZonedTime(utcTimestamp, tz);
}

/**
 * Get timezone offset in hours for a specific date
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @param date Optional date to check offset for (defaults to now)
 * @returns Offset in hours (e.g., +7 for Asia/Jakarta)
 */
export function getTimezoneOffset(tz: string = 'Asia/Jakarta', date: Date = new Date()): number {
  const zonedDate = dateFnsToZonedTime(date, tz);
  const offsetMs = zonedDate.getTime() - date.getTime();
  return offsetMs / (1000 * 60 * 60);
}

/**
 * Ensure timezone is set to default if not specified
 * @param timezone Timezone string or null/undefined
 * @returns Timezone string, defaulting to "Asia/Jakarta"
 */
export function ensureDefaultTimezone(timezone?: string | null): string {
  if (!timezone || timezone.trim() === '') {
    return 'Asia/Jakarta';
  }
  return timezone;
}

/**
 * Validate that a time string is in correct format
 * @param timeStr Time string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimeFormat(timeStr: string | null | undefined): boolean {
  if (!timeStr) return false;
  const normalized = normalizeTimeFormat(timeStr);
  return normalized !== null;
}

/**
 * Get current time in specified timezone as HH:MM
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns Current time string in HH:MM format
 */
export function getCurrentTimeInTZ(tz: string = 'Asia/Jakarta'): string {
  return formatInTimeZone(new Date(), tz, 'HH:mm');
}

/**
 * Get current date in specified timezone as YYYY-MM-DD
 * @param tz Timezone string (e.g., "Asia/Jakarta")
 * @returns Current date string in YYYY-MM-DD format
 */
export function getCurrentDateInTZ(tz: string = 'Asia/Jakarta'): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}
