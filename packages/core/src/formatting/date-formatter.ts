import type { DateFormat, TimeFormat } from "./types";

/**
 * Validates whether a given string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

function toValidDate(input: Date | string | number): Date | null {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  const date = new Date(input);
  return isNaN(date.getTime()) ? null : date;
}

export interface FormatDateOptions {
  format?: DateFormat | undefined;
  timezone?: string | undefined;
}

/**
 * Formats a Date or timestamp into the requested DateFormat in the given IANA timezone.
 * Supports both options object or positional arguments.
 * Defaults: format = "DD/MM/YYYY", timezone = "Asia/Kolkata".
 */
export function formatDate(
  dateInput: Date | string | number | null | undefined,
  formatOrOptions: DateFormat | FormatDateOptions = "DD/MM/YYYY",
  timeZone: string = "Asia/Kolkata",
): string {
  if (dateInput === null || dateInput === undefined) return "";
  let format: DateFormat = "DD/MM/YYYY";
  let tz: string = timeZone || "Asia/Kolkata";

  if (typeof formatOrOptions === "object" && formatOrOptions !== null) {
    if (formatOrOptions.format) format = formatOrOptions.format;
    if (formatOrOptions.timezone) tz = formatOrOptions.timezone;
  } else if (typeof formatOrOptions === "string") {
    format = formatOrOptions;
  }

  // Preserve pure calendar dates without time component (e.g. "2026-05-15")
  // to avoid false calendar-day shifts across UTC boundaries.
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      switch (format) {
        case "MM/DD/YYYY":
          return `${month}/${day}/${year}`;
        case "YYYY-MM-DD":
          return `${year}-${month}-${day}`;
        case "DD/MM/YYYY":
        default:
          return `${day}/${month}/${year}`;
      }
    }
  }

  const date = toValidDate(dateInput);
  if (!date) return "";

  const safeTz = isValidIanaTimezone(tz) ? tz : "Asia/Kolkata";

  // Use Intl.DateTimeFormat to break down the date parts in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      partMap[p.type] = p.value;
    }
  }

  const day = partMap.day || "01";
  const month = partMap.month || "01";
  const year = partMap.year || "1970";

  switch (format) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD/MM/YYYY":
    default:
      return `${day}/${month}/${year}`;
  }
}

export interface FormatTimeOptions {
  format?: TimeFormat | undefined;
  timezone?: string | undefined;
}

/**
 * Formats a Date or timestamp into the requested TimeFormat in the given IANA timezone.
 * Supports both options object or positional arguments.
 * Defaults: format = "12h", timezone = "Asia/Kolkata".
 */
export function formatTime(
  dateInput: Date | string | number | null | undefined,
  formatOrOptions: TimeFormat | FormatTimeOptions = "12h",
  timeZone: string = "Asia/Kolkata",
): string {
  if (dateInput === null || dateInput === undefined) return "";
  const date = toValidDate(dateInput);
  if (!date) return "";

  let format: TimeFormat = "12h";
  let tz: string = timeZone || "Asia/Kolkata";

  if (typeof formatOrOptions === "object" && formatOrOptions !== null) {
    if (formatOrOptions.format) format = formatOrOptions.format;
    if (formatOrOptions.timezone) tz = formatOrOptions.timezone;
  } else if (typeof formatOrOptions === "string") {
    format = formatOrOptions;
  }

  const safeTz = isValidIanaTimezone(tz) ? tz : "Asia/Kolkata";

  const is12Hour = format === "12h";
  if (is12Hour) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return formatter.format(date);
  }

  // 24h format (HH:mm)
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(date);
}

/**
 * Formats date and time together.
 */
export function formatDateTime(
  dateInput: Date | string | number | null | undefined,
  options?: {
    dateFormat?: DateFormat | undefined;
    timeFormat?: TimeFormat | undefined;
    timeZone?: string | undefined;
    separator?: string | undefined;
  },
): string {
  if (dateInput === null || dateInput === undefined) return "";
  const d = formatDate(
    dateInput,
    options?.dateFormat ?? "DD/MM/YYYY",
    options?.timeZone ?? "Asia/Kolkata",
  );
  const t = formatTime(
    dateInput,
    options?.timeFormat ?? "12h",
    options?.timeZone ?? "Asia/Kolkata",
  );
  if (!d) return "";
  const sep = options?.separator ?? " ";
  return `${d}${sep}${t}`;
}
