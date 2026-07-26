import { describe, expect, it } from "vitest";
import { calculateFinancialHealthScore } from "@/domain/financial-health-score";

describe("financial-health-score", () => {
  it("asigna score alto cuando todo está en orden", () => {
    const result = calculateFinancialHealthScore({
      savingsRatePercent: "25",
      budgetRiskLevel: "ON_TRACK",
      overdueLoansCount: 0,
      behindScheduleGoalsCount: 0,
      spendingAnomaliesCount: 0,
    });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.label).toBe("EXCELLENT");
  });

  it("penaliza presupuesto excedido y préstamos vencidos", () => {
    const result = calculateFinancialHealthScore({
      savingsRatePercent: "5",
      budgetRiskLevel: "OVER_BUDGET",
      overdueLoansCount: 2,
      behindScheduleGoalsCount: 1,
      spendingAnomaliesCount: 2,
    });

    expect(result.score).toBeLessThan(50);
    expect(result.label).toBe("AT_RISK");
  });
});
