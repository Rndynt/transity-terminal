import { parseISO, getDay } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { createComponentLogger } from "../lib/logger";

const log = createComponentLogger("timezone");

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
    log.warn({ timeStr }, "invalid time format; expected HH:MM or HH:MM:SS");
    return null;
  }
  
  // Ensure we have seconds component
  if (normalized.split(':').length === 2) {
    normalized = `${normalized}:00`;
  }
  
  // Validate time values (hours 0-23, minutes 0-59, seconds 0-59)
  const parts = normalized.split(':').map(Number);
  if (parts[0] > 23 || parts[1] > 59 || parts[2] > 59) {
    log.warn({ timeStr }, "invalid time values (hours/minutes/seconds out of range)");
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
