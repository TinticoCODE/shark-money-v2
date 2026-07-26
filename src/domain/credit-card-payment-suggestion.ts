import Decimal from "decimal.js";
import {
  compareBillingCycles,
  type BillingCycleRef,
} from "@/domain/credit-card-cycle";
import {
  getInstallmentPendingAmount,
  getInstallmentTotalDue,
  type InstallmentAllocationTarget,
} from "@/domain/credit-card-payment-allocation";
import { roundMoney, toDecimal } from "@/domain/money";

export interface PurchaseForSuggestion {
  installmentsCount: number;
  isInterestFree: boolean;
  installments: InstallmentAllocationTarget[];
}

export interface PaymentSuggestionInput {
  currentBillingCycle: BillingCycleRef;
  purchases: PurchaseForSuggestion[];
}

/**
 * Monto sugerido a pagar en el corte actual para no generar intereses adicionales:
 * - Compras a 1 cuota del ciclo actual: pendiente total de esa cuota.
 * - Cuotas de compras anteriores que caen en el ciclo actual:
 *   · MSI / sin interés: solo capital pendiente.
 *   · Con interés: capital + interés pendientes de esa cuota.
 */
export function calculateInterestAvoidancePaymentAmount(
  input: PaymentSuggestionInput,
): Decimal {
  let total = new Decimal(0);

  for (const purchase of input.purchases) {
    for (const installment of purchase.installments) {
      if (
        compareBillingCycles(
          { year: installment.billingCycleYear, month: installment.billingCycleMonth },
          input.currentBillingCycle,
        ) !== 0
      ) {
        continue;
      }

      const pending = getInstallmentPendingAmount(installment);
      if (pending.isZero()) {
        continue;
      }

      if (purchase.installmentsCount === 1) {
        total = total.plus(pending);
        continue;
      }

      if (purchase.isInterestFree) {
        const totalDue = getInstallmentTotalDue(installment);
        const principal = toDecimal(installment.principalAmount);
        const paid = toDecimal(installment.paidAmount);
        const unpaidPrincipal = Decimal.max(
          principal.minus(Decimal.max(paid.minus(totalDue.minus(principal)), 0)),
          0,
        );
        total = total.plus(unpaidPrincipal);
        continue;
      }

      total = total.plus(pending);
    }
  }

  return roundMoney(total);
}

export function sumFutureInstallmentCommitments(
  installments: InstallmentAllocationTarget[],
  fromCycle: BillingCycleRef,
): Decimal {
  return installments.reduce((total, installment) => {
    if (
      compareBillingCycles(
        { year: installment.billingCycleYear, month: installment.billingCycleMonth },
        fromCycle,
      ) < 0
    ) {
      return total;
    }

    return total.plus(getInstallmentPendingAmount(installment));
  }, new Decimal(0));
}
