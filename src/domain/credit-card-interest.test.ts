import { describe, expect, it } from "vitest";
import {
  generateCreditCardInstallments,
  isInterestFreeInstallmentPlan,
} from "@/domain/credit-card-interest";

const TZ = "America/Bogota";

describe("credit-card-interest", () => {
  it("1 cuota genera una sola cuota sin interés", () => {
    const installments = generateCreditCardInstallments({
      purchaseAmount: "100000",
      purchaseDate: new Date("2026-03-10T12:00:00.000Z"),
      installmentsCount: 1,
      allowedInterestFreeMonths: [2, 6, 9],
      interestRateMonthly: "0.03",
      cutoffDay: 15,
      timezone: TZ,
    });

    expect(installments).toHaveLength(1);
    expect(installments[0]?.interestAmount.toString()).toBe("0");
    expect(installments[0]?.principalAmount.toString()).toBe("100000");
  });

  it("MSI reparte capital en cuotas iguales sin interés", () => {
    const installments = generateCreditCardInstallments({
      purchaseAmount: "600000",
      purchaseDate: new Date("2026-03-10T12:00:00.000Z"),
      installmentsCount: 6,
      allowedInterestFreeMonths: [2, 6, 9],
      interestRateMonthly: "0.03",
      cutoffDay: 15,
      timezone: TZ,
    });

    expect(installments).toHaveLength(6);
    expect(installments.every((item) => item.interestAmount.isZero())).toBe(true);
    expect(
      installments.reduce((sum, item) => sum + Number(item.principalAmount), 0),
    ).toBe(600000);
  });

  it("cuotas fuera de MSI usan amortización francesa con interés", () => {
    const installments = generateCreditCardInstallments({
      purchaseAmount: "1000000",
      purchaseDate: new Date("2026-03-10T12:00:00.000Z"),
      installmentsCount: 12,
      allowedInterestFreeMonths: [2, 6, 9],
      interestRateMonthly: "0.02",
      cutoffDay: 15,
      timezone: TZ,
    });

    expect(installments).toHaveLength(12);
    expect(installments.some((item) => item.interestAmount.gt(0))).toBe(true);
    expect(
      installments.reduce(
        (sum, item) => sum + Number(item.principalAmount) + Number(item.interestAmount),
        0,
      ),
    ).toBeCloseTo(1000000 + installments.reduce((s, i) => s + Number(i.interestAmount), 0), 0);
  });

  it("tasa cero fuera de MSI reparte capital sin interés", () => {
    expect(isInterestFreeInstallmentPlan(3, [2, 6])).toBe(false);

    const installments = generateCreditCardInstallments({
      purchaseAmount: "300000",
      purchaseDate: new Date("2026-03-10T12:00:00.000Z"),
      installmentsCount: 3,
      allowedInterestFreeMonths: [2, 6],
      interestRateMonthly: "0",
      cutoffDay: 15,
      timezone: TZ,
    });

    expect(installments.every((item) => item.interestAmount.isZero())).toBe(true);
    expect(
      installments.reduce((sum, item) => sum + Number(item.principalAmount), 0),
    ).toBe(300000);
  });
});
