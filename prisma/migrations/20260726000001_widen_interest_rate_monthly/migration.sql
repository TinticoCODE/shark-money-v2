-- Ampliar precisión de tasa mensual (ej. 0.019957 = 1,9957% mensual).
-- Aplicado previamente fuera de migrate; esta migración formaliza el cambio.
ALTER TABLE "CreditCard" ALTER COLUMN "interestRateMonthly" TYPE DECIMAL(19, 6);
