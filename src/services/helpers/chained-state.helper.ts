import type { Prisma } from "@/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

const LOAN_PAYMENT_ORDER = [{ paidAt: "desc" as const }, { createdAt: "desc" as const }];
const GOAL_CONTRIBUTION_ORDER = [
  { contributedAt: "desc" as const },
  { createdAt: "desc" as const },
];
const CREDIT_CARD_PAYMENT_ORDER = [
  { paidAt: "desc" as const },
  { createdAt: "desc" as const },
];
const CREDIT_CARD_PURCHASE_ORDER = [
  { purchaseDate: "desc" as const },
  { createdAt: "desc" as const },
];

export async function assertMostRecentLoanPayment(
  tx: TransactionClient,
  paymentId: string,
  loanId: string,
): Promise<void> {
  const latestPayment = await tx.loanPayment.findFirst({
    where: { loanId },
    orderBy: LOAN_PAYMENT_ORDER,
    select: { id: true },
  });

  if (!latestPayment || latestPayment.id !== paymentId) {
    throw new Error(
      "Solo puedes modificar o eliminar el abono más reciente del préstamo. " +
        "Los abonos anteriores no se pueden editar ni borrar porque alterarían el capital pendiente y el interés devengado.",
    );
  }
}

export async function getPreviousLoanInterestAccruedAt(
  tx: TransactionClient,
  loanId: string,
  excludePaymentId: string,
): Promise<Date> {
  const loan = await tx.loan.findUniqueOrThrow({
    where: { id: loanId },
    select: { lentAt: true },
  });

  const previousPayment = await tx.loanPayment.findFirst({
    where: {
      loanId,
      id: { not: excludePaymentId },
    },
    orderBy: LOAN_PAYMENT_ORDER,
    select: { paidAt: true },
  });

  return previousPayment?.paidAt ?? loan.lentAt;
}

export async function assertMostRecentCreditCardPayment(
  tx: TransactionClient,
  paymentId: string,
  creditCardId: string,
): Promise<void> {
  const latestPayment = await tx.creditCardPayment.findFirst({
    where: { creditCardId },
    orderBy: CREDIT_CARD_PAYMENT_ORDER,
    select: { id: true },
  });

  if (!latestPayment || latestPayment.id !== paymentId) {
    throw new Error(
      "Solo puedes modificar o eliminar el pago más reciente de la tarjeta. " +
        "Los pagos anteriores no se pueden editar ni borrar porque alterarían la asignación FIFO de cuotas y el saldo usado.",
    );
  }
}

export async function assertMostRecentCreditCardPurchase(
  tx: TransactionClient,
  purchaseId: string,
  creditCardId: string,
): Promise<void> {
  const latestPurchase = await tx.creditCardPurchase.findFirst({
    where: { creditCardId },
    orderBy: CREDIT_CARD_PURCHASE_ORDER,
    select: { id: true },
  });

  if (!latestPurchase || latestPurchase.id !== purchaseId) {
    throw new Error(
      "Solo puedes modificar o eliminar la compra más reciente de la tarjeta. " +
        "Las compras anteriores no se pueden editar ni borrar porque alterarían las cuotas y el saldo usado.",
    );
  }
}

export async function assertMostRecentGoalContribution(
  tx: TransactionClient,
  contributionId: string,
  goalId: string,
): Promise<void> {
  const latestContribution = await tx.goalContribution.findFirst({
    where: { goalId },
    orderBy: GOAL_CONTRIBUTION_ORDER,
    select: { id: true },
  });

  if (!latestContribution || latestContribution.id !== contributionId) {
    throw new Error(
      "Solo puedes modificar o eliminar el aporte más reciente de la meta. " +
        "Los aportes anteriores no se pueden editar ni borrar porque alterarían el monto acumulado de la meta.",
    );
  }
}
