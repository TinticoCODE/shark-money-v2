import { prisma } from "@/lib/prisma";
import {
  applyTransactionBalances,
  toPrismaDecimal,
} from "@/services/helpers/balance.helper";
import { serializeDate, serializeDecimal } from "@/services/helpers/serialization.helper";

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  date: Date;
  description?: string;
}

export async function createTransfer(input: CreateTransferInput) {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Las cuentas de origen y destino deben ser diferentes");
  }

  return prisma.$transaction(async (tx) => {
    const [fromAccount, toAccount] = await Promise.all([
      tx.account.findUniqueOrThrow({ where: { id: input.fromAccountId } }),
      tx.account.findUniqueOrThrow({ where: { id: input.toAccountId } }),
    ]);

    if (!fromAccount.isActive || !toAccount.isActive) {
      throw new Error("Ambas cuentas deben estar activas");
    }

    const transaction = await tx.transaction.create({
      data: {
        type: "TRANSFER",
        amount: toPrismaDecimal(input.amount),
        accountId: input.fromAccountId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        date: input.date,
        description: input.description?.trim() || null,
      },
    });

    await applyTransactionBalances(
      tx,
      {
        type: "TRANSFER",
        amount: input.amount,
        accountId: transaction.accountId!,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
      },
      1,
    );

    return {
      id: transaction.id,
      type: transaction.type,
      amount: serializeDecimal(transaction.amount),
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
      date: serializeDate(transaction.date),
      description: transaction.description,
    };
  });
}

export async function deleteTransfer(id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({ where: { id } });

    if (existing.type !== "TRANSFER") {
      throw new Error("La transacción no es una transferencia");
    }

    await applyTransactionBalances(
      tx,
      {
        type: "TRANSFER",
        amount: existing.amount.toString(),
        accountId: existing.accountId!,
        fromAccountId: existing.fromAccountId,
        toAccountId: existing.toAccountId,
      },
      -1,
    );

    await tx.transaction.delete({ where: { id } });
  });

  return { id };
}
