import { describe, expect, it } from "vitest";
import { calculateAvailableSavings } from "@/domain/available-savings";

describe("available-savings", () => {
  it("excluye movimientos internos y resta presupuesto pendiente", () => {
    const result = calculateAvailableSavings({
      transactions: [
        { type: "INCOME", amount: "2000000", loanId: null, loanPayment: null, goalContribution: null, isRecurring: false },
        { type: "EXPENSE", amount: "500000", loanId: null, loanPayment: null, goalContribution: null, isRecurring: true },
        { type: "EXPENSE", amount: "100000", loanId: null, loanPayment: null, goalContribution: null, isRecurring: false },
        { type: "EXPENSE", amount: "300000", loanId: "loan-1", loanPayment: null, goalContribution: null, isRecurring: false },
      ],
      budgets: [
        { budgetedAmount: "400000", spentAmount: "150000" },
        { budgetedAmount: "200000", spentAmount: "250000" },
      ],
    });

    expect(result.totalIncome.toString()).toBe("2000000");
    expect(result.totalFixedExpenses.toString()).toBe("500000");
    expect(result.totalRemainingBudget.toString()).toBe("250000");
    expect(result.availableSavings.toString()).toBe("1250000");
  });
});
