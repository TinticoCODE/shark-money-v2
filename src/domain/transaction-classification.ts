export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export interface TransactionForClassification {
  type: TransactionType;
  loanId: string | null;
  loanPayment: { id: string } | null;
  goalContribution: { id: string } | null;
}

/**
 * Movimientos que NO deben contarse como ingreso o gasto real del mes.
 *
 * Excluidos:
 * - TRANSFER: movimiento interno entre cuentas propias.
 * - Transacciones con loanId: desembolso de préstamo (sale de una cuenta pero no es gasto real).
 * - Transacciones vinculadas a LoanPayment: abono recibido (entra a cuenta pero no es ingreso real).
 * - Transacciones vinculadas a GoalContribution: aporte a meta (sale de cuenta pero no es gasto real).
 */
export function isExcludedFromRealCashflow(
  transaction: TransactionForClassification,
): boolean {
  if (transaction.type === "TRANSFER") {
    return true;
  }

  if (transaction.loanId !== null) {
    return true;
  }

  if (transaction.loanPayment !== null) {
    return true;
  }

  if (transaction.goalContribution !== null) {
    return true;
  }

  return false;
}

export function isRealIncome(transaction: TransactionForClassification): boolean {
  return transaction.type === "INCOME" && !isExcludedFromRealCashflow(transaction);
}

export function isRealExpense(transaction: TransactionForClassification): boolean {
  return transaction.type === "EXPENSE" && !isExcludedFromRealCashflow(transaction);
}

export function isFixedExpense(
  transaction: TransactionForClassification & { isRecurring: boolean },
): boolean {
  return isRealExpense(transaction) && transaction.isRecurring;
}
