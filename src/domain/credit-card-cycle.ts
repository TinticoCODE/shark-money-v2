import { addDays, addMonths, setDate } from "date-fns";
import {
  daysInMonthForTimezone,
  toTimezoneDate,
} from "@/domain/date-time";

export interface BillingCycleRef {
  year: number;
  month: number;
}

export interface CreditCardCycleSnapshot {
  recentCutoffDate: Date;
  nextCutoffDate: Date;
  paymentDueDate: Date;
  currentBillingCycle: BillingCycleRef;
}

/**
 * Ciclos de facturación — tarjetas de crédito (SHARK MONEY)
 *
 * - cutoffDay: día del mes (1–31) en que cierra el extracto, en timezone del usuario.
 *   Si el mes tiene menos días, se usa el último día del mes.
 * - MVP: un solo corte fijo por tarjeta. Algunas tarjetas reales (ej. RappiCard) tienen
 *   más de un corte al mes; el sistema no modela eso — las fechas derivadas son una
 *   aproximación. Ver CREDIT_CARD_CYCLE_APPROXIMATION_NOTE en la UI de detalle.
 * - Ciclo de facturación identificado por (billingCycleYear, billingCycleMonth)
 *   = año y mes calendario del corte que cierra ese ciclo.
 * - Corte más reciente ya ocurrido: el cutoffDay del mes actual si hoy >= cutoffDay;
 *   si no, el cutoffDay del mes anterior.
 * - Próximo corte: corte más reciente + 1 mes (mismo cutoffDay clamped).
 * - Fecha límite de pago = corte más reciente + paymentDueOffsetDays (días calendario).
 *
 * Compra → ciclo de facturación:
 * - Si el día de la compra (timezone) <= cutoffDay del mes → ciclo cierra ese mes.
 * - Si es posterior → ciclo cierra el mes siguiente.
 */
export function clampCutoffDay(
  cutoffDay: number,
  year: number,
  monthIndex: number,
  timezone: string,
): number {
  const reference = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = daysInMonthForTimezone(reference, timezone);
  return Math.min(Math.max(cutoffDay, 1), daysInMonth);
}

export function getCutoffDateForMonth(
  year: number,
  monthIndex: number,
  cutoffDay: number,
  timezone: string,
): Date {
  const clampedDay = clampCutoffDay(cutoffDay, year, monthIndex, timezone);
  const zoned = toTimezoneDate(new Date(Date.UTC(year, monthIndex, clampedDay)), timezone);
  return setDate(zoned, clampedDay);
}

export function getBillingCycleForDate(
  date: Date,
  cutoffDay: number,
  timezone: string,
): BillingCycleRef {
  const zoned = toTimezoneDate(date, timezone);
  const year = zoned.getFullYear();
  const monthIndex = zoned.getMonth();
  const day = zoned.getDate();
  const clampedCutoff = clampCutoffDay(cutoffDay, year, monthIndex, timezone);

  if (day <= clampedCutoff) {
    return { year, month: monthIndex + 1 };
  }

  const next = addMonths(new Date(year, monthIndex, 1), 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

export function addBillingCycles(
  cycle: BillingCycleRef,
  count: number,
): BillingCycleRef {
  const base = new Date(cycle.year, cycle.month - 1, 1);
  const shifted = addMonths(base, count);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}

export function compareBillingCycles(
  left: BillingCycleRef,
  right: BillingCycleRef,
): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  return left.month - right.month;
}

export function getCreditCardCycleSnapshot(
  now: Date,
  cutoffDay: number,
  paymentDueOffsetDays: number,
  timezone: string,
): CreditCardCycleSnapshot {
  const zoned = toTimezoneDate(now, timezone);
  const year = zoned.getFullYear();
  const monthIndex = zoned.getMonth();
  const day = zoned.getDate();
  const clampedThisMonth = clampCutoffDay(cutoffDay, year, monthIndex, timezone);

  let recentYear = year;
  let recentMonthIndex = monthIndex;

  if (day < clampedThisMonth) {
    const previous = addMonths(new Date(year, monthIndex, 1), -1);
    recentYear = previous.getFullYear();
    recentMonthIndex = previous.getMonth();
  }

  const recentCutoffDate = getCutoffDateForMonth(
    recentYear,
    recentMonthIndex,
    cutoffDay,
    timezone,
  );
  const nextMonth = addMonths(new Date(recentYear, recentMonthIndex, 1), 1);
  const nextCutoffDate = getCutoffDateForMonth(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    cutoffDay,
    timezone,
  );
  const paymentDueDate = addDays(recentCutoffDate, paymentDueOffsetDays);

  return {
    recentCutoffDate,
    nextCutoffDate,
    paymentDueDate,
    currentBillingCycle: {
      year: recentYear,
      month: recentMonthIndex + 1,
    },
  };
}
