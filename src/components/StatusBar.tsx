import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { formatTokens, formatYuan } from "../cost";
import { LEVELS, type Level } from "../../shared/plan";
import type { Analysis } from "../useAnalysis";
import type { Spend } from "../useSpend";
import type { Estimate } from "../../shared/estimate";
import { requestLimits } from "../../shared/limits";

/** e.g. "500 条 / 12,000 字" */
const limitText = () =>
  `${requestLimits.messages.toLocaleString()} 条 / ${requestLimits.chars.toLocaleString()} 字`;

const RANGES: [string, number | null][] = [
  ["全部", null],
  ["最近 7 天", 7],
  ["最近 30 天", 30],
];

function remaining(done: number, total: number, startedAt: number) {
  // Too early to extrapolate honestly.
  if (done < 3 || !startedAt || done >= total) return "";
  const ms = ((Date.now() - startedAt) / done) * (total - done);
  const min = Math.round(ms / 60000);
  return min < 1 ? "不到 1 分钟" : `约 ${min} 分钟`;
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
  const busy = a.status === "loading";
  // Re-render each second while running so the remaining time stays current.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const { done, total, startedAt, batched, range, count } = a.progress;
  const eta = busy ? remaining(done, total, startedAt) : "";
  // Level and range stay selectable after a run, so a quick run can be deepened.
  const controls = (
    <>
      <select
        aria-label="分析档位"
        value={a.scope.level}
        title={LEVELS[a.scope.level].detail}
        onChange={(e) =>
          a.setScope({ ...a.scope, level: e.target.value as Level })
        }
      >
        {(Object.keys(LEVELS) as Level[]).map((k) => (
          <option key={k} value={k} title={LEVELS[k].detail}>
            {LEVELS[k].label}
          </option>
        ))}
      </select>
      <select
        aria-label="分析范围"
        value={String(a.scope.days)}
        title="逐句分析只看这段时间；整体好感始终读完整聊天"
        onChange={(e) =>
          a.setScope({
            ...a.scope,
            days: e.target.value === "null" ? null : Number(e.target.value),
          })
        }
      >
        {RANGES.map(([label, days]) => (
          <option key={label} value={String(days)}>
            {label}
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
            正在分析 {done}/{total}
            {eta && ` · 剩余${eta}`}
            {spend.runCost > 0 &&
              ` · 本次已花${formatYuan(spend.runCost).replace("约 ", "")}` +
                (spend.runEstimate
                  ? ` / 预计${formatYuan(spend.runEstimate).replace("约 ", "")}`
                  : "")}
            <button onClick={a.cancel}>停止</button>
            {batched && (
              <span className="batch-note">
                聊天已超过单次上限（{limitText()}），分批上传中
                {range &&
                  `：正在分析第 ${range[0].toLocaleString()}–${range[1].toLocaleString()} 条，共 ${count.toLocaleString()} 条`}
              </span>
            )}
          </>
        ) : pending ? (
          // Nothing is sent until the user has seen the estimate.
          <span className="pending-run">
            {spend.capped
              ? `已达到单次花费上限 ¥${spend.budget}，已暂停。`
              : a.status === "error"
                ? "分析未完成，"
                : a.stale
                  ? "当前显示的是旧版规则的结果，"
                  : ""}
            {controls}
            {pending.lines
              ? `待分析 ${pending.lines.toLocaleString()} 条`
              : "只做整体分析"}
            {pending.batched && (
              <span
                className="batch-hint"
                title={`一次最多读 ${limitText()}：逐句分析和走势分批覆盖全部消息，整体好感只读最近的部分。`}
              >
                （超过单次上限，将分批上传）
              </span>
            )}{" "}
            · 预计{formatYuan(spend.estimateCost(pending.estimate))}
            {requestLimits.provider === "jev" && "（Jev 以平台账单为准）"}
            <button
              className="start-run"
              disabled={!configured}
              onClick={on.start}
              title={`约 ${pending.estimate.requests} 次分析请求，输入约 ${formatTokens(pending.estimate.input)}、输出约 ${formatTokens(pending.estimate.output)} tokens。按设置里的单价估算，并按过去几次的实际用量自动修正；实际以服务商账单为准。`}
            >
              {spend.capped ? "继续分析" : "开始分析"}
            </button>
          </span>
        ) : a.status === "complete" ? (
          <span className="completed">
            <Check size={14} />
            分析完成
            <button onClick={on.overview}>娱乐参考</button>
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
            ? `正在重试 ${a.retrying.length} 条…`
            : `只重试这 ${incomplete.length} 条未完成的（${formatYuan(retryCost)}）`}
        </button>
      )}
      {a.usage.requests > 0 && (
        <button
          className="spend"
          onClick={on.spend}
          title="查看花费明细、设置单次上限，或按实际账单校准"
        >
          已花费 {formatYuan(spend.spent)}
        </button>
      )}
      {!configured && (
        <button className="inline-action warn" onClick={on.settings}>
          还没有设置 API Key，点这里填写
        </button>
      )}
      {a.error && !spend.capped && <span className="error">{a.error}</span>}
    </div>
  );
}
