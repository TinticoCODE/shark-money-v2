import Decimal from "decimal.js";
import {
  isFixedExpense,
  isRealIncome,
  type TransactionForClassification,
} from "@/domain/transaction-classification";
import { sumMoney, toDecimal, type MoneyInput } from "@/domain/money";

export interface AvailableSavingsInput {
  transactions: Array<
    TransactionForClassification & {
      amount: MoneyInput;
      isRecurring: boolean;
    }
  >;
  budgets: Array<{
    budgetedAmount: MoneyInput;
    spentAmount: MoneyInput;
  }>;
}

export interface AvailableSavingsResult {
  totalIncome: Decimal;
  totalFixedExpenses: Decimal;
  totalRemainingBudget: Decimal;
  availableSavings: Decimal;
}

/**
 * Capacidad de ahorro disponible del mes.
 *
 * Gasto fijo (MVP): transacciones EXPENSE reales con isRecurring = true.
 *
 * Excluidos de ingresos/gastos reales (igual que savings-rate.ts):
 * - TRANSFER
 * - Desembolsos de préstamo (loanId)
 * - Abonos de préstamo (loanPayment)
 * - Aportes a metas (goalContribution)
 *
 * availableSavings = ingresos reales - gastos fijos ya registrados - presupuesto restante
 * presupuesto restante = Σ max(0, presupuestado - gastado) por categoría
 */
export function calculateAvailableSavings(
  input: AvailableSavingsInput,
): AvailableSavingsResult {
  const incomeAmounts = input.transactions
    .filter(isRealIncome)
    .map((transaction) => transaction.amount);

  const fixedExpenseAmounts = input.transactions
    .filter(isFixedExpense)
    .map((transaction) => transaction.amount);

  const totalIncome = sumMoney(incomeAmounts);
  const totalFixedExpenses = sumMoney(fixedExpenseAmounts);

  const totalRemainingBudget = input.budgets.reduce((acc, budget) => {
    const remaining = toDecimal(budget.budgetedAmount).minus(
      toDecimal(budget.spentAmount),
    );
    return acc.plus(Decimal.max(remaining, new Decimal(0)));
  }, new Decimal(0));

  const availableSavings = totalIncome
    .minus(totalFixedExpenses)
    .minus(totalRemainingBudget);

  return {
    totalIncome,
    totalFixedExpenses,
    totalRemainingBudget,
    availableSavings,
  };
}
