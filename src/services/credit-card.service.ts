import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import {
  getCreditCardCycleSnapshot,
} from "@/domain/credit-card-cycle";
import { deriveCreditCardDebtStatus } from "@/domain/credit-card-debt";
import {
  generateCreditCardInstallments,
  isInterestFreeInstallmentPlan,
} from "@/domain/credit-card-interest";
import {
  allocatePaymentToInstallments,
  type InstallmentAllocationTarget,
} from "@/domain/credit-card-payment-allocation";
import { calculateInterestAvoidancePaymentAmount, sumFutureInstallmentCommitments } from "@/domain/credit-card-payment-suggestion";
import { prisma } from "@/lib/prisma";
import {
  applyTransactionBalances,
  toPrismaDecimal,
} from "@/services/helpers/balance.helper";
import {
  assertMostRecentCreditCardPayment,
  assertMostRecentCreditCardPurchase,
} from "@/services/helpers/chained-state.helper";
import { serializeDate, serializeDecimal } from "@/services/helpers/serialization.helper";
import { getUserSettingsOrThrow } from "@/services/settings.service";

type TransactionClient = Prisma.TransactionClient;

export interface CreateCreditCardInput {
  name: string;
  bankName?: string | null;
  lastFourDigits?: string | null;
  creditLimit: string;
  cutoffDay: number;
  paymentDueOffsetDays: number;
  interestRateMonthly: string;
  allowedInterestFreeMonths: number[];
  colorHex?: string | null;
  imageUrl?: string | null;
}

export interface UpdateCreditCardInput {
  id: string;
  name?: string;
  bankName?: string | null;
  lastFourDigits?: string | null;
  creditLimit?: string;
  cutoffDay?: number;
  paymentDueOffsetDays?: number;
  interestRateMonthly?: string;
  allowedInterestFreeMonths?: number[];
  colorHex?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
}

export interface RegisterCreditCardPurchaseInput {
  creditCardId: string;
  categoryId: string;
  amount: string;
  purchaseDate: Date;
  installmentsCount: number;
  description?: string | null;
}

export interface RegisterCreditCardPaymentInput {
  creditCardId: string;
  accountId: string;
  amount: string;
  paidAt: Date;
}

function serializeCreditCard(card: {
  id: string;
  name: string;
  bankName: string | null;
  lastFourDigits: string | null;
  creditLimit: { toString(): string };
  usedBalance: { toString(): string };
  cutoffDay: number;
  paymentDueOffsetDays: number;
  interestRateMonthly: { toString(): string };
  allowedInterestFreeMonths: number[];
  colorHex: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: card.id,
    name: card.name,
    bankName: card.bankName,
    lastFourDigits: card.lastFourDigits,
    creditLimit: serializeDecimal(card.creditLimit),
    usedBalance: serializeDecimal(card.usedBalance),
    cutoffDay: card.cutoffDay,
    paymentDueOffsetDays: card.paymentDueOffsetDays,
    interestRateMonthly: serializeDecimal(card.interestRateMonthly),
    allowedInterestFreeMonths: card.allowedInterestFreeMonths,
    colorHex: card.colorHex,
    imageUrl: card.imageUrl,
    isActive: card.isActive,
    createdAt: serializeDate(card.createdAt),
    updatedAt: serializeDate(card.updatedAt),
  };
}

function mapInstallmentTarget(installment: {
  id: string;
  installmentNumber: number;
  billingCycleYear: number;
  billingCycleMonth: number;
  principalAmount: { toString(): string };
  interestAmount: { toString(): string };
  paidAmount: { toString(): string };
}): InstallmentAllocationTarget {
  return {
    id: installment.id,
    installmentNumber: installment.installmentNumber,
    billingCycleYear: installment.billingCycleYear,
    billingCycleMonth: installment.billingCycleMonth,
    principalAmount: installment.principalAmount.toString(),
    interestAmount: installment.interestAmount.toString(),
    paidAmount: installment.paidAmount.toString(),
  };
}

async function loadCardInstallmentTargets(
  tx: TransactionClient,
  creditCardId: string,
): Promise<InstallmentAllocationTarget[]> {
  const installments = await tx.creditCardInstallment.findMany({
    where: { purchase: { creditCardId } },
    orderBy: [
      { billingCycleYear: "asc" },
      { billingCycleMonth: "asc" },
      { installmentNumber: "asc" },
    ],
  });

  return installments.map(mapInstallmentTarget);
}

