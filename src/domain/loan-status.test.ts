import { describe, expect, it } from "vitest";
import { deriveLoanStatus } from "@/domain/loan-status";

describe("loan-status", () => {
  it("marca PAID cuando el capital pendiente es cero", () => {
    expect(
      deriveLoanStatus({
        outstandingPrincipal: "0",
        dueDate: new Date("2026-01-01"),
        asOf: new Date("2026-06-01"),
      }),
    ).toBe("PAID");
  });

  it("marca OVERDUE cuando la fecha límite ya pasó", () => {
    expect(
      deriveLoanStatus({
        outstandingPrincipal: "100000",
        dueDate: new Date("2026-05-01"),
        asOf: new Date("2026-06-01"),
      }),
    ).toBe("OVERDUE");
  });

  it("marca ACTIVE cuando hay saldo y no hay vencimiento", () => {
    expect(
      deriveLoanStatus({
        outstandingPrincipal: "100000",
        dueDate: null,
        asOf: new Date("2026-06-01"),
      }),
    ).toBe("ACTIVE");
  });
});
