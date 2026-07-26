import Decimal from "decimal.js";
import type { LoanInterestType } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { splitLoanPayment } from "@/domain/loan-amortization";
import { deriveLoanStatus } from "@/domain/loan-status";
import { nowInTimezone } from "@/domain/date-time";
import { prisma } from "@/lib/prisma";
import {
  applyTransactionBalances,
  toPrismaDecimal,
} from "@/services/helpers/balance.helper";
import {
  assertMostRecentLoanPayment,
  getPreviousLoanInterestAccruedAt,
} from "@/services/helpers/chained-state.helper";
import { serializeDate, serializeDecimal } from "@/services/helpers/serialization.helper";
import { getUserSettingsOrThrow } from "@/services/settings.service";

export interface CreateLoanInput {
  borrowerName: string;
  principalAmount: string;
  sourceAccountId: string;
  lentAt: Date;
  dueDate?: Date | null;
  interestRate?: string | null;
  interestType?: LoanInterestType;
}

export interface RegisterLoanPaymentInput {
  loanId: string;
  accountId: string;
  amount: string;
  paidAt: Date;
}

export interface UpdateLoanPaymentInput {
  paymentId: string;
  accountId?: string;
  amount?: string;
  paidAt?: Date;
}

type TransactionClient = Prisma.TransactionClient;

function serializeLoan(
  loan: {
    id: string;
    borrowerName: string;
    principalAmount: { toString(): string };
    outstandingPrincipal: { toString(): string };
    interestRate: { toString(): string } | null;
    interestType: LoanInterestType;
    lentAt: Date;
    dueDate: Date | null;
    lastInterestAccruedAt: Date;
    sourceAccountId: string;
    createdAt: Date;
    updatedAt: Date;
  },
  status: ReturnType<typeof deriveLoanStatus>,
) {
  return {
    id: loan.id,
    borrowerName: loan.borrowerName,
    principalAmount: serializeDecimal(loan.principalAmount),
    outstandingPrincipal: serializeDecimal(loan.outstandingPrincipal),
    interestRate: loan.interestRate ? serializeDecimal(loan.interestRate) : null,
    interestType: loan.interestType,
    lentAt: serializeDate(loan.lentAt),
    dueDate: loan.dueDate ? serializeDate(loan.dueDate) : null,
    lastInterestAccruedAt: serializeDate(loan.lastInterestAccruedAt),
    sourceAccountId: loan.sourceAccountId,
    status,
    createdAt: serializeDate(loan.createdAt),
    updatedAt: serializeDate(loan.updatedAt),
  };
}

function serializePayment(payment: {
  id: string;
  totalAmount: { toString(): string };
  principalAmount: { toString(): string };
  interestAmount: { toString(): string };
  paidAt: Date;
}) {
  return {
    id: payment.id,
    totalAmount: serializeDecimal(payment.totalAmount),
    principalAmount: serializeDecimal(payment.principalAmount),
    interestAmount: serializeDecimal(payment.interestAmount),
    paidAt: serializeDate(payment.paidAt),
  };
}

