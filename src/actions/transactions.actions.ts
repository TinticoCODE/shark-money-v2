"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as transactionService from "@/services/transaction.service";
import {
  dateInputSchema,
  idSchema,
  moneySchema,
  transactionTypeSchema,
} from "@/validators/common";

const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  amount: moneySchema,
  accountId: idSchema,
  categoryId: idSchema,
  date: dateInputSchema,
  description: z.string().trim().max(500).optional(),
  isRecurring: z.boolean().optional(),
});

const updateTransactionSchema = createTransactionSchema.partial().extend({
  id: idSchema,
});

const listTransactionsSchema = z.object({
  accountId: idSchema.optional(),
  categoryId: idSchema.optional(),
  type: transactionTypeSchema.optional(),
  search: z.string().trim().optional(),
  from: dateInputSchema.optional(),
  to: dateInputSchema.optional(),
});

export async function listTransactionsAction(
  input: unknown = {},
): Promise<ActionResult<Awaited<ReturnType<typeof transactionService.listTransactions>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = listTransactionsSchema.parse(input);
    return transactionService.listTransactions(parsed);
  });
}

export async function createTransactionAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof transactionService.createTransaction>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = createTransactionSchema.parse(input);
    return transactionService.createTransaction(parsed);
  });
}

export async function updateTransactionAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof transactionService.updateTransaction>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updateTransactionSchema.parse(input);
    return transactionService.updateTransaction(parsed);
  });
}

export async function deleteTransactionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return transactionService.deleteTransaction(id);
  });
}
