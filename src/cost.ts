import type { UsageTotal } from "./useAnalysis";

/**
 * Yuan per million tokens, plus a correction factor from the visitor's real bill.
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
const KEY = "crush-monitor-prices-v2";

export function loadPrices(): Prices {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      v &&
      ["input", "cached", "output"].every((k) => typeof v[k] === "number")
    )
      return { ...DEFAULT_PRICES, ...v };
  } catch {
    // Private windows may block storage; defaults are fine.
  }
  return DEFAULT_PRICES;
}
export function savePrices(p: Prices) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
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
  actualYuan: number,
): Prices {
  const base = listCost(u, p);
  if (!(base > 0) || !(actualYuan > 0)) return p;
  return { ...p, factor: Math.min(5, Math.max(0.2, actualYuan / base)) };
}

/** Most one run may cost before it pauses itself; null means no cap. Per browser. */
const BUDGET_KEY = "crush-monitor-budget";
export function loadBudget(): number | null {
  try {
    const v = Number(localStorage.getItem(BUDGET_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
export function saveBudget(v: number | null) {
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
export function listYuan(u: UsageTotal, p: Prices) {
  return listCost(u, p);
}

export function formatYuan(v: number) {
  return v < 0.01 ? "不到 ¥0.01" : `约 ¥${v < 1 ? v.toFixed(2) : v.toFixed(1)}`;
}

export function formatTokens(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(n >= 1e6 ? 0 : 1)} 万` : String(n);
}
