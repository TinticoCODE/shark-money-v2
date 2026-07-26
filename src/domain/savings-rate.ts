import Decimal from "decimal.js";
import {
  isRealExpense,
  isRealIncome,
  type TransactionForClassification,
} from "@/domain/transaction-classification";
import { sumMoney, toDecimal, type MoneyInput } from "@/domain/money";

export interface SavingsRateInput {
  transactions: Array<
    TransactionForClassification & {
      amount: MoneyInput;
    }
  >;
}

export interface SavingsRateResult {
  totalIncome: Decimal;
  totalExpenses: Decimal;
  netSavings: Decimal;
  savingsRatePercent: Decimal;
}

/**
 * Tasa de ahorro mensual.
 *
 * Solo ingresos y gastos REALES entran al cálculo. Quedan fuera:
 * - TRANSFER
 * - Desembolsos de préstamo (loanId)
 * - Abonos de préstamo recibidos (loanPayment)
 * - Aportes a metas (goalContribution)
 *
 * savingsRate = ((ingresos reales - gastos reales) / ingresos reales) × 100
 */
export function calculateSavingsRate(input: SavingsRateInput): SavingsRateResult {
  const incomeAmounts = input.transactions
    .filter(isRealIncome)
    .map((transaction) => transaction.amount);

  const expenseAmounts = input.transactions
    .filter(isRealExpense)
    .map((transaction) => transaction.amount);

  const totalIncome = sumMoney(incomeAmounts);
  const totalExpenses = sumMoney(expenseAmounts);
  const netSavings = totalIncome.minus(totalExpenses);

  const savingsRatePercent = totalIncome.isZero()
    ? new Decimal(0)
    : netSavings.dividedBy(totalIncome).times(100);

  return {
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRatePercent: toDecimal(savingsRatePercent.toFixed(4)),
  };
}
