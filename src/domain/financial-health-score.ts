import Decimal from "decimal.js";
import type { BudgetHealthRiskLevel } from "@/domain/budget-health";
import { toDecimal } from "@/domain/money";

export interface FinancialHealthInput {
  savingsRatePercent: number | string;
  budgetRiskLevel: BudgetHealthRiskLevel;
  overdueLoansCount: number;
  behindScheduleGoalsCount: number;
  spendingAnomaliesCount: number;
}

export interface FinancialHealthResult {
  score: number;
  label: "EXCELLENT" | "GOOD" | "FAIR" | "AT_RISK";
  factors: {
    savings: number;
    budget: number;
    loans: number;
    goals: number;
    anomalies: number;
  };
}

/**
 * Score compuesto de salud financiera (0–100) — SHARK MONEY MVP
 *
 * El score es la SUMA de cinco componentes independientes. Máximo teórico: 100.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENTE 1 — AHORRO (savings-rate.ts)                    Peso máx: 35 pts
 * ─────────────────────────────────────────────────────────────────────────────
 * Entrada: savingsRatePercent = tasa de ahorro del mes (%), calculada en
 *   savings-rate.ts como:
 *     ((ingresos reales − gastos reales) / ingresos reales) × 100
 *   (excluye TRANSFER, préstamos y aportes a metas).
 *
 * Fórmula del factor:
 *   savingsFactor = clamp(savingsRatePercent, 0, 30) / 30 × 35
 *
 * Ejemplos:
 *   - 0% de ahorro  → 0 pts
 *   - 15% de ahorro → 17.5 pts
 *   - 30% o más     → 35 pts (tope)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENTE 2 — PRESUPUESTO (budget-health.ts)              Peso máx: 25 pts
 * ─────────────────────────────────────────────────────────────────────────────
 * Entrada: budgetRiskLevel derivado de budget-health.ts comparando gasto total
 *   del mes vs presupuesto total y el ritmo según el día del mes.
 *
 * Puntos asignados:
 *   - ON_TRACK    → 25 pts
 *   - WARNING     → 10 pts  (ritmo adelantado o ≥80% del presupuesto usado)
 *   - OVER_BUDGET →  0 pts  (gasto superó el presupuesto total)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENTE 3 — PRÉSTAMOS (loan-status.ts)                  Peso máx: 15 pts
 * ─────────────────────────────────────────────────────────────────────────────
 * Entrada: overdueLoansCount = cantidad de préstamos con estado derivado
 *   OVERDUE (dueDate pasada y capital pendiente > 0).
 *
 * Puntos asignados:
 *   - 0 vencidos → 15 pts
 *   - ≥1 vencido →  0 pts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENTE 4 — METAS (goal-projection.ts)                  Peso máx: 15 pts
 * ─────────────────────────────────────────────────────────────────────────────
 * Entrada: behindScheduleGoalsCount = metas con targetDate definida cuya
 *   proyección (goal-projection.ts) indica isBehindSchedule = true.
 *
 * Puntos asignados:
 *   - 0 metas atrasadas → 15 pts
 *   - ≥1 meta atrasada  →  5 pts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENTE 5 — ANOMALÍAS (anomaly-detection.ts)            Peso máx: 10 pts
 * ─────────────────────────────────────────────────────────────────────────────
 * Entrada: spendingAnomaliesCount = categorías donde el gasto del mes actual
 *   supera ≥150% del promedio de los últimos 3 meses.
 *
 * Puntos asignados:
 *   - 0 anomalías → 10 pts
 *   - ≥1 anomalía →  3 pts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCORE FINAL Y ETIQUETA
 * ─────────────────────────────────────────────────────────────────────────────
 *   score = round(savingsFactor + budgetFactor + loansFactor + goalsFactor + anomaliesFactor)
 *
 *   score ≥ 85 → EXCELLENT
 *   score ≥ 70 → GOOD
 *   score ≥ 50 → FAIR
 *   score <  50 → AT_RISK
 */
export function calculateFinancialHealthScore(
  input: FinancialHealthInput,
): FinancialHealthResult {
  const savingsRate = toDecimal(input.savingsRatePercent);

  const savingsFactor = Decimal.max(
    Decimal.min(savingsRate, new Decimal(30)),
    new Decimal(0),
  )
    .dividedBy(30)
    .times(35)
    .toNumber();

  const budgetFactor =
    input.budgetRiskLevel === "ON_TRACK"
      ? 25
      : input.budgetRiskLevel === "WARNING"
        ? 10
        : 0;

  const loansFactor = input.overdueLoansCount === 0 ? 15 : 0;
  const goalsFactor = input.behindScheduleGoalsCount === 0 ? 15 : 5;
  const anomaliesFactor = input.spendingAnomaliesCount === 0 ? 10 : 3;

  const score = Math.round(
    savingsFactor + budgetFactor + loansFactor + goalsFactor + anomaliesFactor,
  );

  let label: FinancialHealthResult["label"] = "AT_RISK";
  if (score >= 85) {
    label = "EXCELLENT";
  } else if (score >= 70) {
    label = "GOOD";
  } else if (score >= 50) {
    label = "FAIR";
  }

  return {
    score,
    label,
    factors: {
      savings: Math.round(savingsFactor),
      budget: budgetFactor,
      loans: loansFactor,
      goals: goalsFactor,
      anomalies: anomaliesFactor,
    },
  };
}