async function registerLoanPaymentInTransaction(
  tx: TransactionClient,
  input: RegisterLoanPaymentInput,
  timezone: string,
) {
  const loan = await tx.loan.findUniqueOrThrow({ where: { id: input.loanId } });
  const account = await tx.account.findUniqueOrThrow({
    where: { id: input.accountId },
  });

  if (!account.isActive) {
    throw new Error("La cuenta destino está inactiva");
  }

  if (new Decimal(loan.outstandingPrincipal.toString()).isZero()) {
    throw new Error("El préstamo ya está pagado");
  }

  const breakdown = splitLoanPayment(input.amount, {
    outstandingPrincipal: loan.outstandingPrincipal.toString(),
    monthlyInterestRate: loan.interestRate?.toString() ?? null,
    lastInterestAccruedAt: loan.lastInterestAccruedAt,
    paymentDate: input.paidAt,
    timezone,
  });

  const transaction = await tx.transaction.create({
    data: {
      type: "INCOME",
      amount: toPrismaDecimal(breakdown.totalAmount),
      accountId: input.accountId,
      date: input.paidAt,
      description: `Abono de ${loan.borrowerName}`,
    },
  });

  const payment = await tx.loanPayment.create({
    data: {
      loanId: loan.id,
      accountId: input.accountId,
      transactionId: transaction.id,
      totalAmount: toPrismaDecimal(breakdown.totalAmount),
      principalAmount: toPrismaDecimal(breakdown.principalAmount),
      interestAmount: toPrismaDecimal(breakdown.interestAmount),
      paidAt: input.paidAt,
    },
  });

  await applyTransactionBalances(
    tx,
    {
      type: "INCOME",
      amount: breakdown.totalAmount.toString(),
      accountId: input.accountId,
    },
    1,
  );

  const nextOutstanding = new Decimal(loan.outstandingPrincipal.toString()).minus(
    breakdown.principalAmount,
  );

  const updatedLoan = await tx.loan.update({
    where: { id: loan.id },
    data: {
      outstandingPrincipal: toPrismaDecimal(Decimal.max(nextOutstanding, 0)),
      lastInterestAccruedAt: input.paidAt,
    },
  });

  return { payment, updatedLoan };
}

async function reverseLoanPaymentInTransaction(
  tx: TransactionClient,
  payment: {
    id: string;
    loanId: string;
    accountId: string;
    transactionId: string;
    totalAmount: { toString(): string };
    principalAmount: { toString(): string };
    loan: {
      outstandingPrincipal: { toString(): string };
    };
  },
) {
  await assertMostRecentLoanPayment(tx, payment.id, payment.loanId);

  await applyTransactionBalances(
    tx,
    {
      type: "INCOME",
      amount: payment.totalAmount.toString(),
      accountId: payment.accountId,
    },
    -1,
  );

  const previousAccruedAt = await getPreviousLoanInterestAccruedAt(
    tx,
    payment.loanId,
    payment.id,
  );

  const restoredOutstanding = new Decimal(
    payment.loan.outstandingPrincipal.toString(),
  ).plus(payment.principalAmount.toString());

  await tx.loan.update({
    where: { id: payment.loanId },
    data: {
      outstandingPrincipal: toPrismaDecimal(restoredOutstanding),
      lastInterestAccruedAt: previousAccruedAt,
    },
  });

  await tx.loanPayment.delete({ where: { id: payment.id } });
  await tx.transaction.delete({ where: { id: payment.transactionId } });
}

export async function listLoans() {
  const settings = await getUserSettingsOrThrow();
  const asOf = nowInTimezone(settings.timezone);
  const loans = await prisma.loan.findMany({
    orderBy: { lentAt: "desc" },
  });

  return loans.map((loan) =>
    serializeLoan(
      loan,
      deriveLoanStatus({
        outstandingPrincipal: loan.outstandingPrincipal.toString(),
        dueDate: loan.dueDate,
        asOf,
      }),
    ),
  );
}

export async function getLoanById(id: string) {
  const settings = await getUserSettingsOrThrow();
  const asOf = nowInTimezone(settings.timezone);
  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      payments: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!loan) {
    throw new Error("Préstamo no encontrado");
  }

  return {
    ...serializeLoan(
      loan,
      deriveLoanStatus({
        outstandingPrincipal: loan.outstandingPrincipal.toString(),
        dueDate: loan.dueDate,
        asOf,
      }),
    ),
    payments: loan.payments.map((payment) => ({
      accountId: payment.accountId,
      ...serializePayment(payment),
    })),
  };
}

