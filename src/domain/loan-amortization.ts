import Decimal from "decimal.js";
import { calendarDaysBetween } from "@/domain/date-time";
import { toDecimal, type MoneyInput } from "@/domain/money";

/** Base fija de 30 días para prorratear una tasa mensual en el MVP. */
export const PRORATION_DAYS_IN_MONTH = 30;

export interface LoanInterestInput {
  outstandingPrincipal: MoneyInput;
  monthlyInterestRate: MoneyInput | null;
  lastInterestAccruedAt: Date;
  paymentDate: Date;
  timezone: string;
}

export interface LoanPaymentBreakdown {
  interestAmount: Decimal;
  principalAmount: Decimal;
  totalAmount: Decimal;
}

/**
 * Convención de interés — préstamos entre personas (SHARK MONEY)
 *
 * - interestRate en Loan: tasa MENSUAL en decimal (ej. 0.02 = 2% mensual).
 * - Base: outstandingPrincipal al momento del abono.
 * - Periodo de devengo: desde lastInterestAccruedAt (lentAt en el primer abono)
 *   hasta la fecha del abono (paymentDate).
 * - Interés devengado = outstandingPrincipal × monthlyRate × (díasTranscurridos / 30)
 * - Simplificación deliberada del MVP: usamos 30 días fijos como mes comercial,
 *   no los días reales del calendario. Así el cálculo sigue siendo estable cuando
 *   un abono tarda más de un mes en llegar (evita divisor variable por mes).
 * - En cada abono, primero se cubre el interés devengado y el resto reduce capital.
 * - Si monthlyRate es null o 0, todo el abono va a capital.
 * - El interés no pagado NO se capitaliza en el MVP.
 */
export function calculateAccruedInterest(input: LoanInterestInput): Decimal {
  const rate = input.monthlyInterestRate
    ? toDecimal(input.monthlyInterestRate)
    : new Decimal(0);

  if (rate.isZero()) {
    return new Decimal(0);
  }

  const elapsedDays = calendarDaysBetween(
    input.lastInterestAccruedAt,
    input.paymentDate,
  );

  if (elapsedDays === 0) {
    return new Decimal(0);
  }

  const principal = toDecimal(input.outstandingPrincipal);

  return principal
    .times(rate)
    .times(elapsedDays)
    .dividedBy(PRORATION_DAYS_IN_MONTH)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function splitLoanPayment(
  paymentAmount: MoneyInput,
  input: LoanInterestInput,
): LoanPaymentBreakdown {
  const total = toDecimal(paymentAmount);
  const interestAmount = Decimal.min(
    calculateAccruedInterest(input),
    total,
  );
  const principalAmount = Decimal.max(
    total.minus(interestAmount),
    new Decimal(0),
  );

  return {
    interestAmount,
    principalAmount,
    totalAmount: total,
  };
}
