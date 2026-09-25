import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { formatTokens, formatYuan } from "../cost";
import { LEVELS, type Level } from "../../shared/plan";
import type { Analysis } from "../useAnalysis";
import type { Spend } from "../useSpend";
import type { Estimate } from "../../shared/estimate";
import { requestLimits } from "../../shared/limits";
import { useT } from "../i18n";
import type { Messages } from "../locales/zh";

/** e.g. "500 条 / 12,000 字" */
const limitText = (t: Messages) =>
  t.status.limit(
    requestLimits.messages.toLocaleString(),
    requestLimits.chars.toLocaleString(),
  );

const RANGES = [
  ["all", null],
  ["week", 7],
  ["month", 30],
] as const;

function remaining(
  t: Messages,
  done: number,
  total: number,
  startedAt: number,
) {
  // Too early to extrapolate honestly.
  if (done < 3 || !startedAt || done >= total) return "";
  const ms = ((Date.now() - startedAt) / done) * (total - done);
  const min = Math.round(ms / 60000);
  return min < 1 ? t.status.lessThanMinute : t.status.minutes(min);
}

export function StatusBar({
  a,
  spend,
  pending,
  configured,
  notice,
  incomplete,
  retryCost,
  on,
}: {
  a: Analysis;
  spend: Spend;
  pending: { lines: number; batched: boolean; estimate: Estimate } | null;
  configured: boolean;
  notice: string;
  incomplete: string[];
  retryCost: number;
  on: {
    start: () => void;
    settings: () => void;
    spend: () => void;
    overview: () => void;
    retry: (ids: string[]) => void;
  };
}) {
  const t = useT();
  const busy = a.status === "loading";
  // Re-render each second while running so the remaining time stays current.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const { done, total, startedAt, batched, range, count } = a.progress;
  const eta = busy ? remaining(t, done, total, startedAt) : "";
  // Level and range stay selectable after a run, so a quick run can be deepened.
  const controls = (
    <>
      <select
        aria-label={t.status.level}
        value={a.scope.level}
        title={t.levels[a.scope.level].detail}
        onChange={(e) =>
          a.setScope({ ...a.scope, level: e.target.value as Level })
        }
      >
        {(Object.keys(LEVELS) as Level[]).map((k) => (
          <option key={k} value={k} title={t.levels[k].detail}>
            {t.levels[k].label}
          </option>
        ))}
      </select>
      <select
        aria-label={t.status.range}
        value={String(a.scope.days)}
        title={t.status.rangeTitle}
        onChange={(e) =>
          a.setScope({
            ...a.scope,
            days: e.target.value === "null" ? null : Number(e.target.value),
          })
        }
      >
        {RANGES.map(([key, days]) => (
          <option key={key} value={String(days)}>
            {t.status.ranges[key]}
          </option>
        ))}
      </select>
    </>
  );
  return (
    <div className="composer-feedback">
      <span role="status">{notice}</span>{" "}
      <div className="analysis-status" aria-live="polite">
        {busy ? (
          <>
            <span className="working" />
            {t.status.analyzing(done, total)}
            {eta && t.status.remaining(eta)}
            {spend.runCost > 0 &&
              t.status.spentSoFar(t.yuanShort(spend.runCost)) +
                (spend.runEstimate
                  ? t.status.ofEstimate(t.yuanShort(spend.runEstimate))
                  : "")}
            <button onClick={a.cancel}>{t.status.stop}</button>
            {batched && (
              <span className="batch-note">
                {t.status.batchRunning(limitText(t))}
                {range &&
                  t.status.batchRange(
                    range[0].toLocaleString(),
                    range[1].toLocaleString(),
                    count.toLocaleString(),
                  )}
              </span>
            )}
          </>
        ) : pending ? (
          // Nothing is sent until the user has seen the estimate.
          <span className="pending-run">
            {spend.capped
              ? t.status.capped(spend.budget ?? 0)
              : a.status === "error"
                ? t.status.incomplete
                : a.stale
                  ? t.status.stale
                  : ""}
            {controls}
            {pending.lines
              ? t.status.pendingLines(pending.lines.toLocaleString())
              : t.status.overviewOnly}
            {pending.batched && (
              <span
                className="batch-hint"
                title={t.status.batchHintTitle(limitText(t))}
              >
                {pending.lines > requestLimits.batch
                  ? t.status.batchHintBig
                  : t.status.batchHintSmall}
              </span>
            )}
            {t.status.estimate(
              formatYuan(spend.estimateCost(pending.estimate)),
            )}
            {requestLimits.provider === "jev" && t.status.jevBill}
            <button
              className="start-run"
              disabled={!configured}
              onClick={on.start}
              title={t.status.startTitle(
                pending.estimate.requests,
                formatTokens(pending.estimate.input),
                formatTokens(pending.estimate.output),
              )}
            >
              {spend.capped ? t.status.resume : t.status.start}
            </button>
          </span>
        ) : a.status === "complete" ? (
          <span className="completed">
            <Check size={14} />
            {t.status.done}
            <button onClick={on.overview}>{t.status.forFun}</button>
            {/* Still selectable: a quick run can be deepened without starting over. */}
            {controls}
          </span>
        ) : null}
      </div>
      {!busy && incomplete.length > 0 && (
        <button
          className="inline-action"
          disabled={a.retrying.length > 0}
          onClick={() => on.retry(incomplete)}
        >
          <RotateCcw size={13} />{" "}
          {a.retrying.length
            ? t.status.retrying(a.retrying.length)
            : t.status.retryOnly(incomplete.length, formatYuan(retryCost))}
        </button>
      )}
      {a.usage.requests > 0 && (
        <button
          className="spend"
          onClick={on.spend}
          title={t.status.spendTitle}
        >
          {t.status.spent(formatYuan(spend.spent))}
        </button>
      )}
      {!configured && (
        <button className="inline-action warn" onClick={on.settings}>
          {t.status.noKey}
        </button>
      )}
      {a.error && !spend.capped && <span className="error">{a.error}</span>}
    </div>
  );
}
