import { describe, expect, it } from "vitest";
import { creditCardMonthlyRatePercentSchema } from "@/validators/credit-card";

describe("creditCardMonthlyRatePercentSchema", () => {
  it("normaliza porcentaje a decimal mensual", () => {
    expect(creditCardMonthlyRatePercentSchema.parse("2.878")).toBe("0.02878");
    expect(creditCardMonthlyRatePercentSchema.parse("1.9957")).toBe("0.019957");
    expect(creditCardMonthlyRatePercentSchema.parse("0")).toBe("0");
  });

  it("rechaza tasas cuyo decimal supera 10% mensual", () => {
    expect(() => creditCardMonthlyRatePercentSchema.parse("28.78")).toThrow(
      /no puede superar 10%/,
    );
  });
});
