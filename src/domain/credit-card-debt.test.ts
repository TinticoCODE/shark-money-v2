import { describe, expect, it } from "vitest";
import { applyAllocationDeltas, allocatePaymentToInstallments } from "@/domain/credit-card-payment-allocation";
import { deriveCreditCardDebtStatus } from "@/domain/credit-card-debt";

describe("credit-card-debt", () => {
  it("clasifica DEUDA_CON_INTERES cuando el pago cubre MSI pero deja cuota con interés pendiente en el mismo ciclo", () => {
    const installments = [
      {
        id: "msi-1",
        installmentNumber: 1,
        billingCycleYear: 2026,
        billingCycleMonth: 3,
        principalAmount: "100",
        interestAmount: "0",
        paidAmount: "0",
      },
      {
        id: "interest-1",
        installmentNumber: 2,
        billingCycleYear: 2026,
        billingCycleMonth: 3,
        principalAmount: "100",
        interestAmount: "20",
        paidAmount: "0",
      },
    ];

    const allocation = allocatePaymentToInstallments("100", installments);
    expect(allocation.allocations).toEqual([
      { installmentId: "msi-1", appliedAmount: expect.anything() },
    ]);
    expect(allocation.allocations[0]?.appliedAmount.toString()).toBe("100");

    const paidMap = applyAllocationDeltas(
      installments,
      allocation.allocations.map((item) => ({
        installmentId: item.installmentId,
        delta: item.appliedAmount,
      })),
    );

    const installmentsAfterPayment = installments.map((installment) => ({
      ...installment,
      paidAmount: paidMap.get(installment.id)?.toString() ?? installment.paidAmount,
    }));

    expect(deriveCreditCardDebtStatus({
      usedBalance: "120",
      installments: installmentsAfterPayment,
    })).toBe("DEUDA_CON_INTERES");
  });
});
