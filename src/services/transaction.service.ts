import type { TransactionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyTransactionBalances,
  toPrismaDecimal,
} from "@/services/helpers/balance.helper";
import {
  serializeDate,
  serializeDecimal,
  transactionClassificationInclude,
} from "@/services/helpers/serialization.helper";

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  search?: string;
  from?: Date;
  to?: Date;
}

export interface CreateTransactionInput {
  type: Extract<TransactionType, "INCOME" | "EXPENSE">;
  amount: string;
  accountId: string;
  categoryId: string;
  date: Date;
  description?: string;
  isRecurring?: boolean;
}

export interface UpdateTransactionInput {
  id: string;
  type?: Extract<TransactionType, "INCOME" | "EXPENSE">;
  amount?: string;
  accountId?: string;
  categoryId?: string;
  date?: Date;
  description?: string;
  isRecurring?: boolean;
}

function serializeTransaction(transaction: {
  id: string;
  type: TransactionType;
  amount: { toString(): string };
  accountId: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  date: Date;
  description: string | null;
  isRecurring: boolean;
  loanId: string | null;
  category?: { name: string } | null;
}) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: serializeDecimal(transaction.amount),
    accountId: transaction.accountId,
    fromAccountId: transaction.fromAccountId,
    toAccountId: transaction.toAccountId,
    categoryId: transaction.categoryId,
    categoryName: transaction.category?.name ?? null,
    date: serializeDate(transaction.date),
    description: transaction.description,
    isRecurring: transaction.isRecurring,
    loanId: transaction.loanId,
  };
}

export async function listTransactions(filters: TransactionFilters = {}) {
  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      type: filters.type,
      date: {
        gte: filters.from,
        lte: filters.to,
      },
      description: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
      loanId: null,
      loanPayment: { is: null },
      goalContribution: { is: null },
    },
    include: {
      category: true,
      ...transactionClassificationInclude,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return transactions.map(serializeTransaction);
}

export async function createTransaction(input: CreateTransactionInput) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findUniqueOrThrow({
      where: { id: input.accountId },
    });

    if (!account.isActive) {
      throw new Error("La cuenta seleccionada está inactiva");
    }

    const category = await tx.category.findUniqueOrThrow({
      where: { id: input.categoryId },
    });

    if (category.type !== input.type) {
      throw new Error("La categoría no coincide con el tipo de transacción");
    }

    const transaction = await tx.transaction.create({
      data: {
        type: input.type,
        amount: toPrismaDecimal(input.amount),
        accountId: input.accountId,
        categoryId: input.categoryId,
        date: input.date,
        description: input.description?.trim() || null,
        isRecurring: input.isRecurring ?? false,
      },
      include: { category: true },
    });

    await applyTransactionBalances(
      tx,
      {
        type: transaction.type,
        amount: input.amount,
        accountId: transaction.accountId,
      },
      1,
    );

    return serializeTransaction(transaction);
  });
}

export async function updateTransaction(input: UpdateTransactionInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({
      where: { id: input.id },
      include: transactionClassificationInclude,
    });

    if (existing.type === "TRANSFER" || existing.loanId || existing.loanPayment || existing.goalContribution) {
      throw new Error("Esta transacción debe editarse desde su módulo correspondiente");
    }

    await applyTransactionBalances(
      tx,
      {
        type: existing.type,
        amount: existing.amount.toString(),
        accountId: existing.accountId,
      },
      -1,
    );

    const nextType = input.type ?? existing.type;
    const nextAmount = input.amount ?? existing.amount.toString();
    const nextAccountId = input.accountId ?? existing.accountId;
    const nextCategoryId = input.categoryId ?? existing.categoryId;

    if (nextType !== "INCOME" && nextType !== "EXPENSE") {
      throw new Error("Tipo de transacción inválido");
    }

    if (nextCategoryId) {
      const category = await tx.category.findUniqueOrThrow({
        where: { id: nextCategoryId },
      });

      if (category.type !== nextType) {
        throw new Error("La categoría no coincide con el tipo de transacción");
      }
    }

    const account = await tx.account.findUniqueOrThrow({
      where: { id: nextAccountId },
    });

    if (!account.isActive) {
      throw new Error("La cuenta seleccionada está inactiva");
    }

    const updated = await tx.transaction.update({
      where: { id: input.id },
      data: {
        type: nextType,
        amount: toPrismaDecimal(nextAmount),
        accountId: nextAccountId,
        categoryId: nextCategoryId,
        date: input.date ?? existing.date,
        description:
          input.description !== undefined
            ? input.description.trim() || null
            : existing.description,
        isRecurring: input.isRecurring ?? existing.isRecurring,
      },
      include: { category: true },
    });

    await applyTransactionBalances(
      tx,
      {
        type: updated.type,
        amount: nextAmount,
        accountId: updated.accountId,
      },
      1,
    );

    return serializeTransaction(updated);
  });
}

export async function deleteTransaction(id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({
      where: { id },
      include: transactionClassificationInclude,
    });

    if (existing.type === "TRANSFER" || existing.loanId || existing.loanPayment || existing.goalContribution) {
      throw new Error("Esta transacción debe eliminarse desde su módulo correspondiente");
    }

    await applyTransactionBalances(
      tx,
      {
        type: existing.type,
        amount: existing.amount.toString(),
        accountId: existing.accountId,
      },
      -1,
    );

    await tx.transaction.delete({ where: { id } });
  });

  return { id };
}

export async function getTransactionsForPeriod(from: Date, to: Date) {
  return prisma.transaction.findMany({
    where: {
      date: { gte: from, lte: to },
    },
    include: transactionClassificationInclude,
  });
}