export async function createLoan(input: CreateLoanInput) {
  const interestType = input.interestType ?? "NONE";
  const interestRate =
    interestType === "NONE" ? null : input.interestRate ?? null;

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findUniqueOrThrow({
      where: { id: input.sourceAccountId },
    });

    if (!account.isActive) {
      throw new Error("La cuenta origen está inactiva");
    }

    const loan = await tx.loan.create({
      data: {
        borrowerName: input.borrowerName.trim(),
        principalAmount: toPrismaDecimal(input.principalAmount),
        outstandingPrincipal: toPrismaDecimal(input.principalAmount),
        interestRate: interestRate ? toPrismaDecimal(interestRate) : null,
        interestType,
        lentAt: input.lentAt,
        dueDate: input.dueDate ?? null,
        lastInterestAccruedAt: input.lentAt,
        sourceAccountId: input.sourceAccountId,
      },
    });

    await tx.transaction.create({
      data: {
        type: "EXPENSE",
        amount: toPrismaDecimal(input.principalAmount),
        accountId: input.sourceAccountId,
        date: input.lentAt,
        description: `Préstamo a ${loan.borrowerName}`,
        loanId: loan.id,
      },
    });

    await applyTransactionBalances(
      tx,
      {
        type: "EXPENSE",
        amount: input.principalAmount,
        accountId: input.sourceAccountId,
      },
      1,
    );

    const settings = await getUserSettingsOrThrow();

    return serializeLoan(
      loan,
      deriveLoanStatus({
        outstandingPrincipal: loan.outstandingPrincipal.toString(),
        dueDate: loan.dueDate,
        asOf: nowInTimezone(settings.timezone),
      }),
    );
  });
}

export async function registerLoanPayment(input: RegisterLoanPaymentInput) {
  const settings = await getUserSettingsOrThrow();

  return prisma.$transaction(async (tx) => {
    const { payment, updatedLoan } = await registerLoanPaymentInTransaction(
      tx,
      input,
      settings.timezone,
    );

    return {
      payment: serializePayment(payment),
      loan: serializeLoan(
        updatedLoan,
        deriveLoanStatus({
          outstandingPrincipal: updatedLoan.outstandingPrincipal.toString(),
          dueDate: updatedLoan.dueDate,
          asOf: nowInTimezone(settings.timezone),
        }),
      ),
    };
  });
}

export async function deleteLoanPayment(paymentId: string) {
  const settings = await getUserSettingsOrThrow();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { loan: true },
    });

    await reverseLoanPaymentInTransaction(tx, payment);

    const updatedLoan = await tx.loan.findUniqueOrThrow({
      where: { id: payment.loanId },
    });

    return {
      id: paymentId,
      loan: serializeLoan(
        updatedLoan,
        deriveLoanStatus({
          outstandingPrincipal: updatedLoan.outstandingPrincipal.toString(),
          dueDate: updatedLoan.dueDate,
          asOf: nowInTimezone(settings.timezone),
        }),
      ),
    };
  });
}

export async function updateLoanPayment(input: UpdateLoanPaymentInput) {
  const settings = await getUserSettingsOrThrow();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.findUniqueOrThrow({
      where: { id: input.paymentId },
      include: { loan: true },
    });

    const nextInput: RegisterLoanPaymentInput = {
      loanId: payment.loanId,
      accountId: input.accountId ?? payment.accountId,
      amount: input.amount ?? payment.totalAmount.toString(),
      paidAt: input.paidAt ?? payment.paidAt,
    };

    await reverseLoanPaymentInTransaction(tx, payment);

    const { payment: newPayment, updatedLoan } = await registerLoanPaymentInTransaction(
      tx,
      nextInput,
      settings.timezone,
    );

    return {
      payment: serializePayment(newPayment),
      loan: serializeLoan(
        updatedLoan,
        deriveLoanStatus({
          outstandingPrincipal: updatedLoan.outstandingPrincipal.toString(),
          dueDate: updatedLoan.dueDate,
          asOf: nowInTimezone(settings.timezone),
        }),
      ),
    };
  });
}

export async function countOverdueLoans(asOf: Date) {
  const loans = await prisma.loan.findMany({
    select: {
      outstandingPrincipal: true,
      dueDate: true,
    },
  });

  return loans.filter(
    (loan) =>
      deriveLoanStatus({
        outstandingPrincipal: loan.outstandingPrincipal.toString(),
        dueDate: loan.dueDate,
        asOf,
      }) === "OVERDUE",
  ).length;
}
