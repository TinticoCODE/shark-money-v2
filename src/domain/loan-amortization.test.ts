import { describe, expect, it } from "vitest";
import {
  calculateAccruedInterest,
  PRORATION_DAYS_IN_MONTH,
  splitLoanPayment,
} from "@/domain/loan-amortization";

describe("loan-amortization", () => {
  const timezone = "America/Bogota";

  it("devuelve interés cero cuando la tasa es cero", () => {
    const interest = calculateAccruedInterest({
      outstandingPrincipal: "1000000",
      monthlyInterestRate: "0",
      lastInterestAccruedAt: new Date("2026-01-01T00:00:00.000Z"),
      paymentDate: new Date("2026-02-15T00:00:00.000Z"),
      timezone,
    });

    expect(interest.toString()).toBe("0");
  });

  it("prorratea con base fija de 30 días", () => {
    const interest = calculateAccruedInterest({
      outstandingPrincipal: "1000000",
      monthlyInterestRate: "0.03",
      lastInterestAccruedAt: new Date("2026-01-01T00:00:00.000Z"),
      paymentDate: new Date("2026-01-16T00:00:00.000Z"),
      timezone,
    });

    expect(PRORATION_DAYS_IN_MONTH).toBe(30);
    expect(interest.toString()).toBe("15000");
  });

  it("sigue siendo estable cuando el abono tarda más de un mes", () => {
    const interest = calculateAccruedInterest({
      outstandingPrincipal: "1000000",
      monthlyInterestRate: "0.03",
      lastInterestAccruedAt: new Date("2026-01-01T00:00:00.000Z"),
      paymentDate: new Date("2026-03-02T00:00:00.000Z"),
      timezone,
    });

    expect(interest.toString()).toBe("60000");
  });

  it("aplica primero interés y luego capital en el abono", () => {
    const breakdown = splitLoanPayment("50000", {
      outstandingPrincipal: "1000000",
      monthlyInterestRate: "0.03",
      lastInterestAccruedAt: new Date("2026-01-01T00:00:00.000Z"),
      paymentDate: new Date("2026-01-16T00:00:00.000Z"),
      timezone,
    });

    expect(breakdown.interestAmount.toString()).toBe("15000");
    expect(breakdown.principalAmount.toString()).toBe("35000");
    expect(breakdown.totalAmount.toString()).toBe("50000");
  });
});
