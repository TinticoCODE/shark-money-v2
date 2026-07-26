import Decimal from "decimal.js";
import { toDecimal, type MoneyInput } from "@/domain/money";

export type DerivedLoanStatus = "PAID" | "OVERDUE" | "ACTIVE";

export interface LoanStatusInput {
  outstandingPrincipal: MoneyInput;
  dueDate: Date | null;
  asOf: Date;
}

export function deriveLoanStatus(input: LoanStatusInput): DerivedLoanStatus {
  if (toDecimal(input.outstandingPrincipal).lte(0)) {
    return "PAID";
  }

  if (input.dueDate && input.asOf > input.dueDate) {
    return "OVERDUE";
  }

  return "ACTIVE";
}
