"use server";

import { z } from "zod";
import { requireAuthSession, runAction } from "@/actions/helpers/action-handler";
import type { ActionResult } from "@/types/action-result";
import * as creditCardService from "@/services/credit-card.service";
import { idSchema, moneySchema } from "@/validators/common";
import { creditCardMonthlyRatePercentSchema } from "@/validators/credit-card";

const createCreditCardSchema = z.object({
  name: z.string().trim().min(1),
  bankName: z.string().trim().optional().nullable(),
  lastFourDigits: z.string().trim().max(4).optional().nullable(),
  creditLimit: moneySchema,
  cutoffDay: z.number().int().min(1).max(31),
  paymentDueOffsetDays: z.number().int().min(0).max(60),
  interestRateMonthly: creditCardMonthlyRatePercentSchema.optional().default("0"),
  allowedInterestFreeMonths: z.array(z.number().int().min(1).max(48)).default([]),
  colorHex: z.string().trim().optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
});

const updateCreditCardSchema = createCreditCardSchema.partial().extend({
  id: idSchema,
  isActive: z.boolean().optional(),
});

const purchaseSchema = z.object({
  creditCardId: idSchema,
  categoryId: idSchema,
  amount: moneySchema,
  purchaseDate: z.coerce.date(),
  installmentsCount: z.number().int().min(1).max(48),
  description: z.string().trim().optional().nullable(),
});

const paymentSchema = z.object({
  creditCardId: idSchema,
  accountId: idSchema,
  amount: moneySchema,
  paidAt: z.coerce.date(),
});

export async function listCreditCardsAction(
  includeInactive = false,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.listCreditCards>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return creditCardService.listCreditCards(includeInactive);
  });
}

export async function getCreditCardAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.getCreditCardById>>>> {
  return runAction(async () => {
    await requireAuthSession();
    return creditCardService.getCreditCardById(id);
  });
}

export async function createCreditCardAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.createCreditCard>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = createCreditCardSchema.parse(input);
    return creditCardService.createCreditCard({
      ...parsed,
      imageUrl: parsed.imageUrl || null,
      interestRateMonthly: parsed.interestRateMonthly,
    });
  });
}

export async function updateCreditCardAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.updateCreditCard>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = updateCreditCardSchema.parse(input);
    return creditCardService.updateCreditCard({
      ...parsed,
      imageUrl: parsed.imageUrl === "" ? null : parsed.imageUrl,
    });
  });
}

export async function deactivateCreditCardAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.deactivateCreditCard>>>> {
  return runAction(async () => {
    await requireAuthSession();
    idSchema.parse(id);
    return creditCardService.deactivateCreditCard(id);
  });
}

export async function activateCreditCardAction(
  id: string,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.activateCreditCard>>>> {
  return runAction(async () => {
    await requireAuthSession();
    idSchema.parse(id);
    return creditCardService.activateCreditCard(id);
  });
}

export async function registerCreditCardPurchaseAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.registerCreditCardPurchase>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = purchaseSchema.parse(input);
    return creditCardService.registerCreditCardPurchase(parsed);
  });
}

export async function registerCreditCardPaymentAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof creditCardService.registerCreditCardPayment>>>> {
  return runAction(async () => {
    await requireAuthSession();
    const parsed = paymentSchema.parse(input);
    return creditCardService.registerCreditCardPayment(parsed);
  });
}

export async function deleteCreditCardPaymentAction(
  paymentId: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return creditCardService.deleteCreditCardPayment(paymentId);
  });
}

export async function deleteCreditCardPurchaseAction(
  purchaseId: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuthSession();
    return creditCardService.deleteCreditCardPurchase(purchaseId);
  });
}

export async function getCreditCardDashboardSummaryAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof creditCardService.getCreditCardDashboardSummary>>>
> {
  return runAction(async () => {
    await requireAuthSession();
    return creditCardService.getCreditCardDashboardSummary();
  });
}

export async function previewInstallmentPlanAction(input: {
  creditCardId: string;
  amount: string;
  purchaseDate: Date;
  installmentsCount: number;
}): Promise<
  ActionResult<{
    isInterestFree: boolean;
    installments: Array<{
      installmentNumber: number;
      principalAmount: string;
      interestAmount: string;
      billingCycleYear: number;
      billingCycleMonth: number;
    }>;
  }>
> {
  return runAction(async () => {
    await requireAuthSession();
    const { getUserSettingsOrThrow } = await import("@/services/settings.service");
    const { prisma } = await import("@/lib/prisma");
    const {
      generateCreditCardInstallments,
      isInterestFreeInstallmentPlan,
    } = await import("@/domain/credit-card-interest");

    const settings = await getUserSettingsOrThrow();
    const card = await prisma.creditCard.findUniqueOrThrow({
      where: { id: input.creditCardId },
    });

    const isInterestFree = isInterestFreeInstallmentPlan(
      input.installmentsCount,
      card.allowedInterestFreeMonths,
    );
    const installments = generateCreditCardInstallments({
      purchaseAmount: input.amount,
      purchaseDate: input.purchaseDate,
      installmentsCount: input.installmentsCount,
      allowedInterestFreeMonths: card.allowedInterestFreeMonths,
      interestRateMonthly: card.interestRateMonthly.toString(),
      cutoffDay: card.cutoffDay,
      timezone: settings.timezone,
    });

    return {
      isInterestFree,
      installments: installments.map((item) => ({
        installmentNumber: item.installmentNumber,
        principalAmount: item.principalAmount.toFixed(4),
        interestAmount: item.interestAmount.toFixed(4),
        billingCycleYear: item.billingCycleYear,
        billingCycleMonth: item.billingCycleMonth,
      })),
    };
  });
}