async function enrichCreditCard(card: Awaited<ReturnType<typeof prisma.creditCard.findUniqueOrThrow>>) {
  const settings = await getUserSettingsOrThrow();
  const now = new Date();
  const cycle = getCreditCardCycleSnapshot(
    now,
    card.cutoffDay,
    card.paymentDueOffsetDays,
    settings.timezone,
  );

  const installments = await prisma.creditCardInstallment.findMany({
    where: { purchase: { creditCardId: card.id } },
  });
  const targets = installments.map(mapInstallmentTarget);
  const purchases = await prisma.creditCardPurchase.findMany({
    where: { creditCardId: card.id },
    include: { installments: true },
  });

  const debtStatus = deriveCreditCardDebtStatus({
    usedBalance: card.usedBalance.toString(),
    installments: targets,
  });

  return {
    ...serializeCreditCard(card),
    debtStatus,
    recentCutoffDate: serializeDate(cycle.recentCutoffDate),
    nextCutoffDate: serializeDate(cycle.nextCutoffDate),
    paymentDueDate: serializeDate(cycle.paymentDueDate),
    suggestedPaymentAmount: calculateInterestAvoidancePaymentAmount({
      currentBillingCycle: cycle.currentBillingCycle,
      purchases: purchases.map((purchase) => ({
        installmentsCount: purchase.installmentsCount,
        isInterestFree: purchase.isInterestFree,
        installments: purchase.installments.map(mapInstallmentTarget),
      })),
    }).toFixed(4),
    futureCommitmentAmount: sumFutureInstallmentCommitments(
      targets,
      cycle.currentBillingCycle,
    ).toFixed(4),
  };
}

export async function listCreditCards(includeInactive = false) {
  const cards = await prisma.creditCard.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(cards.map((card) => enrichCreditCard(card)));
}

