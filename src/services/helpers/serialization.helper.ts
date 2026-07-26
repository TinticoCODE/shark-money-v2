import type { TransactionForClassification } from "@/domain/transaction-classification";

export const transactionClassificationInclude = {
  loanPayment: { select: { id: true } },
  goalContribution: { select: { id: true } },
  creditCardPayment: { select: { id: true } },
  creditCardPurchase: { select: { id: true } },
} as const;

export function mapTransactionForClassification(transaction: {
  type: TransactionForClassification["type"];
  loanId: string | null;
  loanPayment: { id: string } | null;
  goalContribution: { id: string } | null;
  creditCardPayment: { id: string } | null;
  creditCardPurchase: { id: string } | null;
}): TransactionForClassification {
  return {
    type: transaction.type,
    loanId: transaction.loanId,
    loanPayment: transaction.loanPayment,
    goalContribution: transaction.goalContribution,
    creditCardPayment: transaction.creditCardPayment,
    creditCardPurchase: transaction.creditCardPurchase,
  };
}

export function serializeDecimal(value: { toString(): string } | string | number): string {
  return value.toString();
}

export function serializeDate(value: Date): string {
  return value.toISOString();
}
