import Decimal from "decimal.js";
import { toDecimal, type MoneyInput } from "@/domain/money";

export interface CategorySpendingSnapshot {
  categoryId: string;
  categoryName: string;
  currentMonthSpent: MoneyInput;
  previousMonthsSpent: MoneyInput[];
}

export interface SpendingAnomaly {
  categoryId: string;
  categoryName: string;
  currentMonthSpent: Decimal;
  averagePreviousSpent: Decimal;
  growthRatio: Decimal;
}

export interface AnomalyDetectionInput {
  categories: CategorySpendingSnapshot[];
  growthThreshold?: number;
}

/**
 * Detecta categorías cuyo gasto del mes actual supera anormalmente el promedio
 * de los últimos 3 meses (por defecto, ≥ 150% del promedio).
 *
 * Solo evalúa categorías con al menos un mes previo de datos y gasto actual > 0.
 */
export function detectSpendingAnomalies(
  input: AnomalyDetectionInput,
): SpendingAnomaly[] {
  const threshold = input.growthThreshold ?? 1.5;
  const anomalies: SpendingAnomaly[] = [];

  for (const category of input.categories) {
    if (category.previousMonthsSpent.length === 0) {
      continue;
    }

    const current = toDecimal(category.currentMonthSpent);
    if (current.isZero()) {
      continue;
    }

    const previousTotal = category.previousMonthsSpent.reduce<Decimal>(
      (acc, amount) => acc.plus(toDecimal(amount)),
      new Decimal(0),
    );
    const averagePrevious = previousTotal.dividedBy(category.previousMonthsSpent.length);

    if (averagePrevious.isZero()) {
      continue;
    }

    const growthRatio = current.dividedBy(averagePrevious);
    if (growthRatio.lt(threshold)) {
      continue;
    }

    anomalies.push({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      currentMonthSpent: current,
      averagePreviousSpent: averagePrevious,
      growthRatio,
    });
  }

  return anomalies.sort((left, right) =>
    right.growthRatio.comparedTo(left.growthRatio),
  );
}
