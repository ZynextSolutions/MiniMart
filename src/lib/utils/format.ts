let systemCurrency = "THB";

export function setSystemCurrency(currency?: string) {
  if (!currency) return;
  systemCurrency = currency.toUpperCase();
}

export function getSystemCurrency() {
  return systemCurrency;
}

function resolveLocale(currency: string) {
  switch (currency) {
    case "THB":
      return "th-TH";
    case "USD":
      return "en-US";
    case "MMK":
      return "en-US";
    default:
      return "en-US";
  }
}

export function formatMoney(
  amount: number | string,
  currency = getSystemCurrency(),
): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  const safeCurrency = currency.toUpperCase();

  if (safeCurrency === "MMK") {
    const absValue = Math.abs(value);
    const formattedNumber = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
    return value < 0 ? `-Ks ${formattedNumber}` : `Ks ${formattedNumber}`;
  }

  return new Intl.NumberFormat(resolveLocale(safeCurrency), {
    style: "currency",
    currency: safeCurrency,
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
