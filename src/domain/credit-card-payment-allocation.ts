import Decimal from "decimal.js";
import { compareBillingCycles } from "@/domain/credit-card-cycle";
import { roundMoney, toDecimal, type MoneyInput } from "@/domain/money";

export interface InstallmentAllocationTarget {
  id: string;
  installmentNumber: number;
  billingCycleYear: number;
  billingCycleMonth: number;
  principalAmount: MoneyInput;
  interestAmount: MoneyInput;
  paidAmount: MoneyInput;
}

export interface InstallmentAllocationResult {
  allocations: Array<{ installmentId: string; appliedAmount: Decimal }>;
  unallocatedAmount: Decimal;
}

/**
 * Asignación FIFO de pagos a cuotas — tarjetas de crédito (SHARK MONEY)
 *
 * Cada pago se aplica a las cuotas pendientes más antiguas, en orden:
 *   billingCycleYear → billingCycleMonth → installmentNumber.
 *
 * Por cuota, el monto total exigible = principalAmount + interestAmount.
 * Pendiente de esa cuota = total exigible − paidAmount.
 *
 * Reglas:
 * - Se cubre cuota por cuota completa en orden; no se reparte un pago entre
 *   varias cuotas salvo la última tocada.
 * - Si el pago no alcanza para liquidar la cuota que toca, solo se aplica el
 *   remanente del pago a esa cuota (saldo parcial pendiente en esa cuota).
 * - No se adelanta capital a cuotas posteriores mientras haya una anterior con
 *   saldo pendiente > 0.
 *
 * La reversión de un pago en el servicio usa las asignaciones persistidas
 * (CreditCardPaymentAllocation) para deshacer exactamente el FIFO aplicado.
 */
export function sortInstallmentsForAllocation(
  installments: InstallmentAllocationTarget[],
): InstallmentAllocationTarget[] {
  return [...installments].sort((left, right) => {
    const cycleCompare = compareBillingCycles(
      { year: left.billingCycleYear, month: left.billingCycleMonth },
      { year: right.billingCycleYear, month: right.billingCycleMonth },
    );

    if (cycleCompare !== 0) {
      return cycleCompare;
    }

    return left.installmentNumber - right.installmentNumber;
  });
}

export function getInstallmentTotalDue(installment: InstallmentAllocationTarget): Decimal {
  return toDecimal(installment.principalAmount).plus(toDecimal(installment.interestAmount));
}

export function getInstallmentPendingAmount(
  installment: InstallmentAllocationTarget,
): Decimal {
  const pending = getInstallmentTotalDue(installment).minus(toDecimal(installment.paidAmount));
  return Decimal.max(pending, 0);
}

export function allocatePaymentToInstallments(
  paymentAmount: MoneyInput,
  installments: InstallmentAllocationTarget[],
): InstallmentAllocationResult {
  let remaining = toDecimal(paymentAmount);
  const allocations: InstallmentAllocationResult["allocations"] = [];

  for (const installment of sortInstallmentsForAllocation(installments)) {
    if (remaining.isZero()) {
      break;
    }

    const pending = getInstallmentPendingAmount(installment);
    if (pending.isZero()) {
      continue;
    }

    const appliedAmount = Decimal.min(remaining, pending);
    if (appliedAmount.isZero()) {
      continue;
    }

    allocations.push({
      installmentId: installment.id,
      appliedAmount: roundMoney(appliedAmount),
    });
    remaining = remaining.minus(appliedAmount);
  }

  return {
    allocations,
    unallocatedAmount: roundMoney(remaining),
  };
}

export function reversePaymentAllocation(
  paymentAmount: MoneyInput,
  installments: InstallmentAllocationTarget[],
): Array<{ installmentId: string; reversedAmount: Decimal }> {
  let remaining = toDecimal(paymentAmount);
  const reversals: Array<{ installmentId: string; reversedAmount: Decimal }> = [];

  const sorted = sortInstallmentsForAllocation(installments).reverse();

  for (const installment of sorted) {
    if (remaining.isZero()) {
      break;
    }

    const paid = toDecimal(installment.paidAmount);
    if (paid.isZero()) {
      continue;
    }

    const reversedAmount = Decimal.min(remaining, paid);
    reversals.push({
      installmentId: installment.id,
      reversedAmount: roundMoney(reversedAmount),
    });
    remaining = remaining.minus(reversedAmount);
  }

  return reversals;
}

export function applyAllocationDeltas(
  installments: InstallmentAllocationTarget[],
  deltas: Array<{ installmentId: string; delta: MoneyInput }>,
): Map<string, Decimal> {
  const nextPaid = new Map<string, Decimal>();

  for (const installment of installments) {
    nextPaid.set(installment.id, toDecimal(installment.paidAmount));
  }

  for (const { installmentId, delta } of deltas) {
    const current = nextPaid.get(installmentId) ?? new Decimal(0);
    nextPaid.set(installmentId, roundMoney(current.plus(toDecimal(delta))));
  }

  return nextPaid;
}

export function reverseStoredPaymentAllocations(
  allocations: Array<{ installmentId: string; amount: MoneyInput }>,
): Array<{ installmentId: string; reversedAmount: Decimal }> {
  return allocations.map((allocation) => ({
    installmentId: allocation.installmentId,
    reversedAmount: roundMoney(allocation.amount),
  }));
}