export async function getCreditCardById(id: string) {
  const card = await prisma.creditCard.findUniqueOrThrow({ where: { id } });
  const enriched = await enrichCreditCard(card);

  const purchases = await prisma.creditCardPurchase.findMany({
    where: { creditCardId: id },
    include: {
      category: true,
      installments: { orderBy: { installmentNumber: "asc" } },
    },
    orderBy: { purchaseDate: "desc" },
  });

  const payments = await prisma.creditCardPayment.findMany({
    where: { creditCardId: id },
    include: { account: true },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  const latestPaymentId = payments[0]?.id ?? null;
  const latestPurchaseId = purchases[0]?.id ?? null;

  return {
    ...enriched,
    purchases: purchases.map((purchase) => ({
      id: purchase.id,
      amount: serializeDecimal(purchase.amount),
      description: purchase.description,
      purchaseDate: serializeDate(purchase.purchaseDate),
      installmentsCount: purchase.installmentsCount,
      isInterestFree: purchase.isInterestFree,
      categoryName: purchase.category.name,
      isMostRecent: purchase.id === latestPurchaseId,
      installments: purchase.installments.map((installment) => ({
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        principalAmount: serializeDecimal(installment.principalAmount),
        interestAmount: serializeDecimal(installment.interestAmount),
        paidAmount: serializeDecimal(installment.paidAmount),
        billingCycleYear: installment.billingCycleYear,
        billingCycleMonth: installment.billingCycleMonth,
      })),
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: serializeDecimal(payment.amount),
      paidAt: serializeDate(payment.paidAt),
      accountName: payment.account.name,
      isMostRecent: payment.id === latestPaymentId,
    })),
  };
}

export async function createCreditCard(input: CreateCreditCardInput) {
  const card = await prisma.creditCard.create({
    data: {
      name: input.name,
      bankName: input.bankName ?? null,
      lastFourDigits: input.lastFourDigits ?? null,
      creditLimit: toPrismaDecimal(input.creditLimit),
      cutoffDay: input.cutoffDay,
      paymentDueOffsetDays: input.paymentDueOffsetDays,
      interestRateMonthly: toPrismaDecimal(input.interestRateMonthly),
      allowedInterestFreeMonths: input.allowedInterestFreeMonths,
      colorHex: input.colorHex ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });

  return enrichCreditCard(card);
}

export async function updateCreditCard(input: UpdateCreditCardInput) {
  const card = await prisma.creditCard.update({
    where: { id: input.id },
    data: {
      name: input.name,
      bankName: input.bankName,
      lastFourDigits: input.lastFourDigits,
      creditLimit: input.creditLimit ? toPrismaDecimal(input.creditLimit) : undefined,
      cutoffDay: input.cutoffDay,
      paymentDueOffsetDays: input.paymentDueOffsetDays,
      interestRateMonthly: input.interestRateMonthly
        ? toPrismaDecimal(input.interestRateMonthly)
        : undefined,
      allowedInterestFreeMonths: input.allowedInterestFreeMonths,
      colorHex: input.colorHex,
      imageUrl: input.imageUrl,
      isActive: input.isActive,
    },
  });

  return enrichCreditCard(card);
}

export async function registerCreditCardPurchase(input: RegisterCreditCardPurchaseInput) {
  const settings = await getUserSettingsOrThrow();

  return prisma.$transaction(async (tx) => {
    const card = await tx.creditCard.findUniqueOrThrow({ where: { id: input.creditCardId } });

    if (!card.isActive) {
      throw new Error("La tarjeta seleccionada está inactiva");
    }

    const category = await tx.category.findUniqueOrThrow({ where: { id: input.categoryId } });
    if (category.type !== "EXPENSE") {
      throw new Error("La categoría debe ser de gasto");
    }

    const generatedInstallments = generateCreditCardInstallments({
      purchaseAmount: input.amount,
      purchaseDate: input.purchaseDate,
      installmentsCount: input.installmentsCount,
      allowedInterestFreeMonths: card.allowedInterestFreeMonths,
      interestRateMonthly: card.interestRateMonthly.toString(),
      cutoffDay: card.cutoffDay,
      timezone: settings.timezone,
    });

    const totalDebt = generatedInstallments.reduce(
      (sum, installment) => sum.plus(installment.principalAmount).plus(installment.interestAmount),
      new Decimal(0),
    );

    const nextUsed = new Decimal(card.usedBalance.toString()).plus(totalDebt);

    if (nextUsed.gt(card.creditLimit.toString())) {
      throw new Error("La compra supera el cupo disponible de la tarjeta");
    }

    const isInterestFree = isInterestFreeInstallmentPlan(
      input.installmentsCount,
      card.allowedInterestFreeMonths,
    );

    const transaction = await tx.transaction.create({
      data: {
        type: "EXPENSE",
        amount: toPrismaDecimal(input.amount),
        accountId: null,
        categoryId: input.categoryId,
        date: input.purchaseDate,
        description: input.description ?? `Compra ${card.name}`,
      },
    });

    const purchase = await tx.creditCardPurchase.create({
      data: {
        creditCardId: card.id,
        categoryId: input.categoryId,
        amount: toPrismaDecimal(input.amount),
        description: input.description ?? null,
        purchaseDate: input.purchaseDate,
        installmentsCount: input.installmentsCount,
        isInterestFree,
        transactionId: transaction.id,
        installments: {
          create: generatedInstallments.map((installment) => ({
            installmentNumber: installment.installmentNumber,
            principalAmount: toPrismaDecimal(installment.principalAmount),
            interestAmount: toPrismaDecimal(installment.interestAmount),
            billingCycleYear: installment.billingCycleYear,
            billingCycleMonth: installment.billingCycleMonth,
          })),
        },
      },
      include: { installments: true },
    });

    const updatedCard = await tx.creditCard.update({
      where: { id: card.id },
      data: { usedBalance: toPrismaDecimal(nextUsed) },
    });

    return {
      purchaseId: purchase.id,
      card: serializeCreditCard(updatedCard),
    };
  });
}

export async function registerCreditCardPayment(input: RegisterCreditCardPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.creditCard.findUniqueOrThrow({ where: { id: input.creditCardId } });
    const account = await tx.account.findUniqueOrThrow({ where: { id: input.accountId } });

    if (!card.isActive) {
      throw new Error("La tarjeta seleccionada está inactiva");
    }
    if (!account.isActive) {
      throw new Error("La cuenta seleccionada está inactiva");
    }

    const amount = new Decimal(input.amount);
    if (amount.lte(0)) {
      throw new Error("El monto del pago debe ser mayor a cero");
    }

    const usedBalance = new Decimal(card.usedBalance.toString());
    if (amount.gt(usedBalance)) {
      throw new Error("El pago supera el saldo usado de la tarjeta");
    }

    const installmentTargets = await loadCardInstallmentTargets(tx, card.id);
    const allocation = allocatePaymentToInstallments(input.amount, installmentTargets);

    const transaction = await tx.transaction.create({
      data: {
        type: "EXPENSE",
        amount: toPrismaDecimal(input.amount),
        accountId: input.accountId,
        date: input.paidAt,
        description: `Pago tarjeta ${card.name}`,
      },
    });

    const payment = await tx.creditCardPayment.create({
      data: {
        creditCardId: card.id,
        accountId: input.accountId,
        amount: toPrismaDecimal(input.amount),
        paidAt: input.paidAt,
        transactionId: transaction.id,
      },
    });

    for (const item of allocation.allocations) {
      await tx.creditCardPaymentAllocation.create({
        data: {
          paymentId: payment.id,
          installmentId: item.installmentId,
          amount: toPrismaDecimal(item.appliedAmount),
        },
      });

      const installment = await tx.creditCardInstallment.findUniqueOrThrow({
        where: { id: item.installmentId },
      });
      const nextPaid = new Decimal(installment.paidAmount.toString()).plus(item.appliedAmount);
      await tx.creditCardInstallment.update({
        where: { id: item.installmentId },
        data: { paidAmount: toPrismaDecimal(nextPaid) },
      });
    }

    await applyTransactionBalances(
      tx,
      {
        type: "EXPENSE",
        amount: input.amount,
        accountId: input.accountId,
      },
      1,
    );

    const updatedCard = await tx.creditCard.update({
      where: { id: card.id },
      data: { usedBalance: toPrismaDecimal(usedBalance.minus(amount)) },
    });

    return {
      paymentId: payment.id,
      card: serializeCreditCard(updatedCard),
    };
  });
}

async function reverseCreditCardPaymentInTransaction(
  tx: TransactionClient,
  payment: {
    id: string;
    creditCardId: string;
    accountId: string;
    amount: { toString(): string };
    transactionId: string;
  },
) {
  await assertMostRecentCreditCardPayment(tx, payment.id, payment.creditCardId);

  const storedAllocations = await tx.creditCardPaymentAllocation.findMany({
    where: { paymentId: payment.id },
  });

  for (const allocation of storedAllocations) {
    const installment = await tx.creditCardInstallment.findUniqueOrThrow({
      where: { id: allocation.installmentId },
    });
    const nextPaid = new Decimal(installment.paidAmount.toString()).minus(
      allocation.amount.toString(),
    );
    await tx.creditCardInstallment.update({
      where: { id: allocation.installmentId },
      data: { paidAmount: toPrismaDecimal(Decimal.max(nextPaid, 0)) },
    });
  }

  await tx.creditCardPaymentAllocation.deleteMany({
    where: { paymentId: payment.id },
  });

  const card = await tx.creditCard.findUniqueOrThrow({ where: { id: payment.creditCardId } });
  await tx.creditCard.update({
    where: { id: payment.creditCardId },
    data: {
      usedBalance: toPrismaDecimal(
        new Decimal(card.usedBalance.toString()).plus(payment.amount.toString()),
      ),
    },
  });

  await applyTransactionBalances(
    tx,
    {
      type: "EXPENSE",
      amount: payment.amount.toString(),
      accountId: payment.accountId,
    },
    -1,
  );

  await tx.creditCardPayment.delete({ where: { id: payment.id } });
  await tx.transaction.delete({ where: { id: payment.transactionId } });
}

export async function deleteCreditCardPayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.creditCardPayment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    await reverseCreditCardPaymentInTransaction(tx, payment);
    return { id: paymentId };
  });
}

