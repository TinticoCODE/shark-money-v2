import { describe, expect, it } from "vitest";
import { calculateSavingsRate } from "@/domain/savings-rate";

describe("savings-rate", () => {
  it("excluye transferencias, préstamos y aportes a metas", () => {
    const result = calculateSavingsRate({
      transactions: [
        { type: "INCOME", amount: "1000000", loanId: null, loanPayment: null, goalContribution: null, creditCardPayment: null, creditCardPurchase: null },
        { type: "EXPENSE", amount: "300000", loanId: null, loanPayment: null, goalContribution: null, creditCardPayment: null, creditCardPurchase: null },
        { type: "TRANSFER", amount: "50000", loanId: null, loanPayment: null, goalContribution: null, creditCardPayment: null, creditCardPurchase: null },
        { type: "EXPENSE", amount: "200000", loanId: "loan-1", loanPayment: null, goalContribution: null, creditCardPayment: null, creditCardPurchase: null },
        { type: "INCOME", amount: "100000", loanId: null, loanPayment: { id: "pay-1" }, goalContribution: null, creditCardPayment: null, creditCardPurchase: null },
        { type: "EXPENSE", amount: "80000", loanId: null, loanPayment: null, goalContribution: { id: "goal-1" }, creditCardPayment: null, creditCardPurchase: null },
      ],
    });

    expect(result.totalIncome.toString()).toBe("1000000");
    expect(result.totalExpenses.toString()).toBe("300000");
    expect(result.netSavings.toString()).toBe("700000");
    expect(result.savingsRatePercent.toString()).toBe("70");
  });

  it("devuelve tasa cero cuando no hay ingresos reales", () => {
    const result = calculateSavingsRate({
      transactions: [
        { type: "EXPENSE", amount: "100000", loanId: null, loanPayment: null, goalContribution: null, creditCardPayment: null, creditCardPurchase: null },
      ],
    });

    expect(result.savingsRatePercent.toString()).toBe("0");
  });
});
