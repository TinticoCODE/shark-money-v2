import Decimal from "decimal.js";

export type MoneyInput = Decimal | string | number;

export function toDecimal(value: MoneyInput): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>(
    (acc, value) => acc.plus(toDecimal(value)),
    new Decimal(0),
  );
}

export function formatMoney(
  value: MoneyInput,
  currency = "COP",
  locale = "es-CO",
): string {
  const numeric = toDecimal(value).toNumber();

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function percentOf(part: MoneyInput, whole: MoneyInput): Decimal {
  const wholeDecimal = toDecimal(whole);
  if (wholeDecimal.isZero()) {
    return new Decimal(0);
  }

  return toDecimal(part).dividedBy(wholeDecimal).times(100);
}
