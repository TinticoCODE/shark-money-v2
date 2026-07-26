import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { calculateGoalProjection } from "@/domain/goal-projection";
import { prisma } from "@/lib/prisma";
import {
  applyTransactionBalances,
  toPrismaDecimal,
} from "@/services/helpers/balance.helper";
import { assertMostRecentGoalContribution } from "@/services/helpers/chained-state.helper";
import { getUserSettingsOrThrow } from "@/services/settings.service";
import { nowInTimezone } from "@/domain/date-time";
import { serializeDate, serializeDecimal } from "@/services/helpers/serialization.helper";

export interface CreateGoalInput {
  name: string;
  targetAmount: string;
  targetDate?: Date | null;
}

export interface UpdateGoalInput {
  id: string;
  name?: string;
  targetAmount?: string;
  targetDate?: Date | null;
}

export interface ContributeToGoalInput {
  goalId: string;
  accountId: string;
  amount: string;
  contributedAt: Date;
}

export interface UpdateGoalContributionInput {
  contributionId: string;
  accountId?: string;
  amount?: string;
  contributedAt?: Date;
}

type TransactionClient = Prisma.TransactionClient;

function serializeGoal(goal: {
  id: string;
  name: string;
  targetAmount: { toString(): string };
  currentAmount: { toString(): string };
  targetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const target = new Decimal(goal.targetAmount.toString());
  const current = new Decimal(goal.currentAmount.toString());
  const progressPercent = target.isZero()
    ? new Decimal(0)
    : current.dividedBy(target).times(100);

  return {
    id: goal.id,
    name: goal.name,
    targetAmount: serializeDecimal(goal.targetAmount),
    currentAmount: serializeDecimal(goal.currentAmount),
    targetDate: goal.targetDate ? serializeDate(goal.targetDate) : null,
    progressPercent: progressPercent.toFixed(2),
    createdAt: serializeDate(goal.createdAt),
    updatedAt: serializeDate(goal.updatedAt),
  };
}

export async function listGoals() {
  const goals = await prisma.goal.findMany({ orderBy: { createdAt: "desc" } });
  return goals.map(serializeGoal);
}

export async function getGoalById(id: string) {
  const goal = await prisma.goal.findUnique({
    where: { id },
    include: {
      contributions: {
        orderBy: { contributedAt: "desc" },
      },
    },
  });

  if (!goal) {
    throw new Error("Meta no encontrada");
  }

  const settings = await getUserSettingsOrThrow();
  const projection = calculateGoalProjection({
    targetAmount: goal.targetAmount.toString(),
    currentAmount: goal.currentAmount.toString(),
    targetDate: goal.targetDate,
    asOf: nowInTimezone(settings.timezone),
    timezone: settings.timezone,
    contributions: goal.contributions.map((contribution) => ({
      amount: contribution.amount.toString(),
      contributedAt: contribution.contributedAt,
    })),
  });

  return {
    ...serializeGoal(goal),
    contributions: goal.contributions.map((contribution) => ({
      id: contribution.id,
      accountId: contribution.accountId,
      amount: serializeDecimal(contribution.amount),
      contributedAt: serializeDate(contribution.contributedAt),
    })),
    projection: {
      averageMonthlyContribution: projection.averageMonthlyContribution.toFixed(4),
      estimatedCompletionDate: projection.estimatedCompletionDate
        ? serializeDate(projection.estimatedCompletionDate)
        : null,
      isBehindSchedule: projection.isBehindSchedule,
      requiredMonthlyContribution: projection.requiredMonthlyContribution
        ? projection.requiredMonthlyContribution.toFixed(4)
        : null,
      remainingAmount: projection.remainingAmount.toFixed(4),
    },
  };
}

export async function createGoal(input: CreateGoalInput) {
  const goal = await prisma.goal.create({
    data: {
      name: input.name.trim(),
      targetAmount: toPrismaDecimal(input.targetAmount),
      targetDate: input.targetDate ?? null,
    },
  });

  return serializeGoal(goal);
}

export async function updateGoal(input: UpdateGoalInput) {
  const goal = await prisma.goal.update({
    where: { id: input.id },
    data: {
      name: input.name?.trim(),
      targetAmount: input.targetAmount ? toPrismaDecimal(input.targetAmount) : undefined,
      targetDate: input.targetDate,
    },
  });

  return serializeGoal(goal);
}

export async function deleteGoal(id: string) {
  const contribution = await prisma.goalContribution.findFirst({
    where: { goalId: id },
    select: { id: true },
  });

  if (contribution) {
    throw new Error("No se puede eliminar una meta con aportes registrados");
  }

  await prisma.goal.delete({ where: { id } });
  return { id };
}

export async function contributeToGoal(input: ContributeToGoalInput) {
  return prisma.$transaction(async (tx) => {
    const result = await contributeToGoalInTransaction(tx, input);
    return result;
  });
}

async function contributeToGoalInTransaction(
  tx: TransactionClient,
  input: ContributeToGoalInput,
) {
  const [goal, account] = await Promise.all([
    tx.goal.findUniqueOrThrow({ where: { id: input.goalId } }),
    tx.account.findUniqueOrThrow({ where: { id: input.accountId } }),
  ]);

  if (!account.isActive) {
    throw new Error("La cuenta origen está inactiva");
  }

  const transaction = await tx.transaction.create({
    data: {
      type: "EXPENSE",
      amount: toPrismaDecimal(input.amount),
      accountId: input.accountId,
      date: input.contributedAt,
      description: `Aporte a meta: ${goal.name}`,
    },
  });

  const contribution = await tx.goalContribution.create({
    data: {
      goalId: goal.id,
      accountId: input.accountId,
      transactionId: transaction.id,
      amount: toPrismaDecimal(input.amount),
      contributedAt: input.contributedAt,
    },
  });

  await applyTransactionBalances(
    tx,
    {
      type: "EXPENSE",
      amount: input.amount,
      accountId: input.accountId,
    },
    1,
  );

  const updatedGoal = await tx.goal.update({
    where: { id: goal.id },
    data: {
      currentAmount: toPrismaDecimal(
        new Decimal(goal.currentAmount.toString()).plus(input.amount),
      ),
    },
  });

  return {
    contribution: {
      id: contribution.id,
      amount: serializeDecimal(contribution.amount),
      contributedAt: serializeDate(contribution.contributedAt),
    },
    goal: serializeGoal(updatedGoal),
  };
}

async function reverseGoalContributionInTransaction(
  tx: TransactionClient,
  contribution: {
    id: string;
    goalId: string;
    accountId: string;
    transactionId: string;
    amount: { toString(): string };
    goal: {
      currentAmount: { toString(): string };
    };
  },
) {
  await assertMostRecentGoalContribution(tx, contribution.id, contribution.goalId);

  await applyTransactionBalances(
    tx,
    {
      type: "EXPENSE",
      amount: contribution.amount.toString(),
      accountId: contribution.accountId,
    },
    -1,
  );

  const restoredAmount = new Decimal(contribution.goal.currentAmount.toString()).minus(
    contribution.amount.toString(),
  );

  if (restoredAmount.isNegative()) {
    throw new Error("El aporte no se puede revertir porque dejaría la meta en negativo");
  }

  await tx.goal.update({
    where: { id: contribution.goalId },
    data: {
      currentAmount: toPrismaDecimal(restoredAmount),
    },
  });

  await tx.goalContribution.delete({ where: { id: contribution.id } });
  await tx.transaction.delete({ where: { id: contribution.transactionId } });
}

export async function deleteGoalContribution(contributionId: string) {
  return prisma.$transaction(async (tx) => {
    const contribution = await tx.goalContribution.findUniqueOrThrow({
      where: { id: contributionId },
      include: { goal: true },
    });

    await reverseGoalContributionInTransaction(tx, contribution);

    const updatedGoal = await tx.goal.findUniqueOrThrow({
      where: { id: contribution.goalId },
    });

    return {
      id: contributionId,
      goal: serializeGoal(updatedGoal),
    };
  });
}

export async function updateGoalContribution(input: UpdateGoalContributionInput) {
  return prisma.$transaction(async (tx) => {
    const contribution = await tx.goalContribution.findUniqueOrThrow({
      where: { id: input.contributionId },
      include: { goal: true },
    });

    const nextInput: ContributeToGoalInput = {
      goalId: contribution.goalId,
      accountId: input.accountId ?? contribution.accountId,
      amount: input.amount ?? contribution.amount.toString(),
      contributedAt: input.contributedAt ?? contribution.contributedAt,
    };

    await reverseGoalContributionInTransaction(tx, contribution);

    return contributeToGoalInTransaction(tx, nextInput);
  });
}

export async function countBehindScheduleGoals(asOf: Date, timezone: string) {
  const goals = await prisma.goal.findMany({
    where: { targetDate: { not: null } },
    include: { contributions: true },
  });

  return goals.filter((goal) => {
    const projection = calculateGoalProjection({
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      targetDate: goal.targetDate,
      asOf,
      timezone,
      contributions: goal.contributions.map((contribution) => ({
        amount: contribution.amount.toString(),
        contributedAt: contribution.contributedAt,
      })),
    });

    return projection.isBehindSchedule;
  }).length;
}
