import Decimal from "decimal.js";
import {
  getInstallmentPendingAmount,
  getInstallmentTotalDue,
  type InstallmentAllocationTarget,
} from "@/domain/credit-card-payment-allocation";
import { toDecimal, type MoneyInput } from "@/domain/money";

export type CreditCardDebtStatus =
  | "SIN_DEUDA"
  | "DEUDA_SIN_INTERES"
  | "DEUDA_CON_INTERES";

export interface CreditCardDebtInput {
  usedBalance: MoneyInput;
  installments: InstallmentAllocationTarget[];
}

export function deriveCreditCardDebtStatus(
  input: CreditCardDebtInput,
): CreditCardDebtStatus {
  const usedBalance = toDecimal(input.usedBalance);

  if (usedBalance.isZero()) {
    return "SIN_DEUDA";
  }

  const hasPendingInterest = input.installments.some((installment) => {
    if (getInstallmentPendingAmount(installment).isZero()) {
      return false;
    }

    return toDecimal(installment.interestAmount).gt(0);
  });

  if (hasPendingInterest) {
    return "DEUDA_CON_INTERES";
  }

  return "DEUDA_SIN_INTERES";
}

export function sumPendingInstallmentPrincipal(
  installments: InstallmentAllocationTarget[],
): Decimal {
  return installments.reduce((total, installment) => {
    const pending = getInstallmentPendingAmount(installment);
    if (pending.isZero()) {
      return total;
    }

    const totalDue = getInstallmentTotalDue(installment);
    const principal = toDecimal(installment.principalAmount);
    const paid = toDecimal(installment.paidAmount);

    if (paid.gte(totalDue)) {
      return total;
    }

    const unpaidPrincipal = Decimal.max(
      principal.minus(Decimal.max(paid.minus(totalDue.minus(principal)), 0)),
      0,
    );

    return total.plus(unpaidPrincipal);
  }, new Decimal(0));
}
