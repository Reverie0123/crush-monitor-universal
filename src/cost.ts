import type { UsageTotal } from "./useAnalysis";
import { currentLang, messages } from "./i18n";
import { requestLimits, type RequestLimits } from "../shared/limits";

/**
 * Price per million tokens in the chosen currency, plus a correction factor
 * from the visitor's real bill.
 * Defaults are DeepSeek V4 Flash off-peak list prices (peak hours cost double);
 * they matched a real ¥8 bill for a 1,588-message chat.
 */
export type Prices = {
  input: number;
  cached: number;
  output: number;
  factor: number;
};
export const DEFAULT_PRICES: Prices = {
  input: 1.5,
  cached: 0.05,
  output: 4.5,
  factor: 1,
};
// v2: the v1 defaults (2 / 0.2 / 3) overestimated; drop them rather than keep a wrong number.
// Each model keeps its own prices and bill calibration, so one never skews the other.
type Provider = RequestLimits["provider"];
const key = (provider: Provider) =>
  provider === "jev" ? "crush-monitor-prices-jev" : "crush-monitor-prices-v2";

/**
 * Money is entered and shown in one currency per browser. Switching converts
 * what was saved at a fixed rate; the bill factor is a ratio and stays as is.
 */
export type Currency = "CNY" | "USD";
export const CNY_PER_USD = 7.2;
const CURRENCY_KEY = "crush-monitor-currency";
const BUDGET_KEY = "crush-monitor-budget";

/**
 * The saved choice. Otherwise visitors who already saved prices or a limit
 * keep yuan (what those numbers are in); new ones follow the interface language.
 */
export function loadCurrency(): Currency {
  try {
    const v = localStorage.getItem(CURRENCY_KEY);
    if (v === "CNY" || v === "USD") return v;
    if (
      [key("openai"), key("jev"), BUDGET_KEY].some(
        (k) => localStorage.getItem(k) != null,
      )
    )
      return "CNY";
  } catch {
    // Storage blocked: fall back to the language.
  }
  return currentLang() === "en" ? "USD" : "CNY";
}
export const currencySymbol = (c: Currency = loadCurrency()) =>
  c === "USD" ? "$" : "¥";

/** Amounts in the other currency, rounded to what a price field shows. */
function convert(v: number, from: Currency, to: Currency) {
  if (from === to) return v;
  const next = from === "CNY" ? v / CNY_PER_USD : v * CNY_PER_USD;
  return Math.round(next * 1000) / 1000;
}
export function convertPrices(p: Prices, from: Currency, to: Currency): Prices {
  return {
    ...p,
    input: convert(p.input, from, to),
    cached: convert(p.cached, from, to),
    output: convert(p.output, from, to),
  };
}

/** Switches currency, converting saved prices (both models) and the limit. */
export function saveCurrency(next: Currency) {
  const from = loadCurrency();
  try {
    for (const provider of ["openai", "jev"] as const)
      if (localStorage.getItem(key(provider)) != null)
        localStorage.setItem(
          key(provider),
          JSON.stringify(convertPrices(loadPrices(provider, from), from, next)),
        );
    const budget = loadBudget();
    if (budget)
      localStorage.setItem(BUDGET_KEY, String(convert(budget, from, next)));
    localStorage.setItem(CURRENCY_KEY, next);
  } catch {
    // The choice then lasts only for this page session.
  }
}

/** The built-in prices, in the given currency. */
export const defaultPrices = (c: Currency = loadCurrency()) =>
  convertPrices(DEFAULT_PRICES, "CNY", c);

/** Saving money values fixes the currency they were entered in. */
function keepCurrency() {
  try {
    if (localStorage.getItem(CURRENCY_KEY) == null)
      localStorage.setItem(CURRENCY_KEY, loadCurrency());
  } catch {
    // Harmless: the same default is worked out next time.
  }
}

/** Prices for the given model; by default the one in use. */
export function loadPrices(
  provider: Provider = requestLimits.provider,
  currency: Currency = loadCurrency(),
): Prices {
  try {
    const v = JSON.parse(localStorage.getItem(key(provider)) ?? "null");
    if (
      v &&
      ["input", "cached", "output"].every((k) => typeof v[k] === "number")
    )
      return { ...defaultPrices(currency), ...v };
  } catch {
    // Private windows may block storage; defaults are fine.
  }
  return defaultPrices(currency);
}
export function savePrices(
  p: Prices,
  provider: Provider = requestLimits.provider,
) {
  keepCurrency();
  try {
    localStorage.setItem(key(provider), JSON.stringify(p));
  } catch {
    // Not persisting a display preference is harmless.
  }
}

/** List-price cost, before the bill correction. */
function listCost(u: UsageTotal, p: Prices) {
  const miss = Math.max(0, u.input - u.cached);
  return (miss * p.input + u.cached * p.cached + u.output * p.output) / 1e6;
}
export function cost(u: UsageTotal, p: Prices) {
  return listCost(u, p) * (p.factor || 1);
}
/** Returns prices whose factor makes `u` cost exactly what the bill said. */
export function calibrate(
  u: UsageTotal,
  p: Prices,
  actualBill: number,
): Prices {
  const base = listCost(u, p);
  if (!(base > 0) || !(actualBill > 0)) return p;
  return { ...p, factor: Math.min(5, Math.max(0.2, actualBill / base)) };
}

/** Most one run may cost before it pauses itself; null means no cap. Per browser. */
export function loadBudget(): number | null {
  try {
    const v = Number(localStorage.getItem(BUDGET_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
export function saveBudget(v: number | null) {
  keepCurrency();
  try {
    if (v && v > 0) localStorage.setItem(BUDGET_KEY, String(v));
    else localStorage.removeItem(BUDGET_KEY);
  } catch {
    // The cap then only lasts for this page session.
  }
}

/**
 * How far real runs have landed from the token estimate, learned from completed
 * runs. Kept apart from the bill factor: this one corrects token counts, that
 * one corrects prices.
 */
const ESTIMATE_KEY = "crush-monitor-estimate-factor";
export function loadEstimateFactor() {
  try {
    const v = Number(localStorage.getItem(ESTIMATE_KEY));
    return v >= 0.5 && v <= 2 ? v : 1;
  } catch {
    return 1;
  }
}
/** Blends in one run's actual/estimated ratio; outliers (e.g. cache hits) are ignored. */
export function learnEstimateFactor(
  old: number,
  estimated: number,
  actual: number,
) {
  if (!(estimated > 0.02) || !(actual > 0)) return old;
  const ratio = actual / estimated;
  if (ratio < 0.3 || ratio > 3) return old;
  const next = Math.min(2, Math.max(0.5, old * 0.5 + ratio * 0.5));
  try {
    localStorage.setItem(ESTIMATE_KEY, String(next));
  } catch {
    // Learned again after the next run.
  }
  return next;
}
export function listAmount(u: UsageTotal, p: Prices) {
  return listCost(u, p);
}

/** In the interface language and the chosen currency. */
export function formatMoney(v: number) {
  return messages().yuan(v, currencySymbol());
}
export function formatMoneyShort(v: number) {
  return messages().yuanShort(v, currencySymbol());
}

export function formatTokens(n: number) {
  return messages().tokens(n);
}
