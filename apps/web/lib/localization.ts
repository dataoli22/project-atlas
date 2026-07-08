import { DEFAULT_CURRENCY, DEFAULT_LANGUAGE, DEFAULT_MARKET } from "@atlas/config";

export type LocalizationConfig = {
  locale?: string | null;
  currency?: string | null;
  language?: string | null;
  market?: string | null;
};

const DEFAULT_SHARED_LOCALE = `${DEFAULT_LANGUAGE}-${DEFAULT_MARKET}`;

function isSupportedCurrencyCode(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

export function buildLocaleTag(language?: string | null, market?: string | null) {
  return `${language ?? DEFAULT_LANGUAGE}-${market ?? DEFAULT_MARKET}`;
}

export function resolveLocale(localization?: LocalizationConfig) {
  const candidate =
    localization?.locale ??
    (localization?.language || localization?.market
      ? buildLocaleTag(localization.language, localization.market)
      : DEFAULT_SHARED_LOCALE);

  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? DEFAULT_SHARED_LOCALE;
  } catch {
    return DEFAULT_SHARED_LOCALE;
  }
}

export function resolveCurrency(localization?: LocalizationConfig) {
  return isSupportedCurrencyCode(localization?.currency) ? localization.currency : DEFAULT_CURRENCY;
}

export function formatLocalizedDateTime(
  value: string | Date,
  localization?: LocalizationConfig,
  options?: Intl.DateTimeFormatOptions
) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat(resolveLocale(localization), options).format(date);
}

export function formatLocalizedNumber(
  value: number,
  localization?: LocalizationConfig,
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(resolveLocale(localization), options).format(value);
}

export function formatLocalizedCurrency(
  value: number,
  localization?: LocalizationConfig,
  options?: Intl.NumberFormatOptions
) {
  const fractionDigits = Number.isInteger(value) ? 0 : 2;

  return new Intl.NumberFormat(resolveLocale(localization), {
    style: "currency",
    currency: resolveCurrency(localization),
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    ...options
  }).format(value);
}

export function parseLocalizedAmount(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "").trim();

  if (!sanitized || sanitized === "-" || sanitized === "." || sanitized === ",") {
    return null;
  }

  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);
  const separator = separatorIndex === -1 ? null : sanitized[separatorIndex];
  const digitsAfterSeparator = separatorIndex === -1 ? 0 : sanitized.length - separatorIndex - 1;
  const decimalSeparator =
    separator && digitsAfterSeparator > 0 && digitsAfterSeparator <= 2 ? separator : null;

  const normalized = decimalSeparator
    ? sanitized
        .replace(new RegExp(`\\${decimalSeparator === "." ? "," : "."}`, "g"), "")
        .replace(decimalSeparator, ".")
    : sanitized.replace(/[.,]/g, "");

  const amount = Number.parseFloat(normalized);

  return Number.isNaN(amount) ? null : amount;
}

export function formatCurrencyDisplay(
  value: string,
  localization?: LocalizationConfig,
  options?: Intl.NumberFormatOptions
) {
  const amount = parseLocalizedAmount(value);

  return amount === null ? value : formatLocalizedCurrency(amount, localization, options);
}
