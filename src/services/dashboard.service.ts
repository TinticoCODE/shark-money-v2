import Decimal from "decimal.js";
import type { TransactionType } from "@/generated/prisma/client";
import { detectSpendingAnomalies } from "@/domain/anomaly-detection";
import { calculateAvailableSavings } from "@/domain/available-savings";
import { calculateBudgetHealth } from "@/domain/budget-health";
import {
  dayOfMonthInTimezone,
  daysInMonthForTimezone,
  endOfMonthInTimezone,
  nowInTimezone,
  startOfMonthInTimezone,
  toTimezoneDate,
} from "@/domain/date-time";
import { calculateFinancialHealthScore } from "@/domain/financial-health-score";
import { isRealExpense, isRealIncome } from "@/domain/transaction-classification";
import { calculateSavingsRate } from "@/domain/savings-rate";
import { prisma } from "@/lib/prisma";
import { getTotalBudgetAndSpent } from "@/services/budget.service";
import { countBehindScheduleGoals } from "@/services/goal.service";
import { countOverdueLoans } from "@/services/loan.service";
import {
  mapTransactionForClassification,
  transactionClassificationInclude,
} from "@/services/helpers/serialization.helper";
import { getUserSettingsOrThrow } from "@/services/settings.service";

function getMonthKey(date: Date, timezone: string): string {
  const zoned = toTimezoneDate(date, timezone);
  return `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboardSummary() {
  const settings = await getUserSettingsOrThrow();
  const timezone = settings.timezone;
  const now = nowInTimezone(timezone);
  const monthStart = startOfMonthInTimezone(now, timezone);
  const monthEnd = endOfMonthInTimezone(now, timezone);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  const chartStart = startOfMonthInTimezone(twelveMonthsAgo, timezone);

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: chartStart, lte: monthEnd },
    },
    include: {
      category: true,
      ...transactionClassificationInclude,
    },
  });

  const monthTransactions = transactions.filter(
    (transaction) => transaction.date >= monthStart && transaction.date <= monthEnd,
  );

  const classifiedMonthTransactions = monthTransactions.map((transaction) => ({
    ...mapTransactionForClassification(transaction),
    amount: transaction.amount.toString(),
    isRecurring: transaction.isRecurring,
  }));

  const savings = calculateSavingsRate({
    transactions: classifiedMonthTransactions,
  });

  const budgetSummary = await getTotalBudgetAndSpent(
    monthStart,
    monthEnd,
    year,
    month,
  );

  const budgetHealth = calculateBudgetHealth({
    budgetedAmount: budgetSummary.totalBudgeted,
    spentAmount: budgetSummary.totalSpent,
    dayOfMonth: dayOfMonthInTimezone(now, timezone),
    daysInMonth: daysInMonthForTimezone(now, timezone),
  });

  const availableSavings = calculateAvailableSavings({
    transactions: classifiedMonthTransactions,
    budgets: budgetSummary.categories.map((category) => ({
      budgetedAmount: category.amount,
      spentAmount: category.spentAmount,
    })),
  });

  const categorySpending = new Map<string, { name: string; total: Decimal }>();
  for (const transaction of monthTransactions) {
    if (
      !isRealExpense(mapTransactionForClassification(transaction)) ||
      !transaction.category
    ) {
      continue;
    }

    const current = categorySpending.get(transaction.categoryId ?? "") ?? {
      name: transaction.category.name,
      total: new Decimal(0),
    };
    current.total = current.total.plus(transaction.amount.toString());
    categorySpending.set(transaction.categoryId ?? "", current);
  }

  const expenseByCategory = Array.from(categorySpending.entries()).map(
    ([categoryId, value]) => ({
      categoryId,
      categoryName: value.name,
      amount: value.total.toFixed(4),
    }),
  );

  const monthlySeriesMap = new Map<string, { income: Decimal; expenses: Decimal }>();

  for (const transaction of transactions) {
    const key = getMonthKey(transaction.date, timezone);
    const current = monthlySeriesMap.get(key) ?? {
      income: new Decimal(0),
      expenses: new Decimal(0),
    };
    const classified = mapTransactionForClassification(transaction);

    if (isRealIncome(classified)) {
      current.income = current.income.plus(transaction.amount.toString());
    }

    if (isRealExpense(classified)) {
      current.expenses = current.expenses.plus(transaction.amount.toString());
    }

    monthlySeriesMap.set(key, current);
  }

  const monthlySeries = Array.from(monthlySeriesMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, values]) => ({
      period,
      income: values.income.toFixed(4),
      expenses: values.expenses.toFixed(4),
      net: values.income.minus(values.expenses).toFixed(4),
    }));

  const categorySnapshots = await buildCategoryAnomalySnapshots(
    transactions,
    monthStart,
    monthEnd,
    timezone,
  );
  const anomalies = detectSpendingAnomalies({ categories: categorySnapshots });

  const overdueLoansCount = await countOverdueLoans(now);
  const behindScheduleGoalsCount = await countBehindScheduleGoals(now, timezone);

  const healthScore = calculateFinancialHealthScore({
    savingsRatePercent: savings.savingsRatePercent.toString(),
    budgetRiskLevel: budgetHealth.riskLevel,
    overdueLoansCount,
    behindScheduleGoalsCount,
    spendingAnomaliesCount: anomalies.length,
  });

  return {
    currency: settings.currency,
    timezone,
    month: { year, month },
    summary: {
      totalIncome: savings.totalIncome.toFixed(4),
      totalExpenses: savings.totalExpenses.toFixed(4),
      netBalance: savings.netSavings.toFixed(4),
      savingsRatePercent: savings.savingsRatePercent.toFixed(2),
      availableSavings: availableSavings.availableSavings.toFixed(4),
    },
    budgetHealth: {
      budgetUsedPercent: budgetHealth.budgetUsedPercent.toFixed(2),
      monthElapsedPercent: budgetHealth.monthElapsedPercent.toFixed(2),
      paceRatio: budgetHealth.paceRatio.toFixed(2),
      riskLevel: budgetHealth.riskLevel,
      isAheadOfPace: budgetHealth.isAheadOfPace,
    },
    healthScore,
    expenseByCategory,
    monthlySeries,
    alerts: {
      spendingAnomalies: anomalies.map((anomaly) => ({
        categoryId: anomaly.categoryId,
        categoryName: anomaly.categoryName,
        currentMonthSpent: anomaly.currentMonthSpent.toFixed(4),
        averagePreviousSpent: anomaly.averagePreviousSpent.toFixed(4),
        growthRatio: anomaly.growthRatio.toFixed(2),
      })),
      overdueLoansCount,
      behindScheduleGoalsCount,
    },
  };
}

async function buildCategoryAnomalySnapshots(
  transactions: Array<{
    date: Date;
    amount: { toString(): string };
    categoryId: string | null;
    type: TransactionType;
    loanId: string | null;
    loanPayment: { id: string } | null;
    goalContribution: { id: string } | null;
    creditCardPayment: { id: string } | null;
    creditCardPurchase: { id: string } | null;
    category: { id: string; name: string } | null;
  }>,
  monthStart: Date,
  monthEnd: Date,
  timezone: string,
) {
  const categories = await prisma.category.findMany({
    where: { type: "EXPENSE" },
  });

  return categories.map((category) => {
    const relevant = transactions.filter(
      (transaction) =>
        transaction.categoryId === category.id &&
        isRealExpense(mapTransactionForClassification(transaction)),
    );

    const currentMonthSpent = relevant
      .filter(
        (transaction) =>
          transaction.date >= monthStart && transaction.date <= monthEnd,
      )
      .reduce(
        (acc, transaction) => acc.plus(transaction.amount.toString()),
        new Decimal(0),
      );

    const previousByMonth = new Map<string, Decimal>();

    for (const transaction of relevant) {
      if (transaction.date >= monthStart) {
        continue;
      }

      const key = getMonthKey(transaction.date, timezone);
      const current = previousByMonth.get(key) ?? new Decimal(0);
      previousByMonth.set(
        key,
        current.plus(transaction.amount.toString()),
      );
    }

    const sortedPrevious = Array.from(previousByMonth.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 3)
      .map(([, amount]) => amount.toFixed(4));

    return {
      categoryId: category.id,
      categoryName: category.name,
      currentMonthSpent: currentMonthSpent.toFixed(4),
      previousMonthsSpent: sortedPrevious,
    };
  });
}
