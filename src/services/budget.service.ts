import Decimal from "decimal.js";
import { isRealExpense } from "@/domain/transaction-classification";
import { toDecimal } from "@/domain/money";
import { mapTransactionForClassification } from "@/services/helpers/serialization.helper";
import { prisma } from "@/lib/prisma";
import { toPrismaDecimal } from "@/services/helpers/balance.helper";
import { serializeDate, serializeDecimal } from "@/services/helpers/serialization.helper";

export interface UpsertBudgetInput {
  categoryId: string;
  year: number;
  month: number;
  amount: string;
  isRecurringTemplate?: boolean;
}

function serializeBudget(budget: {
  id: string;
  categoryId: string;
  year: number;
  month: number;
  amount: { toString(): string };
  isRecurringTemplate: boolean;
  category?: { name: string };
}) {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    categoryName: budget.category?.name ?? null,
    year: budget.year,
    month: budget.month,
    amount: serializeDecimal(budget.amount),
    isRecurringTemplate: budget.isRecurringTemplate,
  };
}

export async function listBudgets(year: number, month: number) {
  const budgets = await prisma.budget.findMany({
    where: { year, month },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });

  return budgets.map(serializeBudget);
}

export async function upsertBudget(input: UpsertBudgetInput) {
  const category = await prisma.category.findUniqueOrThrow({
    where: { id: input.categoryId },
  });

  if (category.type !== "EXPENSE") {
    throw new Error("Solo las categorías de gasto pueden tener presupuesto");
  }

  const budget = await prisma.budget.upsert({
    where: {
      categoryId_year_month: {
        categoryId: input.categoryId,
        year: input.year,
        month: input.month,
      },
    },
    update: {
      amount: toPrismaDecimal(input.amount),
      isRecurringTemplate: input.isRecurringTemplate ?? false,
    },
    create: {
      categoryId: input.categoryId,
      year: input.year,
      month: input.month,
      amount: toPrismaDecimal(input.amount),
      isRecurringTemplate: input.isRecurringTemplate ?? false,
    },
    include: { category: true },
  });

  return serializeBudget(budget);
}

export async function deleteBudget(id: string) {
  await prisma.budget.delete({ where: { id } });
  return { id };
}

export async function getBudgetProgress(year: number, month: number, from: Date, to: Date) {
  const budgets = await prisma.budget.findMany({
    where: { year, month },
    include: { category: true },
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: from, lte: to },
      categoryId: { in: budgets.map((budget) => budget.categoryId) },
    },
    include: {
      loanPayment: { select: { id: true } },
      goalContribution: { select: { id: true } },
      creditCardPayment: { select: { id: true } },
      creditCardPurchase: { select: { id: true } },
    },
  });

  return budgets.map((budget) => {
    const spent = transactions
      .filter(
        (transaction) =>
          transaction.categoryId === budget.categoryId &&
          isRealExpense(
            mapTransactionForClassification({
              type: transaction.type,
              loanId: transaction.loanId,
              loanPayment: transaction.loanPayment,
              goalContribution: transaction.goalContribution,
              creditCardPayment: transaction.creditCardPayment,
              creditCardPurchase: transaction.creditCardPurchase,
            }),
          ),
      )
      .reduce(
        (acc, transaction) => acc.plus(toDecimal(transaction.amount.toString())),
        new Decimal(0),
      );

    const budgeted = toDecimal(budget.amount.toString());
    const usedPercent = budgeted.isZero()
      ? new Decimal(0)
      : spent.dividedBy(budgeted).times(100);

    return {
      ...serializeBudget(budget),
      spentAmount: spent.toFixed(4),
      remainingAmount: Decimal.max(budgeted.minus(spent), 0).toFixed(4),
      usedPercent: usedPercent.toFixed(2),
      alertLevel:
        usedPercent.gte(100) ? "OVER" : usedPercent.gte(80) ? "WARNING" : "OK",
    };
  });
}

export async function getBudgetHistory(categoryId: string, months: number) {
  const budgets = await prisma.budget.findMany({
    where: { categoryId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: months,
    include: { category: true },
  });

  return budgets.map(serializeBudget);
}

export async function ensureRecurringBudgetTemplates(year: number, month: number) {
  const previousMonthDate = new Date(year, month - 2, 1);
  const templates = await prisma.budget.findMany({
    where: {
      year: previousMonthDate.getFullYear(),
      month: previousMonthDate.getMonth() + 1,
      isRecurringTemplate: true,
    },
  });

  for (const template of templates) {
    await upsertBudget({
      categoryId: template.categoryId,
      year,
      month,
      amount: template.amount.toString(),
      isRecurringTemplate: true,
    });
  }

  return { createdFromTemplates: templates.length };
}

export async function getTotalBudgetAndSpent(from: Date, to: Date, year: number, month: number) {
  const progress = await getBudgetProgress(year, month, from, to);

  const totalBudgeted = progress.reduce(
    (acc, item) => acc.plus(toDecimal(item.amount)),
    new Decimal(0),
  );
  const totalSpent = progress.reduce(
    (acc, item) => acc.plus(toDecimal(item.spentAmount)),
    new Decimal(0),
  );

  return {
    totalBudgeted: totalBudgeted.toFixed(4),
    totalSpent: totalSpent.toFixed(4),
    categories: progress,
  };
}
