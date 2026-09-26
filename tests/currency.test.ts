import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// cost.ts keeps prices in localStorage; a small in-memory one stands in.
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});
const {
  DEFAULT_PRICES,
  defaultPrices,
  formatMoney,
  loadBudget,
  loadCurrency,
  loadPrices,
  saveBudget,
  saveCurrency,
  savePrices,
} = await import("../src/cost");
const { currentLang } = await import("../src/i18n");

beforeEach(() => store.clear());

test("new visitors get the currency of their interface language", () => {
  assert.equal(loadCurrency(), currentLang() === "en" ? "USD" : "CNY");
});

test("visitors who already saved prices or a limit keep yuan", () => {
  store.set("crush-monitor-budget", "5");
  assert.equal(loadCurrency(), "CNY");
  store.clear();
  store.set("crush-monitor-prices-v2", JSON.stringify(DEFAULT_PRICES));
  assert.equal(loadCurrency(), "CNY");
});

test("switching converts saved prices and the limit, and back again", () => {
  saveCurrency("CNY");
  savePrices({ input: 1.5, cached: 0.05, output: 4.5, factor: 1.3 }, "openai");
  saveBudget(7.2);
  saveCurrency("USD");
  const usd = loadPrices("openai");
  assert.equal(usd.input, 0.208);
  assert.equal(usd.output, 0.625);
  assert.equal(usd.factor, 1.3, "the bill factor is a ratio and stays");
  assert.equal(loadBudget(), 1);
  assert.match(formatMoney(2.5), /\$2\.5/);
  saveCurrency("CNY");
  assert.ok(Math.abs(loadPrices("openai").input - 1.5) < 0.01);
  assert.equal(loadBudget(), 7.2);
  assert.match(formatMoney(2.5), /¥2\.5/);
});

test("unsaved prices follow the built-in defaults in the chosen currency", () => {
  saveCurrency("USD");
  assert.deepEqual(loadPrices("jev"), defaultPrices("USD"));
  assert.equal(defaultPrices("CNY").input, DEFAULT_PRICES.input);
});
