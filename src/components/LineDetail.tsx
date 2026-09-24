import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal, Reason } from "./ui";
import { EMOTIONS } from "../../shared/labels";
import { INTENTS } from "../../shared/intents";
import { replyRating } from "../../shared/ratings";
import { statusLabel, type LineResult, type Message } from "../../shared/types";

const pct = (p: number) =>
  p > 0 && p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`;

/** One message's analysis, with rewrites for your replies and a way to correct the judgment. */
export function LineDetail({
  m,
  result,
  configured,
  noSuggest,
  suggesting,
  suggestError,
  reconsidering,
  savedCorrection,
  onSuggest,
  onReconsider,
  close,
}: {
  m: Message;
  result?: LineResult;
  configured: boolean;
  /** Why rewrites are unavailable (e.g. Jev-only mode); empty when available. */
  noSuggest: string;
  suggesting: boolean;
  suggestError: string;
  reconsidering: boolean;
  savedCorrection?: string;
  onSuggest: () => void;
  onReconsider: (text: string) => Promise<void>;
  close: () => void;
}) {
  const [draft, setDraft] = useState(savedCorrection ?? "");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={m.sender === "other" ? "情绪与意图" : "回复评价"}
      close={close}
    >
      <blockquote>{m.text}</blockquote>
      {m.sender === "other" ? (
        <>
          <h3>情绪</h3>
          <div className="emotion-distribution">
            {Object.entries(result?.emotions || {})
              .sort((a, b) => b[1] - a[1])
              .map(([key, p]) => (
                <div key={key}>
                  <span>
                    {EMOTIONS[key as keyof typeof EMOTIONS]?.label || key}
                  </span>
                  <div className="probability-track">
                    <i style={{ width: `${p * 100}%` }} />
                  </div>
                  <b>{pct(p)}</b>
                </div>
              ))}
          </div>
          {result?.reasons?.emotion && (
            <Reason>{result.reasons.emotion}</Reason>
          )}
          <h3 className="intent-detail-heading">意图</h3>
          <div className="intent-distribution">
            {Object.entries(result?.intents || {})
              .filter(([key, p]) => key in INTENTS && p > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([key, p]) => (
                <div key={key} className="intent-detail-item">
                  <div>
                    <strong>
                      {INTENTS[key as keyof typeof INTENTS].label}
                    </strong>
                    <b>{pct(p)}</b>
                  </div>
                  <p>{INTENTS[key as keyof typeof INTENTS].criteria}</p>
                </div>
              ))}
            {!result?.intents && <p>意图尚未分析。</p>}
          </div>
          {result?.reasons?.intent && <Reason>{result.reasons.intent}</Reason>}
          <p>
            两行分别展示主要情绪与主要沟通意图的候选解读，不代表测量真实内心。每行最多显示前三项，保留原始概率，不重新凑成
            100%。
          </p>
        </>
      ) : (
        <>
          <h3 className="reply-verdict">
            回复评级：{replyRating(result?.score.value)?.label ?? "待判断"}
          </h3>
          <p>
            {replyRating(result?.score.value)?.description ??
              "当前语境不足以判断表达质量"}
          </p>
          <p>
            回复评分 {result?.score.value ?? "—"} / 100 ·{" "}
            {result && statusLabel(result.score)}
          </p>
          {result?.score.reason && <Reason>{result.score.reason}</Reason>}
          {result && (
            <div className="suggestions">
              {result.suggestions?.length ? (
                <>
                  <h3>换个说法</h3>
                  {result.suggestions.map((s) => (
                    <div className="suggestion" key={s.text}>
                      <p className="suggestion-text">{s.text}</p>
                      <p className="suggestion-why">{s.why}</p>
                    </div>
                  ))}
                </>
              ) : null}
              {!noSuggest ? (
                <button
                  className="secondary"
                  disabled={suggesting || !configured}
                  onClick={onSuggest}
                >
                  <Sparkles size={15} />
                  {suggesting
                    ? "正在想…"
                    : result.suggestions?.length
                      ? "再换两种说法"
                      : "这句可以怎么说更好？"}
                </button>
              ) : (
                <p className="settings-note">{noSuggest}</p>
              )}
              {suggestError && !suggesting && (
                <p className="error">{suggestError}</p>
              )}
            </div>
          )}
        </>
      )}
      {result && !result.skipped && (
        <div className="correction">
          {result.correction && (
            <Reason title="你的说明">{result.correction}</Reason>
          )}
          {!open ? (
            <button className="text-button" onClick={() => setOpen(true)}>
              {result.correction
                ? "修改说明，再判断一次"
                : "判断不对？告诉模型实际情况"}
            </button>
          ) : (
            <>
              <label className="field">
                这句话实际是什么意思？（只有你知道的背景，比如「这是我们之间的梗」「她在开玩笑」）
                <textarea
                  rows={2}
                  maxLength={300}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <button
                className="primary"
                // Allowed during a running analysis: it re-judges only this line,
                // merges onto the latest results, and later batches use the note too.
                disabled={!draft.trim() || reconsidering || !configured}
                onClick={async () => {
                  setError("");
                  try {
                    await onReconsider(draft);
                    setOpen(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {reconsidering ? "正在重新判断…" : "按我的说明重新判断"}
              </button>
              <p className="import-hint">
                只重新分析这一句，调用一次模型，通常不到一分钱。你的说明会被记住，以后重新分析时也会用上。
              </p>
              {error && <p className="error">{error}</p>}
            </>
          )}
        </div>
      )}
      <p>结合当前已导入的上下文判断，不代表对方真实想法。</p>
    </Modal>
  );
}
