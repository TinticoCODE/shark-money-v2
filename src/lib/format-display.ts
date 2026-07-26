import { formatMoney } from "@/domain/money";

export function formatCurrency(
  value: string | number,
  currency = "COP",
): string {
  return formatMoney(value, currency);
}

export const accountTypeLabels: Record<string, string> = {
  CASH: "Efectivo",
  BANK: "Cuenta bancaria",
  DIGITAL_WALLET: "Billetera digital",
  SAVINGS: "Ahorros",
};

export const loanStatusLabels: Record<string, string> = {
  ACTIVE: "Al día",
  OVERDUE: "Atrasado",
  PAID: "Pagado",
};

export const budgetAlertLabels: Record<string, string> = {
  OK: "En control",
  WARNING: "Atención",
  OVER: "Excedido",
};

export const healthLabels: Record<string, string> = {
  EXCELLENT: "Excelente",
  GOOD: "Buena",
  FAIR: "Regular",
  AT_RISK: "En riesgo",
};

export const creditCardDebtLabels: Record<string, string> = {
  SIN_DEUDA: "Sin deuda",
  DEUDA_SIN_INTERES: "Deuda sin interés",
  DEUDA_CON_INTERES: "Deuda con interés",
};
