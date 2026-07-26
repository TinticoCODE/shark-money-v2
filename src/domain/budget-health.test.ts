import { describe, expect, it } from "vitest";
import { calculateBudgetHealth } from "@/domain/budget-health";

describe("budget-health", () => {
  it("marca WARNING cuando vas adelantado al ritmo del mes", () => {
    const result = calculateBudgetHealth({
      budgetedAmount: "1000000",
      spentAmount: "700000",
      dayOfMonth: 15,
      daysInMonth: 30,
    });

    expect(result.riskLevel).toBe("WARNING");
    expect(result.isAheadOfPace).toBe(true);
  });

  it("marca OVER_BUDGET cuando el gasto supera el presupuesto", () => {
    const result = calculateBudgetHealth({
      budgetedAmount: "500000",
      spentAmount: "550000",
      dayOfMonth: 20,
      daysInMonth: 30,
    });

    expect(result.riskLevel).toBe("OVER_BUDGET");
  });

  it("marca ON_TRACK con presupuesto cero", () => {
    const result = calculateBudgetHealth({
      budgetedAmount: "0",
      spentAmount: "100000",
      dayOfMonth: 10,
      daysInMonth: 30,
    });

    expect(result.riskLevel).toBe("ON_TRACK");
    expect(result.paceRatio.toString()).toBe("0");
  });
});
