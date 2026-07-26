import { describe, expect, it } from "vitest";
import {
  isExcludedFromRealCashflow,
  isRealExpense,
  isRealIncome,
} from "@/domain/transaction-classification";

describe("transaction-classification", () => {
  it("excluye transferencias y movimientos de préstamos o metas", () => {
    expect(
      isExcludedFromRealCashflow({
        type: "TRANSFER",
        loanId: null,
        loanPayment: null,
        goalContribution: null,
        creditCardPayment: null,
        creditCardPurchase: null,
      }),
    ).toBe(true);

    expect(
      isExcludedFromRealCashflow({
        type: "EXPENSE",
        loanId: "loan-1",
        loanPayment: null,
        goalContribution: null,
        creditCardPayment: null,
        creditCardPurchase: null,
      }),
    ).toBe(true);

    expect(
      isRealIncome({
        type: "INCOME",
        loanId: null,
        loanPayment: { id: "payment-1" },
        goalContribution: null,
        creditCardPayment: null,
        creditCardPurchase: null,
      }),
    ).toBe(false);

    expect(
      isRealExpense({
        type: "EXPENSE",
        loanId: null,
        loanPayment: null,
        goalContribution: { id: "goal-1" },
        creditCardPayment: null,
        creditCardPurchase: null,
      }),
    ).toBe(false);

    expect(
      isRealExpense({
        type: "EXPENSE",
        loanId: null,
        loanPayment: null,
        goalContribution: null,
        creditCardPayment: null,
        creditCardPurchase: { id: "purchase-1" },
      }),
    ).toBe(true);

    expect(
      isRealExpense({
        type: "EXPENSE",
        loanId: null,
        loanPayment: null,
        goalContribution: null,
        creditCardPayment: { id: "payment-1" },
        creditCardPurchase: null,
      }),
    ).toBe(false);
  });
});
