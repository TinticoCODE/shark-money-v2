import Decimal from "decimal.js";
import {
  addBillingCycles,
  getBillingCycleForDate,
  type BillingCycleRef,
} from "@/domain/credit-card-cycle";
import { roundMoney, toDecimal, type MoneyInput } from "@/domain/money";

export interface GeneratedInstallment {
  installmentNumber: number;
  principalAmount: Decimal;
  interestAmount: Decimal;
  billingCycleYear: number;
  billingCycleMonth: number;
}

export interface GenerateInstallmentsInput {
  purchaseAmount: MoneyInput;
  purchaseDate: Date;
  installmentsCount: number;
  allowedInterestFreeMonths: number[];
  interestRateMonthly: MoneyInput | null;
  cutoffDay: number;
  timezone: string;
}

/**
 * Interés y cuotas — tarjetas de crédito (SHARK MONEY)
 *
 * interestRateMonthly: tasa MENSUAL en decimal (ej. 0.023 = 2.3% mensual).
 *
 * Reglas:
 * 1) installmentsCount === 1 → sin interés (periodo de gracia de contado).
 * 2) installmentsCount ∈ allowedInterestFreeMonths → MSI: capital en cuotas
 *    iguares, interestAmount = 0 en todas.
 * 3) Cualquier otro caso → amortización francesa con interestRateMonthly:
 *    PMT = P × r × (1+r)^n / ((1+r)^n − 1)  si r > 0
 *    PMT = P / n                              si r = 0
 *    En cada cuota: interés = saldo × r; capital = PMT − interés.
 *    La última cuota ajusta redondeo para que la suma de capitales = P.
 *
 * Cada cuota se ubica en un ciclo de facturación consecutivo a partir del
 * ciclo de la compra (credit-card-cycle.ts).
 */
export function isInterestFreeInstallmentPlan(
  installmentsCount: number,
  allowedInterestFreeMonths: number[],
): boolean {
  if (installmentsCount === 1) {
    return true;
  }

  return allowedInterestFreeMonths.includes(installmentsCount);
}

export function generateCreditCardInstallments(
  input: GenerateInstallmentsInput,
): GeneratedInstallment[] {
  const count = input.installmentsCount;
  const principal = toDecimal(input.purchaseAmount);

  if (count < 1) {
    throw new Error("El número de cuotas debe ser al menos 1");
  }

  const startCycle = getBillingCycleForDate(
    input.purchaseDate,
    input.cutoffDay,
    input.timezone,
  );

  if (isInterestFreeInstallmentPlan(count, input.allowedInterestFreeMonths)) {
    const equalShare = roundMoney(principal.dividedBy(count));
    let allocated = new Decimal(0);

    return Array.from({ length: count }, (_, index) => {
      const installmentNumber = index + 1;
      const isLast = installmentNumber === count;
      const principalAmount = isLast
        ? roundMoney(principal.minus(allocated))
        : equalShare;
      allocated = allocated.plus(principalAmount);
      const cycle = addBillingCycles(startCycle, index);

      return {
        installmentNumber,
        principalAmount,
        interestAmount: new Decimal(0),
        billingCycleYear: cycle.year,
        billingCycleMonth: cycle.month,
      };
    });
  }

  const monthlyRate = input.interestRateMonthly
    ? toDecimal(input.interestRateMonthly)
    : new Decimal(0);

  if (monthlyRate.isZero()) {
    return generateEqualPrincipalInstallments(principal, count, startCycle);
  }

  return generateFrenchInstallments(principal, count, monthlyRate, startCycle);
}

function generateEqualPrincipalInstallments(
  principal: Decimal,
  count: number,
  startCycle: BillingCycleRef,
): GeneratedInstallment[] {
  const equalShare = roundMoney(principal.dividedBy(count));
  let allocated = new Decimal(0);

  return Array.from({ length: count }, (_, index) => {
    const installmentNumber = index + 1;
    const isLast = installmentNumber === count;
    const principalAmount = isLast
      ? roundMoney(principal.minus(allocated))
      : equalShare;
    allocated = allocated.plus(principalAmount);
    const cycle = addBillingCycles(startCycle, index);

    return {
      installmentNumber,
      principalAmount,
      interestAmount: new Decimal(0),
      billingCycleYear: cycle.year,
      billingCycleMonth: cycle.month,
    };
  });
}

function generateFrenchInstallments(
  principal: Decimal,
  count: number,
  monthlyRate: Decimal,
  startCycle: BillingCycleRef,
): GeneratedInstallment[] {
  const onePlusRate = monthlyRate.plus(1);
  const factor = onePlusRate.pow(count);
  const payment = roundMoney(principal.times(monthlyRate).times(factor).dividedBy(factor.minus(1)));

  let remaining = principal;
  const installments: GeneratedInstallment[] = [];

  for (let index = 0; index < count; index += 1) {
    const installmentNumber = index + 1;
    const isLast = installmentNumber === count;
    const interestAmount = roundMoney(remaining.times(monthlyRate));
    let principalAmount = isLast
      ? roundMoney(remaining)
      : roundMoney(payment.minus(interestAmount));

    if (principalAmount.isNegative()) {
      principalAmount = new Decimal(0);
    }

    remaining = remaining.minus(principalAmount);
    const cycle = addBillingCycles(startCycle, index);

    installments.push({
      installmentNumber,
      principalAmount,
      interestAmount,
      billingCycleYear: cycle.year,
      billingCycleMonth: cycle.month,
    });
  }

  return installments;
}