async function reverseCreditCardPurchaseInTransaction(
  tx: TransactionClient,
  purchase: {
    id: string;
    creditCardId: string;
    transactionId: string;
    installments: Array<{
      principalAmount: { toString(): string };
      interestAmount: { toString(): string };
      paidAmount: { toString(): string };
    }>;
  },
) {
  await assertMostRecentCreditCardPurchase(tx, purchase.id, purchase.creditCardId);

  const totalDebt = purchase.installments.reduce(
    (sum, installment) =>
      sum
        .plus(installment.principalAmount.toString())
        .plus(installment.interestAmount.toString()),
    new Decimal(0),
  );
  const totalPaidOnInstallments = purchase.installments.reduce(
    (sum, installment) => sum.plus(installment.paidAmount.toString()),
    new Decimal(0),
  );

  if (totalPaidOnInstallments.gt(0)) {
    throw new Error("No se puede eliminar una compra con cuotas que ya recibieron pagos");
  }

  const card = await tx.creditCard.findUniqueOrThrow({ where: { id: purchase.creditCardId } });
  const nextUsed = new Decimal(card.usedBalance.toString()).minus(totalDebt);
  if (nextUsed.isNegative()) {
    throw new Error("No se puede revertir la compra porque el saldo usado quedaría negativo");
  }

  await tx.creditCardPurchase.delete({ where: { id: purchase.id } });
  await tx.transaction.delete({ where: { id: purchase.transactionId } });
  await tx.creditCard.update({
    where: { id: card.id },
    data: { usedBalance: toPrismaDecimal(nextUsed) },
  });
}

export async function deleteCreditCardPurchase(purchaseId: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.creditCardPurchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: { installments: true },
    });
    await reverseCreditCardPurchaseInTransaction(tx, purchase);
    return { id: purchaseId };
  });
}

export async function getCreditCardDashboardSummary() {
  const cards = await listCreditCards(false);
  const activeDebts = cards.filter((card) => new Decimal(card.usedBalance).gt(0));

  return {
    cards,
    activeDebts,
    totalFutureCommitment: cards
      .reduce((sum, card) => sum.plus(card.futureCommitmentAmount), new Decimal(0))
      .toFixed(4),
  };
}
