import Decimal from "decimal.js";
import { differenceInCalendarMonths, startOfMonth } from "date-fns";
import { toTimezoneDate } from "@/domain/date-time";
import { toDecimal, type MoneyInput } from "@/domain/money";

export interface GoalContributionRecord {
  amount: MoneyInput;
  contributedAt: Date;
}

export interface GoalProjectionInput {
  targetAmount: MoneyInput;
  currentAmount: MoneyInput;
  targetDate: Date | null;
  contributions: GoalContributionRecord[];
  asOf: Date;
  timezone: string;
  lookbackMonths?: number;
}

export interface GoalProjectionResult {
  averageMonthlyContribution: Decimal;
  estimatedCompletionDate: Date | null;
  isBehindSchedule: boolean;
  requiredMonthlyContribution: Decimal | null;
  remainingAmount: Decimal;
}

function getContributionMonthKey(date: Date, timezone: string): string {
  const zoned = toTimezoneDate(date, timezone);
  return `${zoned.getFullYear()}-${zoned.getMonth()}`;
}

/**
 * Proyección de metas con base en el ritmo promedio de aportes recientes.
 *
 * - Promedio mensual = total aportado en los últimos N meses calendario / N.
 * - Si no hay aportes recientes, el promedio es 0 y no hay fecha estimada.
 * - Si hay targetDate y la proyección la supera, calcula el aporte mensual
 *   requerido para llegar a tiempo.
 */
export function calculateGoalProjection(
  input: GoalProjectionInput,
): GoalProjectionResult {
  const target = toDecimal(input.targetAmount);
  const current = toDecimal(input.currentAmount);
  const remaining = Decimal.max(target.minus(current), new Decimal(0));
  const lookbackMonths = input.lookbackMonths ?? 3;
  const asOfZoned = toTimezoneDate(input.asOf, input.timezone);
  const lookbackStart = startOfMonth(
    new Date(asOfZoned.getFullYear(), asOfZoned.getMonth() - (lookbackMonths - 1), 1),
  );

  const recentContributions = input.contributions.filter(
    (contribution) => contribution.contributedAt >= lookbackStart,
  );

  const monthsWithActivity = new Set(
    recentContributions.map((contribution) =>
      getContributionMonthKey(contribution.contributedAt, input.timezone),
    ),
  ).size;

  const totalRecentContributions = recentContributions.reduce(
    (acc, contribution) => acc.plus(toDecimal(contribution.amount)),
    new Decimal(0),
  );

  const divisor = monthsWithActivity > 0 ? monthsWithActivity : lookbackMonths;
  const averageMonthlyContribution = totalRecentContributions.dividedBy(divisor);

  let estimatedCompletionDate: Date | null = null;

  if (remaining.gt(0) && averageMonthlyContribution.gt(0)) {
    const monthsNeeded = remaining
      .dividedBy(averageMonthlyContribution)
      .toDecimalPlaces(0, Decimal.ROUND_UP)
      .toNumber();

    estimatedCompletionDate = new Date(asOfZoned);
    estimatedCompletionDate.setMonth(estimatedCompletionDate.getMonth() + monthsNeeded);
  }

  let isBehindSchedule = false;
  let requiredMonthlyContribution: Decimal | null = null;

  if (input.targetDate && remaining.gt(0)) {
    const monthsRemaining = Math.max(
      differenceInCalendarMonths(input.targetDate, input.asOf),
      1,
    );

    if (
      estimatedCompletionDate &&
      estimatedCompletionDate.getTime() > input.targetDate.getTime()
    ) {
      isBehindSchedule = true;
    }

    requiredMonthlyContribution = remaining.dividedBy(monthsRemaining);
  }

  return {
    averageMonthlyContribution,
    estimatedCompletionDate,
    isBehindSchedule,
    requiredMonthlyContribution,
    remainingAmount: remaining,
  };
}
