"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as goalService from "@/services/goal.service";
import { dateInputSchema, idSchema, moneySchema } from "@/validators/common";

const createGoalSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  targetAmount: moneySchema,
  targetDate: dateInputSchema.nullish(),
});

const updateGoalSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).optional(),
  targetAmount: moneySchema.optional(),
  targetDate: dateInputSchema.nullish(),
});

const contributeSchema = z.object({
  goalId: idSchema,
  accountId: idSchema,
  amount: moneySchema,
  contributedAt: dateInputSchema,
});

const updateContributionSchema = z.object({
  contributionId: idSchema,
  accountId: idSchema.optional(),
  amount: moneySchema.optional(),
  contributedAt: dateInputSchema.optional(),
});

export async function listGoalsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof goalService.listGoals>>>
> {
  return runAction(async () => {
    await requireAuthSession();
    return goalService.listGoals();
  });
}

export async function getGoalAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof goalService.getGoalById>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return goalService.getGoalById(id);
  });
}

export async function createGoalAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof goalService.createGoal>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = createGoalSchema.parse(input);
    return goalService.createGoal(parsed);
  });
}

export async function updateGoalAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof goalService.updateGoal>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updateGoalSchema.parse(input);
    return goalService.updateGoal(parsed);
  });
}

export async function deleteGoalAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return goalService.deleteGoal(id);
  });
}

export async function contributeToGoalAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof goalService.contributeToGoal>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = contributeSchema.parse(input);
    return goalService.contributeToGoal(parsed);
  });
}

export async function deleteGoalContributionAction(
  contributionId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof goalService.deleteGoalContribution>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return goalService.deleteGoalContribution(contributionId);
  });
}

export async function updateGoalContributionAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof goalService.updateGoalContribution>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updateContributionSchema.parse(input);
    return goalService.updateGoalContribution(parsed);
  });
}
