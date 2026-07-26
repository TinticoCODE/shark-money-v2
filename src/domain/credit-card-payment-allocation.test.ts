import { describe, expect, it } from "vitest";
import {
  allocatePaymentToInstallments,
  reversePaymentAllocation,
  reverseStoredPaymentAllocations,
} from "@/domain/credit-card-payment-allocation";

describe("credit-card-payment-allocation", () => {
  const installments = [
    {
      id: "a",
      installmentNumber: 1,
      billingCycleYear: 2026,
      billingCycleMonth: 1,
      principalAmount: "100",
      interestAmount: "0",
      paidAmount: "0",
    },
    {
      id: "b",
      installmentNumber: 2,
      billingCycleYear: 2026,
      billingCycleMonth: 2,
      principalAmount: "100",
      interestAmount: "10",
      paidAmount: "0",
    },
  ];

  it("aplica FIFO cubriendo cuotas completas en orden", () => {
    const result = allocatePaymentToInstallments("150", installments);

    expect(result.allocations).toEqual([
      { installmentId: "a", appliedAmount: expect.anything() },
      { installmentId: "b", appliedAmount: expect.anything() },
    ]);
    expect(result.allocations[0]?.appliedAmount.toString()).toBe("100");
    expect(result.allocations[1]?.appliedAmount.toString()).toBe("50");
    expect(result.unallocatedAmount.toString()).toBe("0");
  });

  it("deja saldo parcial en la cuota que toca si el pago no alcanza", () => {
    const result = allocatePaymentToInstallments("120", installments);

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]?.appliedAmount.toString()).toBe("100");
    expect(result.allocations[1]?.appliedAmount.toString()).toBe("20");
  });

  it("revierte un pago en orden inverso", () => {
    const paid = [
      { ...installments[0]!, paidAmount: "100" },
      { ...installments[1]!, paidAmount: "50" },
    ];

    const reversals = reversePaymentAllocation("150", paid);
    expect(reversals[0]?.installmentId).toBe("b");
    expect(reversals[0]?.reversedAmount.toString()).toBe("50");
    expect(reversals[1]?.installmentId).toBe("a");
    expect(reversals[1]?.reversedAmount.toString()).toBe("100");
  });

  it("revierte exactamente las asignaciones persistidas del pago", () => {
    const stored = [
      { installmentId: "a", amount: "100" },
      { installmentId: "b", amount: "20" },
    ];

    expect(reverseStoredPaymentAllocations(stored)).toEqual([
      { installmentId: "a", reversedAmount: expect.anything() },
      { installmentId: "b", reversedAmount: expect.anything() },
    ]);
    expect(reverseStoredPaymentAllocations(stored)[0]?.reversedAmount.toString()).toBe("100");
    expect(reverseStoredPaymentAllocations(stored)[1]?.reversedAmount.toString()).toBe("20");
  });

  it("LIFO global no coincide con la asignación FIFO del pago cuando hay pagos encadenados", () => {
    const paidAfterTwoPayments = [
      { ...installments[0]!, paidAmount: "100" },
      { ...installments[1]!, paidAmount: "120" },
    ];

    const lifoReversal = reversePaymentAllocation("120", paidAfterTwoPayments);
    expect(lifoReversal).toEqual([{ installmentId: "b", reversedAmount: expect.anything() }]);
    expect(lifoReversal[0]?.reversedAmount.toString()).toBe("120");

    const exactReversal = reverseStoredPaymentAllocations([
      { installmentId: "a", amount: "100" },
      { installmentId: "b", amount: "20" },
    ]);
    expect(exactReversal.map((item) => item.installmentId)).toEqual(["a", "b"]);
    expect(exactReversal[0]?.reversedAmount.toString()).toBe("100");
    expect(exactReversal[1]?.reversedAmount.toString()).toBe("20");
  });
});
