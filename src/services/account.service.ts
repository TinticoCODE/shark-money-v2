import type { AccountType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  accountHasMovements,
  toPrismaDecimal,
} from "@/services/helpers/balance.helper";
import { serializeDate, serializeDecimal } from "@/services/helpers/serialization.helper";

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  initialBalance?: string;
}

export interface UpdateAccountInput {
  id: string;
  name?: string;
  type?: AccountType;
  isActive?: boolean;
}

function serializeAccount(account: {
  id: string;
  name: string;
  type: AccountType;
  balance: { toString(): string };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: serializeDecimal(account.balance),
    isActive: account.isActive,
    createdAt: serializeDate(account.createdAt),
    updatedAt: serializeDate(account.updatedAt),
  };
}

export async function listAccounts(includeInactive = false) {
  const accounts = await prisma.account.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });

  return accounts.map(serializeAccount);
}

export async function getAccountById(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });

  if (!account) {
    throw new Error("Cuenta no encontrada");
  }

  return serializeAccount(account);
}

export async function getAccountMovements(accountId: string) {
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ accountId }, { fromAccountId: accountId }, { toAccountId: accountId }],
    },
    include: {
      category: true,
      loanPayment: { select: { id: true } },
      goalContribution: { select: { id: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return transactions.map((transaction) => ({
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
  }));
}

export async function createAccount(input: CreateAccountInput) {
  const initialBalance = input.initialBalance ?? "0";

  const account = await prisma.account.create({
    data: {
      name: input.name,
      type: input.type,
      balance: toPrismaDecimal(initialBalance),
    },
  });

  return serializeAccount(account);
}

export async function updateAccount(input: UpdateAccountInput) {
  const account = await prisma.account.update({
    where: { id: input.id },
    data: {
      name: input.name,
      type: input.type,
      isActive: input.isActive,
    },
  });

  return serializeAccount(account);
}

export async function deleteAccount(id: string) {
  await prisma.$transaction(async (tx) => {
    const hasMovements = await accountHasMovements(tx, id);

    if (hasMovements) {
      throw new Error(
        "No se puede eliminar una cuenta con movimientos. Desactívala en su lugar.",
      );
    }

    await tx.account.delete({ where: { id } });
  });

  return { id };
}

export async function deactivateAccount(id: string) {
  return updateAccount({ id, isActive: false });
}

export async function reactivateAccount(id: string) {
  return updateAccount({ id, isActive: true });
}
