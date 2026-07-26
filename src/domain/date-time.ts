import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export function nowInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

export function toTimezoneDate(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

export function startOfMonthInTimezone(date: Date, timezone: string): Date {
  const zoned = toZonedTime(date, timezone);
  const monthStart = startOfMonth(zoned);
  return fromZonedTime(startOfDay(monthStart), timezone);
}

export function endOfMonthInTimezone(date: Date, timezone: string): Date {
  const zoned = toZonedTime(date, timezone);
  const monthEnd = endOfMonth(zoned);
  return fromZonedTime(endOfDay(monthEnd), timezone);
}

export function dayOfMonthInTimezone(date: Date, timezone: string): number {
  return toZonedTime(date, timezone).getDate();
}

export function daysInMonthForTimezone(date: Date, timezone: string): number {
  const zoned = toZonedTime(date, timezone);
  return endOfMonth(zoned).getDate();
}

export function calendarDaysBetween(start: Date, end: Date): number {
  return Math.max(0, differenceInCalendarDays(end, start));
}

export function isDateInMonth(
  date: Date,
  reference: Date,
  timezone: string,
): boolean {
  const zonedDate = toZonedTime(date, timezone);
  const zonedReference = toZonedTime(reference, timezone);

  return (
    zonedDate.getFullYear() === zonedReference.getFullYear() &&
    zonedDate.getMonth() === zonedReference.getMonth()
  );
}
