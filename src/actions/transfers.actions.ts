"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as transferService from "@/services/transfer.service";
import { dateInputSchema, idSchema, moneySchema } from "@/validators/common";

const createTransferSchema = z.object({
  fromAccountId: idSchema,
  toAccountId: idSchema,
  amount: moneySchema,
  date: dateInputSchema,
  description: z.string().trim().max(500).optional(),
});

export async function createTransferAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof transferService.createTransfer>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = createTransferSchema.parse(input);
    return transferService.createTransfer(parsed);
  });
}

export async function deleteTransferAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return transferService.deleteTransfer(id);
  });
}
