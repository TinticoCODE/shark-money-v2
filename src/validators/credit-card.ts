import { z } from "zod";

const MAX_MONTHLY_RATE_DECIMAL = 0.1;

function formatMonthlyRateDecimal(decimal: number): string {
  return decimal.toFixed(6).replace(/\.?0+$/, "") || "0";
}

/**
 * Tasa mensual ingresada como porcentaje (ej. "2.878" = 2,878% mensual).
 * Se normaliza a decimal mensual para el domain (÷ 100).
 */
export const creditCardMonthlyRatePercentSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Tasa inválida")
  .superRefine((value, ctx) => {
    const decimal = Number(value) / 100;
    if (decimal > MAX_MONTHLY_RATE_DECIMAL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "La tasa mensual no puede superar 10%. Ingresa el porcentaje mensual (ej. 2.878 para 2,878% mensual).",
      });
    }
  })
  .transform((value) => formatMonthlyRateDecimal(Number(value) / 100));
