"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as loanService from "@/services/loan.service";
import {
  dateInputSchema,
  idSchema,
  loanInterestTypeSchema,
  moneySchema,
  optionalMoneySchema,
} from "@/validators/common";

const createLoanSchema = z.object({
  borrowerName: z.string().trim().min(1, "El nombre es obligatorio"),
  principalAmount: moneySchema,
  sourceAccountId: idSchema,
  lentAt: dateInputSchema,
  dueDate: dateInputSchema.nullish(),
  interestRate: optionalMoneySchema.nullish(),
  interestType: loanInterestTypeSchema.optional(),
});

const registerPaymentSchema = z.object({
  loanId: idSchema,
  accountId: idSchema,
  amount: moneySchema,
  paidAt: dateInputSchema,
});

const updatePaymentSchema = z.object({
  paymentId: idSchema,
  accountId: idSchema.optional(),
  amount: moneySchema.optional(),
  paidAt: dateInputSchema.optional(),
});

export async function listLoansAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof loanService.listLoans>>>
> {
  return runAction(async () => {
    await requireAuthSession();
    return loanService.listLoans();
  });
}

export async function getLoanAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof loanService.getLoanById>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return loanService.getLoanById(id);
  });
}

export async function createLoanAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof loanService.createLoan>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = createLoanSchema.parse(input);
    return loanService.createLoan(parsed);
  });
}

export async function registerLoanPaymentAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof loanService.registerLoanPayment>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = registerPaymentSchema.parse(input);
    return loanService.registerLoanPayment(parsed);
  });
}

export async function deleteLoanPaymentAction(
  paymentId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof loanService.deleteLoanPayment>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return loanService.deleteLoanPayment(paymentId);
  });
}

export async function updateLoanPaymentAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof loanService.updateLoanPayment>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updatePaymentSchema.parse(input);
    return loanService.updateLoanPayment(parsed);
  });
}
