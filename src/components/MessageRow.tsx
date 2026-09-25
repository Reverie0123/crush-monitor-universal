import { RotateCcw } from "lucide-react";
import { Avatar } from "../AvatarPicker";
import type { Avatars } from "../storage";
import { topEmotions } from "../../shared/labels";
import { topIntents } from "../../shared/intents";
import { replyRating } from "../../shared/ratings";
import type { LineResult, Message } from "../../shared/types";
import { useT } from "../i18n";
import { zh } from "../locales/zh";

export function MessageRow({
  m,
  prev,
  r,
  busy,
  avatars,
  self,
  other,
  onOpen,
  onRetry,
}: {
  m: Message;
  prev?: Message;
  r?: LineResult;
  busy: boolean;
  avatars: Avatars;
  self: string;
  other: string;
  onOpen: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const t = useT();
  const pending = (
    <span className="pending-tag" title={t.row.pendingTip}>
      {busy ? t.row.analyzing : t.row.pending}
    </span>
  );
  return (
    <>
      {(!prev || m.timestamp !== prev.timestamp) && m.timestamp && (
        <div className="timestamp">{m.timestamp.replace(/^\d{4}年/, "")}</div>
      )}
      {m.kind === "system" ? (
        <div className="system-notice" title={t.row.systemTip}>
          {m.text}
        </div>
      ) : (
        <div className="message-row">
          <Avatar
            src={avatars[m.sender]}
            name={m.sender === "self" ? self : other}
            mine={m.sender === "self"}
          />
          <div className="message-content">
            <div
              className={`bubble ${m.kind === "unreadable" ? "unreadable" : ""}`}
              title={m.kind === "unreadable" ? t.row.unreadableTip : undefined}
            >
              {m.text}
            </div>
            {m.kind === "text" && (
              <div className={`message-tags ${m.sender}`}>
                {r?.skipped ? (
                  <span className="pending-tag">
                    {/* Saved results store this note in Chinese. */}
                    {r.skipped === zh.row.skippedTooLong
                      ? t.row.skippedTooLong
                      : r.skipped}
                  </span>
                ) : r?.incomplete ? (
                  <button
                    className="pending-tag retry-tag"
                    disabled={busy}
                    onClick={() => onRetry(m.id)}
                    title={t.row.retryTip}
                  >
                    <RotateCcw size={12} /> {t.row.retry}
                  </button>
                ) : m.sender === "other" ? (
                  <>
                    <div className="analysis-row emotion-row">
                      <span className="analysis-row-label">
                        {t.row.emotion}
                      </span>
                      {r?.emotions
                        ? topEmotions(r.emotions).map((emotion) => (
                            <button
                              key={emotion.key}
                              className={`emotion-tag emotion-${emotion.key}`}
                              onClick={() => onOpen(m.id)}
                              title={r.reasons?.emotion}
                              aria-label={t.row.emotionAria(
                                t.emotions[emotion.key],
                                emotion.percent,
                                m.text,
                              )}
                            >
                              <span>{t.emotions[emotion.key]}</span>
                              <b>{emotion.percent}</b>
                            </button>
                          ))
                        : pending}
                    </div>
                    <div className="analysis-row intent-row">
                      <span className="analysis-row-label">{t.row.intent}</span>
                      {r?.intents
                        ? topIntents(r.intents).map((intent) => (
                            <button
                              key={intent.key}
                              className="intent-tag"
                              onClick={() => onOpen(m.id)}
                              title={r.reasons?.intent}
                              aria-label={t.row.intentAria(
                                t.intents[intent.key],
                                intent.percent,
                                m.text,
                              )}
                            >
                              <span>{t.intents[intent.key]}</span>
                              <b>{intent.percent}</b>
                            </button>
                          ))
                        : pending}
                    </div>
                  </>
                ) : r ? (
                  <button
                    className="reply-tag"
                    onClick={() => onOpen(m.id)}
                    title={r.score.reason}
                    aria-label={t.row.replyAria(m.text)}
                  >
                    <span>{t.row.replyRating}</span>
                    <b>{replyRating(r.score.value)?.label ?? t.pending}</b>
                  </button>
                ) : (
                  pending
                )}
                {r?.correction && (
                  <span
                    className="corrected-tag"
                    title={t.row.noteTip(r.correction)}
                  >
                    {t.row.corrected}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
