"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as accountService from "@/services/account.service";
import { accountTypeSchema, idSchema, optionalMoneySchema } from "@/validators/common";

const createAccountSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  type: accountTypeSchema,
  initialBalance: optionalMoneySchema.optional(),
});

const updateAccountSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).optional(),
  type: accountTypeSchema.optional(),
  isActive: z.boolean().optional(),
});

export async function listAccountsAction(
  includeInactive = false,
): Promise<ActionResult<Awaited<ReturnType<typeof accountService.listAccounts>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return accountService.listAccounts(includeInactive);
  });
}

export async function getAccountAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof accountService.getAccountById>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return accountService.getAccountById(id);
  });
}

export async function getAccountMovementsAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof accountService.getAccountMovements>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return accountService.getAccountMovements(id);
  });
}

export async function createAccountAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof accountService.createAccount>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = createAccountSchema.parse(input);
    return accountService.createAccount(parsed);
  });
}

export async function updateAccountAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof accountService.updateAccount>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updateAccountSchema.parse(input);
    return accountService.updateAccount(parsed);
  });
}

export async function deleteAccountAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return accountService.deleteAccount(id);
  });
}

export async function deactivateAccountAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof accountService.deactivateAccount>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return accountService.deactivateAccount(id);
  });
}
