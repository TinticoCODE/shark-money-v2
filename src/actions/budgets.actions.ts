"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as budgetService from "@/services/budget.service";
import { idSchema, monthSchema, moneySchema, yearSchema } from "@/validators/common";

const upsertBudgetSchema = z.object({
  categoryId: idSchema,
  year: yearSchema,
  month: monthSchema,
  amount: moneySchema,
  isRecurringTemplate: z.boolean().optional(),
});

const periodSchema = z.object({
  year: yearSchema,
  month: monthSchema,
});

export async function listBudgetsAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof budgetService.listBudgets>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = periodSchema.parse(input);
    return budgetService.listBudgets(parsed.year, parsed.month);
  });
}

export async function upsertBudgetAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof budgetService.upsertBudget>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = upsertBudgetSchema.parse(input);
    return budgetService.upsertBudget(parsed);
  });
}

export async function deleteBudgetAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return budgetService.deleteBudget(id);
  });
}

export async function getBudgetProgressAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof budgetService.getBudgetProgress>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = periodSchema.parse(input);
    const { getUserSettingsOrThrow } = await import("@/services/settings.service");
    const {
      endOfMonthInTimezone,
      startOfMonthInTimezone,
    } = await import("@/domain/date-time");

    const settings = await getUserSettingsOrThrow();
    const reference = new Date(parsed.year, parsed.month - 1, 1);
    const from = startOfMonthInTimezone(reference, settings.timezone);
    const to = endOfMonthInTimezone(reference, settings.timezone);

    return budgetService.getBudgetProgress(parsed.year, parsed.month, from, to);
  });
}

export async function getBudgetHistoryAction(
  categoryId: string,
  months = 6,
): Promise<ActionResult<Awaited<ReturnType<typeof budgetService.getBudgetHistory>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return budgetService.getBudgetHistory(categoryId, months);
  });
}

export async function ensureRecurringBudgetTemplatesAction(
  input: unknown,
): Promise<
  ActionResult<Awaited<ReturnType<typeof budgetService.ensureRecurringBudgetTemplates>>>
> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = periodSchema.parse(input);
    return budgetService.ensureRecurringBudgetTemplates(parsed.year, parsed.month);
  });
}
