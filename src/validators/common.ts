import { z } from "zod";

export const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Monto inválido")
  .refine((value) => Number(value) > 0, "El monto debe ser mayor a cero");

export const optionalMoneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Monto inválido");

export const dateInputSchema = z.coerce.date();

export const idSchema = z.string().trim().min(1, "ID requerido");

export const monthSchema = z.number().int().min(1).max(12);

export const yearSchema = z.number().int().min(2000).max(2100);

export const accountTypeSchema = z.enum([
  "CASH",
  "BANK",
  "DIGITAL_WALLET",
  "SAVINGS",
]);

export const categoryTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const loanInterestTypeSchema = z.enum(["NONE", "SIMPLE_MONTHLY"]);
