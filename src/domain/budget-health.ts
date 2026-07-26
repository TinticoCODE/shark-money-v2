import Decimal from "decimal.js";
import { percentOf, toDecimal, type MoneyInput } from "@/domain/money";

export type BudgetHealthRiskLevel = "ON_TRACK" | "WARNING" | "OVER_BUDGET";

export interface BudgetHealthInput {
  budgetedAmount: MoneyInput;
  spentAmount: MoneyInput;
  dayOfMonth: number;
  daysInMonth: number;
}

export interface BudgetHealthResult {
  budgetUsedPercent: Decimal;
  monthElapsedPercent: Decimal;
  paceRatio: Decimal;
  riskLevel: BudgetHealthRiskLevel;
  isAheadOfPace: boolean;
}

/**
 * Compara gasto acumulado vs presupuesto total del mes respecto al avance del calendario.
 *
 * paceRatio = (% presupuesto usado) / (% del mes transcurrido)
 * - paceRatio > 1 → vas más rápido de lo esperado para la fecha.
 * - OVER_BUDGET si el gasto ya superó el presupuesto total.
 * - WARNING si vas adelantado al ritmo (paceRatio > 1) o ya consumiste ≥ 80% del presupuesto.
 */
export function calculateBudgetHealth(input: BudgetHealthInput): BudgetHealthResult {
  const budgeted = toDecimal(input.budgetedAmount);
  const spent = toDecimal(input.spentAmount);
  const safeDaysInMonth = Math.max(input.daysInMonth, 1);
  const safeDayOfMonth = Math.min(Math.max(input.dayOfMonth, 1), safeDaysInMonth);

  const budgetUsedPercent = budgeted.isZero()
    ? new Decimal(0)
    : percentOf(spent, budgeted);

  const monthElapsedPercent = toDecimal(safeDayOfMonth)
    .dividedBy(safeDaysInMonth)
    .times(100);

  const paceRatio = monthElapsedPercent.isZero()
    ? new Decimal(0)
    : budgetUsedPercent.dividedBy(monthElapsedPercent);

  const isAheadOfPace = paceRatio.gt(1);
  let riskLevel: BudgetHealthRiskLevel = "ON_TRACK";

  if (!budgeted.isZero() && spent.gte(budgeted)) {
    riskLevel = "OVER_BUDGET";
  } else if (isAheadOfPace || budgetUsedPercent.gte(80)) {
    riskLevel = "WARNING";
  }

  return {
    budgetUsedPercent,
    monthElapsedPercent,
    paceRatio,
    riskLevel,
    isAheadOfPace,
  };
}
