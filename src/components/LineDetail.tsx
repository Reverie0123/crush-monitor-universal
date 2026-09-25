import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal, Reason } from "./ui";
import { EMOTIONS } from "../../shared/labels";
import { INTENTS } from "../../shared/intents";
import { replyRating } from "../../shared/ratings";
import type { LineResult, Message } from "../../shared/types";
import { errorOf, judgmentText, say, useT, type Text } from "../i18n";

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
  const [error, setErrorState] = useState<Text>("");
  const setError = (x: Text) => setErrorState(() => x);
  const t = useT();
  const rating = replyRating(result?.score.value);
  return (
    <Modal
      title={m.sender === "other" ? t.line.emotionTitle : t.line.replyTitle}
      close={close}
    >
      <blockquote>{m.text}</blockquote>
      {m.sender === "other" ? (
        <>
          <h3>{t.line.emotion}</h3>
          <div className="emotion-distribution">
            {Object.entries(result?.emotions || {})
              .sort((a, b) => b[1] - a[1])
              .map(([key, p]) => (
                <div key={key}>
                  <span>
                    {key in EMOTIONS
                      ? t.emotions[key as keyof typeof EMOTIONS]
                      : key}
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
          <h3 className="intent-detail-heading">{t.line.intent}</h3>
          <div className="intent-distribution">
            {Object.entries(result?.intents || {})
              .filter(([key, p]) => key in INTENTS && p > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([key, p]) => (
                <div key={key} className="intent-detail-item">
                  <div>
                    <strong>{t.intents[key as keyof typeof INTENTS]}</strong>
                    <b>{pct(p)}</b>
                  </div>
                  <p>{t.intentHints[key as keyof typeof INTENTS]}</p>
                </div>
              ))}
            {!result?.intents && <p>{t.line.intentPending}</p>}
          </div>
          {result?.reasons?.intent && <Reason>{result.reasons.intent}</Reason>}
          <p>{t.line.distributionNote}</p>
        </>
      ) : (
        <>
          <h3 className="reply-verdict">
            {t.line.replyRating(rating?.label ?? t.pending)}
          </h3>
          <p>{rating ? t.ratings[rating.label] : t.line.noContext}</p>
          <p>
            {t.line.replyScore(String(result?.score.value ?? t.dash))}
            {result && ` · ${judgmentText(t, result.score)}`}
          </p>
          {result?.score.reason && <Reason>{result.score.reason}</Reason>}
          {result && (
            <div className="suggestions">
              {result.suggestions?.length ? (
                <>
                  <h3>{t.line.rephrase}</h3>
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
                  // Availability is noSuggest's job: suggestions use the chat model's
                  // key, which may be set even when the analysis model's is not.
                  disabled={suggesting}
                  onClick={onSuggest}
                >
                  <Sparkles size={15} />
                  {suggesting
                    ? t.line.thinking
                    : result.suggestions?.length
                      ? t.line.tryAgain
                      : t.line.howBetter}
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
            <Reason title={t.line.yourNote}>{result.correction}</Reason>
          )}
          {!open ? (
            <button className="text-button" onClick={() => setOpen(true)}>
              {result.correction ? t.line.editNote : t.line.wrong}
            </button>
          ) : (
            <>
              <label className="field">
                {t.line.noteLabel}
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
                    setError(errorOf(e));
                  }
                }}
              >
                {reconsidering ? t.line.reconsidering : t.line.reconsider}
              </button>
              <p className="import-hint">{t.line.reconsiderNote}</p>
              {error && <p className="error">{say(t, error)}</p>}
            </>
          )}
        </div>
      )}
      <p>{t.line.disclaimer}</p>
    </Modal>
  );
}
