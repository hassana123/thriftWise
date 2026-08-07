import { format, parseISO, isSameDay, differenceInCalendarDays } from "date-fns";

export const CURRENCY_SYMBOL = "₦";

export function formatMoney(amount: number, currency = "NGN"): string {
  if (currency === "NGN") {
    return `${CURRENCY_SYMBOL}${Math.round(amount).toLocaleString("en-NG")}`;
  }
  return `${CURRENCY_SYMBOL}${Math.round(amount).toLocaleString("en-NG")}`;
}

export function formatMoneyCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${CURRENCY_SYMBOL}${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${CURRENCY_SYMBOL}${(amount / 1_000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  }
  return `${CURRENCY_SYMBOL}${Math.round(amount).toLocaleString()}`;
}

export function formatDate(iso: string, pattern = "MMM d"): string {
  return format(parseISO(iso), pattern);
}

export function formatDateLong(iso: string): string {
  return format(parseISO(iso), "EEEE, MMMM d, yyyy");
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), "EEE d");
}

export function isToday(iso: string): boolean {
  return isSameDay(parseISO(iso), new Date());
}

export function daysUntil(iso: string): number {
  return differenceInCalendarDays(parseISO(iso), new Date());
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
