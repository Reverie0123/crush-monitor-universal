import { useEffect, useRef, useState } from "react";
import type { Estimate } from "../shared/estimate";
import {
  cost,
  learnEstimateFactor,
  listYuan,
  loadBudget,
  loadEstimateFactor,
  loadPrices,
  saveBudget,
  type Prices,
} from "./cost";
import { NO_USAGE, type Analysis, type UsageTotal } from "./useAnalysis";

const diff = (a: UsageTotal, b: UsageTotal): UsageTotal => ({
  input: a.input - b.input,
  output: a.output - b.output,
  cached: a.cached - b.cached,
  requests: a.requests - b.requests,
});
const asUsage = (e: Estimate): UsageTotal => ({
  input: e.input,
  cached: e.cached,
  output: e.output,
  requests: e.requests,
});

/**
 * Money around one analysis run: the estimate shown before it, the live spend
 * during it, the per-run cap that pauses it, and learning from how far the
 * estimate was off once it finishes.
 */
export function useSpend(a: Analysis) {
  const [prices, setPrices] = useState(loadPrices);
  const [budget, setBudgetState] = useState(loadBudget);
  const [estimateFactor, setEstimateFactor] = useState(loadEstimateFactor);
  const [capped, setCapped] = useState(false);
  const run = useRef<{ usage: UsageTotal; estimate: Estimate | null } | null>(
    null,
  );
  const busy = a.status === "loading";

  /** Call right before starting a run the user confirmed from an estimate. */
  function begin(estimate: Estimate | null) {
    run.current = { usage: a.usage, estimate };
    setCapped(false);
  }
  useEffect(() => {
    // Runs started elsewhere (e.g. retrying lines) are still tracked for the cap.
    if (busy && !run.current) run.current = { usage: a.usage, estimate: null };
    if (!busy && run.current) {
      const { usage, estimate } = run.current;
      if (a.status === "complete" && estimate)
        setEstimateFactor((f) =>
          learnEstimateFactor(
            f,
            listYuan(asUsage(estimate), prices),
            listYuan(diff(a.usage, usage), prices),
          ),
        );
      run.current = null;
    }
  }, [busy, a.status]);

  const runUsage =
    busy && run.current ? diff(a.usage, run.current.usage) : NO_USAGE;
  const runCost = cost(runUsage, prices);
  useEffect(() => {
    if (busy && budget && runCost > budget) {
      a.cancel();
      setCapped(true);
    }
  }, [busy, budget, runCost]);

  return {
    prices,
    setPrices: (p: Prices) => setPrices(p),
    reloadPrices: () => setPrices(loadPrices()),
    budget,
    setBudget: (v: number | null) => {
      saveBudget(v);
      setBudgetState(v);
    },
    /** True when the last run was paused by the cap. */
    capped,
    clearCapped: () => setCapped(false),
    spent: cost(a.usage, prices),
    runCost,
    runEstimate: run.current?.estimate
      ? cost(asUsage(run.current.estimate), prices) * estimateFactor
      : null,
    /** Estimated yuan for a planned run, corrected by what past runs taught us. */
    estimateCost: (e: Estimate) => cost(asUsage(e), prices) * estimateFactor,
    estimateFactor,
    begin,
    /** The run never started: forget its baseline so the cap and learning stay accurate. */
    abandon: () => {
      run.current = null;
    },
  };
}
export type Spend = ReturnType<typeof useSpend>;
