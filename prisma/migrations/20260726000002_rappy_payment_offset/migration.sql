-- Ajuste ciclo Rappy Card: offset ~10 días tras corte día 20 (aprox. tarifa Davivienda).
UPDATE "CreditCard"
SET "paymentDueOffsetDays" = 10
WHERE name ILIKE '%RAPPY%';
