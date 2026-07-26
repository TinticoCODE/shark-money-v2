import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionType } from "@/domain/transaction-classification";

type TransactionClient = Prisma.TransactionClient;

export function toPrismaDecimal(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(4);
}

export async function applyTransactionBalances(
  tx: TransactionClient,
  input: {
    type: TransactionType;
    amount: Decimal | string | number;
    accountId: string;
    fromAccountId?: string | null;
    toAccountId?: string | null;
  },
  direction: 1 | -1,
): Promise<void> {
  const amount = new Decimal(input.amount).abs();

  if (input.type === "TRANSFER") {
    if (!input.fromAccountId || !input.toAccountId) {
      throw new Error("La transferencia requiere cuenta origen y destino");
    }

    const fromDelta = amount.times(direction).negated();
    const toDelta = amount.times(direction);

    await adjustAccountBalance(tx, input.fromAccountId, fromDelta);
    await adjustAccountBalance(tx, input.toAccountId, toDelta);
    return;
  }

  const delta =
    input.type === "INCOME"
      ? amount.times(direction)
      : amount.times(direction).negated();

  await adjustAccountBalance(tx, input.accountId, delta);
}

async function adjustAccountBalance(
  tx: TransactionClient,
  accountId: string,
  delta: Decimal,
): Promise<void> {
  const account = await tx.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { balance: true },
  });

  const nextBalance = new Decimal(account.balance.toString()).plus(delta);

  if (nextBalance.isNegative()) {
    throw new Error("El balance de la cuenta no puede quedar negativo");
  }

  await tx.account.update({
    where: { id: accountId },
    data: { balance: toPrismaDecimal(nextBalance) },
  });
}

export async function accountHasMovements(
  tx: TransactionClient,
  accountId: string,
): Promise<boolean> {
  const movement = await tx.transaction.findFirst({
    where: {
      OR: [
        { accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId },
      ],
    },
    select: { id: true },
  });

  if (movement) {
    return true;
  }

  const loan = await tx.loan.findFirst({
    where: { sourceAccountId: accountId },
    select: { id: true },
  });

  if (loan) {
    return true;
  }

  const loanPayment = await tx.loanPayment.findFirst({
    where: { accountId },
    select: { id: true },
  });

  if (loanPayment) {
    return true;
  }

  const contribution = await tx.goalContribution.findFirst({
    where: { accountId },
    select: { id: true },
  });

  return Boolean(contribution);
}
