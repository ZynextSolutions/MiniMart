import { Decimal } from "@prisma/client/runtime/library";

export const ZERO = new Decimal(0);

export function toDecimal(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function add(a: Decimal | number | string, b: Decimal | number | string): Decimal {
  return toDecimal(a).add(toDecimal(b));
}

export function sub(a: Decimal | number | string, b: Decimal | number | string): Decimal {
  return toDecimal(a).sub(toDecimal(b));
}

export function mul(a: Decimal | number | string, b: Decimal | number | string): Decimal {
  return toDecimal(a).mul(toDecimal(b));
}

export function div(a: Decimal | number | string, b: Decimal | number | string): Decimal {
  return toDecimal(a).div(toDecimal(b));
}

export function isPositive(value: Decimal | number | string): boolean {
  return toDecimal(value).gt(ZERO);
}

export function isZeroOrNegative(value: Decimal | number | string): boolean {
  return toDecimal(value).lte(ZERO);
}
